import * as a from '@mitranim/js/all.mjs'
import * as h from '@mitranim/js/http'
import * as io from '@mitranim/js/io'
import * as u from './util.mjs'
import * as c from './ctx.mjs'
import * as db from './db.mjs'
import {apiDb} from './api/api_db.mjs'
import {apiUploadRound} from './api/api_upload_round.mjs'
import {apiDownloadFile} from './api/api_download_file.mjs'
import {apiDownloadRound} from './api/api_download_round.mjs'
import {apiPlotAgg} from './api/api_plot_agg.mjs'
import {apiLs} from './api/api_ls.mjs'
import {apiLatestRun} from './api/api_latest_run.mjs'

const CACHING = !u.DEV

const DIRS = h.HttpDirs.of(
  new u.HttpDir({
    fsPath: `.`,
    filter: /^client[/]|^shared[/]|^samples[/]|^index[.]html$|^sw[.]mjs$/
  }),
  a.vac(u.DEV) && new u.HttpDir({
    fsPath: `/`,
    filter: /^[/]Users[/]/,
  }),
).setOpt({caching: CACHING})

async function main() {
  const dataDir = u.getEnv(`DATA_DIR`)
  const dbFile = u.getEnv(`DB_FILE`)
  const tmpDir = u.getEnv(`TMP_DIR`)
  const ctx = new c.Ctx({dataDir, dbFile, tmpDir})

  await db.migrate(ctx)
  serve(ctx)
  watch()
  u.LIVE_CLI?.sendJson({type: `change`}).catch(console.error)
}

function serve(ctx) {
  const hostname = u.getEnv(`SRV_HOST`)
  const port = a.int(u.getEnv(`SRV_PORT`))
  const onRequest = a.bind(respond, ctx)
  h.serve({hostname, port, onRequest, onListen, onError})
}

function onListen(srv) {
  const url = h.srvUrl(srv)
  url.pathname = u.PATH_BASE
  if (u.DEV) url.searchParams.set(`DEV`, `true`)
  if (u.LOCAL) url.searchParams.set(`LOCAL`, `true`)
  console.log(`[srv] listening on`, url.href)
}

function onError(err) {
  if (a.isErrAbort(err)) return new u.Res()
  if (u.LOG_DEBUG) console.error(err)
  if (a.isInst(err, u.ErrHttp)) return new u.Res(err, {status: err.status})
  if (!u.LOG_DEBUG) console.error(err)
  return new u.Res(err, {status: 500})
}

async function respond(ctx, req) {
  const rou = a.toReqRou(req)
  let path = rou.url.pathname

  if (u.DEV && path.startsWith(u.PATH_BASE)) {
    path = `/` + path.slice(u.PATH_BASE.length)
    rou.url.pathname = path
  }

  return await (
    (rou.preflight() && new u.Res()) ||
    (rou.get(`/robots.txt`) && new u.Res(ROBOTS_TXT)) ||
    (rou.pre(`/api`) && (
      (
        rou.get(`/api/db`) &&
        apiDb(ctx)
      ) ||
      (
        rou.post(`/api/upload_round`) &&
        apiUploadRound(ctx, rou.req)
      ) ||
      (
        rou.get(/^[/]api[/]download_file(?<path>[/].*)?$/) &&
        apiDownloadFile(ctx, a.laxStr(rou.groups?.path))
      ) ||
      (
        rou.post(`/api/plot_agg`) &&
        apiPlotAgg(ctx, rou.req)
      ) ||
      (
        rou.get(/^[/]api[/]download_round(?:[/](?<path>.*))?$/) &&
        apiDownloadRound(ctx, rou)
      ) ||
      (
        rou.get(/^[/]api[/]ls(?:[/](?<path>.*))?$/) &&
        apiLs(ctx, a.laxStr(rou.groups?.path))
      ) ||
      (
        rou.get(/^[/]api[/]latest_run(?:[/](?<userId>\w+))?$/) &&
        apiLatestRun(ctx, rou.groups?.userId)
      ) ||
      rou.notFound()
    )) ||
    (await serveFile(req, path)) ||
    rou.notFound()
  )
}

async function serveFile(req, path) {
  /*
  Why this server doesn't serve static assets in production: because they're
  served via GitHub Pages on `https://mitranim.com/tabularius/`, which is the
  canonical domain for the app. This server is needed only for API requests.

  We don't want anyone getting confused about which domain is canonical.
  Users don't look at HTML metadata or HTTP headers. We could use an HTTP
  redirect, but there's not much point. It's simpler and more reliable to
  clearly indicate that you're not supposed to be making the request at all.

  What REALLY triggered this was Google's crawler. For some strange reason,
  it keeps trying to index thousands of strange links that have no business
  existing at all. Here's one example:

    https://tabularius.mitranim.com/?run=plot%20round_id=local_user_0001_1747526400151_0012?run=plot%20-c%20-p=dmg%20user_id=all%20run_id=latest

  Then, Google sends me emails complaining how these URLs, likely hallucinated,
  not necessarily but possibly by Google, are supposedly "duplicate without a
  user-selected canonical", which seems bullshit given that the `index.html`
  file we serve explicitly includes not only a `<link rel=canonical ...>`
  but also a `<meta name=robots ...>`, which is supposed to forbid crawlers
  from indexing any of our pages which has a URL query or fragment. Admittedly
  the latter is set via inline JS, which is not guaranteed.

  So much for the crawler directives, and/or crawler JS support.
  */
  if (!u.DEV) return undefined

  const file = await DIRS.resolveSiteFile(path)
  if (!file) return undefined

  return h.fileResponse({
    req,
    file,
    liveClient: u.LIVE_CLI,
  })
}

/*
The production app is served via GitHub Pages, and we do want it indexed.
The API server is on a different (sub)domain, and we don't want crawlers
to try to index its API endpoints or even try to invent non-existent URLs
by combining the API domain with some arbitrary paths (Google tried).
*/
const ROBOTS_TXT = `
User-agent: *
Disallow: /
`.trim()

async function watch() {
  if (!u.LIVE_CLI) return
  for await (let {type, path} of io.watchCwd()) {
    path = u.LIVE_CLI.fsPathToUrlPath(path)
    if (!path) continue
    u.LIVE_CLI.sendJson({type, path}).catch(console.error)
  }
}

if (import.meta.main) main()
