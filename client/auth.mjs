import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'

import * as self from './auth.mjs'
const tar = window.tabularius ??= a.Emp()
tar.au = self
a.patch(window, tar)

export const STATE = o.obs({userId: undefined})
let PUB_KEY_BYTE_ARR = undefined
let SEC_KEY_BYTE_ARR = undefined
const STORAGE_KEY_PUB_KEY = `tabularius.pub_key`
const STORAGE_KEY_SEC_KEY = `tabularius.sec_key`

loadedAuthKeys()

cmdAuth.cmd = `auth`
cmdAuth.desc =`login to enable cloud backups, or logout`
cmdAuth.help = function cmdAuthHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdAuth.desc),
    `enter a passphrase or password to authenticate`,
    u.LogLines(
      `easy and anonymous:`,
      `* no signup`,
      `* no email`,
      `* no 3rd party services`,
      `* no personal information requested`,
    ),
    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`auth`), `        -- make credentials`],
      [`  `, os.BtnCmd(`auth logout`), ` -- clear credentials`],
    ),
    [`status: `, new AuthStatusMini()],
  )
}

export async function cmdAuth({sig, args}) {
  const inps = u.splitCliArgs(u.stripPreSpaced(args, cmdAuth.cmd))

  if (inps.length > 1) {
    u.log.err(`too many inputs in `, ui.BtnPromptReplace({val: args}))
    return os.cmdHelpDetailed(cmdAuth)
  }

  const mode = inps[0]
  if (mode && mode !== `logout`) {
    u.log.err(
      `unrecognized auth mode `, a.show(mode), ` in `,
      ui.BtnPromptReplace({val: args}),
    )
    return os.cmdHelpDetailed(cmdAuth)
  }

  const se = await import(`./setup.mjs`)
  try {
    if (mode === `logout`) return authLogout()
    if (isAuthed()) return new AuthStatusMini()
    return await authLogin(sig)
  }
  finally {se.updateSetupFlowMsg(true)}
}

export async function authLogin(sig) {
  const wordlist = await initWordlistOpt()
  const suggs = u.randomSamples(wordlist, 3)

  u.log.info(authInstructions(suggs))
  const pass = await readPassFromPrompt(sig)
  if (!pass) return `[auth] canceled`

  const seed = await u.pass_to_seedArrBuf(pass)
  const {publicKey, secretKey} = u.seedToKeyPair(new Uint8Array(seed))
  const pubKeyStr = pubKeyEncode(publicKey)
  const secKeyStr = secKeyEncode(secretKey)

  {
    const dec = pubKeyDecode(pubKeyStr)
    if (!isByteArrEq(dec, publicKey)) {
      throw Error(roundTripErrMsg(`public key`))
    }
  }

  {
    const dec = secKeyDecode(secKeyStr)
    if (!isByteArrEq(dec, secretKey)) {
      throw Error(roundTripErrMsg(`secret key`))
    }
  }

  PUB_KEY_BYTE_ARR = publicKey
  SEC_KEY_BYTE_ARR = secretKey
  STATE.userId = pubKeyStr

  u.storageSet(sessionStorage, STORAGE_KEY_PUB_KEY, pubKeyStr)
  u.storageSet(localStorage, STORAGE_KEY_PUB_KEY, pubKeyStr)
  u.storageSet(sessionStorage, STORAGE_KEY_SEC_KEY, secKeyStr)
  u.storageSet(localStorage, STORAGE_KEY_SEC_KEY, secKeyStr)

  uploadOpt().catch(u.logErr)
  return AuthedAs(pubKeyStr)
}

export function authLogout() {
  if (!isAuthed()) return `not currently authed`

  PUB_KEY_BYTE_ARR = undefined
  SEC_KEY_BYTE_ARR = undefined
  STATE.userId = undefined

  u.storageSet(sessionStorage, STORAGE_KEY_PUB_KEY)
  u.storageSet(localStorage, STORAGE_KEY_PUB_KEY)
  u.storageSet(sessionStorage, STORAGE_KEY_SEC_KEY)
  u.storageSet(localStorage, STORAGE_KEY_SEC_KEY)

  os.procKillOpt(`upload`)
  return `logged out successfully`
}

function authInstructions(suggs) {
  return u.LogParagraphs(
    `type your passphrase or password or press Esc to cancel`,
    [
      E(`b`, {}, `note:`),
      ` if you use `,
      E(`em`, {}, `exactly`),
      ` the same pass as someone else, both of you will have the same user id; if you wish to avoid that, make it unique; consider using your browser's password manager to generate one`,
    ],
    [
      E(`b`, {}, `recommendation:`),
      ` write down your pass, and/or use your browser's password manager to save it; using a different pass would split your run history between the accounts`,
    ],
    a.vac(suggs?.length) && [
      `sample passphrase: `,
      ui.BtnPromptReplace({val: suggs.join(` `)}),
    ],
  )
}

