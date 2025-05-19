import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as au from './auth.mjs'

import * as self from './upload.mjs'
const tar = window.tabularius ??= a.Emp()
tar.up = self
a.patch(window, tar)

export const UPLOAD_LOCK_NAME = `tabularius.upload`
export const UPLOAD_RETRY_INTERVAL_MS = a.minToMs(1)
export const UPLOAD_MAX_ERRS = 3

export async function uploadStartOpt() {
  if (!await shouldStartUpload()) return
  os.runCmd(`upload -p -l`).catch(u.logErr)
}

export async function shouldStartUpload() {
  return (
    !isUploadingLocal() &&
    au.isAuthed() &&
    !!(await fs.historyDirOpt(u.sig).catch(u.logErr))
  )
}

export function isUploadingGlobal() {return u.lockHeld(UPLOAD_LOCK_NAME)}
export function isUploadingLocal() {return !!os.procByName(`upload`)}

cmdUpload.cmd = `upload`
cmdUpload.desc = `upload runs to the cloud; runs automatically`
cmdUpload.help = function cmdUploadHelp() {
  return u.LogParagraphs(
    cmdUpload.desc,
    [
      `upload is invoked `, u.Bold(`automatically`), ` after running `,
      os.BtnCmdWithHelp(`history`), ` and `, os.BtnCmdWithHelp(`auth`),
      ` in any order; you generally don't need to run it manually`,
    ],
    `usage:`,
    u.LogLines(
      `upload all runs:`,
      [`  `, os.BtnCmd(`upload`)],
    ),
    u.LogLines(
      `upload latest run:`,
      [`  `, os.BtnCmd(`upload latest`)],
    ),
    u.LogLines(
      `upload one arbitrary run:`,
      [`  `, ui.BtnPrompt({full: true, cmd: `upload`, eph: `<run_dir>`})],
    ),
    u.LogLines(
      `upload one arbitrary round:`,
      [`  `, ui.BtnPrompt({full: true, cmd: `upload`, eph: `<run_dir>/<round_file>`})],
    ),
    `FS paths are relative to the run history directory`,
    u.LogLines(
      `flags:`,
      [`  `, ui.BtnPrompt({cmd: `upload`, suf: `-p`}), ` -- persistent mode`],
      [
        `  `, ui.BtnPrompt({cmd: `upload`, suf: `-l`}),
        ` -- lazy mode: skip all runs if `,
        ui.BtnPrompt({cmd: `upload`, suf: `latest/latest`}),
        ` is already uploaded`,
      ],
      [`  `, ui.BtnPrompt({cmd: `upload`, suf: `-q`}), ` -- quiet mode, minimal logging`],
    ),
    `upload is idempotent, meaning no duplicates; for each run, we upload only one of each round; re-running the command is safe and intended`,
    [
      `tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse local files`,
      ` and `, os.BtnCmdWithHelp(`ls -c`), ` to browse cloud files`,
    ],
  )
}

export async function cmdUpload(proc) {
  const cmd = cmdUpload.cmd
  const {args} = proc
  const opt = a.Emp()
  let path = ``

  for (const [key, val, pair] of u.cliDecode(u.stripPreSpaced(args, cmd))) {
    if (key === `-p`) {
      opt.persistent = ui.cliBool(cmd, key, val)
      continue
    }
    if (key === `-l`) {
      opt.lazy = ui.cliBool(cmd, key, val)
      continue
    }
    if (key === `-q`) {
      opt.quiet = ui.cliBool(cmd, key, val)
      continue
    }
    if (key === `-f`) {
      opt.force = ui.cliBool(cmd, key, val)
      continue
    }

    if (key) {
      u.log.err(
        `unrecognized `, ui.BtnPrompt({cmd, suf: pair}),
        ` in `, ui.BtnPromptReplace({val: args}),
      )
      return os.cmdHelpDetailed(cmdUpload)
    }

    if (!val) continue

    if (path) {
      u.log.err(`too many upload paths in `, ui.BtnPromptReplace({val: args}))
      return os.cmdHelpDetailed(cmdUpload)
    }
    path = val
  }

  if (isUploadingLocal()) return `[upload] already running`

  const {sig} = proc
  proc.desc = `acquiring lock`
  let unlock = await u.lockOpt(UPLOAD_LOCK_NAME)

  if (!unlock) {
    if (!opt.persistent) return `[upload] another process has a lock on uploading`

    const start = Date.now()
    u.log.verb(`[upload] another process has a lock on uploading, waiting until it stops`)
    proc.desc = `waiting for another "upload" process`
    unlock = await u.lock(sig, UPLOAD_LOCK_NAME)
    const end = Date.now()

    u.log.verb(`[upload] acquired lock from another process after ${end - start}ms, proceeding to upload`)
  }

  proc.desc = `uploading backups to the cloud`
  try {return await cmdUploadUnsync({sig, path, opt})}
  finally {unlock()}
}

