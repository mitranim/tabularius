/*
This module governs our client-only RAM cache for locally-sourced data.
For the actual data schema and aggregation logic, see `../shared/schema.mjs`.
*/

import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as s from '../shared/schema.mjs'

import * as self from './dat.mjs'
const tar = window.tabularius ??= a.Emp()
tar.d = self
a.patch(window, tar)

export const DAT = new EventTarget()

// Used only for local data.
export const USER_ID = `local_user`

// Allows live plot updates on dat changes. See `LivePlotter`.
u.listenMessage(u.BROAD, datOnBroadcast)

export function datQueryFacts(dat, opt) {
  a.reqStruct(dat)
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
  a.reqStruct(dat)
  opt = a.laxStruct(opt)
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
    a.reqNum(two.time_ms) - a.reqNum(one.time_ms) ||
    a.reqNum(two.run_num) - a.reqNum(one.run_num)
  )
}

function validRunId(run) {
  const id = run.run_id
  if (!id) throw Error(`internal: run data was built without "run_id"`)
  return a.reqStr(id)
}

export async function datLoad({sig, dat, opt, user}) {
  a.reqStruct(dat)
  opt = a.laxStruct(opt)
  a.optBool(user)

  const where = a.laxDict(opt.where)
  const root = await fs.historyDirReq(sig, user)
  const runNums = new Set(a.optArr(where.run_num))
  const runNames = new Set(a.map(a.optArr(where.run_id), s.runIdToRunNameReq))
  const roundNums = new Set(a.optArr(where.round_num))

  if (opt.runLatest) {
    const name = await fs.findLatestRunName(sig, root)
    if (name) runNames.add(name)
  }

  const runHandles = await (
    runNames.size
    ? fs.readRunsByNamesAscOpt(sig, root, runNames)
    : fs.readRunsAsc(sig, root)
  )

  for (const dir of runHandles) {
    const [run_num, run_ms] = s.splitRunName(dir.name)
    if (runNums.size && !runNums.has(run_num)) continue

    for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
      const round_num = u.toNatReq(file.name)
      if (roundNums.size && !roundNums.has(round_num)) continue
      await datLoadRoundFromHandle({sig, dat, file, run_num, run_ms})
    }
  }
}

/*
export async function datLoadRun({sig, dat, user, runName}) {
  const root = await fs.historyDirReq(sig, user)
  const runDir = await fs.chdir(sig, root, runName)
  await datLoadRunFromHandle(sig, dat, runDir)
}
*/

/*
export async function datLoadRunFromHandle(sig, dat, dir) {
  a.reqStruct(dat)
  a.reqInst(dir, FileSystemDirectoryHandle)

  const [run_num, run_ms] = s.splitRunName(dir.name)
  for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
    await datLoadRoundFromHandle({sig, dat, file, run_num, run_ms})
  }
}
*/

export async function datLoadRoundFromHandle({sig, dat, file, run_num, run_ms}) {
  a.reqStruct(dat)
  a.reqInst(file, FileSystemFileHandle)
  const round_id = s.makeRoundId(USER_ID, run_num, run_ms, u.toNatOpt(file.name))

  /*
  For better performance, we must load rounds idempotently. We assume that
  if the round is present, it was fully loaded. Without this check, we would
  sometimes insert redundant facts and mess up the stats.
  */
  if (dat.run_rounds?.has(round_id)) return

  const round = await fs.readDecodeGameFile(sig, file)
  s.datAddRound({dat, round, user_id: USER_ID, run_num, run_ms, composite: true})
}

function datOnBroadcast(src) {
  const type = src?.type
  if (type !== `new_round`) return
  const {round, run_num, run_ms} = src
  s.datAddRound({
    dat: DAT, round, user_id: USER_ID, run_num, run_ms, composite: true,
  })
  u.dispatchMessage(DAT, src)
}
