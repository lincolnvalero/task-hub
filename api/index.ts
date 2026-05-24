import 'dotenv/config'
import type { IncomingMessage, ServerResponse } from 'http'
import { setupApp, app } from '../src/app'

const ready = setupApp().then(() => app.ready())

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready
  app.server.emit('request', req, res)
}