export async function cmdUploadUnsync({sig, path: srcPath, opt}) {
  u.reqSig(sig)
  a.reqDict(opt)

  const persistent = a.optBool(opt.persistent)
  const quiet = a.optBool(opt.quiet)
  const hist = await fs.historyDirReq(sig)
  const userId = au.reqUserId()
  const rootPath = `/` + hist.name
  const relPath = (
    u.paths.isAbs(srcPath)
    ? u.paths.strictRelTo(srcPath, rootPath)
    : u.paths.clean(srcPath)
  )
  const [_, handle, resolvedPath] = await fs.handleAtPath({
    sig, handle: hist, path: relPath, magic: true,
  })
  const absPath = u.paths.join(rootPath, resolvedPath)
  const state = a.vac(!quiet) && o.obs({
    done: false,
    status: ``,
    runsChecked: 0,
    roundsChecked: 0,
    roundsUploaded: 0,
  })

  if (state) {
    if (fs.isFile(handle)) {
      u.log.info(new FileUploadProgress(absPath, state))
    }
    else {
      u.log.info(new DirUploadProgress(absPath, state))
    }
  }

  function canceledOpt(err) {
    if (u.errIs(err, u.isErrAbort)) {
      if (state) state.status = `canceled`
      return true
    }
    return false
  }

  const inp = {sig, hist, path: resolvedPath, opt, userId, state}

  if (!persistent) {
    try {return await cmdUploadStep(inp)}
    catch (err) {
      if (canceledOpt(err)) return
      throw err
    }
  }

  let errs = 0

  for (;;) {
    if (sig.aborted) {
      if (state) state.status = `canceled`
      return
    }

    try {
      return await cmdUploadStep(inp)
    }
    catch (err) {
      if (canceledOpt(err)) return

      errs++

      if (errs >= UPLOAD_MAX_ERRS) {
        state.status = `error`
        throw Error(`unexpected error; reached max error count ${errs}, exiting: ${err}`, {cause: err})
      }

      const sleep = UPLOAD_RETRY_INTERVAL_MS
      u.log.err(`[upload] unexpected error (${errs} in a row), retrying after ${sleep}ms: `, err)

      state.status = `waiting before retrying`
      if (!await a.after(sleep, sig)) return
    }
  }
}

async function cmdUploadStep({sig, hist, path, opt, userId, state}) {
  u.reqSig(sig)
  a.reqStr(path)
  a.reqDict(opt)
  a.reqValidStr(userId)
  a.optObj(state)

  const lazy = a.optBool(opt.lazy)
  const force = a.optBool(opt.force)
  const segs = u.paths.splitRel(path)

  if (!segs.length) {
    if (state) state.status = `checking runs`

    const runHandles = await fs.readRunsAsc(sig, hist)
    if (lazy && await isRunUploaded({sig, dir: a.last(runHandles), state})) {
      uploadDone({state, lazy: true})
      return
    }

    if (state) state.status = `uploading all runs`
    for (const dir of runHandles) {
      await uploadRun({sig, dir, userId, state, force})
    }
    uploadDone({state})
    return
  }

  const dir = await fs.getDirectoryHandle(sig, hist, segs.shift())

  if (!segs.length) {
    if (lazy && await isRunUploaded({sig, dir, state})) {
      uploadDone({state, lazy: true})
      return
    }

    await uploadRun({sig, dir, userId, state, force})
    uploadDone({state})
    return
  }

  if (segs.length !== 1) {
    u.log.err(`[upload] unsupported path ${a.show(path)}`)
    return os.cmdHelpDetailed(cmdUpload)
  }

  const file = await fs.getFileHandle(sig, dir, segs.shift())
  await uploadRound({sig, file, runName: dir.name, userId, state, force})
  uploadDone({state})
}

