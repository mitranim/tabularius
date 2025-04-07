import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as pt from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/path.mjs'
import * as idb from 'https://esm.sh/idb@7.1.1'
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

export let PROGRESS_FILE = undefined
export let HISTORY_DIR = undefined

class FileConf extends a.Emp {
  constructor(src) {
    super()
    this.key = a.reqValidStr(src.key)
    this.desc = a.reqValidStr(src.desc)
    this.help = a.reqValidStr(src.help)
    this.mode = a.reqValidStr(src.mode)
    this.pick = a.reqFun(src.pick)
    return Object.freeze(this)
  }
}

export const PROGRESS_FILE_CONF = new FileConf({
  key: `progress_file`,
  desc: `progress file`,
  help: u.joinLines(
    `Pick your TD save/progress file. Typical location:`,
    `C:\\Users\\<user>\\AppData\\LocalLow\\Parallel-45\\tower-dominion\\SaveFiles\\Progress.gd.`,
    `Note that AppData is hidden by default!`,
  ),
  mode: `read`,
  pick: pickProgressFile,
})

export const HISTORY_DIR_CONF = new FileConf({
  key: `history_dir`,
  desc: `history directory`,
  help: u.joinLines(
    `Pick directory for run history/backups. Suggested location:`,
    `C:\\Users\\<user>\\Documents\\tower-dominion`,
  ),
  mode: `readwrite`,
  pick: pickHistoryDir,
})

// Try to load file handles from IDB on app startup.
export async function loadedFileHandles() {
  PROGRESS_FILE = await loadFileHandleWithPerm(PROGRESS_FILE_CONF)
  HISTORY_DIR = await loadFileHandleWithPerm(HISTORY_DIR_CONF)
  return !!(PROGRESS_FILE && HISTORY_DIR)
}

// Try to load a handle and check its permission.
async function loadFileHandleWithPerm(conf) {
  const {desc, mode} = a.reqInst(conf, FileConf)
  const out = await loadFileHandle(conf)
  if (!out) return out
  const perm = await queryPermission(out, {mode})
  if (perm === `granted`) return out
  u.log.info(`${desc}: permission needed; run the "init" command`)
  return undefined
}

async function loadFileHandle(conf) {
  const store = DB_STORE_HANDLES
  const {key, desc} = a.reqInst(conf, FileConf)
  let out

  try {
    out = await dbGet(store, key)
    if (a.isNil(out)) return undefined
  }
  catch (err) {
    u.log.err(`${desc}: error loading handle from DB:`, err)
    return undefined
  }

  u.log.verb(`${desc}: loaded handle from DB: ${a.show(out)}`)

  if (!a.isInst(out, FileSystemHandle)) {
    u.log.info(`${desc}: expected FileSystemHandle; deleting corrupted DB entry`)
    dbDel(store, key).catch(u.logErr)
    return undefined
  }

  return out
}

export async function initedFileHandles(sig) {
  return !!(
    await initedProgressFile(sig) &&
    await initedHistoryDir(sig)
  )
}

export async function initedProgressFile(sig) {
  return !!(PROGRESS_FILE = await initFileHandle(sig, PROGRESS_FILE, PROGRESS_FILE_CONF))
}

export async function initedHistoryDir(sig) {
  return !!(HISTORY_DIR = await initFileHandle(sig, HISTORY_DIR, HISTORY_DIR_CONF))
}

async function initFileHandle(sig, handle, conf) {
  u.reqSig(sig)
  a.optInst(handle, FileSystemHandle)
  const {desc, help, key, pick} = a.reqInst(conf, FileConf)

  handle ??= await loadFileHandle(conf)
  if (!handle) {
    u.log.info(help)
    handle = a.reqInst(await u.wait(sig, pick()), FileSystemHandle)
    try {
      await u.wait(sig, dbPut(DB_STORE_HANDLES, key, handle))
      u.log.info(`${desc}: stored handle to DB`)
    }
    catch (err) {
      u.log.err(`${desc}: error storing handle to DB:`, err)
    }
  }

  await requirePermission(sig, handle, conf)
  return handle
}

export async function deinitFileHandles(sig) {
  return a.compact([
    await deinitProgressFile(sig),
    await deinitHistoryDir(sig),
  ])
}

