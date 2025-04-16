import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as idb from 'https://esm.sh/idb@7.1.1'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'

import * as self from './fs.mjs'
const tar = window.tabularius ??= a.Emp()
tar.fs = self
tar.lib ??= a.Emp()
tar.idb = idb
a.patch(window, tar)

// Initialize IndexedDB for persistence of file handles and other values.
export const DB_NAME = `tabularius`
export const DB_VERSION = 1
export const DB_STORE_HANDLES = `handles`

// Create/open the database.
export const dbPromise = idb.openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(DB_STORE_HANDLES)) {
      db.createObjectStore(DB_STORE_HANDLES)
    }
  }
})

// Save a value to IndexedDB.
export async function dbPut(store, key, val) {
  a.reqValidStr(store)
  a.reqValidStr(key)
  await (await dbPromise).put(store, val, key)
}

// Get a value from IndexedDB.
export async function dbGet(store, key) {
  a.reqValidStr(store)
  a.reqValidStr(key)
  return (await dbPromise).get(store, key)
}

// Delete a value in IndexedDB.
export async function dbDel(store, key) {
  a.reqValidStr(store)
  a.reqValidStr(key)
  return (await dbPromise).delete(store, key)
}

/*
The File System API throws non-descriptive instances of `DOMException`, without
file names or paths. We need clearer error messages for users. It seems that we
need to try/catch all FS operations and wrap them into our errors, with clearer
messages and easier detection by class.
*/
class ErrFs extends u.Err {}
class ErrFsPerm extends ErrFs {}
export function isErrFs(err) {return a.isInst(err, ErrFs)}

export class FileConf extends a.Emp {
  constructor(src) {
    super()
    this.key = a.reqValidStr(src.key)
    this.desc = a.reqValidStr(src.desc)
    this.help = a.reqValidStr(src.help)
    this.mode = a.reqValidStr(src.mode)
    this.pick = a.reqFun(src.pick)
    this.handle = undefined
    this.perm = undefined
    return o.obs(this)
  }
}

export const PROGRESS_FILE_CONF = new FileConf({
  key: `progress_file`,
  desc: `progress file`,
  help: u.joinParagraphs(
    `pick your TD progress file; typical location:`,
    `C:\\Users\\<user>\\AppData\\LocalLow\\Parallel-45\\tower-dominion\\SaveFiles\\Progress.gd`,
    `note that AppData is hidden by default!`,
  ),
  mode: `read`,
  pick: pickProgressFile,
})

export const HISTORY_DIR_CONF = new FileConf({
  key: `history_dir`,
  desc: `history directory`,
  help: u.joinParagraphs(
    `pick directory for run history (backups); suggested location:`,
    `C:\\Users\\<user>\\Documents\\tower-dominion`,
  ),
  mode: `readwrite`,
  pick: pickHistoryDir,
})

// Try to load file handles from IDB on app startup.
export async function loadedFileHandles() {
  return !!((await loadedProgressFile()) && (await loadedHistoryDir()))
}

export function loadedProgressFile() {
  return fileConfLoadedWithPerm(PROGRESS_FILE_CONF)
}

export function loadedHistoryDir() {
  return fileConfLoadedWithPerm(HISTORY_DIR_CONF)
}

// Try to load a handle and check its permission.
export async function fileConfLoadedWithPerm(conf) {
  const {desc, mode} = a.reqInst(conf, FileConf)
  await fileConfLoad(conf)
  if (!conf.handle) return undefined

  conf.perm = await queryPermission(conf.handle, {mode})
  if (conf.perm === `granted`) return conf.handle

  u.log.info(...msgNotGranted(desc))
  return undefined
}

export async function fileConfLoad(conf) {
  const store = DB_STORE_HANDLES
  const {key, desc} = a.reqInst(conf, FileConf)
  let handle

  try {
    handle = await dbGet(store, key)
    if (a.isNil(handle)) return
  }
  catch (err) {
    u.log.err(desc, `: error loading handle from DB:`, err)
    return
  }

  u.log.verb(desc, `: loaded handle from DB`)

  if (!a.isInst(handle, FileSystemHandle)) {
    u.log.info(desc, `: expected FileSystemHandle; deleting corrupted DB entry`)
    dbDel(store, key).catch(u.logErr)
    return
  }

  conf.handle = handle
}

