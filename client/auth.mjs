import * as a from '@mitranim/js/all.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as ls from './ls.mjs'
import * as ui from './ui.mjs'

import * as self from './auth.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.au = self
a.patch(globalThis, namespace)

export const USER_ID = a.obsRef()
const STORAGE_KEY_PUB_KEY = `tabularius.pub_key`
const STORAGE_KEY_SEC_KEY = `tabularius.sec_key`

/*
Kept in RAM for generating auth headers for some API requests. The secret key
never leaves the client, and is used for creating signatures which prove
ownership of the public key. See the functions `authToken` and `auth`.
*/
let PUB_KEY_BYTE_ARR = undefined
let SEC_KEY_BYTE_ARR = undefined

loadedAuthKeys()

cmdAuth.cmd = `auth`
cmdAuth.desc =`login to enable cloud backups, or logout`
cmdAuth.help = function cmdAuthHelp() {
  return ui.LogParagraphs(
    u.callOpt(cmdAuth.desc),
    `enter a passphrase or password to authenticate`,
    ui.LogLines(
      `easy and anonymous:`,
      `  * no signup`,
      `  * no email`,
      `  * no 3rd party services`,
      `  * no personal information requested`,
    ),
    ui.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`auth`), `        -- make credentials`],
      [`  `, os.BtnCmd(`auth logout`), ` -- clear credentials`],
    ),
    [`status: `, authStatusMsgMini],
  )
}

export async function cmdAuth({sig, args}) {
  const inps = u.splitCliArgs(u.stripPreSpaced(args, cmdAuth.cmd))
  if (u.hasHelpFlag(inps)) return os.cmdHelpDetailed(cmdAuth)

  if (inps.length > 1) {
    ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace(args))
    return os.cmdHelpDetailed(cmdAuth)
  }

  const mode = inps[0]
  if (mode && mode !== `logout`) {
    ui.LOG.err(
      `unrecognized auth mode `, a.show(mode), ` in `,
      ui.BtnPromptReplace(args),
    )
    return os.cmdHelpDetailed(cmdAuth)
  }

  const se = await import(`./setup.mjs`)
  try {
    if (mode === `logout`) return authLogout()
    if (isAuthed()) return authStatusMsgMini
    return await authLogin(sig)
  }
  finally {se.updateSetupFlowMsg(true)}
}

export async function authLogin(sig) {
  const wordlist = await initWordlistOpt()
  const suggs = u.randomSamples(wordlist, 3)

  ui.LOG.info(authInstructions(suggs))
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
  a.reset(USER_ID, pubKeyStr)

  u.storagesSet(STORAGE_KEY_PUB_KEY, pubKeyStr)
  u.storagesSet(STORAGE_KEY_SEC_KEY, secKeyStr)

  uploadOpt().catch(ui.logErr)
  return AuthedAs(pubKeyStr)
}

export function authLogout() {
  if (!isAuthed()) return `not currently authed`

  PUB_KEY_BYTE_ARR = undefined
  SEC_KEY_BYTE_ARR = undefined
  a.reset(USER_ID)

  u.storagesSet(STORAGE_KEY_PUB_KEY)
  u.storagesSet(STORAGE_KEY_SEC_KEY)

  os.procKillOpt(`upload`)
  return `logged out successfully`
}

function authInstructions(suggs) {
  return ui.LogParagraphs(
    `type your passphrase or password or press Esc to cancel`,
    [
      E(`b`, {chi: `note:`}),
      ` if you use `,
      E(`em`, {chi: `exactly`}),
      ` the same pass as someone else, both of you will have the same user id; if you wish to avoid that, make it unique; consider using your browser's password manager to generate one`,
    ],
    [
      E(`b`, {chi: `recommendation:`}),
      ` write down your pass, and/or use your browser's password manager to save it; using a different pass would split your run history between the accounts`,
    ],
    a.vac(suggs?.length) && [
      `sample passphrase: `,
      ui.BtnPromptReplace(suggs.join(` `)),
    ],
  )
}

function readPassFromPrompt(sig) {
  const input = ui.PROMPT_INPUT
  const unlisten0 = a.eventListen({src: sig,   type: `abort`,             han: onAbort, opt: {once: true}})
  const unlisten1 = a.eventListen({src: input, type: `submit_pass`,       han: onSubmit})
  const unlisten2 = a.eventListen({src: input, type: `disable_pass_mode`, han: onDisable, opt: {once: true}})
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

  function onDisable() {
    unlisten()
    resolve()
  }

  function onSubmit() {
    const text = a.reqStr(input.value)
    if (!text) return

    if (text !== text.trim()) {
      ui.LOG.info(`passphrase or password must not have leading or trailing whitespace`)
      return
    }

    const LEN_MIN = 8
    if (u.strLenUni(text) < LEN_MIN) {
      ui.LOG.info(`passphrase or password must be at least `, LEN_MIN, ` characters long`)
      return
    }

    if (text.includes(`  `)) {
      ui.LOG.info(`passphrase or password contains two spaces in a row; assuming this was a typo`)
      return
    }

    if (!count) {
      prev = text
      count++
      ui.LOG.info(`passphrase or password received; type it once more to confirm`)
      input.value = ``
      return
    }

    if (text === prev) {
      ui.LOG.info(`success: passphrase or password matched previous input`)
      unlisten()
      input.disablePassMode()
      resolve(text)
      return
    }

    prev = ``
    count = 0
    ui.LOG.info(`mismatch with previous input; please type again`)
    input.value = ``
  }

  function unlisten() {
    unlisten0()
    unlisten1()
    unlisten2()
  }
}

export function reqUserId() {
  const id = a.deref(USER_ID)
  if (id) return id
  throw new ui.ErrLog(
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
  return !!a.deref(USER_ID) && !!PUB_KEY_BYTE_ARR && !!SEC_KEY_BYTE_ARR
}

export function isAuthedOrLoadedAuthKeys() {
  return isAuthed() || loadedAuthKeys()
}

export function loadedAuthKeys() {
  try {
    const pubKeyStr = u.storagesGet(STORAGE_KEY_PUB_KEY)
    const secKeyStr = u.storagesGet(STORAGE_KEY_SEC_KEY)
    if (!(pubKeyStr && secKeyStr)) return false

    const publicKey = pubKeyDecode(pubKeyStr)
    const secretKey = secKeyDecode(secKeyStr)

    PUB_KEY_BYTE_ARR = publicKey
    SEC_KEY_BYTE_ARR = secretKey
    a.reset(USER_ID, pubKeyStr)
    return true
  }
  catch (err) {
    ui.LOG.err(`unable to load auth keys: `, err)
    return false
  }
}

export function authStatusMsgMini() {
  const id = a.deref(USER_ID)
  if (id) return AuthedAs(id)
  return `not authed`
}

export function authStatusMsg() {
  const id = a.deref(USER_ID)
  if (id) return AuthedAs(id)
  return [`not authed; run `, os.BtnCmdWithHelp(`auth`), ` to authenticate`]
}

function AuthedAs(id) {
  return [
    `authed as `,
    E(`span`, {class: `break-all`, chi: a.reqValidStr(id)}),
    ` `, ui.BtnClip(id),
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
  ui.LOG.info(text)

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

function wordlistInitErr(err) {ui.LOG.err(`unable to init wordlist: `, err)}

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
  a.optStr(path)

  try {
    const entry = await apiLs(sig, path)
    if (!entry) return `cloud file or dir ${a.show(path)} not found`
    return ls.LsEntry({...entry, path, cloud: true})
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
