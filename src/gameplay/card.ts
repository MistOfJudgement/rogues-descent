import { Draft } from "immer"
import { type GameState } from "./game"
import { Identifiable, registerInDb } from "./lookupDb"

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
    name: string
    description: string
    cost: number
} & (AttackCard | NonAttackCard) & Identifiable<string>

export function registerCard(gs: Draft<GameState>, card: CardData) {
    registerInDb(gs.lookupDb.cards, card)
}