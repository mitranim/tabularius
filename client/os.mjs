import * as a from '@mitranim/js/all.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as ui from './ui.mjs'

import * as self from './os.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.os = self
a.patch(globalThis, namespace)

/*
Centralized registry of CLI-style commands for our "terminal". Each is
represented with a function, with additional properties describing the
command.

Commands can be sync or async. Async commands start a "process", see below.
*/
export const CMDS = a.Emp()

/*
Each command must have:

  .cmd  -- CLI name, short, lowercase.
  .desc -- Terse description of what it does.
  .help -- Longer, more detailed help (optional).
*/
export function reqCmd(val) {
  if (!a.isFun(val)) throw TypeError(`a command must be a function, got ${a.show(val)}`)
  const {cmd, desc} = val
  if (!cmd) throw TypeError(`missing .cmd on ${a.show(val)}`)
  if (!a.isStr(cmd)) throw TypeError(`non-string .cmd ${a.show(cmd)} on ${a.show(val)}`)
  if (!/^[a-z_]+$/.test(cmd)) throw TypeError(`a command's .cmd must be a single lowercase identifier, optionally with "_" separators, got ${a.show(cmd)} on ${a.show(val)}`)
  if (!desc) throw TypeError(`missing .desc on ${a.show(val)}`)
  return val
}

export function addCmd(val) {
  const {cmd} = reqCmd(val)
  if (CMDS[cmd]) throw Error(`redundant registration of command ${a.show(cmd)} (prev ${a.show(CMDS[cmd])}, next ${a.show(val)})`)
  CMDS[cmd] = val
}

// Represents a "process" started by an async command.
export class Proc extends a.Emp {
  // Incremented for each new instance.
  static id = 0

  constructor(src) {
    a.reqRec(src)
    super()
    this.id = String(++new.target.id)  // Process id (pid). Must be unique.
    this.args = a.reqStr(src.args)     // CLI command name and args.
    this.user = a.laxBool(src.user)    // Was this invoked directly by user.
    this.desc = src.desc               // Optional description.
    this.control = u.abortController() // For cancelation.
    this.promise = undefined           // Assigned after starting.
    this.startAt = Date.now()          // Shown in the UI.
    this.endAt = undefined             // Assigned by `runProc`.
    this.val = undefined               // Eventual return value, if any.
    this.err = undefined               // Eventual exception, if any.
    return a.obs(this)                 // For reactive UI updates.
  }

  // Cmd funs should use this to support cancelation.
  get sig() {return this.control.signal}
  get running() {return a.isNil(this.endAt)}

  deinit() {return this.control.abort(new u.ErrAbort(`deinit`))}
}

/*
Centralized registry of all currently running processes. Keys must be proc ids,
values must be procs.
*/
export const PROCS = a.obs(a.Emp())

// Suboptimal but doesn't matter.
export function procByName(name) {
  a.reqStr(name)
  return a.find(PROCS, val => u.hasPreSpaced(val.args, name))
}

// Suboptimal but doesn't matter.
export function procsByName(name) {
  a.reqStr(name)
  return a.filter(PROCS, val => u.hasPreSpaced(val.args, name))
}

export async function runCmd(args, opt) {
  args = a.trim(args)
  const name = u.cliArgHead(args)
  const cmd = reqCmdByName(name)
  await runProc({fun: cmd, args, desc: u.callOpt(cmd.desc), ...a.optDict(opt)})
}

export function reqCmdByName(name) {
  a.reqValidStr(name)
  const cmd = CMDS[name]
  if (cmd) return cmd
  throw Error(`unknown command ${a.show(name)}`)
}

