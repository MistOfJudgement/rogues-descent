
import { describe, expect, test } from "vitest"
import { produce } from "immer"
import { CardData, registerCard } from "../gameplay/card"
import { emptyGameState, addNewPile, putIntoPile, moveCard, shufflePileIntoPile, drawCard, NamedPiles, summonMonsterFromDraw, activeMonsters, MonsterData, initGame, summonMonsterPile, getPlayableActions, playAction, getCardsInPlie, setupMonsterDrawPile, GameState } from "../gameplay/game"
import { Identified, registerInDb } from "../gameplay/lookupDb"
describe("Game", () => {
    function createTestGameSetup(cards: Identified<CardData>[] = [], monsters: Identified<MonsterData>[] = [], augmentDB?: {monsters: MonsterData[], cards: CardData[]}): GameState {
            return produce(initGame(emptyGameState()), (draft) => {
                // Clear initial draw pile to keep tests deterministic
                draft.piles[NamedPiles.Draw].containing = []
                cards.forEach(c => putIntoPile(draft, c, NamedPiles.Hand))
                monsters.forEach(m => summonMonsterPile(draft, m))
                if (!augmentDB) {
                    return;
                }

                augmentDB.cards.forEach(c => {
                    registerCard(draft, c)
                });
                
                augmentDB.monsters.forEach(m => {
                    registerInDb(draft.lookupDb.monsters, m)
                })
            })
        }

        const singleDamageCard: CardData = {
            cost: 0,
            lookupId: "SingleDamage",
            name: "SingleDamage",
            description: "Does 1 point of damage",
            types: ["attack"],
            damage: 1,
        }

        const oneHealthMonster: MonsterData = {
            lookupId: "OneHealth",
            health: 1,
            name: "OneHealth",
        }
    const baseGameState = produce(emptyGameState(), draft => {
        addNewPile(draft, NamedPiles.Draw)
        addNewPile(draft, NamedPiles.Hand)
    })
    test("moveCard", () => {
        const gs = produce(baseGameState, draft => {
            putIntoPile(draft, "testcard", NamedPiles.Draw)
        })
        const result = produce(gs, d => moveCard(d, "testcard", NamedPiles.Draw, NamedPiles.Hand))
        expect(result.piles[NamedPiles.Draw].containing.length).toEqual(0)
        expect(result.piles[NamedPiles.Hand].containing.length).toEqual(1)
        expect(result.piles[NamedPiles.Hand].containing).toContain("testcard")
    })

    test("shufflePile", () => {
        const gs = produce(baseGameState, draft => {
            putIntoPile(draft, "testcard", NamedPiles.Draw)
            putIntoPile(draft, "testcard2", NamedPiles.Draw)
        })
        const result = shufflePileIntoPile(gs, NamedPiles.Draw, NamedPiles.Hand)
        expect(result.piles[NamedPiles.Draw].containing.length).toEqual(0)
        expect(result.piles[NamedPiles.Hand].containing.length).toEqual(2)
        expect(result.piles[NamedPiles.Hand].containing).toContain("testcard")
    })

    describe("draw", () => {
        test("normal draw", () => {
            const gs = produce(baseGameState, draft => {
                putIntoPile(draft, "card1", NamedPiles.Draw)
                putIntoPile(draft, "card2", NamedPiles.Draw)
            })
            const result = drawCard(gs)
            expect(result.piles[NamedPiles.Draw].containing).toHaveLength(1)
            expect(result.piles[NamedPiles.Hand].containing).toHaveLength(1)
            expect(result.piles[NamedPiles.Draw].containing).toContain("card2")
            expect(result.piles[NamedPiles.Hand].containing).toContain("card1")
        })

        test("shuffle from discard", () => {
            const gs = produce(baseGameState, draft => {
                addNewPile(draft, "Discard")
                putIntoPile(draft, "card1", "Discard")
            })
            const result = drawCard(gs)
            expect(result.piles[NamedPiles.Draw].containing).toHaveLength(0)
            expect(result.piles[NamedPiles.Hand].containing).toHaveLength(1)
            expect(result.piles[NamedPiles.Hand].containing).toContain("card1")
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
            const gs = createTestGameSetup([singleDamageCard.lookupId], [oneHealthMonster.lookupId], {cards: [singleDamageCard], monsters: [oneHealthMonster]})
            const monsterId = activeMonsters(gs)[0].id

            const result = playAction(gs, { actionType: "attach", card: "SingleDamage", target: monsterId })

            expect(activeMonsters(result)).toHaveLength(0)
            })
        })
    })

    describe("turn phases", () => {
        test("ending the turn with no enemies resets your actionTime", () => {
            let gs = createTestGameSetup(["Strike"], [])
            const startingTime = gs.actionTime

            gs = produce(gs, draft => { draft.actionTime -= 1 })
            gs = playAction(gs, { actionType: "endTurn" })
            expect(gs.actionTime).toEqual(startingTime)
        })

        test("ending the turn with an enemy forces an action", () => {
            let gs = createTestGameSetup([], ["unknown"])
            const monster = activeMonsters(gs)[0]
            gs = playAction(gs, { actionType: "endTurn" })
            expect(getPlayableActions(gs)).toContain({
                actionType: "chooseMonsterAction",
                monster: monster.id,
                actionOption: "optionOne"
            })
        })
    })

})