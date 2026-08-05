
import { describe, expect, test } from "vitest"
import { activeMonsters, addNewPile, CardData, drawCard, emptyGameState, GameState, getCardsInPlie, getPlayableActions, initGame, MonsterData, moveCard, NamedPiles, playAction, putIntoPile, registerCard, registerInDB, setupMonsterDrawPile, shufflePileIntoPile, summonMonsterFromDraw, summonMonsterPile } from "../gameplay/game"
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

    describe("monsters", () => {
        const baseGameState = setupMonsterDrawPile(emptyGameState())
        const monster = "Slime"
        test("monster can be summoned from monster pile", () => {
            const gs = produce(baseGameState, draft => {
                putIntoPile(draft, monster, NamedPiles.MonsterDraw)
            })

            const result = summonMonsterFromDraw(gs)

            expect(activeMonsters(result)).toHaveLength(1)
            expect(activeMonsters(result)[0].monster).toMatch(monster)
        })
    })

    describe("playing cards", () => {
        function createTestGameSetup(cards: CardData["id"][] = [], monsters: MonsterData["id"][] = [], augmentDB?: {monsters: MonsterData[], cards: CardData[]}) {
            return produce(initGame(emptyGameState()), (draft) => {
                // Clear initial draw pile to keep tests deterministic
                draft.piles[NamedPiles.Draw].containing = []
                if (!augmentDB) {
                    return;
                }

                augmentDB.cards.forEach(c => {
                    registerCard(draft, c)
                });
                
                augmentDB.monsters.forEach(m => {
                    registerInDB(draft.lookupDb.monsters, m)
                })
                cards.forEach(c => putIntoPile(draft, c, NamedPiles.Hand))
                monsters.forEach(m => summonMonsterPile(draft, m))
            })
        }

        const singleDamageCard: CardData = {
            cost: 0,
            id: "SingleDamage",
            name: "SingleDamage",
            description: "Does 1 point of damage",
            types: ["attack"],
            damage: 1,
        }

        const oneHealthMonster: MonsterData = {
            id: "OneHealth",
            health: 1,
            name: "OneHealth",
        }

        
        describe("playable actions", () => {
            test("generates an attach action when monster is present", () => {
            const gs = createTestGameSetup(["Strike"], ["Slime"])
                
            const monsterId = activeMonsters(gs)[0].id

            expect(getPlayableActions(gs)).toContainEqual({
                actionType: "attach",
                card: "Strike",
                target: monsterId,
            })
            })
        })

        describe("attaching cards", () => {
            test("attaches card from hand to target monster", () => {
            const gs = createTestGameSetup(["Strike"], ["Slime"])
            const monsterId = activeMonsters(gs)[0].id

            const result = playAction(gs, { actionType: "attach", card: "Strike", target: monsterId })

            expect(getCardsInPlie(result, NamedPiles.Hand)).not.toContain("Strike")
            expect(getCardsInPlie(result, monsterId)).toContain("Strike")
            })
        })

        describe("lethal damage", () => {
            test("removes target monster from active monsters when killed", () => {
            const gs = createTestGameSetup([singleDamageCard.id], [oneHealthMonster.id], {cards: [singleDamageCard], monsters: [oneHealthMonster]})
            const monsterId = activeMonsters(gs)[0].id

            const result = playAction(gs, { actionType: "attach", card: "SingleDamage", target: monsterId })

            expect(activeMonsters(result)).toHaveLength(0)
            })
        })
    })

})