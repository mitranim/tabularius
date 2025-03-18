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
    this.id = String(++new.target.id)    // Process id (pid). Must be unique.
    this.args = u.reqArrOfStr(src.args)  // Command name and CLI args.
    this.startAt = Date.now()
    this.control = u.abortController()   // For cancelation.
    this.promise = undefined             // Assigned after starting.
    this.status = src.status             // What it's currently doing.
  }

  pk() {return this.id}
  cmd() {return this.args.join(` `)}
  deinit() {return this.control.abort()}

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

// Mock command history (oldest to newest).
export const CMD_HISTORY = [`init`, `ps`, `help`]

// Position in `CMD_HISTORY`. Must be either nil or an integer.
export const CMD_HISTORY_INDEX = a.Emp()

// Main command entry point.
// Takes the user's CLI input and runs a command.
export async function runCommand(srcText) {
  // Trim and bail if empty
  srcText = srcText.trim()
  if (!srcText) return
  if (srcText !== a.last(CMD_HISTORY)) CMD_HISTORY.push(srcText)
  CMD_HISTORY_INDEX.index = undefined

  // CLI-style cmd name and args.
  const args = srcText.split(/\s+/)
  const name = args[0]
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
    u.logCmdFail(err, srcText)
    return
  }

  if (a.isNil(out)) return

  if (!a.isPromise(out)) {
    if (a.vac(out)) u.log.inf(`[${name}]`, out)
    return
  }

  proc.promise = out
  PROCS[proc.id] = proc
  try {
    out = await out
    if (a.vac(out)) u.log.inf(`[${name}]`, out)
  }
  catch (err) {
    if (a.vac(err)) u.log.err(`[${name}]`, err)
  }
  finally {
    delete PROCS[proc.id]
  }
}
