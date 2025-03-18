import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs.mjs'
import * as idb from 'https://esm.sh/idb@7.1.1'
import * as u from './util.mjs'
import {E} from './util.mjs'
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
      const permission = await handle.queryPermission({mode: conf.mode})
      if (permission !== `granted`) {
        u.log.inf(`${conf.desc}: permission needed. Use the "init" command to grant access.`)
      }
    }
  } catch (err) {
    u.log.err(`Error loading handle for ${conf.desc}:`, err)
  }
  return handle
}

// Generic function to initialize a file handle
async function initFileConfig(sig, conf) {
  await initFileHandle(sig, conf)
  maybeStartWatch()
  return `Initialized ${conf.desc}`
}

export async function initProgressFile(sig) {
  return initFileConfig(sig, PROGRESS_FILE)
}

export async function initHistoryDir(sig) {
  return initFileConfig(sig, HISTORY_DIR)
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

  let permission = await u.wait(sig, conf.handle.queryPermission({mode}))
  if (permission !== `granted`) {
    u.log.inf(`Permission for ${desc}: ${permission}, requesting permission`)
    /*
    Note: browsers allow `.requestPermission` only as a result of a user action.
    We can't trigger it automatically on app startup, for example.
    */
    permission = await u.wait(sig, conf.handle.requestPermission({mode}))
  }
  if (permission !== `granted`) {
    throw Error(`Please grant permission for ${desc}`)
  }
}

// Generic function to check status of a file handle
async function getHandleStatus(sig, conf, getSpecificStatus) {
  if (!conf.handle) return `${conf.desc}: not initialized`

  try {
    const permission = await checkFilePermission(sig, conf)
    if (permission !== `granted`) return `${conf.desc}: permission needed`

    // Get specific status information
    return await getSpecificStatus(sig)
  }
  catch (err) {
    u.log.err(`Error checking ${conf.desc}:`, err)
    return undefined
  }
}

// Check permission for a file handle
async function checkFilePermission(sig, fileConf) {
  return await u.wait(sig, fileConf.handle.queryPermission({mode: fileConf.mode}))
}

