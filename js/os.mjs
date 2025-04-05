import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/obs.mjs'
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
export function addCmd(val) {
  if (!a.isFun(val)) throw TypeError(`a command must be a function, got ${a.show(val)}`)
  const {cmd, desc} = val
  if (!cmd) throw TypeError(`missing .cmd on ${a.show(val)}`)
  if (!a.isStr(cmd)) throw TypeError(`non-string .cmd ${a.show(cmd)} on ${a.show(val)}`)
  if (!/^[a-z]+$/.test(cmd)) throw TypeError(`a command's .cmd must be a single lowercase word, got ${a.show(cmd)} on ${a.show(val)}`)
  if (!desc) throw TypeError(`missing .desc on ${a.show(val)}`)
  if (CMDS[cmd]) throw Error(`redundant registration of command ${a.show(cmd)} (prev ${a.show(CMDS[cmd])}, next ${a.show(val)})`)
  CMDS[cmd] = val
}

// Represents a "process" started by an async command.
export class Proc extends a.Emp {
  constructor(src) {
    a.reqObj(src)
    super()
    this.id = String(++new.target.id)  // Process id (pid). Must be unique.
    this.args = a.reqStr(src.args)     // CLI command name and args.
    this.desc = src.desc               // Optional description.
    this.control = u.abortController() // For cancelation.
    this.promise = undefined           // Assigned after starting.
    this.startAt = Date.now()          // Shown in the UI.
    this.endAt = undefined             // Assigned by `runProc`.
    this.val = undefined               // Eventual promise value, if any.
    this.err = undefined               // Eventual promise error, if any.
    // return o.obs(this)                // For reactive UI updates.
  }

  pk() {return this.id}
  deinit() {return this.control.abort(new u.ErrAbort(`deinit`))}

  // Cmd funcs should use this to support cancelation.
  get sig() {return this.control.signal}

  // Incremented for each new instance.
  static id = 0
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

export async function runCmd(args) {
  args = a.trim(args)
  const name = u.firstCliArg(args)
  const cmd = CMDS[name]
  if (!cmd) throw Error(`unknown command: ${a.show(name)}`)
  await runProc(cmd, args, cmd.desc)
}

export async function runProc(fun, args, desc) {
  a.reqFun(fun)

  /*
  We're not adding this to `PROCS` yet. If the function is done synchronously,
  the process is immediately done. If the function is asynchronous and returns
  a promise, then we'll register the proc.
  */
  const proc = new Proc({args, desc})
  const name = u.firstCliArg(args)

  let out
  try {out = fun(proc)}
  catch (err) {
    u.logCmdFail(name, err)
    return
  }

  if (!a.isPromise(out)) {
    u.logCmdDone(name, out)
    return
  }

  proc.promise = out
  PROCS[proc.id] = proc
  try {
    out = await out
    proc.val = out
    u.logCmdDone(name, out)
  }
  catch (err) {
    proc.err = err
    u.logCmdFail(name, err)
  }
  finally {
    try {
      proc.endAt = Date.now()
      proc.deinit()
    }
    finally {delete PROCS[proc.id]}
  }
}

cmdPs.cmd = `ps`
cmdPs.desc = `list running processes`

export function cmdPs() {return showProcs()}

export function procToStatus(src) {
  a.reqInst(src, Proc)
  let out = src.id + `: ` + a.show(src.args)
  if (src.desc) out += `: ` + src.desc
  return out
}

export function showProcs() {
  if (!a.len(PROCS)) return `No active processes`
  return u.joinLines(
    `Active processes (pid, name, status):`,
    ...a.map(PROCS, procToStatus),
  )
}

cmdKill.cmd = `kill`
cmdKill.desc = `kill a process`
cmdKill.help = `"kill <id>" or "kill -a"`

export function cmdKill({args}) {
  args = u.splitCliArgs(args)
  switch (args.length) {
    case 0:
    case 1:
      return u.joinLines(
        `missing process id or name; usage: kill <id|name>;`,
        `alternatively, "kill -a" to kill all`
      )
    case 2:
      if (args[1] === `-a`) return procKillAll()
      return procKill(args[1])
    default: return `too many args; usage: kill <id|name>`
  }
}

export function procKill(key) {
  a.reqStr(key)
  const proc = PROCS[key] || procByName(key)
  if (!proc) return `no process with id or name ${a.show(key)}`
  proc.deinit()
}

export function procKillAll() {
  let len = 0
  for (const key in PROCS) {
    len++
    PROCS[key].deinit()
  }
  return len ? `sent kill signal to ${len} processes` : `no processes running`
}
