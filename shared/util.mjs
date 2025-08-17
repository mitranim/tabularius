/*
Micro utils shared by server and client code.
Server-only utils should be placed in `../server/util.mjs`.
Client-only utils should be placed in `../client/util.mjs`.
*/

import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import nc from 'tweetnacl'

export function isValidTextData(val) {
  return a.isStr(val) || a.isInst(val, Uint8Array)
}

export function optValidTextData(val) {
  return a.isNil(val) ? undefined : reqValidTextData(val)
}

export function reqValidTextData(val) {
  if (isValidTextData(val)) return val
  throw TypeError(`text data must be a string or a Uint8Array, got ${a.show(val)}`)
}

export class Err extends Error {get name() {return this.constructor.name}}

export class ErrDecoding extends Err {}

export function isErrDecoding(err) {return a.isInst(err, ErrDecoding)}

/*
How many digits to use for ordinal components of ids of runs and rounds. Needs
to be long enough for any realistic amount of runs and rounds, and short enough
to easily type.
*/
export const PADDED_INT_LEN = 4

export function intPadded(val) {
  return String(a.reqInt(val)).padStart(PADDED_INT_LEN, `0`)
}

export function isArrOfStr(val) {return a.isArrOf(val, a.isStr)}
export function reqArrOfStr(val) {return a.reqArrOf(val, a.isStr)}
export function optArrOfStr(val) {return a.optArrOf(val, a.isStr)}
export function laxArrOfStr(val) {return a.optArrOf(val, a.isStr) ?? []}

export function isArrOfValidStr(val) {return a.isArrOf(val, a.isValidStr)}
export function reqArrOfValidStr(val) {return a.reqArrOf(val, a.isValidStr)}
export function optArrOfValidStr(val) {return a.optArrOf(val, a.isValidStr)}
export function laxArrOfValidStr(val) {return a.optArrOf(val, a.isValidStr) ?? []}

export function indent(src) {return a.optStr(src) ? `  ` + src : ``}
export function indentNode(src) {return a.vac(src) && [`  `, src]}

export function indentNodes(src, lvl) {
  src = a.values(src)
  const indent = `  `.repeat(a.reqNat(lvl))
  if (!indent) return src
  return a.map(src, val => [indent, val])
}

export function joinKeys(...src) {return a.joinOptLax(src, `_`)}
export function joinLines(...src) {return a.joinLinesOptLax(src)}
export function joinParagraphs(...src) {return a.joinOptLax(src, `\n\n`)}

export function splitKeys(src) {return a.split(src, `_`)}

export function isIdent(val) {
  return a.isStr(val) && /^[a-z][a-z_0-9]{1,255}$/
}

export function reqIdent(val) {return a.req(val, isIdent)}

/*
Very permissive conversion to an integer. When the input is a string, this may
parse its prefix. Fractional syntax is not supported because of ambiguity with
file extensions.

  123            -> 123
  123_<id>       -> 123
  123.<ext>      -> 123
  123_<id>.<ext> -> 123
*/
export function toNatOpt(val) {
  if (a.isNat(val)) return val
  if (a.isStr(val)) return a.onlyNat(parseInt(val))
  return undefined
}

export function toNatReq(src) {
  if (a.isNat(src)) return src
  if (a.isStr(src)) {
    const val = parseInt(src)
    if (a.isNat(val)) return val
  }
  throw TypeError(`expected a positive integer or a string starting with a positive integer, got ${a.show(src)}`)
}

export function hasIntPrefix(val) {return a.isStr(val) && a.isSome(toNatOpt(val))}

export function compareAsc(one, two) {
  return compareNumerically(one, two, false)
}

export function compareDesc(one, two) {
  return compareNumerically(one, two, true)
}

