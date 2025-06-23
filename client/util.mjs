import * as a from '@mitranim/js/all.mjs'
export * from '../shared/util.mjs'

import * as u from './util.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.u = u
namespace.lib ??= a.Emp()
namespace.lib.a = a
a.patch(globalThis, namespace)

export const URL_CLEAN = new URL(globalThis.location)
URL_CLEAN.search = ``
URL_CLEAN.hash = ``

export const QUERY = urlQuery(globalThis.location.search)
export const DEV = a.boolOpt(QUERY.get(`dev`))
export const API_LOCAL = a.boolOpt(QUERY.get(`local`))
export const API_URL = API_LOCAL ? `/api/` : `https://tabularius.mitranim.com/api/`

/*
export function storageGetJson(store, key) {
  const src = store.getItem(key)
  if (!src) return undefined

  try {return a.jsonDecode(src)}
  catch (err) {
    LOG.err(`unable to decode ${a.show(src)}, deleting ${a.show(key)} from storage`)
    storageSet(store, key)
    return undefined
  }
}
*/

export function storagesGet(key) {
  a.reqValidStr(key)
  return (
    QUERY.get(key) ??
    sessionStorage.getItem(key) ??
    localStorage.getItem(key)
  )
}

export function storagesSet(key, val) {
  storageSet(sessionStorage, key, val)
  storageSet(localStorage, key, val)
}

export function storageSet(store, key, val) {
  a.reqValidStr(key)

  if (a.isNil(val)) {
    if (a.hasOwnEnum(store, key)) store.removeItem(key)
    return true
  }

  try {val = a.render(val)}
  catch (err) {
    logErr(`unable to store ${a.show(key)}: `, err)
    return false
  }

  try {
    store.setItem(key, val)
    return true
  }
  catch (err) {
    logErr(`unable to store ${a.show(key)} = ${a.show(val)}: `, err)
    return false
  }
}

export const STORAGE_OBS = new Map()

export function storageObs(...src) {return new StorageObs(...src)}

// An observable with storage persistence. Reads and writes lazily as needed.
export class StorageObs extends a.ObsRef {
  inited = false
  key = undefined
  def = undefined

  constructor(key, val) {
    super()
    this.key = a.reqValidStr(key)
    this.def = val
    return new.target.dedup(this)
  }

  get() {
    if (!this.inited) {
      this.inited = true
      super.set(this.read())
    }
    return super.get() ?? this.def
  }

  set(val) {
    this.inited = true
    return super.set(val) && (this.write(val), true)
  }

  decode(val) {return val}
  encode(val) {return val}

  read() {
    const src = storagesGet(this.key)
    if (!src) return this.def
    return this.decode(src)
  }

  write(val) {storagesSet(this.key, this.encode(val))}

  static dedup(next) {
    const {key} = a.reqInst(next, this)
    const prev = STORAGE_OBS.get(key)

    if (!prev) {
      STORAGE_OBS.set(key, next)
      return next
    }

    const prevCon = prev.constructor
    const nextCon = next.constructor
    if (prevCon === nextCon) return prev
    throw Error(`redundant ${new.target.name} with key ${a.show(key)} with different constructors: ${a.show(prevCon)} vs ${a.show(nextCon)}`)
  }
}

export function storageObsBool(...src) {return new StorageObsBool(...src)}

export class StorageObsBool extends StorageObs {
  decode(src) {return a.laxBool(a.boolOpt(src))}
  encode(src) {return a.renderOpt(src)}
}

export function storageObsFin(...src) {return new StorageObsFin(...src)}

export class StorageObsFin extends StorageObs {
  decode(src) {return a.onlyFin(parseFloat(src))}
  encode(src) {return a.isNil(src) ? undefined : String(a.reqFin(src))}
}

export function storageObsJson(...src) {return new StorageObsJson(...src)}

export class StorageObsJson extends StorageObs {
  decode(src) {return u.jsonDecodeOpt(src, u.jsonDecoder)}
  encode(src) {return a.jsonEncode(src)}
}

