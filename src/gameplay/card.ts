import { Draft } from "immer"
import { MonsterPile, type GameState } from "./game"
import { Identifiable, Identified, lookupInDb, registerInDb } from "./lookupDb"

type CardType = "attack" | "spell" | "maneuver"
type AttackCard = {
    types: CardType[]
    damage: number | ((gs: GameState) => number)
}
type NonAttackCard = {
    types: Exclude<CardType, "attack">[],
    damage?: never
}

export type CardDefinition = {
    name?: string
    description?: string
    cost: number | ((gs: GameState, target: MonsterPile["id"]) => number)
} & (AttackCard | NonAttackCard) & Identifiable<string>

export function registerCard(gs: Draft<GameState>, card: CardDefinition) {
    registerInDb(gs.lookupDb.cards, card)
}

export function lookupCard(gs: GameState, cardId: Identified<CardDefinition>) {
    return lookupInDb(gs.lookupDb.cards, cardId)
}