/*
TODO: make all Firebase features optional. Currently if the scripts fail to
load, our app fails to start. Which is very bad for users in places where
Google is blocked.

API: https://firebase.google.com/docs/reference/js
*/
import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as fb from 'firebase/firebase-app.js'
import * as fba from 'firebase/firebase-auth.js'
import * as fbs from 'firebase/firebase-firestore.js'
import * as fbf from 'firebase/firebase-functions.js'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as fs from './fs.mjs'
import * as s from '../funs/schema.mjs'

import * as self from './fb.mjs'
const tar = window.tabularius ??= a.Emp()
tar.fb = self
tar.lib ??= a.Emp()
tar.lib.fb = fb
tar.lib.fba = fba
tar.lib.fbs = fbs
tar.lib.fbf = fbf
a.patch(window, tar)

/*
Further reading:

  https://firebase.google.com/docs/web/setup/
  https://firebase.google.com/docs/web/setup/#available-libraries
*/
export const fbConf = await u.fetchJson(new URL(`../firebase/firebase.json`, import.meta.url))
export const fbApp = fb.initializeApp(fbConf)
export const fbAuth = fba.getAuth(fbApp)
export const fbStore = fbs.getFirestore(fbApp)
export const fbFun = fbf.getFunctions(fbApp)
fbConnectEmulatorSuite()

export const fbObs = o.obs({
  user: undefined,
  known: false
})

fba.onAuthStateChanged(fbAuth, function onAuthChange(user) {
  fbObs.user = user
  fbObs.known = true

  if (u.LOG_VERBOSE) {
    u.log.verb(`auth state changed, see the browser devtools console`)
    console.log(`current user:`, user)
  }
})

cmdAuth.cmd = `auth`
cmdAuth.desc = `login to enable cloud backups, or logout to disable`
cmdAuth.help = u.joinParagraphs(
  `[auth]: ` + cmdAuth.desc,
  u.joinLines(
    `supported modes:`,
    `  auth google`,
    `  auth logout`,
  ),
  u.joinLines(
    `Q: why authentication?`,
    `A: to isolate cloud backups per user, keeping them safe from tampering`,
  ),
  `this app does not use or store any personal information (name, email, etc.)`,
)

export function cmdAuth({args}) {
  args = u.splitCliArgs(args)
  if (args.length !== 2) return cmdAuth.help
  const mode = a.reqValidStr(args[1])
  if (mode === `google`) return loginGoogle()
  if (mode === `logout`) return logout()
  throw `unknown auth mode ${a.show(mode)}`
}

export function authStatus() {
  const {user, known} = fbObs
  if (!known) return `auth: unknown, waiting for response`
  if (!user) return `auth: unauthenticated, run "auth" to login`
  return `auth: logged in as ${user.uid}`
}

export function reqFbUserId() {
  const id = fbObs.user?.uid
  if (id) return id
  throw `authentication required; run the "auth" command`
}

cmdCls.cmd = `cls`
cmdCls.desc = `list cloud runs; requires authentication (run "auth" once)`
cmdCls.help = u.joinParagraphs(
  `[cls]: ` + cmdCls.desc,
  u.joinLines(
    `usage:`,
    `  cls`,
    `  cls <run_id>`,
  ),
  `tip: use "upload" to upload runs to the cloud`,
)

export function cmdCls({sig, args}) {
  args = u.splitCliArgs(args)
  if (args.length > 2) return cmdCls.help
  const runId = a.optStr(args[1])
  const userId = reqFbUserId()
  if (runId) return listCloudRounds(sig, runId, userId)
  return listCloudRuns(sig, userId)
}

async function listCloudRuns(sig, userId) {
  a.reqValidStr(userId)

  try {
    const docs = await fbDocs(sig, fbs.query(
      fbs.collection(fbStore, s.COLL_RUNS),
      fbs.where(`userId`, `==`, userId),
    ))
    const ids = a.map(docs, getId)

    if (!ids.length) {
      return `no cloud runs found; use "upload" to upload runs`
    }
    return u.joinLines(`cloud run ids:`, ...a.map(ids, u.indent))
  }
  catch (err) {
    throw Error(`unable to list cloud runs: ${err}`, {cause: err})
  }
}

async function listCloudRounds(sig, runId, userId) {
  a.reqValidStr(runId)
  a.reqValidStr(userId)

  try {
    const docs = await fbDocs(sig, fbs.query(
      fbs.collection(fbStore, s.COLL_RUN_ROUNDS),
      fbs.and(
        fbs.where(`userId`, `==`, userId),
        fbs.where(`runId`, `==`, runId),
      )
    ))
    const ids = a.map(docs, getId)

    if (!ids.length) {
      return `no rounds found for run ${runId}; use "upload" to upload runs`
    }

    return u.joinLines(`round ids in run ${runId}:`, ...a.map(ids, u.indent))
  }
  catch (err) {
    throw Error(`unable to list round ids in run ${runId}: ${err}`, {cause: err})
  }
}

export async function fbDocs(sig, query) {
  return (await u.wait(sig, fbs.getDocs(query))).docs
}

export async function fbDocDatas(sig, query) {
  return a.map((await fbDocs(sig, query)), docData)
}

function docData(src) {return src.data()}
function getId(src) {return src.id}

