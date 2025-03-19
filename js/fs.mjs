import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as idb from 'https://esm.sh/idb@7.1.1'
import * as u from './util.mjs'
import * as os from './os.mjs'

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
export function isErrFs(err) {return a.isInst(err, ErrFs)}

class ErrFs extends u.Err {}
class ErrFsPerm extends ErrFs {}

export const PROGRESS_FILE = {
  handle: undefined,
  key: `progress_file`,
  desc: `progress file`,
  help: a.joinLines([
    `Pick your TD save/progress file. Typical location:`,
    `C:\\Users\\<user>\\AppData\\LocalLow\\Parallel-45\\tower-dominion\\SaveFiles\\Progress.gd.`,
    `Note that AppData is hidden by default!`,
  ]),
  mode: `read`,
  pick: pickProgressFile,
}

export const HISTORY_DIR = {
  handle: undefined,
  key: `history_dir`,
  desc: `history directory`,
  help: a.joinLines([
    `Pick directory for run history/backups. Suggested location:`,
    `C:\\Users\\<user>\\Documents\\tower-dominion`,
  ]),
  mode: `readwrite`,
  pick: pickHistoryDir,
}

// Deinitialize progress file: delete handle from DB and reset variable
export function deinitProgressFile(sig) {
  return deinitFileConf(sig, PROGRESS_FILE)
}

// Deinitialize history directory: delete handle from DB and reset variable
export function deinitHistoryDir(sig) {
  return deinitFileConf(sig, HISTORY_DIR)
}

async function deinitFileConf(sig, conf) {
  if (!conf.handle) return `Already deinitialized: ${conf.desc}`

  try {
    await u.wait(sig, dbDel(DB_STORE_HANDLES, conf.key))
    conf.handle = undefined
    return `Deinitialized ${conf.desc}`
  }
  catch (err) {
    u.log.err(`Error deinitializing ${conf.desc}:`, err)
    return undefined
  }
}

// Try to load file handles from IDB on app startup.
export async function loadHandles() {
  try {
    PROGRESS_FILE.handle = await tryLoadHandle(DB_STORE_HANDLES, PROGRESS_FILE.key, PROGRESS_FILE)
    HISTORY_DIR.handle = await tryLoadHandle(DB_STORE_HANDLES, HISTORY_DIR.key, HISTORY_DIR)
  } catch (err) {
    u.log.err(`Error loading file handles:`, err)
  }
}

// Try to load a handle and check its permission
async function tryLoadHandle(store, key, conf) {
  let handle
  try {
    handle = await dbGet(store, key)
    if (handle) {
      u.log.inf(`Loaded handle for ${conf.desc}`)
      a.reqInst(handle, FileSystemHandle)

      // Check permission
      const permission = await queryPermission(handle, {mode: conf.mode})
      if (permission !== `granted`) {
        u.log.inf(`${conf.desc}: permission needed. Use the "init" command to grant access.`)
      }
    }
  } catch (err) {
    u.log.err(`Error loading handle for ${conf.desc}:`, err)
  }
  return handle
}

export async function initProgressFile(sig) {
  return initFileConfig(sig, PROGRESS_FILE)
}

export async function initHistoryDir(sig) {
  return initFileConfig(sig, HISTORY_DIR)
}

async function initFileConfig(sig, conf) {
  await initFileHandle(sig, conf)
  return `Initialized ${conf.desc}`
}

async function pickProgressFile() {
  return a.head(await window.showOpenFilePicker({
    types: [{description: `Game Save/Progress File`}],
    multiple: false
  }))
}

// TODO pass description in options.
async function pickHistoryDir() {
  return window.showDirectoryPicker({
    types: [{description: `Directory for run history / backups`}],
  })
}

async function initFileHandle(sig, conf) {
  const {desc, help, mode, key, pick} = conf
  a.reqValidStr(desc)
  a.reqValidStr(mode)
  a.reqValidStr(key)
  a.reqValidStr(help)

  try {
    const handle = await u.wait(sig, dbGet(DB_STORE_HANDLES, key))
    if (handle) {
      u.log.inf(`Loaded handle for ${desc}`)
      a.reqInst(handle, FileSystemHandle)
      conf.handle = handle
    }
  }
  catch (err) {u.log.err(err)}

  if (!conf.handle) {
    u.log.inf(help)
    conf.handle = await u.wait(sig, pick())
    try {
      await u.wait(sig, dbPut(DB_STORE_HANDLES, key, conf.handle))
      u.log.inf(`Handle for ${desc} stored`)
    }
    catch (err) {
      u.log.err(`Error storing handle for ${desc}:`, err)
    }
  }

  let permission = await u.wait(sig, queryPermission(conf.handle, {mode}))
  if (permission !== `granted`) {
    u.log.inf(`Permission for ${desc}: ${permission}, requesting permission`)
    /*
    Note: browsers allow `.requestPermission` only as a result of a user action.
    We can't trigger it automatically on app startup, for example.
    */
    permission = await requestPermission(sig, conf.handle, {mode})
  }
  if (permission !== `granted`) {
    throw Error(`Please grant permission for ${desc}`)
  }
}