// Deinitialize progress file: delete handle from DB and reset variable
export async function deinitProgressFile(sig) {
  const msg = await deinitFileConf(sig, PROGRESS_FILE, PROGRESS_FILE_CONF)
  PROGRESS_FILE = undefined
  return msg
}

// Deinitialize history directory: delete handle from DB and reset variable
export async function deinitHistoryDir(sig) {
  const msg = await deinitFileConf(sig, HISTORY_DIR, HISTORY_DIR_CONF)
  HISTORY_DIR = undefined
  return msg
}

async function deinitFileConf(sig, handle, conf) {
  u.reqSig(sig)
  a.optInst(handle, FileSystemHandle)
  const {key, desc} = a.reqInst(conf, FileConf)
  try {await u.wait(sig, dbDel(DB_STORE_HANDLES, key))}
  catch (err) {u.log.err(`${desc}: error deleting from DB:`, err)}
  if (handle) return `${desc}: deinitialized`
  return `${desc}: not initialized`
}

// Returns a string indicating status of progress file.
export function statusProgressFile(sig) {
  return getHandleStatus(sig, PROGRESS_FILE, PROGRESS_FILE_CONF)
}

export function statusHistoryDir(sig) {
  return getHandleStatus(sig, HISTORY_DIR, HISTORY_DIR_CONF)
}

async function getHandleStatus(sig, handle, conf) {
  const {desc} = a.reqInst(conf, FileConf)
  const msg = await getHandleStatusProblem(sig, handle, conf)
  if (msg) return msg

  if (isDir(handle)) return getHandleStatusForDir(sig, handle, conf)
  if (isFile(handle)) return getHandleStatusForFile(sig, handle, conf)
  return `${desc}: unknown handle kind: ${handle.kind}`
}

async function getHandleStatusForDir(sig, handle, conf) {
  const {desc} = a.reqInst(conf, FileConf)
  const {fileCount, dirCount, byteCount} = await getDirectoryStats(sig, handle)
  const details = a.compact([
    fileCount ? `${fileCount} files` : ``,
    dirCount ? `${dirCount} dirs` : ``,
    byteCount ? `${u.formatSize(byteCount)}` : ``,
  ]).join(`, `)
  return `${desc}: ${handle.name}` + (details && `: `) + details
}

async function getHandleStatusForFile(sig, handle, conf) {
  const {desc} = a.reqInst(conf, FileConf)
  const file = await getFile(sig, handle)
  return `${desc}: ${file.name} (${u.formatSize(file.size)})`
}

async function getHandleStatusProblem(sig, handle, conf) {
  u.reqSig(sig)
  a.optInst(handle, FileSystemHandle)

  const {desc, mode} = a.reqInst(conf, FileConf)
  if (!handle) return `${desc}: not initialized`

  const perm = await u.wait(sig, queryPermission(handle, {mode}))
  if (perm !== `granted`) return `${desc}: permission needed`
  return undefined
}

// Get statistics about a directory (file count, dir count, total size).
async function getDirectoryStats(sig, src, out) {
  out ??= a.Emp()
  out.fileCount = a.laxInt(out.fileCount)
  out.dirCount = a.laxInt(out.dirCount)
  out.byteCount = a.laxInt(out.byteCount)

  for await (const val of readDir(sig, src)) {
    if (isDir(val)) {
      await getDirectoryStats(sig, val, out)
      out.dirCount++
      continue
    }

    if (isFile(val)) {
      const file = await getFile(sig, val)
      out.byteCount += file.size
      out.fileCount++
    }
  }
  return out
}

async function pickProgressFile() {
  return a.head(await showOpenFilePicker({
    types: [{description: `Game [save / progress] file`}],
    multiple: false
  }))
}

function pickHistoryDir() {
  return showDirectoryPicker({
    types: [{description: `Directory for [run history / backups]`}],
  })
}

export async function reqHistoryDir(sig) {
  await initedHistoryDir(sig)
  return reqHandlePermissionConf(HISTORY_DIR, HISTORY_DIR_CONF)
}