export async function runProc({fun, args, desc, obs, user, waitFor}) {
  a.reqFun(fun)
  a.reqStr(args)
  a.optRef(obs)
  a.optPromise(waitFor)

  /*
  We're not adding this to `PROCS` yet. If the function is done synchronously,
  the process is immediately done. If the function is asynchronous and returns
  a promise, then we'll register the proc.
  */
  const proc = new Proc({args, desc, user})
  const name = u.cliArgHead(args)

  let out
  try {out = fun(proc)}
  catch (err) {
    logCmdFail(name, err)
    proc.err = err
    return proc
  }

  if (!a.isPromise(out)) {
    proc.val = out
    if (waitFor) await waitFor.catch(ui.logErr)
    logCmdDone(name, out, ui)
    return proc
  }

  proc.promise = out
  PROCS[proc.id] = proc
  try {
    if (obs) a.reset(obs, proc)
    out = await out
    proc.val = out
    if (waitFor) await waitFor.catch(ui.logErr)
    logCmdDone(name, out, ui)
  }
  catch (err) {
    proc.err = err
    logCmdFail(name, err)
  }
  finally {
    try {
      proc.endAt = Date.now()
      proc.deinit()
    }
    finally {
      delete PROCS[proc.id]
      if (obs) a.reset(obs)
    }
  }

  return proc
}

export class Combo extends a.Emp {
  constructor(src) {
    super()
    a.optRec(src)
    this.logMsgs = a.optArr(src?.logMsgs)
    this.mediaItems = a.optArr(src?.mediaItems)
  }
}

export function logCmdDone(name, out, ui) {
  a.reqValidStr(name)

  if (!a.vac(out)) {
    ui.LOG.verb(`[${name}] done`)
    return
  }

  if (!a.isInst(out, Combo)) {
    ui.LOG.info(out)
    return
  }

  const {logMsgs, mediaItems} = out
  for (const val of a.laxArr(logMsgs)) if (a.isSome(val)) ui.LOG.info(val)
  for (const val of a.laxArr(mediaItems)) if (a.isSome(val)) ui.MEDIA.add(val)
}

export function logCmdFail(name, err) {
  a.reqValidStr(name)
  ui.LOG.err(`[${name}] `, err)
}

export function procToStatus(src) {
  a.reqInst(src, Proc)
  return [
    src.id, `: `, src.args,
    a.vac(src.desc) && [`: `, u.callOpt(src.desc)],
    `; `, BtnCmd(`kill ${src.id}`),
  ]
}

export function showProcs() {
  const src = a.map(PROCS, procToStatus)
  if (!src.length) return `no active processes`

  return ui.LogLines(
    `active processes (pid, name, status):`,
    ...a.map(src, u.indentNode),
  )
}

export function showProcsMini() {
  const src = a.map(PROCS, lineKillProc)
  if (!src.length) return `no active processes`
  return ui.LogLines(`active processes:`, ...src)
}

function lineKillProc(val) {
  return [`  `, BtnCmd(`kill ${val.id}`), `: `, val.args]
}

cmdKill.cmd = `kill`
cmdKill.desc = `kill a process`
cmdKill.help = function cmdKillHelp() {
  return ui.LogParagraphs(
    u.callOpt(cmdKill.desc),
    ui.LogLines(
      `usage:`,
      [
        `  `,
        ui.BtnPrompt({full: true, cmd: `kill`, suf: `-a`}),
        `            -- kill all processes`,
      ],
      [`  `, ui.BtnPrompt({full: true, cmd: `kill`, eph: `<id>`}), `          -- kill by id`],
      [`  `, ui.BtnPrompt({full: true, cmd: `kill`, eph: `<name>`}), `        -- kill by name`],
      [`  `, ui.BtnPrompt({full: true, cmd: `kill`, eph: `<id> <id> ...`}), ` -- kill multiple`],
    ),
    showProcsMini,
  )
}

export function cmdKill({args}) {
  const inps = u.cliArgSet(cmdKill.cmd, args)
  if (u.hasHelpFlag(inps)) return cmdHelpDetailed(cmdKill)
  const all = inps.delete(`-a`)

  if (all) {
    if (inps.size) {
      ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace(args))
      return cmdHelpDetailed(cmdKill)
    }
    return procKillAll()
  }

  if (!inps.size) {
    ui.LOG.err(`missing process id or name`)
    return cmdHelpDetailed(cmdKill)
  }

  const {count, msgs} = procKill(...inps)

  return ui.LogLines(
    a.vac(a.deref(u.VERBOSE) && count) && `sent kill signal to ${count} processes`,
    ...msgs,
  )
}