// Generic function to check status of a file handle
async function getHandleStatus(sig, conf, getSpecificStatus) {
  const {handle, mode} = conf
  if (!conf.handle) return `${conf.desc}: not initialized`

  try {
    const permission = await u.wait(sig, queryPermission(handle, {mode}))
    if (permission !== `granted`) return `${conf.desc}: permission needed`

    // Get specific status information
    return await getSpecificStatus(sig)
  }
  catch (err) {
    u.log.err(`Error checking ${conf.desc}:`, err)
    return undefined
  }
}

// Get formatted status of progress file
async function getProgressFileStatus(sig) {
  const file = await getFile(sig, PROGRESS_FILE.handle)
  return `Progress file: ${file.name} (${u.formatSize(file.size)})`
}

// Returns a string indicating status of progress file.
export async function statusProgressFile(sig) {
  return getHandleStatus(sig, PROGRESS_FILE, getProgressFileStatus)
}

// Returns a string indicating status of history dir.
export async function statusHistoryDir(sig) {
  return getHandleStatus(sig, HISTORY_DIR, async (sig) => {
    const stats = await getDirectoryStats(sig, HISTORY_DIR.handle)
    return formatHistoryDirStatus(stats)
  })
}

// Get statistics about a directory (file count and total size)
async function getDirectoryStats(sig, dirHandle) {
  // Count all files to get accurate stats
  const dirIter = await u.wait(sig, dirHandle.values())
  let fileCount = 0
  let bytesTotal = 0

  for await (const handle of dirIter) {
    if (isFile(handle)) {
      const file = await getFile(sig, handle)
      bytesTotal += file.size
      fileCount++
    }
  }

  return {dirName: dirHandle.name, fileCount, bytesTotal}
}

// Format history directory status string
function formatHistoryDirStatus(stats) {
  const {dirName, fileCount, bytesTotal} = stats
  return `History directory: ${dirName}${fileCount ? ` (${fileCount} files, ${u.formatSize(bytesTotal)})` : ``}`
}

// Check if handle has the required permission
export async function handleHasPermission(conf) {
  const {handle, mode} = conf
  return (await queryPermission(handle, {mode})) === `granted`
}

/*
TODO: detection should be across all browser tabs.
Possibly via `localStorage`.
*/
function isWatching() {return os.hasProcByName(`watch`)}

// Constants for the watch command.
export const WATCH_INTERVAL_MS = a.secToMs(10)
export const WATCH_INTERVAL_MS_SHORT = a.secToMs(1)
export const WATCH_INTERVAL_MS_LONG = a.secToMs(30)
export const WATCH_MAX_ERRS = 3

class WatchState extends a.Emp {
  progressFileHandle = a.optInst(undefined, FileSystemFileHandle)
  historyDirHandle = a.optInst(undefined, FileSystemDirectoryHandle)
  runDirName = undefined
  roundFileName = undefined

  setRunDir(val) {
    this.runDirName = a.optValidStr(val)
    this.setRoundFile()
  }

  setRoundFile(val) {this.roundFileName = a.optValidStr(val)}
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

export function isFile(val) {return val.kind === `file`}
export function isDir(val) {return val.kind === `directory`}

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

export async function requestPermission(sig, src, opt) {
  u.reqSig(sig)
  a.reqInst(src, FileSystemHandle)

  try {
    return await u.wait(sig, src.requestPermission(opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to request permission for ${src.name}: ${err}`, {cause: err})
  }
}

export async function getFile(sig, src, opt) {
  u.reqSig(sig)
  a.reqInst(src, FileSystemHandle)
  try {
    return await u.wait(sig, src.getFile(opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to get file for handle ${src.name}: ${err}`, {cause: err})
  }
}

export async function getFileHandle(sig, src, name, opt) {
  u.reqSig(sig)
  a.reqInst(src, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  try {
    return await u.wait(sig, src.getFileHandle(name, opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to get file handle ${src.name}/${name}: ${err}`, {cause: err})
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
    throw new ErrFsPerm(`unable to get directory handle ${src.name}/${name}: ${err}`, {cause: err})
  }
}

// Must always be at the very end of this file.
export {idb}
import * as module from './fs.mjs'
window.tabularius.fs = module