/* global Deno */

import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as su from '../shared/util.mjs'
import * as us from './util_srv.mjs'
export * from '../shared/util.mjs'
export * from './util_conf.mjs'
export * from './util_auth.mjs'
export * from './util_sql.mjs'
export * from './util_db.mjs'
export * from './util_srv.mjs'

export function cwdUrl() {
  return new URL(pt.posix.dirLike(Deno.cwd()), `file:`)
}

export function dirUrl(src) {
  if (a.isInst(src, URL)) {
    src = new URL(src)
    src.pathname = pt.posix.dirLike(src.pathname)
    return src
  }

  if (a.isStr(src)) {
    if (io.paths.isAbs(src)) return new URL(pt.posix.dirLike(src), `file:`)
    return new URL(pt.posix.dirLike(src), cwdUrl())
  }

  throw a.errConv(src, `directory URL`)
}

export function urlAtDir(path, base) {
  return new URL(path, pt.posix.dirLike(a.render(base)))
}

export function dirUrlAtDir(path, base) {
  return new URL(pt.posix.dirLike(path), pt.posix.dirLike(a.render(base)))
}

export function pathToName(src) {
  if (a.isInst(src, URL)) return pt.posix.base(src.pathname)
  if (a.isStr(src)) return io.paths.base(src)
  throw a.errConv(src, `file or directory name`)
}

/*
Most HTTP clients and many HTTP-related libraries auto-collapse `..` in request
paths, but it's perfectly possible to send such a path in HTTP and to receive
one in Deno. Tested with:

  curl --path-as-is http://localhost:9834/api/ls/../../../..

Without rejecting paths with `..`, it's easy to accidentally serve files from
outside the allowed directories. We could try to be more constructive and
allow "valid" forms of collapse, but most clients do that by default anyway.
*/
export function reqValidRelFilePath(src) {
  src = a.laxStr(src)
  if (pt.posix.isAbs(src) || src.includes(`..`)) {
    throw new us.ErrHttp(`invalid path ${a.show(src)}`, {status: 400})
  }
  return src
}

/*
On the client, we preserve `.gd` files as-is; underneath they're actually
`.json.gz.base64`, although sometimes they can be simply `.json` underneath.
On the server, we simplify them into `.json.gz` for efficiency, saving about
1/3rd space and some CPU time. When reporting file names in `/api/ls`, we lie
about the extensions. See `apiLs`.
*/
export const GAME_FILE_EXT_REAL = `.json.gz`
export const GAME_FILE_EXT_FAKE = `.gd`

export function gameFilePathRealToFake(val) {
  a.reqStr(val)
  if (val.endsWith(GAME_FILE_EXT_REAL)) {
    return a.stripSuf(val, GAME_FILE_EXT_REAL) + GAME_FILE_EXT_FAKE
  }
  return val
}

export function gameFilePathFakeToReal(val) {
  a.reqStr(val)
  if (val.endsWith(GAME_FILE_EXT_FAKE)) {
    return a.stripSuf(val, GAME_FILE_EXT_FAKE) + GAME_FILE_EXT_REAL
  }
  return val
}

// SYNC[decode_game_file].
export async function readDecodeGameFile(path, name) {
  name = a.optStr(name) || pathToName(path)

  if (name.endsWith(GAME_FILE_EXT_REAL)) {
    validGameFileGzName(name)
    return a.jsonDecode(await su.byteArr_to_ungzip_to_str(await Deno.readFile(path)))
  }

  return su.decodeGdStr(await Deno.readTextFile(path))
}

export async function writeEncodeGameFile(path, src) {
  validGameFileGzName(pathToName(path))
  await io.writeFile(path, await su.data_to_json_to_gzipByteArr(src))
}

function validGameFileGzName(name) {
  if (name.endsWith(GAME_FILE_EXT_REAL)) return name
  throw Error(`internal: unexpected game file name ${a.show(name)}`)
}

export async function readRunDirs(src) {
  return a.map(await readDirAll(src, isEntryRunDir), getName).sort(su.compareAsc)
}

export async function readRoundFiles(src) {
  return a.map(await readDirAll(src, isEntryRoundFile), getName).sort(su.compareAsc)
}

export async function readDirs(src) {
  return a.map(await readDirAll(src, isEntryDir), getName)
}

export async function readFiles(src) {
  return a.map(await readDirAll(src, isEntryFile), getName)
}

function getName(src) {return src.name}

/*
The insulting thing about this function is that internally, `Deno.readDir`
gets an array of entries from an underlying Rust call, then artificially
makes an async iterator, and then we have to build the array back...
Twice as much memory is used, not counting the async iteration overhead,
and a lot of CPU is wasted.
*/
export async function readDirAll(src, fun) {
  a.optFun(fun)
  const out = []
  for await (const entry of Deno.readDir(src)) {
    if (fun && !fun(entry)) continue
    out.push(entry)
  }
  return out
}

export function isEntryDir(val) {return val?.isDirectory}
export function isEntryFile(val) {return val?.isFile}

// SYNC[run_id_name_format].
export function isEntryRunDir(val) {
  if (!isEntryDir(val)) return false
  const [run_num, run_ms] = su.splitKeys(val.name)
  return a.isSome(su.toNatOpt(run_num)) && a.isSome(su.toNatOpt(run_ms))
}

export function isEntryRoundFile(val) {
  return isEntryFile(val) &&
    su.isGameFileName(val.name) &&
    su.hasIntPrefix(val.name)
}

export function compareDirEntriesAsc(one, two) {
  return compareDirEntries(one, two, su.compareAsc)
}

export function compareDirEntriesDesc(one, two) {
  return compareDirEntries(one, two, su.compareDesc)
}

export function compareDirEntries(one, two, fun) {
  return fun(a.reqStr(one.name), a.reqStr(two.name))
}

export function jsonLines(src) {
  src = a.laxArr(src)
  return a.mapCompact(src, a.jsonEncode).join(`\n`)
}