export async function uploadRun({sig, dir, userId, state, force}) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  const runName = dir.name

  // Questionable special case. TODO more general approach.
  if (runName === fs.SHOW_DIR) {
    u.log.info(`[upload] skipping `, a.show(runName))
    return
  }

  if (state) {
    state.status = `uploading run ${runName}`
    state.runsChecked++
  }

  const handles = await fs.readRunRoundHandlesAsc(sig, dir)
  for (const file of handles) {
    await uploadRound({sig, file, runName, userId, state, force})
  }
}

let UPLOAD_ROUND_TIMER_ID = 0

export async function uploadRound({sig, file, runName, userId, state, force}) {
  const id = ++UPLOAD_ROUND_TIMER_ID
  if (u.LOG_VERBOSE) console.time(`upload_round_${id}`)

  a.reqInst(file, FileSystemFileHandle)
  a.reqValidStr(runName)
  a.reqValidStr(userId)
  a.optBool(force)

  const path = u.paths.join(runName, file.name)

  // Questionable special case. TODO more general approach.
  if (runName === fs.SHOW_DIR) {
    u.log.info(`[upload] skipping `, a.show(path))
    return
  }

  if (state) state.status = `checking round ${a.show(path)}`
  if (state) state.roundsChecked++

  const roundNum = u.toNatOpt(file.name)
  if (!roundNum) {
    if (u.LOG_VERBOSE) console.log(`skipping round ${a.show(path)} with round_num ${a.show(roundNum)}`)
    return
  }

  // if (u.LOG_VERBOSE) console.time(`read_file_${id}`)
  const round = await fs.readDecodeGameFile(sig, file)
  // if (u.LOG_VERBOSE) console.timeEnd(`read_file_${id}`)

  const roundNumFromData = a.reqInt(round.RoundIndex)
  if (roundNum !== roundNumFromData) {
    u.log.err(`data inconsistency: file ${a.show(path)} indicates round_num ${a.show(roundNum)} in the name, but has round_num ${a.show(roundNumFromData)} in the data; skipping upload`)
    return
  }

  if (isRoundUploaded(round) && !force) return

  const prevUserId = a.onlyValidStr(round.tabularius_user_id)

  // We can't attempt to upload it with the old user id, because our server
  // rejects the attempt. Users can only upload rounds with their own user id.
  if (prevUserId && prevUserId !== userId) {
    if (u.LOG_VERBOSE) console.log(`skipping upload of ${a.show(path)}: user id mismatch: old ${prevUserId} ≠ new ${userId}`)
    return
  }

  const [runNum, runMs] = s.splitRunName(runName)
  let migrated = s.roundMigrated({round, userId, runNum, runMs})

  if (!a.isNat(round.tabularius_uploaded_at)) {
    round.tabularius_uploaded_at = Date.now()
    migrated = true
  }

  const jsonStr = JSON.stringify(round)
  const gzipByteArr = await u.str_to_gzipByteArr(jsonStr)
  if (state) state.status = `uploading ${a.show(path)}`

  try {
    const isGzip = u.QUERY.get(`upload_mode`) !== `json`
    const body = isGzip ? gzipByteArr : jsonStr

    // if (u.LOG_VERBOSE) console.time(`upload_to_server_${id}`)
    const info = await apiUploadRound(sig, {body, isGzip})
    // if (u.LOG_VERBOSE) console.timeEnd(`upload_to_server_${id}`)

    if (info?.redundant) {
      if (u.LOG_VERBOSE) console.log(`server: skipped redundant upload of ${a.show(path)}`)
    }
    else {
      if (state) state.roundsUploaded++
      if (u.LOG_VERBOSE && info?.facts) {
        u.log.info(`uploaded ${a.show(path)}: ${a.show(info.facts)} facts`)
      }
    }
  }
  catch (err) {
    if (state) state.status = `unable to upload ${a.show(path)}, see error`
    throw err
  }

  if (migrated) {
    const fileContentGdStr = u.byteArr_to_base64Str(gzipByteArr)

    /*
    Use a background signal to suppress cancelation, to avoid double upload if the
    command is killed between uploading and writing the file. The desync is still
    possible if the browser tab is killed at this point.
    */
    // if (u.LOG_VERBOSE) console.time(`write_file_${id}`)
    await fs.writeFile(u.sig, file, fileContentGdStr, path)
    // if (u.LOG_VERBOSE) console.timeEnd(`write_file_${id}`)
  }
  else if (u.LOG_VERBOSE) {
    console.log(`skipping write of ${a.show(path)}: no data change and previously uploaded`)
  }

  if (u.LOG_VERBOSE) console.timeEnd(`upload_round_${id}`)
}

