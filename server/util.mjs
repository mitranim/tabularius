import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as su from '../shared/util.mjs'
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

export const GAME_FILE_EXT_REAL = `.json.gz`
export const GAME_FILE_EXT_FAKE = `.gd`

/*
On the client, we only support `.gd` and `.json`. Both are text formats.
`.json` is convenient in development, and `.gd` is the original format.
On the server, for efficiency, we prefer `.json.gz`, which saves about
1/3rd space compared to `.gd` and is cheaper to decode.
*/
export function isGameFileName(val) {
  a.reqStr(val)
  return val.endsWith(GAME_FILE_EXT_FAKE) || val.endsWith(`.json`) || val.endsWith(GAME_FILE_EXT_REAL)
}

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

export async function readDecodeGameFile(path, name) {
  name = a.optStr(name) || pathToName(path)

  if (name.endsWith(`.gz`)) {
    validGameFileGzName(name)
    return JSON.parse(await su.byteArr_to_ungzip_to_str(await Deno.readFile(path)))
  }

  return su.decodeGdStr(await Deno.readTextFile(path))
}

export async function writeEncodeGameFile(path, src) {
  validGameFileGzName(pathToName(path))
  await Deno.writeFile(path, await su.data_to_json_to_gzipByteArr(src))
}

function validGameFileGzName(name) {
  if (name.endsWith(GAME_FILE_EXT_REAL)) return name
  throw Error(`internal: unexpected game file name ${a.show(name)}`)
}

export async function readRunDirs(src) {
  return a.map(await readDirAll(src, isEntryRunDir), getName)
}

export async function readRoundFiles(src) {
  return a.map(await readDirAll(src, isEntryRoundFile), getName)
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

export function isEntryRunDir(val) {
  return isEntryDir(val) && su.hasIntPrefix(val.name)
}

export function isEntryRoundFile(val) {
  return isEntryFile(val) &&
    isGameFileName(val.name) &&
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

// Rough equivalent of `cp -r`.
export async function cpDirRec(src, out) {
  const {copy} = await import(`https://deno.land/std/fs/mod.ts`)
  await copy(src, out, {overwrite: true})
}

export function jsonLines(src) {
  src = a.laxArr(src)
  return a.mapCompact(src, a.jsonEncode).join(`\n`)
  // return JSON.stringify(a.reqArr(src)).slice(1, -1).replaceAll(`},{`, `}\n{`)
}
