import { Draft, enableMapSet, Immutable, produce } from "immer"
import { CardDefinition, registerCard } from "./card"
import { BaseCardDb } from "./db/cardDb"
import { Identifiable, Identified, LookupDb, lookupInDb, registerInDb } from "./lookupDb"
import { BaseMonsterDB } from "./db/monsterDb"
import { MonsterDefinition, setupMonsterDrawPile, activeMonsters } from "./monster"

enableMapSet()

export const NamedPiles = {
    Draw: "Draw",
    Discard: "Discard",
    Hand: "Hand",
    MonsterDraw: "MonsterDraw",
    MonsterDiscard: "MonsterDiscard",

} as const



export type BasePile = {
    id: string // note we really should refactor to instanced
    containing: string[]
}

export type OpenPile = BasePile & { type: "transparent" }
export type MonsterPile = BasePile & { type: "monster", monster: MonsterDefinition["lookupId"] }

export type Pile = OpenPile | MonsterPile

const startingActionTime = 3

export type OptionChoice = {
    optionId: string
    effects: GameStep[]
}
export type PromptChoiceStep = {
    stepType: "PromptChoice"
    source?: MonsterPile["id"]
    choices: OptionChoice[]
}

export type ModifyTimeStep = {
    stepType: "modifyTime",
    modifier: number
}
export type GameStep = 
    | PromptChoiceStep
    | ModifyTimeStep

// TODO: Refactor into game state and engine. Engine handles lookups and step handling
type GameStateData = {
    actionTime: number
    piles: Record<string, Pile>
    lastSummon: number
    stepStack: GameStep[]
    lookupDb: {
        cards: LookupDb<CardDefinition>
        monsters: LookupDb<MonsterDefinition>
    }
} 


export type GameState = Immutable<GameStateData> 
export type DraftGame = Draft<GameState>
function createPile(id: Pile["id"]): Pile {
    return {
        id,
        containing: [],
        type: "transparent"
    }
}

export function addNewPile(gs: Draft<GameState>, id: Pile["id"]) {
    if (id in gs.piles) {
        return;
    }
    gs.piles[id] = createPile(id)
}

export function summonMonsterPile(gs: Draft<GameState>, monsterId: MonsterDefinition["lookupId"]) {
    const instanceId = `${monsterId}-${gs.lastSummon}`
    gs.lastSummon++
    gs.piles[instanceId] = {
        id: instanceId,
        containing: [],
        type: "monster",
        monster: monsterId
    }
}
export function removeFromPile(
    gs: Draft<GameState>,
    card: string,
    pile: Pile["id"]
) {
    const cards = gs.piles[pile].containing
    const i = cards.indexOf(card)

    if (i !== -1) cards.splice(i, 1)
}

export function putIntoPile(
    gs: Draft<GameState>,
    card: string,
    pile: Pile["id"]
) {
    gs.piles[pile].containing.push(card)
}

export function emptyGameState(): GameState {
    return {
        actionTime: startingActionTime,
        piles: {},
        lastSummon: 0,
        stepStack: [],
        lookupDb: {
            cards: new Map(),
            monsters: new Map()
        }
    }
}

export function initLookupDb(gs: GameState): GameState {
    return produce(gs, draft => {
        BaseCardDb.forEach(c => registerCard(draft, c))
        BaseMonsterDB.forEach(m => registerInDb(draft.lookupDb.monsters, m))
    })
}

export function initGame(gs: GameState): GameState {
    gs = setupCardPiles(gs)
    gs = setupMonsterDrawPile(gs)
    gs = initLookupDb(gs)
    return gs
}
export function setupCardPiles(gs: GameState): GameState {
    return produce(emptyGameState(), draft => {
        addNewPile(draft, NamedPiles.Draw)
        addNewPile(draft, NamedPiles.Discard)
        addNewPile(draft, NamedPiles.Hand)
    })
}

export function moveCard(
    gs: Draft<GameState>,
    card: string,
    from: Pile["id"],
    to: Pile["id"]
) {
    removeFromPile(gs, card, from)
    putIntoPile(gs, card, to)
}

function shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
}

export function shufflePileIntoPile(gs: GameState, from: Pile["id"], to: Pile["id"]): GameState {
    return produce(gs, draft => {
        while (draft.piles[from].containing.length) {
            moveCard(draft, draft.piles[from].containing[0], from, to)
        }

        shuffle(draft.piles[to].containing)
    })
}


export function drawCard(gs: GameState): GameState {
    if (gs.piles["Draw"].containing.length === 0) {
        if (gs.piles["Discard"].containing.length === 0) {
            return gs
        }
        gs = shufflePileIntoPile(gs, NamedPiles.Discard, NamedPiles.Draw)
    }
    return produce(gs, draft => {
        const firstCard = draft.piles[NamedPiles.Draw].containing[0]
        moveCard(draft, firstCard, NamedPiles.Draw, NamedPiles.Hand)
    })
}
export function fromPileGetAt(gs: GameState, pile: Pile["id"], index: number): string | undefined {
    return gs.piles[pile].containing.at(index)   
}
export function playCard(gs: GameState, card: CardDefinition["lookupId"], target: Pile["id"]): GameState {
    return produce(gs, draft => {
        if(fromPileGetAt(draft, NamedPiles.Hand, 0) && draft.piles[target]?.type === "monster") {
            moveCard(draft, card, NamedPiles.Hand, target)
        }
        //otherwise card doesn't exist or valid target doesn't exist
    })
}