/*
Similar to regular JS sorting, but prefers to sort numerically. When inputs are
numbers, they're used as-is. For strings, we attempt to parse an integer prefix
when available. We don't attempt to parse floating point numbers from input
strings because their dot-syntax is ambiguous with file extensions. Numbers
always come before other values. Falls back on regular JS sorting.
*/
export function compareNumerically(prev, next, desc) {
  a.reqBool(desc)
  const one = toNatOpt(prev) ?? a.onlyFin(prev)
  const two = toNatOpt(next) ?? a.onlyFin(next)

  if (a.isNil(one) && a.isNil(two)) {
    return (a.compare(prev, next) * (desc ? -1 : 1)) | 0
  }

  if (a.isNil(one)) return 1
  if (a.isNil(two)) return -1

  if (one < two) return desc ? 1 : -1
  if (one > two) return desc ? -1 : 1
  return 0
}

export function avg(src) {return a.values(src).reduce(accAvg, 0)}

export function accSum(one, two) {return a.laxFin(one) + a.laxFin(two)}

export function accAvg(acc, val, ind) {
  acc = a.laxFin(acc)
  a.reqFin(val)
  a.reqNat(ind)
  return acc + (val - acc) / (ind + 1)
}

export function accCount(_, __, ind) {
  return a.isInt(ind) ? ind + 1 : 0
}

/*
Hybrid of the JS `Array..reduce` behavior, and the SQL aggregation behavior,
where nils / nulls are ignored.

SYNC[fold_not_nil].
*/
export function foldSome(src, acc, fun) {
  a.reqFun(fun)
  let count = 0
  for (src of a.values(src)) {
    if (a.isNil(src)) continue
    acc = fun(acc, src, count++)
  }
  return acc
}

// TODO add to `@mitranim/js`.
export function isPlainDict(val) {return a.isNil(Object.getPrototypeOf(val))}
export function reqPlainDict(val) {return a.req(val, isPlainDict)}

/*
TODO add to `@mitranim/js`. Similar to `{__proto__: null, <...val>}`,
but syntactically cleaner.
*/
export function dict(val) {return a.assign(a.Emp(), val)}
export function dictOpt(val) {return a.isNil(val) ? val : dict(val)}

export function dictPop(tar, key) {
  try {return tar[key]} finally {delete tar[key]}
}

export function dictPush(tar, key, val) {
  a.reqDict(tar)
  a.reqRecKey(key)
  tar[key] = a.laxArr(tar[key])
  tar[key].push(val)
}

export function mapUniq(src, fun) {
  a.reqFun(fun)
  const set = new Set()
  for (src of a.values(src)) set.add(fun(src))
  return a.arr(set)
}

export function uniqBy(src, fun) {
  a.reqFun(fun)
  const set = new Set()
  const out = []
  for (src of a.values(src)) {
    const key = a.reqKey(fun(src))
    if (set.has(key)) continue
    set.add(key)
    out.push(src)
  }
  return out
}

export function uniqArr(src) {return a.arr(a.toSet(src))}

export function arrOfUniqValidStr(src) {
  const out = new Set()
  for (src of a.values(src)) if (a.optStr(src)) out.add(src)
  return a.arr(out)
}

export function jsonDecodeOpt(src, fun) {
  return isStrJsonLike(src) ? a.jsonDecode(src, fun) : undefined
}

export function jsonEncodeIndent(src, enc) {return a.jsonEncode(src, enc, 2)}

/*
Should be used when there's a possibility of dictionary keys in JSON data
conflicting with properties of `Object.prototype`, which shouldn't be possible
in our particular app, or when logging and browsing data in devtools, because
null-prototype objects look cleaner. Should be avoided in other cases due to
performance overhead.
*/
export function jsonDecoder(_, src) {
  if (a.isObj(src) && Object.getPrototypeOf(src) === Object.prototype) {
    const out = a.Emp()
    for (const key in src) out[key] = src[key]
    return out
  }
  return src
}

function isStrJsonLike(src) {
  src = a.trim(src)
  return (
    src === `null` ||
    src === `false` ||
    src === `true` ||
    /^-?\d/.test(src) ||
    src.startsWith(`"`) ||
    src.startsWith(`{`) ||
    src.startsWith(`[`)
  )
}

