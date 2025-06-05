import * as a from '@mitranim/js/all.mjs'
import * as ob from '@mitranim/js/obs.mjs'
import * as s from '../shared/schema.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as i from './idb.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'

import * as self from './fs.mjs'
const tar = globalThis.tabularius ??= a.Emp()
tar.fs = self
a.patch(globalThis, tar)

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
    return ob.obs(this)
  }

  clear() {
    this.handle = undefined
    this.perm = undefined
  }
}

export const SAVE_DIR_NAME = `SaveFolder`
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
    `  C:\\Users\\<user>\\AppData\\LocalLow\\Parallel45\\tower-dominion\\${SAVE_DIR_NAME}\\${PROG_FILE_NAME}`,
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

export function SaveDirPath() {
  return ui.Bold(
    `C:\\Users\\`, ui.Muted(`<user>`),
    `\\AppData\\LocalLow\\Parallel45\\tower-dominion\\SaveFolder`,
  )
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
    [`  `, SaveDirPath()],
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
  return !!await fileConfLoadedWithPermIdemp(sig, PROGRESS_FILE_CONF)
}

export async function loadedSaveDir(sig) {
  return !!await fileConfLoadedWithPermIdemp(sig, SAVE_DIR_CONF)
}

export async function loadedHistoryDir(sig) {
  return !!await fileConfLoadedWithPermIdemp(sig, HISTORY_DIR_CONF)
}

export async function fileConfLoadedWithPermIdemp(sig, conf, req) {
  a.optBool(req)
  return (
    (await fileConfWithPermission(sig, conf)) ||
    (await fileConfLoadedWithPerm(sig, conf, req))
  )
}

/*
Try to load a handle and check its permission.
SYNC[file_conf_status].
*/
export async function fileConfLoadedWithPerm(sig, conf, req) {
  u.reqSig(sig)
  a.optBool(req)

  const {mode} = a.reqInst(conf, FileConf)
  await fileConfLoad(conf)

  if (!conf.handle) {
    if (req) throw new ui.ErrLog(...msgNotInited(conf))
    return undefined
  }

  conf.perm = await queryPermission(sig, conf.handle, {mode})
  if (conf.perm === `granted`) return conf.handle

  const err = new ui.ErrLog(...msgNotGranted(conf))
  if (req) throw err
  ui.LOG.err(err)
  return undefined
}

export async function fileConfLoadIdemp(sig, conf) {
  u.reqSig(sig)
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
  return await fileConfInitedIdemp(sig, conf)
}

export async function initedSaveDir(sig) {
  const conf = SAVE_DIR_CONF
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
    ui.LOG.info(help())
    conf.handle = a.reqInst(await u.wait(sig, pick()), FileSystemHandle)
  }

  if (validate) {
    try {await validate(sig, conf.handle)}
    catch (err) {
      conf.clear()
      throw err
    }
  }

  await fileConfRequireOrRequestPermission(sig, conf)

  try {
    await u.wait(sig, i.dbPut(i.IDB_STORE_HANDLES, key, conf.handle))
    ui.LOG.info(desc, `: stored handle to DB`)
  }
  catch (err) {
    ui.LOG.err(desc, `: error storing handle to DB:`, err)
  }
  return conf.handle
}

