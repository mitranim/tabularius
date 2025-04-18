/*
This module governs our RAM cache for locally-sourced data.
For the actual data schema and aggregation logic, see `../funs/schema.mjs`.
*/

import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as s from '../funs/schema.mjs'

import * as self from './dat.mjs'
const tar = window.tabularius ??= a.Emp()
tar.d = self
a.patch(window, tar)

export const DAT = new EventTarget()
s.datInit(DAT)

// Used only for local data.
export const USER_ID = `local_user`

// Allows live plot updates on dat changes. See `LivePlotter`.
u.listenMessage(u.BROAD, datOnBroadcast)

export function datQueryFacts(dat, inp) {
  a.reqStruct(dat)
  return u.filterWhere(dat.facts, datQueryWhere(dat, inp))
}

export function datQueryWhere(dat, inp) {
  a.reqStruct(dat)
  inp = a.laxDict(inp)
  if (!inp.runLatest) return inp.where

  const out = u.dict(inp.where)
  const id = a.head(a.sort(dat.runs, compareRunByNumDesc))?.runId
  if (id) out.runId = a.concat(out.runId, [id])
  return out
}

function compareRunByNumDesc(one, two) {return two.runNum - one.runNum}

export async function datLoad(sig, dat, inp) {
  a.reqStruct(dat)
  inp = a.laxDict(inp)

  const where = a.laxDict(inp.where)
  const root = await fs.reqHistoryDir(sig)
  const runIds = u.compactSet(where.runId)
  const runNums = u.compactSet(where.runNum)
  const roundNums = u.compactSet(where.roundNum)

  if (inp.runLatest) {
    const id = await fs.findLatestRunId(sig, root)
    if (id) runIds.add(id)
  }

  const runIter = runIds.size
    ? fs.readRunsByIdsAscOpt(sig, root, runIds)
    : fs.readRunsAsc(sig, root)

  for await (const dir of runIter) {
    const runId = dir.name
    const runNum = u.toIntReq(runId)
    if (runNums.size && !runNums.has(runNum)) continue

    for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
      const roundNum = u.toIntReq(file.name)
      if (roundNums.size && !roundNums.has(roundNum)) continue
      await datLoadRoundFromHandle(sig, dat, file, runId)
    }
  }
}

export async function datLoadRun(sig, dat, runId) {
  const root = await fs.reqHistoryDir(sig)
  const runDir = await fs.chdir(sig, root, runId)
  await datLoadRunFromHandle(sig, dat, runDir)
}

export async function datLoadRunFromHandle(sig, dat, dir) {
  a.reqStruct(dat)
  a.reqInst(dir, FileSystemDirectoryHandle)

  const runId = dir.name
  for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
    await datLoadRoundFromHandle(sig, dat, file, runId)
  }
}

export async function datLoadRoundFromHandle(sig, dat, file, runId) {
  a.reqStruct(dat)
  a.reqInst(file, FileSystemFileHandle)

  const runNum = u.toIntReq(runId)
  const roundId = s.makeRoundId(runId, u.toIntOpt(file.name))

  /*
  For better performance, we must load rounds idempotently. We assume that
  if the round is present, it was fully loaded. Without this check, we would
  sometimes insert redundant facts and mess up the stats.
  */
  if (dat.runRounds?.has(roundId)) return

  const round = await fs.jsonDecompressDecodeFile(sig, file)
  s.datAddRound({dat, round, runId, runNum, userId: USER_ID})
}

function datOnBroadcast(src) {
  const type = src?.type
  if (type !== `new_round`) return

  const {roundData, runId, runNum} = src
  s.datAddRound({dat: DAT, round: roundData, runId, runNum, userId: USER_ID})
  u.dispatchMessage(DAT, src)
}