export function stateBasedActions(gs: GameState): GameState {
    return produce(gs, draft => {
        let hasChanged = true;
        let depth = 0
        while (hasChanged && depth < 100) {
            hasChanged = false;
            // depth += 1
            // Note: activeMonsters should accept draft or GameState safely
            for (const monsterPile of activeMonsters(draft as unknown as GameState)) {
                const health = lookupInDb(draft.lookupDb.monsters, monsterPile.monster).health;

                if (monsterPile.containing.length >= health) {
                    shufflePileIntoPile(draft, monsterPile.id, NamedPiles.Discard);
                    putIntoPile(draft, monsterPile.monster, NamedPiles.MonsterDiscard);
                    deletePile(draft, monsterPile.id);

                    // Trigger another pass in case this death cascades
                    hasChanged = true;
                }
            }

            //If the top step is not a choice, execute it
            const step = draft.stepStack.pop()
            if (step?.stepType !== "PromptChoice") {
                switch (step?.stepType) {
                    case "modifyTime":
                        draft.actionTime += step.modifier
                        hasChanged = true
                        break;
                }
            } else {
                //restore, eventually we'll add a peek operation
                draft.stepStack.push(step)
            }
            
        }
    });
}
export function getCardsInPlie(gs: GameState, pile: Pile["id"]): Immutable<Pile["containing"]> {
    return gs.piles[pile].containing;
}
function deletePile(gs: Draft<GameState>, pile: Pile["id"]): void {
    delete gs.piles[pile]
}


type AttachAction = {
    actionType: "attach",
    card: Identified<CardDefinition>,
    target: MonsterPile["id"]
}

type EndTurnAction = {
    actionType: "endTurn"
}

type ChooseMonsterMoveAction = {
    actionType: "chooseMonsterMove",
    actionOption: OptionChoice["optionId"]
    monster: MonsterPile["id"]
}

type ChooseOptionAction = {
    actionType: "chooseOption"
    actionOption: OptionChoice["optionId"]
}

type Action = 
    | AttachAction
    | EndTurnAction
    | ChooseMonsterMoveAction
    | ChooseOptionAction
    
export function getPlayableActions(gs: GameState): Action[] {
    if (gs.stepStack.length === 0) {
        return getCardsInPlie(gs, NamedPiles.Hand).flatMap(c => activeMonsters(gs).map(m => ({
            actionType: "attach",
            card: c,
            target: m.id
        })))
    }

    if (gs.stepStack[0].stepType === "PromptChoice") {
        const step = gs.stepStack[0]
        if (step.source) {
            const pile = gs.piles[step.source]
            if (pile.type === "monster") {
                return lookupInDb(gs.lookupDb.monsters, pile.monster).moves.map<ChooseMonsterMoveAction>(move => ({
                    actionType: "chooseMonsterMove",
                    monster: pile.id,
                    actionOption: move.optionId
                }))
            }
        }
        return step.choices.map<ChooseOptionAction>(opt => ({actionType: "chooseOption", actionOption: opt.optionId}))
    }

    return []
}

// TODO: register handlers for each action
export function playAction(gs: GameState, action: Action): GameState {
    switch (action.actionType) {
        case "attach":
            return stateBasedActions(produce(gs, draft => {
                attachAction(draft, action)
            }))
        case "endTurn": 
            return stateBasedActions(produce(gs, draft => {
                draft.actionTime = startingActionTime
                draft.stepStack.push(...activeMonsters(draft).map<GameStep>(m => ({
                    stepType: "PromptChoice",
                    choices: lookupInDb(draft.lookupDb.monsters, m.monster).moves,
                    source: m.id
                })))
            }))
        case "chooseMonsterMove":
        case "chooseOption":
            return stateBasedActions(produce(gs, draft => {
                const currentStep = draft.stepStack.pop()
                if (currentStep?.stepType === "PromptChoice") {
                    const chosenOption = currentStep.choices.find(c => c.optionId === action.actionOption)
                    if (chosenOption) {
                        draft.stepStack.push(...chosenOption.effects)
                        
                    }
                } else {
                    draft.stepStack.push()
                }
            }))
    }
}

function attachAction(gs: Draft<GameState>, action: AttachAction): void {
    moveCard(gs, action.card, NamedPiles.Hand, action.target)
}


/*

Items
- Multiple actions per card available outside the hand
Mana Visor
    1T: Peek at an adjacent tile
    \\E: Choose up to 3 tiles adjacent to revealed tiles. Reveal them in any order.
        - Ordered actions
Adrenaline Band
    Whenever you take damage, inflict +1T. This only triggers once per turn.
        - Triggered on damage, once per turn
    \\E: Inflict +3T
        - Trash effect
Knowledge Tome
    1T: Draw a card
    \\E: Draw cards until your hand is full
        - Hand limit, multidraw
Wind boots
    You may move up to two tiles instead of one over revealed tiles
        - Modify base actions
    \\E: Instantly move to any revealed tile
Events
Healing fountain - Room
    \\E: Gain 3 health
Shop
    Draw 2 card from the level 1 action pile. Trash 2 cards from your hand

 */
    

