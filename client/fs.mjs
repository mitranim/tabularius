import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as i from './idb.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'

import * as self from './fs.mjs'
const tar = window.tabularius ??= a.Emp()
tar.fs = self
a.patch(window, tar)

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
    this.cmd = a.reqValidStr(src.cmd)
    this.mode = a.reqValidStr(src.mode)
    this.pick = a.reqFun(src.pick)
    this.validate = a.optFun(src.validate)
    this.handle = undefined
    this.perm = undefined
    return o.obs(this)
  }

  clear() {
    this.handle = undefined
    this.perm = undefined
  }
}

export const SAVE_FILES_DIR_NAME = `SaveFiles`

export const KNOWN_GAME_FILE_NAMES = [`Progress.gd`, `Settings.gd`]

export const PROGRESS_FILE_LOCATION = u.joinParagraphs(
  `location of progress file; note that "AppData" is hidden by default:`,
  `  C:\\Users\\<user>\\AppData\\LocalLow\\Parallel-45\\tower-dominion\\${SAVE_FILES_DIR_NAME}\\Progress.gd`,
)

export const PROGRESS_FILE_CONF = new FileConf({
  key: `progress_file`,
  desc: `progress file`,
  help: u.joinParagraphs(
    `pick your game progress file`,
    PROGRESS_FILE_LOCATION,
  ),
  cmd: `init -p`,
  mode: `read`,
  pick: pickProgressFile,
  validate: undefined,
})

export const HISTORY_DIR_LOCATION = u.joinParagraphs(
  `suggested location of run history dir; create it yourself:`,
  `  C:\\Users\\<user>\\Documents\\tower_dominion_history`,
)

export const HISTORY_DIR_CONF = new FileConf({
  key: `history_dir`,
  desc: `history dir`,
  help: u.joinParagraphs(
    `pick directory for run history (backups)`,
    HISTORY_DIR_LOCATION,
  ),
  cmd: `init -h`,
  mode: `readwrite`,
  pick: pickHistoryDir,
  validate: validateHistoryDir,
})

export async function loadedProgressFile(sig) {
  return !!await fileConfLoadedWithPermIdemp(sig, PROGRESS_FILE_CONF)
}

export async function loadedHistoryDir(sig) {
  return !!await fileConfLoadedWithPermIdemp(sig, HISTORY_DIR_CONF)
}

export async function fileConfLoadedWithPermIdemp(sig, conf) {
  if (await fileConfHasPermission(sig, conf)) return conf.handle
  return fileConfLoadedWithPerm(sig, conf)
}

// Try to load a handle and check its permission.
export async function fileConfLoadedWithPerm(sig, conf) {
  u.reqSig(sig)
  const {mode} = a.reqInst(conf, FileConf)
  await fileConfLoad(conf)
  if (!conf.handle) return undefined

  conf.perm = await queryPermission(sig, conf.handle, {mode})
  if (conf.perm === `granted`) return conf.handle

  u.log.err(msgNotGranted(conf))
  return undefined
}

export async function fileConfLoadIdemp(conf) {
  const {handle} = a.reqInst(conf, FileConf)
  if (handle) await fileConfRequirePermission(sig, conf)
  else await fileConfLoad(conf)
}

export async function fileConfLoad(conf) {
  const store = i.IDB_STORE_HANDLES
  const {key, desc} = a.reqInst(conf, FileConf)
  let handle

  try {
    handle = await i.dbGet(store, key)
    if (a.isNil(handle)) return
  }
  catch (err) {
    u.log.err(desc, `: error loading handle from DB:`, err)
    return
  }

  u.log.verb(desc, `: loaded handle from DB`)

  if (!a.isInst(handle, FileSystemHandle)) {
    u.log.info(desc, `: expected FileSystemHandle; deleting corrupted DB entry`)
    i.dbDel(store, key).catch(u.logErr)
    return
  }

  conf.handle = handle
}

export async function initedProgressFile(sig) {
  const conf = PROGRESS_FILE_CONF
  return await fileConfInitedIdemp(sig, conf)
}

