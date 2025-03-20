import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as idb from 'https://esm.sh/idb@7.1.1'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'

export async function watchStarted() {
  return (
    (await fs.hasPermissionConf(fs.PROGRESS_FILE, fs.PROGRESS_FILE_CONF)) &&
    (await fs.hasPermissionConf(fs.HISTORY_DIR, fs.HISTORY_DIR_CONF)) &&
    !isWatching() &&
    (os.runCmd(`watch`), true)
  )
}

/*
TODO: detection should be across all browser tabs.
Possibly via `localStorage`.
*/
function isWatching() {return os.hasProcByName(`watch`)}

class WatchState extends a.Emp {
  progressFileHandle = a.optInst(undefined, FileSystemFileHandle)
  historyDirHandle = a.optInst(undefined, FileSystemDirectoryHandle)
  runDirName = undefined
  roundFileName = undefined

  setRunDir(val) {
    this.runDirName = a.optValidStr(val)
    this.setRoundFile()
  }

  setRoundFile(val) {this.roundFileName = a.optValidStr(val)}
}

const WATCH_INTERVAL_MS = a.secToMs(10)
const WATCH_INTERVAL_MS_SHORT = a.secToMs(1)
const WATCH_INTERVAL_MS_LONG = a.minToMs(1)
const WATCH_MAX_ERRS = 3

export async function cmdWatch(sig) {
  if (isWatching()) return `already running`
  u.log.inf(`[watch] running`)

  let sleep = WATCH_INTERVAL_MS
  let errs = 0
  const state = new WatchState()
  await watchInit(sig, state)

  while (!sig.aborted) {
    try {
      await watchStep(sig, state)
      errs = 0
      sleep = WATCH_INTERVAL_MS
    }
    catch (err) {
      if (u.errIs(err, a.isErrAbort)) return
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
    await u.wait(sig, a.after(sleep))
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

  u.log.inf(`[watch] initialized:`, {
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
  const ext = u.fileNameExt(progressFileHandle.name)
  let max = -Infinity
  let out

  for await (const han of fs.readDir(sig, runDir)) {
    if (!fs.isFile(han)) continue
    if (u.fileNameExt(han.name) !== ext) continue

    const ord = u.strToInt(han.name)
    if (!(ord > max)) continue

    max = ord
    out = han
  }
  return out
}

// Main watch functionality, periodically executed by `cmdWatch`.
async function watchStep(sig, state) {
  const progressFile = await fs.getFile(sig, state.progressFileHandle)
  const content = await u.wait(sig, progressFile.text())
  const decoded = await u.wait(sig, u.decodeObfuscated(content))
  const nextTime = progressFile.lastModified
  const runDirName = state.runDirName
  const roundFileName = state.roundFileName
  const prevTime = (await fs.getSubFile(sig, state.historyDirHandle, runDirName, roundFileName))?.lastModified
  if (prevTime >= nextTime) {
    u.log.verb(`[watch] skipping: progress file unmodified`)
    return
  }

  const nextRoundOrd = decoded?.RoundIndex
  if (!a.isInt(nextRoundOrd)) {
    throw Error(`[watch] unexpected round in source data: ${a.show(nextRoundOrd)}`)
  }

  const prevRoundOrd = u.strToInt(roundFileName)
  if (prevRoundOrd === nextRoundOrd) {
    u.log.verb(`[watch] skipping: round is still ${prevRoundOrd}`)
    return
  }

  const nextFileName = u.intToOrdStr(nextRoundOrd) + u.fileNameExt(state.progressFileHandle.name)

  if (prevRoundOrd < nextRoundOrd) {
    u.log.inf(`[watch] round increased from ${prevRoundOrd} to ${nextRoundOrd}, backing up`)
    const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
      runDirName,
      {create: true},
    ))
    const file = await fs.writeFile(sig, dir, nextFileName, content)
    await state.setRoundFile(nextFileName)
    return
  }

  if (prevRoundOrd > nextRoundOrd) {
    u.log.inf(`[watch] round decreased from ${prevRoundOrd} to ${nextRoundOrd}, assuming new run`)
  }
  else {
    u.log.inf(`[watch] round is now ${nextRoundOrd}, assuming new run`)
  }

  const prevDirOrd = u.strToInt(runDirName)
  const nextDirOrd = a.isNil(prevDirOrd) ? 0 : prevDirOrd + 1
  const nextDirName = u.intToOrdStr(nextDirOrd)
  const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
    nextDirName,
    {create: true},
  ))
  state.setRunDir(nextDirName)
  const file = await fs.writeFile(sig, dir, nextFileName, content)
  state.setRoundFile(nextFileName)
  u.log.inf(`[watch] backed up run ${dir.name} > file ${nextFileName}`)
}

// Must always be at the very end of this file.
export {idb}
import * as module from './watch.mjs'
window.tabularius.watch = module