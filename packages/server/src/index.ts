import { Hono } from 'hono'
import { DurableObject } from 'cloudflare:workers'

export type UnitKind = "knight" | "archer" | "giant" | "skeleton" 

export type Target = "any" | "tower_only"

export type UnitStats = {
  hp: number;
  attack: number;
  range: number;
  speed: number;
  cost: number;
  target: Target;
}

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  knight:   { hp: 10, attack: 10, range: 2, speed: 1, cost: 3, target: 'any' },
  archer:   { hp: 5,  attack: 5,  range: 4, speed: 1, cost: 3, target: 'any' },
  giant:    { hp: 20, attack: 20, range: 2, speed: 1, cost: 5, target: 'tower_only' },
  skeleton: { hp: 2,  attack: 2,  range: 1, speed: 2, cost: 1, target: 'any' },
} 

export type UnitState = {
  id: string;
  kind: UnitKind
  ownerId: string
  x: number
  y: number
  hp: number // current hp
  targetId: string 
}

export type TowerKind = "princess" | "king"

export type TowerStats = {
  hp: number
  attack: number
  range: number
}

export const TOWER_STATS: Record<TowerKind, TowerStats> = {
  princess: { hp: 50, attack: 5, range: 5 },
  king:     { hp: 100, attack: 8, range: 4 },
}

export type TowerState = {
  id: string
  ownerId: string
  kind: TowerKind
  x: number
  y: number
  hp: number
  targetId: string | null // target unit id or null if no target
}

export type PlayerState = {
  id: string
  ws: WebSocket
  elixir: number
  hand: UnitKind[]
  deck: UnitKind[]
  towers: {
    left: TowerState
    right: TowerState
    king: TowerState
  }
}

export type GamePhase = "waiting" | "playing" | "finished"

export type RoomState = {
  phase: GamePhase
  players: Record<string, PlayerState> // playerId -> Player
  units: Record<string, UnitState> // unitId -> Unit
  timeLeft: number // in seconds
}

export type ClientMessage =
  | { type: "deploy"; unit: UnitKind; x: number; y: number }
  | { type: "ping" }

// ws can't be serialized, so we need to omit it when sending player state to clients
export type ClientRoomState = {
  phase: GamePhase
  players: Record<string, Omit<PlayerState, "ws">> // playerId -> Player (without WebSocket)
  units: Record<string, UnitState> // unitId -> Unit
  timeLeft: number // in seconds
}

export type ServerMessage = 
  | { type: "state_update"; state: ClientRoomState }


export class GameRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
      const upgradeHeader = request.headers.get('Upgrade')
      if (upgradeHeader !== 'websocket') {
          return new Response('Expected WebSocket', { status: 400 })
      }
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      return new Response(null, { status: 101, webSocket: client })
  }
}

type Bindings = {
  GAME_ROOM: DurableObjectNamespace<GameRoom>
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get("/ws", async (c) => {
  const id = c.env.GAME_ROOM.idFromName("my-game-room")
  const stub = c.env.GAME_ROOM.get(id)
  const response = await stub.fetch(c.req.raw)
  return response
})

export default app