async function isRunUploaded({sig, dir, state}) {
  if (!a.optInst(dir, FileSystemDirectoryHandle)) return false


  try {
    const file = await fs.findLatestRoundFile(sig, dir)
    if (!file) return false

    const data = await fs.readDecodeGameFile(sig, file)

    if (state) state.runsChecked++
    if (state) state.roundsChecked++

    return isRoundUploaded(data)
  }
  catch (err) {
    u.log.err(`unable to check if run ${a.show(dir.name)} is uploaded: `, err)
    return false
  }
}

function isRoundUploaded(val) {return a.isNat(val?.tabularius_uploaded_at)}

function uploadDone({state, lazy}) {
  if (!a.optObj(state)) return
  state.done = true
  state.status = `done` + (a.optBool(lazy) ? ` (lazy mode)` : ``)
}

export class FileUploadProgress extends u.ReacElem {
  constructor(path, state) {
    super()
    this.path = a.reqStr(path)
    this.state = a.reqObj(state)
  }

  run() {
    const {path} = this
    const {done, status, roundsChecked, roundsUploaded} = this.state

    if (!done) {
      // All round upload statuses include the file path, don't repeat it.
      E(this, {}, `[upload] `, status || [`uploading `, a.show(path)])
      return
    }

    if (roundsUploaded) {
      E(this, {}, `[upload] uploaded `, a.show(path))
      return
    }

    if (roundsChecked) {
      E(this, {}, `[upload] checked `, a.show(path), `, no upload needed`)
      return
    }

    E(this, {}, `[upload] tried to upload `, a.show(path), `, nothing done`)
  }
}

export class DirUploadProgress extends FileUploadProgress {
  run() {
    const {path} = this
    const {done, status, runsChecked, roundsChecked, roundsUploaded} = this.state

    if (done && !roundsChecked) {
      E(this, {},
        `[upload] checked the run history directory, found no round backups; build your history by playing the game!`,
      )
      return
    }

    E(this, {},
      `[upload] `,
      (
        roundsUploaded
        ? (done ? `uploaded` : `uploading`)
        : (done ? `checked` : `checking`)
      ),
      ` `,
      a.show(path),
      u.joinLines(
        `: `,
        `  status: ${status}`,
        `  runs checked: ${runsChecked}`,
        `  rounds checked: ${roundsChecked}`,
        [`  rounds uploaded: ${roundsUploaded}`, a.vac(done && !roundsUploaded) && ` (none needed)`],
      ),
    )
  }
}

export function apiUploadRound(sig, {body, isGzip}) {
  const url = u.paths.join(u.API_URL, `upload_round`)
  const opt = {
    signal: u.reqSig(sig),
    method: a.POST,
    headers: a.compact([
      ...au.authHeadersOpt(),
      [`content-type`, `application/json`],
      a.vac(isGzip) && [`content-encoding`, `gzip`],
    ]),
    body,
  }
  return u.fetchJson(url, opt)
}