export async function initedHistoryDir(sig) {
  const conf = HISTORY_DIR_CONF
  return await fileConfInitedIdemp(sig, conf)
}

export function fileConfInitedIdemp(sig, conf) {
  const {handle} = a.reqInst(conf, FileConf)
  if (!handle) return fileConfInited(sig, conf)
  return fileConfRequireOrRequestPermission(sig, conf)
}

/*
See the comment on `fileConfRequireOrRequestPermission`. This must be used only
on a user action, such as prompt input submission or a click.
*/
export async function fileConfInited(sig, conf) {
  u.reqSig(sig)
  const {desc, help, key, pick, validate} = a.reqInst(conf, FileConf)

  if (!conf.handle) await fileConfLoad(conf)

  if (!conf.handle) {
    u.log.info(help)
    conf.handle = a.reqInst(await u.wait(sig, pick()), FileSystemHandle)
  }

  await fileConfRequireOrRequestPermission(sig, conf)

  if (validate) {
    try {await validate(sig, conf.handle)}
    catch (err) {
      conf.clear()
      throw err
    }
  }

  try {
    await u.wait(sig, i.dbPut(i.IDB_STORE_HANDLES, key, conf.handle))
    u.log.info(desc, `: stored handle to DB`)
  }
  catch (err) {
    u.log.err(desc, `: error storing handle to DB:`, err)
  }
  return conf.handle
}

async function validateHistoryDir(sig, handle) {
  a.reqInst(handle, FileSystemDirectoryHandle)

  const subDir = await getDirectoryHandle(sig, handle, SAVE_FILES_DIR_NAME).catch(a.nop)
  if (subDir && await isGameSaveFilesDir(sig, subDir)) {
    throw new u.ErrLog(...u.LogParagraphs(
      `${a.show(handle.name)} appears to be the game's data directory; your run history directory must be located outside of it`,
      HISTORY_DIR_LOCATION,
    ))
  }

  if (!await isGameSaveFilesDir(sig, handle)) return

  throw new u.ErrLog(...u.LogParagraphs(
    `${a.show(handle.name)} appears to be the game's save directory; your run history directory must be located outside of it`,
    HISTORY_DIR_LOCATION,
  ))
}

async function isGameSaveFilesDir(sig, handle) {
  a.reqInst(handle, FileSystemDirectoryHandle)
  if (handle.name !== SAVE_FILES_DIR_NAME) return false
  for (const name of KNOWN_GAME_FILE_NAMES) {
    if (!await getFileHandle(sig, handle, name).catch(console.error)) {
      return false
    }
  }
  return true
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
    await u.wait(sig, i.dbDel(i.IDB_STORE_HANDLES, key))
  }
  catch (err) {
    u.log.err(desc, `: error deleting from DB:`, err)
  }

  if (!conf.handle) return `${desc}: not initialized`
  conf.clear()
  return `${desc}: deinitialized`
}

export class FileConfStatus extends u.ReacElem {
  constructor(conf) {super().conf = a.reqInst(conf, FileConf)}

  // SYNC[file_conf_status].
  run() {
    const {handle, perm, desc} = this.conf
    if (!handle) return E(this, {}, msgNotInited(this.conf))
    if (perm !== `granted`) return E(this, {}, msgNotGranted(this.conf))
    return E(this, {}, desc, `: `, handle.name)
  }
}

// SYNC[file_conf_status].
export async function fileConfStatusProblem(sig, conf) {
  u.reqSig(sig)
  const {handle, mode} = a.reqInst(conf, FileConf)
  if (!handle) return msgNotInited(conf)

  conf.perm = await queryPermission(sig, handle, {mode})
  if (conf.perm !== `granted`) return msgNotGranted(conf)
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
  if (!handle) throw new u.ErrLog(msgNotInited(conf))

  conf.perm = await queryPermission(sig, handle, {mode})
  if (conf.perm === `granted`) return handle

  u.log.info(desc, `: permission: `, a.show(conf.perm), `, requesting permission`)
  conf.perm = await requestPermission(sig, handle, {mode})
  if (conf.perm === `granted`) return handle

  throw new u.ErrLog(msgNotGranted(conf))
}

