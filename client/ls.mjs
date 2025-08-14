import * as a from '@mitranim/js/all.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'
import * as au from './auth.mjs'

import * as self from './main.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.ls = self
a.patch(globalThis, namespace)

cmdLs.cmd = `ls`
cmdLs.desc = function cmdLsDesc() {
  return `list local dirs / files, or cloud runs / rounds`
}
cmdLs.help = function cmdLsHelp() {
  return ui.LogParagraphs(
    cmdLs.desc(),
    helpSources(`ls`),

    ui.LogLines(
      `local usage:`,
      [`  `, os.BtnCmd(`ls /`)],
      [`  `, os.BtnCmd(`ls -s`), ` -- additional stats`],
      [`  `, BtnReplaceEph(`<some_dir>`)],
      [`  `, BtnReplaceEph(`<some_dir>/<some_file>`)],
    ),

    ui.LogParagraphs(
      `cloud usage:`,
      ui.LogLines(
        [`  `, os.BtnCmd(`ls -c`), ` -- runs from all users`],
        [`  `, BtnReplace(`-c `, `<user_id>`)],
        [`  `, BtnReplace(`-c `, `<user_id>/<run_id>`)],
        [`  `, BtnReplace(`-c `, `<user_id>/<run_id>/<file>`)],
      ),
      ui.LogLines(
        [`  `, os.BtnCmd(`ls -c -u`), ` -- runs from current user`],
        [`  `, ui.BtnPrompt({
          full: true, cmd: `ls`, suf: `-c -u `, eph: `<run_id>`,
        })],
        [`  `, ui.BtnPrompt({
          full: true, cmd: `ls`, suf: `-c -u `, eph: `<run_id>/<file>`,
        })],
      ),
    ),

    ui.LogLines(
      `tip: filter plots by run numbers from directory names; this works for both local and cloud plots:`,
      [`  `, ui.BtnPrompt({
        full: true,
        cmd: `plot`,
        suf: `user_id=current run_id=all run_num=`,
        eph: `<dir_num>`,
      })],
      [`  `, ui.BtnPrompt({
        full: true,
        cmd: `plot`,
        suf: `user_id=current run_id=all run_num=`,
        eph: `<dir_num> run_num=<dir_num>`,
      })],
    ),
  )
}

export function helpSources(cmd) {
  return ui.LogLines(
    `supported sources:`,
    [
      `  local -- default -- requires `,
      os.BtnCmdWithHelp(`saves`),
      ` or `,
      os.BtnCmdWithHelp(`history`),
    ],
    [
      `  cloud -- `, ui.BtnPrompt({cmd, suf: `-c`}),
      `      -- any user`,
    ],
    [
      `  cloud -- `, ui.BtnPrompt({cmd, suf: `-c -u`}),
      `   -- current user; requires `, os.BtnCmdWithHelp(`auth`),
    ],
  )
}

export function cmdLs({sig, args}) {
  const cmd = cmdLs.cmd
  const pairs = a.tail(u.cliDecode(args))
  if (!pairs.length) return os.cmdHelpDetailed(cmdLs)

  const paths = []
  let cloud
  let stat
  let user

  for (const [key, val, pair] of pairs) {
    if (u.isHelpFlag(key)) return os.cmdHelpDetailed(cmdLs)

    if (key === `-c`) {
      cloud = ui.cliBool(cmd, key, val)
      continue
    }

    if (key === `-s`) {
      stat = ui.cliBool(cmd, key, val)
      continue
    }

    if (key === `-u`) {
      user = ui.cliBool(cmd, key, val)
      continue
    }

    if (key) {
      ui.LOG.err(ui.msgUnrecInput(pair, args))
      return os.cmdHelpDetailed(cmdLs)
    }
    paths.push(val)
  }

  if (paths.length > 1) {
    ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace(args))
    return os.cmdHelpDetailed(cmdLs)
  }
  let path = u.paths.cleanTop(a.laxStr(paths[0]))

  if (cloud) {
    if (stat) {
      ui.LOG.err(
        `ignoring `, ui.BtnPrompt({cmd, suf: `-s`}),
        ` in cloud mode in `, ui.BtnPromptReplace(args),
      )
    }

    if (user) path = u.paths.join(au.reqUserId(), path)
    return au.listDirsFiles(sig, path)
  }

  if (user) {
    ui.LOG.err(
      `ignoring `, ui.BtnPrompt({cmd, suf: `-u`}),
      ` in local mode in `, ui.BtnPromptReplace(args),
    )
  }

  return fs.listDirsFiles({sig, path, stat})
}

function BtnReplace(suf, eph) {
  return ui.BtnPrompt({cmd: cmdLs.cmd, suf, eph, full: true})
}

function BtnReplaceEph(eph) {return BtnReplace(undefined, eph)}

export function LsEntry({kind, name, path, entries, stat, stats, cloud}) {
  a.reqStr(kind)
  a.reqStr(name)
  a.reqStr(path)
  a.optBool(stat)
  a.optBool(cloud)
  entries = a.laxArr(entries)

  const locPre = cloud ? `cloud ` : `local `
  const inf = `: `
  const statSuf = a.vac(!stat && !cloud) && [` `, ...fs.StatTip(path)]

  if (kind === `file`) {
    const base = locPre + kind + inf + path
    if (a.vac(stats)) return [base, Stat(stats)]
    return [base, statSuf]
  }

  if (!entries.length) return locPre + `directory ${a.show(path)} is empty`

  const cmd = a.spaced(`ls`, (cloud ? `-c` : stat ? `-s` : ``))
  const buf = []

  for (const entry of a.values(entries)) {
    const {kind, stats} = entry
    buf.push(EntryLine({entry, desc: kind, cmd, path, stats}))
  }

  return ui.LogLines(
    [`contents of `, locPre, `directory ${a.show(path || name)}`, statSuf, `:`],
    ...a.map(u.alignCol(buf), TruncLine),
  )
}

export function EntryLine({entry, desc, cmd, path, stats}) {
  a.reqRec(entry)
  a.optStr(desc)
  a.optStr(cmd)

  const name = a.reqValidStr(entry.name)
  path = u.paths.join(a.laxStr(path), name)

  return a.compact([
    a.vac(desc) && desc + `: `,
    a.compact([
      (
        fs.isDir(entry) && cmd
        ? os.BtnCmd(a.spaced(cmd, path), name)
        : name
      ),
      `\u00a0`, // Regular space is ignored here. Why?
      ui.BtnClip(path),
      Stat(stats),
    ]),
  ])
}

function TruncLine(chi) {
  return E(`span`, {class: `w-full inline-flex trunc-base whitespace-pre`, chi})
}

function Stat(src) {
  return a.vac(src) && [
    `\u00a0`, // Regular space is ignored here. Why?
    ui.Muted(`(`),
    src,
    ui.Muted(`)`),
  ]
}
