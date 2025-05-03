/*
Micro utils shared by server and client code.
Server-only utils should be placed in `../server/util.mjs`.
Client-only utils should be placed in `../client/util.mjs`.
*/

import * as a from '@mitranim/js/all.mjs'
import nc from 'tweetnacl'

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
export function indentChi(src) {return a.vac(src) && [`  `, src]}

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
export function toIntOpt(val) {
  if (a.isInt(val)) return val
  if (a.isStr(val)) return a.onlyFin(parseInt(val))
  return undefined
}

export function toIntReq(src) {
  if (a.isInt(src)) return src
  if (a.isStr(src)) {
    const val = parseInt(src)
    if (a.isInt(val)) return val
  }
  throw TypeError(`expected an integer or a string starting with an integer, got ${a.show(src)}`)
}

export function hasIntPrefix(val) {return a.isStr(val) && a.isSome(toIntOpt(val))}

export function compareAsc(one, two) {return compareByIntPrefix(one, two, false)}
export function compareDesc(one, two) {return compareByIntPrefix(one, two, true)}

/*
Similar to regular JS sorting, but prefers to sort by an integer prefix.
Integers always come before other values. Falls back on regular JS sorting.
*/
export function compareByIntPrefix(prev, next, desc) {
  a.reqBool(desc)
  const one = toIntOpt(prev)
  const two = toIntOpt(next)

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
  src = a.values(src)
  a.reqFun(fun)

  let count = 0
  let ind = -1
  while (++ind < src.length) {
    const val = src[ind]
    if (a.isNil(val)) continue
    acc = fun(acc, val, count++)
  }
  return acc
}

export function dict(val) {return a.assign(a.Emp(), val)}

export function dictPop(tar, key) {
  try {return tar[key]} finally {delete tar[key]}
}

export function dictPush(tar, key, val) {
  a.reqDict(tar)
  a.reqStructKey(key)
  tar[key] = a.laxArr(tar[key])
  tar[key].push(val)
}

export function mapUniq(src, fun) {
  a.reqFun(fun)
  const set = new Set()
  for (src of a.values(src)) set.add(fun(src))
  return a.arr(set)
}

export function uniqArr(src) {return a.arr(a.setFrom(src))}

export function arrOfUniqValidStr(src) {
  const out = new Set()
  for (src of a.values(src)) if (a.optStr(src)) out.add(src)
  return a.arr(out)
}

export function jsonDecodeOpt(src) {
  return isJsonColl(src) ? JSON.parse(src) : undefined
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
  try {
    const out = jsonDecodeOpt(src)
    if (a.isSome(out)) return out
  }
  catch (err) {
    throw new ErrDecoding(`unexpected JSON decoding error: ${err}`, {cause: err})
  }

  /*
  As fallback, try un-base64 -> un-gzip -> un-JSON.
  This is expected to be the most common case for TD files.
  */
  try {
    return JSON.parse(await str_to_unbase64_to_ungzip_to_str(src))
  }
  catch (err) {
    throw new ErrDecoding(`all decoding methods failed: ${err}`, {cause: err})
  }
}

export function data_to_json_to_gzip_to_base64Str(src) {
  return str_to_gzip_to_base64Str(JSON.stringify(src))
}

export function data_to_json_to_gzipByteArr(src) {
  return resOkByteArr(new Response(str_to_gzipStream(JSON.stringify(src))))
}

export function str_to_unbase64_to_ungzip_to_str(src) {
  return byteArr_to_ungzip_to_str(base64Str_to_byteArr(src))
}

export function byteArr_to_ungzipStream(src) {
  a.reqInst(src, Uint8Array)
  return new Response(src).body.pipeThrough(new DecompressionStream(`gzip`))
}

export async function byteArr_to_ungzip_to_unjsonData(src) {
  return JSON.parse(await byteArr_to_ungzip_to_str(src))
}

export function byteArr_to_ungzip_to_str(src) {
  return resOkText(new Response(byteArr_to_ungzipStream(src)))
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
  return src.bytes?.() ?? new Uint8Array(await src.arrayBuffer())
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
  a.reqInst(src, Uint8Array)
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
  a.reqInst(src, Uint8Array)
  let out = ``
  for (src of src) out += String.fromCharCode(src)
  return btoa(out)
}

export function byteArr_to_hexStr(src) {return a.arrHex(src)}

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
    if (!(len > MIN_LEN)) {
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

export function seedToKeyPair(seed) {
  return nc.sign.keyPair.fromSeed(req_Ed25519_seed(seed))
}

export function authToken(publicKey, secretKey, ts = Date.now()) {
  a.reqInt(ts)
  const msg = byteArr_to_hexStr(publicKey) + `.` + ts
  const msgBytes = new TextEncoder().encode(msg)
  const sigBytes = nc.sign.detached(msgBytes, secretKey)
  return msg + `.` + byteArr_to_hexStr(sigBytes)
}

export function authHeaderOpt(publicKey, secretKey, ts) {
  a.optInst(publicKey, Uint8Array)
  a.optInst(secretKey, Uint8Array)
  if (!(publicKey && secretKey)) return undefined
  return [`authorization`, `Bearer ` + authToken(publicKey, secretKey, ts)]
}

export function authHeadersOpt(publicKey, secretKey, ts) {
  const head = authHeaderOpt(publicKey, secretKey, ts)
  return head ? [head] : []
}

/*
Workaround for two unrelated problems.

One is that we generate plot aggs in a few different ways, and want to compare
them in testing, but JS has two different nil values, which often breaks
comparison of nested data structures, when the comparison function
distinguishes between `undefined` and `null`. This ameliorates that.

Two is a problem in Uplot. Contrary to what the documentation claims, it seems
to only support missing values when they're `undefined`, but not when they're
`null`. When generating data locally, we automatically end up with `undefined`
for missing values. But when receiving plot agg data from a remote endpoint,
the encoding and decoding process involves JSON which only supports `null`,
and we have to convert it to `undefined` for the plot.
*/
export function consistentNil_undefined(val) {
  if (a.isNil(val)) return undefined
  if (a.isArr(val)) return a.map(val, consistentNil_undefined)
  if (a.isDict(val)) return a.mapDict(val, consistentNil_undefined)
  return val
}

export function consistentNil_null(val) {
  if (a.isNil(val)) return null
  if (a.isArr(val)) return a.map(val, consistentNil_null)
  if (a.isDict(val)) return a.mapDict(val, consistentNil_null)
  return val
}

export function isGameFileName(val) {
  a.reqStr(val)
  return val.endsWith(`.gd`) || val.endsWith(`.json`) || val.endsWith(`.json.gz`)
}
