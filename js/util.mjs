import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as d from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/dom.mjs'
import * as p from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/prax.mjs'
import * as pt from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/path.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/obs.mjs'
import * as od from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/obs_dom.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/dom_reg.mjs'
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

cmdVerbose.cmd = `verbose`
cmdVerbose.desc = `toggle between quiet and verbose logging`

export function cmdVerbose() {
  LOG_VERBOSE = !LOG_VERBOSE
  storageSet(sessionStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  storageSet(localStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  return `logging is now ` + (LOG_VERBOSE ? `verbose` : `selective`)
}

cmdClear.cmd = `clear`
cmdClear.desc = `clear the log`
cmdClear.help = u.joinParagraphs(
  cmdClear.desc,
  `pro tip: when the prompt is focused, you can also clear the log by pressing "ctrl+l" or "meta+k" ("meta" is also known as "cmd" / "win" / "super" depending on your keyboard and OS)`
)

export function cmdClear() {log.clear()}

const LOG_WIDTH_KEY = `tabularius_log_width`
const LOG_WIDTH_DEFAULT = 50 // % of parent width
const LOG_WIDTH_MIN = 10 // % of parent width
const LOG_WIDTH_MAX = 90 // % of parent width
const LOG_MAX_MSGS = 1024

export const LOG_LINE_HEIGHT = `leading-[1.25]`
export const LOG_SPACE_Y = `space-y-[1.25em]`
export const LOG_GAP_Y = `gap-y-[1.25em]`

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
  info(...msg) {
    if (!a.vac(msg)) return
    return this.addMsg({}, ...msg)
  }

  // Must be used for all error logging.
  err(...msg) {
    if (!a.vac(msg)) return
    if (a.some(msg, isErrAbort)) return
    console.error(...msg)
    return this.addMsg({type: `err`}, ...msg)
  }

  // Should be used for optional verbose logging.
  verb(...msg) {
    if (!LOG_VERBOSE) return
    if (!a.vac(msg)) return
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
  messageLog = E(`div`, {class: a.spaced(`w-full py-2 overflow-y-auto`, LOG_LINE_HEIGHT)})
  // messageLog = E(`div`, {class: a.spaced(`w-full py-2 overflow-y-auto`, LOG_LINE_HEIGHT, LOG_SPACE_Y)})

  removedMessageNotice = E(`div`, {
    class: `text-gray-500 dark:text-gray-400 text-center border-b border-gray-300 dark:border-gray-700 pb-2`,
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

  addMsg(props, ...chi) {
    const msg = this.messageLog.appendChild(LogMsg(props, ...chi))
    this.scrollToBottom()
    this.enforceMessageLimit()
    return msg
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

function LogMsg({type} = {}, ...chi) {
  return E(
    `pre`,
    {
      class: a.spaced(
        // Mandatory stuff.
        `px-2 font-mono whitespace-pre-wrap break-words overflow-wrap-anywhere`,

        // Error-related stuff.
        a.spaced(
          `border-l-4`,
          type === `err`
            ? `text-red-500 dark:text-red-400 border-red-500`
            : `border-transparent`, // Same geometry as errors.
        ),
      )
    },
    E(
      `span`,
      {
        class: `text-gray-500 dark:text-gray-400`,
        'data-tooltip': timeFormat.format(Date.now()),
      },
      `> `
    ),
    a.map(chi, logShow),
  )
}

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
  if (a.isNode(out)) log.info(out)
  else if (a.isArr(out) && a.vac(out)) log.info(...out)
  else if (a.isSome(out)) log.info(out)
  else log.verb(`[${name}] done`)
}

export function logCmdFail(name, err) {
  a.reqValidStr(name)
  log.err(`[${name}] `, err)
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
export function joinLines(...src) {return a.joinLinesOptLax(src)}
export function joinParagraphs(...src) {return a.joinOptLax(src, `\n\n`)}

/*
How many digits to use for local ordinal ids for runs and rounds. Needs to be
long enough for any realistic amount of runs, and short enough to easily type.
*/
export const ORD_STR_LEN = 4

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

export function toIntOpt(val) {
  return a.isNum(val) ? val | 0 : a.isStr(val) ? strToInt(val) : val
}

export function hasIntPrefix(val) {
  return a.isStr(val) && a.isSome(strToInt(val))
}

export function compareAsc(one, two) {return compareByIntPrefix(one, two, false)}
export function compareDesc(one, two) {return compareByIntPrefix(one, two, true)}

/*
Similar to regular JS sorting, but prefers to sort by an integer prefix.
Integers always come before other values. Falls back on regular JS sorting.
Does not support fractional syntax.
*/
export function compareByIntPrefix(prev, next, desc) {
  a.reqBool(desc)
  const one = strToInt(prev)
  const two = strToInt(next)
  if (a.isNil(one) && a.isNil(two)) return a.compare(prev, next)
  if (a.isNil(one)) return 1
  if (a.isNil(two)) return -1
  if (one < two) return desc ? 1 : -1
  if (one > two) return desc ? -1 : 1
  return 0
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
Similar to `jsonDecompressDecode` but does not JSON-decode. The output is expected
to be either empty or a string containing valid JSON, but we don't validate it
thoroughly.
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
  return toBase64(await (await gzip(src)).bytes())
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

/*
Takes a source string to gzip and returns a `Response`.
The caller is free to call `.arrayBuffer()` or `.bytes()`.
*/
export async function gzip(src) {
  src = new Response(a.reqStr(src)).body
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

export function avg(src) {return a.values(src).reduce(avgAdd, 0)}

function avgAdd(acc, num, ind) {
  return !a.isFin(num) ? acc : (acc + ((num - acc) / (ind + 1)))
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
export function splitCliArgs(src) {return a.reqStr(src).split(/\s+/)}

// Suboptimal but not our bottleneck. Used only for CLI flags.
export function arrRemoved(tar, val) {
  const len = a.len(tar)
  while (a.includes(tar, val)) tar.splice(a.indexOf(tar, val), 1)
  return a.len(tar) < len
}

/*
The implementation of "try-lock" behavior missing from the standard DOM API,
which insists on blocking our promise if the acquisition is successful, going
against the nature of "try-locking", which should always immediately return,
reporting if the attempt was successful.

If the returned unlock function is non-nil, the caller must use `try/finally`
to reliably release the lock.
*/
export function lockOpt(name) {
  return lockWith(name, {ifAvailable: true})
}

/*
A non-callback version of `navigator.locks.request` suitable for async funcs.
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
    return a.split(a.stripPre(this.clean(src), this.dirSep), this.dirSep)
  }

  // In this particular system, all paths are relative to the root.
  clean(src) {
    return a.stripPre(super.clean(src), this.dirSep)
  }
}()
