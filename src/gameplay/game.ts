import { Draft, enableMapSet, Immutable, produce } from "immer"
import { CardDefinition, registerCard } from "./card"
import { BaseCardDb } from "./cardDb"
import { Identifiable, Identified, LookupDb, lookupInDb, registerInDb } from "./lookupDb"

enableMapSet()

export const NamedPiles = {
    Draw: "Draw",
    Discard: "Discard",
    Hand: "Hand",
    MonsterDraw: "MonsterDraw",
    MonsterDiscard: "MonsterDiscard",

} as const


export type MonsterDefinition = {
    name: string
    health: number
} & Identifiable<string>
export type BasePile = {
    id: string // note we really should refactor to instanced
    containing: string[]
}

export type OpenPile = BasePile & { type: "transparent" }
export type MonsterPile = BasePile & { type: "monster", monster: MonsterDefinition["lookupId"] }

export type Pile = OpenPile | MonsterPile

const startingActionTime = 3
// TODO: Refactor into game state and engine. Engine handles lookups and step handling
type GameStateData = {
    actionTime: number
    piles: Record<string, Pile>
    lastSummon: number
    stepStack: unknown[]
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
function removeFromPile(
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
function pipe<T>(
    value: T,
    ...fns: Array<(x: T) => T>
): T {
    return fns.reduce((v, fn) => fn(v), value)
}
export function initGame(gs: GameState): GameState {
    gs = initDeck(gs)
    gs = setupMonsterDrawPile(gs)
    gs = initLookupDb(gs)
    return gs
}
export function initDeck(gs: GameState): GameState {
    return produce(emptyGameState(), draft => {
        addNewPile(draft, NamedPiles.Draw)
        addNewPile(draft, NamedPiles.Discard)
        addNewPile(draft, NamedPiles.Hand)
        for (let i = 0; i < 5; i++) {
            putIntoPile(draft, "Strike", NamedPiles.Draw)
        }
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
function fromPileGetAt(gs: GameState, pile: Pile["id"], index: number): string | undefined {
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

export function setupMonsterDrawPile(gs: GameState): GameState {
    return produce(gs, draft => {
        addNewPile(draft, NamedPiles.MonsterDraw)
        addNewPile(draft, NamedPiles.MonsterDiscard)
        putIntoPile(draft, "Slime", NamedPiles.MonsterDraw)
    })
}

export function summonMonsterFromDraw(gs: GameState): GameState {
    return produce(gs, draft => {
        const toSummon = fromPileGetAt(draft, NamedPiles.MonsterDraw, 0)
        if (toSummon) {
            summonMonsterPile(draft, toSummon)
            removeFromPile(draft, toSummon, NamedPiles.MonsterDraw)
        }
    })
}

export function activeMonsters(gs: GameState): Immutable<MonsterPile[]> {
    return Object.values(gs.piles).filter(p => p.type === "monster")
}
export function stateBasedActions(gs: GameState): GameState {
    // for each enemy, if they have more attacks than health, kill them
    gs = produce(gs, draft => {
        for (const monsterPile of activeMonsters(gs)) {
            if (monsterPile.containing.length >= lookupInDb(gs.lookupDb.monsters, monsterPile.monster).health) {
                shufflePileIntoPile(draft, monsterPile.id, NamedPiles.Discard)
                putIntoPile(draft, monsterPile.monster, NamedPiles.MonsterDiscard)
                deletePile(draft, monsterPile.id)
            }
        }
    })
    return gs
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

type Action = 
    | AttachAction
    | EndTurnAction
    
export function getPlayableActions(gs: GameState): Action[] {
    return getCardsInPlie(gs, NamedPiles.Hand).flatMap(c => activeMonsters(gs).map(m => ({
        actionType: "attach",
        card: c,
        target: m.id
    })))
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
            }))
    }
}

function attachAction(gs: Draft<GameState>, action: AttachAction): void {
    moveCard(gs, action.card, NamedPiles.Hand, action.target)
}
/**
 * Monsters (initial guesses of 3 health and 1 time and 1 attack meaning 5? value points)
 * 
Dissolving Slime (1/2)
    1A: Discard a card
Ruthless Goblin (3/1)
    1A: \\R[1-3] 1D
    1A: Deal 1D and apply +1T
Twinkling Faerie (2/1)
    1A: Hide a card from your hand
    1A: Deal 1D
Rusting Golem (3/1)
    1A: Deal 1D
    1A: Move an attack from this card to another monster or into your hand
Clattering Skeleton (2/1)
    1A: Stun 1T
    1A: Deal 1D
Slithering Snake (2/1)
    1A:  Trash a card from your discard
    1A: 1D


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
    

const BaseMonsterDB: MonsterDefinition[] = [
    {
        lookupId: "Slime",
        name: "Slime",
        health: 3
    }
]