cmdLs.cmd = `ls`
cmdLs.desc = `list dirs and files; usage: "ls" or "ls <path>"`
cmdLs.help = u.joinLines(
  `usage: "ls" or "ls <path>"`,
  `list the directories and files; examples:`,
  `  ls /`,
  `  ls some_dir`,
  `  ls some_dir/some_file`,
)

export async function cmdLs({sig, args}) {
  args = u.splitCliArgs(args)
  switch (args.length) {
    case 0:
    case 1: return cmdLs.help
    case 2: break
    default: return cmdLs.help
  }

  const path = pt.posix.clean(args[1])
  const handle = await handleAtPath(sig, path)
  const suf = `: `
  if (!isDir(handle)) return handle.kind + suf + handle.name

  let len = 0
  const buf = []
  for await (const val of readDir(sig, handle)) {
    len = Math.max(len, val.kind.length)
    buf.push([val.kind, val.name])
  }

  buf.sort(compareLsEntriesAsc)
  len += suf.length

  const line = ([kind, name]) => (kind + suf).padEnd(len, ` `) + name
  return a.joinLines(a.map(buf, line))
}

function compareLsEntriesAsc(one, two) {return u.compareAsc(one[1], two[1])}

// TODO implement.
// export function cmdTree(sig, args) {}

cmdShow.cmd = `show`

cmdShow.desc = `
decode and show a round in a run; usage: "show <run_dir>/<round_file>"
`.trim()

cmdShow.help = u.joinLines(
  `usage: "show <path>"`,
  `flags:`,
  `  -c  copy decoded content to clipboard`,
  `  -l  log decoded content (as text) to browser console`,
  `  -p  print decoded object to browser console`,
  `examples:`,
  `  show 0000/0001.gd -c`,
  `  show 0000/0001.gd -c -l`,
  `  show 0000/0001.gd -c -l -p`,
  `if no flags are provided, nothing is done`
)

/*
Ideally, we'd actually let the user browse the file. But some of our target
files are so huge, that merely including their text in the DOM, as a
`.textContent` of a single element, makes browser layout updates very slow. The
performance issues might be style-related / CSS-related and fixable, but it's
really an indicator that very large content should not be displayed all at
once. For now we copy to the clipboard.
*/
export async function cmdShow({sig, args}) {
  args = u.splitCliArgs(args)

  const copy = u.arrRemoved(args, `-c`)
  const log = u.arrRemoved(args, `-l`)
  const print = u.arrRemoved(args, `-p`)

  switch (args.length) {
    case 2: break
    default: return cmdShow.help
  }

  const path = args[1]
  const handle = await handleAtPath(sig, path)
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
  return msgs.join(`; `)
}

cmdDecode.cmd = `decode`
cmdDecode.desc = `decode an entire run, writing the result to a file`
cmdDecode.help = u.joinParagraphs(
  cmdDecode.desc,
  u.joinLines(
    `usage examples:`,
    `  decode <run_id>`,
    `  decode <run_id> -p`,
    `  decode 0000`,
    `  decode 0000 -p`,
  ),
  `the decoded result is written to "<run_id>.json" in the history directory`,
  `the flag -p enables pretty-printing`,
  `tip: use "ls /" to browse runs`,
)

export async function cmdDecode({sig, args}) {
  args = u.splitCliArgs(args)
  const pretty = u.arrRemoved(args, `-p`)

  switch (args.length) {
    case 2: break
    default: return cmdDecode.help
  }

  const runId = args[1]
  const root = await reqHistoryDir(sig)
  const dir = await getDirectoryHandle(sig, root, runId)
  const rounds = await u.asyncIterCollect(sig, readRunRounds(sig, dir))
  rounds.sort(u.compareRoundsAsc)
  const path = runId + `.json`
  const body = pretty ? JSON.stringify(rounds, ``, 2) : JSON.stringify(rounds)
  await writeFile(sig, root, path, body)
  return `wrote run ${a.show(runId)} to ${a.show(path)}`
}

cmdShowSaves.cmd = `show_saves`
cmdShowSaves.desc = `choose the original TD save folder; the command will print the decoded contents of every ".gd" file to the browser devtools console`

