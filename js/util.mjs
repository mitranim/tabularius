import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as d from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom.mjs'
import * as p from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/prax.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs.mjs'
import * as od from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs_dom.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom_reg.mjs'
import * as tw from 'https://esm.sh/@twind/core@1.1.3'
import tp from 'https://esm.sh/@twind/preset-autoprefix@1.0.7'
import tt from 'https://esm.sh/@twind/preset-tailwind@1.1.4'

/*
This library hacks into the DOM, detects changes in the `.className` of any
element, and dynamically generates Tailwind-compliant styles for the classes
we actually use.
*/
tw.install({
  presets: [tp(), tt()],
  hash: false,
})

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

const LOG_WIDTH_KEY = `tabularius_log_width`
const LOG_WIDTH_DEFAULT = 50 // % of parent width
const LOG_WIDTH_MIN = 10 // % of parent width
const LOG_WIDTH_MAX = 90 // % of parent width
const LOG_MAX_MSGS = 1024

// Should be used with `.catch` on promises.
// Logs the error and suppresses the rejection.
export function logErr(err) {if (a.isSome(err)) log.err(err)}

export const log = new class Log extends Elem {
  // Must be used for all info logging.
  inf(...msg) {
    if (!a.vac(msg)) return
    this.addMsg(msg)
  }

  // Must be used for all error logging.
  err(...msg) {
    if (!a.vac(msg)) return
    console.error(...msg)
    this.addMsg(msg, true)
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
    LOG_WIDTH_DEFAULT
  )

  constructor() {
    super()

    E(
      this,
      {
        class: `flex items-stretch min-w-0 bg-gray-100 dark:bg-gray-800`,
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
    document.removeEventListener(`pointermove`, this.resizePointermove)
    document.removeEventListener(`pointerup`, this.resizePointerup)
    sessionStorage.setItem(LOG_WIDTH_KEY, this.style.width)
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
          ? `text-red-600 dark:text-red-400 border-red-500`
          : `text-gray-800 dark:text-gray-300 border-transparent`,
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

  sig.promise = new Promise(function initAbortSignalPromise(_, fail) {
    /*
    Reject the promise with `undefined`.
    This is our cancelation indicator.
    Our logger ignores nil errors.
    */
    function onAbort() {fail()}
    sig.addEventListener(`abort`, onAbort, {once: true})
  })

  // No unhandled rejection on cancelation.
  sig.promise.catch(a.nop)

  // Makes the signal await-able.
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
  if (!a.vac(out)) return
  log.inf(`[${name}] done: ${logShow(out)}`)
}

export function logCmdFail(name, err) {
  a.reqValidStr(name)
  if (!a.vac(err)) return
  log.inf(`[${name}] error: ${err}`)
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

/*
A monotonic random id. Considered using ULID, but seemed too complicated.
The length will change on 2527-04-16 according to a bot.
*/
export function rid() {
  return (
    Date.now().toString(16) + `_` +
    a.arrHex(crypto.getRandomValues(new Uint8Array(8)))
  )
}

export async function decodeObfuscated(src) {
  src = a.trim(src)

  // Try direct JSON decoding first.
  const out = jsonDecodeOpt(src)
  if (out) return out

  // Try un-base64 -> un-gzip -> un-JSON as fallback.
  try {
    return a.jsonDecode(await ungzip(atob(src)))
  }
  catch (err) {
    throw Error(`All decoding methods failed: ${err}`, {cause: err})
  }
}

export function jsonDecodeOpt(src) {
  if (isJsonColl(src)) return a.jsonDecode(src)
  return undefined
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
  const bytes = Uint8Array.from(src, charCode)
  const stream = new Response(bytes).body.pipeThrough(new DecompressionStream(`gzip`))
  return new Response(stream).text()
}

function charCode(val) {return val.charCodeAt(0)}

// Utility functions for backup management
// Get backup extension from source file when needed
const MIN_BACKUP_DIGITS = 4

export function padRoundIndex(val) {
  return String(a.reqNat(val)).padStart(MIN_BACKUP_DIGITS, `0`)
}

// Must always be at the very end of this file.
import * as module from './util.mjs'
window.tabularius = a.Emp()
window.tabularius.u = module
