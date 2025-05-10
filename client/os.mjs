import * as a from '@mitranim/js/all.mjs'
import * as o from '@mitranim/js/obs.mjs'
import {E} from './util.mjs'
import * as u from './util.mjs'

import * as self from './os.mjs'
const tar = window.tabularius ??= a.Emp()
tar.os = self
a.patch(window, tar)

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
    a.reqObj(src)
    super()
    this.id = String(++new.target.id)  // Process id (pid). Must be unique.
    this.args = a.reqStr(src.args)     // CLI command name and args.
    this.user = a.laxBool(src.user)    // Was this invoked directly by user.
    this.desc = src.desc               // Optional description.
    this.control = u.abortController() // For cancelation.
    this.promise = undefined           // Assigned after starting.
    this.startAt = Date.now()          // Shown in the UI.
    this.endAt = undefined             // Assigned by `runProc`.
    this.val = undefined               // Eventual promise value, if any.
    this.err = undefined               // Eventual promise error, if any.
    return o.obs(this)                 // For reactive UI updates.
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
export const PROCS = o.obs(a.Emp())

// Suboptimal but doesn't matter.
export function procByName(name) {
  a.reqStr(name)
  return a.find(PROCS, val => u.firstCliArg(val.args) === name)
}

export async function runCmd(args, opt) {
  args = a.trim(args)
  const name = u.firstCliArg(args)
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
  a.optObj(obs)
  a.optPromise(waitFor)

  /*
  We're not adding this to `PROCS` yet. If the function is done synchronously,
  the process is immediately done. If the function is asynchronous and returns
  a promise, then we'll register the proc.
  */
  const proc = new Proc({args, desc, user})
  const name = u.firstCliArg(args)

  let out
  try {out = fun(proc)}
  catch (err) {
    logCmdFail(name, err)
    return
  }

  // Unfortunate cyclic dependency. TODO revise.
  const ui = await import(`./ui.mjs`)

  if (!a.isPromise(out)) {
    if (waitFor) await waitFor.catch(u.logErr)
    logCmdDone(name, out, ui)
    return
  }

  proc.promise = out
  PROCS[proc.id] = proc
  try {
    if (obs) obs.proc = proc
    out = await out
    proc.val = out
    if (waitFor) await waitFor.catch(u.logErr)
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
      if (obs) delete obs.proc
    }
  }
}

export class Combo extends a.Emp {
  constructor(src) {
    super()
    a.optObj(src)
    this.logMsgs = a.optArr(src?.logMsgs)
    this.mediaItems = a.optArr(src?.mediaItems)
  }
}

export function logCmdDone(name, out, ui) {
  a.reqValidStr(name)

  if (!a.vac(out)) {
    u.log.verb(`[${name}] done`)
    return
  }

  if (!a.isInst(out, Combo)) {
    u.log.info(out)
    return
  }

  const {logMsgs, mediaItems} = out
  for (const val of a.laxArr(logMsgs)) u.log.info(val)
  for (const val of a.laxArr(mediaItems)) ui.MEDIA.add(val)
}

export function logCmdFail(name, err) {
  a.reqValidStr(name)
  u.log.err(`[${name}] `, err)
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
  if (!a.len(PROCS)) return `no active processes`
  return u.LogLines(
    `active processes (pid, name, status):`,
    ...a.map(PROCS, procToStatus).map(u.indentNode),
  )
}

// Also see `Kill`.
export class Procs extends u.ReacElem {
  run() {
    PROCS[``] // Subscribe to updates.
    E(this, {}, showProcs())
  }
}

cmdKill.cmd = `kill`
cmdKill.desc = `kill a process`
cmdKill.help = function cmdKillHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdKill.desc),
    u.LogLines(
      `usage:`,
      [`  `, BtnCmd(`kill -a`), `           -- kill all processes`],
      `  kill <id>          -- kill by id`,
      `  kill <name>        -- kill by name`,
      `  kill <id> <id> ... -- kill multiple`,
    ),
    new Kill(),
  )
}