/*
See also `loadedFileHandles`. The difference between "load" and "init" behaviors
in our code is caused by browser security rules and permissions. When running
due to a user input, we're allowed to request permissions, but otherwise, we're
only allowed to query permissions.
*/
export async function initedFileHandles(sig) {
  await fileConfInit(sig, PROGRESS_FILE_CONF)
  await fileConfInit(sig, HISTORY_DIR_CONF)
  return true
}

/*
See the comment on `fileConfRequireOrRequestPermission`. This must be used only
on a user action, such as prompt input submission or a click.
*/
export async function fileConfInit(sig, conf) {
  u.reqSig(sig)
  const {desc, help, key, pick} = a.reqInst(conf, FileConf)

  if (!conf.handle) await fileConfLoad(conf)

  if (!conf.handle) {
    u.log.info(help)
    conf.handle = a.reqInst(await u.wait(sig, pick()), FileSystemHandle)

    try {
      await u.wait(sig, dbPut(DB_STORE_HANDLES, key, conf.handle))
      u.log.info(desc, `: stored handle to DB`)
    }
    catch (err) {
      u.log.err(desc, `: error storing handle to DB:`, err)
    }
  }

  await fileConfRequireOrRequestPermission(sig, conf)
}

export async function deinitFileHandles(sig) {
  return a.compact([
    await fileConfDeinit(sig, PROGRESS_FILE_CONF),
    await fileConfDeinit(sig, HISTORY_DIR_CONF),
  ])
}

export async function fileConfDeinit(sig, conf) {
  u.reqSig(sig)
  const {key, desc} = a.reqInst(conf, FileConf)

  try {
    await u.wait(sig, dbDel(DB_STORE_HANDLES, key))
  }
  catch (err) {
    u.log.err(desc, `: error deleting from DB:`, err)
  }

  if (!conf.handle) return `${desc}: not initialized`
  conf.handle = undefined
  conf.perm = undefined
  return `${desc}: deinitialized`
}

export class FileConfStatus extends u.ReacElem {
  constructor(conf) {super().conf = a.reqInst(conf, FileConf)}

  // SYNC[file_conf_status].
  run() {
    const {handle, perm, desc} = this.conf
    if (!handle) return E(this, {}, msgNotInited(desc))
    if (perm !== `granted`) return E(this, {}, msgNotGranted(desc))
    return E(this, {}, desc, `: `, handle.name)
  }
}

// SYNC[file_conf_status].
export async function fileConfStatusProblem(sig, conf) {
  u.reqSig(sig)
  const {handle, desc, mode} = a.reqInst(conf, FileConf)
  if (!handle) return msgNotInited(desc)

  conf.perm = await u.wait(sig, queryPermission(handle, {mode}))
  if (conf.perm !== `granted`) return msgNotGranted(desc)
  return undefined
}

/*
Note: browsers allow `.requestPermission` only as a result of a user action.
We can't trigger it automatically on app startup, for example. This can only
be run as a result of manually invoking a command, or clicking something in
the UI, etc.

SYNC[file_conf_status].
*/
export async function fileConfRequireOrRequestPermission(sig, conf) {
  const {handle, desc, mode} = a.reqInst(conf, FileConf)
  if (!handle) throw msgNotInited(desc)

  conf.perm = await u.wait(sig, queryPermission(handle, {mode}))
  if (conf.perm === `granted`) return

  u.log.info(desc, `: permission: `, a.show(conf.perm), `, requesting permission`)
  conf.perm = await requestPermission(sig, handle, {mode})
  if (conf.perm === `granted`) return

  throw msgNotGranted(desc)
}

function msgNotInited(desc) {
  return [desc, `: not initialized, run the `, os.BtnCmdWithHelp(`init`), ` command`]
}

function msgNotGranted(desc) {
  return [desc, `: permission needed, run `, os.BtnCmdWithHelp(`init`), ` to grant`]
}

