/* global Deno */

import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as s from '../../shared/schema.mjs'
import * as tu from '../test_util.mjs'
import * as u from '../util.mjs'
import * as db from '../db.mjs'
import * as aur from './api_upload_round.mjs'

const TEST_PROGRESS_BIG = await Deno.readTextFile(new URL(`../../samples/example_progress_big.json`, import.meta.url))

await t.test(async function test_duckdb_import_json_gz() {
  const ctx = new tu.TestCtx()
  const progPath = io.paths.join(ctx.tmpDir, `example_progress_big.json.gz`)
  const srcData = a.jsonDecode(TEST_PROGRESS_BIG)
  const outBin = await u.data_to_json_to_gzipByteArr(srcData)
  await io.writeFile(progPath, outBin)

  const dat = a.Emp()
  s.datAddRound({
    dat,
    round: srcData,
    user_id: `local_user`,
    run_num: 1,
    run_ms: Date.parse(srcData.LastUpdated),
    composite: u.SCHEMA_FACTS_COMPOSITE,
    tables: {facts: true},
  })

  const factsPath = io.paths.join(ctx.tmpDir, `example_facts.json.gz`)
  await io.writeFile(factsPath, await u.str_to_gzipByteArr(u.jsonLines(dat.facts)))

  const dbInst = await u.DuckDb.create(`:memory:`)
  const conn = await dbInst.connect()
  await db.initSchema(conn)
  await conn.run(`copy facts from ${u.sqlStr(factsPath)}`)
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
    return new Request(`http://localhost/api/upload_round`, {
      method: a.POST,
      body: a.jsonEncode(body),
      ...opt,
    })
  }

  async function test(req, exp) {t.eq(await aur.uploadRound(ctx, req), exp)}

  async function fail(req, msg) {
    await t.throws(async () => await aur.uploadRound(ctx, req), u.ErrHttp, msg)
  }

  await db.initSchema(await ctx.conn())
  const round = a.jsonDecode(TEST_PROGRESS_BIG)
  const auth = u.authHeadersOpt(tu.TEST_PUBLIC_KEY, tu.TEST_SECRET_KEY)

  await fail(req(), `round upload requires authentication`)
  await fail(req(round), `round upload requires authentication`)

  await fail(req(round, {headers: auth}), `round upload: Tabularius schema version mismatch: expected schema version ${s.ROUND_FIELDS_SCHEMA_VERSION}, got schema version undefined; suggestion: update your client by reloading the page`)
  round.tabularius_fields_schema_version = s.ROUND_FIELDS_SCHEMA_VERSION - 1

  await fail(req(round, {headers: auth}), `round upload: Tabularius schema version mismatch: expected schema version ${s.ROUND_FIELDS_SCHEMA_VERSION}, got schema version ${s.ROUND_FIELDS_SCHEMA_VERSION - 1}; suggestion: update your client by reloading the page`)
  round.tabularius_fields_schema_version = s.ROUND_FIELDS_SCHEMA_VERSION + 1

  await fail(req(round, {headers: auth}), `round upload: Tabularius schema version mismatch: expected schema version ${s.ROUND_FIELDS_SCHEMA_VERSION}, got schema version ${s.ROUND_FIELDS_SCHEMA_VERSION + 1}; suggestion: update your client by reloading the page`)
  round.tabularius_fields_schema_version = s.ROUND_FIELDS_SCHEMA_VERSION

  await fail(req(round, {headers: auth}), `round upload: missing user id`)
  round.tabularius_user_id = `123`

  const user_id = tu.TEST_PUB
  await fail(
    req(round, {headers: auth}),
    `user id mismatch: required ${a.show(a.reqValidStr(user_id))}, got "123"`,
  )
  round.tabularius_user_id = user_id

  await fail(
    req(round, {headers: auth}),
    `round upload: run number must be a natural integer, got undefined`,
  )
  const run_num = 1
  round.tabularius_run_num = run_num

  await fail(
    req(round, {headers: auth}),
    `round upload: run timestamp must be a natural integer, got undefined`,
  )
  const run_ms = Date.parse(round.LastUpdated)
  round.tabularius_run_ms = run_ms

  await test(req(round, {headers: auth}), {factCount: 817})
  await test(req(round, {headers: auth}), {redundant: true})

  const runName = s.makeRunName(run_num, run_ms)
  const roundName = s.makeRoundFileNameBase(round.RoundIndex)
  const path = io.paths.join(ctx.userRunsDir, user_id, runName, roundName + `.json.gz`)
  const roundRead = await u.readDecodeGameFile(path)
  t.eq(roundRead, round)
})
