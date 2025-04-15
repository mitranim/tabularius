import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as w from './watch.mjs'
import * as ui from './ui.mjs'
import * as p from './plot.mjs'
const {fb, up} = await u.cloudFeatureImport

import * as self from './main.mjs'
const tar = window.tabularius ??= a.Emp()
tar.m = self
a.patch(window, tar)

/*
CLI commands may be defined in arbitrary modules. They should all be registered
here, rather than in the origin modules, so that we can control the ordering.
*/

os.addCmd(os.cmdHelp)

cmdInit.cmd = `init`
cmdInit.desc = cmdInitDesc
cmdInit.help = cmdInitHelp
os.addCmd(cmdInit)

if (fb) os.addCmd(fb.cmdAuth)
os.addCmd(p.cmdPlot)

os.addCmd(fs.cmdLs)
os.addCmd(fs.cmdShow)
os.addCmd(fs.cmdShowSaves)
os.addCmd(fs.cmdDecode)

if (fb) os.addCmd(fb.cmdCls)
if (up) os.addCmd(up.cmdUpload)
os.addCmd(w.cmdWatch)

cmdStatus.cmd = `status`
cmdStatus.desc = `show status of app features and processes`
os.addCmd(cmdStatus)

os.addCmd(os.cmdPs)
os.addCmd(os.cmdKill)
os.addCmd(u.cmdVerbose)

cmdDeinit.cmd = `deinit`
cmdDeinit.desc = `stop all processes, revoke FS access`
os.addCmd(cmdDeinit)
os.addCmd(ui.cmdClear)

async function cmdInit({sig}) {
  const hadFsAccess = await fs.loadedFileHandles()
  if (!hadFsAccess && !await fs.initedFileHandles(sig)) return `FS access not initialized`
  if (!await w.watchStarted()) return `FS watch not initialized`
  if (!hadFsAccess) u.optStartUploadAfterInit(sig)
  return `FS initialized`
}

function cmdInitDesc() {
  return [
    `grant FS access, start `, os.BtnCmdWithHelp(`watch`), ` for local backups, `,
    `run `, os.BtnCmdWithHelp(`auth`), ` for cloud backups`,
  ]
}

function cmdInitHelp() {
  return u.LogParagraphs(
    cmdInitDesc(),
    [`enables the use of `, os.BtnCmdWithHelp(`plot`), ` for analyzing locally-stored runs`],
    [`also see `, os.BtnCmdWithHelp(`auth`), ` for cloud backups`],
  )
}

// Deinitialize features and stop all processes.
async function cmdDeinit({sig}) {
  return u.LogParagraphs(
    await os.procKillAll(),
    ...await fs.deinitFileHandles(sig),
  )
}

// Show status of features and processes.
function cmdStatus() {
  return u.LogParagraphs(
    new fs.FileConfStatus(fs.PROGRESS_FILE_CONF),
    new fs.FileConfStatus(fs.HISTORY_DIR_CONF),
    fb && [`auth: `, new fb.AuthStatus()],
    new os.Procs(),
  )
}

async function main() {
  ui.init()

  // Attempt to load the FS handles before running anything else.
  // Can be convenient for URL query "run" commands which rely on FS.
  const loadedFs = !!await fs.loadedFileHandles().catch(u.logErr)
  let imported = 0
  let ran = 0

  const query = u.urlQuery(window.location.search)
  if (!query.get(`import`)) {
    u.log.info(`welcome to Tabularius! 🚀`)
    await os.runCmd(`help`).catch(u.logErr)
  }

  for (const [key, val] of query) {
    // Can plug-in arbitrary modules via URL query param.
    if (key === `import`) {
      if (!val) continue
      imported++
      await import(new URL(val, new URL(`..`, import.meta.url))).catch(u.logErr)
      continue
    }

    // Can run arbitrary commands on startup via URL query param.
    if (key === `run`) {
      if (!val) continue
      ran++
      await os.runCmd(val).catch(u.logErr)
    }
  }

  /*
  Custom imports are for advanced users, so we skip the intro in that case.
  If the user wants to run stuff at this point, they can do it via URL query.
  */
  if (imported) return

  if (loadedFs) w.watchStarted().catch(u.logErr)

  /*
  For fresh visitors, we want to render some default chart, as a sample. For
  active users with existing runs, we probably want to render analysis of the
  latest run. Maybe this should be togglable. If some command or plugin from
  the URL query has modified the media already, we should avoid touching it.
  TODO: make this togglable.
  */
  if (ui.MEDIA.isDefault()) {
    os.runProc(p.plotDefault, `plot_default`, `running default analysis`).catch(u.logErr)
  }

  if (!loadedFs) {
    u.log.info(`recommended next step: run `, os.BtnCmdWithHelp(`init`))
  }
  else {
    fb?.recommendAuthIfNeededOrRunUpload(u.sig)
  }
}

main().catch(u.logErr)
