import * as a from '@mitranim/js/all.mjs'
import nc from 'tweetnacl'
import * as su from '../shared/util.mjs'

export function reqAuth(req) {
  a.reqInst(req, Request)
  const token = a.stripPre(req.headers.get(`authorization`), `Bearer `).trim()
  let id
  try {id = auth(token)}
  catch (err) {throw new ErrHttp(err, {cause: err, status: 401})}
  return id
}

export function auth(src) {
  if (!a.optStr(src)) return undefined

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
