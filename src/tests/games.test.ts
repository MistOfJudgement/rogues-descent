
import { assert, describe, expect, test } from "vitest"
import { produce } from "immer"
import { CardDefinition, registerCard } from "../gameplay/card"
import { Identified, registerInDb } from "../gameplay/lookupDb"
import { GameState, initGame, emptyGameState, NamedPiles, putIntoPile, summonMonsterPile, addNewPile, moveCard, shufflePileIntoPile, drawCard, getPlayableActions, playAction, getCardsInPlie, AttachAction, MonsterPile, getCostOfAttachAction } from "../gameplay/game"
import { MonsterDefinition, setupMonsterDrawPile, summonMonsterFromDraw, activeMonsters, getMonsterPile } from "../gameplay/monster"
describe("Game", () => {
    function createTestGameSetup(cards: Identified<CardDefinition>[] = [], monsters: Identified<MonsterDefinition>[] = [], augmentDB?: {monsters?: MonsterDefinition[], cards?: CardDefinition[]}): GameState {
            return produce(initGame(emptyGameState()), (draft) => {
                // Clear initial draw pile to keep tests deterministic
                draft.piles[NamedPiles.Draw].containing = []
                cards.forEach(c => putIntoPile(draft, c, NamedPiles.Hand))
                monsters.forEach(m => summonMonsterPile(draft, m))
                if (!augmentDB) {
                    return;
                }

                augmentDB.cards?.forEach(c => {
                    registerCard(draft, c)
                });
                
                augmentDB.monsters?.forEach(m => {
                    registerInDb(draft.lookupDb.monsters, m)
                })
            })
        }

        const singleDamageCard: CardDefinition = {
            cost: 0,
            lookupId: "SingleDamage",
            name: "SingleDamage",
            description: "Does 1 point of damage",
            types: ["attack"],
            damage: 1,
        }

        const oneHealthMonster: MonsterDefinition = {
            lookupId: "OneHealth",
            health: 1,
            name: "OneHealth",
            moves: []
        }
    
    const ThreeCostCard: CardDefinition = {
        cost: 3,
        lookupId: "ThreeCostCard",
        name: "ThreeCostCard",
        description: "costs 3",
        types: ["maneuver"]
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
                const gs = createTestGameSetup(["Knife"], ["Slime"])
                
                const monsterId = activeMonsters(gs)[0].id

                expect(getPlayableActions(gs)).toContainEqual({
                    actionType: "attach",
                    card: "Knife",
                    target: monsterId,
                })
            })
        })

        describe("attaching cards", () => {
            test("attaches card from hand to target monster", () => {
            const gs = createTestGameSetup(["Knife"], ["Slime"])
            const monsterId = activeMonsters(gs)[0].id

            const result = playAction(gs, { actionType: "attach", card: "Knife", target: monsterId })

            expect(getCardsInPlie(result, NamedPiles.Hand)).not.toContain("Knife")
            expect(getCardsInPlie(result, monsterId)).toContain("Knife")
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
            let gs = createTestGameSetup(["Knife"], [])
            const startingTime = gs.actionTime

            gs = produce(gs, draft => { draft.actionTime -= 1 })
            gs = playAction(gs, { actionType: "endTurn" })
            expect(gs.actionTime).toEqual(startingTime)
        })

        test("ending the turn with an enemy forces an action", () => {
            let gs = createTestGameSetup(["Knife"], ["oneChoiceMonster"], {
                monsters: [{
                    lookupId: "oneChoiceMonster",
                    name: "oneChoiceMonster",
                    health: 1,
                    moves: [
                        {
                            optionId: "optionOne",
                            effects: []
                        }
                    ]
                }],
            })
            const monster = activeMonsters(gs)[0]
            gs = playAction(gs, { actionType: "endTurn" })
            expect(getPlayableActions(gs)).toContainEqual({
                actionType: "chooseMonsterMove",
                monster: monster.id,
                actionOption: "optionOne"
            })
        })
    })

    describe("choiceActions", () => {
        test("choiceAction runs effects", () => {
            let gs = produce(createTestGameSetup(), draft => {
                draft.stepStack.push({
                    stepType: "PromptChoice",
                    choices: [
                        {
                            optionId: "optionOne",
                            effects: [{
                                stepType: "modifyTime",
                                modifier: 1
                            }]
                        }
                    ]
                })
            })
            const startingTime = gs.actionTime
            const actions = getPlayableActions(gs)
            expect(actions).toHaveLength(1)
            const result = playAction(gs, actions[0])

            expect(result.actionTime).toEqual(startingTime + 1)

        })
    })

    describe("costs", () => {
        test("actions that cost less than or equal current T show up", () => {
            let gs = produce(createTestGameSetup([ThreeCostCard.lookupId], ["Slime"], {cards: [ThreeCostCard]}), draft => {
                draft.actionTime = 3
            })

            const actions = getPlayableActions(gs)

            expect(actions).toContainEqual(expect.objectContaining<Partial<AttachAction>>({card: ThreeCostCard.lookupId}))
        })
        
        test("actions that cost more than current T dont show up", () => {
            let gs = produce(createTestGameSetup([ThreeCostCard.lookupId], ["Slime"], {cards: [ThreeCostCard]}), draft => {
                draft.actionTime = 1
            })

            const actions = getPlayableActions(gs)

            expect(actions).not.toContainEqual(expect.objectContaining<Partial<AttachAction>>({card: ThreeCostCard.lookupId}))
        })

        test("playing actions decrement T", () => {
            let gs = produce(createTestGameSetup([ThreeCostCard.lookupId], ["Slime"], { cards: [ThreeCostCard] }), draft => {
                draft.actionTime = 4
            })
            const actions = getPlayableActions(gs)
            const toPlay = actions.filter(a => a.actionType === "attach")[0]
            const result = playAction(gs, toPlay)

            expect(result.actionTime).toEqual(1)
        })

        test("costs can be variable", () => {
            const variableSpell: CardDefinition = {
                lookupId: "variableSpell",
                types: ["maneuver"],
                cost: (gs: GameState, target: MonsterPile["id"]) => {
                    const pile = gs.piles[target]
                    if (pile.type === "monster") {
                        if (pile.monster === "Slime") {
                            return 2
                        } else {
                            return 3
                        }
                    }
                    return 1
                }
            }

            let gs = createTestGameSetup([variableSpell.lookupId], ["Slime", "Second"], {cards:[variableSpell]})
            const actions = getPlayableActions(gs)
            const slimeAction: AttachAction = actions.filter(a => a.actionType === "attach").filter(a => getMonsterPile(gs, a.target).monster === "Slime")[0]
            const secondAction: AttachAction = actions.filter(a => a.actionType === "attach").filter(a => getMonsterPile(gs, a.target).monster === "Second")[0]
        
            expect(getCostOfAttachAction(gs, slimeAction)).toEqual(2)
            expect(getCostOfAttachAction(gs, secondAction)).toEqual(3)
        })
    })
})