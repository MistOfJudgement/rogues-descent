/*


Get Base view
init

drawCard
PlayCard
s
*/

import { produce } from "immer";
import { addNewPile, drawCard, initGame, playCard, GameState, putIntoPile, summonMonsterFromDraw } from "./game";

let CurrentState: GameState = {
    actionTime: 3,
    piles: {},
    lastSummon: 0
}

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
] as const
function setViewFromState(gs: GameState, root: HTMLElement) {
    root.innerHTML = ""
    const atDisplay = document.createElement("h3")
    atDisplay.innerText = `Action Time: ${gs.actionTime}`
    root.appendChild(atDisplay)

    for (const [k, v] of Object.entries(gs.piles)) {
        const pileDisplay = document.createElement("p")
        pileDisplay.innerText = `${k}: ${JSON.stringify(v.containing)}`
        root.appendChild(pileDisplay)
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
    CurrentState = gs
    refresh()
}
export function refresh() {
    if (!gameDiv) return
    setViewFromState(CurrentState, gameDiv)
}
document.getElementById("refresh")!.onclick = refresh

refresh()