/*
Decodes the content of a `.gd` file.
TD normally encodes them like this:

  data -> json -> gzip -> base64

However, sometimes TD encodes them like this:

  data -> json
*/
export async function decodeGdStr(src) {
  src = a.trim(src)

  /*
  Try direct JSON decoding first. Mostly intended for non-compressed JSON files
  created and used by our app, though unlike TD, we use the plain `.json`
  extension. Not expected to throw unless JSON is corrupted, in which case
  manual user intervention may be needed.
  */
  const out = jsonDecodeOpt(src)
  if (a.isSome(out)) return out

  /*
  As fallback, try un-base64 -> un-gzip -> un-JSON.
  This is expected to be the most common case for TD files.
  */

  // Enable manually when browsing data in devtools.
  // return a.jsonDecode(await str_to_unbase64_to_ungzip_to_str(src), u.jsonDecoder)

  return a.jsonDecode(await str_to_unbase64_to_ungzip_to_str(src))
}

export function data_to_json_to_gzip_to_base64Str(src) {
  return str_to_gzip_to_base64Str(a.jsonEncode(src))
}

export function data_to_json_to_gzipByteArr(src) {
  return resOkByteArr(new Response(str_to_gzipStream(a.jsonEncode(src))))
}

export function str_to_unbase64_to_ungzip_to_str(src) {
  return textData_to_ungzip_to_str(base64Str_to_byteArr(src))
}

export function textData_to_stream(src) {
  return new Response(reqValidTextData(src)).body
}

export function textDataStream_to_ungzipStream(src) {
  return src.pipeThrough(new DecompressionStream(`gzip`))
}

export function textData_to_ungzipStream(src) {
  return textDataStream_to_ungzipStream(textData_to_stream(src))
}

export async function textDataStream_to_ungzip_to_unjsonData(src) {
  return a.jsonDecode(await textDataStream_to_ungzip_to_str(src))
}

export async function textData_to_ungzip_to_unjsonData(src) {
  return a.jsonDecode(await textData_to_ungzip_to_str(src))
}

export function textDataStream_to_ungzip_to_str(src) {
  return resOkText(new Response(textDataStream_to_ungzipStream(src)))
}

export function textData_to_ungzip_to_str(src) {
  return resOkText(new Response(textData_to_ungzipStream(src)))
}

export async function str_to_gzip_to_base64Str(src) {
  return byteArr_to_base64Str(await str_to_gzipByteArr(src))
}

export function str_to_gzipByteArr(src) {
  return resOkByteArr(new Response(str_to_gzipStream(src)))
}

export function str_to_gzipStream(src) {
  a.reqStr(src)
  return new Response(src).body.pipeThrough(new CompressionStream(`gzip`))
}

/*
Like `res.bytes()` but works in browsers which don't implement it. Status
validation is for network requests; local requests used only for stream
conversion are always ok.
*/
export async function resOkByteArr(src) {
  a.reqInst(src, Response)
  await a.resOk(src)
  return (
    a.toByteArr(await src.bytes?.()) ??
    a.toByteArr(await src.arrayBuffer())
  )
}

export async function resOkText(src) {return (await a.resOk(src)).text()}
export async function resOkJson(src) {return (await a.resOk(src)).json()}

export function fetchByteArr(...src) {return resOkByteArr(fetch(...src))}
export function fetchText(...src) {return resOkText(fetch(...src))}
export function fetchJson(...src) {return resOkJson(fetch(...src))}

const SEG = new Intl.Segmenter(undefined, {granularity: `grapheme`})

export function strLenUni(src) {return a.len(SEG.segment(a.reqStr(src)))}

export function binStr_to_byteArr(src) {
  a.reqStr(src)
  const len = src.length
  const out = new Uint8Array(len)
  let ind = -1
  while (++ind < len) out[ind] = src.charCodeAt(ind)
  return out
}

/*
Could use a `TextDecoder`, but a benchmark (in Deno) seems to massively favor
this implementation. In any case, this is only for testing.
*/
export function byteArr_to_binStr(src) {
  src = a.toByteArr(src)
  let out = ``
  let ind = -1
  while (++ind < src.length) out += String.fromCharCode(src[ind])
  return out
}

