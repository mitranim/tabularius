import * as a from '@mitranim/js/all.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as i from './idb.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'
import {E} from './ui.mjs'
import * as ls from './ls.mjs'

import * as self from './fs.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.fs = self
a.patch(globalThis, namespace)

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
    this.help = a.reqFun(src.help)
    this.cmd = a.reqValidStr(src.cmd)
    this.mode = a.reqValidStr(src.mode)
    this.deprecated = a.optBool(src.deprecated)
    this.pick = a.reqFun(src.pick)
    this.validate = a.optFun(src.validate)
    this.handle = undefined
    this.perm = undefined
    return a.obs(this)
  }

  clear() {
    this.handle = undefined
    this.perm = undefined
  }
}

export const SAVE_DIR_NAME = `SaveFolder`
export const SAVE_DIR_PATH = `AppData\\LocalLow\\Parallel45\\tower-dominion\\${SAVE_DIR_NAME}`
export const SAVE_BACKUP_DIR_NAME = `Backup`
export const PROG_FILE_NAME = `Progress.gd`
export const BACKUP_DIR_NAME = `backup`
export const SHOW_DIR_NAME = `show`

/*
"Picking" a progress file is deprecated and no longer supported in the CLI
interface. The preferred approach is to pick the entire save dir. That said,
we still try to load it from IndexedDB for pre-existing users who haven't yet
granted access to the save dir.
*/
export const PROGRESS_FILE_CONF = new FileConf({
  key: `progress_file`,
  desc: `progress file`,
  help: progFileHelp,
  cmd: `deprecated`,
  mode: `read`,
  deprecated: true,
  pick: pickProgressFile,
  validate: undefined,
})

// Deprecated, TODO drop.
function progFileHelp() {
  return ui.LogParagraphs(
    `pick your game progress file`,
    `typical location of progress file; note that "AppData" is hidden by default:`,
    `  C:\\Users\\<user>\\${SAVE_DIR_PATH}\\${PROG_FILE_NAME}`,
  )
}

export const SAVE_DIR_CONF = new FileConf({
  key: `save_dir`,
  desc: `save dir`,
  help: saveDirHelp,
  cmd: `saves`,
  mode: `read`,
  pick: pickSaveDir,
  validate: validateSaveDir,
})

function saveDirHelp() {
  return ui.LogParagraphs(`pick your game save directory`, SaveDirLocation())
}

export function SaveDirLocation() {
  return ui.LogParagraphs(
    `typical location of game save directory; note that "AppData" is hidden by default:`,
    [`  `, SaveDirPath()],
  )
}

function SaveDirPath() {
  return ui.Bold(`C:\\Users\\`, ui.Muted(`<user>`), `\\`, SAVE_DIR_PATH)
}

export const HISTORY_DIR_CONF = new FileConf({
  key: `history_dir`,
  desc: `history dir`,
  help: histDirHelp,
  cmd: `history`,
  mode: `readwrite`,
  pick: pickHistoryDir,
  validate: validateHistoryDir,
})

function histDirHelp() {
  return ui.LogParagraphs(
    `pick directory for run history (backups)`,
    HistDirSuggestedLocation(),
  )
}

export function HistDirSuggestedLocation() {
  return ui.LogParagraphs(
    `suggested location of run history dir; create it yourself; use a name without spaces:`,
    [`  `, HistDirSuggestedPath()],
  )
}

export function HistDirSuggestedPath() {
  return ui.Bold(
    `C:\\Users\\`, ui.Muted(`<user>`), `\\Documents\\tower_dominion_history`,
  )
}

export const CONFS = [
  PROGRESS_FILE_CONF,
  SAVE_DIR_CONF,
  HISTORY_DIR_CONF,
]

export async function loadedProgressFile(sig) {
  return !!await fileConfLoadedWithPermIdemp({sig, conf: PROGRESS_FILE_CONF})
}

export async function loadedSaveDir(sig) {
  return !!await fileConfLoadedWithPermIdemp({sig, conf: SAVE_DIR_CONF})
}

export async function loadedHistoryDir(sig) {
  return !!await fileConfLoadedWithPermIdemp({sig, conf: HISTORY_DIR_CONF})
}

export async function fileConfLoadedWithPermIdemp({sig, conf, req}) {
  a.optBool(req)
  return (
    (await fileConfWithPermission({sig, conf})) ||
    (await fileConfLoadedWithPerm({sig, conf, req}))
  )
}

/*
Try to load a handle and check its permission.
SYNC[file_conf_status].
*/
export async function fileConfLoadedWithPerm({sig, conf, req}) {
  u.reqSig(sig)
  a.optBool(req)

  const {mode} = a.reqInst(conf, FileConf)
  await fileConfLoad(conf)

  if (!conf.handle) {
    if (req) throw new ui.ErrLog(...msgNotInited(conf))
    return undefined
  }

  conf.perm = await queryPermission({sig, handle: conf.handle, opt: {mode}})
  if (conf.perm === `granted`) return conf.handle

  const err = new ui.ErrLog(...msgNotGranted(conf))
  if (req) throw err
  ui.LOG.err(err)
  return undefined
}

export async function fileConfLoadIdemp({sig, conf}) {
  u.reqSig(sig)
  const {handle} = a.reqInst(conf, FileConf)
  if (handle) await fileConfRequirePermission({sig, conf})
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
    ui.LOG.err(desc, `: error loading handle from DB:`, err)
    return
  }

  ui.LOG.verb(desc, `: loaded handle from DB`)

  if (!a.isInst(handle, FileSystemHandle)) {
    ui.LOG.info(desc, `: expected FileSystemHandle; deleting corrupted DB entry`)
    i.dbDel(store, key).catch(ui.logErr)
    return
  }

  conf.handle = handle
}

export async function initedProgressFile(sig) {
  const conf = PROGRESS_FILE_CONF
  return await fileConfInitedIdemp({sig, conf})
}

export async function initedSaveDir(sig) {
  const conf = SAVE_DIR_CONF
  return await fileConfInitedIdemp({sig, conf})
}