function msgNotInited(conf) {
  const {desc, cmd} = a.reqInst(conf, FileConf)
  return [desc, `: not initialized, run `, os.BtnCmdWithHelp(cmd), ` to grant access`]
}

function msgNotGranted(conf) {
  const {desc, cmd} = a.reqInst(conf, FileConf)
  return [desc, `: permission needed, run `, os.BtnCmdWithHelp(cmd), ` to grant`]
}

export async function fileConfRequirePermission(sig, conf) {
  const msg = await fileConfStatusProblem(sig, conf)
  if (msg) throw new u.ErrLog(msg)
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

export async function pickHistoryDir() {
  return await reqFsDirPick()({
    types: [{description: `Directory for [run history / backups]`}],
  })
}

export function hasHistoryDir(sig) {
  return fileConfHasPermission(sig, HISTORY_DIR_CONF)
}

export async function historyDirOpt(sig) {
  const {handle, mode} = HISTORY_DIR_CONF
  if (!handle) return undefined
  if (!await hasPermission(sig, handle, {mode})) return undefined
  return handle
}

export async function historyDirReq(sig, user) {
  u.reqSig(sig)
  a.optBool(user)
  const conf = HISTORY_DIR_CONF

  /*
  See the comment on `fileConfRequireOrRequestPermission`. As a result of a user
  action, we can request a directory picker _and_ request readwrite permissions
  as needed. Meanwhile when running commands on startup via `?run`, or in other
  programmatic cases, we can't.
  */
  if (user) {
    await fileConfInitedIdemp(sig, conf)
  }
  else {
    await fileConfLoadedWithPermIdemp(sig, conf)
    await fileConfRequirePermission(sig, conf)
  }
  return conf.handle
}

export async function listDirsFiles({sig, path, stat, user}) {
  a.optStr(path)
  a.optBool(stat)

  path = u.paths.clean(a.laxStr(path))
  const root = await historyDirReq(sig, user)
  const handle = await handleAtPath(sig, root, path)
  const {kind, name} = handle

  if (isFile(handle)) {
    return showLsEntry({
      kind, name, path, stat,
      statStr: a.vac(stat) && await fileStatStr(sig, handle),
    })
  }

  return showLsEntry({
    kind, name, path, stat,
    entries: await dirEntries(sig, handle, stat),
  })
}

async function dirEntries(sig, dir, stat) {
  a.optBool(stat)
  const out = []
  for (const val of await readDirAsc(sig, dir)) {
    out.push({
      kind: val.kind,
      name: val.name,
      statStr: a.vac(stat) && await fileHandleStatStr(sig, val),
    })
  }
  return out
}

export function showLsEntry({kind, name, path, entries, stat, statStr, cloud}) {
  a.reqStr(kind)
  a.reqStr(name)
  a.reqStr(path)
  a.optBool(stat)
  a.optStr(statStr)
  a.optBool(cloud)
  entries = a.laxArr(entries)

  const locPre = cloud ? `cloud ` : `local `
  const inf = `: `
  const statSuf = a.vac(!statStr && !cloud) && [
    ` (tip: `, os.BtnCmd(`ls -s`), ` adds stats)`
  ]

  if (kind === `file`) {
    const base = locPre + kind + inf + path
    if (statStr) return base + inf + statStr
    return [base, statSuf]
  }

  if (!entries.length) return locPre + `directory ${a.show(path)} is empty`

  const cmd = a.spaced(`ls`, (cloud ? `-c` : stat ? `-s` : ``))
  const buf = []

  for (const {kind, name, statStr} of a.values(entries)) {
    const entryPath = u.paths.join(path, name)

    buf.push([
      kind + inf,
      (
        kind === `file`
        ? name
        : os.BtnCmd(a.spaced(cmd, entryPath), name)
      ),
      ` `,
      u.BtnClip(entryPath),
      a.vac(statStr) && ` (${statStr})`,
    ])
  }

  return u.LogLines(
    [`contents of `, locPre, `directory ${a.show(path)}`, statSuf, `:`],
    ...u.alignTable(buf),
  )
}

export const SHOW_DIR = `show`

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
  const cmd = cmdShow.cmd
  const opt = a.Emp()
  const paths = []

  for (const [key, val] of a.tail(u.cliDecode(args))) {
    if (key === `-c`) opt.copy = ui.cliBool(cmd, key, val)
    else if (key === `-l`) opt.log = ui.cliBool(cmd, key, val)
    else if (key === `-w`) opt.write = ui.cliBool(cmd, key, val)
    else if (key === `-p`) opt.pretty = ui.cliBool(cmd, key, val)
    else if (!key) paths.push(val)
    else return u.LogParagraphs(`unrecognized flag ${a.show(key)}`, os.cmdHelpDetailed(cmdShow))
  }

  if (!paths.length) {
    return u.LogParagraphs(`missing input paths`, os.cmdHelpDetailed(cmdShow))
  }

  if (!(opt.copy || opt.log || opt.write)) {
    return `no action flags provided, nothing done`
  }

  for (const path of paths) {
    try {
      await showSavesOrDirOrFile({sig, path, opt})
    }
    catch (err) {
      u.log.err(`[show] unable to show ${a.show(path)}: `, err)
    }
  }
}

