import * as a from '@mitranim/js/all.mjs'
import * as p from '@mitranim/js/prax.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as od from '@mitranim/js/obs_dom.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as tw from '@twind/core'
import tp from '@twind/preset-autoprefix'
import tt from '@twind/preset-tailwind'
import * as su from '../shared/util.mjs'
export * from '../shared/util.mjs'

import * as self from './util.mjs'
const tar = window.tabularius ??= a.Emp()
tar.u = self
tar.lib ??= a.Emp()
tar.lib.a = a
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
      /*
      Twind accepts colors only in the hex and HSL (legacy only) formats.
      Tailwind classes are defined in `oklah` by default. When experimenting
      with colors in the `oklah` format, use https://oklch.com for converting
      between `oklah` and hex. Beware of browser devtools: at the time of
      writing, in Chrome 135, conversions involving `oklah` are buggy. For
      colors, conversion to `oklah` from many other formats (tested with hex
      and `hsl`) often produces incorrect results.
      */
      colors: {
        'root-dark': `#0c0a09`, // stone-950
        'base-dark': `#1c1917`, // stone-900
      },
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
  rules: [
    /*
    Caller MUST also set width.

    Uses `overflow-clip` rather than `overflow-hidden` because the latter
    creates a new formatting context, requiring additional `align-top` or
    `align-bottom` to avoid messing up alignment for other elements on the
    same line. `overflow-clip` seems strictly superior.
    */
    [`trunc`, `inline-block min-w-0 whitespace-pre overflow-x-clip text-ellipsis`],
    [`row-cen-cen`, `flex-row justify-center items-center`],
    [`row-bet-cen`, `flex-row justify-between items-center`],
    [`col-cen-cen`, `flex-col justify-center items-center`],
    [`col-cen-sta`, `flex-col justify-center items-start`],
    [`col-sta-str`, `flex-col justify-start items-stretch`],
    [`col-sta-cen`, `flex-col justify-start items-center`],
  ],
  ignorelist: [`media-grid`],
})

/*
Needed for `dr.MixReg`, which enables automatic registration of any custom
elements that we define.
*/
dr.Reg.main.setDefiner(customElements)

export const URL_CLEAN = new URL(window.location)
URL_CLEAN.search = ``
URL_CLEAN.hash = ``

export const QUERY = urlQuery(window.location.search)
export const API_LOCAL = a.boolOpt(QUERY.get(`local`))
export const API_URL = API_LOCAL ? `/api/` : `https://tabularius.mitranim.com/api/`

// Initialize renderer.
const ren = new class Ren extends p.Ren {
  /*
  Minor workaround for a bug in the library code, where `.toNode` is not
  supported properly. We need it for `ErrLog`.
  */
  appendChi(tar, src) {
    if (a.hasMeth(src, `toNode`)) src = src.toNode()
    return super.appendChi(tar, src)
  }
}()

export const E = ren.E.bind(ren)
export const S = ren.elemSvg.bind(ren)

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
    LOG.err(`unable to decode ${a.show(src)}, deleting ${a.show(key)} from storage`)
    storageSet(store, key)
    return undefined
  }
}
*/

export function storageSet(store, key, val) {
  a.reqValidStr(key)

  if (a.isNil(val)) {
    if (a.hasOwnEnum(store, key)) store.removeItem(key)
    return true
  }

  try {val = a.render(val)}
  catch (err) {
    LOG.err(`unable to store ${a.show(key)} in ${a.show(store)}:`, err)
    return false
  }

  try {
    store.setItem(key, val)
    return true
  }
  catch (err) {
    LOG.err(`unable to store ${a.show(key)} = ${a.show(val)} in ${a.show(store)}:`, err)
    return false
  }
}

const STORAGE_KEY_VERBOSE = `tabularius.verbose`

export let LOG_VERBOSE = a.boolOpt(
  sessionStorage.getItem(STORAGE_KEY_VERBOSE) ??
  localStorage.getItem(STORAGE_KEY_VERBOSE)
)