export const VERBOSE = storageObsBool(`tabularius.verbose`)

cmdVerbose.cmd = `verbose`
cmdVerbose.desc = `toggle between quiet and verbose logging`

export async function cmdVerbose({args}) {
  if (u.hasHelpFlag(u.splitCliArgs(args))) {
    const os = await import(`./os.mjs`)
    return os.cmdHelpDetailed(cmdVerbose)
  }

  const val = VERBOSE.val = !VERBOSE.val
  return `logging is now ` + (val ? `verbose` : `selective`)
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
cancelation. Usage:

  await u.wait(sig, someAsyncFun())

When cancelation is undesirable, use `u.sig`.
*/
export function wait(sig, ...src) {
  reqSig(sig)
  if (!src.length) return undefined
  src.push(sig)
  return Promise.race(src)
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

// Workaround for our cyclic dependency between modules.
async function logErr(...src) {
  const ui = await import(`./ui_log.mjs`)
  ui.LOG.err(...src)
}

export class ErrAbort extends u.Err {}

export function isErrAbort(err) {return errIs(err, isErrAbortAny)}

function isErrAbortAny(val) {
  return a.isInst(val, ErrAbort) || a.isErrAbort(val)
}

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
  if (report) {
    const ui = await import(`./ui.mjs`)
    ui.LOG.info(`copied to clipboard: `, src)
  }
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

export function hasPreSpaced(src, pre) {
  src = a.laxStr(src)
  pre = a.laxStr(pre)

  return !!pre && src.startsWith(pre) && (
    src.length === pre.length ||
    src.slice(pre.length)[0] === ` `
  )
}

export function stripPreSpaced(src, pre) {
  if (!hasPreSpaced(src, pre)) return a.laxStr(src)
  return src.slice(pre.length).trim()
}

// TODO support quotes.
export function splitCliArgs(src) {return a.split(src, /\s+/)}

export function cliArgHead(src) {
  const ind = a.reqStr(src).indexOf(` `)
  return ind >= 0 ? src.slice(0, ind) : src
}

export function cliArgTail(src) {
  const ind = a.reqStr(src).indexOf(` `)
  return ind >= 0 ? src.slice(ind + 1) : ``
}

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
  return a.reqStr(key) + `=` + a.renderLax(val)
}

export function cliEqs(...pairs) {
  const buf = []
  for (const pair of pairs) {
    const [key, val] = a.reqArr(pair)
    a.reqValidStr(key)
    if (a.isNil(val)) continue
    buf.push(cliEq(key, val))
  }
  return buf.join(` `)
}

export function cliGroup(src) {
  const flags = a.Emp()
  const args = []
  for (const [key, val] of src) {
    if (key) u.dictPush(flags, key, val)
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
  a.optRec(opt)
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
be suboptimal. One such example is loading data from local round files, when
concurrently preparing multiple plots from local data. It needs locking to
avoid redundantly adding the same round to the same dat object, but the locking
needs to be scoped only to the current browsing context. Otherwise one tab
would temporarily block others from loading plots. Admittedly, it's almost
impossible to be concurrently loading local data across multiple tabs, at least
in a useful way. But at the very least, this has less overhead.
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

export const REG_DEINIT = new FinalizationRegistry(function finalizeDeinit(val) {
  if (a.isFun(val)) val()
  else val.deinit()
})

/*
Allows to tie the lifetime of `a.recur` to the lifetime of another object
such as a DOM element, preventing it from being GCd too early.
*/
export const RETAIN = new WeakMap()
export function retain(tar, val) {RETAIN.set(a.reqObj(tar), a.reqObj(val))}

/*
We have several event targets (`BROAD` and `DAT`). `BroadcastChannel`
prioritizes `message` events; they're dispatched when using `.postMessage`.
Sometimes we pass them along to other event targets. So for simplicity,
we just use this event type for everything.
*/
export const DEFAULT_EVENT_TYPE = `message`

export const BROAD = new BroadcastChannel(`tabularius_broadcast`)

BROAD.onmessage = function onBroadcastMessage(eve) {
  if (!VERBOSE.val) return
  console.log(`broadcast message event:`, eve)
}

BROAD.onmessageerror = function onBroadcastError(eve) {
  if (!VERBOSE.val) return
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
  a.optRec(opt)
  function onEvent(src) {fun(eventData(src))}
  return listenEvent(tar, type, onEvent, opt)
}

export function eventData(src) {
  a.reqInst(src, Event)
  return (
    src.data || // `MessageEvent`
    src.detail  // `CustomEvent`
  )
}

/*
A safer wrapper for `.addEventListener`/`.removeEventListener` that returns a
cleanup function. Prevents common misuse of `.removeEventListener` where the
calling code accidentally passes a different reference than the one which was
passed to `.addEventListener`. In addition, this only keeps a weak reference
to the target.
*/
export function listenEvent(tar, type, han, opt) {
  a.reqStr(type)
  tar.addEventListener(type, han, opt)
  return function unlisten() {tar.removeEventListener(type, han, opt)}
}

export function dispatch(tar, type, data) {
  tar.dispatchEvent(new CustomEvent(a.reqStr(type), {detail: data}))
}

export class Listener extends WeakRef {
  tar = undefined
  args = undefined

  constructor(ref) {
    super(ref)
    REG_DEINIT.register(ref, this)
  }

  init(tar, type, fun, opt) {
    a.reqRec(tar)
    a.reqStr(type)
    a.reqFun(fun)

    const onEvent = (eve) => {
      const ref = this.deref()
      if (ref) fun.call(ref, eve)
      else this.deinit()
    }

    this.deinit()
    this.tar = tar
    this.args = [type, onEvent, opt]
    tar.addEventListener(...this.args)
  }

  deinit() {
    const {tar, args} = this
    if (tar && args) tar.removeEventListener(...args)
    this.tar = this.args = undefined
  }
}

export function filterWhere(src, where) {
  src = a.values(src)
  where = whereFields(where)
  if (!where) return src
  return a.filter(src, where)
}

/*
For large-ish datasets, a function compiled on the fly, with inlined tests
without loops, seems to perform better than a version that loops through
functions or field patterns for each tested value. See `./bench.mjs`.

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

// Each row must begin with a string. We align on that string by padding it.
export function alignCol(rows) {
  rows = a.compact(rows)
  const max = maxBy(rows, rowPreLen) | 0
  const alignRow = ([head, ...tail]) => [head.padEnd(max, ` `), ...tail]
  return a.map(rows, alignRow)
}

function rowPreLen(src) {return a.reqStr(a.reqArr(src)[0]).length}

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

export function clampFin(min, val, max) {
  return Math.max(a.reqFin(min), Math.min(a.reqFin(val), a.reqFin(max)))
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

export function entrios(src) {
  const out = []
  const keys = a.structKeys(src)
  let ind = -1
  while (++ind < keys.length) {
    const key = keys[ind]
    out.push([ind, key, src[key]])
  }
  return out
}

// Counterpart to `a.ancestor`. The library doesn't provide "last ancestor".
export function lastAncestor(tar, cls) {
  a.reqElement(tar)
  a.reqCls(cls)

  let out
  while (tar) {
    if (a.isInst(tar, cls)) out = tar
    tar = tar.parentNode
  }
  return out
}

export function isEventModifiedPrimary(eve) {
  return (
    a.isEvent(eve) &&
    !eve.altKey &&
    !eve.shiftKey &&
    (eve.ctrlKey || eve.metaKey)
  )
}

export function btnOnKeydown(fun, eve) {
  a.reqFun(fun)
  if (a.isEventModified(eve)) return
  if (eve.key === `Enter` || eve.key === ` `) {
    a.eventKill(eve)
    fun.call(this, eve)
  }
}