// Like `Uint8Array.fromBase64`, which is not yet widely available.
export function base64Str_to_byteArr(src) {
  return binStr_to_byteArr(atob(a.reqStr(src)))
}

export function byteArr_to_base64Str(src) {
  src = a.toByteArr(src)
  let out = ``
  for (src of src) out += String.fromCharCode(src)
  return btoa(out)
}

export function byteArr_to_hexStr(src) {return a.byteArrHex(src)}

// Like `Uint8Array.fromHex`, which is not yet widely available.
export function hexStr_to_byteArr(src) {
  a.reqStr(src)
  if (src.length & 1) {
    throw SyntaxError(`hex string must have even length, got ${src.length}`)
  }
  const len = src.length >> 1
  const out = new Uint8Array(len)
  for (let i = 0, j = 0; i < len; i++, j += 2) {
    const hi = HEX_TABLE[src.charCodeAt(j)]
    const lo = HEX_TABLE[src.charCodeAt(j + 1)]
    if ((hi | lo) & 0xf0) {
      throw SyntaxError(`invalid hex char at ${j}: ${src.slice(j, j + 2)}`)
    }
    out[i] = (hi << 4) | lo
  }
  return out
}

const HEX_TABLE = new Uint8Array(256).fill(0xFF)
for (let i = 0; i < 16; i++) {
  HEX_TABLE[48 + i] = i      // '0'–'9' → 0–9
  HEX_TABLE[65 + i] = 10 + i // 'A'–'F' → 10–15
  HEX_TABLE[97 + i] = 10 + i // 'a'–'f' → 10–15
}

/*
A hardcoded salt is useless for security, but provides domain separation.
We only bother because some algorithms require a salt.

Many more secure approaches to client-only authentication exist. They all come
with UX tradeoffs, and we simply don't care about a handful of impersonations
even if someone bothers to.
*/
const SALT = new Uint8Array([141, 36, 85, 138, 222, 10, 245, 168, 97, 208, 21, 148, 58, 37, 213, 104])

const ENC = new TextEncoder()

export async function pass_to_seedArrBuf(src) {
  a.reqStr(src)
  if ((src !== (src = a.trim(src)))) {
    throw SyntaxError(`a password or passphrase must not contain leading or trailing whitespace`)
  }

  {
    const MIN_LEN = 8
    const len = strLenUni(src)
    if (!(len >= MIN_LEN)) {
      throw SyntaxError(`a password or passphrase must have at least ${MIN_LEN} chars, got ${len} chars`)
    }
  }

  const key = await crypto.subtle.importKey(
    `raw`, ENC.encode(src), {name: `PBKDF2`}, false, [`deriveBits`],
  )

  // Get 256 bits = 32 bytes because that's the seed size used by `Ed25519`.
  const bitLen = 256

  return await crypto.subtle.deriveBits(
    {
      name: `PBKDF2`,
      hash: `SHA-256`,
      salt: SALT,
      iterations: 100_000,
    },
    key,
    bitLen,
  )
}

function req_Ed25519_seed(val) {
  a.reqInst(val, Uint8Array)
  if (val.length !== 32) {
    throw Error(`Ed25519 requires a 32-byte seed, got ${val.length} bytes`)
  }
  return val
}

/*
We're using the `tweetnacl` library because at the time of writing, browsers
don't yet support the `Ed25519` algorithm. In the future, we'll be able to
switch to the native crypto API.
*/
export function seedToKeyPair(seed) {
  return nc.sign.keyPair.fromSeed(req_Ed25519_seed(seed))
}

export function authToken(publicKey, secretKey, nonce = Date.now()) {
  a.reqInt(nonce)
  const msg = byteArr_to_hexStr(publicKey) + `.` + nonce
  const msgBytes = new TextEncoder().encode(msg)
  const sigBytes = nc.sign.detached(msgBytes, secretKey)
  return msg + `.` + byteArr_to_hexStr(sigBytes)
}

