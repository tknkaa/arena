import { Hono } from 'hono'
import { DurableObject } from 'cloudflare:workers'

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