export async function fileConfRequirePermission(sig, conf) {
  const msg = await fileConfStatusProblem(sig, conf)
  if (msg) throw msg
}

export function fileHandleStatStr(sig, handle) {
  a.reqInst(handle, FileSystemHandle)
  if (isDir(handle)) return dirStatStr(sig, handle)
  if (isFile(handle)) return fileStatStr(sig, handle)
  u.log.err(errHandleKind(handle.kind))
  return undefined
}

export async function fileStatStr(sig, handle) {
  return u.formatSize(await fileSize(sig, handle))
}

export async function fileSize(sig, handle) {
  return (await getFile(sig, handle)).size
}

export async function dirStatStr(sig, handle) {
  const {fileCount, dirCount, byteCount} = await dirStat(sig, handle)
  return a.joinOpt([
    fileCount ? `${fileCount} files` : ``,
    dirCount ? `${dirCount} dirs` : ``,
    byteCount ? `${u.formatSize(byteCount)}` : ``,
  ], `, `)
}

// Get statistics about a directory (file count, dir count, total size).
export async function dirStat(sig, dir, out) {
  out ??= a.Emp()
  out.fileCount = a.laxInt(out.fileCount)
  out.dirCount = a.laxInt(out.dirCount)
  out.byteCount = a.laxInt(out.byteCount)

  for await (const val of readDir(sig, dir)) {
    if (isDir(val)) {
      await dirStat(sig, val, out)
      out.dirCount++
      continue
    }

    if (isFile(val)) {
      out.byteCount += await fileSize(sig, val)
      out.fileCount++
    }
  }
  return out
}

export async function pickProgressFile() {
  return a.head(await reqFsFilePick()({
    types: [{description: `Game [save / progress] file`}],
    multiple: false
  }))
}

export function pickHistoryDir() {
  return reqFsDirPick()({
    types: [{description: `Directory for [run history / backups]`}],
  })
}

/*
See the comment on `fileConfRequireOrRequestPermission`. This must be used only
on a user action, such as prompt input submission or a click.
*/
export async function reqHistoryDir(sig) {
  await fileConfInit(sig, HISTORY_DIR_CONF, true)
  await fileConfRequireOrRequestPermission(sig, HISTORY_DIR_CONF)
  return HISTORY_DIR_CONF.handle
}

export async function listDirsFiles({sig}, path, info) {
  a.optStr(path)
  a.optBool(info)

  path = u.paths.clean(a.laxStr(path))
  const root = await reqHistoryDir(sig)
  const handle = await handleAtPath(sig, root, path)
  const showPath = a.show(handle.name || path)
  const inf = `: `
  const suf = info ? `` : [` (tip: `, os.BtnCmd(`ls -i`), ` adds stats)`]

  if (!isDir(handle)) {
    if (!info) return [handle.kind + inf + showPath, suf]
    return handle.kind + inf + showPath + inf + await fileStatStr(sig, handle)
  }

  let len = 0
  const buf = []
  for await (const val of readDir(sig, handle)) {
    len = Math.max(len, val.kind.length)
    buf.push([val.kind, val.name, a.vac(info) && await fileHandleStatStr(sig, val)])
  }

  buf.sort(compareLsEntriesAsc)
  len += inf.length
  if (!buf.length) return `directory ${showPath} is empty`

  return u.LogLines(
    [`contents of directory ${showPath}`, suf, `:`],
    ...u.alignTable(a.map(buf, function lsRow([kind, name, info]) {
      return [
        kind + inf,
        BtnLsEntry(path, name, info),
        (a.vac(info) && ` (` + info + `)`),
      ]
    })),
  )
}

function BtnLsEntry(path, name, info) {
  path = u.paths.join(path, name)
  return u.Btn(name, function onClickLsEntry() {
    u.copyToClipboard(path)
    u.log.info(`copied `, a.show(path), ` to clipboard`)
    os.runCmd(`ls ` + path + (info ? ` -i` : ``))
  })
}

function compareLsEntriesAsc(one, two) {return u.compareAsc(one[1], two[1])}