export async function showSavesOrDirOrFile({sig, path, opt}) {
  u.reqSig(sig)
  path = u.paths.clean(path)
  const [maybeDir, restPath] = u.paths.split1(path)

  if (maybeDir === `saves`) {
    return showSaves({sig, path: restPath, opt})
  }

  const root = await historyDirReq(sig)
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
  if (!isHandleGameFile(file)) {
    u.log.info(`unable to show file ${a.show(path || file.name)}: unknown format`)
    return
  }
  const data = await readDecodeGameFile(sig, file)
  await showData({sig, root, path, data, opt})
}

/*
This requires a root dir, and writes a file there, because we prefer to write
the "showed" files to the root dir, rather than sub-dirs, to avoid them
becoming new "round" files in run dirs.
*/
export async function showData({sig, root, path, data, opt}) {
  u.reqSig(sig)
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
    root ??= await historyDirReq(sig)

    const outDirName = SHOW_DIR
    const outDir = await getDirectoryHandle(sig, root, outDirName, {create: true})

    const outName = u.paths.name(path) + `.json`
    await writeDirFile(sig, outDir, outName, coded)

    const outPath = u.paths.join(root.name, outDirName, outName)
    u.log.info(`wrote decoded content of ${a.show(path)} to ${a.show(outPath)}`)
  }
}

export async function showSaves({sig, path, opt}) {
  u.reqSig(sig)
  a.optStr(path)

  // TODO store the handle to IDB to avoid re-prompting.
  const dir = await reqFsDirPick()()

  if (path) {
    const handle = await getFileHandle(sig, dir, path)
    await showFile({sig, file: handle, path, opt})
    return
  }

  for await (const handle of readDir(sig, dir)) {
    await showFile({sig, file: handle, path: u.paths.join(path, handle.name), opt})
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
    const ord = u.toNatOpt(han.name)
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
    if (u.toNatOpt(val.name) === int) return val
  }
  return undefined
}

export async function readRunsAsc(sig, root) {
  return (await readDirAsc(sig, root)).filter(isHandleRunDir)
}

export async function readRunsByNamesAscOpt(sig, root, names) {
  u.reqSig(sig)
  a.reqInst(root, FileSystemDirectoryHandle)
  const out = []

  for (const name of a.values(names)) {
    let dir
    try {
      dir = await getDirectoryHandle(sig, root, name)
    }
    catch (err) {
      if (err?.cause?.name === `NotFoundError`) continue
      throw err
    }
    out.push(dir)
  }
  return out
}

export async function* readRunRoundsAsc(sig, dir) {
  for (const file of await readRunRoundHandlesAsc(sig, dir)) {
    yield await readDecodeGameFile(sig, file)
  }
}