export async function initedHistoryDir(sig) {
  const conf = HISTORY_DIR_CONF
  return await fileConfInitedIdemp({sig, conf})
}

export function fileConfInitedIdemp({sig, conf}) {
  const {handle} = a.reqInst(conf, FileConf)
  if (!handle) return fileConfInited({sig, conf})
  return fileConfRequireOrRequestPermission({sig, conf})
}

/*
See the comment on `fileConfRequireOrRequestPermission`. This must be used only
on a user action, such as prompt input submission or a click.
*/
export async function fileConfInited({sig, conf}) {
  u.reqSig(sig)
  const {desc, help, key, pick, validate} = a.reqInst(conf, FileConf)

  if (!conf.handle) await fileConfLoad(conf)

  if (!conf.handle) {
    ui.LOG.info(help())
    conf.handle = a.reqInst(await u.wait(sig, pick()), FileSystemHandle)
  }

  if (validate) {
    try {await validate({sig, handle: conf.handle})}
    catch (err) {
      conf.clear()
      throw err
    }
  }

  await fileConfRequireOrRequestPermission({sig, conf})

  try {
    await u.wait(sig, i.dbPut(i.IDB_STORE_HANDLES, key, conf.handle))
    ui.LOG.info(desc, `: stored handle to DB`)
  }
  catch (err) {
    ui.LOG.err(desc, `: error storing handle to DB:`, err)
  }
  return conf.handle
}

export async function validateSaveDir({sig, handle}) {
  a.reqInst(handle, FileSystemDirectoryHandle)
  const cmd = SAVE_DIR_CONF.cmd

  if (await dirHasProgressFile({sig, dir: handle})) {
    if (handle.name !== SAVE_BACKUP_DIR_NAME) return

    throw new ui.ErrLog(...ui.LogParagraphs(
      `${a.show(handle.name)} appears to be the game's backup directory; please pick the actual save directory (one level higher)`,
      msgRerun(cmd),
      SaveDirLocation(),
    ))
  }

  const subDir = await getDirectoryHandle({sig, dir: handle, name: SAVE_DIR_NAME}).catch(a.nop)
  if (subDir && await dirHasProgressFile({sig, dir: subDir})) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      `${a.show(handle.name)} appears to be the game's data directory; please pick the save directory inside`,
      msgRerun(cmd),
      SaveDirLocation(),
    ))
  }

  throw new ui.ErrLog(...ui.LogParagraphs(
    [
      a.show(handle.name), ` doesn't appear to be the game's save directory: `,
      `unable to locate `, a.show(PROG_FILE_NAME),
    ],
    msgRerun(cmd),
    SaveDirLocation(),
  ))
}

function msgRerun(cmd) {
  return [`rerun `, os.BtnCmdWithHelp(cmd), ` to try again`]
}

export async function validateHistoryDir({sig, handle}) {
  a.reqInst(handle, FileSystemDirectoryHandle)
  const cmd = HISTORY_DIR_CONF.cmd

  const subDir = await getDirectoryHandle({sig, dir: handle, name: SAVE_DIR_NAME}).catch(a.nop)
  if (subDir && await dirHasProgressFile({sig, dir: subDir})) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      `${a.show(handle.name)} appears to be the game's data directory; your run history directory must be located outside of game directories`,
      msgRerun(cmd),
      HistDirSuggestedLocation(),
    ))
  }

  if (!await dirHasProgressFile({sig, dir: handle})) return

  const desc = (
    handle.name === SAVE_DIR_NAME
    ? `save directory`
    : handle.name === SAVE_BACKUP_DIR_NAME
    ? `save backup directory`
    : `save or backup directory`
  )

  throw new ui.ErrLog(...ui.LogParagraphs(
    `${a.show(handle.name)} appears to be the game's ${desc} (found ${a.show(PROG_FILE_NAME)}); your run history directory must be located outside of game directories`,
    msgRerun(cmd),
    HistDirSuggestedLocation(),
  ))
}

export async function dirHasProgressFile({sig, dir}) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  return !!await getFileHandle({sig, dir, name: PROG_FILE_NAME}).catch(a.nop)
}

export async function fileConfDeinit({sig, conf}) {
  u.reqSig(sig)
  const {key, desc} = a.reqInst(conf, FileConf)

  try {
    await u.wait(sig, i.dbDel(i.IDB_STORE_HANDLES, key))
  }
  catch (err) {
    ui.LOG.err(desc, `: error deleting from DB:`, err)
  }

  if (!conf.handle) {
    return {done: false, msg: `${desc}: access not granted`}
  }
  conf.clear()
  return {done: true, msg: `${desc}: access revoked`}
}

// SYNC[file_conf_status].
export function fileConfStatusMsg(conf) {
  const {handle, perm, desc} = a.reqInst(conf, FileConf)
  if (!handle) return msgNotInited(conf)
  if (perm !== `granted`) return msgNotGranted(conf)
  return [desc, `: `, handle.name]
}