export function procKill(...keys) {
  let count = 0
  const msgs = []

  for (const key of keys) {
    a.reqStr(key)

    if (PROCS[key]) {
      PROCS[key].deinit()
      count++
      continue
    }

    const procs = procsByName(key)
    if (!procs.length) {
      msgs.push(`no process with id or name ${a.show(key)}`)
      continue
    }

    for (const proc of procs) {
      proc.deinit()
      count++
    }
  }
  return {count, msgs}
}

export function procKillAll() {
  let len = 0
  for (const key in PROCS) {
    len++
    PROCS[key].deinit()
  }
  return len ? `sent kill signal to ${len} processes` : `no processes running`
}

export function procKillOpt(pat) {
  a.reqStr(pat)
  for (const [key, val] of a.entries(PROCS)) {
    if (key === pat || u.hasPreSpaced(val.args, pat)) val.deinit()
  }
}

cmdHelp.cmd = `help`
cmdHelp.desc = `brief summary of all commands, or detailed help on one command`

export function cmdHelp({args}) {
  const inps = u.cliArgSet(cmdHelp.cmd, args)
  if (u.hasHelpFlag(inps)) return cmdHelpDetailed(cmdHelp)

  if (inps.size) {
    for (const cmd of inps) ui.LOG.info(cmdHelpDetailed(reqCmdByName(cmd)))
    return undefined
  }

  return ui.LogParagraphs(
    `available commands:`,
    ...a.map(CMDS, cmdHelpShort),

    `tip: command buttons and question marks are clickable!`,

    ui.LogLines(
      `hotkeys and special interactions:`,
      [`  ctrl+k                 -- clear log (same as `, BtnCmd(`clear -l`), `)`],
      [`  shift+ctrl+k           -- clear log and media (same as `, BtnCmd(`clear`), `)`],
      [`  ctrl+click drag handle -- reset UI split`],
      [`  drag and drop file     -- save decoded file`],
      [`  almost any key         -- focus prompt`],
    ),

    `tip: drag any ".gd" game file into this UI to decode it and save the result to a file`,

    [
      `pro tip: run commands on page load via URL query; for example, try appending to the URL: `,
      ui.BtnUrlAppend(`?run=plot -c -p=dmg run_id=latest`),
    ],
  )
}

export function cmdHelpDetailed(val) {
  reqCmd(val)
  return [
    `command `, BtnCmdWithHelp(val.cmd), `: `,
    u.callOpt(val.help) || u.callOpt(val.desc),
  ]
}

export function cmdHelpShort(val) {
  reqCmd(val)
  return [BtnCmdWithHelp(val), `: `, u.callOpt(val.desc)]
}

export function BtnCmdWithHelp(cmd) {
  let name
  let args
  if (a.isFun(cmd)) {
    name = reqCmd(cmd).cmd
    args = name
  }
  else {
    name = a.reqValidStr(u.cliArgHead(cmd))
    args = a.reqValidStr(cmd)
    cmd = CMDS[name]
  }

  if (!a.vac(cmd?.help)) return BtnCmd(name)
  return [BtnCmd(args), BtnHelp(name, {cls: `ml-1`})]
}

export function BtnCmd(cmd, alias) {
  a.reqValidStr(cmd)
  a.optStr(alias)

  return E(`button`, {
    type: `button`,
    /*
    For unclear reasons, `text-decoration: inherit` seems to be required here,
    otherwise we can't inherit `line-through`.
    */
    class: `px-1 trunc whitespace-nowrap [text-decoration:inherit] rounded border border-gray-300 dark:border-neutral-600 bg-neutral-200 dark:bg-stone-700 hover:bg-gray-300 dark:hover:bg-stone-600`,
    onclick() {runCmd(cmd).catch(ui.logErr)},
    chi: alias || cmd,
  })
}

export function BtnHelp(cmd, {cls} = {}) {
  a.reqValidStr(cmd)

  return E(`button`, {
    type: `button`,
    class: a.spaced(cls, ui.CLS_BTN_INLINE),
    onclick() {runCmd(`help ${cmd}`).catch(ui.logErr)},
    chi: `?`,
  })
}

export function runCmdMock(dur) {
  a.reqFin(dur)
  return runProc({fun: cmdMock, args: `mock ${dur}`, desc: `mock command that sleeps`})
  function cmdMock({sig}) {return a.after(dur, sig)}
}

// for (const _ of a.span(8)) runCmdMock(a.minToMs(1024))
