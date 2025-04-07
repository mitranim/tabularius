import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import {E} from './util.mjs'
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
All CLI commands should be added here so that we can control the ordering.
*/

cmdHelp.cmd = `help`
cmdHelp.desc = `run "help" for a brief summary of all commands, or "help <cmd> for detailed help on one command`,
cmdHelp.help = u.joinParagraphs(
  cmdHelp.desc,
  u.joinLines(
    `usage:`,
    `  help`,
    `  help <cmd>`,
  ),
)
os.addCmd(cmdHelp)

cmdInit.cmd = `init`
cmdInit.desc = `grant FS access, start "watch" for backups`
os.addCmd(cmdInit)

cmdDeinit.cmd = `deinit`
cmdDeinit.desc = `stop all processes, revoke FS access`
os.addCmd(cmdDeinit)

cmdStatus.cmd = `status`
cmdStatus.desc = `show status of app features and processes`
os.addCmd(cmdStatus)

os.addCmd(os.cmdPs)
os.addCmd(os.cmdKill)
os.addCmd(w.cmdWatch)
os.addCmd(fs.cmdLs)
os.addCmd(fs.cmdShow)
os.addCmd(fs.cmdShowSaves)
os.addCmd(fs.cmdDecode)
os.addCmd(d.cmdAnalyze)
os.addCmd(u.cmdVerbose)
os.addCmd(u.cmdClear)

cmdTest.cmd = `test`
cmdTest.desc = `toggle test mode`
cmdTest.help = `toggles test mode, which disables the default startup behavior and imports "js/test.mjs" for testing; intended only for developing Tabularius; not useful to regular users`
os.addCmd(cmdTest)

function cmdHelp({args}) {
  args = u.splitCliArgs(args)

  if (args.length <= 1) {
    return [
      `available commands:`,
      E(`div`, {class: u.LOG_SPACE_Y},
        ...a.map(os.CMDS, cmdHelpShort),
        E(`p`, {}, E(`b`, {}, `pro tip`), `: can run commands on startup via URL query parameters; for example, try appending to the URL: "?run=analyze 0000"`),
      ),
    ]
  }

  if (args.length > 2) return `usage: "help" or "help <cmd>"`

  const name = args[1]
  const cmd = os.CMDS[name]
  if (!cmd) throw `unknown command ${a.show(name)}`

  return u.joinParagraphs(
    `command ${a.show(name)}:`,
    (a.isFun(cmd.help) ? cmd.help() : cmd.help) || cmd.desc,
  )
}

function cmdHelpShort(val) {
  os.reqCmd(val)
  return E(`p`, {}, E(`b`, {}, val.cmd), `: `, val.desc)
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

// Attempt to load the FS handles before running anything else.
// Can be convenient for URL query "run" commands which rely on FS.
const loadedFs = !!await fs.loadedFileHandles().catch(u.logErr)

const query = new URLSearchParams(window.location.search)

// Can plug-in arbitrary modules via URL query param.
for (const val of query.getAll(`import`)) {
  await import(new URL(val, new URL(`..`, import.meta.url))).catch(u.logErr)
}

if (TEST_MODE) {
  u.log.info(`test mode enabled`)
  await import(`./test.mjs`).catch(u.logErr)
}

// Can run arbitrary commands on startup via URL query param.
const run = query.getAll(`run`)
for (const val of run) await os.runCmd(val).catch(u.logErr)

if (!TEST_MODE && !run.length) os.runCmd(`help`).catch(u.logErr)

if (!TEST_MODE) {
  if (loadedFs) w.watchStarted().catch(u.logErr)

  /*
  For fresh visitors, we want to render some default chart, as a sample. For
  active users with existing runs, we probably want to render analysis of the
  latest run. Maybe this should be togglable. If some command or plugin from
  the URL query has modified the media already, we should avoid touching it.
  TODO: make this togglable.
  */
  if (ui.MEDIA.isDefault()) {
    os.runProc(d.analyzeDefault, `analyze_default`, `running default analysis`).catch(u.logErr)
  }
}
