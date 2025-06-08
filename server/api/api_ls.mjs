/* global Deno */

import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as u from '../util.mjs'

export function apiLsOpt(ctx, rou) {
  return (
    rou.get(/^[/]api[/]ls(?:[/](?<path>.*))?$/) &&
    apiLs(ctx, a.laxStr(rou.groups?.path))
  )
}

let TIMER_ID = 0

/*
If invoked at the root (empty path), this leaks the name of `ctx.userRunsDir`.
That's fine.
*/
export async function apiLs(ctx, path) {
  const id = ++TIMER_ID
  console.time(`[ls_${id}]`)
  try {return new u.Res(a.jsonEncode(await apiLsEntry(ctx, path)))}
  finally {console.timeEnd(`[ls_${id}]`)}
}

/*
The format `{kind, name}` aligns with the browser File System API, which is
utilized by our client code. The additional `entries` are non-standard.
*/
export async function apiLsEntry(ctx, path) {
  path = u.reqValidRelFilePath(path)
  path = u.gameFilePathFakeToReal(path)
  path = io.paths.join(ctx.userRunsDir, path)

  const info = await io.FileInfo.statOpt(path)
  if (!info) return undefined

  const name = pt.posix.base(path)
  if (info.isFile()) {
    return {kind: `file`, name: u.gameFilePathRealToFake(name)}
  }
  return {kind: `directory`, name, entries: await apiLsEntries(path)}
}

async function apiLsEntries(path) {
  const out = []
  for await (const {name, isFile} of Deno.readDir(path)) {
    out.push(
      isFile
      ? {kind: `file`, name: u.gameFilePathRealToFake(name)}
      : {kind: `directory`, name}
    )
  }
  return out.sort(compareLsEntriesAsc)
}

function compareLsEntriesAsc(one, two) {return u.compareAsc(one.name, two.name)}
