import * as a from '@mitranim/js/all.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'
import * as au from './auth.mjs'
import * as p from './plot.mjs'

import * as self from './watch.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.w = self
a.patch(globalThis, namespace)

export async function watchStartOpt() {
  if (!await shouldStartWatch()) return
  os.runCmd(`watch`).catch(ui.logErr)
  ui.LOG.info(`started `, os.BtnCmdWithHelp(`watch`))
}

export async function shouldStartWatch() {
  return (
    !isWatchingLocal() &&
    !!(await fs.progressFileOpt(u.sig).catch(ui.logErr)) &&
    !!(await fs.historyDirOpt(u.sig).catch(ui.logErr))
  )
}

export function isWatchingGlobal() {return u.lockHeld(WATCH_LOCK_NAME)}
export function isWatchingLocal() {return !!os.procByName(`watch`)}

export const WATCH_STATE = new class WatchState extends a.Emp {
  progressFileHandle = a.optInst(undefined, FileSystemFileHandle)
  historyDirHandle = a.optInst(undefined, FileSystemDirectoryHandle)
  runDirName = undefined
  roundFileName = undefined
  task = undefined

  setRunDir(val) {
    this.runDirName = a.optValidStr(val)
    this.setRoundFile()
  }

  setRoundFile(val) {this.roundFileName = a.optValidStr(val)}

  idle() {return this.task ? undefined : this}

  async setTask(val) {
    this.task = val
    try {await val}
    finally {if (this.task === val) this.task = undefined}
  }
}()

export const WATCH_LOCK_NAME = `tabularius.watch`
export const WATCH_INTERVAL_MS = a.secToMs(10)
export const WATCH_INTERVAL_MS_SHORT = a.secToMs(1)
export const WATCH_INTERVAL_MS_LONG = a.minToMs(1)
export const WATCH_MAX_ERRS = 3

cmdWatch.cmd = `watch`
cmdWatch.desc = `watch the game's ${fs.PROGRESS_FILE_CONF.desc} for changes and create backups; runs automatically`
cmdWatch.help = function cmdWatchHelp() {
  return ui.LogParagraphs(
    u.callOpt(cmdWatch.desc),
    [
      `watch is invoked `, ui.Bold(`automatically`), ` after running `,
      os.BtnCmdWithHelp(`saves`), ` and `, os.BtnCmdWithHelp(`history`),
      ` in any order; you generally don't need to run it manually`,
    ],
    [
      `can be stopped via `, os.BtnCmd(`kill watch`),
      ` or by revoking FS access`,
    ],
  )
}

export async function cmdWatch(proc) {
  if (u.hasHelpFlag(u.splitCliArgs(proc.args))) return os.cmdHelpDetailed(cmdWatch)

  /*
  TODO: when already running, "nudge" the current watch process to hurry up,
  reset its error count, and skip its current waiting interval. Do this by
  broadcasting a special event to all tabs. Each `watch` should listen to this
  broadcast whenever it's sleeping.
  */
  if (isWatchingLocal()) return `already running`

  fs.reqFileSystemObserver()

  proc.desc = `acquiring lock`
  let unlock = await u.lockOpt(WATCH_LOCK_NAME)
  const {sig} = proc

  if (unlock) {
    ui.LOG.verb(`[watch] starting`)
  }
  else {
    const start = Date.now()
    ui.LOG.verb(`[watch] another process has a lock on watching and backups, waiting until it stops`)
    proc.desc = `waiting for another "watch" process`
    unlock = await u.lock(sig, WATCH_LOCK_NAME)
    const end = Date.now()
    ui.LOG.verb(`[watch] acquired lock from another process after ${end - start}ms, proceeding to watch and backup`)
  }

  proc.desc = `watching and backing up`
  try {return await cmdWatchUnsync(sig)}
  finally {unlock()}
}

function isFsEventModified(val) {return val?.type === `modified`}

export async function cmdWatchUnsync(sig) {
  const Obs = fs.reqFileSystemObserver()
  const state = WATCH_STATE
  await watchInit(sig, state)

  const obs = new Obs(function onFsChange(events) {
    if (!a.some(events, isFsEventModified)) return
    state.idle()?.setTask(onWatchFsEvent(sig, state).catch(onWatchErr))
  })

  await obs.observe(state.progressFileHandle)
  try {await sig}
  finally {obs.disconnect()}
}

async function watchInit(sig, state) {
  a.final(state, `progressFileHandle`, await fs.progressFileReq(sig))
  a.final(state, `historyDirHandle`, await fs.historyDirReq(sig))

  const runDir = await fs.findLatestDirEntryOpt({
    sig,
    dir: state.historyDirHandle,
    filter: fs.isHandleRunDir,
  })
  state.setRunDir(runDir?.name)

  const roundFile = runDir && await fs.findLatestRoundFile({sig, dir: runDir})
  await state.setRoundFile(roundFile?.name)

  ui.LOG.info(ui.LogLines(
    `[watch] initialized:`,
    [`  run = `, a.show(state.runDirName)],
    [`  round = `, a.show(state.roundFileName)],
  ))
}

