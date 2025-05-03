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

export function isUploadingGlobal() {return u.lockHeld(UPLOAD_LOCK_NAME)}
export function isUploadingLocal() {return !!os.procByName(`upload`)}

cmdUpload.cmd = `upload`
cmdUpload.desc = function cmdUploadDesc() {
  return [
    `upload runs to the cloud`,
    `; requires FS access (run `, os.BtnCmdWithHelp(`init`), ` once)`,
    ` and authentication (run `, os.BtnCmdWithHelp(`auth`), ` once)`,
  ]
}
cmdUpload.help = function cmdUploadHelp() {
  return u.LogParagraphs(
    cmdUpload.desc(),
    [
      `upload is invoked `,
      E(`b`, {}, `automatically`),
      ` after running `,
      os.BtnCmdWithHelp(`init`),
      ` and `,
      os.BtnCmdWithHelp(`auth`),
      ` in any order; you generally don't need to run it manually`,
    ],
    `usage:`,
    u.LogLines(
      `upload all runs:`,
      [`  `, os.BtnCmd(`upload /`)],
    ),
    u.LogLines(
      `upload latest run:`,
      [`  `, os.BtnCmd(`upload latest`)],
    ),
    u.LogLines(
      `upload one arbitrary run:`,
      `  upload <run_dir>`,
    ),
    u.LogLines(
      `upload one arbitrary round:`,
      `  upload <run_dir>/<round_file>`,
    ),
    u.LogLines(
      `flags:`,
      [`  `, ui.BtnPromptAppend(`upload`, `-p`), ` -- persistent mode`],
      [`  `, ui.BtnPromptAppend(`upload`, `-q`), ` -- quiet mode, minimal logging`],
    ),
    `the upload is idempotent, which means no duplicates; for each run, we upload only one of each round; re-running the command is safe and intended`,
    [`tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse local runs`],
    [`tip: use `, os.BtnCmdWithHelp(`ls -c`), ` to browse cloud runs`],
  )
}

export async function cmdUpload(proc) {
  const args = a.tail(u.splitCliArgs(proc.args))
  const persistent = u.arrRemoved(args, `-p`)
  const quiet = u.arrRemoved(args, `-q`)
  const force = u.arrRemoved(args, `-f`)
  const path = args[0]

  if (!path) {
    return u.LogParagraphs(`missing upload path`, os.cmdHelpDetailed(cmdUpload))
  }
  if (args.length > 1) {
    return u.LogParagraphs(`too many inputs`, os.cmdHelpDetailed(cmdUpload))
  }
  if (isUploadingLocal()) return `[upload] already running`

  proc.desc = `acquiring lock`
  let unlock = await u.lockOpt(UPLOAD_LOCK_NAME)
  const {sig} = proc

  if (!unlock) {
    if (!persistent) return `[upload] another process has a lock on uploading`

    const start = Date.now()
    u.log.verb(`[upload] another process has a lock on uploading, waiting until it stops`)
    proc.desc = `waiting for another "upload" process`
    unlock = await u.lock(sig, UPLOAD_LOCK_NAME)
    const end = Date.now()

    u.log.verb(`[upload] acquired lock from another process after ${end - start}ms, proceeding to upload`)
  }

  proc.desc = `uploading backups to the cloud`
  try {return await cmdUploadUnsync({sig, path, quiet, persistent, force})}
  finally {unlock()}
}