cmdUpload.cmd = `upload`
cmdUpload.desc = `uploads the given round, run, or all runs, to a cloud database; requires FS access (run "init" once) and authentication (run "auth" once)`
cmdUpload.help = u.joinParagraphs(
  `[upload] this command ` + cmdUpload.desc,
  `usage:`,
  u.joinLines(
    `upload all runs:`,
    `  upload /`,
  ),
  u.joinLines(
    `upload one run:`,
    `  upload <run_id>`,
  ),
  u.joinLines(
    `upload one round:`,
    `  upload <run_id>/<round_id>`,
  ),
  `the upload is idempotent, which means no duplicates; for each run, we upload only one of each round; re-running the command is safe and intended`,
  `tip: use "ls" to browse runs`,
)

export async function cmdUpload({sig, args}) {
  args = u.splitCliArgs(args)
  if (args.length !== 2) return cmdUpload.help

  const root = await fs.reqHistoryDir(sig)
  const userId = reqFbUserId()
  const path = u.paths.clean(args[1])
  const segs = u.paths.split(path)

  const obs = o.obs({
    status: ``,
    runsChecked: 0,
    roundsChecked: 0,
    roundsUploaded: 0,
  })

  u.log.info(new UploadProgress(obs))

  if (!segs.length) {
    obs.status = `uploading all runs`
    for await (const dir of fs.readRunsAsc(sig, root)) {
      await uploadRun(sig, dir, userId, obs)
    }
    obs.status = `done`
    return
  }

  const dir = await fs.getDirectoryHandle(sig, root, segs.shift())
  if (!segs.length) {
    await uploadRun(sig, dir, userId, obs)
    obs.status = `done`
    return
  }

  if (segs.length !== 1) {
    u.log.err(`[upload] unsupported path ${a.show(path)}`)
    return cmdUpload.help
  }

  const file = await fs.getFileHandle(sig, dir, segs.shift())
  await uploadRound(sig, file, dir.name, userId, obs)
  obs.status = `done`
}

export async function uploadRun(sig, dir, userId, obs) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  const runName = dir.name
  obs.status = `uploading run ${runName}`

  for (const file of await fs.readRunRoundHandlesAsc(sig, dir)) {
    await uploadRound(sig, file, runName, userId, obs)
  }
  obs.runsChecked++
}

// TODO see if the Firestore client JS supports signals for cancelation
// (gpt-4o thinks not).
export async function uploadRound(sig, file, runName, userId, obs) {
  a.reqInst(file, FileSystemFileHandle)
  a.reqValidStr(runName)
  a.reqValidStr(userId)

  const path = u.paths.join(runName, file.name)
  obs.status = `checking round ${a.show(path)}`

  const round = await fs.jsonDecompressDecodeFile(sig, file)
  if (round.tabularius_roundId) {
    obs.roundsChecked++
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
    obs.status = `uploading ${a.show(path)}`

    try {
      const ref = fbs.doc(fbStore, s.COLL_ROUND_SNAPS, roundId)
      await fbs.setDoc(ref, round, {merge: true})
    }
    catch (err) {
      obs.status = `unable to upload ${a.show(path)}, see the error`
      throw err
    }

    obs.roundsUploaded++
    await fs.jsonCompressEncodeFile(sig, file, round)
  }

  obs.roundsChecked++
}

class UploadProgress extends u.ReacElem {
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

/*
In our case, anon login would be a gotcha for the user. If you login, logout,
and again login, you get a new user id. Since we indend to segregate backups by
user id, this would make earlier backups appear as if they belong to another
user, and when you fetch the backups for the current user, the old ones would
be missing.

  export async function loginAnon() {
    try {
      await fba.signInAnonymously(auth)
      u.log.info(`logged in anonymously`)
    }
    catch (err) {
      u.log.err(`unable to login anonymously: `, err)
    }
  }
*/

export async function loginGoogle() {
  try {
    const provider = new fba.GoogleAuthProvider()
    await fba.signInWithPopup(fbAuth, provider)
    u.log.info(`logged in with Google`)
  }
  catch (err) {
    u.log.err(`unable to login with Google: `, err)
  }
}

export async function logout() {
  try {
    await fba.signOut(fbAuth)
    u.log.info(`logged out`)
  }
  catch (err) {
    u.log.err(`unable to logout: `, err)
  }
}

function fbConnectEmulatorSuite() {
  const url = new URL(window.location)
  if (url.hostname !== `localhost`) return
  if (url.searchParams.get(`emulate`) !== `true`) return

  try {
    url.port = 9835
    fba.connectAuthEmulator(fbAuth, url.toString(), {disableWarnings: true})
    fbs.connectFirestoreEmulator(fbStore, url.hostname, 9836)
    fbf.connectFunctionsEmulator(fbFun, url.hostname, 9837)
    u.log.verb(`connected FB emulator suite`)
  }
  catch (err) {
    u.log.err(`unable to connect FB emulator suite: `, err)
  }
}

export function fbCall(name, inp) {
  a.reqValidStr(name)

  /*
  The FB client library performs custom conversion of the input before
  converting to JSON, in the name of using the ISO encoding for dates,
  which happens to be the default anyway. What was the point? Anyway,
  the conversion is buggy. It calls `.hasOwnProperty` on every non-array
  object, forgetting about null-prototype objects, which we use.

  The clowns also forgot about the replacer parameter in `JSON.stringify`,
  which works perfectly with null-prototype objects. It doesn't invoke
  the replacer if the entire input is a date, but that's easy to fix.

  This encoding-decoding converts null-prototype objects to plain ones.
  Annoying but not our bottleneck.
  */
  inp = a.jsonDecode(a.jsonEncode(inp))

  return fbf.httpsCallable(fbFun, name)(inp)
}
