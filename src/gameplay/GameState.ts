

// Being super scrappy with types
type Distinct<T, DistinctName> = T & { __TYPE__?: DistinctName };
type PlayerHealth = number
type PlayerTime = number


type CardId = Distinct<string, "CardId">
type MonsterId = Distinct<string, "MonsterId">
type ZoneId = Distinct<string, "ZoneId">
interface Card {
    id: CardId,
    title: string
}

type Zone = {
    collection: Card[]
    id: ZoneId
}

type Monster = {
    id: MonsterId,
    health: number
}

type PlayAction = {
    type: "Play"
    cardId: Card["id"]
    targetId: Monster["id"]
}

type DrawAction = {
    type: "Draw"
}

type EndAction = {
    type: "End"
}

type PlayerAction = 
    | PlayAction
    | DrawAction
    | EndAction


type AttachStep = {
    type: "Attach"
    cardId: Card["id"]
    targetId: Monster["id"]
}

type KilledStep = {
    type: "Killed"
    targetId: Monster["id"]
}

type MoveStep = {
    type: "Move"
    cardId: Card["id"]
    zoneId: Zone["id"]
}

type EndGameStep = {
    type: "EndGame",
    result: "Win" | "Loss"
}

type GameStep = 
    | AttachStep
    | KilledStep
    | MoveStep
    | EndGameStep



const HAND_ZONE: Zone = {
    id: "Hand",
    collection: []
}

const DRAW_ZONE: Zone = {
    id: "DrawPile",
    collection: []
}

function processDrawAction(): GameStep[] {
    const card = DRAW_ZONE.collection.at(0)
    if (!card) {
        return [{type: "EndGame", result: "Loss"}]
    }

    return [{type: "Move", cardId: card.id, zoneId: HAND_ZONE.id}]
    
}