function readPassFromPrompt(sig) {
  const input = ui.PROMPT_INPUT
  const unlisten0 = u.listenEvent(sig, `abort`, onAbort, {once: true})
  const unlisten1 = u.listenEvent(input, `submit_pass`, onSubmit)
  const unlisten2 = u.listenEvent(input, `disable_pass_mode`, onDisable, {once: true})
  const {promise, resolve} = Promise.withResolvers()
  let count = 0
  let prev = ``

  input.enablePassMode()
  return promise

  function onAbort() {
    unlisten()
    input.disablePassMode()
    resolve()
  }

  function onDisable() {unlisten(), resolve()}

  function onSubmit() {
    const text = a.reqStr(input.value)
    if (!text) return

    if (text !== text.trim()) {
      u.log.info(`passphrase or password must not have leading or trailing whitespace`)
      return
    }

    const LEN_MIN = 8
    if (u.strLenUni(text) < LEN_MIN) {
      u.log.info(`passphrase or password must be at least `, LEN_MIN, ` characters long`)
      return
    }

    if (text.includes(`  `)) {
      u.log.info(`passphrase or password contains two spaces in a row; assuming this was a typo`)
      return
    }

    if (!count) {
      prev = text
      count++
      u.log.info(`passphrase or password received; type it once more to confirm`)
      input.value = ``
      return
    }

    if (text === prev) {
      u.log.info(`success: passphrase or password matched previous input`)
      unlisten()
      input.disablePassMode()
      resolve(text)
      return
    }

    prev = ``
    count = 0
    u.log.info(`mismatch with previous input; please type again`)
    input.value = ``
  }

  function unlisten() {unlisten0(), unlisten1(), unlisten2()}
}

export function reqUserId() {
  const id = STATE.userId
  if (id) return id
  throw new u.ErrLog(
    `auth required; run the `, os.BtnCmdWithHelp(`auth`), ` command`,
  )
}

export function authHeaderOpt() {
  return u.authHeaderOpt(PUB_KEY_BYTE_ARR, SEC_KEY_BYTE_ARR)
}

export function authHeadersOpt() {
  return u.authHeadersOpt(PUB_KEY_BYTE_ARR, SEC_KEY_BYTE_ARR)
}

export function isAuthed() {
  return !!STATE.userId && !!PUB_KEY_BYTE_ARR && !!SEC_KEY_BYTE_ARR
}

export function isAuthedOrLoadedAuthKeys() {
  return isAuthed() || loadedAuthKeys()
}

export function loadedAuthKeys() {
  try {
    const pubKeyStr = loadPubKey()
    const secKeyStr = loadSecKey()
    if (!(pubKeyStr && secKeyStr)) return false

    const publicKey = pubKeyDecode(pubKeyStr)
    const secretKey = secKeyDecode(secKeyStr)

    PUB_KEY_BYTE_ARR = publicKey
    SEC_KEY_BYTE_ARR = secretKey
    STATE.userId = pubKeyStr
    return true
  }
  catch (err) {
    u.log.err(`unable to load auth keys: `, err)
    return false
  }
}

function loadPubKey() {
  return (
    sessionStorage.getItem(STORAGE_KEY_PUB_KEY) ??
    localStorage.getItem(STORAGE_KEY_PUB_KEY)
  )
}

function loadSecKey() {
  return (
    sessionStorage.getItem(STORAGE_KEY_SEC_KEY) ??
    localStorage.getItem(STORAGE_KEY_SEC_KEY)
  )
}

export class AuthStatusMini extends u.ReacElem {
  run() {
    const id = STATE.userId
    E(this, {}, id ? AuthedAs(id) : `not authed`)
  }
}

export class AuthStatus extends u.ReacElem {
  run() {
    const id = STATE.userId
    E(this, {},
      id
      ? AuthedAs(id)
      : [`not authed; run `, os.BtnCmdWithHelp(`auth`), ` to authenticate`]
    )
  }
}

function AuthedAs(id) {
  return [
    `authed as `,
    E(`span`, {class: `break-all`}, a.reqValidStr(id)),
    ` `, u.BtnClip(id),
  ]
}

function pubKeyEncode(src) {return u.byteArr_to_hexStr(src)}
function pubKeyDecode(src) {return u.hexStr_to_byteArr(src)}
function secKeyEncode(src) {return u.byteArr_to_base64Str(src)}
function secKeyDecode(src) {return u.base64Str_to_byteArr(src)}

export let WORDLIST

export function initWordlistOpt() {return initWordlist().catch(wordlistInitErr)}

export async function initWordlist() {
  if (WORDLIST) return WORDLIST

  const text = new Text(`loading wordlist...`)
  u.log.info(text)

  try {
    const src = await u.fetchText(new URL(`wordlist.txt`, import.meta.url))
    text.textContent += ` loaded`
    return WORDLIST = a.lines(src)
  }
  catch (err) {
    text.remove()
    throw err
  }
}

function wordlistInitErr(err) {u.log.err(`unable to init wordlist: `, err)}

function isByteArrEq(one, two) {
  a.reqInst(one, Uint8Array)
  a.reqInst(two, Uint8Array)
  if (one.length !== two.length) return false
  let ind = -1
  while (++ind < one.length) if (one[ind] !== two[ind]) return false
  return true
}

function roundTripErrMsg(type) {
  return `internal: a roundtrip encoding-decoding of the ${a.reqValidStr(type)} produced a different result, which breaks authentication; please report this error on GitHub or Discord`
}

export async function listDirsFiles(sig, path) {
  u.reqSig(sig)
  path = u.paths.cleanTop(a.laxStr(path))
  try {
    const entry = await apiLs(sig, u.paths.join(reqUserId(), path))
    if (!entry) return `cloud file or dir ${a.show(path)} not found`
    return fs.LsEntry({...entry, path, cloud: true})
  }
  catch (err) {
    throw Error(`unable to list cloud files: ${err}`, {cause: err})
  }
}

export function apiLs(sig, path) {
  const url = u.paths.join(u.API_URL, `ls`, a.laxStr(path))
  const opt = {signal: u.reqSig(sig)}
  return u.fetchJson(url, opt)
}

async function uploadOpt() {
  const up = await import(`./upload.mjs`)
  return up.uploadStartOpt()
}
