
import { describe, expect, test } from "vitest"
import { addNewPile, drawCard, emptyGameState, GameState, initGame, moveCard, putIntoPile, shufflePileIntoPile } from "../gameplay/game"
import { produce } from "immer"
describe("Game", () => {
    const drawPile = "Draw"
    const handPile = "Hand"
    const baseGameState = produce(emptyGameState(), draft => {
        addNewPile(draft, drawPile)
        addNewPile(draft, handPile)
    })
    test("moveCard", () => {
        const gs = produce(baseGameState, draft => {
            putIntoPile(draft, "testcard", drawPile)
        })
        const result = produce(gs, d => moveCard(d, "testcard", drawPile, handPile))
        expect(result.piles[drawPile].containing.length).toEqual(0)
        expect(result.piles[handPile].containing.length).toEqual(1)
        expect(result.piles[handPile].containing).toContain("testcard")
    })

    test("shufflePile", () => {
        const gs = produce(baseGameState, draft => {
            putIntoPile(draft, "testcard", drawPile)
            putIntoPile(draft, "testcard2", drawPile)
        })
        const result = shufflePileIntoPile(gs, drawPile, handPile)
        expect(result.piles[drawPile].containing.length).toEqual(0)
        expect(result.piles[handPile].containing.length).toEqual(2)
        expect(result.piles[handPile].containing).toContain("testcard")
    })

    describe("draw", () => {
        test("normal draw", () => {
            const gs = produce(baseGameState, draft => {
                putIntoPile(draft, "card1", drawPile)
                putIntoPile(draft, "card2", drawPile)
            })
            const result = drawCard(gs)
            expect(result.piles[drawPile].containing).toHaveLength(1)
            expect(result.piles[handPile].containing).toHaveLength(1)
            expect(result.piles[drawPile].containing).toContain("card2")
            expect(result.piles[handPile].containing).toContain("card1")
        })

        test("shuffle from discard", () => {
            const gs = produce(baseGameState, draft => {
                addNewPile(draft, "Discard")
                putIntoPile(draft, "card1", "Discard")
            })
            const result = drawCard(gs)
            expect(result.piles[drawPile].containing).toHaveLength(0)
            expect(result.piles[handPile].containing).toHaveLength(1)
            expect(result.piles[handPile].containing).toContain("card1")
            expect(result.piles["Discard"].containing).toHaveLength(0)
        })
    })
})