// SYNC[file_conf_status].
export async function fileConfStatusProblem({sig, conf}) {
  u.reqSig(sig)
  const {handle, mode} = a.reqInst(conf, FileConf)
  if (!handle) return msgNotInited(conf)

  conf.perm = await queryPermission({sig, handle, opt: {mode}})
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
export async function fileConfRequireOrRequestPermission({sig, conf}) {
  const {handle, desc, mode} = a.reqInst(conf, FileConf)
  if (!handle) throw new ui.ErrLog(...msgNotInited(conf))

  conf.perm = await queryPermission({sig, handle, opt: {mode}})
  if (conf.perm === `granted`) return handle

  ui.LOG.info(desc, `: permission: `, a.show(conf.perm), `, requesting permission`)
  conf.perm = await requestPermission({sig, handle, opt: {mode}})
  if (conf.perm === `granted`) return handle

  throw new ui.ErrLog(...msgNotGranted(conf))
}

function msgNotInited(conf) {
  const {desc, cmd} = a.reqInst(conf, FileConf)
  return [desc, `: access not granted, run `, os.BtnCmdWithHelp(cmd), ` to provide access`]
}

function msgNotGranted(conf) {
  const {desc, cmd} = a.reqInst(conf, FileConf)
  return [desc, `: permission needed, run `, os.BtnCmdWithHelp(cmd), ` to grant`]
}

export async function fileConfRequirePermission({sig, conf}) {
  const msg = await fileConfStatusProblem({sig, conf})
  if (msg) throw new ui.ErrLog(...msg)
  return conf.handle
}

export function fileHandleStatStr({sig, handle}) {
  a.reqInst(handle, FileSystemHandle)
  if (isDir(handle)) return dirStats({sig, dir: handle})
  if (isFile(handle)) return fileStats({sig, file: handle})
  ui.LOG.err(errHandleKind(handle.kind))
  return undefined
}

export async function fileStats({sig, file}) {
  const blob = await getFileBlob({sig, file})

  return ui.withTooltip({
    elem: ui.Span(formatSize(blob.size)),
    chi: [`modified at: `, ui.dateFormat.format(blob.lastModified)],
  })
}

export async function fileSize({sig, file}) {
  return (await getFileBlob({sig, file})).size
}

export async function dirStats({sig, dir}) {
  const {fileCount, dirCount, byteCount} = await dirStat({sig, dir})
  return u.intersperseOpt([
    a.vac(fileCount) && [fileCount, ` `, ui.Muted(`files`)],
    a.vac(dirCount) && [dirCount, ` `, ui.Muted(`dirs`)],
    a.vac(byteCount) && formatSize(byteCount),
  ], `, `)
}

// Get statistics about a directory (file count, dir count, total size).
export async function dirStat({sig, dir, out}) {
  out ??= a.Emp()
  out.fileCount = a.laxInt(out.fileCount)
  out.dirCount = a.laxInt(out.dirCount)
  out.byteCount = a.laxInt(out.byteCount)

  for await (const val of readDir({sig, dir})) {
    if (isDir(val)) {
      await dirStat({sig, dir: val, out})
      out.dirCount++
      continue
    }

    if (isFile(val)) {
      out.byteCount += await fileSize({sig, file: val})
      out.fileCount++
    }
  }
  return out
}

// Deprecated.
export async function pickProgressFile() {
  return a.head(await reqFsFilePick()({
    types: [{description: `Game [save / progress] file`}],
    multiple: false
  }))
}

export async function pickSaveDir() {
  return await reqFsDirPick()({
    types: [{description: `Original game save directory`}],
  })
}

export async function pickHistoryDir() {
  return await reqFsDirPick()({
    types: [{description: `Directory for [run history / backups]`}],
  })
}

export async function progressFileOpt(sig) {
  const file = await fileConfWithPermission({sig, conf: PROGRESS_FILE_CONF}).catch(ui.logErr)
  if (file) return file

  const dir = await saveDirOpt(sig).catch(ui.logErr)
  if (!dir) return undefined

  return getFileHandle({sig, dir, name: PROG_FILE_NAME}).catch(ui.logErr)
}

export async function progressFileReq(sig) {
  const file = await fileConfWithPermission({sig, conf: PROGRESS_FILE_CONF}).catch(ui.logErr)
  if (file) return file
  const dir = await saveDirReq(sig)
  return getFileHandle({sig, dir, name: PROG_FILE_NAME})
}

export function saveDirOpt(sig) {
  return fileConfWithPermission({sig, conf: SAVE_DIR_CONF})
}

export function saveDirReq(sig) {
  return fileConfLoadedWithPermIdemp({sig, conf: SAVE_DIR_CONF, req: true})
}

export function historyDirOpt(sig) {
  return fileConfWithPermission({sig, conf: HISTORY_DIR_CONF})
}

export function historyDirReq(sig) {
  return fileConfLoadedWithPermIdemp({sig, conf: HISTORY_DIR_CONF, req: true})
}

// TODO move to `ls.mjs`.
export async function listDirsFiles({sig, path, stat}) {
  a.optStr(path)
  a.optBool(stat)

  path = u.paths.cleanTop(a.laxStr(path))

  if (!path) {
    return ui.LogLines(
      [`top-level FS entries`, a.vac(!stat) && [` `, ...StatTip(path)], `:`],
      ...u.alignCol(await Promise.all(a.map(
        CONFS,
        conf => FileConfLine({sig, conf, stat}),
      ))),
    )
  }

  const {handle} = await handleAtPathFromTop({sig, path})
  const {kind, name} = handle

  if (isFile(handle)) {
    return ls.LsEntry({
      kind, name, path, stat,
      stats: a.vac(stat) && await fileStats({sig, file: handle}),
    })
  }

  return ls.LsEntry({
    kind, name, path, stat,
    entries: await dirEntries({sig, dir: handle, stat}),
  })
}

export async function FileConfLine({sig, conf, stat}) {
  u.reqSig(sig)
  a.optBool(stat)
  const {desc, handle, deprecated} = a.reqInst(conf, FileConf)

  if (handle) {
    const cmd = a.spaced(`ls`, (stat ? `-s` : ``))
    const stats = a.vac(stat) && await fileHandleStatStr({sig, handle})
    return ls.EntryLine({entry: handle, desc, cmd, stats})
  }

  if (deprecated) return undefined
  return [desc + `: `, `access not granted, run `, os.BtnCmdWithHelp(conf.cmd)]
}

async function dirEntries({sig, dir, stat}) {
  a.optBool(stat)
  const out = []
  for (const val of await readDirAsc({sig, dir})) {
    out.push({
      kind: val.kind,
      name: val.name,
      stats: a.vac(stat) && await fileHandleStatStr({sig, handle: val}),
    })
  }
  return out
}

export function StatTip(path) {
  const cmd = `ls -s`
  return [`(tip: `, os.BtnCmd(a.spaced(cmd, path), cmd), ` adds stats)`]
}

cmdShow.cmd = `show`
cmdShow.desc = `decode and show game files / runs / rounds, with flexible output options`
cmdShow.help = function cmdShowHelp() {
  const {cmd} = cmdShow
  const saveDir = a.laxStr(SAVE_DIR_CONF.handle?.name)
  const histDir = a.laxStr(HISTORY_DIR_CONF.handle?.name)

  return ui.LogParagraphs(
    u.callOpt(cmdShow.desc),

    ui.LogLines(
      `usage:`,
      [
        `  `,
        ui.BtnPrompt({full: true, cmd, eph: `<flags> <path>`}),
        `            -- one dir or file`,
      ],
      [
        `  `,
        ui.BtnPrompt({full: true, cmd, eph: `<flags> <path> ... <path>`}),
        ` -- any dirs or files`,
      ],
    ),

    ui.LogLines(
      `flags:`,
      [`  `, ui.BtnPrompt({cmd, suf: `-c`}), ` -- copy decoded JSON to clipboard`],
      [`  `, ui.BtnPrompt({cmd, suf: `-l`}), ` -- log decoded data to browser console`],
      [`  `, ui.BtnPrompt({cmd, suf: `-w`}), ` -- write JSON file to "`, (histDir || `<run_history>`), `/show/"`],
      [`  `, ui.BtnPrompt({cmd, suf: `-o`}), ` -- `, ui.Bold(`overwrite`), ` each file with decoded JSON`],
    ),

    ui.LogLines(
      `path segments can be magic:`,
      [`  `, ui.BtnPrompt({cmd, suf: histDir + `/`, eph: `<num>`}), `         -- specific run`],
      [`  `, ui.BtnPrompt({cmd, suf: u.paths.join(histDir, `latest`)}), `        -- latest run`],
      [`  `, ui.BtnPrompt({cmd, suf: u.paths.join(histDir, `latest`) + `/`, eph: `<num>`}), `  -- latest run, specific round`],
      [`  `, ui.BtnPrompt({cmd, suf: u.paths.join(histDir, `latest/latest`)}), ` -- latest round`],
    ),

    (
      !saveDir
      ? [
        `to decode and show game files, grant access to the original save directory`,
        ` via `, os.BtnCmdWithHelp(SAVE_DIR_CONF.cmd),
      ]
      : ui.LogLines(
        `examples for game files:`,
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l`, saveDir)}), ` -- log all game files`],
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l -c -w`, saveDir)}), ` -- log, clipboard, write decoded content of all game files`],
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l`, u.paths.join(saveDir, PROG_FILE_NAME))}), ` -- log current progress`],
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-o`, u.paths.join(saveDir, PROG_FILE_NAME))}), ` -- decode the progress file in-place, making it editable`],
      )
    ),

    (
      !histDir
      ? [
        `to decode and show runs and rounds in the run history directory, `,
        `grant access via `, os.BtnCmdWithHelp(HISTORY_DIR_CONF.cmd), `; `,
        `to build the run history in the first place, also grant access to the `,
        `original save directory via `, os.BtnCmdWithHelp(SAVE_DIR_CONF.cmd),
      ]
      : ui.LogLines(
        `examples for run history:`,
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l`, u.paths.join(histDir, `latest`))}), ` -- log all rounds in latest run`],
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l`, u.paths.join(histDir, `latest/latest`))}), ` -- log latest round in latest run`],
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l -c -w`, u.paths.join(histDir, `latest`))}), ` -- log, clipboard, write all rounds in latest run`],
        [`  `, ui.BtnPrompt({cmd, suf: a.spaced(`-l -c -w`, u.paths.join(histDir, `latest/latest`))}), ` -- log, clipboard, write latest round in latest run`],
      )
    ),

    `if no flags are provided, nothing is done`,

    [`tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse local files`],
  )
}

export async function cmdShow({sig, args}) {
  const cmd = cmdShow.cmd
  const opt = a.Emp()
  const paths = []

  for (const [key, val, pair] of a.tail(u.cliDecode(args))) {
    if (u.isHelpFlag(key)) return os.cmdHelpDetailed(cmdShow)
    if (key === `-c`) opt.copy = ui.cliBool(cmd, key, val)
    else if (key === `-l`) opt.log = ui.cliBool(cmd, key, val)
    else if (key === `-w`) opt.write = ui.cliBool(cmd, key, val)
    else if (key === `-o`) opt.over = ui.cliBool(cmd, key, val)
    else if (!key) paths.push(val)
    else {
      ui.LOG.err(ui.msgUnrecInput(pair, args))
      return os.cmdHelpDetailed(cmdShow)
    }
  }

  if (!paths.length) {
    ui.LOG.err(`missing input paths in `, ui.BtnPromptReplace(args))
    return os.cmdHelpDetailed(cmdShow)
  }

  if (!(opt.copy || opt.log || opt.write || opt.over)) {
    return `no action flags provided, nothing done`
  }

  const state = a.Emp()
  state.over = 0

  for (const path of paths) {
    try {
      await showPath({sig, path, state, opt})
    }
    catch (err) {
      ui.LOG.err(`[show] unable to show ${a.show(path)}: `, err)
    }
  }

  if (state.over) {
    ui.LOG.info(
      `tip: the JSON content of overwritten files can be edited manually with any text editor; after saving those files, just launch the game; it's able to read JSON as-is`,
    )
  }

  return undefined
}

