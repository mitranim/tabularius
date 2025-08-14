/*
Live-reload tool for development. Serves its client script, maintains client
connections, and re-broadcasts notifications about file changes from the main
server. The latter sends signals about its own restart or file changes.
*/

import * as a from '@mitranim/js/all.mjs'
import * as h from '@mitranim/js/http'
import * as uc from './util_conf.mjs'

const BRO = uc.LIVE_BRO

function main() {
  if (!BRO) return

  h.serve({
    port: uc.LIVE_PORT,
    onRequest,
    onListen: a.nop,
    // onListen,
  })
}

// function onListen(srv) {
//   console.log(`[live] listening on`, h.srvUrl(srv).href)
// }

async function onRequest(req) {
  const {method} = req
  const {pathname} = new URL(req.url)
  return (
    (await BRO.response({req, pathname})) ??
    h.notFound({method, pathname})
  )
}

if (import.meta.main) main()