// TODO implement.
// export function cmdTree(sig, args) {}

cmdShow.cmd = `show`
cmdShow.desc = `decode and show runs, rounds, or save files, with flexible output options`

cmdShow.help = function cmdShowHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdShow.desc),

    u.LogLines(
      `usage:`,
      `  show <flags> <path>            -- one dir or file`,
      `  show <flags> <path> ... <path> -- any dirs or files`,
    ),

    u.LogLines(
      `flags:`,
      [`  `, ui.BtnPromptAppend(`show`, `-c`), ` -- copy decoded JSON to clipboard`],
      [`  `, ui.BtnPromptAppend(`show`, `-l`), ` -- log decoded data to browser console`],
      [`  `, ui.BtnPromptAppend(`show`, `-w`), ` -- write JSON file to <run_history>/show/`],
      [`  `, ui.BtnPromptAppend(`show`, `-p`), ` -- pretty JSON`],
    ),

    u.LogLines(
      `supported paths:`,
      [`  `, ui.BtnPromptAppend(`show`, `latest`), `             -- latest run`],
      [`  `, ui.BtnPromptAppend(`show`, `saves`), `              -- original game save dir`],
      [`  `, ui.BtnPromptAppend(`show`, `latest/latest`), `      -- latest run, latest round`],
      [`  <run>              -- run dir, example: `, ui.BtnPromptAppend(`show`, `0001`)],
      [`  <num>              -- run num, example: `, ui.BtnPromptAppend(`show`, `1`)],
      [`  latest/<round>     -- latest run, round file name; example: `, ui.BtnPromptAppend(`show`, `latest/0001.gd`)],
      [`  latest/<num>       -- latest run, round num; example: `, ui.BtnPromptAppend(`show`, `latest/1`)],
      [`  <run>/latest       -- run dir, latest round; example: `, ui.BtnPromptAppend(`show`, `0001/latest`)],
      [`  <num>/latest       -- run num, latest round; example: `, ui.BtnPromptAppend(`show`, `1/latest`)],
      [`  <run>/<round>      -- run num, round file name; example: `, ui.BtnPromptAppend(`show`, `0001/0001.gd`)],
      [`  <num>/<round>      -- run num, round file name; example: `, ui.BtnPromptAppend(`show`, `1/0001.gd`)],
      [`  <num>/<num>        -- run num, round num; example: `, ui.BtnPromptAppend(`show`, `1/1`)],
      [`  saves/<file>       -- original game save dir, specific file; example: `, ui.BtnPromptAppend(`show`, `saves/Progress.gd`)],
    ),

    u.LogLines(
      `examples:`,
      [`  `, ui.BtnPromptAppend(`show`, `latest -l`), `                 -- log all rounds in latest run`],
      [`  `, ui.BtnPromptAppend(`show`, `latest/latest -l`), `          -- log latest round in latest run`],
      [`  `, ui.BtnPromptAppend(`show`, `latest -c -l -w -p`), `        -- log, write, clipboard all rounds in latest run`],
      [`  `, ui.BtnPromptAppend(`show`, `latest/latest -c -l -w -p`), ` -- log, write, clipboard latest round in latest run`],
      [`  `, ui.BtnPromptAppend(`show`, `saves -l -w -p`), `            -- log all original save files, write JSON files`],
    ),

    `if no flags are provided, nothing is done`,
    [`tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse local runs`],
  )
}

export async function cmdShow({sig, args}) {
  const opt = a.Emp()
  const paths = []

  for (const [key, val] of a.tail(u.cliDecode(args))) {
    if (key === `-c`) u.assUniq(opt, `copy`, `-c`, u.cliBool(key, val))
    else if (key === `-l`) u.assUniq(opt, `log`, `-l`, u.cliBool(key, val))
    else if (key === `-w`) u.assUniq(opt, `write`, `-w`, u.cliBool(key, val))
    else if (key === `-p`) u.assUniq(opt, `pretty`, `-p`, u.cliBool(key, val))
    else if (!key) paths.push(val)
    else return u.LogParagraphs(`unrecognized flag ${a.show(key)}`, os.cmdHelpDetailed(cmdShow))
  }

  if (!paths.length) {
    return u.LogParagraphs(`missing input paths`, os.cmdHelpDetailed(cmdShow))
  }

  if (!(opt.copy || opt.log || opt.write)) return `no action flags specified, nothing done`

  const root = await reqHistoryDir(sig)

  for (const path of paths) {
    try {
      await showSavesOrDirOrFile({sig, root, path, opt})
    }
    catch (err) {
      u.log.err(`[show] unable to show ${a.show(path)}: `, err)
    }
  }
}