export async function showPath({sig, path, state, opt}) {
  u.reqSig(sig)
  const {handle, path: resolved} = await handleAtPathFromTop({
    sig, path, magic: true,
  })
  return showDirOrFile({sig, handle, path: resolved, state, opt})
}

export function showDirOrFile({sig, handle, path, state, opt}) {
  a.reqInst(handle, FileSystemHandle)
  if (isDir(handle)) {
    return showDir({sig, dir: handle, path, state, opt})
  }
  if (isFile(handle)) {
    return showFile({sig, file: handle, path, state, opt})
  }
  throw errHandleKind(handle.kind)
}

export async function showDir({sig, dir, path, state, opt}) {
  const out = []

  for await (const file of readDir({sig, dir, filter: isHandleGameFile})) {
    out.push(showFile({
      sig,
      file,
      path: u.paths.join(path, file.name),
      state,
      opt,
    }).catch(ui.logErr))
  }

  if (!out.length) {
    ui.LOG.info(`no game files found in ${a.show(path)}`)
    return
  }

  await Promise.all(out)
}

export async function showFile({sig, file, path, state, opt}) {
  u.reqSig(sig)
  a.reqValidStr(path)
  a.optRec(state)

  if (!isHandleGameFile(file)) {
    ui.LOG.err(`unable to show file ${a.show(path)}: unknown format`)
    return
  }

  const data = await readDecodeGameFile({sig, file})
  const {copy, log, write, over} = a.laxRec(opt)
  let json

  if (copy) {
    json ??= a.jsonEncode(data, undefined, 2)
    await u.copyToClipboard(json)
    ui.LOG.info(`copied decoded content of ${a.show(path)} to clipboard`)
  }

  if (log) {
    console.log(`[show] decoded content of ${a.show(path)}:`)
    console.log(data)
    ui.LOG.info(`logged decoded content of ${a.show(path)} to browser devtools console`)
  }

  if (write) {
    json ??= a.jsonEncode(data, undefined, 2)

    const hist = await historyDirReq(sig)
    const outDirName = SHOW_DIR_NAME
    const outDir = await getDirectoryHandle({sig, dir: hist, name: outDirName, opt: {create: true}})

    let outName = u.paths.name(path)
    if (!outName.endsWith(`.json`)) outName += `.json`
    await writeDirFile({sig, dir: outDir, name: outName, body: json})

    const outPath = u.paths.join(hist.name, outDirName, outName)

    ui.LOG.info(ui.LogParagraphs(
      `wrote decoded content of ${a.show(path)} to ${a.show(outPath)}`,
      a.vac(!over) && [
        `tip: for editing game files in-place, use the `,
        ui.BtnPrompt({cmd: `show`, suf: `-o`}),
        ` option`,
      ],
    ))
  }

  if (over) {
    json ??= a.jsonEncode(data, undefined, 2)
    await backupFile({sig, file, srcPath: path, uniq: true})
    await writeFile({sig, file, body: json, path})
    ui.LOG.info(`overwrote ${a.show(path)} with decoded JSON`)
    if (state) state.over = a.laxNat(state.over) + 1
  }
}

