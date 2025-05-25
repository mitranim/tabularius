import * as a from '@mitranim/js/all.mjs'
import nc from 'tweetnacl'
import * as su from '../shared/util.mjs'
import * as uc from './util_conf.mjs'
import * as us from './util_srv.mjs'

export const AUTH_TS_EXP = a.hourToMs(24)

export function reqAuthReq(req) {
  a.reqInst(req, Request)
  try {return auth(reqBearer(req))}
  catch (err) {throw new us.ErrHttp(err, {cause: err, status: 401})}
}

export function reqAuthOpt(req) {
  a.reqInst(req, Request)
  try {return auth(reqBearer(req))}
  catch (err) {console.error(`ignoring auth token decoding error:`, err)}
}

export function auth(src, now) {
  a.optStr(src)
  a.optFin(now)

  if (a.isSome(now) && !uc.TEST) {
    throw Error(`unexpected auth "now" timestamp in non-test mode`)
  }

  if (!src) return undefined

  const parts = src.split(`.`)
  if (parts.length !== 3) {
    throw SyntaxError(`auth token must be <pub>.<ts>.<sig>, got ${a.show(src)}`)
  }

  const [pubHex, tsStr, sigHex] = parts
  if (pubHex.length !== 64) {
    throw SyntaxError(`auth token: malformed pub key: ${a.show(pubHex)}, expected a 64-char hex string`)
  }

  const ts = a.intOpt(tsStr)
  if (!a.isFin(ts)) {
    throw SyntaxError(`auth token: malformed timestamp: ${a.show(tsStr)}`)
  }

  /*
  Requiring a fresh timestamp should prevent replay attacks,
  because the timestamp is part of the signed data.
  */
  now ??= Date.now()
  const diff = now - ts
  if (diff > AUTH_TS_EXP) {
    throw Error(`auth token: timestamp too far in the past`)
  }
  else if (diff < -AUTH_TS_EXP) {
    throw Error(`auth token: timestamp too far in the future`)
  }

  /*
  TODO consider requiring fresh timestamp. This should prevent replay attacks,
  because the timestamp is part of the signed data.

    if (Math.abs(Date.now() - ts) > 5 * 60_000) throw
  */

  const pub = su.hexStr_to_byteArr(pubHex)
  if (pub.length !== 32) {
    throw SyntaxError(`auth token: malformed pub key ${a.show(pubHex)}, expected a 64-char hex string`)
  }

  const msg = new TextEncoder().encode(pubHex + `.` + tsStr)
  const sig = su.hexStr_to_byteArr(sigHex)
  if (!nc.sign.detached.verify(msg, sig, pub)) {
    throw Error(`auth token: signature doesn't match claims`)
  }
  return pubHex
}

export function reqBearer(req) {
  a.reqInst(req, Request)
  return a.stripPre(req.headers.get(`authorization`), `Bearer `).trim()
}
