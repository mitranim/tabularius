/*
This file should contain micro utils used by our cloud functions AND client
code. Cloud-function-only code should not be placed here to avoid polluting the
browser client with stuff it doesn't need. Ditto for client-only code.
*/

import * as a from '@mitranim/js/all.mjs'

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
  if (a.isStr(src)) {
    const val = parseInt(src)
    if (a.isInt(val)) return val
  }
  if (a.isInt(src)) return src
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
  val = a.laxFin(val)
  a.reqNat(ind)
  return acc + (val - acc) / (ind + 1)
}

export function accCount(_, __, ind) {
  return a.isInt(ind) ? ind + 1 : 0
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

export function arrOfUniqValidStr(src) {
  const out = new Set()
  for (src of a.values(src)) if (a.optStr(src)) out.add(src)
  return a.arr(out)
}
