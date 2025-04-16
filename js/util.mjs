import * as a from '@mitranim/js/all.mjs'
import * as d from '@mitranim/js/dom.mjs'
import * as p from '@mitranim/js/prax.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as od from '@mitranim/js/obs_dom.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as fu from '../funs/util.mjs'
import * as tw from 'https://esm.sh/@twind/core@1.1.3'
import tp from 'https://esm.sh/@twind/preset-autoprefix@1.0.7'
import tt from 'https://esm.sh/@twind/preset-tailwind@1.1.4'
export * from '../funs/util.mjs'

import * as self from './util.mjs'
const tar = window.tabularius ??= a.Emp()
tar.u = self
tar.lib ??= a.Emp()
tar.lib.a = a
tar.lib.d = d
tar.lib.p = p
tar.lib.o = o
tar.lib.od = od
tar.lib.dr = dr
tar.lib.tw = tw
a.patch(window, tar)

/*
This library hacks into the DOM, detects changes in the `.className` of any
element, and dynamically generates Tailwind-compliant styles for the classes
we actually use.
*/
tw.install({
  presets: [tp(), tt()],
  hash: false,
  theme: {
    extend: {
      animation: {
        'flash-light': `flash-light 1s ease-out`,
        'flash-dark': `flash-dark 1s ease-out`,
      },
      keyframes: {
        'flash-light': {
          '0%, 100%': {backgroundColor: `transparent`},
          '20%': {backgroundColor: `oklch(0.945 0.129 101.54)`}, // yellow-200
        },
        'flash-dark': {
          '0%, 100%': {backgroundColor: `transparent`},
          '20%': {backgroundColor: `oklch(0.476 0.114 61.907)`}, // yellow-800
        },
      },
    },
  },
})

/*
Needed for `dr.MixReg`, which enables automatic registration of any custom
elements that we define.
*/
dr.Reg.main.setDefiner(customElements)

// Initialize renderer.
export const ren = new p.Ren()
export const E = ren.E.bind(ren)

// Base class for UI components with custom behaviors.
export class Elem extends dr.MixReg(HTMLElement) {}

/*
Base class for reactive, stateful UI components. The mixin `od.MixReac` causes
the element to automatically monitor observables and re-render on changes:

- On `.connectedCallback`, `.run` is invoked.
- Any observables synchronously accessed during `.run` are automatically monitored.
- When monitored observables change, `.run` is invoked.
*/
export class ReacElem extends od.MixReac(Elem) {}

/*
Reactive element. Shortcut for creating an element rendered via the given
function, which automatically updates on changes to any observables previously
accessed by the function.
*/
export function reac(fun) {return new FunReacElem(fun)}

// A reactive element updated by calling the given function.
class FunReacElem extends ReacElem {
  constructor(fun) {super().fun = a.reqFun(fun)}
  run() {this.fun(this)}
}

class DateTimeFormat extends Intl.DateTimeFormat {
  /*
  Workaround for an issue in Chrome/V8. When formatting 24-hour time, instead of
  rendering 00:XX, it renders 24:XX. Safari doesn't have this problem.
  */
  format(val) {return a.laxStr(super.format(val)).replace(/\b24:/, `00:`)}
}

// By luck, the Swedish locale mostly adheres to ISO 8601.
export const dateFormat = new DateTimeFormat(`sv-SE`, {
  hour12: false,
  timeZoneName: `short`,
  year: `numeric`,
  month: `2-digit`,
  day: `2-digit`,
  hour: `2-digit`,
  minute: `2-digit`,
})

export const timeFormat = new DateTimeFormat(`sv-SE`, {
  hour12: false,
  hour: `2-digit`,
  minute: `2-digit`,
  second: `2-digit`,
})

function percDecode(val) {return a.isStr(val) ? a.onlyFin(parseFloat(val)) : undefined}
function percEncode(val) {return a.isFin(val) ? val + `%` : ``}

