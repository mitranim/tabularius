import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as pt from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/path.mjs'
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

  const runDir = await findLatestRunDir(sig, state.historyDirHandle)
  state.setRunDir(runDir?.name)

  const roundFile = (
    runDir &&
    await findLatestRoundFile(sig, runDir, state.progressFileHandle)
  )
  await state.setRoundFile(roundFile?.name)

  u.log.info(`[watch] initialized:`, {
    run: state.runDirName,
    round: state.roundFileName,
  })
}

async function findLatestRunDir(sig, dir) {
  let max = -Infinity
  let out
  for await (const han of fs.readDir(sig, dir)) {
    const ord = u.strToInt(han.name)
    if (!(ord > max)) continue
    max = ord
    out = han
  }
  return out
}

async function findLatestRoundFile(sig, runDir, progressFileHandle) {
  const ext = pt.posix.ext(progressFileHandle.name)
  let max = -Infinity
  let out

  for await (const han of fs.readDir(sig, runDir)) {
    if (!fs.isFile(han)) continue
    if (pt.posix.ext(han.name) !== ext) continue

    const ord = u.strToInt(han.name)
    if (!(ord > max)) continue

    max = ord
    out = han
  }
  return out
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
  const nextRoundOrd = roundData?.RoundIndex

  if (!a.isInt(nextRoundOrd)) {
    throw Error(`[watch] unexpected round in source data: ${a.show(nextRoundOrd)}`)
  }

  if (!nextRoundOrd) {
    u.log.verb(`[watch] current round is ${nextRoundOrd}, no current run, skipping backup`)
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

  const prevRoundOrd = u.strToInt(roundFileName)
  if (prevRoundOrd === nextRoundOrd) {
    u.log.verb(`[watch] skipping: round is still ${prevRoundOrd}`)
    return
  }

  const nextFileName = u.intToOrdStr(nextRoundOrd) + pt.posix.ext(state.progressFileHandle.name)

  const event = {
    type: `new_round`,
    runId: runDirName,
    roundIndex: nextRoundOrd,
    roundData,
  }

  if (prevRoundOrd < nextRoundOrd) {
    u.log.info(`[watch] round increased from ${prevRoundOrd} to ${nextRoundOrd}, backing up`)
    const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
      runDirName,
      {create: true},
    ))

    await fs.writeFile(sig, dir, nextFileName, content)
    await state.setRoundFile(nextFileName)

    u.broadcastToAllTabs(event)
    return
  }

  if (nextRoundOrd < prevRoundOrd) {
    u.log.info(`[watch] round decreased from ${prevRoundOrd} to ${nextRoundOrd}, assuming new run`)
  }
  else {
    u.log.info(`[watch] round is now ${nextRoundOrd}, assuming new run`)
  }

  const prevDirOrd = u.strToInt(runDirName)
  const nextDirOrd = a.isNil(prevDirOrd) ? 0 : prevDirOrd + 1
  const nextDirName = u.intToOrdStr(nextDirOrd)
  const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
    nextDirName,
    {create: true},
  ))
  state.setRunDir(nextDirName)
  await fs.writeFile(sig, dir, nextFileName, content)
  state.setRoundFile(nextFileName)
  u.log.info(`[watch] backed up run ${dir.name} > file ${nextFileName}`)

  event.prevRunId = event.runId
  event.runId = nextDirName
  u.broadcastToAllTabs(event)
}
