import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as w from './watch.mjs'
import * as d from './dat.mjs'
import * as ui from './ui.mjs'

import * as self from './main.mjs'
const tar = window.tabularius ??= a.Emp()
tar.m = self
a.patch(window, tar)

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
  name: `show`,
  desc: `clipboard the decoded content of a file; usage: "show <path>"`,
  fun: fs.cmdShow,
}))

os.COMMANDS.add(new os.Cmd({
  name: `analyze`,
  desc: `analyze data`,
  fun: d.cmdAnalyze,
}))

os.COMMANDS.add(new os.Cmd({
  name: `media`,
  desc: `toggle media panel`,
  fun: ui.cmdMedia,
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

os.COMMANDS.add(new os.Cmd({
  name: `clear`,
  desc: `clear the log`,
  fun: u.cmdClear,
}))

/*
TODO: `help <cmd>` which shows help for one command, and tries to use its
`.help` which should be more detailed than `.desc`.
*/
function cmdHelp() {
  return u.joinParagraphs(
    `available commands:`,
    a.joinLines(a.map(os.COMMANDS, cmdToHelp)),
    `pro tip: can run commands on startup via URL query parameters; for example, try appending to the URL: "?run=analyze 000000"`,
  )
}

function cmdToHelp(val) {
  a.reqInst(val, os.Cmd)
  return val.name + `: ` + val.desc
}

// Initialize features that require user action.
async function cmdInit({sig}) {
  if (!await fs.initedFileHandles(sig)) return `FS access not initialized`
  if (!await w.watchStarted()) return `FS watch not initialized`
  return `all features initialized`
}

// Deinitialize features and stop all processes.
async function cmdDeinit({sig}) {
  const killed = await os.procKillAll()
  return a.joinLinesOptLax([
    killed,
    await fs.deinitFileHandles(sig)
  ].flat())
}

// Show status of features and processes.
async function cmdStatus({sig}) {
  return u.joinLines(
    await fs.statusProgressFile(sig),
    await fs.statusHistoryDir(sig),
    os.showProcs(),
  )
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
u.log.info(`welcome to Tabularius`)
u.log.info(`type "help" for a list of commands`)

const query = new URLSearchParams(window.location.search)

// Can plug-in arbitrary modules via URL query param.
for (const val of query.getAll(`import`)) {
  await import(new URL(val, new URL(`..`, import.meta.url))).catch(u.logErr)
}

// Can run arbitrary commands on startup.
for (const val of query.getAll(`run`)) {
  await os.runCmd(val).catch(u.logErr)
}

if (TEST_MODE) {
  u.log.info(`test mode enabled`)
  await import(`./test.mjs`).catch(u.logErr)
}
else {
  os.runCmd(`help`).catch(u.logErr)

  if (await fs.loadedFileHandles().catch(u.logErr)) {
    w.watchStarted().catch(u.logErr)
  }

  /*
  For fresh visitors, we want to render some default chart, as a sample. For
  active users with existing runs, we probably want to render analysis of the
  latest run. Maybe this should be togglable. If some command or plugin from
  the URL query has modified the media already, we should avoid touching it.
  TODO: make this togglable.
  */
  if (ui.MEDIA.isDefault) {
    os.runProc(d.analyzeDefault, `analyze_default`, `running default analysis`).catch(u.logErr)
  }
}
