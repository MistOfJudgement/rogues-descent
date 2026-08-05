import { Draft, Immutable, produce } from "immer"

type CardType = "attack" | "spell" | "maneuver"
type AttackCard = {
    types: CardType[]
    damage: number | ((gs: GameState) => number)
}
type NonAttackCard = {
    types: Exclude<CardType, "attack">[],
    damage?: never
}

export type CardData = {
    id: string
    name: string
    description: string
    cost: number
} & (AttackCard | NonAttackCard)


export const NamedPiles = {
    Draw: "Draw",
    Discard: "Discard",
    Hand: "Hand",
    MonsterDraw: "MonsterDraw",
    MonsterDiscard: "MonsterDiscard",

} as const

export function registerInDB<T extends { id: string }>(db: Record<string, T>, item: T) {
    if (db[item.id]) {
        throw new Error(`Tried to register item [${item.id}] already in db`)
    }
    db[item.id] = item
}
export function registerCard(gs: Draft<GameState>, card: CardData) {
    registerInDB(gs.lookupDb.cards, card)
}
export type MonsterData = {
    id: string
    name: string
    health: number
}
export type BasePile = {
    id: string
    containing: string[]
}

export type OpenPile = BasePile & { type: "transparent" }
export type MonsterPile = BasePile & { type: "monster", monster: MonsterData["id"] }

export type Pile = OpenPile | MonsterPile
type GameStateData = {
    actionTime: number
    piles: Record<string, Pile>
    lastSummon: number
    stepStack: unknown[]
    lookupDb: {
        cards: Record<CardData["id"], CardData>
        monsters: Record<MonsterData["id"], MonsterData>
    }
} 


export type GameState = Immutable<GameStateData> 

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

export function summonMonsterPile(gs: Draft<GameState>, monsterId: MonsterData["id"]) {
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
        actionTime: 0,
        piles: {},
        lastSummon: 0,
        stepStack: [],
        lookupDb: {
            cards: {},
            monsters: {}
        }
    }
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
export function playCard(gs: GameState, card: CardData["id"], target: Pile["id"]): GameState {
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
            if (monsterPile.containing.length >= MonsterDB[monsterPile.monster].health) {
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
const CardDB: Record<string, CardData> = {}
// registerCard({
//         id: "Knife",
//         name: "Knife",
//         description: "Deal 1D",
//     cost: 1,
//     types: ["attack"],
//     damage: 1

// })
const BaseCardDb: CardData[] = [{
        id: "Knife",
        name: "Knife",
        description: "Deal 1D",
    cost: 1,
    types: ["attack"],
    damage: 1

}]


type AttachAction = {
    actionType: "attach",
    card: CardData["id"],
    target: MonsterPile["id"]
}

type Action = 
    | AttachAction
    
export function getPlayableActions(gs: GameState): Action[] {
    return getCardsInPlie(gs, NamedPiles.Hand).flatMap(c => activeMonsters(gs).map(m => ({
        actionType: "attach",
        card: c,
        target: m.id
    })))
}

export function playAction(gs: GameState, action: Action): GameState {
    switch (action.actionType) {
        case "attach":
            return produce(gs, draft => {
                attachAction(draft, action)
            })
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

Actions
Knife - (1T/Attack)
    Deal 1D
    plain damage
Bolt - (1T/Attack Spell)
    Deal 1D or draw a card
    modal choice
Hit and Run - (1T/Maneuver)
    Costs -1T if following an Attack
    Draw a card
    variable cost
Rapier - (2T/Attack)
    Deal 2D
Heavy Axe - (3T/Attack)
    Costs -1T if this is the first action in the turn
    Deal 3D
    Turn state management
Foresight - (1T/Maneuver Spell)
    Draw 2 cards
Throwing Axe - (1T/Attack)
    \\R[1-3] You may spend 1T to return this to hand
    \\R[4-6] Deal 3D
    Random effect
Plan of Attack - (0T/Maneuver)
    Follow up attack costs -1T
    Future effect - cost reduction
Take the initiative - (1T/Maneuver)
    Follow up attack costs -2T if this monster is undamaged
    Future effect - conditional cost reduction

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
    
const MonsterDB: Record<string, MonsterData> = {}
registerInDB(MonsterDB, {
    id: "Slime",
    name: "Slime",
    health: 3
})