cmdRollback.cmd = `rollback`
cmdRollback.desc = `roll back the latest round`
cmdRollback.help = function cmdRollbackHelp() {
  return ui.LogParagraphs(
    cmdRollback.desc,
    [
      `finds the latest round in the latest run in the history directory and copies it to the game's save directory, overwriting `,
      a.show(PROG_FILE_NAME),
    ],
    [
      `requires `, os.BtnCmdWithHelp(`saves`), `, to grant access to the save directory,`,
      ` and `, os.BtnCmdWithHelp(`history`), `, to grant access to the run history directory`,
    ],
    `when invoked for the first time, will request read-write access to the save directory`,
    `makes an additional backup before writing the file`,
    `game must be closed before running this command, otherwise this will have no effect, the game will ignore and overwrite the file`,
  )
}

export async function cmdRollback({sig, args}) {
  const cmd = cmdRollback.cmd
  args = u.splitCliArgs(u.stripPreSpaced(args, cmd))
  if (u.hasHelpFlag(args)) return os.cmdHelpDetailed(cmdRollback)

  if (args.length) {
    throw new ui.ErrLog(
      `too many inputs; `, os.BtnCmd(cmd), ` takes no inputs`,
    )
  }

  const histDir = await historyDirReq(sig)
  const runDir = await findLatestRunDir({sig, dir: histDir})
  const roundFile = await findLatestRoundFile({sig, dir: runDir})
  const targetFile = await progressFileReq(sig)

  await requireOrRequestReadwrite({sig, handle: targetFile})

  const body = await readFileByteArr({sig, file: roundFile})
  const srcPath = u.paths.join(histDir.name, runDir.name, roundFile.name)

  const tarPath = u.paths.join(
    a.laxStr(SAVE_DIR_CONF.handle?.name),
    targetFile.name,
  )

  await backupFile({sig, file: targetFile, dir: histDir, srcPath: tarPath, uniq: true})
  await writeFile({sig, file: targetFile, body})

  return ui.LogParagraphs(
    ui.LogLines(
      `overwrote the content of:`,
      [`  `, a.show(tarPath)],
      `  with the content of:`,
      [`  `, a.show(srcPath)],
    ),
    `if the game is currently running, it will ignore this edit and overwrite the file; make sure to close it before running the command`,
  )
}

export async function getBackupDir({sig, dir}) {
  a.optInst(dir, FileSystemDirectoryHandle)
  dir ??= await historyDirReq(sig)
  const out = await getDirectoryHandle({sig, dir, name: BACKUP_DIR_NAME, opt: {create: true}})
  return {
    dir: out,
    path: u.paths.join(dir.name, out.name),
  }
}

export async function backupFile({sig, file, dir, srcPath, uniq}) {
  a.optStr(srcPath)
  a.optBool(uniq)

  const {dir: subDir, path} = await getBackupDir({sig, dir})
  const body = await readFileByteArr({sig, file})
  const name = (
    uniq
    ? u.paths.withNameSuffix(file.name, `_` + Date.now())
    : file.name
  )
  await writeDirFile({sig, dir: subDir, name, body})

  const outPath = u.paths.join(path, name)
  if (srcPath) ui.LOG.info(...msgBackedUp(srcPath, outPath))
  return outPath
}

export function msgBackedUp(src, out) {
  a.reqValidStr(src)
  a.reqValidStr(out)
  return [`backed up `, a.show(src), ` to `, a.show(out)]
}

export async function findLatestDirEntryReq({sig, dir, filter}) {
  const out = await findLatestDirEntryOpt({sig, dir, filter})
  if (out) return out
  throw new ErrFs(`unable to find latest entry in ${a.show(dir.name)}`)
}

export async function findLatestDirEntryOpt({sig, dir, filter}) {
  let max = -Infinity
  let out
  for await (const han of readDir({sig, dir, filter})) {
    const ord = u.toNatOpt(han.name)
    if (!(ord > max)) continue
    max = ord
    out = han
  }
  return out
}

