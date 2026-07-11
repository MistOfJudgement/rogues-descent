import { Draft, Immutable, produce } from "immer"



export type CardData = {
    id: string
    name: string
    description: string
    cost: number
}
export type Pile = {
    id: string
    containing: string[]
}

type GameStateData = {
    actionTime: number
    piles: Record<string, Pile>
} 


export type GameState = Immutable<GameStateData> 
const GS = {
    piles: {
        Hand: {
            contents: []
        },
        Deck: {
            contents: []
        }
    },
    actionTime: 3
}

function createPile(id: Pile["id"]): Pile {
    return {
        id,
        containing: []
    }
}

export function addNewPile(gs: Draft<GameState>, id: Pile["id"]) {
    if (id in gs.piles) {
        return;
    }
    gs.piles[id] = createPile(id)
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
        piles: {}
    }
}
function pipe<T>(
    value: T,
    ...fns: Array<(x: T) => T>
): T {
    return fns.reduce((v, fn) => fn(v), value)
}
export function initGame(gs: GameState): GameState {
    return produce(emptyGameState(), draft => {
        addNewPile(draft, "Draw")
        addNewPile(draft, "Hand")
        addNewPile(draft, "Discard")
        for (let i = 0; i < 5; i++) {
            putIntoPile(draft, "Strike", "Draw")
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
        gs = shufflePileIntoPile(gs, "Discard", "Draw")
    }
    return produce(gs, draft => {
        const firstCard = draft.piles["Draw"].containing[0]
        moveCard(draft, firstCard, "Draw", "Hand")
    })
}

export function playCard(gs: GameState, card: CardData["id"]): GameState {
    return produce(gs, draft => {
        if (draft.piles["Hand"].containing.indexOf(card) === -1) {
            return draft
        }

        moveCard(draft, card, "Hand", "Discard")
    })
}