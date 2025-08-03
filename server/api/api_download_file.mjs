import * as a from '@mitranim/js/all.mjs'
import * as hd from '@mitranim/js/http'
import * as u from '../util.mjs'

let TIMER_ID = 0

export async function apiDownloadFile(ctx, path) {
  const id = ++TIMER_ID
  console.time(`[download_file_${id}]`)
  try {return await downloadFile(ctx, path)}
  finally {console.timeEnd(`[download_file_${id}]`)}
}

export function downloadFile(ctx, srcPath) {
  let outPath = srcPath
  outPath = u.reqValidRelFilePath(outPath)
  outPath = u.gameFilePathFakeToReal(outPath)
  return resolveUserFile(ctx, srcPath, outPath)
}

export async function resolveUserFile(ctx, srcPath, outPath) {
  const file = await ctx.httpDirUserRuns.resolve(outPath)

  if (!file) {
    throw new u.ErrHttp(
      `unable to find user file at ${a.show(srcPath)}`,
      {status: 404},
    )
  }

  let headers
  const ext = `.gz`

  if (outPath.endsWith(ext)) {
    outPath = a.stripSuf(outPath, ext)
    headers = [[`content-encoding`, `gzip`]]

    const typ = hd.guessContentType(outPath)
    if (typ) headers.push([`content-type`, typ])
  }

  return file.response({headers})
}
