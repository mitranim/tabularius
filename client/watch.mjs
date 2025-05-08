import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as au from './auth.mjs'

import * as self from './watch.mjs'
const tar = window.tabularius ??= a.Emp()
tar.w = self
a.patch(window, tar)

export async function watchStarted() {
  return (
    (await isWatchingLocal()) || (
      (await fs.fileConfHasPermission(u.sig, fs.PROGRESS_FILE_CONF)) &&
      (await fs.fileConfHasPermission(u.sig, fs.HISTORY_DIR_CONF)) &&
      (os.runCmd(`watch`).catch(u.logErr), true)
    )
  )
}

export function isWatchingGlobal() {return u.lockHeld(WATCH_LOCK_NAME)}
export function isWatchingLocal() {return !!os.procByName(`watch`)}

export const WATCH_STATE = new class WatchState extends a.Emp {
  progressFileHandle = a.optInst(undefined, FileSystemFileHandle)
  historyDirHandle = a.optInst(undefined, FileSystemDirectoryHandle)
  runDirName = undefined
  roundFileName = undefined

  setRunDir(val) {
    this.runDirName = a.optValidStr(val)
    this.setRoundFile()
  }

  setRoundFile(val) {this.roundFileName = a.optValidStr(val)}
}()

export const WATCH_LOCK_NAME = `tabularius.watch`
export const WATCH_INTERVAL_MS = a.secToMs(10)
export const WATCH_INTERVAL_MS_SHORT = a.secToMs(1)
export const WATCH_INTERVAL_MS_LONG = a.minToMs(1)
export const WATCH_MAX_ERRS = 3

cmdWatch.cmd = `watch`
cmdWatch.desc = `watch the progress file for changes and create backups`
cmdWatch.help = function cmdWatchHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdWatch.desc),
    [`requires running `, os.BtnCmdWithHelp(`init`), ` first (just once) to grant FS access`],
    [
      `can be stopped via `, os.BtnCmd(`kill watch`), ` (one-off) or `,
      os.BtnCmdWithHelp(`deinit`), ` (permanent until `, os.BtnCmd(`init`),`)`,
    ],
  )
}

export async function cmdWatch(proc) {
  if (isWatchingLocal()) return `already running`

  proc.desc = `acquiring lock`
  let unlock = await u.lockOpt(WATCH_LOCK_NAME)
  const {sig} = proc

  if (unlock) {
    u.log.info(`[watch] starting`)
  }
  else {
    const start = Date.now()
    u.log.verb(`[watch] another process has a lock on watching and backups, waiting until it stops`)
    proc.desc = `waiting for another "watch" process`
    unlock = await u.lock(sig, WATCH_LOCK_NAME)
    const end = Date.now()
    u.log.verb(`[watch] acquired lock from another process after ${end - start}ms, proceeding to watch and backup`)
  }

  proc.desc = `watching and backing up`
  try {return await cmdWatchUnsync(sig)}
  finally {unlock()}
}

export async function cmdWatchUnsync(sig) {
  let sleep = WATCH_INTERVAL_MS
  let errs = 0
  const state = WATCH_STATE
  await watchInit(sig, state)

  while (!sig.aborted) {
    try {
      await watchStep(sig, state)
      errs = 0
      sleep = WATCH_INTERVAL_MS
    }
    catch (err) {
      if (u.errIs(err, u.isErrAbort)) return
      errs++
      if (u.errIs(err, fs.isErrFs)) {
        u.log.err(`[watch] filesystem error, may need to run "deinit" and "init": `, err)
      }
      if (errs >= WATCH_MAX_ERRS) {
        throw Error(`unexpected error; reached max error count ${errs}, exiting: ${err}`, {cause: err})
      }
      if (u.errIs(err, u.isErrDecoding)) {
        sleep = WATCH_INTERVAL_MS_SHORT
        u.log.err(`[watch] file decoding error, retrying after ${sleep}ms: `, err)
      }
      else {
        sleep = WATCH_INTERVAL_MS_LONG
        u.log.err(`[watch] unexpected error (${errs} in a row), retrying after ${sleep}ms: `, err)
      }
    }
    if (!await a.after(sleep, sig)) return
  }
}

