import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as idb from 'https://esm.sh/idb@7.1.1'
import {E} from './util.mjs'
import * as u from './util.mjs'

export {idb}
import * as self from './fs.mjs'
const tar = window.tabularius ??= a.Emp()
tar.fs = self
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
  if (isFile(handle)) return fileStatStr(sig, handle)
  if (isDir(handle)) return dirStatStr(sig, handle)
  u.log.err(`unrecognized handle kind ${a.show(handle.kind)}`)
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

cmdLs.cmd = `ls`
cmdLs.desc = `list dirs and files`
cmdLs.help = function cmdLsHelp() {
  return u.LogParagraphs(
    `list dirs and files`,
    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`ls`)],
      [`  `, os.BtnCmd(`ls -s`), ` -- show stats`],
      `  ls <path>`,
    ),
    u.LogLines(
      `examples:`,
      `  ls some_dir`,
      `  ls some_dir/some_file`,
    ),
  )
}

export async function cmdLs({sig, args}) {
  args = u.splitCliArgs(args)
  const stat = u.arrRemoved(args, `-s`)

  switch (args.length) {
    case 0:
    case 1:
    case 2: break
    default: return os.cmdHelpDetailed(cmdLs)
  }

  const path = u.paths.clean(a.laxStr(args[1]))
  const root = await reqHistoryDir(sig)
  const handle = await handleAtPath(sig, root, path)
  const showPath = a.show(handle.name || path)
  const inf = `: `
  const suf = stat ? `` : [` (tip: `, os.BtnCmd(`ls -s`), ` adds stats)`]

  if (!isDir(handle)) {
    if (!stat) return [handle.kind + inf + showPath, suf]
    return handle.kind + inf + showPath + inf + await fileStatStr(sig, handle)
  }

  let len = 0
  const buf = []
  for await (const val of readDir(sig, handle)) {
    len = Math.max(len, val.kind.length)
    buf.push([val.kind, val.name, a.vac(stat) && await fileHandleStatStr(sig, val)])
  }

  buf.sort(compareLsEntriesAsc)
  len += inf.length
  if (!buf.length) return `directory ${showPath} is empty`

  return u.LogLines(
    [`contents of directory ${showPath}`, suf, `:`],
    ...u.alignTable(a.map(buf, function lsRow([kind, name, stat]) {
      return [
        kind + inf,
        BtnLsEntry(path, name, stat),
        (a.vac(stat) && ` (` + stat + `)`),
      ]
    })),
  )
}

function BtnLsEntry(path, name, stat) {
  path = u.paths.join(path, name)
  return u.Btn(name, function onClickLsEntry() {
    u.copyToClipboard(path)
    u.log.info(`copied `, a.show(path), ` to clipboard`)
    os.runCmd(`ls ` + path + (stat ? ` -s` : ``))
  })
}

function compareLsEntriesAsc(one, two) {return u.compareAsc(one[1], two[1])}

// TODO implement.
// export function cmdTree(sig, args) {}

cmdShow.cmd = `show`
cmdShow.desc = `decode and show a round in a run`
cmdShow.help = function cmdShowHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdShow.desc),
    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`show latest`), ` (`, ui.BtnPromptAppend(`show`, `latest`), `)`],
      `  show <dir>/<file>`,
      `  show <dir>/<file> <flags>`,
    ),
    u.LogLines(
      `flags:`,
      [`  `, ui.BtnPromptAppend(`show``-c`, ), ` -- copy decoded JSON to clipboard`],
      [`  `, ui.BtnPromptAppend(`show``-l`, ), ` -- log decoded JSON to browser console`],
      [`  `, ui.BtnPromptAppend(`show``-p`, ), ` -- print decoded object to browser console`],
    ),
    u.LogLines(
      `examples:`,
      `  show 0000/0001.gd -c`,
      `  show 0000/0001.gd -c -l`,
      `  show 0000/0001.gd -c -l -p`,
    ),
    `if no flags are provided, nothing is done`,
    [`tip: use `, os.BtnCmdWithHelp(`ls`), ` to browse local runs`],
  )
}

/*
We don't support printing game files to our log, because some of our target
files are so huge, that merely including their text in the DOM, as a
`.textContent` of a single element, makes browser layout updates very slow.
The performance issues might be style-related / CSS-related and fixable, but
it's not a priority. The browser devtools console handles this pretty well.
*/
export async function cmdShow({sig, args}) {
  args = u.splitCliArgs(args)
  const copy = u.arrRemoved(args, `-c`)
  const log = u.arrRemoved(args, `-l`)
  const print = u.arrRemoved(args, `-p`)

  switch (args.length) {
    case 2: break
    default: return os.cmdHelpDetailed(cmdShow)
  }

  const path = args[1]
  const root = await reqHistoryDir(sig)

  const handle = (
    path === `latest`
    ? await findLatestRoundFile(sig, await findLatestRunDir(sig, root))
    : await handleAtPath(sig, root, path)
  )

  if (!isFile(handle)) return `${a.show(path)} is not a file`

  const body = await u.jsonDecompress(await readFile(sig, handle))
  const msgs = []

  if (copy) {
    await u.copyToClipboard(body)
    msgs.push(`copied file content to clipboard`)
  }
  if (log) {
    console.log(body)
    msgs.push(`printed JSON to browser devtools console`)
  }
  if (print) {
    console.log(JSON.parse(body))
    msgs.push(`printed decoded object to browser devtools console`)
  }

  if (msgs.length) return msgs.join(`; `)
  return `no flags provided, nothing done`
}

