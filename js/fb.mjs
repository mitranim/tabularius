/*
Caution: we should import this module optionally, and handle import errors.
Our cloud backups and cloud analytics rely on Google servers, which are
unavailable in locations which block Google, such as China, or which are
blocked by Google, such as parts of Ukraine and possibly Russia, at the time
of writing.

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
import * as os from './os.mjs'
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

export function nextUser(sig) {
  u.reqSig(sig)
  if (fbObs.known) return fbObs.user

  return u.wait(sig, new Promise(function initNextUser(done) {
    const unsub = fba.onAuthStateChanged(fbAuth, function fbAuthOnChange(user) {
      unsub()
      done(user)
    })
  }))
}

cmdAuth.cmd = `auth`
cmdAuth.desc = `login to enable cloud backups, or logout to disable`
cmdAuth.help = function cmdAuthHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdAuth.desc),
    u.LogLines(
      `supported modes:`,
      [`  `, os.BtnCmd(`auth google`)],
      [`  `, os.BtnCmd(`auth logout`)],
    ),
    new AuthStatus(),
    u.LogLines(
      `Q: why authentication?`,
      `A: to isolate cloud backups per user, preventing tampering.`,
    ),
    [`this app `, E(`b`, {}, `does not use or store`), ` any personal information`],
  )
}

export function cmdAuth({sig, args}) {
  args = u.splitCliArgs(args)
  if (args.length !== 2) return os.cmdHelpDetailed(cmdAuth)
  const mode = a.reqValidStr(args[1])
  if (mode === `google`) return loginGoogle(sig)
  if (mode === `logout`) return logout(sig)
  throw `unknown auth mode ${a.show(mode)}`
}

export class AuthStatus extends u.ReacElem {
  run() {E(this, {}, authStatus())}
}

export function authStatus() {
  const {user, known} = fbObs
  if (!known) return `unknown, waiting for response`
  if (!user) return [`unauthenticated, run `, os.BtnCmdWithHelp(`auth`), ` to login`]
  return `logged in as ${user.uid}`
}

export function reqFbUserId() {
  const id = fbObs.user?.uid
  if (id) return id
  throw [`authentication required; run the `, os.BtnCmdWithHelp(`auth`), ` command`]
}

cmdCls.cmd = `cls`
cmdCls.desc = function cmdClsDesc() {
  return [
    `list cloud runs; requires authentication (run `,
    os.BtnCmdWithHelp(`auth`),
    ` once)`,
  ]
}
cmdCls.help = function cmdClsHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdCls.desc),
    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`cls`)],
      `  cls <run_id>`,
    ),
    [`tip: use `, os.BtnCmdWithHelp(`upload`), ` to upload runs to the cloud`],
  )
}

export function cmdCls({sig, args}) {
  args = u.splitCliArgs(args)
  if (args.length > 2) return os.cmdHelpDetailed(cmdCls)
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
      return [
        `no cloud runs found; run `,
        os.BtnCmdWithHelp(`upload`),
        ` to upload runs`,
      ]
    }

    return u.LogLines(
      `cloud run ids:`,
      ...a.map(ids, BtnCloudRun).map(u.indentChi),
    )
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
      return [
        `no rounds found for cloud run `, runId, `; run `,
        os.BtnCmdWithHelp(`upload`),
        ` to upload runs`,
      ]
    }

    return u.LogLines(
      `round ids in cloud run ${runId}:`,
      ...a.map(ids, BtnCloudRound).map(u.indentChi),
    )
  }
  catch (err) {
    throw Error(`unable to list round ids in cloud run ${runId}: ${err}`, {cause: err})
  }
}

function BtnCloudRun(val) {
  a.reqValidStr(val)
  return u.Btn(val, function onClickCloudRun() {
    u.copyToClipboard(val)
    u.log.info(`copied `, a.show(val), ` to clipboard`)
    os.runCmd(`cls ` + val)
  })
}

function BtnCloudRound(val) {
  a.reqValidStr(val)
  return u.Btn(val, function onClickCloudRound() {
    u.copyToClipboard(val)
    u.log.info(`copied `, a.show(val), ` to clipboard`)
  })
}

export async function fbDocs(sig, query) {
  return (await u.wait(sig, fbs.getDocs(query))).docs
}

export async function fbDocDatas(sig, query) {
  return a.map((await fbDocs(sig, query)), docData)
}

function docData(src) {return src.data()}
function getId(src) {return src.id}

/*
In our case, anon login would be a gotcha for the user. If you login, logout,
and again login, you get a new user id. Since we intend to segregate backups by
user id, this would make earlier backups appear as if they belong to another
user, and when you fetch the backups for the current user, the old ones would
be missing.

  export async function loginAnon(sig) {
    try {
      await fba.signInAnonymously(auth)
      u.log.info(`logged in anonymously`)
      u.optStartUploadAfterAuth(sig).catch(u.logErr)
    }
    catch (err) {
      u.log.err(`unable to login anonymously: `, err)
    }
  }
*/

export async function loginGoogle(sig) {
  try {
    const provider = new fba.GoogleAuthProvider()
    await fba.signInWithPopup(fbAuth, provider)
    u.log.info(`logged in with Google`)
    u.optStartUploadAfterAuth(sig).catch(u.logErr)
  }
  catch (err) {
    u.log.err(`unable to login with Google: `, err)
  }
}

export async function logout() {
  try {
    await fba.signOut(fbAuth)
    u.log.info(`logged out`)
    os.procKillOpt(`upload`)
  }
  catch (err) {
    u.log.err(`unable to logout: `, err)
  }
}

function fbConnectEmulatorSuite() {
  const url = new URL(window.location)
  if (url.hostname !== `localhost`) return
  if (u.urlQuery(url.search).get(`emulate`) !== `true`) return

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

// TODO dedup.
export function recommendAuthIfNeeded() {
  function onKnown(user) {
    if (user) return
    u.log.info(`recommended next step: run `, os.BtnCmdWithHelp(`auth`))
  }

  if (fbObs.known) {
    onKnown(fbObs.user)
    return
  }

  const unsub = fba.onAuthStateChanged(fbAuth, function onAuthChange(user) {
    unsub()
    onKnown(user)
  })
}

// TODO dedup.
export async function recommendAuthIfNeededOrRunUpload(sig) {
  const user = await nextUser(sig)

  if (!user) {
    recommendAuth()
    return
  }

  os.runCmd(`upload -p /`).catch(u.logErr)
}

export function recommendAuth() {
  u.log.info(`recommended next step: run `, os.BtnCmdWithHelp(`auth`))
}