export async function cmdShowSaves({sig}) {
  const dir = await showDirectoryPicker()

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

// Caution: the iteration order is undefined and unstable.
export async function* readRunRounds(sig, dir) {
  for await (const file of readRunRoundHandles(sig, dir)) {
    yield await jsonDecompressDecodeFile(sig, file)
  }
}

// Caution: the iteration order is undefined and unstable.
export async function* readRunRoundHandles(sig, dir) {
  for await (const file of readDir(sig, dir)) {
    if (isHandleGameFile(file)) yield file
  }
}

export async function findLatestRunId(sig) {
  const root = await reqHistoryDir(sig)

  let dirs = await u.asyncIterCollect(sig, readDir(sig, root))
  dirs = a.filter(dirs, isDir)
  dirs.sort(compareHandlesDesc)

  for (const dir of dirs) {
    for await (const _ of readRunRoundHandles(sig, dir)) {
      return dir.name
    }
  }
  return undefined
}

export function isHandleGameFile(handle) {
  a.reqInst(handle, FileSystemHandle)
  if (!isFile(handle)) return false
  const ext = pt.posix.ext(handle.name)
  return ext === `.gd` || ext === `.json`
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

export async function readFile(sig, src) {
  src = await getFile(sig, src)
  src = await u.wait(sig, src.text())
  return src
}

export async function handleAtPath(sig, src) {
  const path = splitPath(src)
  const dirs = a.init(path)
  const name = a.last(path)
  const root = await reqHistoryDir(sig)
  const handle = await chdir(sig, root, dirs)
  if (!name) return handle
  return getSubHandle(sig, handle, name)
}

export async function chdir(sig, handle, path) {
  u.reqSig(sig)
  a.reqInst(handle, FileSystemHandle)
  u.optArrOfValidStr(path)
  for (const name of a.laxArr(path)) {
    if (!a.isInst(handle, FileSystemDirectoryHandle)) {
      throw new ErrFs(`unable to chdir from ${a.show(handle.name)}, which is not a directory, to ${a.show(name)}`)
    }
    handle = await getDirectoryHandle(sig, handle, name)
  }
  return handle
}

export async function reqHandlePermissionConf(handle, conf) {
  const msg = await statusPermissionConf(handle, conf)
  if (msg) throw new ErrFsPerm(msg)
  return handle
}

export async function statusPermissionConf(handle, conf) {
  const {desc, mode} = a.reqInst(conf, FileConf)
  if (!handle) return `${desc}: not initialized`
  const perm = await queryPermission(handle, {mode})
  if (perm !== `granted`) return `${desc}: permission needed`
  return undefined
}

export function hasPermissionConf(handle, conf) {
  const {mode} = a.reqInst(conf, FileConf)
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

export async function writeFile(sig, dir, name, body) {
  a.reqValidStr(name)
  a.reqValidStr(body)
  const file = await getFileHandle(sig, dir, name, {create: true})
  const wri = await u.wait(sig, file.createWritable())
  try {
    await u.wait(sig, wri.write(body))
    return file
  }
  catch (err) {
    throw new ErrFs(`unable to write to ${dir.name}/${name}: ${err}`, {cause: err})
  }
  finally {await wri.close()}
}

export function isDir(val) {return val.kind === `directory`}
export function isFile(val) {return val.kind === `file`}

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

async function requirePermission(sig, handle, conf) {
  const {desc, mode} = a.reqInst(conf, FileConf)

  let perm = await u.wait(sig, queryPermission(handle, {mode}))
  if (perm === `granted`) return
  u.log.info(`${desc}: permission: ${perm}, requesting permission`)

  perm = await requestPermission(sig, handle, {mode})
  if (perm === `granted`) return
  throw new ErrFsPerm(`please grant permission for ${desc}`)
}

/*
Note: browsers allow `.requestPermission` only as a result of a user action.
We can't trigger it automatically on app startup, for example. This can only
be run as a result of manually invoking a command, or clicking something in
the UI, etc.
*/
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
    if (err.cause?.name !== `TypeMismatchError`) throw err
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
    throw new ErrFs(`unable to get file handle ${src.name}/${name}: ${err}`, {cause: err})
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
    throw new ErrFs(`unable to get directory handle ${src.name}/${name}: ${err}`, {cause: err})
  }
}

export function splitPath(src) {
  const sep = `/`
  return a.split(a.stripPre(src, sep), sep)
}