export async function hasRoundFile(sig) {
  const histDir = await historyDirOpt(sig)
  if (!histDir) return false
  for await (const runDir of readDir({sig, dir: histDir, filter: isHandleRunDir})) {
    for await (const _ of readRoundHandles({sig, dir: runDir})) {
      return true
    }
  }
  return false
}

export function findLatestRoundFile({sig, dir}) {
  return findLatestDirEntryOpt({sig, dir, filter: isHandleGameFile})
}

export function findRoundFileAny({sig, path}) {
  if (!path) return findRoundFileAnywhere(sig)
  return findRoundFileAtPath({sig, path})
}

// May return a nil handle, callers must be prepared.
export async function findRoundFileAnywhere(sig) {
  const progFile = await progressFileOpt(sig)
  let progRound

  if (progFile) {
    progRound = await readDecodeGameFile({sig, file: progFile})

    /*
    Having a round index means having some data to show. If the round index
    is zero, then we prefer to look for the latest round in the history dir.
    */
    if (progRound?.RoundIndex) {
      return {handle: progFile, round: progRound, live: true}
    }
  }

  const histDir = await historyDirOpt(sig)

  if (histDir) {
    const runDir = await findLatestRunDir({sig, dir: histDir})
    const roundFile = await findLatestRoundFile({sig, dir: runDir})
    if (roundFile) return {handle: roundFile, live: true}
  }

  if (progFile) return {handle: progFile, live: true}

  const hasSaves = !!await saveDirOpt(sig)

  if (!hasSaves && !histDir) {
    throw new ui.ErrLog(
      `unable to find latest round: no access to `,
      os.BtnCmdWithHelp(`saves`), ` or `, os.BtnCmdWithHelp(`history`),
      `; click to grant`,
    )
  }

  if (!hasSaves) {
    throw new ui.ErrLog(
      `unable to find latest round: no access to `,
      os.BtnCmdWithHelp(`saves`),
      ` (click to grant), and found no rounds in `,
      os.BtnCmdWithHelp(`history`), `; build your history by playing!`,
    )
  }

  // This should only be possible if the progress file was manually deleted
  // from the saves dir.
  throw new ui.ErrLog(
    `unable to find latest round: found no progress file in `,
    os.BtnCmdWithHelp(`saves`),
    `; also no rounds in `,
    os.BtnCmdWithHelp(`history`),
    `; build your history by playing`,
  )
}

export async function findRoundFileAtPath({sig, path: srcPath}) {
  u.reqSig(sig)
  a.reqValidStr(srcPath)

  let {handle, path: outPath} = await handleAtPathFromTop({
    sig, path: srcPath, magic: true,
  })
  let latest = false

  if (handle === HISTORY_DIR_CONF.handle) {
    const dir = await findLatestRunDir({sig, dir: handle})
    if (!dir) {
      throw new ErrFs(`no runs in the history directory; build your history by playing!`)
    }
    handle = dir
    outPath = u.paths.join(outPath, dir.name)
    latest = true
  }

  if (!isFile(handle)) {
    handle = await findLatestRoundFile({sig, dir: handle})
    if (!handle) {
      throw new ErrFs(`found no rounds in ${a.show(outPath)}; build your history by playing!`)
    }
    outPath = u.paths.join(outPath, handle.name)
  }

  if (!isFile(handle)) throw new ErrFs(`${a.show(outPath)} is not a file`)

  const live = latest || (
    // This has a false positive for paths like `history/<num>/latest`.
    // Might consider fixing later.
    srcPath.endsWith(`/latest`) ||

    outPath === u.paths.join(
      a.laxStr(SAVE_DIR_CONF.handle?.name),
      PROG_FILE_NAME,
    )
  )

  return {handle, path: outPath, live}
}

export async function findHandleByIntPrefixReq({sig, dir, int}) {
  const out = await findHandleByIntPrefixOpt({sig, dir, int})
  if (out) return out
  throw new ErrFs(`unable to find ${a.show(u.paths.join(dir.name, String(int)))} by integer prefix`)
}

export async function findHandleByIntPrefixOpt({sig, dir, int}) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqInt(int)

  for await (const val of readDir({sig, dir})) {
    if (u.toNatOpt(val.name) === int) return val
  }
  return undefined
}

export function readRunsAsc({sig, dir}) {
  return readDirAsc({sig, dir, filter: isHandleRunDir})
}

export async function readRunsByNamesAscOpt({sig, dir, names}) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  const out = []

  for (const name of a.values(names)) {
    let sub
    try {
      sub = await getDirectoryHandle({sig, dir, name})
    }
    catch (err) {
      if (err?.cause?.name === `NotFoundError`) continue
      throw err
    }
    out.push(sub)
  }
  return out
}

export function readRoundHandlesAsc({sig, dir}) {
  return u.asyncIterSort({sig, src: readRoundHandles({sig, dir}), fun: compareHandlesAsc})
}

export function readRoundHandlesDesc({sig, dir}) {
  return u.asyncIterSort({sig, src: readRoundHandles({sig, dir}), fun: compareHandlesDesc})
}

export function readRoundHandles({sig, dir}) {
  return readDir({sig, dir, filter: isHandleRoundFile})
}

export async function findLatestRunDir({sig, dir}) {
  return a.head((await readDirDesc({sig, dir, filter: isHandleRunDir})))
}

export function isHandleRunDir(val) {
  a.reqInst(val, FileSystemHandle)
  return isDir(val) && isRunDirName(val.name)
}

