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
export const conf = await u.fetchJson(new URL(`../firebase/firebase.json`, import.meta.url))
export const app = fb.initializeApp(conf)
export const auth = fba.getAuth(app)
export const store = fbs.getFirestore(app)
export const funs = fbf.getFunctions(app)
fbConnectEmulatorSuite()

export const state = o.obs({
  user: undefined,
  known: false
})

fba.onAuthStateChanged(auth, function onAuthChange(user) {
  state.user = user
  state.known = true

  if (u.LOG_VERBOSE) {
    u.log.verb(`auth state changed, see the browser devtools console`)
    console.log(`current user:`, user)
  }
})

export function nextUser(sig) {
  u.reqSig(sig)
  if (state.known) return state.user

  return u.wait(sig, new Promise(function nextUserInit(done) {
    const unsub = fba.onAuthStateChanged(auth, function fbAuthOnChange(user) {
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
  throw Error(`unknown auth mode ${a.show(mode)}`)
}

export class AuthStatus extends u.ReacElem {
  run() {E(this, {}, authStatus())}
}

export function authStatus() {
  const {user, known} = state
  if (!known) return `unknown, waiting for response`
  if (!user) return [`unauthenticated, run `, os.BtnCmdWithHelp(`auth`), ` to login`]
  return `logged in as ${user.uid}`
}

// TODO make async, use `nextUser`.
export function reqUserId() {
  const id = state.user?.uid
  if (id) return id
  throw new u.ErrLog(
    `authentication required; run the `, os.BtnCmdWithHelp(`auth`), ` command`,
  )
}

export function listRunsRounds({sig}, runId) {
  a.optStr(runId)
  const userId = reqUserId()
  if (!runId) return listRuns(sig, userId)
  return listRounds(sig, userId, runId)
}

export async function listRuns(sig, userId) {
  a.reqValidStr(userId)

  try {
    const ids = snapIds(await u.wait(sig, fbs.getDocs(fbs.query(
      fbs.collection(store, s.COLL_RUNS),
      fbs.where(`userId`, `==`, userId),
    ))))

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

export async function listRounds(sig, userId, runId) {
  a.reqValidStr(runId)
  a.reqValidStr(userId)

  try {
    const ids = snapIds(await u.wait(sig, fbs.getDocs(fbs.query(
      fbs.collection(store, s.COLL_RUN_ROUNDS),
      fbs.and(
        fbs.where(`userId`, `==`, userId),
        fbs.where(`runId`, `==`, runId),
      )
    ))))

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
    u.copyToClipboard(val).catch(u.logErr)
    u.log.info(`copied `, a.show(val), ` to clipboard`)
    os.runCmd(`ls -c ` + val).catch(u.logErr)
  })
}

function BtnCloudRound(val) {
  a.reqValidStr(val)
  return u.Btn(val, function onClickCloudRound() {
    u.copyToClipboard(val).catch(u.logErr)
    u.log.info(`copied `, a.show(val), ` to clipboard`)
  })
}

export function snapIds(src) {return a.map(src.docs, getId)}
export function snapDocs(src) {return a.map(src.docs, docData)}

function getId(src) {return src.id}
function docData(src) {return src.data()}

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
    await fba.signInWithPopup(auth, provider)
    u.log.info(`logged in with Google`)
    u.optStartUploadAfterAuth(sig).catch(u.logErr)
  }
  catch (err) {
    u.log.err(`unable to login with Google: `, err)
  }
}

export async function logout() {
  try {
    await fba.signOut(auth)
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
    fba.connectAuthEmulator(auth, url.toString(), {disableWarnings: true})
    fbs.connectFirestoreEmulator(store, url.hostname, 9836)
    fbf.connectFunctionsEmulator(funs, url.hostname, 9837)
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

  return fbf.httpsCallable(funs, name)(inp)
}

// TODO dedup.
export function recommendAuthIfNeeded() {
  function onKnown(user) {
    if (user) return
    u.log.info(`recommended next step: run `, os.BtnCmdWithHelp(`auth`))
  }

  if (state.known) {
    onKnown(state.user)
    return
  }

  const unsub = fba.onAuthStateChanged(auth, function onAuthChange(user) {
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

export function isDev() {return state.user?.email === `me@mitranim.com`}

export function decodeTimestamp(src) {
  if (!a.isValidStr(src)) return undefined
  src = Date.parse(src)
  return src ? fbs.Timestamp.fromMillis(src) : undefined
}