cmdDecode.cmd = `decode`
cmdDecode.desc = `decode an entire run, writing the resulting JSON to a file`
cmdDecode.help = function cmdDecodeHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdDecode.desc),
    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`decode latest`)],
      [`  `, os.BtnCmd(`decode latest -p`)],
      `  decode <run_id>`,
      `  decode <run_id> -p`,
    ),
    [`the flag `, ui.BtnPromptAppend(`decode`, `-p`), ` enables JSON pretty-printing`],
    `the decoded result is written to "<run_id>.json" in the history directory`,
    [`tip: use `, os.BtnCmdWithHelp(`ls`), ` to browse local runs`],
  )
}

export async function cmdDecode({sig, args}) {
  args = u.splitCliArgs(args)
  const pretty = u.arrRemoved(args, `-p`)

  switch (args.length) {
    case 2: break
    default: return os.cmdHelpDetailed(cmdDecode)
  }

  const runId = args[1]
  const root = await reqHistoryDir(sig)

  const dir = (
    runId === `latest`
    ? await findLatestRunDir(sig, root)
    : await getDirectoryHandle(sig, root, runId)
  )

  const rounds = await u.asyncIterCollect(sig, readRunRoundsAsc(sig, dir))
  const path = dir.name + `.json`
  const body = pretty ? JSON.stringify(rounds, ``, 2) : JSON.stringify(rounds)
  await writeDirFile(sig, root, path, body)
  return `wrote run ${a.show(runId)} to ${a.show(path)}`
}

cmdShowSaves.cmd = `show_saves`
cmdShowSaves.desc = `choose the original TD save folder; the command will print the decoded contents of every ".gd" file to the browser devtools console`

export async function cmdShowSaves({sig}) {
  const dir = await reqFsDirPick()()

  let count = 0
  for await (const val of readDir(sig, dir)) {
    if (!isHandleGameFile(val)) continue
    console.log(`[show_saves] decoded contents of ${a.show(val.name)}:`)
    console.log(await jsonDecompressDecodeFile(sig, val))
    count++
  }
  if (!count) return `found no files to decode`
  return `printed decoded contents of ${count} files to the browser devtools console`
}

export async function findLatestRunDir(sig, root) {
  let max = -Infinity
  let out
  for await (const han of readDir(sig, root)) {
    const ord = u.toIntOpt(han.name)
    if (!(ord > max)) continue
    max = ord
    out = han
  }
  return out
}

export async function findLatestRoundFile(sig, runDir, progressFileHandle) {
  a.optInst(progressFileHandle, FileSystemFileHandle)
  const ext = progressFileHandle ? u.paths.ext(progressFileHandle.name) : ``
  let max = -Infinity
  let out

  for await (const han of readDir(sig, runDir)) {
    if (!isFile(han)) continue
    const fileExt = u.paths.ext(han.name)
    const isBackupFile = ext ? fileExt === ext : isGameFileExt(fileExt)
    if (!isBackupFile) continue

    const ord = u.toIntOpt(han.name)
    if (!(ord > max)) continue

    max = ord
    out = han
  }
  return out
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

export async function handleAtPath(sig, root, path) {
  a.reqInst(root, FileSystemDirectoryHandle)
  const handle = await chdir(sig, root, u.paths.dir(path))
  const name = u.paths.base(path)
  if (!name) return handle
  return getSubHandle(sig, handle, name)
}

export async function chdir(sig, handle, path) {
  u.reqSig(sig)
  a.reqInst(handle, FileSystemHandle)
  for (const name of u.paths.split(path)) {
    if (!a.isInst(handle, FileSystemDirectoryHandle)) {
      throw new ErrFs(`unable to chdir from ${a.show(handle.name)}, which is not a directory, to ${a.show(name)}`)
    }
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

export function writeFile(sig, file, body) {
  return writeFileAt(sig, file, body, file?.name)
}

export async function writeDirFile(sig, dir, name, body) {
  const file = await getFileHandle(sig, dir, name, {create: true})
  return writeFileAt(sig, file, body, u.paths.join(dir.name, name))
}

export async function writeFileAt(sig, file, body, path) {
  u.reqSig(sig)
  a.reqInst(file, FileSystemFileHandle)
  a.reqValidStr(body)
  a.reqValidStr(path)

  const wri = await u.wait(sig, file.createWritable())
  try {
    await u.wait(sig, wri.write(body))
    return file
  }
  catch (err) {
    throw new ErrFs(`unable to write to ${a.show(path)}: ${err}`, {cause: err})
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
  a.reqInst(src, FileSystemDirectoryHandle)
  a.reqValidStr(name)

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
