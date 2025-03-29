import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as d from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom.mjs'
import * as p from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/prax.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs.mjs'
import * as od from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs_dom.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom_reg.mjs'
// import * as cl from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/cli.mjs'
import * as tw from 'https://esm.sh/@twind/core@1.1.3'
import tp from 'https://esm.sh/@twind/preset-autoprefix@1.0.7'
import tt from 'https://esm.sh/@twind/preset-tailwind@1.1.4'

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
// tar.lib.cl = cl
a.patch(window, tar)

/*
This library hacks into the DOM, detects changes in the `.className` of any
element, and dynamically generates Tailwind-compliant styles for the classes
we actually use.
*/
tw.install({presets: [tp(), tt()], hash: false})

/*
Needed for `dr.MixReg`, which enables automatic registration of any custom
elements that we define.
*/
dr.Reg.main.setDefiner(customElements)

// Initialize renderer.
export const ren = new p.Ren()
export const E = ren.elemHtml.bind(ren)

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

  try {return a.jsonDecode(src)}
  catch (err) {
    log.err(`unable to decode ${a.show(src)}, deleting ${a.show(key)} from storage`)
    store.removeItem(key)
    return undefined
  }
}*/

export function storageSet(store, key, val) {
  a.reqValidStr(key)

  if (a.isNil(val)) {
    store.removeItem(key)
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

export function cmdVerbose() {
  LOG_VERBOSE = !LOG_VERBOSE
  storageSet(sessionStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  storageSet(localStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  return `logging is now ` + (LOG_VERBOSE ? `verbose` : `selective`)
}

export function cmdClear() {log.clear()}

const LOG_WIDTH_KEY = `tabularius_log_width`
const LOG_WIDTH_DEFAULT = 50 // % of parent width
const LOG_WIDTH_MIN = 10 // % of parent width
const LOG_WIDTH_MAX = 90 // % of parent width
const LOG_MAX_MSGS = 1024

// Should be used with `.catch` on promises.
// Logs the error and suppresses rejection, returning `undefined`.
export function logErr(err) {log.err(err)}

export const log = new class Log extends Elem {
  // Must be used for all info logging.
  inf(...msg) {
    if (!a.vac(msg)) return
    this.addMsg(msg)
  }

  // Must be used for all error logging.
  err(...msg) {
    if (!a.vac(msg)) return
    if (a.some(msg, isErrAbort)) return
    console.error(...msg)
    this.addMsg(msg, true)
  }

  verb(...msg) {
    if (!LOG_VERBOSE) return
    if (!a.vac(msg)) return
    this.addMsg(msg)
  }

  clear() {
    ren.clear(this.messageLog)
    this.removedCount = 0
    this.removedMessageNotice.hidden = true
  }

  removedCount = 0
  resizePointerdown = this.resizePointerdown.bind(this)
  resizePointermove = this.resizePointermove.bind(this)
  resizePointerup = this.resizePointerup.bind(this)

  // List of actual log messages.
  messageLog = E(`div`, {class: `w-full overflow-y-auto`})

  removedMessageNotice = E(`div`, {
    class: `text-gray-500 dark:text-gray-400 text-center p-2 border-b border-gray-300 dark:border-gray-700`,
    hidden: true,
  })

  dragHandle = E(
    `div`,
    {
      class: `w-1 shrink-0 h-full cursor-ew-resize bg-gray-400 dark:bg-gray-600 opacity-50 hover:opacity-100 transition-opacity border-r border-gray-300 dark:border-gray-700`,
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

  addMsg(msg, isErr) {
    this.messageLog.append(LogMsg(msg, isErr))
    this.scrollToBottom()
    this.enforceMessageLimit()
  }

  /*
  TODO: when appending a new message, scroll to bottom ONLY if already at the
  bottom. If scrolled up, don't scroll to bottom.
  */
  scrollToBottom() {this.messageLog.lastChild?.scrollIntoViewIfNeeded?.()}

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
    while (this.messageLog.childElementCount > LOG_MAX_MSGS) {
      this.messageLog.removeChild(this.messageLog.firstElementChild)
      this.removedCount++
    }

    // Update the notice about removed messages
    E(
      this.removedMessageNotice,
      {hidden: !this.removedCount},
      this.removedCount, ` older messages removed`,
    )

    // Move the notice to the top of the message log
    if (this.removedCount && !this.removedMessageNotice.parentNode) {
      this.messageLog.prepend(this.removedMessageNotice)
    }
  }
}()

function LogMsg(src, isErr) {
  return E(
    `div`,
    {
      class: a.spaced(
        `border-l-4 p-2`,
        isErr
          ? `text-red-500 dark:text-red-400 border-red-500`
          : `border-transparent`,
      ),
    },
    E(
      `div`,
      {class: `flex items-baseline gap-2`},
      E(
        `span`,
        {class: `text-gray-500 dark:text-gray-400 shrink-0`},
        timeFormat.format(new Date())
      ),
      E(
        `pre`,
        {
          class: `font-mono whitespace-pre-wrap break-words overflow-wrap-anywhere inline`,
          style: {
            // Ensure long words break if they're too long
            wordBreak: `break-word`,
          }
        },
        fmtMsg(src)
      )
    ),
  )
}

function fmtMsg(src) {return a.map(src, logShow).join(` `)}

// TODO: support error chains.
function logShow(val) {
  if (a.isStr(val) || a.isNode(val)) return val
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

export function isArrOfStr(val) {return a.isArrOf(val, a.isStr)}
export function reqArrOfStr(val) {return a.reqArrOf(val, a.isStr)}
export function optArrOfStr(val) {return a.optArrOf(val, a.isStr)}

export function isArrOfValidStr(val) {return a.isArrOf(val, a.isValidStr)}
export function reqArrOfValidStr(val) {return a.reqArrOf(val, a.isValidStr)}
export function optArrOfValidStr(val) {return a.optArrOf(val, a.isValidStr)}

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

export function isSig(val) {
  return a.isInst(val, AbortSignal) && a.isPromise(val)
}

export function reqSig(val) {return a.req(val, isSig)}

/*
The recommended way to wait for async operations. The signal is used for
cancelation. The special-case validation prevents programmer errors such as
accidentally passing a non-signal. Usage:

  await u.wait(sig, someAsyncFun())
*/
export function wait(sig, ...src) {
  reqSig(sig)
  src.push(sig)
  return Promise.race(src)
}

export function logCmdDone(name, out) {
  a.reqValidStr(name)
  if (a.vac(out)) log.inf(`[${name}]`, out)
  else log.inf(`[${name}] done`)
}

export function logCmdFail(name, err) {
  a.reqValidStr(name)
  log.err(`[${name}] error:`, err)
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

export function joinSpaced(src) {return a.joinOptLax(src, ` `)}
export function joinKeys(...src) {return a.joinOptLax(src, `_`)}

/*
How many digits to use for local ordinal ids for runs and rounds.

999999 rounds = unreal

999999 runs = if 10 min per run, then 19 years
*/
const ORD_STR_LEN = 6

export function intToOrdStr(val) {
  return String(a.reqInt(val)).padStart(ORD_STR_LEN, `0`)
}

/*
Very permissive parsing. Works for strings like:

  123
  123_<id>
  123.<ext>
  123_<id>.<ext>

Returns nil when parsing doesn't produce an integer.
*/
export function strToInt(src) {
  return a.onlyInt(parseInt(a.laxStr(src)))
}

export function fileNameBase(name) {
  name = a.laxStr(name)
  const ind = name.lastIndexOf(`.`)
  return ind > 0 ? name.slice(0, ind) : ``
}

export function fileNameExt(name) {
  name = a.laxStr(name)
  const ind = name.lastIndexOf(`.`)
  return ind > 0 ? name.slice(ind) : ``
}

export async function decodeObfuscated(src) {
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
    return a.jsonDecode(await ungzip(atob(src)))
  }
  catch (err) {
    throw new ErrDecoding(`all decoding methods failed: ${err}`, {cause: err})
  }
}

/*
Similar to `decodeObfuscated` but does not JSON-decode. The output is expected
to be either empty or a JSON string, but we don't validate it thoroughly.
*/
export async function deObfuscate(src) {
  src = a.trim(src)
  if (!src) return src
  if (isJsonColl(src)) return src
  return await ungzip(atob(src))
}

export function jsonDecodeOpt(src) {
  if (isJsonColl(src)) return a.jsonDecode(src)
  return undefined
}

// Similar to Go's `errors.Is`.
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

export function ungzip(src) {
  src = Uint8Array.from(src, charCode)
  src = new Response(src).body.pipeThrough(new DecompressionStream(`gzip`))
  return new Response(src).text()
}

export async function gzipStr(src) {
  return String.fromCharCode(...(await gzipBytes(src)))
}

export async function gzipBytes(src) {return (await gzipRes(src)).bytes()}

export async function gzipRes(src) {
  src = new Response(a.reqValidStr(src)).body
  src = await src.pipeThrough(new CompressionStream(`gzip`))
  src = await a.resOk(new Response(src))
  return src // Let the caller read the body.
}

function charCode(val) {return val.charCodeAt(0)}

export async function fetchJson(...src) {
  return (await a.resOk(fetch(...src))).json()
}

/*
Usage:

  u.darkModeMediaQuery.matches
  u.darkModeMediaQuery.addEventListener(`change`, someListener)
  function someListener(eve) {console.log(eve.matches)}
*/
export const darkModeMediaQuery = window.matchMedia(`(prefers-color-scheme: dark)`)

export function roundDefault(val) {return roundTo(val, 2)}

// Rounds the number to N decimal places.
export function roundTo(num, decimalPlaces) {
  a.reqNat(decimalPlaces)
  if (a.isNil(a.optFin(num))) return undefined
  const coeff = Math.pow(10, decimalPlaces)
  return round(num * coeff) / coeff
}

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