export function cmdKill({args}) {
  args = a.tail(u.splitCliArgs(args))
  const all = u.arrRemoved(args, `-a`)

  if (all) {
    if (args.length) {
      return u.LogParagraphs(`too many inputs`, os.cmdHelpDetailed(cmdKill))
    }
    return procKillAll()
  }

  if (!args.length) {
    return u.LogParagraphs(
      `missing process id or name`,
      os.cmdHelpDetailed(cmdKill),
    )
  }

  const msgs = a.mapCompact(args, procKill)
  const killed = args.length - msgs.length

  return a.joinOptLax([
    u.LOG_VERBOSE && killed ? `sent kill signal to ${killed} processes` : ``,
    ...msgs,
  ], `; `)
}

export function procKill(key) {
  a.reqStr(key)
  const proc = PROCS[key] || procByName(key)
  if (!proc) return `no process with id or name ${a.show(key)}`
  proc.deinit()
  return undefined
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
    if (key === pat || u.firstCliArg(val.args) === pat) val.deinit()
  }
}

// Also see `Procs`.
export class Kill extends u.ReacElem {
  run() {
    PROCS[``] // Subscribe to updates.
    const active = a.map(PROCS, lineKillProc)
    E(this, {}, u.LogLines(
      active.length ? `active processes:` : `no active processes`,
      ...active,
    ))
  }
}

function lineKillProc(val) {
  return [`  `, BtnCmd(`kill ${val.id}`), `: `, val.args]
}

cmdHelp.cmd = `help`
cmdHelp.desc = `brief summary of all commands, or detailed help on one command`

export function cmdHelp({args}) {
  args = u.splitCliArgs(args)

  if (args.includes(`-h`) || args.includes(`--help`)) {
    return os.cmdHelpDetailed(cmdHelp)
  }

  if (args.length <= 1) {
    return u.LogParagraphs(
      `available commands:`,
      ...a.map(CMDS, cmdHelpShort),
      [
        E(`b`, {}, `pro tip`),
        `: can run commands on startup via URL query parameters; for example, try appending to the URL: `,
        u.BtnUrlAppend(`?run=plot -c -p=dmg user_id=all run_id=latest`),
      ],
    )
  }

  return cmdHelpDetailed(reqCmdByName(args[1]))
}

export function cmdHelpDetailed(val) {
  reqCmd(val)
  return [
    `command `, BtnCmd(val.cmd), `: `,
    u.callOpt(val.help) || u.callOpt(val.desc),
  ]
}

export function cmdHelpShort(val) {
  reqCmd(val)
  return [
    BtnCmdWithHelp(val),
    `: `, u.callOpt(val.desc),
  ]
}

export function BtnCmdWithHelp(cmd) {
  let name
  if (a.isFun(cmd)) {
    name = reqCmd(cmd).cmd
  }
  else {
    name = a.reqValidStr(cmd)
    cmd = CMDS[name]
  }

  if (!a.vac(cmd?.help)) return BtnCmd(name)
  return [BtnCmd(name), BtnHelp(name, {class: `ml-1`})]
}

export function BtnCmd(cmd, alias) {
  a.reqValidStr(cmd)
  a.optStr(alias)

  return E(
    `button`,
    {
      type: `button`,
      class: `px-1 inline whitespace-nowrap bg-neutral-200 dark:bg-neutral-700 rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-300 dark:hover:bg-neutral-600`,
      onclick() {runCmd(cmd).catch(u.logErr)},
    },
    alias || cmd,
  )
}

export function BtnHelp(cmd, {class: cls} = {}) {
  a.reqValidStr(cmd)
  return E(
    `button`,
    {
      type: `button`,
      class: a.spaced(cls, u.CLS_BTN_INLINE),
      onclick() {runCmd(`help ${cmd}`).catch(u.logErr)},
    },
    `?`,
  )
}

export function runCmdMock(dur) {
  a.reqFin(dur)
  return runProc({fun: cmdMock, args: `mock ${dur}`, desc: `mock command that sleeps`})
  function cmdMock({sig}) {return a.after(dur, sig)}
}

// for (const _ of a.span(8)) runCmdMock(a.minToMs(1024))
