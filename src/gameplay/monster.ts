import { Immutable, produce } from "immer"
import { addNewPile, fromPileGetAt, type GameState, MonsterPile, NamedPiles, OptionChoice, removeFromPile, summonMonsterPile } from "./game"
import { Identifiable } from "./lookupDb"



export type MonsterDefinition = {
    name: string
    health: number
    moves: OptionChoice[]
} & Identifiable<string>

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

export function setupMonsterDrawPile(gs: GameState): GameState {
    return produce(gs, draft => {
        addNewPile(draft, NamedPiles.MonsterDraw)
        addNewPile(draft, NamedPiles.MonsterDiscard)
    })
}