// Get formatted status of progress file
async function getProgressFileStatus(sig) {
  const file = await u.wait(sig, PROGRESS_FILE.handle.getFile())
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
      const file = await u.wait(sig, handle.getFile())
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
async function handleHasPermission(conf) {
  const {handle, mode} = conf
  return (await handle?.queryPermission({mode})) === `granted`
}

// Checks if both file handles are available and starts the watch command
export async function maybeStartWatch() {
  if (!(await handleHasPermission(PROGRESS_FILE))) return
  if (!(await handleHasPermission(HISTORY_DIR))) return
  if (os.hasProcByName(`watch`)) return
  os.runCommand(`watch`)
}

// Constants for the watch command
export const WATCH_INTERVAL_MS = a.secToMs(10)
export const WATCH_QUICK_INTERVAL_MS = a.secToMs(1)
export const WATCH_MAX_DECODE_FAILURES = 3

os.COMMANDS.add(new os.Cmd({
  name: `watch`,
  desc: `watch progress file for changes and create backups`,
  fun: cmdWatch,
}))

export const WATCH_STATE = a.Emp()
resetWatchState()

// Reset the watch state to default values
function resetWatchState() {
  WATCH_STATE.failureCount = 0
  WATCH_STATE.sleepTime = WATCH_INTERVAL_MS
  WATCH_STATE.prevRunId = undefined
  WATCH_STATE.prevRoundIndex = undefined
  WATCH_STATE.prevTimestamp = undefined
}

async function cmdWatch(sig) {
  if (os.hasProcByName(`watch`)) {
    return `A watch process is already running`
  }

  u.log.inf(`Watching progress file`)

  // Reset state at start of command
  resetWatchState()

  // Initialize backup state
  await initBackupState(sig)

  do {
    await checkProgressFile(sig)
    await u.wait(sig, a.after(WATCH_STATE.sleepTime))
  }
  while (!sig.aborted)
}

// Initialize backup state by inspecting history directory
async function initBackupState(sig) {
  try {
    // Check if history dir handle is available
    if (!HISTORY_DIR.handle) {
      u.log.inf(`[watch] History directory not initialized.`)
      return
    }

    // Get the latest run ID
    const latestRunId = await findLatestRunId(sig)
    if (!latestRunId) {
      u.log.inf(`[watch] No previous run found.`)
      return
    }

    // Get the latest round index
    const latestRoundIndex = await findLatestRoundIndex(sig, latestRunId)

    // Get timestamp of latest file
    const latestTimestamp = await getLatestBackupTimestamp(sig, latestRunId, latestRoundIndex)

    // Store the values from the latest run
    WATCH_STATE.prevRunId = latestRunId
    WATCH_STATE.prevRoundIndex = latestRoundIndex
    WATCH_STATE.prevTimestamp = latestTimestamp

    u.log.inf(`[watch] Initialized from latest run:`, {
      runId: WATCH_STATE.prevRunId,
      roundIndex: WATCH_STATE.prevRoundIndex,
      timestamp: WATCH_STATE.prevTimestamp ? new Date(WATCH_STATE.prevTimestamp).toISOString() : undefined,
    })
  } catch (err) {
    u.log.err(`[watch] Failed to initialize backup state:`, err)
  }
}

// Get timestamp of the latest backup file
async function getLatestBackupTimestamp(sig, runId, roundIndex) {
  if (!runId || !a.isFin(roundIndex)) return undefined

  try {
    const runDirHandle = await u.wait(sig, HISTORY_DIR.handle.getDirectoryHandle(runId))
    const fileName = padRoundIndex(roundIndex) + fileExt(PROGRESS_FILE.handle.name)
    const fileHandle = await u.wait(sig, runDirHandle.getFileHandle(fileName))
    const file = await u.wait(sig, fileHandle.getFile())
    return file.lastModified
  } catch (err) {
    u.log.err(`[watch] Failed to get timestamp of latest backup:`, err)
    return undefined
  }
}

// Main file checking function
async function checkProgressFile(sig) {
  try {
    await validateProgressFile(sig)
    const file = await u.wait(sig, PROGRESS_FILE.handle.getFile())

    try {
      const success = await processProgressFile(sig, file)

      // Reset failure counts on success
      WATCH_STATE.failureCount = 0
      WATCH_STATE.sleepTime = WATCH_INTERVAL_MS

      // No need for additional logging here as processProgressFile already logs appropriate messages
    }
    catch (err) {
      handleProgressFileError(err)
    }
  } catch (err) {
    u.log.err(`[watch] Error accessing progress file:`, err)
    WATCH_STATE.failureCount++
    WATCH_STATE.sleepTime = WATCH_QUICK_INTERVAL_MS
  }
}

// Generic function to validate file handle and permissions
async function validateFileHandleAccess(sig, conf) {

  // Skip if file handle is not available
  if (!conf.handle) {
    throw Error(`${conf.desc} not initialized. Run the "init" command.`)
  }

  // Check permission
  const permission = await u.wait(sig, conf.handle.queryPermission({mode: conf.mode}))
  if (permission !== `granted`) {
    throw Error(`Permission needed for ${conf.desc}. Run the "init" command to grant access.`)
  }
}

// Validate that progress file is available and accessible
async function validateProgressFile(sig) {
  return validateFileHandleAccess(sig, PROGRESS_FILE)
}

// Process the progress file content
async function processProgressFile(sig, file) {
  const fileContent = await u.wait(sig, file.text())
  const data = await u.wait(sig, decodeObfuscatedFile(fileContent))
  const nextRoundIndex = a.onlyFin(data?.RoundIndex)

  // Log the round index
  if (a.isFin(nextRoundIndex)) {
    u.log.inf(`[watch] Round index:`, nextRoundIndex)
  }

  // Create backup in history directory
  let backupCreated = await createBackup(sig, file, fileContent, data)

  // Handle special cases for retry on failure
  if (!backupCreated && !a.isNil(nextRoundIndex)) {
    const prevRoundIndex = WATCH_STATE.prevRoundIndex
    if (!a.isNil(prevRoundIndex)) {
      // Round increase failure
      if (prevRoundIndex < nextRoundIndex) {
        u.log.inf(`[watch] Retry after failed round increase backup`)
        WATCH_STATE.prevRoundIndex = nextRoundIndex - 1
        backupCreated = await createBackup(sig, file, fileContent, data)
      }
      // Round decrease failure
      else if (prevRoundIndex > nextRoundIndex) {
        u.log.inf(`[watch] Retry with new run after failed round decrease backup`)
        backupCreated = await handleNewRunBackup(sig, nextRoundIndex, fileContent)
      }
    }
  }

  return backupCreated
}

// Handle errors in progress file processing
function handleProgressFileError(err) {
  u.log.err(err)
  WATCH_STATE.failureCount++

  if (WATCH_STATE.failureCount >= WATCH_MAX_DECODE_FAILURES) {
    throw Error(`Failed to decode progress file ${WATCH_STATE.failureCount} times: ${err}`)
  }

  // Reduce sleep time on failure
  WATCH_STATE.sleepTime = WATCH_QUICK_INTERVAL_MS
}

async function decodeObfuscatedFile(src) {
  src = a.reqStr(src).trim()

  // Try direct JSON decoding first
  const jsonResult = await tryDirectJsonDecoding(src)
  if (jsonResult) return jsonResult

  // Try base64 -> ungzip -> JSON as fallback
  try {
    return JSON.parse(await ungzip(atob(src)))
  }
  catch (err) {
    throw Error(`All decoding methods failed. Last error: ${err}`, {cause: err})
  }
}

// Try to decode JSON directly
async function tryDirectJsonDecoding(src) {
  if (src.startsWith(`{`)) {
    try {
      return JSON.parse(src)
    }
    catch (err) {
      u.log.err(`JSON decoding failed:`, err)
      return null
    }
  }
  return null
}

function ungzip(src) {
  const bytes = Uint8Array.from(src, charCode)
  const stream = new Response(bytes).body.pipeThrough(new DecompressionStream(`gzip`))
  return new Response(stream).text()
}

function charCode(val) {return val.charCodeAt(0)}

// Utility functions for backup management
// Get backup extension from source file when needed
const MIN_BACKUP_DIGITS = 4

function padRoundIndex(val) {
  return a.isFin(val) ? String(val).padStart(MIN_BACKUP_DIGITS, `0`) : undefined
}

// Create a backup of the progress file in the history directory
async function createBackup(sig, file, content, data) {
  if (!HISTORY_DIR.handle) {
    u.log.err(`[watch] History directory handle not available`)
    return false
  }

  const nextTimestamp = a.reqFin(file.lastModified)
  if (!shouldCreateBackup(nextTimestamp)) return false

  const nextRoundIndex = a.onlyFin(data?.RoundIndex)
  if (a.isNil(nextRoundIndex)) return false

  // Log round index change type
  const prevRoundIndex = WATCH_STATE.prevRoundIndex
  if (a.isFin(prevRoundIndex)) {
    if (prevRoundIndex > nextRoundIndex) {
      u.log.inf(`[watch] Round decrease: ${prevRoundIndex} → ${nextRoundIndex}`)
    } else if (prevRoundIndex < nextRoundIndex) {
      u.log.inf(`[watch] Round increase: ${prevRoundIndex} → ${nextRoundIndex}`)
    }
  }

  try {
    const success = await handleBackupScenario(sig, nextRoundIndex, content)
    if (success) {
      WATCH_STATE.prevTimestamp = nextTimestamp
      return true
    }
    return false
  }
  catch (err) {
    u.log.err(`[watch] Failed to create backup:`, err)
    return false
  }
}

// Determine if we should create a backup based on timestamp
function shouldCreateBackup(nextTimestamp) {
  if (a.isFin(WATCH_STATE.prevTimestamp) && WATCH_STATE.prevTimestamp >= nextTimestamp) return false
  // Store temporarily but don't update state yet - will update after successful backup
  return true
}

// Handle different backup scenarios based on round index comparison
async function handleBackupScenario(sig, nextRoundIndex, content) {
  try {
    if (a.isNil(WATCH_STATE.prevRoundIndex)) {
      const done = await handleFirstBackup(sig, nextRoundIndex, content)
      if (done) u.log.inf(`[watch] Created first backup for round ${nextRoundIndex}`)
      return done
    }
    if (WATCH_STATE.prevRoundIndex === nextRoundIndex) {
      const done = await handleSameRoundBackup(sig, nextRoundIndex, content)
      if (done) u.log.inf(`[watch] Updated backup for round ${nextRoundIndex}`)
      return done
    }
    if (WATCH_STATE.prevRoundIndex < nextRoundIndex) {
      const done = await handleNewRoundBackup(sig, nextRoundIndex, content)
      if (done) u.log.inf(`[watch] Created backup for new round ${nextRoundIndex} (previous: ${WATCH_STATE.prevRoundIndex})`)
      return done
    }
    if (WATCH_STATE.prevRoundIndex > nextRoundIndex) {
      const done = await handleNewRunBackup(sig, nextRoundIndex, content)
      if (done) u.log.inf(`[watch] Created backup for new run with round ${nextRoundIndex}`)
      return done
    }
    throw Error(`Internal error: unhandled round index comparison`)
  }
  catch (err) {
    u.log.err(`[watch] Error in handleBackupScenario:`, err)
    return false
  }
}

// Update round index and optionally update run ID
async function updateBackupState(sig, nextRoundIndex, updateOpts = {}) {
  WATCH_STATE.prevRoundIndex = nextRoundIndex

  if (updateOpts.newRunId) {
    WATCH_STATE.prevRunId = u.rid()
    await createRunDir(sig, WATCH_STATE.prevRunId)
  } else if (updateOpts.findRunId) {
    WATCH_STATE.prevRunId = await findLatestRunId(sig)
  }

  return WATCH_STATE.prevRunId
}

// Handle first backup in a run
async function handleFirstBackup(sig, nextRoundIndex, content) {
  let runId = await updateBackupState(sig, nextRoundIndex, {findRunId: true})
  if (!runId) {
    // No existing run, create a new one
    runId = u.rid()
    if (await createRunDir(sig, runId)) {
      WATCH_STATE.prevRunId = runId
    } else {
      return false
    }
  }
  return await createOrUpdateBackup(sig, WATCH_STATE.prevRunId, nextRoundIndex, content)
}

// Handle backup for the same round (overwrite)
async function handleSameRoundBackup(sig, nextRoundIndex, content) {
  if (!WATCH_STATE.prevRunId) return false
  return await createOrUpdateBackup(sig, WATCH_STATE.prevRunId, nextRoundIndex, content)
}

// Handle backup for new round in the same run
async function handleNewRoundBackup(sig, nextRoundIndex, content) {
  if (!WATCH_STATE.prevRunId) return false

  // Update round index but keep same run ID
  WATCH_STATE.prevRoundIndex = nextRoundIndex
  return await createOrUpdateBackup(sig, WATCH_STATE.prevRunId, nextRoundIndex, content)
}

// Handle backup for a new run
async function handleNewRunBackup(sig, nextRoundIndex, content) {
  // Create new run with new ID
  const newRunId = u.rid()
  if (!await createRunDir(sig, newRunId)) return false

  // Update state with new run ID and round index
  WATCH_STATE.prevRunId = newRunId
  WATCH_STATE.prevRoundIndex = nextRoundIndex

  return await createOrUpdateBackup(sig, WATCH_STATE.prevRunId, nextRoundIndex, content)
}

// Generic function to collect entries from a directory
async function collectEntries(sig, dirHandle, filterFun) {
  a.reqInst(dirHandle, FileSystemHandle)
  a.reqFun(filterFun)
  const dirIter = await u.wait(sig, dirHandle.values())
  const entries = []

  for await (const entry of dirIter) {
    if (sig.aborted) break
    if (filterFun(entry)) entries.push(entry.name)
  }

  // Sort entries alphabetically
  entries.sort()
  return entries
}

// Find the latest run ID by inspecting the history directory
async function findLatestRunId(sig) {
  if (!HISTORY_DIR.handle) return undefined

  try {
    // TODO avoid allocating a collection since we only want the last one.
    const runDirs = await collectEntries(sig, HISTORY_DIR.handle, isDir)
    return a.last(runDirs)
  }
  catch (err) {
    u.log.err(`[watch] Failed to find latest run ID:`, err)
    return undefined
  }
}

function isFile(val) {return val.kind === `file`}
function isDir(val) {return val.kind === `directory`}

// Find the latest round index in a run directory
async function findLatestRoundIndex(sig, runId) {
  a.optStr(runId)
  if (!HISTORY_DIR.handle || !PROGRESS_FILE.handle || !runId) return undefined

  try {
    const runDirHandle = await u.wait(sig, HISTORY_DIR.handle.getDirectoryHandle(runId))
    const sourceExt = fileExt(PROGRESS_FILE.handle.name)
    const backupFileNames = await collectEntries(
      sig,
      runDirHandle,
      entry => isFile(entry) && entry.name.endsWith(sourceExt)
    )
    return extractRoundIndexFromLastBackup(backupFileNames, sourceExt)
  }
  catch (err) {
    u.log.err(`[watch] Failed to find latest round index:`, err)
    return undefined
  }
}

function extractRoundIndexFromLastBackup(names, ext) {
  return a.intOpt(a.stripSuf(a.last(names), ext))
}

// Create a new run directory
async function createRunDir(sig, runId) {
  if (!HISTORY_DIR.handle || !runId) return false

  try {
    await u.wait(sig, HISTORY_DIR.handle.getDirectoryHandle(runId, {create: true}))
    u.log.inf(`[watch] Created run dir: ${runId}`)
    return true
  }
  catch (err) {
    u.log.err(`[watch] Failed to create run directory:`, err)
    return false
  }
}

// Write content to a file in the run directory
async function writeBackupFile(sig, runDirHandle, fileName, content) {
  const fileHandle = await u.wait(sig, runDirHandle.getFileHandle(fileName, {create: true}))
  const writable = await u.wait(sig, fileHandle.createWritable())
  await u.wait(sig, writable.write(content))
  await u.wait(sig, writable.close())
  return fileHandle
}

// Create or update a backup file
async function createOrUpdateBackup(sig, runId, roundIndex, content) {
  if (!HISTORY_DIR.handle || !runId) return false

  try {
    const fileName = padRoundIndex(roundIndex) + fileExt(PROGRESS_FILE.handle.name)
    return await attemptBackupCreation(sig, runId, fileName, content)
  }
  catch (err) {
    u.log.err(`[watch] Failed to create/update backup:`, err)
    return false
  }
}

// Attempt to create a backup, handling potential errors
async function attemptBackupCreation(sig, runId, fileName, content) {
  try {
    const runDirHandle = await u.wait(sig, HISTORY_DIR.handle.getDirectoryHandle(runId, {create: true}))
    await writeBackupFile(sig, runDirHandle, fileName, content)
    u.log.inf(`[watch] Created backup: ${runId}/${fileName}`)
    return true
  } catch (err) {
    if (err.name === 'NotFoundError') {
      try {
        await handleNotFoundError(sig, runId, fileName, content)
        return true
      } catch (recoverErr) {
        u.log.err(`[watch] Failed to recover from NotFoundError`)
        return false
      }
    } else {
      u.log.err(`[watch] Backup creation failed:`, err)
      return false
    }
  }
}

// Handle NotFoundError when creating backup
async function handleNotFoundError(sig, runId, fileName, content) {
  u.log.inf(`[watch] Recreating missing run directory: ${runId}`)
  if (!await createRunDir(sig, runId)) throw Error('Failed to create run directory')

  const runDirHandle = await u.wait(sig, HISTORY_DIR.handle.getDirectoryHandle(runId, {create: true}))
  await writeBackupFile(sig, runDirHandle, fileName, content)
  u.log.inf(`[watch] Created backup after dir recreation: ${runId}/${fileName}`)
}

// Must be called ONLY on the file name, without the directory path.
function fileExt(name) {
  name = a.laxStr(name)
  const ind = name.lastIndexOf(`.`)
  return ind > 0 ? name.slice(ind) : ``
}

// Must always be at the very end of this file.
export {idb}
import * as module from './fs.mjs'
window.tabularius.fs = module