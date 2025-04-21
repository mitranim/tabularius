import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as ld from '@mitranim/js/live_deno.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as uc from './util_conf.mjs'

export async function reqBodyJson(req) {return JSON.parse(await reqBodyText(req))}

/*
According to our testing and multiple bots, Deno's HTTP server stack does not
automatically decompress / inflate gzipped bodies. Our client uploads rounds
in gzipped format for efficiency, and we have to decompress them manually.
*/
export function reqBodyText(req) {
  a.reqInst(req, Request)
  if (req.headers.get(`content-encoding`)?.toLowerCase() === `gzip`) {
    return new Response(
      req.body.pipeThrough(new DecompressionStream(`gzip`)),
      {signal: req.signal},
    ).text()
  }
  return req.text()
}

/*
Development tool. Tells each connected "live client" to reload the page.
Requires `make live`.
*/
export function liveSend(val) {
  if (!uc.LIVE_PORT) return

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

  return new Response(
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