// SYNC[run_id_name_format].
export function isRunDirName(val) {
  if (!a.optStr(val)) return false
  const [run_num, run_ms] = u.splitKeys(val)
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
export async function readDecodeGameFile({sig, file}) {
  a.reqInst(file, FileSystemFileHandle)

  try {
    if (file.name.endsWith(`.json.gz`)) {
      const src = await readFileStream({sig, file})
      return await u.textDataStream_to_ungzip_to_unjsonData(src)
    }
    return await u.decodeGdStr(await readFileText({sig, file}))
  }
  catch (err) {throw errDecodeFile(err, file.name)}
}

// SYNC[decode_game_file].
export async function readDecodeGameFileBlob(src) {
  const {name} = a.reqInst(src, File)

  try {
    if (name.endsWith(`.json.gz`)) {
      return await u.textDataStream_to_ungzip_to_unjsonData(src.stream())
    }
    return await u.decodeGdStr(await src.text())
  }
  catch (err) {throw errDecodeFile(err, name)}
}

function errDecodeFile(err, path) {
  return new u.ErrDecoding(`unable to decode file ${a.show(path)}: ${err}`, {cause: err})
}

export async function writeEncodeGameFile({sig, file, data}) {
  await writeFile({sig, file, body: await u.data_to_json_to_gzip_to_base64Str(data)})
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

export async function readFileText({sig, file}) {
  const blob = await getFileBlob({sig, file})
  return u.wait(sig, blob.text())
}

export async function readFileByteArr({sig, file}) {
  const blob = await getFileBlob({sig, file})
  return new Uint8Array(
    await u.wait(sig, await blob.arrayBuffer()),
  )
}

export async function readFileStream({sig, file}) {
  return (await getFileBlob({sig, file})).stream()
}

export async function handleAtPathFromTop({sig, path, magic}) {
  u.reqSig(sig)
  path = a.laxStr(path)
  a.optBool(magic)

  const confs = CONFS
  const seg = u.paths.splitTop(path)

  if (!seg.length) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      [
        `invalid FS path `, a.show(path),
        `: provide a non-empty path to choose a top-level FS entry`,
      ],
      msgTopEntries(confs),
    ))
  }

  const [head, ...tail] = seg
  const matches = a.filter(confs, val => val.handle?.name === head)

  if (!matches.length) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      [`missing top-level FS entry `, a.show(head)],
      msgTopEntries(confs),
    ))
  }

  if (matches.length !== 1) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      [
        `ambiguous path `, a.show(path),
        `: multiple top-level matches for `, a.show(head), `:`,
      ],
      topEntryLines(matches),
      `please rename to disambiguate`,
    ))
  }

  const conf = matches[0]

  // This shouldn't even be possible since we require handles above.
  if (!conf.handle) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      [`access to top-level FS entry `, a.show(head), ` is not granted;`],
      msgTopEntries(confs),
    ))
  }

  const {parent, handle, path: resolved} = await handleAtPathResolved({
    sig,
    handle: conf.handle,
    path: u.paths.join(...tail),
    magic,
  })
  return {parent, handle, path: u.paths.join(head, resolved), fileConf: conf}
}

function msgTopEntries(confs) {
  const lines = topEntryLines(confs)
  if (!lines.length) return undefined
  return ui.LogLines(`top-level FS entries:`, ...a.map(lines, u.indentNode))
}

function topEntryLines(confs) {
  const out = []
  for (const conf of a.values(confs)) {
    const {desc, cmd, handle, deprecated} = a.reqInst(conf, FileConf)

    if (handle) {
      const {name} = handle
      out.push([name, ` `, ui.BtnClip(name)])
      continue
    }

    if (deprecated) continue
    out.push([desc, `: run `, os.BtnCmdWithHelp(cmd), ` to grant access`])
  }
  return out
}

export async function handleAtPath(opt) {
  const {handle} = await handleAtPathResolved(opt)
  return handle
}

export async function handleAtPathResolved({sig, handle, path, magic}) {
  u.reqSig(sig)
  a.reqInst(handle, FileSystemHandle)
  a.optBool(magic)

  path = u.paths.clean(a.laxStr(path))
  let parent = undefined
  if (!path) return {parent, handle, path}

  const seg = []
  for (const name of u.paths.splitRel(path)) {
    parent = handle
    handle = await (
      magic
      ? getSubHandleMagic({sig, dir: handle, name})
      : getSubHandle({sig, dir: handle, name})
    )
    seg.push(handle.name)
  }
  return {parent, handle, path: u.paths.join(...seg)}
}

export function fileConfWithPermission({sig, conf}) {
  const {handle, mode} = a.reqInst(conf, FileConf)
  return withPermission({sig, handle, opt: {mode}})
}

export async function withPermission({sig, handle, opt}) {
  const perm = await queryPermission({sig, handle, opt})
  if (perm === `granted`) return handle
  return undefined
}

// Too specialized, TODO generalize if needed.
export async function getSubFile({sig, dir, dirName, fileName}) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.optValidStr(dirName)
  a.optValidStr(fileName)

  if (!dirName) return undefined
  if (!fileName) return undefined

  const subDir = await getDirectoryHandle({sig, dir, name: dirName})
  if (!subDir) return undefined

  return await getFileHandle({sig, dir: subDir, name: fileName})
}

export async function copyFileTo({sig, file, dir}) {
  const body = await readFileByteArr({sig, file})
  await writeDirFile({sig, dir, name: file.name, body})
}

export async function copyFileBetween({sig, src, out, name}) {
  const file = await getFileHandle({sig, dir: src, name})
  return copyFileTo({sig, file, dir: out})
}

export async function writeDirFile({sig, dir, name, body}) {
  const file = await getFileHandle({sig, dir, name, opt: {create: true}})
  await writeFile({sig, file, body, path: u.paths.join(dir.name, name)})
  return file
}

