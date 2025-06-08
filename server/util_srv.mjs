import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as hd from '@mitranim/js/http_deno.mjs'
import * as ld from '@mitranim/js/live_deno.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as su from '../shared/util.mjs'
import * as uc from './util_conf.mjs'

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
    this.headers.append(`x-robots-tag`, `noindex, follow`)
    return this
  }
}

export class HttpFileStream extends hd.HttpFileStream {
  get Res() {return Res}
}

export class HttpFileInfo extends hd.HttpFileInfo {
  get HttpFileStream() {return HttpFileStream}
}

export class DirRel extends hd.DirRel {
  get FileInfo() {return HttpFileInfo}
}

export async function reqResBodyJson(src) {
  return a.jsonDecode(await reqResBodyText(src))
}

/*
According to our testing and multiple bots, Deno's HTTP server stack does not
automatically decompress / inflate gzipped bodies. Our client uploads rounds
in gzipped format for efficiency, and we have to decompress them manually.
*/
export function reqResBodyText(src) {
  if (!su.headHasGzip(src.headers)) return src.text()
  return new Response(
    src.body.pipeThrough(new DecompressionStream(`gzip`)),
    {signal: src.signal},
  ).text()
}

/*
Development tool. Tells each connected "live client" to reload the page.
Requires `make live`.
*/
export function liveSend(val) {
  if (!uc.LIVE_PORT) return undefined

  const url = new URL(`http://localhost`)
  url.port = uc.LIVE_PORT
  url.pathname = pt.posix.join(ld.LIVE_PATH, `send`)

  return fetch(url, {
    method: a.POST,
    headers: [a.HEADER_JSON],
    body: a.jsonEncode(val),
  }).then(a.resOk).catch(console.error)
}

export function withLiveClient(res) {
  if (!a.optInst(res, Response)) return res
  if (!uc.LIVE_PORT) return res
  if (!isResHtml(res)) return res

  const path = `:${uc.LIVE_PORT}${ld.LIVE_PATH}/live_client.mjs`

  return new Res(
    io.ConcatStreamSource.stream(res.body, `
<script type="module">
  const tar = document.createElement("script")
  tar.src = window.location.protocol + "//" + window.location.hostname + ${a.show(path)}
  tar.type = "module"
  document.body.appendChild(tar)
</script>
`),
    res,
  )
}

export function isResHtml(res) {
  return (
    a.isInst(res, Response) &&
    res.headers.get(a.HEADER_NAME_CONTENT_TYPE) === a.MIME_TYPE_HTML
  )
}