// The iteration order is undefined and unstable.
export async function* readRunRounds(sig, dir) {
  for await (const file of readRunRoundHandles(sig, dir)) {
    yield await readDecodeGameFile(sig, file)
  }
}

export async function readRunRoundHandlesAsc(sig, dir) {
  return (await u.asyncIterCollect(sig, readRunRoundHandles(sig, dir))).sort(compareHandlesAsc)
}

export async function readRunRoundHandlesDesc(sig, dir) {
  return (await u.asyncIterCollect(sig, readRunRoundHandles(sig, dir))).sort(compareHandlesDesc)
}

// The iteration order is undefined and unstable.
export async function* readRunRoundHandles(sig, dir) {
  for await (const file of readDir(sig, dir)) {
    if (isHandleRoundFile(file)) yield file
  }
}

export async function findLatestRunName(sig, root) {
  a.reqInst(root, FileSystemDirectoryHandle)
  return a.head((await readDirDesc(sig, root)).filter(isDir))?.name
}

// SYNC[run_id_name_format].
export function isHandleRunDir(val) {
  a.reqInst(val, FileSystemHandle)
  if (!isDir(val)) return false
  const [run_num, run_ms] = u.splitKeys(val.name)
  return a.isSome(u.toNatOpt(run_num)) && a.isSome(u.toNatOpt(run_ms))
}

export function isHandleRoundFile(handle) {
  return u.isGameFileName(handle.name) && u.hasIntPrefix(handle.name)
}

export function isHandleGameFile(handle) {
  a.reqInst(handle, FileSystemHandle)
  if (!isFile(handle)) return false
  return u.isGameFileName(handle.name)
}

// SYNC[decode_game_file].
export async function readDecodeGameFile(sig, file) {
  a.reqInst(file, FileSystemFileHandle)

  if (file.name.endsWith(`.json.gz`)) {
    const src = await readFileByteArr(sig, file)
    return JSON.parse(await u.byteArr_to_ungzip_to_str(src))
  }

  const src = await readFileText(sig, file)
  return u.decodeGdStr(src)
}

export async function writeEncodeGameFile(sig, tar, src) {
  await writeFile(sig, tar, await u.data_to_json_to_gzip_to_base64Str(src))
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

export async function readFileText(sig, src) {
  src = await getFile(sig, src)
  src = await u.wait(sig, src.text())
  return src
}

export async function readFileByteArr(sig, src) {
  src = await getFile(sig, src)
  src = await u.wait(sig, await src.arrayBuffer())
  return new Uint8Array(src)
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

export function fileConfHasPermission(sig, conf) {
  const {handle, mode} = a.reqInst(conf, FileConf)
  return hasPermission(sig, handle, {mode})
}

export async function hasPermission(sig, handle, opt) {
  return (await queryPermission(sig, handle, opt)) === `granted`
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

export function isDir(val) {return a.optObj(val)?.kind === `directory`}
export function isFile(val) {return a.optObj(val)?.kind === `file`}

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

export async function queryPermission(sig, src, opt) {
  u.reqSig(sig)
  if (!a.optInst(src, FileSystemHandle)) return undefined
  try {
    return await u.wait(sig, src.queryPermission(opt))
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

  const int = u.toNatOpt(name)
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

export const STORAGE_KEY_FS_SCHEMA_VERSION = `tabularius.fs_schema_version`

export async function migOpt() {
  const store = localStorage
  const storeKey = STORAGE_KEY_FS_SCHEMA_VERSION
  const verNext = s.ROUND_FIELDS_SCHEMA_VERSION
  const verPrev = a.intOpt(store.getItem(storeKey))
  if (verPrev >= verNext) return

  try {
    const fm = await import(`./fs_mig.mjs`)
    const out = await fm.migrateRuns()
    u.storageSet(store, storeKey, verNext)
    u.log.verb(`updated run history from schema version ${verPrev} to ${verNext}, summary: `, out)
  }
  catch (err) {
    u.log.err(`unable to update run history schema: `, err)
  }
}