export async function writeFile({sig, file, body, path}) {
  u.reqSig(sig)
  a.reqInst(file, FileSystemFileHandle)
  u.reqValidTextData(body)
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

export function isDir(val) {return a.optRec(val)?.kind === `directory`}
export function isFile(val) {return a.optRec(val)?.kind === `file`}

export function readDirAsc({sig, dir, filter}) {
  return readDirSorted({sig, dir, filter, compare: compareHandlesAsc})
}

export function readDirDesc({sig, dir, filter}) {
  return readDirSorted({sig, dir, filter, compare: compareHandlesDesc})
}

/*
The sort function must be able to compare handles.
Recommended: `compareHandlesAsc`, `compareHandlesDesc`.
*/
export function readDirSorted({sig, dir, filter, compare}) {
  return u.asyncIterSort({sig, src: readDir({sig, dir, filter}), fun: compare})
}

/*
Iterates all file handles in the directory.
Order is arbitrary and unstable; browsers don't bother sorting.
*/
export async function* readDir({sig, dir, filter}) {
  u.reqSig(sig)
  a.optInst(dir, FileSystemDirectoryHandle)
  a.optFun(filter)
  if (!dir) return

  for await (const val of dir.values()) {
    if (sig.aborted) break
    if (filter && !filter(val)) continue
    yield val
  }
}

export async function queryPermission({sig, handle, opt}) {
  u.reqSig(sig)
  if (!a.optInst(handle, FileSystemHandle)) return undefined
  try {
    return await u.wait(sig, handle.queryPermission(opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to query permission for ${handle.name}: ${err}`, {cause: err})
  }
}

export async function requestPermission({sig, handle, opt}) {
  u.reqSig(sig)
  a.reqInst(handle, FileSystemHandle)
  const mode = a.laxStr(a.optRec(opt)?.mode)

  try {
    return await u.wait(sig, handle.requestPermission(opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to get${mode && ` `}${mode} permission for ${handle.name}: ${err}`, {cause: err})
  }
}

export async function requireOrRequestReadwrite({sig, handle}) {
  const mode = `readwrite`
  const perm0 = await queryPermission({sig, handle, opt: {mode}})
  if (perm0 === `granted`) return handle

  ui.LOG.info(`requesting `, mode, ` permission for `, a.show(handle.name))

  const perm1 = await requestPermission({sig, handle, opt: {mode}})
  if (perm1 !== `granted`) {
    throw new ErrFsPerm(`needed ${mode} permission "granted", got permission ${a.show(perm1 || perm0)}`)
  }
  return handle
}

export async function getFileBlob({sig, file, opt}) {
  u.reqSig(sig)
  a.reqInst(file, FileSystemFileHandle)
  try {
    return await u.wait(sig, file.getFile(opt))
  }
  catch (err) {
    throw new ErrFs(`unable to get file for handle ${file.name}: ${err}`, {cause: err})
  }
}

/*
Rules:

- The magic name `latest` refers to the last directory or file, where sorting is
  done by integer prefix before falling back on string sort; see `compareDesc`.

- Any path segment which looks like an integer, optionally zero-padded, can
  match any directory or file with a matching integer prefix in its name.
*/
export async function getSubHandleMagic({sig, dir, name}) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  if (name === `latest`) return findLatestDirEntryReq({sig, dir})

  const int = u.toNatOpt(name)
  if (a.isNil(int)) return getSubHandle({sig, dir, name})

  try {
    return await getSubHandle({sig, dir, name})
  }
  catch {
    let out
    try {
      out = await findHandleByIntPrefixOpt({sig, dir, int})
    }
    catch (err) {
      throw new ErrFs(`unable to find ${a.show(u.paths.join(dir.name, name))} by integer prefix: ${err}`, {cause: err})
    }
    if (out) return out
    throw new ErrFs(`unable to find ${a.show(u.paths.join(dir.name, name))} either directly or by integer prefix`)
  }
}

export async function getSubHandle({sig, dir, name, opt}) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  try {return await getFileHandle({sig, dir, name, opt})}
  catch (err) {
    if (err?.cause?.name !== `TypeMismatchError`) throw err
  }
  return await getDirectoryHandle({sig, dir, name, opt})
}

export async function getFileHandle({sig, dir, name, opt}) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  try {
    return await u.wait(sig, dir.getFileHandle(name, opt))
  }
  catch (err) {
    throw new ErrFs(`unable to get file handle ${a.show(u.paths.join(dir.name, name))}: ${err}`, {cause: err})
  }
}

export async function getDirectoryHandle({sig, dir, name, opt}) {
  u.reqSig(sig)
  a.reqValidStr(name)
  a.reqInst(dir, FileSystemHandle)

  if (!a.isInst(dir, FileSystemDirectoryHandle)) {
    throw new ErrFs(`unable to get directory handle ${a.show(u.paths.join(dir.name, name))} because ${a.show(dir.name)} is not a directory`)
  }
  try {
    return await u.wait(sig, dir.getDirectoryHandle(name, opt))
  }
  catch (err) {
    throw new ErrFs(`unable to get directory handle ${a.show(u.paths.join(dir.name, name))}: ${err}`, {cause: err})
  }
}

export function reqFsFilePick() {return reqFs(globalThis.showOpenFilePicker)}
export function reqFsDirPick() {return reqFs(globalThis.showDirectoryPicker)}
export function reqFsSaveFilePick() {return reqFs(globalThis.showSaveFilePicker)}

export function reqFs(fun) {
  if (a.optFun(fun)) return fun
  throw errFsApi()
}

export function errFsApi() {
  return new ui.ErrLog(
    `this action requires the `,
    E(`a`, {
      href: `https://developer.mozilla.org/en-US/docs/Web/API/File_System_API`,
      class: ui.CLS_BTN_INLINE,
      ...ui.TARBLAN,
      chi: [`File System API `, ui.External()],
    }),
    `, which seems to be missing in the current browser; at the time of writing, it's supported in Chromium-based browsers, such as Chrome, Edge, Opera, Arc, and more, and in very recent versions of other browsers, but `,
    ui.Bold(`not`),
    ` in Firefox; please consider updating your browser or using a recent Chromium-based browser`,
  )
}

export function errHandleKind(val) {
  return `unrecognized handle kind ${a.show(val)}`
}

export function formatSize(bytes) {
  if (bytes < 1024) {
    return [bytes, ` `, ui.Muted(`bytes`)]
  }
  if (bytes < 1024 * 1024) {
    return [ui.formatNumCompact(bytes / 1024), ` `, ui.Muted(`KiB`)]
  }
  return [ui.formatNumCompact(bytes / (1024 * 1024)), ` `, ui.Muted(`MiB`)]
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
    ui.LOG.verb(`updated run history from schema version ${verPrev} to ${verNext}, summary: `, out)
  }
  catch (err) {
    ui.LOG.err(`unable to update run history schema: `, err)
  }
}
