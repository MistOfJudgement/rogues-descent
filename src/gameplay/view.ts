/*


Get Base view
init

drawCard
PlayCard
s
*/

import { produce } from "immer";
import { GameState, initGame, emptyGameState, putIntoPile, drawCard, playCard, stateBasedActions, NamedPiles, summonMonsterPile } from "./game";
import { summonMonsterFromDraw } from "./monster";
import { lookupInDb } from "./lookupDb";

let CurrentState: GameState = initGame(emptyGameState())

const gameDiv = document.getElementById("game")
type GameAction = {
    name: string
    action: (gs: GameState, ...params: string[]) => GameState
    input: (string | ((gs: GameState) => string[]))[]
}

const debugActions: GameAction[] = [
    { name: "Add Pile", action: _ => _, input: ["pileId"] },
    {
        name: "Put Into Pile",
        action: (gs, card, pile) => produce(gs, (draft) => { putIntoPile(draft, card, pile) }),
        input: ["card", (gs) => [...Object.keys(gs.piles)]]
    },
    { name: "init", action: initGame, input: [] },
    { name: "Draw Card", action: drawCard, input: [] },
    {
        name: "Play Card",
        action: playCard,
        input: [(gs) => [...gs.piles["Hand"]?.containing], (gs) => [...Object.values(gs.piles).filter(p => p.type === "monster").map(p=>p.id)]]
    },
    {
        name: "Summon", action: summonMonsterFromDraw, input: []
    },
    {
        name: "Add card to hand",
        input: [(gs) => [...gs.lookupDb.cards.keys()]],
        action: (gs, card) => produce(gs, (draft) => {putIntoPile(draft, card, NamedPiles.Hand)})
    },
    {
        name: "summon to play",
        input: [(gs) => [...gs.lookupDb.monsters.keys()]],
        action: (gs, monster) => produce(gs, draft => { summonMonsterPile(draft, monster) })
    }
] as const
function setViewFromState(gs: GameState, root: HTMLElement) {
    root.innerHTML = ""
    const atDisplay = document.createElement("h3")
    atDisplay.innerText = `Action Time: ${gs.actionTime}`
    root.appendChild(atDisplay)

    for (const [k, v] of Object.entries(gs.piles)) {
        if (v.type === "transparent") {
            const pileDisplay = document.createElement("p")
            pileDisplay.innerText = `${k}: ${JSON.stringify(v.containing)}`
            root.appendChild(pileDisplay)
        } else if(v.type === "monster") {
             const pileDisplay = document.createElement("p")
            pileDisplay.innerText = `${v.id}: Health ${lookupInDb(gs.lookupDb.monsters, v.monster).health}: ${JSON.stringify(v.containing)}`
            root.appendChild(pileDisplay)
        }

    }

    for (const action of debugActions) {
        const actionButton = document.createElement("button")
        actionButton.textContent = action.name
        root.appendChild(actionButton)
        const inputs = action.input.map((placeholder) => {
            if (typeof placeholder === "string") {
                const temp = document.createElement("input")
                
                temp.placeholder = placeholder
                root.appendChild(temp)
                return temp
            } else {
                const temp = document.createElement("select")
                const vals = placeholder(CurrentState)
                vals.forEach(val => {
                    const opt = document.createElement("option")
                    opt.innerHTML = val
                    temp.appendChild(opt)
                })
                root.appendChild(temp)
                return temp
            }
        })
        actionButton.onclick = () => {
            updateState(action.action(CurrentState, ...inputs.map((e)=>e.value)))
        }
        root.appendChild(document.createElement("br"))
        
    }

}
function updateState(gs: GameState) {
    CurrentState = stateBasedActions(gs)
    refresh()
}
export function refresh() {
    if (!gameDiv) return
    setViewFromState(CurrentState, gameDiv)
}
document.getElementById("refresh")!.onclick = refresh

refresh()
