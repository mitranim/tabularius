/*
This module governs our client-only RAM cache for locally-sourced data.
For the actual data schema and aggregation logic, see `../shared/schema.mjs`.
*/

import * as a from '@mitranim/js/all.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as fs from './fs.mjs'

import * as self from './dat.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.d = self
a.patch(globalThis, namespace)

export const DAT = new EventTarget()

// Used only for local data.
export const USER_ID = `local_user`

// Allows live plot updates on dat changes. See `LivePlotter`.
u.BROAD.addEventListener(u.EVENT_MSG, datOnBroadcast)

export const DAT_QUERY_TABLES = Object.freeze(u.dict({
  runs: true,
  facts: true,
}))

export function datQueryFacts(dat, opt) {
  a.reqRec(dat)
  return u.filterWhere(dat.facts, datQueryWhere(dat, opt))
}

/*
Known issue: when querying locally-sourced data, we end up filtering runs
and facts by local `USER_ID`, even though this is guaranteed to be a waste
of performance. This is a side effect of attempting to accurately match the
client-side and server-side implementations of plot aggregation, which allows
us to compare plot aggregation between client and server code.
But the performance is still wasted. TODO avoid.
*/
export function datQueryWhere(dat, opt) {
  a.reqRec(dat)
  opt = a.laxRec(opt)
  const where = u.dict(opt.where)

  // SYNC[plot_user_current].
  if (opt.userCurrent) where.user_id = a.append(where.user_id, USER_ID)

  if (!opt.runLatest) return where

  // SYNC[plot_run_latest_by_user_id_no_user_filter].
  const userIds = a.vac(where.user_id) && new Set(where.user_id)
  if (!userIds) {
    const run = a.head(a.sort(dat.runs, compareRunDesc))
    if (!run) return where
    where.run_id = a.append(where.run_id, validRunId(run))
    return where
  }

  // SYNC[plot_run_latest_by_user_id].
  const userIdToRun = a.Emp()

  for (const run of a.values(dat.runs)) {
    const user_id = a.reqValidStr(run.user_id)
    if (userIds && !userIds.has(user_id)) continue
    const prev = userIdToRun[user_id]
    if (!prev || compareRunDesc(prev, run) > 0) userIdToRun[user_id] = run
  }

  where.run_id = a.concat(
    where.run_id, a.map(a.values(userIdToRun), validRunId),
  )
  return where
}

// SYNC[plot_compare_run_desc].
function compareRunDesc(one, two) {
  return (
    a.reqNum(two.run_ms) - a.reqNum(one.run_ms) ||
    a.reqNum(two.run_num) - a.reqNum(one.run_num)
  )
}

function validRunId(run) {
  const id = run.run_id
  if (!id) throw Error(`internal: run data was built without "run_id"`)
  return a.reqStr(id)
}

export async function datLoad({sig, dat, opt, tables}) {
  a.reqRec(dat)
  opt = a.laxRec(opt)

  const where = a.laxDict(opt.where)
  const hist = await fs.historyDirReq(sig)
  const runNums = new Set(a.optArr(where.run_num))
  const runNames = new Set(a.map(a.optArr(where.run_id), s.runIdToRunNameReq))
  const roundNums = new Set(a.optArr(where.round_num))

  if (opt.runLatest) {
    const name = (await fs.findLatestRunDir(sig, hist))?.name
    if (name) runNames.add(name)
  }

  const runHandles = await (
    runNames.size
    ? fs.readRunsByNamesAscOpt(sig, hist, runNames)
    : fs.readRunsAsc(sig, hist)
  )

  for (const dir of runHandles) {
    const [run_num, run_ms] = s.splitRunName(dir.name)
    if (runNums.size && !runNums.has(run_num)) continue

    for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
      const round_num = u.toNatReq(file.name)
      if (roundNums.size && !roundNums.has(round_num)) continue
      await datLoadRoundFromHandle({sig, dat, file, run_num, run_ms, tables})
    }
  }
}

export async function datLoadRoundFromHandle({sig, dat, file, run_num, run_ms, tables}) {
  a.reqRec(dat)
  a.reqInst(file, FileSystemFileHandle)
  const round_id = s.makeRoundId(USER_ID, run_num, run_ms, u.toNatOpt(file.name))
  const unlock = await u.localLock(sig, round_id)

  try {
    /*
    We must load rounds idempotently. We assume that if the round is present,
    it was fully loaded. Without this check, we would sometimes insert redundant
    facts and mess up the stats. This is also why we use locking to avoid
    concurrent loading of the same round by multiple concurrent plot procs.
    */
    if (round_id in a.laxDict(dat.run_rounds)) return

    const round = await fs.readDecodeGameFile(sig, file)
    s.datAddRound({dat, round, user_id: USER_ID, run_num, run_ms, composite: true, tables})
  }
  finally {unlock()}
}

function datOnBroadcast(src) {
  src = u.eventData(src)
  const type = src?.type
  if (type !== `new_round`) return

  const {round, run_num, run_ms} = src
  s.datAddRound({
    dat: DAT, round, user_id: USER_ID, run_num, run_ms, composite: true,
  })
  u.dispatch(DAT, u.EVENT_MSG, src)
}

export function listenNewRound(ctx, fun) {
  a.reqFun(fun)

  function onDatEvent(src) {
    src = u.eventData(src)
    if (src?.type === `new_round`) fun.call(this, src)
  }

  return u.listenWeak(DAT, u.EVENT_MSG, ctx, onDatEvent)
}