export function authHeaderOpt(publicKey, secretKey, nonce) {
  a.optInst(publicKey, Uint8Array)
  a.optInst(secretKey, Uint8Array)
  if (!(publicKey && secretKey)) return undefined
  return [`authorization`, `Bearer ` + authToken(publicKey, secretKey, nonce)]
}

export function authHeadersOpt(publicKey, secretKey, nonce) {
  const head = authHeaderOpt(publicKey, secretKey, nonce)
  return head ? [head] : []
}

/*
Workaround for a problem in Uplot. Contrary to what the documentation claims,
it seems to only support missing values when they're `undefined`, but not when
they're `null`. When generating data locally, we automatically end up with
`undefined` for missing values. But when receiving plot agg data from a remote
endpoint, the encoding and decoding process involves JSON which only supports
`null`, and we have to convert it to `undefined` for the plot.
*/
export function normNil(val) {
  if (a.isNil(val)) return undefined
  if (a.isArr(val)) return a.map(val, normNil)
  if (a.isDict(val)) return a.mapDict(val, normNil)
  return val
}

export function isGameFileName(val) {
  a.reqStr(val)
  return val.endsWith(`.gd`) || val.endsWith(`.json`) || val.endsWith(`.json.gz`)
}

export class Semver extends a.Emp {
  constructor(major, minor, patch) {
    super()
    this.major = a.isSome(major) ? BigInt(major) : 0n
    this.minor = a.isSome(minor) ? BigInt(minor) : 0n
    this.patch = a.isSome(patch) ? BigInt(patch) : 0n
  }

  static fromStringOpt(src) {
    return a.isNil(src) ? undefined : this.fromString(src)
  }

  static fromString(src) {return new this().fromString(src)}

  fromString(src) {
    const parts = a.reqStr(src).replace(/^[vV]\.?/, ``).split(`.`).map(BigInt)
    if (parts.length > 3) throw SyntaxError(`too many parts in semver ${a.show(src)}`)
    const [major, minor, patch] = parts
    this.major = major ?? 0n
    this.minor = minor ?? 0n
    this.patch = patch ?? 0n
    return this
  }

  toString() {return this.major + `.` + this.minor + `.` + this.patch}

  static compare(one, two) {
    a.optInst(one, Semver)
    a.optInst(two, Semver)

    if (a.isSome(one) && a.isNil(two)) return -1
    if (a.isNil(one) && a.isSome(two)) return 1

    if (one.major < two.major) return -1
    if (one.major > two.major) return 1

    if (one.minor < two.minor) return -1
    if (one.minor > two.minor) return 1

    if (one.patch < two.patch) return -1
    if (one.patch > two.patch) return 1

    return 0
  }
}

// Minor extensions for library functionality.
export const paths = new class Paths extends pt.Paths {
  cleanTop(src) {return a.stripPre(super.clean(src), this.dirSep)}

  splitTop(src) {return a.split(this.cleanTop(src), this.dirSep)}

  splitRel(src) {
    src = this.clean(src)
    if (this.isRel(src)) return a.split(src, this.dirSep)
    throw Error(`${a.show(src)} is not a relative path`)
  }

  withNameSuffix(src, suf) {
    a.reqValidStr(src)
    a.reqValidStr(suf)
    const dir = this.dir(src)
    const base = this.name(src)
    const seg = base.split(this.extSep)
    seg[0] += suf
    return this.join(dir, seg.join(this.extSep))
  }

  replaceExt(src, next) {
    a.reqStr(src)
    a.reqStr(next)
    const prev = this.ext(src)
    src = src.slice(0, -prev.length)
    return src + next
  }
}()

export function headHas(src, key, val) {
  a.reqInst(src, Headers)
  a.reqStr(key)
  a.reqStr(val)
  return a.laxStr(src.get(key)).split(`,`).map(a.trim).map(a.lower).includes(val)
}

export function headHasGzip(src) {
  return headHas(src, `content-encoding`, `gzip`)
}