// Initialize backup state by inspecting history directory.
async function watchInit(sig, state) {
  await fs.fileConfRequireOrRequestPermission(sig, fs.PROGRESS_FILE_CONF)
  a.final(state, `progressFileHandle`, fs.PROGRESS_FILE_CONF.handle)

  await fs.fileConfRequireOrRequestPermission(sig, fs.HISTORY_DIR_CONF)
  a.final(state, `historyDirHandle`, fs.HISTORY_DIR_CONF.handle)

  const runDir = await fs.findLatestDirEntryOpt(sig, state.historyDirHandle)
  state.setRunDir(runDir?.name)

  const roundFile = (
    runDir &&
    await fs.findLatestRoundFile(sig, runDir, state.progressFileHandle)
  )
  await state.setRoundFile(roundFile?.name)

  u.log.info(`[watch] initialized: `, {
    run: state.runDirName,
    round: state.roundFileName,
  })
}

/*
Main watch functionality, periodically executed by `cmdWatch`.

TODO: when a fork is detected, delete all rounds after the fork.

TODO: when file deletion is detected, don't assume a new run, continue backups
in the current dir.
*/
async function watchStep(sig, state) {
  const progressFile = await fs.getFile(sig, state.progressFileHandle)
  const content = await u.wait(sig, progressFile.text())
  const roundData = await u.wait(sig, u.decodeGdStr(content))
  const nextRoundNum = roundData?.RoundIndex

  if (!a.isInt(nextRoundNum)) {
    throw Error(`[watch] unexpected round in source data: ${a.show(nextRoundNum)}`)
  }

  if (!nextRoundNum) {
    u.log.verb(`[watch] current round is ${nextRoundNum}, no current run, skipping backup`)
    return
  }

  const nextTime = progressFile.lastModified
  const runDirName = state.runDirName
  let roundFileName = state.roundFileName
  let prevFile
  try {
    prevFile = await fs.getSubFile(sig, state.historyDirHandle, runDirName, roundFileName)
  }
  catch (err) {
    u.log.err(`[watch] unable to get latest backup file; assuming it was deleted and continuing; error:`, err)
    roundFileName = undefined
  }

  const prevTime = prevFile?.lastModified
  if (prevTime >= nextTime) {
    // u.log.verb(`[watch] skipping: progress file unmodified`)
    return
  }

  const prevRoundNum = u.toIntOpt(roundFileName)
  if (prevRoundNum === nextRoundNum) {
    // u.log.verb(`[watch] skipping: round is still ${prevRoundNum}`)
    return
  }

  const [prevRunNum, prevRunMs] = s.splitRunName(runDirName)
  const nextFileName = u.intPadded(nextRoundNum) + u.paths.ext(state.progressFileHandle.name)

  const event = {
    type: `new_round`,
    runDirName,
    roundFileName: nextFileName,
    round: roundData,
    run_num: prevRunNum,
    run_ms: prevRunMs,
    round_num: nextRoundNum,
  }

  if (prevRoundNum < nextRoundNum) {
    u.log.info(`[watch] round increased from ${prevRoundNum} to ${nextRoundNum}, backing up`)
    const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
      runDirName,
      {create: true},
    ))

    await fs.writeDirFile(sig, dir, nextFileName, content)
    await state.setRoundFile(nextFileName)
    watchBroadcast(event)
    return
  }

  if (nextRoundNum < prevRoundNum) {
    u.log.info(`[watch] round decreased from ${prevRoundNum} to ${nextRoundNum}, assuming new run`)
  }
  else {
    u.log.info(`[watch] round is now ${nextRoundNum}, assuming new run`)
  }

  const nextRunNum = a.isNil(prevRunNum) ? 0 : prevRunNum + 1
  const nextRunMs = Date.parse(roundData.LastUpdated)
  if (!a.isNat(nextRunMs)) {
    u.log.err(`internal error: round ${nextRoundNum} has missing or invalid timestamp ${a.show(roundData.LastUpdated)}`)
  }

  const nextRunDirName = s.makeRunName(nextRunNum, nextRunMs)
  const dir = await fs.getDirectoryHandle(sig, state.historyDirHandle, nextRunDirName, {create: true})
  state.setRunDir(nextRunDirName)
  await fs.writeDirFile(sig, dir, nextFileName, content)
  state.setRoundFile(nextFileName)
  u.log.info(`[watch] backed up ${a.show(u.paths.join(dir.name, nextFileName))}`)

  event.runDirName = nextRunDirName
  event.roundFileName = nextFileName
  event.prev_run_num = event.run_num
  event.run_num = nextRunNum
  watchBroadcast(event)
}

function watchBroadcast(eve) {
  u.broadcastToAllTabs(eve)
  if (!au.STATE.userId) return
  const {runDirName, roundFileName} = eve
  os.runCmd(`upload ${u.paths.join(runDirName, roundFileName)}`).catch(u.logErr)
}
