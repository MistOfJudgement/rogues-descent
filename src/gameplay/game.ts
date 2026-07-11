import { Draft, Immutable, produce } from "immer"



export type CardData = {
    id: string
    name: string
    description: string
    cost: number
}

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
export function registerCard(card: CardData) {
    registerInDB(CardDB, card)
}
export type MonsterData = {
    id: string
    name: string
    health: number
}
export type Pile = {
    id: string
    containing: string[]
} & ({type: "transparent"} | {type:"monster", monster: MonsterData["id"]}) 

type GameStateData = {
    actionTime: number
    piles: Record<string, Pile>
    lastSummon: number
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
function summonMonsterPile(gs: Draft<GameState>, monsterId: MonsterData["id"]) {
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
        lastSummon: 0
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

function setupMonsterDrawPile(gs: GameState): GameState {
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

function activeMonsters(gs: GameState) {
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

function deletePile(gs: Draft<GameState>, pile: Pile["id"]): void {
    delete gs.piles[pile]
}
const CardDB: Record<string, CardData> = {}
registerCard({
        id: "Strike",
        name: "Strike",
        description: "does damage",
        cost: 1
})
    
const MonsterDB: Record<string, MonsterData> = {}
registerInDB(MonsterDB, {
    id: "Slime",
    name: "Slime",
    health: 3
})
