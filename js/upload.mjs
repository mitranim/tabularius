import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as fbs from 'firebase/firebase-firestore.js'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as fb from './fb.mjs'
import * as s from '../funs/schema.mjs'

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
      `  upload <run_id>`,
    ),
    u.LogLines(
      `upload one arbitrary round:`,
      `  upload <run_id>/<round_id>`,
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
  const args = u.splitCliArgs(proc.args)
  const persistent = u.arrRemoved(args, `-p`)
  const quiet = u.arrRemoved(args, `-q`)

  if (args.length !== 2) return os.cmdHelpDetailed(cmdUpload)
  if (isUploadingLocal()) return `already running`

  proc.desc = `acquiring lock`
  let unlock = await u.lockOpt(UPLOAD_LOCK_NAME)
  const {sig} = proc

  if (unlock) {
    if (!quiet) u.log.info(`[upload] starting`)
  }
  else {
    if (!persistent) return `another process has a lock on uploading`

    const start = Date.now()
    u.log.verb(`[upload] another process has a lock on uploading, waiting until it stops`)
    proc.desc = `waiting for another "upload" process`
    unlock = await u.lock(sig, UPLOAD_LOCK_NAME)
    const end = Date.now()

    u.log.verb(`[upload] acquired lock from another process after ${end - start}ms, proceeding to upload`)
  }

  proc.desc = `uploading backups to the cloud`
  try {return await cmdUploadUnsync({sig, path: args[1], quiet, persistent})}
  finally {unlock()}
}

export async function cmdUploadUnsync({sig, path, quiet, persistent}) {
  u.reqSig(sig)
  a.reqValidStr(path)
  a.optBool(quiet)
  a.optBool(persistent)

  const root = await fs.reqHistoryDir(sig)
  path = u.paths.clean(path)
  if (path === `latest`) path = await fs.findLatestRunId(sig, root)

  const userId = fb.reqFbUserId()
  const state = a.vac(!quiet) && o.obs({
    status: ``,
    runsChecked: 0,
    roundsChecked: 0,
    roundsUploaded: 0,
  })

  if (state) u.log.info(new UploadProgress(state))
  if (!persistent) return cmdUploadStep({sig, root, path, userId, state})

  let errs = 0
  while (!sig.aborted) {
    try {
      return await cmdUploadStep({sig, root, path, userId, state})
    }
    catch (err) {
      if (u.errIs(err, u.isErrAbort)) return
      errs++
      if (errs >= UPLOAD_MAX_ERRS) {
        throw Error(`unexpected error; reached max error count ${errs}, exiting: ${err}`, {cause: err})
      }
      const sleep = UPLOAD_RETRY_INTERVAL_MS
      u.log.err(`[upload] unexpected error (${errs} in a row), retrying after ${sleep}ms: `, err)
      if (!await a.after(sleep, sig)) return
    }
  }
}

async function cmdUploadStep({sig, root, path, userId, state}) {
  u.reqSig(sig)
  a.reqStr(path)
  a.reqValidStr(userId)
  a.optObj(state)

  const segs = u.paths.split(path)
  if (!segs.length) {
    if (state) state.status = `uploading all runs`
    for await (const dir of fs.readRunsAsc(sig, root)) {
      await uploadRun({sig, dir, userId, state})
    }
    if (state) state.status = `done`
    return
  }

  const dir = await fs.getDirectoryHandle(sig, root, segs.shift())
  if (!segs.length) {
    await uploadRun({sig, dir, userId, state})
    if (state) state.status = `done`
    return
  }

  if (segs.length !== 1) {
    u.log.err(`[upload] unsupported path ${a.show(path)}`)
    return os.cmdHelpDetailed(cmdUpload)
  }

  const file = await fs.getFileHandle(sig, dir, segs.shift())
  await uploadRound({sig, file, runName: dir.name, userId, state})
  if (state) state.status = `done`
}

export async function uploadRun({sig, dir, userId, state}) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  const runName = dir.name

  if (state) {
    state.status = `uploading run ${runName}`
    state.runsChecked++
  }

  for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
    await uploadRound({sig, file, runName, userId, state})
  }
}

export async function uploadRound({sig, file, runName, userId, state}) {
  a.reqInst(file, FileSystemFileHandle)
  a.reqValidStr(runName)
  a.reqValidStr(userId)

  const path = u.paths.join(runName, file.name)
  if (state) state.status = `checking round ${a.show(path)}`

  const round = await fs.jsonDecompressDecodeFile(sig, file)
  if (round.tabularius_roundId) {
    if (state) state.roundsChecked++
    return
  }

  const runId = s.makeRunId(userId, runName)
  const runNum = u.toIntReq(runName)
  const roundNum = a.reqInt(round.RoundIndex)
  const roundId = s.makeRoundId(runId, roundNum)

  if (a.vac([
    round.tabularius_userId  !== (round.tabularius_userId  = userId),
    round.tabularius_runId   !== (round.tabularius_runId   = runId),
    round.tabularius_runNum  !== (round.tabularius_runNum  = runNum),
    round.tabularius_roundId !== (round.tabularius_roundId = roundId),
  ])) {
    if (state) state.status = `uploading ${a.show(path)}`

    try {
      const ref = fbs.doc(fb.fbStore, s.COLL_ROUND_SNAPS, roundId)

      /*
      We'd like to provide `sig` here, but at the time of writing, the FB client
      library supports it only for streaming requests, not for regular ones.
      */
      await fbs.setDoc(ref, round, {merge: true})
    }
    catch (err) {
      if (state) state.status = `unable to upload ${a.show(path)}, see the error`
      throw err
    }

    if (state) state.roundsUploaded++

    /*
    We suppress cancelation here to avoid double upload if the command is killed
    between uploading and writing the file. It's still possible in principle if
    the browser tab is killed at this point.
    */
    await fs.jsonCompressEncodeFile(u.sig, file, round)
  }

  if (state) state.roundsChecked++
}

export class UploadProgress extends u.ReacElem {
  constructor(obs) {super().obs = obs}

  run() {
    const {status, runsChecked, roundsChecked, roundsUploaded} = this.obs
    E(this, {}, `upload progress:
  status: ${status}
  runs checked: ${runsChecked}
  rounds checked: ${roundsChecked}
  rounds uploaded: ${roundsUploaded}
`)
  }
}