/*
Main watch functionality, executed by `cmdWatch` on FS changes.

TODO: when a fork is detected, delete all rounds after the fork.

TODO: check `.EncodedSeed` to detect a deep rollback in the current run.

TODO: when file deletion is detected, don't assume a new run,
continue backups in the current dir.

TODO: handle corrupted files: show the same recommendation as `edit`.
Maybe show this only once, then keep checking until corruption is fixed.

TODO: check additional fields (other than `.RoundIndex`) for differences,
to detect new runs in an edge case where a user stops our app in one run,
and starts it in another run, where the round number is exactly the same.
Currently we end up merging two runs in such a case.

TODO:
- Check `.MarkAsExpired` and back up with an incremented `.RoundIndex`.
- Whenever file is modified but round is unchanged:
  - Check if the latest backup had `.MarkAsExpired`.
  - If true, prefer the new version of the file.
- Whenever round index is decreased by one:
  - Check if the latest backup had `.MarkAsExpired`.
  - If true, instead of assuming new run, delete the latest backup under the
    assumption that `rollback` was performed.
- All of the above may require additional support in `/api/upload_round`,
  since we do want to immediately upload such files.
*/
async function onWatchFsEvent(sig, state) {
  const blob = await fs.getFileBlob({sig, file: state.progressFileHandle})
  const content = await u.wait(sig, blob.text())
  const roundData = await u.wait(sig, u.decodeGdStr(content))
  const nextRoundNum = roundData?.RoundIndex

  if (!a.isInt(nextRoundNum)) {
    throw Error(`[watch] unexpected round in source data: ${a.show(nextRoundNum)}`)
  }

  if (!nextRoundNum) {
    ui.LOG.verb(`[watch] current round is ${nextRoundNum}, no current run, skipping backup`)
    return
  }

  const nextTime = blob.lastModified
  const runDirName = state.runDirName
  let roundFileName = state.roundFileName
  let prevFile
  try {
    prevFile = await fs.getSubFile({
      sig,
      dir: state.historyDirHandle,
      dirName: runDirName,
      fileName: roundFileName,
    })
  }
  catch (err) {
    ui.LOG.err(`[watch] unable to get latest backup file; assuming it was deleted and continuing; error: `, err)
    roundFileName = undefined
  }

  const prevTime = prevFile?.lastModified
  if (prevTime < nextTime) {
    ui.LOG.verb(`[watch] skipping: ${fs.PROGRESS_FILE_CONF.desc} unmodified`)
    return
  }

  const prevRoundNum = u.toNatOpt(roundFileName)
  if (prevRoundNum === nextRoundNum) {
    ui.LOG.verb(`[watch] skipping: round is still ${prevRoundNum}`)
    return
  }

  const nameSplit = runDirName ? s.splitRunName(runDirName) : []
  const prevRunNum = a.laxNat(nameSplit?.[0])
  const prevRunMs = a.onlyNat(nameSplit?.[1]) ?? Date.now()
  const nextFileName = s.makeRoundFileNameBase(nextRoundNum) + u.paths.ext(state.progressFileHandle.name)

  const event = {
    type: `new_round`,
    runDirName,
    roundFileName: nextFileName,
    round: roundData,
    run_num: prevRunNum,
    run_ms: prevRunMs,
    round_num: nextRoundNum,
    hadPrev: !!runDirName,
  }

  if (prevRoundNum < nextRoundNum) {
    ui.LOG.info(`[watch] round increased from ${prevRoundNum} to ${nextRoundNum}, backing up`)
    const dir = await u.wait(sig, state.historyDirHandle.getDirectoryHandle(
      runDirName,
      {create: true},
    ))

    await fs.writeDirFile({sig, dir, name: nextFileName, body: content})
    await state.setRoundFile(nextFileName)
    afterRoundBackup(event)
    return
  }

  if (nextRoundNum < prevRoundNum) {
    ui.LOG.info(`[watch] round decreased from ${prevRoundNum} to ${nextRoundNum}, assuming new run`)
  }
  else {
    ui.LOG.info(`[watch] round is now ${nextRoundNum}, assuming new run`)
  }

  const nextRunNum = a.isNil(prevRunNum) ? 0 : prevRunNum + 1
  const nextRunMs = Date.parse(roundData.LastUpdated)
  if (!a.isNat(nextRunMs)) {
    ui.LOG.err(`internal error: round ${nextRoundNum} has missing or invalid timestamp ${a.show(roundData.LastUpdated)}`)
  }

  const nextRunDirName = s.makeRunName(nextRunNum, nextRunMs)
  const dir = await fs.getDirectoryHandle({sig, dir: state.historyDirHandle, name: nextRunDirName, opt: {create: true}})
  state.setRunDir(nextRunDirName)
  await fs.writeDirFile({sig, dir, name: nextFileName, body: content})
  state.setRoundFile(nextFileName)
  ui.LOG.info(`[watch] backed up ${a.show(u.paths.join(dir.name, nextFileName))}`)

  event.runDirName = nextRunDirName
  event.roundFileName = nextFileName
  event.run_num = nextRunNum
  afterRoundBackup(event)
}

function afterRoundBackup(eve) {
  u.broadcastToAllTabs(eve)
  const {hadPrev, runDirName, roundFileName} = eve
  if (!hadPrev) p.plotDefaultLocalOpt({quiet: true}).catch(ui.logErr)
  if (!au.isAuthed()) return
  os.runCmd(`upload -p -u ${u.paths.join(runDirName, roundFileName)}`).catch(ui.logErr)
}

function onWatchErr(err) {
  if (u.errIs(err, u.isErrAbort)) return

  if (u.errIs(err, fs.isErrFs)) {
    ui.LOG.err(
      `[watch] filesystem error, may need to revoke FS access and grant it again;`,
      ` see `, os.BtnCmd(`help saves`), ` and `, os.BtnCmd(`help history`), `; error: `,
      err,
    )
    return
  }

  if (u.errIs(err, u.isErrDecoding)) {
    ui.LOG.err(`[watch] file decoding error: `, err)
    return
  }

  ui.LOG.err(`[watch] `, err)
}
