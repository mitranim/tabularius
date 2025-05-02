import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as s from '../shared/schema.mjs'
import * as tu from './test_util.mjs'
import * as u from './util.mjs'
import * as db from './db.mjs'
import * as api from './api.mjs'

const TEST_PROGRESS_BIG = await Deno.readTextFile(new URL(`../samples/example_progress_big.json`, import.meta.url))

await t.test(async function test_duckdb_import_json_gz() {
  const srcData = JSON.parse(TEST_PROGRESS_BIG)
  const outUrl = new URL(`../local/example_progress_big.json.gz`, import.meta.url)
  const outBin = await u.data_to_json_to_gzipByteArr(srcData)
  await Deno.writeFile(outUrl, outBin)

  const dat = a.Emp()
  s.datAddRound({
    dat, round: srcData, run_num: 1, user_id: `local_user`,
    composite: u.SCHEMA_FACTS_COMPOSITE,
    tables: {facts: true},
  })

  const url = new URL(`../local/example_facts.json.gz`, import.meta.url)
  await Deno.writeFile(url, await u.str_to_gzipByteArr(u.jsonLines(dat.facts)))

  const dbInst = await u.DuckDb.create(`:memory:`)
  const conn = await dbInst.connect()
  await db.initSchema(conn)
  await conn.run(`copy facts from ${u.sqlStr(url.href)}`)
  const fact = await conn.queryDoc(`select * from facts limit 1`)

  a.reqDict(fact)
  a.reqValidStr(fact.user_id)
  a.reqIntPos(fact.run_num)
  a.reqIntPos(fact.round_num)
  a.reqValidStr(fact.bui_type)
  a.reqFin(fact.stat_val)
})

await t.test(async function test_uploadRound() {
  const ctx = new tu.TestCtx()

  function req(body, opt) {
    return new Request(`http://localhost/api/upload_around`, {
      method: a.POST,
      body: JSON.stringify(body),
      ...opt,
    })
  }

  async function test(req, exp) {t.eq(await api.uploadRound(ctx, req), exp)}

  async function fail(req, msg) {
    await t.throws(async () => await api.uploadRound(ctx, req), u.ErrHttp, msg)
  }

  await db.initSchema(await ctx.conn())
  const round = JSON.parse(TEST_PROGRESS_BIG)
  const auth = u.authHeadersOpt(tu.TEST_PUBLIC_KEY, tu.TEST_SECRET_KEY)

  await fail(req(), `round upload requires authentication`)
  await fail(req(round), `round upload requires authentication`)
  await fail(req(round, {headers: auth}), `round upload: missing user id`)

  round.tabularius_user_id = `123`

  await fail(
    req(round, {headers: auth}),
    `user id mismatch: required ${a.show(a.reqValidStr(tu.TEST_PUB))}, got "123"`,
  )

  round.tabularius_user_id = tu.TEST_PUB

  await fail(
    req(round, {headers: auth}),
    `round upload: run number must be a natural integer, got undefined`,
  )

  round.tabularius_run_num = 1
  await test(req(round, {headers: auth}), {factCount: 422})
  await test(req(round, {headers: auth}), {redundant: true})

  const runName = u.intPadded(round.tabularius_run_num)
  const roundName = u.intPadded(round.RoundIndex)
  const path = io.paths.join(ctx.userRunsDir, tu.TEST_PUB, runName, roundName + `.json.gz`)
  const roundRead = await u.readDecodeGameFile(path)
  t.eq(roundRead, round)
})
