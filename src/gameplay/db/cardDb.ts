import { Draft } from "immer";
import { CardDefinition } from "../card";
import { GameState } from "../game";
import { registerInDb } from "../lookupDb";

export function loadBaseCardDb(gs: Draft<GameState>) {
    BaseCardDb.forEach(c => {
        registerInDb(gs.lookupDb.cards, c)
    })
}


export const BaseCardDb: CardDefinition[] = [
    {
        lookupId: "Knife",
        name: "Knife",
        description: "Deal 1D",
        cost: 1,
        types: ["attack"],
        damage: 1
    },
    {
        lookupId: "Rapier",
        name: "Rapier",
        description: "Deal 2D",
        cost: 2,
        types: ["attack"],
        damage: 2
    },
    {
        lookupId: "HitAndRun",
        name: "Hit and Run",
        description: "Costs -1T if following an Attack",
        types: ["maneuver"],
        cost: 1,
        // effects: [{
        //     "drawCards"
        // }]
    }
]

/*
Actions
Knife - (1T/Attack)
    Deal 1D
    plain damage
Bolt - (1T/Attack Spell)
    Deal 1D or draw a card
    modal choice
Hit and Run - (1T/Maneuver)
    Costs -1T if following an Attack
    Draw a card (this should def be 2 cards)
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

 */