/*
export function storageGetJson(store, key) {
  const src = store.getItem(key)
  if (!src) return undefined

  try {return JSON.parse(src)}
  catch (err) {
    log.err(`unable to decode ${a.show(src)}, deleting ${a.show(key)} from storage`)
    store.removeItem(key)
    return undefined
  }
}*/

export function storageSet(store, key, val) {
  a.reqValidStr(key)

  if (a.isNil(val)) {
    if (a.hasOwnEnum(store, key)) store.removeItem(key)
    return
  }

  try {val = a.render(val)}
  catch (err) {
    log.err(`unable to store ${a.show(key)} in ${a.show(store)}:`, err)
    return
  }

  try {
    store.setItem(key, val)
  }
  catch (err) {
    log.err(`unable to store ${a.show(key)} = ${a.show(val)} in ${a.show(store)}:`, err)
  }
}

const STORAGE_KEY_VERBOSE = `tabularius.verbose`

export let LOG_VERBOSE = a.boolOpt(
  sessionStorage.getItem(STORAGE_KEY_VERBOSE) ??
  localStorage.getItem(STORAGE_KEY_VERBOSE)
)

cmdVerbose.cmd = `verbose`
cmdVerbose.desc = `toggle between quiet and verbose logging`

export function cmdVerbose() {
  LOG_VERBOSE = !LOG_VERBOSE
  storageSet(sessionStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  storageSet(localStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  return `logging is now ` + (LOG_VERBOSE ? `verbose` : `selective`)
}

export const INLINE_BTN_CLS = `text-sky-700 dark:text-sky-300 hover:underline hover:decoration-dotted cursor-pointer inline`

export const LOG_WIDTH_KEY = `tabularius.log_width`
export const LOG_WIDTH_DEFAULT = 50 // % of parent width
export const LOG_WIDTH_MIN = 10 // % of parent width
export const LOG_WIDTH_MAX = 90 // % of parent width
export const LOG_MAX_MSGS = 1024

export const LOG_LINE_HEIGHT = `leading-[1.25]`
export const LOG_SPACE_Y = `space-y-[1.25em]`
export const LOG_GAP_Y = `gap-y-[1.25em]`

// Delete old entry (renamed). TODO drop this line.
storageSet(localStorage, `tabularius_log_width`)

/*
Should be used when invoking any async function in sync context. In other words,
at the top level of async invocation. Logs the error and suppresses the
rejection. Usage:

  someAsyncFun().catch(u.logErr)
  somePromise.catch(u.logErr)
*/
export function logErr(err) {log.err(err)}

export const log = new class Log extends Elem {
  // Must be used for all info logging.
  info(...msg) {return this.addMsg({}, ...msg)}

  // Must be used for all error logging.
  err(...msg) {
    if (a.some(msg, isErrAbort)) return undefined
    const out = this.addMsg({type: `err`}, ...msg)
    if (out) console.error(...msg)
    return out
  }

  // Should be used for optional verbose logging.
  verb(...msg) {
    if (!LOG_VERBOSE) return undefined
    return this.addMsg({}, ...msg)
  }

  clear() {
    ren.clear(this.messageLog)
    this.removedCount = 0
    E(this.messageLog, {},
      E(this.removedMessageNotice, {hidden: false}, `log cleared`)
    )
  }

  removedCount = 0
  resizePointerdown = this.resizePointerdown.bind(this)
  resizePointermove = this.resizePointermove.bind(this)
  resizePointerup = this.resizePointerup.bind(this)

  /*
  List of actual log messages.

  Vertical spacing should either exactly match line height, or to be
  non-existent, like in actual terminals. We want to be consistent with
  precedent, and don't want to waste vertical space. Still undecided.
  */
  messageLog = E(`div`, {class: a.spaced(`w-full py-2 overflow-x-hidden overflow-y-auto`, LOG_LINE_HEIGHT)})
  // messageLog = E(`div`, {class: a.spaced(`w-full py-2 overflow-y-auto`, LOG_LINE_HEIGHT, LOG_SPACE_Y)})

  removedMessageNotice = E(`div`, {
    class: `text-gray-500 dark:text-gray-400 text-center border-b border-gray-300 dark:border-gray-700 pb-2`,
    hidden: true,
  })

  dragHandle = E(
    `div`,
    {
      class: `w-1 shrink-0 h-full cursor-ew-resize bg-gray-400 dark:bg-gray-600 opacity-50 hover:opacity-100 border-r border-gray-300 dark:border-gray-700`,
      onpointerdown: this.resizePointerdown,
      onpointerup: this.resizePointerup,
    },
  )

  currentWidth = (
    percDecode(sessionStorage.getItem(LOG_WIDTH_KEY)) ??
    percDecode(localStorage.getItem(LOG_WIDTH_KEY)) ??
    LOG_WIDTH_DEFAULT
  )

  constructor() {
    super()

    E(
      this,
      {
        class: `flex items-stretch min-w-0 bg-gray-100 text-black dark:bg-gray-800 dark:text-white`,
        style: {
          width: percEncode(this.currentWidth),
          // The following properties are needed for reliable resizing.
          flex: `0 1 auto`,
          overflowWrap: `anywhere`,
          minWidth: `0`,
        },
      },
      this.messageLog,
      this.dragHandle,
    )
  }

  addMsg(props, ...chi) {
    const msg = LogMsg.init(props, ...chi)
    if (!msg) return msg

    const log = this.messageLog
    log.lastElementChild?.unsetLatest?.()

    msg.setLatest()
    log.appendChild(msg)
    this.scrollToBottom()
    this.enforceMessageLimit()
    return msg
  }

  /*
  TODO: when appending a new message, scroll to bottom ONLY if already at the
  bottom. If scrolled up, don't scroll to bottom.

  TODO: don't scroll to bottom for messages printed on app startup.
  */
  scrollToBottom() {
    const log = this.messageLog
    const chi = log.lastChild
    if (!chi) return

    const diff = chi.getBoundingClientRect().bottom - log.getBoundingClientRect().bottom
    if (diff > 0) log.scrollBy(0, diff * 2)
  }

  resizePointerdown(eve) {
    // Prevent text selection during drag.
    a.eventKill(eve)

    this.cursorX = eve.clientX
    document.addEventListener(`pointermove`, this.resizePointermove)
    document.addEventListener(`pointerup`, this.resizePointerup)

    // Indicates the percentage visually while resizing.
    document.body.appendChild(this.resizeIndicator ??= E(
      `div`,
      {class: `fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded shadow-lg z-50`},
      percEncode(Math.round(this.currentWidth)),
    ))
  }

  resizePointermove(eve) {
    // Assumes that this element is on the left and the drag handle is on the right.
    const diffX = eve.clientX - this.cursorX
    this.cursorX = eve.clientX

    // Could also use `this.parentElement.getBoundingClientRect().width`.
    // Unclear which is more correct.
    const proportionDiff = diffX / window.innerWidth

    const percDiff = proportionDiff * 100

    const width = Math.max(
      LOG_WIDTH_MIN,
      Math.min(LOG_WIDTH_MAX, this.currentWidth + percDiff)
    )

    this.currentWidth = width
    this.style.width = percEncode(width)
    this.resizeIndicator.textContent = percEncode(Math.round(width))
  }

  resizePointerup(eve) {
    a.eventKill(eve)
    document.removeEventListener(`pointermove`, this.resizePointermove)
    document.removeEventListener(`pointerup`, this.resizePointerup)
    storageSet(sessionStorage, LOG_WIDTH_KEY, this.style.width)
    storageSet(localStorage, LOG_WIDTH_KEY, this.style.width)
    this.resizeIndicator?.remove()
  }

  enforceMessageLimit() {
    this.removedMessageNotice.remove()

    while (this.messageLog.childElementCount > LOG_MAX_MSGS) {
      this.messageLog.removeChild(this.messageLog.firstElementChild)
      this.removedCount++
    }

    E(
      this.removedMessageNotice,
      {hidden: !this.removedCount},
      this.removedCount, ` older messages removed`,
    )

    // Move the notice to the top of the message log.
    if (this.removedCount) this.messageLog.prepend(this.removedMessageNotice)
  }
}()

const LOG_MSG_CLS = `px-2 font-mono whitespace-pre-wrap border-l-4`
const LOG_MSG_CLS_ERR = `text-red-500 dark:text-red-400 border-red-500`
const LOG_MSG_CLS_INFO = `border-transparent`
const LOG_MSG_CLS_INFO_LATEST = `border-yellow-300 dark:border-yellow-800`

export class LogMsg extends dr.MixReg(HTMLPreElement) {
  static init({type} = {}, ...chi) {
    chi = logShowChi(chi)
    if (!chi) return undefined

    const msg = new this()
    msg.isErr = type === `err`

    return E(
      msg,
      {
        // TODO find if there's a class for this. Twind seems to lack `break-anywhere`.
        style: {overflowWrap: `anywhere`},
        class: a.spaced(LOG_MSG_CLS, a.vac(msg.isErr) && LOG_MSG_CLS_ERR),
      },
      LogPrefix(),
      ...chi,
    )
  }

  setLatest() {
    if (this.isErr) return
    this.classList.remove(...splitCliArgs(LOG_MSG_CLS_INFO))
    this.classList.add(...splitCliArgs(LOG_MSG_CLS_INFO_LATEST))
  }

  unsetLatest() {
    if (this.isErr) return
    this.classList.remove(...splitCliArgs(LOG_MSG_CLS_INFO_LATEST))
    this.classList.add(...splitCliArgs(LOG_MSG_CLS_INFO))
  }
}

function LogPrefix() {
  return E(
    `span`,
    {
      class: `text-gray-500 dark:text-gray-400`,
      'data-tooltip': timeFormat.format(Date.now()),
    },
    `> `,
  )
}

export function LogLines(...chi) {return intersperse(chi, LogNewline)}
export function LogParagraphs(...chi) {return intersperse(chi, LogNewlines)}
export function LogNewline() {return `\n`}
export function LogNewlines() {return `\n\n`}

export function logMsgFlash(tar) {
  tar.classList.add(`animate-flash-light`, `dark:animate-flash-dark`)
}

function logShowChi(src) {return a.vac(a.mapCompact(a.flat(src), logShow))}

// TODO: support error chains.
function logShow(val) {
  if (a.isNil(val) || val === ``) return undefined
  if (a.isStr(val)) return val
  if (a.isNode(val)) return val
  return a.show(val)
}

// Observable version of `setInterval` which can be restarted.
export class Interval extends o.Obs {
  init(time, fun, ...args) {
    o.self(this).deinit()
    this.id = setInterval(fun, time, ...args)
  }

  deinit() {
    const tar = o.self(this)
    if (tar.id) {
      clearInterval(tar.id)
      tar.id = undefined
    }
  }
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

/*
Special version of `AbortController`. The signal behaves like a promise, which
is rejected on cancelation.

We're not subclassing `AbortController` because that would cause weird bugs in
some browsers.
*/
export function abortController() {
  const out = new AbortController()
  const sig = out.signal
  const {promise, reject} = Promise.withResolvers()
  function onAbort() {reject(sig.reason)}

  sig.addEventListener(`abort`, onAbort, {once: true})
  sig.promise = promise

  // No unhandled rejection on cancelation, even if no other code ever tries to
  // `await` on the signal.
  promise.catch(a.nop)

  // Make the signal await-able.
  sig.then = abortSignalThen
  return out
}

function abortSignalThen(...src) {return this.promise.then(...src)}

/*
Unkillable background signal, for browser REPL convenience and for rare cases
where we need to suppress cancelation.
*/
export const sig = abortController().signal

export function isSig(val) {
  return a.isInst(val, AbortSignal) && a.isPromise(val)
}

export function reqSig(val) {return a.req(val, isSig)}

/*
The recommended way to wait for async operations. The signal is used for
cancelation. The signal assertion prevents programmer errors such as
accidentally passing a non-signal. Usage:

  await u.wait(sig, someAsyncFun())
*/
export function wait(sig, ...src) {
  reqSig(sig)
  if (!src.length) return undefined
  src.push(sig)
  return Promise.race(src)
}

export function logCmdDone(name, out) {
  a.reqValidStr(name)
  if (a.vac(out)) log.info(out)
  else log.verb(`[${name}] done`)
}

export function logCmdFail(name, err) {
  a.reqValidStr(name)
  // log.err(name)
  log.err(`[${name}] `, err)

  // if (a.isArr(err)) log.err(`[${name}] `, ...err)
  // else log.err(`[${name}] `, err)
}

/*
Purpose: return true if the current element has its own handling of arbitrary
text input or arbitrary keystrokes.
*/
export function isElemInput(val) {
  return a.isElement(val) && (
    a.isInst(val, HTMLInputElement) ||
    a.isInst(val, HTMLTextAreaElement) ||
    a.isInst(val, HTMLSelectElement) ||
    val.contentEditable === `true` ||
    val.contentEditable === `plaintext-only` ||
    val.role === `textbox`
  )
}

export async function jsonDecompressDecode(src) {
  src = a.trim(src)

  // Try direct JSON decoding first.
  // This is not supposed to throw unless JSON is corrupted.
  try {
    const out = jsonDecodeOpt(src)
    if (a.isSome(out)) return out
  }
  catch (err) {
    throw new ErrDecoding(`unexpected JSON decoding error: ${err}`, {cause: err})
  }

  // Try un-base64 -> un-gzip -> un-JSON as fallback.
  try {
    return JSON.parse(await unGzip(atob(src)))
  }
  catch (err) {
    throw new ErrDecoding(`all decoding methods failed: ${err}`, {cause: err})
  }
}

/*
Similar to `jsonDecompressDecode` but does not JSON-decode. The output is
expected to be either empty or a string containing valid JSON, but we don't
validate it very thoroughly.
*/
export async function jsonDecompress(src) {
  src = a.trim(src)
  if (!src) return src
  if (isJsonColl(src)) return src
  return await unGzip(atob(src))
}

export function jsonCompressEncode(src) {
  return compressEncode(JSON.stringify(src))
}

export async function compressEncode(src) {
  src = await gzip(src)
  src = await resBytes(src)
  src = toBase64(src)
  return src
}

export async function resBytes(src) {
  a.reqInst(src, Response)
  src = await a.resOk(src)
  // At the time of writing, only recent browsers have `Response..bytes()`.
  return src.bytes?.() ?? new Uint8Array(await src.arrayBuffer())
}

/*
Similar performance to using `FileReader` with a `Blob`, but synchronous and
simpler. Using an integer-counting loop seems marginally faster, but within
noise levels.
*/
export function toBase64(src) {
  a.reqInst(src, Uint8Array)
  let out = ``
  for (src of src) out += String.fromCharCode(src)
  return btoa(out)
}

export function jsonDecodeOpt(src) {
  return isJsonColl(src) ? JSON.parse(src) : undefined
}

// Vaguely similar to Go's `errors.Is`.
// TODO move to `@mitranim/js`.
export function errIs(err, fun) {
  a.reqFun(fun)
  while (a.isSome(err)) {
    if (fun(err)) return true
    err = err?.cause
  }
  return false
}

export class Err extends Error {get name() {return this.constructor.name}}

export class ErrDecoding extends Err {}

export function isErrDecoding(err) {return a.isInst(err, ErrDecoding)}

export class ErrAbort extends Err {}

export function isErrAbort(err) {return errIs(err, isErrAbortAny)}

function isErrAbortAny(val) {
  return a.isInst(val, ErrAbort) || a.isErrAbort(val)
}

/*
We only deal with data collections. Covering other JSON cases, particularly
numbers, could produce false positives for some base64 text. We're avoiding
try/catch parsing because it interferes with debugging.
*/
function isJsonColl(src) {
  src = a.trim(src)[0]
  return src === `{` || src === `[`
}

export function unGzip(src) {
  src = Uint8Array.from(src, charCode)
  src = new Response(src).body.pipeThrough(new DecompressionStream(`gzip`))
  return new Response(src).text()
}

// Takes a source string to gzip and returns a `Response`.
export async function gzip(src) {
  a.reqStr(src)
  src = new Response(src)
  src = src.body
  src = await src.pipeThrough(new CompressionStream(`gzip`))
  return new Response(src)
}

function charCode(val) {return val.charCodeAt(0)}

export async function fetchJson(...src) {
  return (await a.resOk(fetch(...src))).json()
}

export async function fetchText(...src) {
  return (await a.resOk(fetch(...src))).text()
}

/*
Usage:

  u.darkModeMediaQuery.matches
  u.darkModeMediaQuery.addEventListener(`change`, someListener)
  function someListener(eve) {console.log(eve.matches)}
*/
export const darkModeMediaQuery = window.matchMedia(`(prefers-color-scheme: dark)`)

// Non-insane variant of `Math.round`. Rounds away from 0, instead of up.
export function round(val) {
  a.reqNum(val)
  return val < 0 ? -Math.round(-val) : Math.round(val)
}

export function boundInd(ind, len) {
  a.reqInt(ind)
  a.reqInt(len)
  if (ind >= 0 && ind <= len) return ind
  return len
}

export function copyToClipboard(src) {
  return navigator.clipboard.writeText(a.render(src))
}

export async function asyncIterCollect(sig, src) {
  reqSig(sig)
  const out = []
  if (a.isSome(src)) {
    for await (src of await src) {
      if (sig.aborted) break
      out.push(src)
    }
  }
  return out
}

export function firstCliArg(src) {return splitCliArgs(src)[0]}

export function splitCliArgs(src) {return a.split(src, /\s+/)}

export function cliDecode(src) {return splitCliArgs(src).map(cliDecodeArg)}

export function cliDecodeArg(src) {
  const ind = src.indexOf(`=`)
  if (ind >= 0) return [src.slice(0, ind), src.slice(ind + `=`.length)]
  if (src.startsWith(`-`)) return [src, ``]
  return [``, src]
}

export function cliGroup(src) {
  const flags = a.Emp()
  const args = []
  for (const [key, val] of src) {
    if (key) fu.dictPush(flags, key, val)
    else args.push(val)
  }
  return [flags, args]
}

export function cliBool(key, val) {
  a.reqValidStr(key)
  reqEnum(key, val, CLI_BOOL)
  return !val || val === `true`
}

const CLI_BOOL = new Set([``, `true`, `false`])

export function assUniq(tar, key, desc, val) {
  a.reqDict(tar)
  a.reqValidStr(key)
  a.reqValidStr(desc)
  if (key in tar) throw Error(`redundant ${a.show(desc)}`)
  tar[key] = val
}

export function reqUniq(key, has) {
  if (!has) return
  throw Error(`redundant ${a.show(key)}`)
}

export function reqEnum(key, val, coll) {
  if (coll.has(val)) return val
  throw Error(`${a.show(key)} must be one of: ${a.show(a.keys(coll))}, got: ${a.show(val)}`)
}

// For super simple boolean CLI flags.
export function arrRemoved(tar, val) {
  const len = a.len(tar)
  while (a.includes(tar, val)) tar.splice(a.indexOf(tar, val), 1)
  return a.len(tar) < len
}

/*
Implements the "try-lock" behavior missing from the standard DOM API,
which insists on blocking our promise if the acquisition is successful,
going against the nature of "try-locking", which should always return
immediately, reporting if the attempt was successful.

If the returned unlock function is non-nil, the caller must use `try/finally`
to reliably release the lock.
*/
export function lockOpt(name) {
  return lockWith(name, {ifAvailable: true})
}

export async function lockHeld(name) {
  a.reqValidStr(name)
  return !!(await navigator.locks.query(name))?.held?.length
}

/*
A non-callback version of `navigator.locks.request` suitable for async funs.
Always returns an unlock function, and the caller must use `try/finally` to
reliably release the lock.
*/
export function lock(sig, name) {
  reqSig(sig)
  return lockWith(name, {signal: sig})
}

/*
Converts the Web Locks API to something usable. See `lockOpt` and `lock`.
The caller MUST use `try/finally`, or a promise callback equivalent, to unlock.
*/
export async function lockWith(name, opt) {
  a.reqValidStr(name)
  a.optObj(opt)
  const {promise: request0, resolve: locked} = Promise.withResolvers()
  const {promise: block, resolve: unlock} = Promise.withResolvers()

  const request1 = navigator.locks.request(name, opt, function locker(lock) {
    locked(!!lock)
    return block
  })

  const ok = await Promise.race([request0, request1])
  return ok ? unlock : undefined
}

/*
We have several event targets (`BROAD` and `DAT`). `BroadcastChannel`
prioritizes `message` events; they're dispatched when using `.postMessage`.
Sometimes we pass them along to other event targets. So for simplicity,
we just use this event type for everything.
*/
export const DEFAULT_EVENT_TYPE = `message`

export const BROAD = new BroadcastChannel(`tabularius_broadcast`)

BROAD.onmessage = function onBroadcastMessage(eve) {
  if (!LOG_VERBOSE) return
  console.log(`broadcast message event:`, eve)
}

BROAD.onmessageerror = function onBroadcastError(eve) {
  if (!LOG_VERBOSE) return
  console.error(`broadcast error event:`, eve)
}

export function broadcastToAllTabs(data) {
  broadcastToThisTab(data)
  broadcastToOtherTabs(data)
}

export function broadcastToThisTab(data) {
  BROAD.dispatchEvent(new MessageEvent(DEFAULT_EVENT_TYPE, {data}))
}

export function broadcastToOtherTabs(data) {
  BROAD.postMessage(data)
}

// Default way of subscribing to our event targets.
export function listenMessage(tar, fun, opt) {
  return listen(tar, DEFAULT_EVENT_TYPE, fun, opt)
}

// Default way of dispatching on our event targets.
export function dispatchMessage(tar, data) {
  dispatch(tar, DEFAULT_EVENT_TYPE, data)
}

/*
A simplifying wrapper for `.addEventListener`/`.removeEventListener` that
provides only the event data, without the event, supporting both message
events and custom events (where data is stored in different fields).
*/
export function listen(tar, type, fun, opt) {
  a.reqStr(type)
  a.reqFun(fun)
  a.optObj(opt)

  function onEvent(src) {fun(eventData(src))}
  tar.addEventListener(type, onEvent, opt)
  return function unlisten() {tar.removeEventListener(type, onEvent, opt)}
}

export function dispatch(tar, type, data) {
  tar.dispatchEvent(new CustomEvent(a.reqStr(type), {detail: data}))
}

function eventData(src) {
  a.reqInst(src, Event)
  return (
    src.data || // `MessageEvent`
    src.detail  // `CustomEvent`
  )
}

// Minor extensions and workarounds for library functionality.
export const paths = new class PathsPosix extends pt.PathsPosix {
  split(src) {
    // If the path ends with the dir separator, the last item is an empty string.
    if (this.isDirLike(src)) return a.split(this.clean(src), this.dirSep)
    return a.split(this.cleanPre(src), this.dirSep)
  }

  split1(src) {
    src = this.split(src)
    return [src[0] || ``, src.slice(1).join(this.sep)]
  }

  // In this particular system, all paths are relative to the root.
  clean(src) {
    return a.stripPre(super.clean(src), this.dirSep)
  }
}()

export function filterWhere(src, where) {
  src = a.values(src)
  where = whereFields(where)
  if (!where) return src
  return a.filter(src, where)
}

/*
For large-ish datasets, this seems to perform better than a version that loops
through functions or field patterns for each tested value.

SYNC[field_pattern].
*/
export function whereFields(src) {
  const test = a.mapCompact(a.entries(src), whereField)
  if (!test.length) return undefined

  return Function(`
return function whereFields(val) {return ${test.join(` && `)}}
`)()
}

function whereField([key, src]) {
  a.reqStr(key)
  const out = []
  for (const val of a.values(src)) {
    a.reqPrim(val)
    out.push(`val.${key} === ${a.show(val)}`)
  }
  return `(` + out.join(` || `) + `)`
}

export function intersperse(src, fun) {
  const buf = []
  for (src of a.values(src)) buf.push(src, callOpt(fun))
  buf.pop()
  return buf
}

export function callOpt(val) {return a.isFun(val) ? val() : val}

/*
In a few places we suggest appending `?<some_stuff>` to the URL query.
Most users wouldn't know that if there's already stuff in the query,
then you must apppend with `&` rather than `?`. And it's a pain even
if you know it. Frankly, whoever designed the format made a mistake.
So we rectify it.
*/
export function urlQuery(src) {
  return new URLSearchParams(a.split(src, `?`).join(`&`))
}

export function BtnUrlAppend(val) {
  a.reqValidStr(val)
  return E(
    `button`, {
      type: `button`,
      class: INLINE_BTN_CLS,
      onclick() {window.location += val},
    },
    val,
  )
}

export function Btn(chi, fun) {
  a.reqSome(chi)
  a.reqFun(fun)

  return E(
    `button`,
    {
      type: `button`,
      class: `px-1 inline whitespace-nowrap bg-gray-200 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600`,
      onclick: fun,
    },
    chi,
  )
}

export function alignTable(rows) {
  const cols = []

  return a.reqArr(rows).map(makeRow).map(alignRow)

  function makeRow(src) {
    a.reqArr(src)
    const out = []
    let ind = -1

    while (++ind < src.length) {
      const pair = tableCellPair(src[ind])
      out[ind] = pair
      cols[ind] = Math.max(cols[ind] | 0, pair[1])
    }
    return out
  }

  function alignRow(src) {return src.map(alignCell)}

  function alignCell([val, len], ind) {
    if (isLastCol(ind)) return val
    return tableCellPad(val, len, cols[ind] | 0)
  }

  function isLastCol(ind) {
    while (++ind < cols.length) if (cols[ind]) return false
    return true
  }
}

function tableCellPair(src) {
  if (a.isNode(src)) return [src, src.textContent.length]
  src = a.renderLax(src)
  return [src, src.length]
}

function tableCellPad(src, len, max) {
  if (a.isNode(src)) return [src, ` `.repeat(Math.max(0, max - len))]
  return src.padEnd(max | 0, ` `)
}

export async function optStartUploadAfterInit(sig) {
  const {fb} = await cloudFeatureImport
  if (!fb) return
  if (!await fb.nextUser(sig)) {
    fb.recommendAuth()
    return
  }
  await optStartUploadAfterAuth(sig)
}

export async function optStartUploadAfterAuth() {
  const [os, fs] = await Promise.all([import(`./os.mjs`), import(`./fs.mjs`)])
  if (!await fs.loadedHistoryDir().catch(logErr)) return
  os.runCmd(`upload -p /`)
}

export const cloudFeatureImport = async function cloudFeatureImport() {
  const out = a.Emp()
  const msg = `import cloud-related modules; cloud backups and analytics will be unavailable`
  let res

  try {
    res = await Promise.race([
      a.after(a.minToMs(1), sig),
      Promise.all([
        import(`./fb.mjs`),
        import(`./msgs.mjs`),
        import(`./upload.mjs`),
      ]),
    ])
  }
  catch (err) {
    log.err(`unable to ${msg}; error: `, err)
    return out
  }

  if (a.isArr(res)) {
    const [fb, ms, up] = res
    out.fb = fb
    out.ms = ms
    out.up = up
    return out
  }

  log.err(`timed out trying to ${msg}`)
  return out
}()

export function stripPreSpaced(src, pre) {
  src = a.laxStr(src)
  pre = a.laxStr(pre)

  if (!pre) return src
  if (!src.startsWith(pre)) return src

  const out = src.slice(pre.length)
  if (!out) return out
  if (/^\s/.test(out)) return out.trim()
  return src
}