export function showSavesOrDirOrFile({sig, root, path, opt}) {
  u.reqSig(sig)
  path = u.paths.clean(path)
  const [dirName, restPath] = u.paths.split1(path)
  if (dirName === `saves`) {
    return showSaves({sig, root, path: restPath, opt})
  }
  return showDirOrFile({sig, root, path, opt})
}

export async function showDirOrFile({sig, root, path: srcPath, opt}) {
  a.reqInst(root, FileSystemDirectoryHandle)
  const [_, handle, path] = await handleAtPathMagic(sig, root, srcPath)
  if (isDir(handle)) {
    return showDir({sig, root, dir: handle, path, opt})
  }
  if (isFile(handle)) {
    return showFile({sig, root, file: handle, path, opt})
  }
  u.log.err(errHandleKind(handle.kind))
  return undefined
}

export async function showDir({sig, root, dir, path, opt}) {
  const data = await u.asyncIterCollect(sig, readRunRoundsAsc(sig, dir))
  if (!data.length) {
    u.log.info(`no rounds found in ${a.show(path)}`)
    return
  }
  await showData({sig, root, path, data, opt})
}

export async function showFile({sig, root, file, path, opt}) {
  if (!isHandleGameFile(file)) return
  const data = await jsonDecompressDecodeFile(sig, file)
  await showData({sig, root, path, data, opt})
}

/*
This requires a root dir, and writes a file there, because we prefer to write
the "showed" files to the root dir, rather than sub-dirs, to avoid them
becoming new "round" files in run dirs.
*/
export async function showData({sig, root, path, data, opt}) {
  u.reqSig(sig)
  a.reqInst(root, FileSystemDirectoryHandle)
  a.reqValidStr(path)
  a.optObj(opt)

  const copy = a.optBool(opt?.copy)
  const log = a.optBool(opt?.log)
  const write = a.optBool(opt?.write)
  const pretty = a.optBool(opt?.pretty)
  let coded

  if (copy) {
    coded ??= JSON.stringify(data, undefined, pretty ? 2 : 0)
    await u.copyToClipboard(coded)
    u.log.info(`copied decoded content of ${a.show(path)} to clipboard`)
  }

  if (log) {
    console.log(`[show] decoded content of ${a.show(path)}:`)
    console.log(data)
    u.log.info(`logged decoded content of ${a.show(path)} to browser devtools console`)
  }

  if (write) {
    coded ??= JSON.stringify(data, undefined, pretty ? 2 : 0)

    const outDirName = `show`
    const outDir = await getDirectoryHandle(sig, root, outDirName, {create: true})

    const outName = u.paths.name(path) + `.json`
    await writeDirFile(sig, outDir, outName, coded)

    const outPath = u.paths.join(root.name, outDirName, outName)
    u.log.info(`wrote decoded content of ${a.show(path)} to ${a.show(outPath)}`)
  }
}

export async function showSaves({sig, root, path, opt}) {
  u.reqSig(sig)
  a.optStr(path)

  // TODO store the handle to IDB to avoid re-prompting.
  const dir = await reqFsDirPick()()
  console.log(`dir:`, dir)

  if (path) {
    const handle = await getFileHandle(sig, dir, path)
    await showFile({sig, root, file: handle, path, opt})
    return
  }

  for await (const handle of readDir(sig, dir)) {
    await showFile({sig, root, file: handle, path: u.paths.join(path, handle.name), opt})
  }
}

