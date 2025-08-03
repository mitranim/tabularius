import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io'
import * as s from '../../shared/schema.mjs'
import * as u from '../util.mjs'
import * as db from '../db.mjs'

export function apiUploadRoundOpt(ctx, rou) {
  return rou.post(`/api/upload_round`) && apiUploadRound(ctx, rou.req)
}

let TIMER_ID = 0

export async function apiUploadRound(ctx, req) {
  const id = ++TIMER_ID
  console.time(`[upload_${id}]`)
  try {return new u.Res(a.jsonEncode(await uploadRound(ctx, req)), {status: 201})}
  finally {console.timeEnd(`[upload_${id}]`)}
}

export async function uploadRound(ctx, req) {
  const reqUserId = u.reqAuthReq(req)
  if (!reqUserId) {
    throw new u.ErrHttp(`round upload requires authentication`, {status: 401})
  }

  const round = await u.reqResBodyJson(req)
  if (!a.isDict(round)) {
    throw new u.ErrHttp(`round upload: request body must be a JSON object`, {status: 400})
  }

  const gameVer = round.Version
  if (gameVer !== 1) {
    throw new u.ErrHttp(`round upload: game schema version mismatch: only schema version 1 is supported, got schema version ${a.show(gameVer)}`, {status: 400})
  }

  const tabVer = round.tabularius_fields_schema_version
  if (tabVer !== s.ROUND_FIELDS_SCHEMA_VERSION) {
    throw new u.ErrHttp(`round upload: Tabularius schema version mismatch: expected schema version ${s.ROUND_FIELDS_SCHEMA_VERSION}, got schema version ${tabVer}; suggestion: update your client by reloading the page`, {status: 400})
  }

  const user_id = round.tabularius_user_id
  if (!user_id) {
    throw new u.ErrHttp(`round upload: missing user id`, {status: 400})
  }
  if (user_id !== reqUserId) {
    throw new u.ErrHttp(`round upload: user id mismatch: required ${a.show(reqUserId)}, got ${a.show(user_id)}`, {status: 400})
  }

  const round_num = round.RoundIndex

  /*
  Legacy behavior which should no longer happen. Our client, when walking files
  and uploading, should ignore round files with zero round num. That's because
  rounds before 1 have no useful statistics to tell. Meaning, the game has to
  save the final state of round 0, and advance to round 1, for our watcher to
  detect that change and upload the resulting data with the `round_num` 1, not
  0. We're one round behind, but it works out perfectly.
  */
  if (!a.isIntPos(round_num)) {
    throw new u.ErrHttp(`round upload: round number must be a positive integer, got ${a.show(round_num)}`, {status: 400})
  }

  const run_num = round.tabularius_run_num
  if (!a.isNat(run_num)) {
    throw new u.ErrHttp(`round upload: run number must be a natural integer, got ${a.show(run_num)}`, {status: 400})
  }

  const run_ms = round.tabularius_run_ms
  if (!a.isNat(run_ms)) {
    throw new u.ErrHttp(`round upload: run timestamp must be a natural integer, got ${a.show(run_ms)}`, {status: 400})
  }

  const runName = s.makeRunName(run_num, run_ms)
  const outDir = pt.join(ctx.userRunsDir, user_id, runName)
  const roundName = s.makeRoundFileNameBase(round.RoundIndex)
  const outPath = pt.join(outDir, roundName + u.GAME_FILE_EXT_REAL)
  const stat = await io.statOpt(outPath)

  if (stat) {
    const round_id = s.makeRoundId(user_id, run_num, run_ms, round_num)
    if (!stat.isFile) {
      throw new u.ErrHttp(`round upload: internal error: existing round ${a.show(round_id)} is not a file`, {status: 400})
    }
    return {redundant: true}
  }

  const dat = a.Emp()
  s.datAddRound({
    dat, round, user_id, run_num, run_ms,
    composite: u.SCHEMA_FACTS_COMPOSITE,
    tables: {facts: true},
  })

  const factCount = a.len(dat.facts)
  if (!factCount) return {factCount}

  // Prepare everything we can before inserting and writing.
  const outBin = await u.data_to_json_to_gzipByteArr(round)
  await io.mkdir(outDir, {recursive: true})
  await io.writeFile(outPath, outBin)

  const conn = await ctx.conn()
  await db.insertBatch({ctx, conn, table: `facts`, rows: dat.facts})
  return {factCount}
}