cmdVerbose.cmd = `verbose`
cmdVerbose.desc = `toggle between quiet and verbose logging`

export function cmdVerbose({args}) {
  if (u.hasHelpFlag(u.splitCliArgs(args))) return os.cmdHelpDetailed(cmdVerbose)
  LOG_VERBOSE = !LOG_VERBOSE
  storageSet(sessionStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  storageSet(localStorage, STORAGE_KEY_VERBOSE, LOG_VERBOSE)
  return `logging is now ` + (LOG_VERBOSE ? `verbose` : `selective`)
}

export const CLS_TEXT_GRAY = `text-gray-500 dark:text-neutral-400`
export const CLS_TEXT_GRAY_BUSY = CLS_TEXT_GRAY + ` hover:text-gray-800 dark:hover:text-neutral-200`
export const CLS_BTN_INLINE_BASE = `text-sky-700 dark:text-sky-300 hover:underline hover:decoration-dotted cursor-pointer text-left`
export const CLS_BTN_INLINE = `inline ` + CLS_BTN_INLINE_BASE

export const LOG_WIDTH_KEY = `tabularius.log_width`
export const LOG_WIDTH_DEFAULT = 50 // % of parent width
export const LOG_WIDTH_MIN = 10 // % of parent width
export const LOG_WIDTH_MAX = 90 // % of parent width
export const LOG_MAX_MSGS = 1024

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
export function logErr(err) {LOG.err(err)}

export const LOG = new class Log extends Elem {
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

  inp(...msg) {return this.addMsg({type: `inp`}, ...msg)}

  clear() {
    ren.clear(this.messageLog)
    this.removedCount = 0
    E(this.messageLog, {},
      E(this.removedMessageNotice, {hidden: false}, `log cleared`)
    )
  }

  // List of actual log messages.
  messageLog = E(`div`, {class: a.spaced(`w-full py-2 overflow-x-clip overflow-y-auto`, LOG_LINE_HEIGHT)})

  removedCount = 0

  removedMessageNotice = E(`div`, {
    class: a.spaced(u.CLS_TEXT_GRAY, `text-center border-b border-gray-300 dark:border-neutral-700 pb-2`),
    hidden: true,
  })

  resizePointerdown = this.resizePointerdown.bind(this)
  resizePointermove = this.resizePointermove.bind(this)
  resizePointerup = this.resizePointerup.bind(this)

  dragHandle = E(
    `div`,
    {
      class: `w-1 shrink-0 h-full cursor-ew-resize bg-gray-400 dark:bg-neutral-600 opacity-50 hover:opacity-100 border-r border-gray-300 dark:border-neutral-700`,
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
        class: `flex items-stretch min-w-0 bg-gray-100 text-black dark:bg-base-dark dark:text-white`,
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
    const nextMsg = LogMsg.init(props, ...chi)
    if (!nextMsg) return nextMsg

    const msgLog = this.messageLog
    const prevMsg = msgLog.lastElementChild

    if (prevMsg) {
      // `?.` is used because not all entries are `LogMsg`.
      // For example, `this.removedMessageNotice` is plain.
      prevMsg.unsetLatest?.()
      prevMsg.setIndex?.(msgLog.childElementCount)
    }

    nextMsg.setLatest()
    msgLog.appendChild(nextMsg)
    this.enforceMessageLimit()

    // Scroll all the way to the bottom.
    msgLog.scrollTop = msgLog.scrollHeight
    return nextMsg
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

const LOG_MSG_CLS = `block w-full px-2 font-mono whitespace-pre-wrap overflow-wrap-anywhere border-l-4`
const LOG_MSG_CLS_ERR = `text-red-600 dark:text-red-500 border-red-400 dark:border-red-600`
const LOG_MSG_CLS_INFO = `border-transparent`
const LOG_MSG_CLS_INFO_LATEST = `border-yellow-600 dark:border-yellow-800`
const LOG_MSG_CLS_INFO_EVEN = `border-sky-600 dark:border-sky-800`
const LOG_MSG_CLS_INFO_ODD = `border-emerald-600 dark:border-emerald-800`

export class LogMsg extends dr.MixReg(HTMLPreElement) {
  isErr = undefined

  static init({type} = {}, ...chi) {
    const isErr = type === `err`
    const isInp = type === `inp`

    const msg = msgRen.E(
      new this(),
      {
        class: a.spaced(
          LOG_MSG_CLS,
          a.vac(isErr) && LOG_MSG_CLS_ERR,
          a.vac(isInp) && `animate-flash-light dark:animate-flash-dark`,
        ),
      },
      ...chi,
    )

    const head = msg.firstChild
    if (!head) return undefined

    const pre = LogPrefix(isInp)
    if (a.hasMeth(head, `addLogPrefix`)) head.addLogPrefix(pre)
    else msg.prepend(pre)

    msg.isErr = isErr
    return msg
  }

  setLatest() {
    if (this.isErr) return
    replaceClasses(this, LOG_MSG_CLS_INFO, LOG_MSG_CLS_INFO_LATEST)
  }

  unsetLatest() {
    if (this.isErr) return
    replaceClasses(this, LOG_MSG_CLS_INFO_LATEST, LOG_MSG_CLS_INFO)
  }

  setIndex(ind) {
    if (!a.optNat(ind)) return
    if (this.isErr) return

    replaceClasses(
      this,
      LOG_MSG_CLS_INFO,
      (ind % 2 ? LOG_MSG_CLS_INFO_ODD : LOG_MSG_CLS_INFO_EVEN),
    )
  }
}

export const PROMPT_PREFIX = `>`

function LogPrefix(inp) {
  return withTooltip({
    chi: timeFormat.format(Date.now()),
    elem: E(
      `span`,
      {class: a.spaced(CLS_TEXT_GRAY, `cursor-help`)},
      inp ? PROMPT_PREFIX + ` ` : `< `,
    )
  })
}

/*
Special renderer just for log messages. Supports falling back on `a.show` for
non-stringable data structures. Unfortunately the library code doesn't support
this properly, so we had to duplicate some of its logic.
*/
const msgRen = new class MsgRen extends p.Ren {
  appendChi(tar, src) {
    if (a.hasMeth(src, `toNode`)) src = src.toNode()
    if (a.isNil(src)) return undefined
    if (a.isStr(src)) return tar.append(src)
    if (a.isNode(src)) return tar.appendChild(src)
    if (p.isRaw(src)) return this.appendRaw(tar, src)
    if (a.isSeq(src)) return this.appendSeq(tar, src)
    const out = a.renderOpt(src)
    if (out) return this.appendChi(tar, out)
    return this.appendChi(tar, a.show(src))
  }
}()

export function LogWords(...chi) {return intersperseOpt(chi, ` `)}
export function LogLines(...chi) {return intersperseOpt(chi, LogNewline)}
export function LogParagraphs(...chi) {return intersperseOpt(chi, LogNewlines)}
export function LogNewline() {return `\n`}
export function LogNewlines() {return `\n\n`}

export function removeClasses(tar, src) {tar.classList.remove(...splitCliArgs(src))}
export function addClasses(tar, src) {tar.classList.add(...splitCliArgs(src))}

export function replaceClasses(tar, prev, next) {
  removeClasses(tar, prev)
  addClasses(tar, next)
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
export function optSig(val) {return a.opt(val, isSig)}

/*
The recommended way to wait for async operations. The signal is used for
cancelation. The signal assertion prevents programmer errors such as
accidentally passing a non-signal. Usage:

  await u.wait(sig, someAsyncFun())

When cancelation is undesirable, use `u.sig`.
*/
export function wait(sig, ...src) {
  reqSig(sig)
  if (!src.length) return undefined
  src.push(sig)
  return Promise.race(src)
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

export class ErrAbort extends su.Err {}

export function isErrAbort(err) {return errIs(err, isErrAbortAny)}

function isErrAbortAny(val) {
  return a.isInst(val, ErrAbort) || a.isErrAbort(val)
}

/*
Gets special treatment in the log, which appends the error's original nodes
instead of its message string.
*/
export class ErrLog extends su.Err {
  constructor(...nodes) {
    const msg = E(`pre`, {}, ...nodes).textContent
    super(msg)
    this.nodes = nodes
  }

  // Special interface used by `logShow`.
  toNode() {return this.nodes}
}

/*
Usage:

  u.darkModeMediaQuery.matches
  u.darkModeMediaQuery.addEventListener(`change`, someListener)
  function someListener(eve) {console.log(eve.matches)}
*/
export const darkModeMediaQuery = window.matchMedia(`(prefers-color-scheme: dark)`)

export function boundInd(ind, len) {
  a.reqInt(ind)
  a.reqInt(len)
  if (ind >= 0 && ind <= len) return ind
  return len
}

/*
Unlike the old `document.execCommand` API, this can be used programmatically
at any time while the document is focused.
*/
export async function copyToClipboard(src, report) {
  await navigator.clipboard.writeText(a.render(src))
  if (report) LOG.info(`copied to clipboard: `, src)
  return true
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

export function isHelpFlag(val) {return val === `-h` || val === `--help`}
export function hasHelpFlag(args) {return a.some(args, isHelpFlag)}

export function cliArgSet(cmd, args) {
  a.reqValidStr(cmd)
  a.reqStr(args)
  return new Set(splitCliArgs(stripPreSpaced(args, cmd)))
}

export function firstCliArg(src) {return splitCliArgs(src)[0]}

// TODO support quotes.
export function splitCliArgs(src) {return a.split(src, /\s+/)}

export function cliDecode(src) {return splitCliArgs(src).map(cliDecodeArg)}

/*
TODO:
  * Support a set of operators: = < > ≤ ≥ ≠
  * Consider supporting ASCII digraphs: = == < <= >= > != <>
  * Return {key, val, op, src}
  * Support them in plot aggs
*/
export function cliDecodeArg(src) {
  const ind = src.indexOf(`=`)
  if (ind >= 0) {
    return [src.slice(0, ind), src.slice(ind + `=`.length), src]
  }
  if (src.startsWith(`-`)) return [src, ``, src]
  return [``, src, src]
}

export function cliEncodePair([key, val]) {
  a.reqStr(key)
  a.reqStr(val)
  if (!key) return val
  if (!val && key.startsWith(`-`)) return key
  return key + `=` + val
}

export function cliEq(key, val) {
  return a.reqStr(key) + `=` + a.reqStr(val)
}

export function cliGroup(src) {
  const flags = a.Emp()
  const args = []
  for (const [key, val] of src) {
    if (key) su.dictPush(flags, key, val)
    else args.push(val)
  }
  return [flags, args]
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

export const LOCAL_LOCKS = a.Emp()

/*
For locks within one browsing context. Unfortunately the Web Locks API does not
provide this functionality. We have cases where locking across all tabs would
be incorrect. One such example is loading data from local round files, when
concurrently preparing multiple plots from local data. It needs locking to
avoid redundantly adding the same round to the same dat object, but the locking
needs to be scoped only to the current browsing context. Otherwise one tab
would temporarily block others from loading plots. Now granted, it's almost
impossible to be concurrently loading local data across multiple tabs, at least
in a useful way. But it would still be incorrect. This also has less overhead.
*/
export async function localLock(sig, name) {
  reqSig(sig)
  a.reqValidStr(name)

  for (;;) {
    const lock = LOCAL_LOCKS[name]
    if (!lock) break
    await lock
  }

  const {promise, resolve} = Promise.withResolvers()
  LOCAL_LOCKS[name] = promise

  return function unlock() {
    if (LOCAL_LOCKS[name] === promise) delete LOCAL_LOCKS[name]
    resolve()
  }
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
  return listenData(tar, DEFAULT_EVENT_TYPE, fun, opt)
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
export function listenData(tar, type, fun, opt) {
  a.reqStr(type)
  a.reqFun(fun)
  a.optObj(opt)
  function onEvent(src) {fun(eventData(src))}
  return listenEvent(tar, type, onEvent, opt)
}

/*
A safer wrapper for `.addEventListener`/`.removeEventListener` that returns a
cleanup function. Prevents common misuse of `.removeEventListener` where the
calling code accidentally passes a different reference than the one which was
passed to `.addEventListener`.
*/
export function listenEvent(tar, type, han, opt) {
  a.reqStr(type)
  tar.addEventListener(type, han, opt)
  return function unlisten() {tar.removeEventListener(type, han, opt)}
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
  // Workaround for a minor bug in the original method, which always expects
  // at least one input.
  join(...src) {return src.length ? super.join(...src) : ``}

  cleanTop(src) {return a.stripPre(super.clean(src), this.dirSep)}

  splitTop(src) {return a.split(this.cleanTop(src), this.dirSep)}

  splitRel(src) {
    src = this.clean(src)
    if (this.isRel(src)) return a.split(src, this.dirSep)
    throw Error(`${a.show(src)} is not a relative path`)
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
through functions or field patterns for each tested value. See `./bench.mjs`.

SYNC[field_pattern].
*/
export function whereFields(src) {
  const tests = a.mapCompact(a.entries(src), whereField)
  if (!tests.length) return undefined

  return Function(`
return function whereFields(val) {return ${tests.join(` && `)}}
`)()
}

function whereField([key, src]) {
  a.reqStr(key)
  src = a.values(src)
  if (!src.length) return undefined

  const out = []
  for (const val of src) {
    out.push(`val[${a.show(key)}] === ${a.show(a.reqPrim(val))}`)
  }
  return `(` + out.join(` || `) + `)`
}

export function intersperseOpt(src, val) {
  return intersperse(a.compact(src), val)
}

export function intersperse(src, val) {
  a.reqSome(val)
  const buf = []
  for (src of a.values(src)) buf.push(src, callOpt(val))
  buf.pop()
  return buf
}

export function callOpt(val) {return a.isFun(val) ? val() : val}

/*
In a few places we suggest appending `?<some_stuff>` to the URL query.
Most users wouldn't know that if there's already stuff in the query,
then you must append with `&` rather than `?`. And it's a pain even
if you know it. Frankly, whoever designed the format made a mistake.
So we rectify it.
*/
export function urlQuery(src) {
  return new URLSearchParams(a.split(src, `?`).join(`&`))
}

export function BtnUrlAppend(val) {
  const href = window.location.href + a.reqValidStr(val)
  return FakeBtnInline({href, chi: val})
}

/*
Using `<a>` for pseudo-buttons should generally be avoided.

If you're reading this code, remember two things:
- Use `<a>` for ALL links, and for almost nothing else (with this one exception
  explained below).
- Use `<button>` for all programmatic click actions and form submissions,
  and for NOTHING ELSE.
  - But mind `<input>`, `<select><option>`, `<details><summary>`, `<dialog>`,
    and more...
- Or the third more general thing: use built-in semantically-appropriate
  elements with good accessibility support.

But in this case, the browser rendering engines have left us no choice. It seems
that the native `<button>` cannot be made actually properly inline. Even with
`display: inline` and all available wrapping and word-breaking properties set,
native buttons don't play well with text. When internal text is too long, a
button doesn't wrap like a normal inline element; first it breaks out of its
line, then it wraps, and then it forces subsequent text to be placed on a new
line. Madness, which is very inconvenient in our app, where very long text in
buttons is common. The same problem applies to `<input type="button">` which
seems equivalent to `<button>` in current engines.

Using `<a>` for pseudo-buttons also comes with a bonus: the user can
middle-click / ctrl-click / cmd-click to open the link in another tab.
Which is why we require the `href` to be provided.
*/
export function FakeBtnInline({onclick, href, chi, trunc, width}) {
  a.optFun(onclick)
  a.optStr(width)
  href = a.reqValidStr(a.render(href))

  if (trunc && !width) throw Error(`truncation requires width`)

  return E(
    `a`,
    {
      href,
      class: a.spaced(
        CLS_BTN_INLINE,
        a.vac(trunc) && `trunc`,
        width,
      ),
      onkeydown: a.vac(onclick) && function fakeBtnOnKeydown(eve) {
        if (a.isEventModified(eve)) return
        if (eve.key === `Enter`) this.onclick(eve)
        if (eve.key === ` `) this.onclick(eve)
      },
      onclick: a.vac(onclick) && function fakeBtnOnclick(eve) {
        if (a.isEventModified(eve)) return
        onclick(eve)
      },
    },
    chi ?? href,
  )
}

export const ICON_BTN_SIZE = `1em`

/*
When using an SVG in a button, this must be set on BOTH.
Otherwise dimensions and vertical alignment are out of whack.
The `display: inline` property seems optional but added just in case.
*/
const CLS_INLINE_ICON = `inline w-[${ICON_BTN_SIZE}] h-[${ICON_BTN_SIZE}] align-text-top`

export function BtnClip(val) {
  val = a.renderLax(val)
  if (!val) return undefined

  return withTooltip({
    chi: `clipboard`,
    elem: E(
      `button`,
      {
        type: `button`,
        class: a.spaced(CLS_INLINE_ICON, `cursor-pointer hover:text-sky-700 dark:hover:text-sky-300`),
        onclick() {copyToClipboard(val, true).catch(logErr)},
      },
      SvgClipboard(),
    ),
  })
}

function SvgClipboard() {return Svg(`clipboard`, {class: CLS_INLINE_ICON})}

const SPRITE_PATH = `./client/svg.svg` + (API_LOCAL ? `?` + Date.now() : ``)

export function Svg(key, attr) {
  return S(`svg`, attr,
    S(`use`, {href: SPRITE_PATH + `#` + a.reqValidStr(key)}),
  )
}

// Each row must begin with a string. We align on that string by padding it.
export function alignCol(rows) {
  rows = a.compact(rows)
  const max = maxBy(rows, rowPreLen) | 0
  const alignRow = ([head, ...tail]) => [head.padEnd(max, ` `), ...tail]
  return a.map(rows, alignRow)
}

function rowPreLen(src) {return a.reqStr(a.reqArr(src)[0]).length}

// Suboptimal implementation.
export function preSpacedOpt(src, pre) {
  return a.spaced(pre, stripPreSpaced(src, pre))
}

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

export function randInt(min, max) {
  const buf = crypto.getRandomValues(new Uint32Array(1))
  return toIntBetween(min, max, buf[0])
}

// The range is inclusive: `[min, max]`.
function toIntBetween(min, max, num) {
  a.reqInt(min)
  a.reqInt(max)
  a.reqInt(num)
  return min + Math.floor((num / (0xffffffff + 1)) * (max - min + 1))
}

export function randomSample(src) {
  if (!a.optArr(src)?.length) return undefined
  return src[randInt(0, src.length - 1)]
}

export function randomSamples(src, count) {
  a.optArr(src)
  a.reqNat(count)

  const len = src?.length
  if (!src || !len || !count) return []

  const buf = crypto.getRandomValues(new Uint32Array(count))
  const out = Array(count)
  let ind = -1
  while (++ind < count) out[ind] = src[toIntBetween(0, len - 1, buf[ind])]
  return out
}

export function maxBy(src, fun) {
  a.reqFun(fun)
  let out
  for (src of a.values(src)) {
    src = fun(src)
    if (a.isNil(out) || src > out) out = src
  }
  return out
}

// Single global because we wouldn't want multiple concurrent tooltips anyway.
export const TOOLTIP = E(
  `span`,
  {
    class: a.spaced(
      `fixed py-1 px-2 leading-1 decoration-none whitespace-pre rounded pointer-events-none`,
      `text-white bg-neutral-800 dark:text-black dark:bg-neutral-200`,
      `bg-opacity-60 dark:bg-opacity-60`,
    ),
    style: {
      transform: `translate(-50%, calc(-100% - 0.5rem))`,
      backdropFilter: `blur(2px)`,
    },
  },
)

let TOOLTIP_LAST_ELEM

// TODO: remove the tooltip from the DOM when the element leaves the DOM.
export function withTooltip({elem, chi}) {
  if (!a.vac(chi)) return a.optElement(elem)
  a.reqElement(elem)
  elem.onpointerover = function reinit(eve) {tooltipReinitFor(elem, chi, eve)}
  elem.onpointermove = function reinit(eve) {tooltipReinitFor(elem, chi, eve)}
  elem.onpointerleave = function deinit() {tooltipDeinitFor(elem)}
  return elem
}

/*
Probably like 5 times more complicated and 10 times slower than it could be.
TODO improve.
*/
export function ellMid(src, max) {
  src = a.laxStr(src)
  a.reqInt(max)
  if (src.length <= max) return src
  if (!(max > 0)) return ``

  const chars = [...src]
  if (chars.length <= max) return src

  const inf = `…`
  let lenPre = (max / 2) | 0
  let lenSuf = (max / 2) | 0

  while ((lenPre + lenSuf) >= max) {
    if (lenSuf > 0) lenSuf--
    else if (lenPre > 0) lenPre--
    else break
  }
  return chars.slice(0, lenPre).concat(inf).concat(chars.slice(-lenSuf)).join(``)
}

/*
`capture` is required for detecting scroll inside elements.
`passive` indicates we don't prevent default, good for scroll performance.
*/
const SCROLL_LISTEN_OPT = {passive: true, capture: true, once: true}

function tooltipReinitFor(elem, chi, eve) {
  a.reqElement(elem)

  if (TOOLTIP_LAST_ELEM !== elem) E(TOOLTIP, {}, chi)
  TOOLTIP_LAST_ELEM = elem

  /*
  TODO: snap to the element rather than the cursor, and remove the `pointermove`
  listener. In plots, we snap tooltips to data points, which are, well, points.
  For sized elements such as buttons, we'd have to figure out where in relation
  to the element to position the tooltip. And elements can be partially outside
  of the viewport.
  */
  tooltipOrient({
    elem: TOOLTIP,
    posX: eve.clientX,
    posY: eve.clientY,
    wid: window.innerWidth,
    hei: window.innerHeight,
    off: `0.5rem`,
  })

  if (!TOOLTIP.isConnected) {
    document.body.appendChild(TOOLTIP)
    document.addEventListener(`scroll`, tooltipDeinit, SCROLL_LISTEN_OPT)
  }
}

function tooltipDeinitFor(elem) {
  if (TOOLTIP_LAST_ELEM === elem) tooltipDeinit()
}

function tooltipDeinit() {
  TOOLTIP.remove()
  TOOLTIP_LAST_ELEM = undefined
  document.removeEventListener(`scroll`, tooltipDeinit, SCROLL_LISTEN_OPT)
}

export function tooltipOrient({elem, posX, posY, wid, hei, off}) {
  a.reqElement(elem)
  a.reqFin(posX)
  a.reqFin(posY)
  a.reqFin(wid)
  a.reqFin(hei)
  a.optStr(off)

  const isRig = posX > (wid / 2)
  const isBot = posY > (hei / 2)
  const tran = off ? `calc(-100% - ${off})` : `-100%`
  const tranX = isRig ? tran : (off || `0`)
  const tranY = isBot ? tran : (off || `0`)

  elem.style.left = posX + `px`
  elem.style.top = posY + `px`
  elem.style.transform = `translate(${tranX}, ${tranY})`
}

export function Bold(...chi) {
  return E(`b`, {}, ...chi)
}

export function Muted(...chi) {
  return E(`span`, {class: CLS_TEXT_GRAY}, ...chi)
}
