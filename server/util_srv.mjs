import * as a from '@mitranim/js/all.mjs'
import * as h from '@mitranim/js/http'
import * as su from '../shared/util.mjs'

globalThis.CompressionStream ??= h.CompressionStreamPolyfill
globalThis.DecompressionStream ??= h.DecompressionStreamPolyfill

export class ErrHttp extends su.Err {
  constructor(msg, opt) {
    a.reqRec(opt)
    super(msg, opt)
    this.status = a.reqIntPos(opt.status)
  }
}

export class Res extends Response {
  constructor(...src) {
    super(...src)
    this.headers.append(`access-control-allow-origin`, `*`)
    this.headers.append(`access-control-allow-methods`, a.OPTIONS)
    this.headers.append(`access-control-allow-methods`, a.HEAD)
    this.headers.append(`access-control-allow-methods`, a.GET)
    this.headers.append(`access-control-allow-methods`, a.POST)
    this.headers.append(`access-control-allow-headers`, `*`)
    this.headers.append(`access-control-allow-headers`, `authorization`)
    this.headers.append(`access-control-allow-headers`, `cache-control`)
    this.headers.append(`access-control-allow-headers`, `content-type`)
    this.headers.append(`access-control-allow-headers`, `content-encoding`)
    this.headers.append(`access-control-allow-headers`, `accept-encoding`)
    this.headers.append(`x-robots-tag`, `noindex, follow`)
    return this
  }

  withTypeOpt(val) {
    if (!a.optStr(val)) return this
    const key = `content-type`
    if (!this.headers.get(key)) this.headers.set(key, val)
    return this
  }
}

export class HttpFile extends h.HttpFile {get Res() {return Res}}
export class HttpDir extends h.HttpDir {get HttpFile() {return HttpFile}}

export function jsonRes(body, opt) {
  return new Res(a.jsonEncode(body), opt).withTypeOpt(`application/json`)
}

export async function reqResBodyJson(src) {
  if (!su.headHasGzip(src.headers)) return src.json()
  return a.jsonDecode(await reqResBodyText(src))
}

/*
Our client code uploads rounds gzipped, since they're large but very
compressible. The HTTP stack doesn't automatically inflate request
bodies, so we have to this ourselves.
*/
export function reqResBodyText(src) {
  if (!su.headHasGzip(src.headers)) return src.text()
  return ungzipReq(src)
}

function ungzipReq(src) {
  return new Response(
    src.body.pipeThrough(new DecompressionStream(`gzip`)),
  ).text()
}
