import * as a from '@mitranim/js/all.mjs'
import * as hd from '@mitranim/js/http_deno.mjs'
import * as u from './util.mjs'
import * as c from './ctx.mjs'
import * as db from './db.mjs'
import * as api from './api.mjs'

const DIR_ABS = a.vac(u.DEV) && hd.dirAbs()

const DIRS = hd.Dirs.of(
  hd.dirRel(`.`, /^client[/]|^shared[/]|^samples[/]|^index[.]html$|^sw[.]mjs$/),
)

const CORS_HEADERS = [
  ...a.HEADERS_CORS_PROMISCUOUS,
  [a.HEADER_NAME_CORS_HEADERS, `authorization`],
  [a.HEADER_NAME_CORS_HEADERS, `content-encoding`],
]

if (import.meta.main) await main()

async function main() {
  const dataDir = u.getEnv(`DATA_DIR`)
  const dbFile = u.getEnv(`DB_FILE`)
  const tmpDir = u.getEnv(`TMP_DIR`)
  const ctx = new c.Ctx({dataDir, dbFile, tmpDir})

  await db.migrate(ctx)
  serve(ctx)
  u.liveSend({type: `change`})
}

function serve(ctx) {
  const port = a.int(u.getEnv(`PORT`))
  Deno.serve({
    port,
    handler: a.bind(respond, ctx),
    onListen({port, hostname}) {
      if (hostname === `0.0.0.0`) hostname = `localhost`
      console.log(`[srv] listening on http://${hostname}:${port}?local=true`)
    },
    onError(err) {
      if (a.isErrAbort(err)) return new Response()
      if (a.isInst(err, u.ErrHttp)) return new Response(err, {status: err.status})
      console.error(err)
      return new Response(err, {status: 500})
    },
  })
}

async function respond(ctx, req) {
  const rou = a.toReqRou(req)

  if (rou.preflight()) {
    return new Response(undefined, {headers: CORS_HEADERS})
  }

  const res = await (
    (rou.pre(`/api`) && api.apiRes(ctx, rou)) ||
    (
      a.vac(DIR_ABS) &&
      rou.url.pathname.startsWith(`/Users/`) &&
      (await DIR_ABS.resolveFile(rou.url.pathname))?.res()
    ) ||
    u.withLiveClient(
      await ((await DIRS.resolveSiteFileWithNotFound(rou.url))?.res())
    ) ||
    rou.notFound()
  )
  for (const [key, val] of CORS_HEADERS) res.headers.append(key, val)
  return res
}
