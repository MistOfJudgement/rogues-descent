import { MonsterDefinition } from "../monster";

export const BaseMonsterDB: MonsterDefinition[] = [
    {
        lookupId: "Slime",
        name: "Slime",
        health: 3,
        moves: []
    }
]

/**
 * Monsters (initial guesses of 3 health and 1 time and 1 attack meaning 5? value points)
 * 
Dissolving Slime (1/2)
    1A: Discard a card
Ruthless Goblin (3/1)
    1A: \\R[1-3] 1D
    1A: Deal 1D and apply +1T
Twinkling Faerie (2/1)
    1A: Hide a card from your hand
    1A: Deal 1D
Rusting Golem (3/1)
    1A: Deal 1D
    1A: Move an attack from this card to another monster or into your hand
Clattering Skeleton (2/1)
    1A: Stun 1T
    1A: Deal 1D
Slithering Snake (2/1)
    1A:  Trash a card from your discard
    1A: 1D
*/