export async function cmdUploadUnsync({sig, path: srcPath, quiet, persistent, force}) {
  u.reqSig(sig)
  a.reqValidStr(srcPath)
  a.optBool(quiet)
  a.optBool(persistent)
  a.optBool(force)

  const root = await fs.reqHistoryDir(sig)
  const [_, handle, path] = await fs.handleAtPathMagic(sig, root, srcPath)

  const userId = au.reqUserId()
  const state = a.vac(!quiet) && o.obs({
    done: false,
    status: ``,
    runsChecked: 0,
    roundsChecked: 0,
    roundsUploaded: 0,
  })

  if (state) {
    if (fs.isFile(handle)) {
      u.log.info(new FileUploadProgress(path, state))
    }
    else {
      u.log.info(new DirUploadProgress(path || `/`, state))
    }
  }
  if (!persistent) return cmdUploadStep({sig, root, path, userId, state, force})

  let errs = 0
  while (!sig.aborted) {
    try {
      return await cmdUploadStep({sig, root, path, userId, state, force})
    }
    catch (err) {
      if (u.errIs(err, u.isErrAbort)) return
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

async function cmdUploadStep({sig, root, path, userId, state, force}) {
  u.reqSig(sig)
  a.reqStr(path)
  a.reqValidStr(userId)
  a.optObj(state)
  a.optBool(force)

  const segs = u.paths.split(path)
  if (!segs.length) {
    if (state) state.status = `uploading all runs`
    for (const dir of await fs.readRunsAsc(sig, root)) {
      await uploadRun({sig, dir, userId, state, force})
    }
    uploadDone(state)
    return
  }

  const dir = await fs.getDirectoryHandle(sig, root, segs.shift())
  if (!segs.length) {
    await uploadRun({sig, dir, userId, state, force})
    uploadDone(state)
    return
  }

  if (segs.length !== 1) {
    u.log.err(`[upload] unsupported path ${a.show(path)}`)
    return os.cmdHelpDetailed(cmdUpload)
  }

  const file = await fs.getFileHandle(sig, dir, segs.shift())
  await uploadRound({sig, file, runName: dir.name, userId, state, force})
  uploadDone(state)
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

  for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
    await uploadRound({sig, file, runName, userId, state, force})
  }
}

export async function uploadRound({sig, file, runName, userId, state, force}) {
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

  const roundNum = u.toIntOpt(file.name)
  if (!roundNum) {
    state.status = `skipping round ${a.show(path)} with round_num ${a.show(roundNum)}`
    return
  }

  const round = await fs.readDecodeGameFile(sig, file)
  const roundNumFromData = a.reqInt(round.RoundIndex)
  if (roundNum !== roundNumFromData) {
    u.log.err(`data inconsistency: file ${a.show(path)} indicates round_num ${a.show(roundNum)} in the name, but has round_num ${a.show(roundNumFromData)} in the data; skipping upload`)
    return
  }

  if (round.tabularius_uploaded_at && !force) {
    if (state) state.roundsChecked++
    return
  }

  const [runNum, runMs] = s.splitRunName(runName)
  s.roundMigrated({round, userId, runNum, runMs})
  round.tabularius_uploaded_at = Date.now()

  const jsonStr = JSON.stringify(round)
  const gzipByteArr = await u.str_to_gzipByteArr(jsonStr)
  const fileContentGdStr = u.byteArr_to_base64Str(gzipByteArr)
  if (state) state.status = `uploading ${a.show(path)}`

  try {
    const isGzip = u.QUERY.get(`upload_mode`) !== `json`
    const body = isGzip ? gzipByteArr : jsonStr
    const info = await apiUploadRound(sig, {body, isGzip})
    if (info?.redundant) {
      u.log.info(`server: skipped redundant upload of ${a.show(path)}`)
    }
    else if (u.LOG_VERBOSE && info?.facts) {
      u.log.info(`uploaded ${a.show(path)}: ${a.show(info.facts)} facts`)
    }
  }
  catch (err) {
    if (state) state.status = `unable to upload ${a.show(path)}, see error`
    throw err
  }
  if (state) state.roundsUploaded++

  /*
  Use a background signal to suppress cancelation, to avoid double upload if the
  command is killed between uploading and writing the file. The desync is still
  possible if the browser tab is killed at this point.
  */
  await fs.writeFile(u.sig, file, fileContentGdStr, path)
  if (state) state.roundsChecked++
}

function uploadDone(state) {
  if (!a.optObj(state)) return
  state.done = true
  state.status = `done`
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

    E(this, {},
      `[upload] `, (done ? `uploaded` : `uploading`), ` `, a.show(path),
      u.joinLines(
        `: `,
        `  status: ${status}`,
        `  runs checked: ${runsChecked}`,
        `  rounds checked: ${roundsChecked}`,
        `  rounds uploaded: ${roundsUploaded}`,
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

// TODO consolidate with `optStartUploadAfterInit` and `optStartUploadAfterAuth`.
export function recommendAuthIfNeededOrRunUpload() {
  if (au.isAuthed()) return os.runCmd(`upload -p /`)
  return recommendAuth()
}

// TODO consolidate with `recommendAuthIfNeededOrRunUpload` and `optStartUploadAfterAuth`.
export function optStartUploadAfterInit() {
  if (au.isAuthed()) return au.optStartUploadAfterAuth()
  return recommendAuth()
}

export function recommendAuth() {
  u.log.info(`recommended next step: run `, os.BtnCmdWithHelp(`auth`))
}