export async function findLatestDirEntryReq(sig, dir, fun) {
  const out = await findLatestDirEntryOpt(sig, dir, fun)
  if (out) return out
  throw new ErrFs(`unable to find latest entry in ${a.show(dir.name)}`)
}

export async function findLatestDirEntryOpt(sig, dir, fun) {
  a.optFun(fun)
  let max = -Infinity
  let out
  for await (const han of readDir(sig, dir)) {
    if (fun && !fun(han)) continue
    const ord = u.toIntOpt(han.name)
    if (!(ord > max)) continue
    max = ord
    out = han
  }
  return out
}

export function findLatestRoundFile(sig, runDir, progressFileHandle) {
  a.reqInst(progressFileHandle, FileSystemFileHandle)
  const ext = progressFileHandle ? u.paths.ext(progressFileHandle.name) : ``
  return findLatestDirEntryOpt(sig, runDir, function testDirEntry(val) {
    return isFile(val) && u.paths.ext(val.name) === ext
  })
}

export async function findHandleByIntPrefixReq(sig, dir, int) {
  const out = await findHandleByIntPrefixOpt(sig, dir, int)
  if (out) return out
  throw new ErrFs(`unable to find ${a.show(u.paths.join(dir.name, String(int)))} by integer prefix`)
}

export async function findHandleByIntPrefixOpt(sig, dir, int) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqInt(int)

  for await (const val of readDir(sig, dir)) {
    if (u.toIntOpt(val.name) === int) return val
  }
  return undefined
}

export async function* readRunsAsc(sig, root) {
  for (const val of await readDirAsc(sig, root)) {
    if (isHandleRunDir(val)) yield val
  }
}

export async function* readRunsByIdsAscOpt(sig, root, ids) {
  u.reqSig(sig)
  a.reqInst(root, FileSystemDirectoryHandle)

  for (const id of a.values(ids)) {
    let dir
    try {
      dir = await getDirectoryHandle(sig, root, id)
    }
    catch (err) {
      if (err?.cause?.name === `NotFoundError`) continue
      throw err
    }
    yield dir
  }
}

export async function* readRunsByIdsAsc(sig, root, ids) {
  u.reqSig(sig)
  a.reqInst(root, FileSystemDirectoryHandle)

  for (const id of a.values(ids)) {
    yield await getDirectoryHandle(sig, root, id)
  }
}

export async function* readRunRoundsAsc(sig, dir) {
  for (const file of await readRunRoundHandlesAsc(sig, dir)) {
    yield await jsonDecompressDecodeFile(sig, file)
  }
}

// The iteration order is undefined and unstable.
export async function* readRunRounds(sig, dir) {
  for await (const file of readRunRoundHandles(sig, dir)) {
    yield await jsonDecompressDecodeFile(sig, file)
  }
}

export async function readRunRoundHandlesAsc(sig, dir) {
  return (await u.asyncIterCollect(sig, readRunRoundHandles(sig, dir))).sort(compareHandlesAsc)
}

// The iteration order is undefined and unstable.
export async function* readRunRoundHandles(sig, dir) {
  for await (const file of readDir(sig, dir)) {
    if (isHandleGameFile(file)) yield file
  }
}

export async function findLatestRunId(sig, root) {
  a.reqInst(root, FileSystemDirectoryHandle)
  return a.head((await readDirDesc(sig, root)).filter(isDir))?.name
}

export function isHandleRunDir(handle) {
  a.reqInst(handle, FileSystemHandle)
  return isDir(handle) && a.isSome(u.toIntOpt(handle.name))
}

export function isHandleGameFile(handle) {
  a.reqInst(handle, FileSystemHandle)
  if (!isFile(handle)) return false
  return isGameFileExt(u.paths.ext(handle.name))
}

export function isGameFileExt(val) {
  return a.reqStr(val) === `.gd` || val === `.json`
}

export function compareRoundsAsc(one, two) {
  return a.compareFin(one?.RoundIndex, two?.RoundIndex)
}

export function compareHandlesAsc(one, two) {
  return compareHandles(one, two, u.compareAsc)
}

