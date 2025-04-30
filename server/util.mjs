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

export async function* walkRunDirs(src) {
  for await (const {name, isDirectory} of Deno.readDir(src)) {
    if (!isDirectory) continue
    const run_num = su.toIntOpt(name)
    if (a.isNil(run_num)) continue
    yield {name, run_num}
  }
}

export async function* walkRoundFiles(src) {
  for await (const {name, isFile} of Deno.readDir(src)) {
    if (!isFile) continue
    const round_num = su.toIntOpt(name)
    if (a.isNil(round_num)) continue
    yield {name, round_num}
  }
}

export function jsonLines(src) {
  src = a.laxArr(src)
  return a.mapCompact(src, a.jsonEncode).join(`\n`)
  // return JSON.stringify(a.reqArr(src)).slice(1, -1).replaceAll(`},{`, `}\n{`)
}
