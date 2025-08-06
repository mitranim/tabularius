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

const COMP = new h.HttpCompressor({Res: u.Res})

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
  if (u.DEV) url.searchParams.set(`dev`, `true`)
  if (u.LOCAL) url.searchParams.set(`local`, `true`)
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
  const path = rou.url.pathname

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
    (await h.fileResponse({
      req,
      file: await DIRS.resolveSiteFile(path),
      compressor: COMP,
      liveClient: u.LIVE_CLI,
    })) ||
    rou.notFound()
  )
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
