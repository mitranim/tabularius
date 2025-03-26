import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as d from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom.mjs'
import * as p from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/prax.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs.mjs'
import * as od from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs_dom.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom_reg.mjs'
import * as u from './util.mjs'

/*
Represents a CLI-style command.
Commands can be sync or async.
Async commands start a "process", see below.
*/
export class Cmd extends a.Emp {
  constructor(src) {
    a.reqObj(src)
    super()
    this.name = a.reqValidStr(src.name) // CLI name, short, lowercase.
    this.desc = a.reqValidStr(src.desc) // Terse description of what it does.
    this.help = a.optStr(src.help)      // Longer, more detailed help (opt-in).
    this.fun  = a.reqFun(src.fun)       // Actual function. Takes `(args, proc)`. Result is logged.
  }
  pk() {return this.name}
}

class Cmds extends a.Coll {
  reqKey(key) {return a.reqValidStr(key)}
  reqVal(val) {return a.reqInst(val, Cmd)}
}

// Centralized registry of CLI-style commands for our terminal.
export const COMMANDS = new Cmds()

// Represents a "process" started by an async command.
export class Proc extends a.Emp {
  constructor(src) {
    a.reqObj(src)
    super()
    this.id = String(++new.target.id)         // Process id (pid). Must be unique.
    this.args = u.reqArrOfValidStr(src.args)  // Command name and CLI args.
    this.startAt = Date.now()
    this.control = u.abortController()        // For cancelation.
    this.promise = undefined                  // Assigned after starting.
    this.status = src.status                  // What it's currently doing.
  }

  pk() {return this.id}
  cmd() {return this.args.join(` `)}
  deinit() {return this.control.abort(new u.ErrAbort(`deinit`))}

  // Incremented for each new instance.
  static id = 0
}

/*
Centralized registry of all currently running processes. Keys must be proc ids,
values must be procs.
*/
export const PROCS = o.obs(a.Emp())

export function hasProcByName(name) {
  return a.some(PROCS, val => val.args[0] === name)
}

export async function runScript(src) {
  src = a.trim(src)
  if (!src) return
  runCmd(...src.split(/\s+/))
}

export async function runCmd(...args) {
  if (!u.isArrOfValidStr(args)) {
    u.log.err(`"runCmd" expects CLI-style arguments, got ${a.show(args)}`)
    return
  }

  const name = args[0]
  if (!name) {
    u.log.err(`missing command name in ${a.show(args)}`)
  }

  const cmd = COMMANDS.get(name)
  if (!cmd) {
    u.log.err(`unknown command: ${name}`)
    return
  }

  /*
  We're not adding this to `PROCS` yet. If the function is done synchronously,
  the process is immediately done. If the function is asynchronous and returns
  a promise, then we'll register the process.
  */
  const proc = new Proc({args, status: cmd.desc})
  const fun = cmd.fun

  let out
  try {out = fun(proc.control.signal, args)}
  catch (err) {
    u.logCmdFail(name, err)
    return
  }

  if (a.isNil(out)) return

  if (!a.isPromise(out)) {
    u.logCmdDone(name, out)
    return
  }

  proc.promise = out
  PROCS[proc.id] = proc
  try {
    out = await out
    u.logCmdDone(name, out)
  }
  catch (err) {
    u.logCmdFail(name, err)
  }
  finally {
    delete PROCS[proc.id]
  }
}

export function cmdPs() {return showProcs()}

export function procToStatus(src) {
  a.reqInst(src, Proc)
  return a.spaced(src.id + `:`, a.show(src.cmd()) + `:`, src.status)
}

export function showProcs() {
  if (!a.len(PROCS)) return `No active processes`
  return a.joinLines([
    `Active processes (pid, name, status):`,
    ...a.map(PROCS, procToStatus),
  ])
}

export function cmdKill(sig, args) {
  u.reqArrOfValidStr(args)
  switch (a.len(args)) {
    case 0:
    case 1:
      return a.joinLines([
        `missing process id or name; usage: kill <id|name>;`,
        `alternatively, "kill -a" to kill all`
      ])
    case 2:
      if (args[1] === `-a`) return procKillAll()
      return procKill(sig, args[1])
    default: return `too many args; usage: kill <id|name>`
  }
}

export async function procKill(sig, key) {
  u.reqSig(sig)
  a.reqStr(key)
  if (!key) return undefined

  const proc = PROCS[key] || a.find(PROCS, val => val.args[0] === key)
  if (!proc) return `no process with id or name ${a.show(key)}`

  try {
    proc.deinit()
    await u.wait(sig, proc.promise)
  }
  finally {
    if (proc.control.signal.aborted) {
      delete PROCS[proc.id]
    }
  }
}

export async function procKillAll() {
  const procs = PROCS
  let len = 0

  for (const key in procs) {
    len++
    procs[key].deinit()
    delete procs[key]
  }
  return len ? `sent kill signal to ${len} processes` : `no processes running`
}
