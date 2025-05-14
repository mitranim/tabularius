/*
Live-reload tool for development. Serves its own client script, watches
client-specific files, and broadcasts notifications about file changes.
The main server uses this to broadcast a signal about its own restart.
*/

import * as a from '@mitranim/js/all.mjs'
import * as hd from '@mitranim/js/http_deno.mjs'
import * as ld from '@mitranim/js/live_deno.mjs'
import * as uc from './util_conf.mjs'

const BRO = new ld.LiveBroad()
const DIRS = ld.LiveDirs.of(hd.dirRel(`.`, isPathLive))

if (import.meta.main) await main()

function main() {
  const LIVE_PORT = a.int(uc.getEnv(`LIVE_PORT`))
  Deno.serve({
    port: LIVE_PORT,
    handler: respond,
    onListen({port, hostname}) {
      if (hostname === `0.0.0.0`) hostname = `localhost`
      console.log(`[live] listening on http://${hostname}:${port}`)
    },
  })
  return watch()
}

async function respond(req) {
  return (
    await BRO.res(req) ||
    new Response(`not found`, {status: 404})
  )
}

async function watch() {
  for await (const val of DIRS.watchLive()) {
    BRO.writeEventJson(val)
  }
}

// Should include exactly all client-only files and no other files.
function isPathLive(val) {
  return (
    /^\w+[.]html$/.test(val) ||
    val.startsWith(`client/`)
    // /^local[/]\w+[.]mjs$/.test(val)
  )
}