export function compareHandlesDesc(one, two) {
  return compareHandles(one, two, u.compareDesc)
}

export function compareHandles(one, two, fun) {
  a.reqInst(one, FileSystemHandle)
  a.reqInst(two, FileSystemHandle)
  return fun(one.name, two.name)
}

export async function jsonDecompressDecodeFile(sig, src) {
  src = await readFile(sig, src)
  src = await u.jsonDecompressDecode(src)
  return src
}

export async function jsonCompressEncodeFile(sig, tar, src) {
  await writeFile(sig, tar, await u.jsonCompressEncode(src))
}

export async function readFile(sig, src) {
  src = await getFile(sig, src)
  src = await u.wait(sig, src.text())
  return src
}

/*
Similar to `handleAtPath`, but with support for some specials:

- The magic name `latest` refers to the last directory or file, where sorting is
  done by integer prefix before falling back on string sort; see `compareDesc`.

- Any path segment which looks like an integer, optionally zero-padded, can
  match any directory or file with a matching integer prefix in its name.
*/
export async function handleAtPathMagic(sig, root, path) {
  u.reqSig(sig)
  a.reqInst(root, FileSystemDirectoryHandle)

  let parent = undefined
  let child = root
  const outPath = []

  for (const name of u.paths.split(path)) {
    const next = await getSubHandleMagic(sig, child, name)
    parent = child
    child = next
    outPath.push(child.name)
  }
  return [parent, child, u.paths.join(...outPath)]
}

// TODO return `[parent, child]`.
export async function handleAtPath(sig, root, path) {
  a.reqInst(root, FileSystemDirectoryHandle)
  const handle = await chdir(sig, root, u.paths.dir(path))
  const name = u.paths.base(path)
  if (!name) return handle
  return await getSubHandle(sig, handle, name)
}

export async function chdir(sig, handle, path) {
  u.reqSig(sig)
  a.reqInst(handle, FileSystemHandle)
  for (const name of u.paths.split(path)) {
    handle = await getDirectoryHandle(sig, handle, name)
  }
  return handle
}

export function fileConfHasPermission(conf) {
  const {handle, mode} = a.reqInst(conf, FileConf)
  return hasPermission(handle, {mode})
}

export async function hasPermission(handle, opt) {
  return (await queryPermission(handle, opt)) === `granted`
}

// Too specialized, TODO generalize if needed.
export async function getSubFile(sig, dir, subDirName, fileName) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.optValidStr(subDirName)
  a.optValidStr(fileName)

  if (!subDirName) return undefined
  if (!fileName) return undefined

  const subDir = await getDirectoryHandle(sig, dir, subDirName)
  if (!subDir) return undefined

  return await getFileHandle(sig, subDir, fileName)
}

export async function writeDirFile(sig, dir, name, body) {
  const file = await getFileHandle(sig, dir, name, {create: true})
  return writeFile(sig, file, body, u.paths.join(dir.name, name))
}

export async function writeFile(sig, file, body, path) {
  u.reqSig(sig)
  a.reqInst(file, FileSystemFileHandle)
  a.reqValidStr(body)
  a.optStr(path)

  const wri = await u.wait(sig, file.createWritable())
  try {
    await u.wait(sig, wri.write(body))
    return file
  }
  catch (err) {
    throw new ErrFs(`unable to write to ${a.show(path || file.name)}: ${err}`, {cause: err})
  }
  finally {await wri.close()}
}

export function isDir(val) {return val.kind === `directory`}
export function isFile(val) {return val.kind === `file`}

export function readDirAsc(sig, dir) {
  return readDirSorted(sig, dir, compareHandlesAsc)
}

export function readDirDesc(sig, dir) {
  return readDirSorted(sig, dir, compareHandlesDesc)
}

/*
The comparator function must be able to compare handles.
Recommended: `compareHandlesAsc`, `compareHandlesDesc`.
*/
export async function readDirSorted(sig, dir, fun) {
  a.reqFun(fun)
  return (await u.asyncIterCollect(sig, readDir(sig, dir))).sort(fun)
}