export async function validateSaveDir(sig, handle) {
  a.reqInst(handle, FileSystemDirectoryHandle)
  const cmd = SAVE_DIR_CONF.cmd

  if (await dirHasProgressFile(sig, handle)) {
    if (handle.name !== SAVE_BACKUP_DIR_NAME) return

    throw new ui.ErrLog(...ui.LogParagraphs(
      `${a.show(handle.name)} appears to be the game's backup directory; please pick the actual save directory (one level higher)`,
      msgRerun(cmd),
      SaveDirLocation(),
    ))
  }

  const subDir = await getDirectoryHandle(sig, handle, SAVE_DIR_NAME).catch(a.nop)
  if (subDir && await dirHasProgressFile(sig, subDir)) {
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

export async function validateHistoryDir(sig, handle) {
  a.reqInst(handle, FileSystemDirectoryHandle)
  const cmd = HISTORY_DIR_CONF.cmd

  const subDir = await getDirectoryHandle(sig, handle, SAVE_DIR_NAME).catch(a.nop)
  if (subDir && await dirHasProgressFile(sig, subDir)) {
    throw new ui.ErrLog(...ui.LogParagraphs(
      `${a.show(handle.name)} appears to be the game's data directory; your run history directory must be located outside of game directories`,
      msgRerun(cmd),
      HistDirSuggestedLocation(),
    ))
  }

  if (!await dirHasProgressFile(sig, handle)) return

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

export async function dirHasProgressFile(sig, dir) {
  a.reqInst(dir, FileSystemDirectoryHandle)
  return !!await getFileHandle(sig, dir, PROG_FILE_NAME).catch(a.nop)
}

export async function fileConfDeinit(sig, conf) {
  u.reqSig(sig)
  const {key, desc} = a.reqInst(conf, FileConf)

  try {
    await u.wait(sig, i.dbDel(i.IDB_STORE_HANDLES, key))
  }
  catch (err) {
    ui.LOG.err(desc, `: error deleting from DB:`, err)
  }

  if (!conf.handle) return `${desc}: access not granted`
  conf.clear()
  return `${desc}: access revoked`
}

export class FileConfStatus extends ui.ReacElem {
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
  if (!handle) throw new ui.ErrLog(...msgNotInited(conf))

  conf.perm = await queryPermission(sig, handle, {mode})
  if (conf.perm === `granted`) return handle

  ui.LOG.info(desc, `: permission: `, a.show(conf.perm), `, requesting permission`)
  conf.perm = await requestPermission(sig, handle, {mode})
  if (conf.perm === `granted`) return handle

  throw new ui.ErrLog(...msgNotGranted(conf))
}

function msgNotInited(conf) {
  const {desc, cmd} = a.reqInst(conf, FileConf)
  return [desc, `: access not granted, run `, os.BtnCmdWithHelp(cmd), ` to grant access`]
}

function msgNotGranted(conf) {
  const {desc, cmd} = a.reqInst(conf, FileConf)
  return [desc, `: permission needed, run `, os.BtnCmdWithHelp(cmd), ` to grant`]
}

export async function fileConfRequirePermission(sig, conf) {
  const msg = await fileConfStatusProblem(sig, conf)
  if (msg) throw new ui.ErrLog(...msg)
  return conf.handle
}

export function fileHandleStatStr(sig, handle) {
  a.reqInst(handle, FileSystemHandle)
  if (isDir(handle)) return dirStatStr(sig, handle)
  if (isFile(handle)) return fileStatStr(sig, handle)
  ui.LOG.err(errHandleKind(handle.kind))
  return undefined
}

export async function fileStatStr(sig, handle) {
  return formatSize(await fileSize(sig, handle))
}

export async function fileSize(sig, handle) {
  return (await getFile(sig, handle)).size
}

export async function dirStatStr(sig, handle) {
  const {fileCount, dirCount, byteCount} = await dirStat(sig, handle)
  return a.joinOpt([
    fileCount ? `${fileCount} files` : ``,
    dirCount ? `${dirCount} dirs` : ``,
    byteCount ? `${formatSize(byteCount)}` : ``,
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
  const file = await fileConfWithPermission(sig, PROGRESS_FILE_CONF).catch(ui.logErr)
  if (file) return file

  const dir = await saveDirOpt(sig).catch(ui.logErr)
  if (!dir) return undefined

  return getFileHandle(sig, dir, PROG_FILE_NAME).catch(ui.logErr)
}

export async function progressFileReq(sig) {
  const file = await fileConfWithPermission(sig, PROGRESS_FILE_CONF).catch(ui.logErr)
  if (file) return file
  const dir = await saveDirReq(sig)
  return getFileHandle(sig, dir, PROG_FILE_NAME)
}

export function saveDirOpt(sig) {
  return fileConfWithPermission(sig, SAVE_DIR_CONF)
}

export function saveDirReq(sig) {
  return fileConfLoadedWithPermIdemp(sig, SAVE_DIR_CONF, true)
}

export function historyDirOpt(sig) {
  return fileConfWithPermission(sig, HISTORY_DIR_CONF)
}

export function historyDirReq(sig) {
  return fileConfLoadedWithPermIdemp(sig, HISTORY_DIR_CONF, true)
}

export async function listDirsFiles({sig, path, stat}) {
  a.optStr(path)
  a.optBool(stat)

  path = u.paths.cleanTop(a.laxStr(path))

  if (!path) {
    return ui.LogLines(
      [`top-level FS entries`, a.vac(!stat) && [` `, ...StatTip(path)], `:`],
      ...u.alignCol(
        await Promise.all(a.map(CONFS, val => (
          FileConfLine(sig, val, stat)
        ))),
      ),
    )
  }

  const {handle} = await handleAtPathFromTop({sig, path})
  const {kind, name} = handle

  if (isFile(handle)) {
    return LsEntry({
      kind, name, path, stat,
      statStr: a.vac(stat) && await fileStatStr(sig, handle),
    })
  }

  return LsEntry({
    kind, name, path, stat,
    entries: await dirEntries(sig, handle, stat),
  })
}

export async function FileConfLine(sig, conf, stat) {
  u.reqSig(sig)
  a.optBool(stat)
  const {desc, handle, deprecated} = a.reqInst(conf, FileConf)

  if (handle) {
    const cmd = a.spaced(`ls`, (stat ? `-s` : ``))
    const statStr = a.vac(stat) && await fileHandleStatStr(sig, handle)
    return EntryLine({entry: handle, desc, cmd, statStr})
  }

  if (deprecated) return undefined
  return [desc + `: `, `access not granted, run `, os.BtnCmdWithHelp(conf.cmd)]
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

export function LsEntry({kind, name, path, entries, stat, statStr, cloud}) {
  a.reqStr(kind)
  a.reqStr(name)
  a.reqStr(path)
  a.optBool(stat)
  a.optStr(statStr)
  a.optBool(cloud)
  entries = a.laxArr(entries)

  const locPre = cloud ? `cloud ` : `local `
  const inf = `: `
  const statSuf = a.vac(!stat && !cloud) && [` `, ...StatTip(path)]

  if (kind === `file`) {
    const base = locPre + kind + inf + path
    if (statStr) return base + inf + statStr
    return [base, statSuf]
  }

  if (!entries.length) return locPre + `directory ${a.show(path)} is empty`

  const cmd = a.spaced(`ls`, (cloud ? `-c` : stat ? `-s` : ``))
  const buf = []

  for (const entry of a.values(entries)) {
    const {kind, statStr} = entry
    buf.push(EntryLine({entry, desc: kind, cmd, path, statStr}))
  }

  return ui.LogLines(
    [`contents of `, locPre, `directory ${a.show(path)}`, statSuf, `:`],
    ...u.alignCol(buf),
  )
}

export function EntryLine({entry, desc, cmd, path, statStr}) {
  a.reqObj(entry)
  a.optStr(desc)
  a.optStr(cmd)
  a.optStr(statStr)

  const name = a.reqValidStr(entry.name)
  path = u.paths.join(a.laxStr(path), name)

  return a.compact([
    a.vac(desc) && desc + `: `,
    a.compact([
      (
        isDir(entry) && cmd
        ? os.BtnCmd(a.spaced(cmd, path), name)
        : name
      ),
      ` `,
      ui.BtnClip(path),
      a.vac(statStr) && ` (${statStr})`,
    ]),
  ])
}

export function StatTip(path) {
  const cmd = `ls -s`
  return [`(tip: `, os.BtnCmd(a.spaced(cmd, path), cmd), ` adds stats)`]
}

cmdShow.cmd = `show`
cmdShow.desc = `decode and show game files / runs / rounds, with flexible output options`
cmdShow.help = function cmdShowHelp() {
  const saveDir = a.laxStr(SAVE_DIR_CONF.handle?.name)
  const histDir = a.laxStr(HISTORY_DIR_CONF.handle?.name)

  return ui.LogParagraphs(
    u.callOpt(cmdShow.desc),

    ui.LogLines(
      `usage:`,
      [
        `  `,
        ui.BtnPrompt({full: true, cmd: `show`, eph: `<flags> <path>`}),
        `            -- one dir or file`,
      ],
      [
        `  `,
        ui.BtnPrompt({full: true, cmd: `show`, eph: `<flags> <path> ... <path>`}),
        ` -- any dirs or files`,
      ],
    ),

    ui.LogLines(
      `flags:`,
      [`  `, ui.BtnPrompt({cmd: `show`, suf: `-c`}), ` -- copy decoded JSON to clipboard`],
      [`  `, ui.BtnPrompt({cmd: `show`, suf: `-l`}), ` -- log decoded data to browser console`],
      [`  `, ui.BtnPrompt({cmd: `show`, suf: `-w`}), ` -- write JSON file to "`, (histDir || `<run_history>`), `/show/"`],
    ),

    ui.LogLines(
      `path segments can be magic:`,
      [`  `, ui.BtnPrompt({cmd: `show`, eph: u.paths.join(histDir, `<num>`)}), `         -- run num`],
      [`  `, ui.BtnPrompt({cmd: `show`, suf: u.paths.join(histDir, `latest`)}), `        -- latest run`],
      [`  `, ui.BtnPrompt({cmd: `show`, suf: u.paths.join(histDir, `latest/`), eph: `<num>`}), `  -- round num in latest run`],
      [`  `, ui.BtnPrompt({cmd: `show`, suf: u.paths.join(histDir, `latest/latest`)}), ` -- latest round`],
    ),

    (
      !saveDir
      ? [
        `to decode and show game files, grant access to the original save directory`,
        ` via `, os.BtnCmdWithHelp(SAVE_DIR_CONF.cmd),
      ]
      : ui.LogLines(
        `examples for game files:`,
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l`, saveDir)}), ` -- log all game files`],
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l -c -w`, saveDir)}), ` -- log, clipboard, write decoded content of all game files`],
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l`, u.paths.join(saveDir, `Progress.gd`))}), ` -- log current progress`],
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-w`, u.paths.join(saveDir, `Unlockables.gd`))}), ` -- write decoded unlockables file`],
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
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l`, u.paths.join(histDir, `latest`))}), ` -- log all rounds in latest run`],
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l`, u.paths.join(histDir, `latest/latest`))}), ` -- log latest round in latest run`],
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l -c -w`, u.paths.join(histDir, `latest`))}), ` -- log, clipboard, write all rounds in latest run`],
        [`  `, ui.BtnPrompt({cmd: `show`, suf: a.spaced(`-l -c -w`, u.paths.join(histDir, `latest/latest`))}), ` -- log, clipboard, write latest round in latest run`],
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
    else if (!key) paths.push(val)
    else {
      ui.LOG.err(`unrecognized input `, a.show(pair), ` in `, ui.BtnPromptReplace({val: args}))
      return os.cmdHelpDetailed(cmdShow)
    }
  }

  if (!paths.length) {
    ui.LOG.err(`missing input paths in `, ui.BtnPromptReplace({val: args}))
    return os.cmdHelpDetailed(cmdShow)
  }

  if (!(opt.copy || opt.log || opt.write)) {
    return `no action flags provided, nothing done`
  }

  for (const path of paths) {
    try {
      await showPath({sig, path, opt})
    }
    catch (err) {
      ui.LOG.err(`[show] unable to show ${a.show(path)}: `, err)
    }
  }

  return undefined
}

export async function showPath({sig, path, opt}) {
  u.reqSig(sig)
  const {handle, path: resolved} = await handleAtPathFromTop({
    sig, path, magic: true,
  })
  return showDirOrFile({sig, handle, path: resolved, opt})
}

export function showDirOrFile({sig, handle, path, opt}) {
  a.reqInst(handle, FileSystemHandle)
  if (isDir(handle)) {
    return showDir({sig, handle, path, opt})
  }
  if (isFile(handle)) {
    return showFile({sig, handle, path, opt})
  }
  throw errHandleKind(handle.kind)
}

export async function showDir({sig, handle, path, opt}) {
  const data = await collectGameFilesAsc(sig, handle)
  if (!data.length) {
    ui.LOG.info(`no game files found in ${a.show(path)}`)
    return
  }
  await showData({sig, path, data, opt})
}

export async function showFile({sig, handle, path, opt}) {
  if (!isHandleGameFile(handle)) {
    ui.LOG.info(`unable to show file ${a.show(path || handle.name)}: unknown format`)
    return
  }
  const data = await readDecodeGameFile(sig, handle)
  await showData({sig, path, data, opt})
}

export async function showData({sig, path, data, opt}) {
  u.reqSig(sig)
  a.reqValidStr(path)
  a.optObj(opt)

  const copy = a.optBool(opt?.copy)
  const log = a.optBool(opt?.log)
  const write = a.optBool(opt?.write)
  let json

  if (copy) {
    json ??= JSON.stringify(data, undefined, 2)
    await u.copyToClipboard(json)
    ui.LOG.info(`copied decoded content of ${a.show(path)} to clipboard`)
  }

  if (log) {
    console.log(`[show] decoded content of ${a.show(path)}:`)
    console.log(data)
    ui.LOG.info(`logged decoded content of ${a.show(path)} to browser devtools console`)
  }

  if (write) {
    json ??= JSON.stringify(data, undefined, 2)

    const hist = await historyDirReq(sig)
    const outDirName = SHOW_DIR_NAME
    const outDir = await getDirectoryHandle(sig, hist, outDirName, {create: true})

    let outName = u.paths.name(path)
    if (!outName.endsWith(`.json`)) outName += `.json`
    await writeDirFile(sig, outDir, outName, json)

    const outPath = u.paths.join(hist.name, outDirName, outName)
    ui.LOG.info(`wrote decoded content of ${a.show(path)} to ${a.show(outPath)}`)
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
  const runDir = await findLatestRunDir(sig, histDir)
  const roundFile = await findLatestRoundFile(sig, runDir)
  const targetFile = await progressFileReq(sig)
  await requireOrRequestReadwrite(sig, targetFile)
  const body = await readFileByteArr(sig, roundFile)

  const srcPath = u.paths.join(histDir.name, runDir.name, roundFile.name)

  const tarPath = u.paths.join(
    a.laxStr(SAVE_DIR_CONF.handle?.name),
    targetFile.name,
  )

  const backPath = u.paths.join(
    histDir.name,
    await backupFile({sig, file: targetFile, dir: histDir, uniq: true}),
  )
  ui.LOG.info(...msgBackedUp(tarPath, backPath))
  await writeFile(sig, targetFile, body)

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

export async function getBackupDir(sig, dir) {
  a.optInst(dir, FileSystemDirectoryHandle)
  dir ??= await historyDirReq(sig)
  return getDirectoryHandle(sig, dir, BACKUP_DIR_NAME, {create: true})
}

export async function backupFile({sig, file, dir, uniq}) {
  const sub = await getBackupDir(sig, dir)
  const body = await readFileByteArr(sig, file)
  const name = (
    a.optBool(uniq)
    ? u.paths.withNameSuffix(file.name, `_` + Date.now())
    : file.name
  )
  await writeDirFile(sig, sub, name, body)
  return u.paths.join(dir.name, sub.name, name)
}

export function msgBackedUp(src, out) {
  a.reqValidStr(src)
  a.reqValidStr(out)
  return [`backed up `, a.show(src), ` to `, a.show(out)]
}

export async function findLatestDirEntryReq(sig, dir, fun) {
  const out = await findLatestDirEntryOpt(sig, dir, fun)
  if (out) return out
  throw new ErrFs(`unable to find latest entry in ${a.show(dir.name)}`)
}

export async function findLatestDirEntryOpt(sig, dir, fun) {
  let max = -Infinity
  let out
  for await (const han of readDir(sig, dir, fun)) {
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
  for await (const runDir of readDir(sig, histDir, isHandleRunDir)) {
    for await (const _ of readDir(sig, runDir, isHandleRoundFile)) {
      return true
    }
  }
  return false
}

export function findLatestRoundFile(sig, runDir) {
  return findLatestDirEntryOpt(sig, runDir, isHandleGameFile)
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

// Caution: the iteration order is unstable.
export function readRuns(sig, hist) {
  return readDir(sig, hist, isHandleRunDir)
}

export async function readRunsAsc(sig, hist) {
  return (await readDirAsc(sig, hist)).filter(isHandleRunDir)
}

export async function readRunsByNamesAscOpt(sig, hist, names) {
  u.reqSig(sig)
  a.reqInst(hist, FileSystemDirectoryHandle)
  const out = []

  for (const name of a.values(names)) {
    let dir
    try {
      dir = await getDirectoryHandle(sig, hist, name)
    }
    catch (err) {
      if (err?.cause?.name === `NotFoundError`) continue
      throw err
    }
    out.push(dir)
  }
  return out
}

// TODO add file names.
export async function collectGameFilesAsc(sig, dir) {
  const iter = readDir(sig, dir, isHandleGameFile)
  const handles = await u.asyncIterCollect(sig, iter)
  handles.sort(u.compareHandlesAsc)
  return Promise.all(a.map(handles, a.bind(readDecodeGameFile, sig)))
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

export async function findLatestRunDir(sig, hist) {
  a.reqInst(hist, FileSystemDirectoryHandle)
  return a.head((await readDirDesc(sig, hist)).filter(isHandleRunDir))
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
  return {parent, handle, path: u.paths.join(head, resolved)}
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
      ? getSubHandleMagic(sig, handle, name)
      : getSubHandle(sig, handle, name)
    )
    seg.push(handle.name)
  }
  return {parent, handle, path: u.paths.join(...seg)}
}

export function fileConfWithPermission(sig, conf) {
  const {handle, mode} = a.reqInst(conf, FileConf)
  return withPermission(sig, handle, {mode})
}

export async function withPermission(sig, handle, opt) {
  const perm = await queryPermission(sig, handle, opt)
  if (perm === `granted`) return handle
  return undefined
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

export async function copyFileTo(sig, file, dir) {
  const body = await readFileByteArr(sig, file)
  await writeDirFile(sig, dir, file.name, body)
}

export async function copyFileBetween(sig, srcDir, outDir, name) {
  const file = await getFileHandle(sig, srcDir, name)
  return copyFileTo(sig, file, outDir)
}

export async function writeDirFile(sig, dir, name, body) {
  const file = await getFileHandle(sig, dir, name, {create: true})
  await writeFile(sig, file, body, u.paths.join(dir.name, name))
  return file
}

export async function writeFile(sig, file, body, path) {
  u.reqSig(sig)
  a.reqInst(file, FileSystemFileHandle)
  a.optStr(path)

  if (!a.isStr(body) && !a.isInst(body, Uint8Array)) {
    throw TypeError(`unable to write to ${a.show(file.name)}: body must be a string or a Uint8Array, got ${a.show(body)}`)
  }

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
export async function* readDir(sig, src, fun) {
  a.optInst(src, FileSystemDirectoryHandle)
  a.optFun(fun)
  if (!src) return

  for await (const val of src.values()) {
    if (sig.aborted) break
    if (fun && !fun(val)) continue
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
  const mode = a.laxStr(a.optObj(opt)?.mode)

  try {
    return await u.wait(sig, handle.requestPermission(opt))
  }
  catch (err) {
    throw new ErrFsPerm(`unable to get${mode && ` `}${mode} permission for ${handle.name}: ${err}`, {cause: err})
  }
}

export async function requireOrRequestReadwrite(sig, handle) {
  const mode = `readwrite`
  const perm0 = await queryPermission(sig, handle, {mode})
  if (perm0 === `granted`) return handle

  ui.LOG.info(`requesting `, mode, ` permission for `, a.show(handle.name))

  const perm1 = await requestPermission(sig, handle, {mode})
  if (perm1 !== `granted`) {
    throw new ErrFsPerm(`needed ${mode} permission "granted", got permission ${a.show(perm1 || perm0)}`)
  }
  return handle
}

/*
Also see `getFileHandle` which is more specialized.
This one can be invoked on directory entries.
*/
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

/*
Rules:

- The magic name `latest` refers to the last directory or file, where sorting is
  done by integer prefix before falling back on string sort; see `compareDesc`.

- Any path segment which looks like an integer, optionally zero-padded, can
  match any directory or file with a matching integer prefix in its name.
*/
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

export async function getSubHandle(sig, dir, name, opt) {
  u.reqSig(sig)
  a.reqInst(dir, FileSystemDirectoryHandle)
  a.reqValidStr(name)

  try {return await getFileHandle(sig, dir, name, opt)}
  catch (err) {
    if (err?.cause?.name !== `TypeMismatchError`) throw err
  }
  return await getDirectoryHandle(sig, dir, name, opt)
}

export async function getFileHandle(sig, dir, name, opt) {
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

export async function getDirectoryHandle(sig, dir, name, opt) {
  u.reqSig(sig)
  a.reqValidStr(name)

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

export function reqFsFilePick() {
  const fun = globalThis.showOpenFilePicker
  if (a.isFun(fun)) return fun
  throw errFsApi()
}

export function reqFsDirPick() {
  const fun = globalThis.showDirectoryPicker
  if (a.isFun(fun)) return fun
  throw errFsApi()
}

export function errFsApi() {
  return Error(`the current environment seems to be lacking the File System API; at the time of writing, it's supported in Chromium-based browsers, such as Chrome, Edge, Opera, Arc, and more, and in very recent versions of other browsers; please consider updating your browser or using a recent Chromium-based browser`)
}

export function errHandleKind(val) {
  return `unrecognized handle kind ${a.show(val)}`
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
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
