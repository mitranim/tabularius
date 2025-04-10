import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'

import * as self from './watch.mjs'
const tar = window.tabularius ??= a.Emp()
tar.w = self
a.patch(window, tar)

export async function watchStarted() {
  return (
    (await fs.hasPermissionConf(fs.PROGRESS_FILE, fs.PROGRESS_FILE_CONF)) &&
    (await fs.hasPermissionConf(fs.HISTORY_DIR, fs.HISTORY_DIR_CONF)) &&
    (isWatching() || (os.runCmd(`watch`).catch(u.logErr), true))
  )
}

/*
TODO: detection should be across all browser tabs.
Possibly via `localStorage`.
*/
function isWatching() {return !!os.procByName(`watch`)}

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

const WATCH_LOCK_NAME = `watch`
const WATCH_INTERVAL_MS = a.secToMs(10)
const WATCH_INTERVAL_MS_SHORT = a.secToMs(1)
const WATCH_INTERVAL_MS_LONG = a.minToMs(1)
const WATCH_MAX_ERRS = 3

cmdWatch.cmd = `watch`
cmdWatch.desc = `watch the progress file for changes and create backups`
cmdWatch.help = u.joinParagraphs(
  cmdWatch.desc,
  `requires running "init" first (just once) to grant FS access`,
  `can be stopped via "kill watch" (one-off) or "deinit" (permanent until "init")`,
)

export async function cmdWatch(proc) {
  const {sig} = proc
  if (isWatching()) return `already running`

  proc.desc = `acquiring lock`
  let unlock = await u.lockOpt(WATCH_LOCK_NAME)

  if (unlock) {
    u.log.info(`[watch] starting`)
  }
  else {
    const start = Date.now()
    u.log.verb(`[watch] another process has a lock on watching and backups, waiting until it stops`)
    proc.desc = `waiting for another watcher`
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
        u.log.err(`[watch] filesystem error, may need to run "deinit" and "init":`, err)
      }
      if (errs >= WATCH_MAX_ERRS) {
        throw Error(`unexpected error; reached max error count ${errs}, exiting: ${err}`, {cause: err})
      }
      if (u.errIs(err, u.isErrDecoding)) {
        sleep = WATCH_INTERVAL_MS_SHORT
        u.log.err(`[watch] file decoding error, retrying after ${sleep}ms:`, err)
      }
      else {
        sleep = WATCH_INTERVAL_MS_LONG
        u.log.err(`[watch] unexpected error (${errs} in a row), retrying after ${sleep}ms:`, err)
      }
    }
    if (!await a.after(sleep, sig)) return
  }
}

// Initialize backup state by inspecting history directory.
async function watchInit(sig, state) {
  a.final(state, `progressFileHandle`, fs.PROGRESS_FILE)
  a.final(state, `historyDirHandle`, fs.HISTORY_DIR)

  if (!state.progressFileHandle) {
    throw Error(`missing progress file handle, run "init" to initialize`)
  }
  if (!state.historyDirHandle) {
    throw Error(`missing history dir handle, run "init" to initialize`)
  }

  const runDir = await fs.findLatestRunDir(sig, state.historyDirHandle)
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
  const roundData = await u.wait(sig, u.jsonDecompressDecode(content))
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
    u.log.verb(`[watch] skipping: progress file unmodified`)
    return
  }

  const prevRoundNum = u.toIntOpt(roundFileName)
  if (prevRoundNum === nextRoundNum) {
    u.log.verb(`[watch] skipping: round is still ${prevRoundNum}`)
    return
  }

  const prevDirNum = u.toIntOpt(runDirName)
  const nextFileName = u.intPadded(nextRoundNum) + u.paths.ext(state.progressFileHandle.name)

  const event = {
    type: `new_round`,
    runId: runDirName,
    runNum: prevDirNum,
    roundNum: nextRoundNum,
    roundData,
  }

  if (prevRoundNum < nextRoundNum) {
    u.log.info(`[watch] round increased from ${prevRoundNum} to ${nextRoundNum}, backing up`)
    const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
      runDirName,
      {create: true},
    ))

    await fs.writeDirFile(sig, dir, nextFileName, content)
    await state.setRoundFile(nextFileName)

    u.broadcastToAllTabs(event)
    return
  }

  if (nextRoundNum < prevRoundNum) {
    u.log.info(`[watch] round decreased from ${prevRoundNum} to ${nextRoundNum}, assuming new run`)
  }
  else {
    u.log.info(`[watch] round is now ${nextRoundNum}, assuming new run`)
  }

  const nextDirNum = a.isNil(prevDirNum) ? 0 : prevDirNum + 1
  const nextDirName = u.intPadded(nextDirNum)
  const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
    nextDirName,
    {create: true},
  ))
  state.setRunDir(nextDirName)
  await fs.writeDirFile(sig, dir, nextFileName, content)
  state.setRoundFile(nextFileName)
  u.log.info(`[watch] backed up run ${dir.name} > file ${nextFileName}`)

  event.prevRunId = event.runId
  event.runId = nextDirName
  event.runNum = nextDirNum
  u.broadcastToAllTabs(event)
}