/*
Iterates all file handles in the directory.
Order is arbitrary and unstable; browsers don't bother sorting.
*/
export async function* readDir(sig, src) {
  a.optInst(src, FileSystemDirectoryHandle)
  if (!src) return
  for await (const val of await u.wait(sig, src.values())) {
    if (sig.aborted) break
    yield val
  }
}

export async function queryPermission(src, opt) {
  if (!a.optInst(src, FileSystemHandle)) return undefined
  try {
    return await src.queryPermission(opt)
  }
  catch (err) {
    throw new ErrFsPerm(`unable to query permission for ${src.name}: ${err}`, {cause: err})
  }
}

export async function requestPermission(sig, handle, opt) {
  u.reqSig(sig)
  a.reqInst(handle, FileSystemHandle)
  try {
    return await u.wait(sig, handle.requestPermission(opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to request permission for ${handle.name}: ${err}`, {cause: err})
  }
}

export async function getFile(sig, src, opt) {
  u.reqSig(sig)
  a.reqInst(src, FileSystemHandle)
  try {
    if (!a.hasMeth(src, `getFile`)) {
      throw new ErrFs(`missing ".getFile" on object ${a.show(src)}`)
    }
    return await u.wait(sig, src.getFile(opt))
  }
  catch (err) {
    throw new ErrFs(`unable to get file for handle ${src.name}: ${err}`, {cause: err})
  }
}

export async function getSubHandleMagic(sig, dir, name) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  if (name === `latest`) return findLatestDirEntryReq(sig, dir)

  const int = u.toIntOpt(name)
  if (a.isNil(int)) return getSubHandle(sig, dir, name)

  try {
    return await getSubHandle(sig, dir, name)
  }
  catch {
    let out
    try {
      out = await findHandleByIntPrefixOpt(sig, dir, int)
    }
    catch (err) {
      throw new ErrFs(`unable to find ${a.show(u.paths.join(dir.name, name))} by integer prefix: ${err}`, {cause: err})
    }
    if (out) return out
    throw new ErrFs(`unable to find ${a.show(u.paths.join(dir.name, name))} either directly or by integer prefix`)
  }
}

export async function getSubHandle(sig, src, name, opt) {
  u.reqSig(sig)
  a.reqInst(src, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  try {return await getFileHandle(sig, src, name, opt)}
  catch (err) {
    if (err?.cause?.name !== `TypeMismatchError`) throw err
  }
  return await getDirectoryHandle(sig, src, name, opt)
}

export async function getFileHandle(sig, src, name, opt) {
  u.reqSig(sig)
  a.reqInst(src, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  try {
    return await u.wait(sig, src.getFileHandle(name, opt))
  }
  catch (err) {
    throw new ErrFs(`unable to get file handle ${a.show(u.paths.join(src.name, name))}: ${err}`, {cause: err})
  }
}

export async function getDirectoryHandle(sig, src, name, opt) {
  u.reqSig(sig)
  a.reqValidStr(name)

  if (!a.isInst(src, FileSystemDirectoryHandle)) {
    throw new ErrFs(`unable to get directory handle ${a.show(u.paths.join(src.name, name))} because ${a.show(src.name)} is not a directory`)
  }
  try {
    return await u.wait(sig, src.getDirectoryHandle(name, opt))
  }
  catch (err) {
    throw new ErrFs(`unable to get directory handle ${a.show(u.paths.join(src.name, name))}: ${err}`, {cause: err})
  }
}

export function reqFsFilePick() {
  if (typeof showOpenFilePicker !== `function`) throw errFsApi()
  return showOpenFilePicker
}

export function reqFsDirPick() {
  if (typeof showDirectoryPicker !== `function`) throw errFsApi()
  return showDirectoryPicker
}

export function errFsApi() {
  return Error(`the current environment seems to be lacking the File System API; at the time of writing, it's supported in Chromium-based browsers, such as Chrome, Edge, Opera, Arc, and more, and in very recent versions of other browsers; please consider updating your browser or using a recent Chromium-based browser`)
}

export function errHandleKind(val) {
  return `unrecognized handle kind ${a.show(val)}`
}
