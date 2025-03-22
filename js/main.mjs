import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as p from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/prax.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs.mjs'
import * as od from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs_dom.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom_reg.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as w from './watch.mjs'
import * as d from './dat.mjs'
import * as ui from './ui.mjs'

import * as self from './main.mjs'
window.tabularius ??= a.Emp()
window.tabularius.m = self

/*
All commands should be added here so that we can control the ordering.
`os.COMMANDS` is an ordered map.
*/

os.COMMANDS.add(new os.Cmd({
  name: `help`,
  desc: `show help`,
  fun: cmdHelp,
}))

os.COMMANDS.add(new os.Cmd({
  name: `clear`,
  desc: `clear the log`,
  fun: u.cmdClear,
}))

os.COMMANDS.add(new os.Cmd({
  name: `ps`,
  desc: `list running processes`,
  fun: os.cmdPs,
}))

os.COMMANDS.add(new os.Cmd({
  name: `kill`,
  desc: `kill a process`,
  help: `kill <id>`,
  fun: os.cmdKill,
}))

os.COMMANDS.add(new os.Cmd({
  name: `init`,
  desc: `initialize features requiring user action`,
  fun: cmdInit,
}))

os.COMMANDS.add(new os.Cmd({
  name: `deinit`,
  desc: `stop all processes and deinitialize features`,
  fun: cmdDeinit,
}))

os.COMMANDS.add(new os.Cmd({
  name: `status`,
  desc: `show status of app features and processes`,
  fun: cmdStatus,
}))

os.COMMANDS.add(new os.Cmd({
  name: `watch`,
  desc: `watch the progress file for changes and create backups`,
  fun: w.cmdWatch,
}))

os.COMMANDS.add(new os.Cmd({
  name: `ls`,
  desc: `list dirs and files; usage: "ls" or "ls <path>"`,
  fun: fs.cmdLs,
}))

// os.COMMANDS.add(new os.Cmd({
//   name: `tree`,
//   desc: `print a tree of dirs and files`,
//   fun: fs.cmdTree,
// }))

os.COMMANDS.add(new os.Cmd({
  name: `media`,
  desc: `toggle media panel`,
  fun: ui.cmdMedia
}))

os.COMMANDS.add(new os.Cmd({
  name: `analyze`,
  desc: `analyze data`,
  fun: d.cmdAnalyze,
}))

os.COMMANDS.add(new os.Cmd({
  name: `verbose`,
  desc: `toggle between quiet and verbose mode`,
  fun: u.cmdVerbose,
}))

os.COMMANDS.add(new os.Cmd({
  name: `test`,
  desc: `toggle test mode`,
  fun: cmdTest,
}))

function cmdHelp() {
  return a.joinLines([
    `available commands:`,
    ...a.map(os.COMMANDS, cmdToHelp),
  ])
}

function cmdToHelp(val) {
  a.reqInst(val, os.Cmd)
  return val.name + `: ` + val.desc
}

// Initialize features that require user action.
async function cmdInit(sig) {
  if (!await fs.initedFileHandles(sig)) return `FS access not initialized`
  if (!await w.watchStarted()) return `FS watch not initialized`
  return `all features initialized`
}

// Deinitialize features and stop all processes.
async function cmdDeinit(sig) {
  const killed = await os.procKillAll()
  return a.joinLinesLax([
    killed,
    await fs.deinitFileHandles(sig)
  ].flat())
}

// Show status of features and processes.
async function cmdStatus(sig) {
  return a.joinLinesLax([
    await fs.statusProgressFile(sig),
    await fs.statusHistoryDir(sig),
    os.showProcs(),
  ])
}

const STORAGE_KEY_TEST_MODE = `tabularius_test_mode`
const TEST_MODE = a.isSome(sessionStorage.getItem(STORAGE_KEY_TEST_MODE))

// Toggles test mode.
function cmdTest() {
  if (TEST_MODE) {
    sessionStorage.removeItem(STORAGE_KEY_TEST_MODE)
  }
  else {
    sessionStorage.setItem(STORAGE_KEY_TEST_MODE, ``)
  }
  window.location.reload()
}

ui.init()

// Initial log messages.
u.log.inf(`Welcome to Tabularius`)
u.log.inf(`Type "help" for a list of commands`)

if (TEST_MODE) {
  u.log.inf(`Test mode enabled`)
  await import(`./test.mjs`).catch(u.logErr)
}
else {
  os.runCmd(`help`)
  if (await fs.loadedFileHandles().catch(u.logErr)) {
    w.watchStarted().catch(u.logErr)
  }
}

const query = new URLSearchParams(window.location.search)

// Can plug-in arbitrary modules via URL query param.
for (const val of query.getAll(`import`)) {
  await import(new URL(val, new URL(`..`, import.meta.url))).catch(u.logErr)
}

// Can run arbitrary commands on startup.
for (const val of query.getAll(`run`)) {
  await os.runCmd(...val.split(/\s+/)).catch(u.logErr)
}
