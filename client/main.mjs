import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as ls from './ls.mjs'
import * as w from './watch.mjs'
import * as ui from './ui.mjs'
import * as au from './auth.mjs'
import * as up from './upload.mjs'
import * as p from './plot.mjs'
import * as e from './edit.mjs'
import * as src from './show_round_combined.mjs'
import * as srs from './show_round_split.mjs'
import * as se from './setup.mjs'

import * as self from './main.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.m = self
a.patch(globalThis, namespace)

/*
CLI commands may be defined in arbitrary modules. They should all be registered
here, rather than in the origin modules, so that we can control the ordering.
*/

os.addCmd(os.cmdHelp)
os.addCmd(se.cmdSaves)
os.addCmd(se.cmdHistory)
os.addCmd(au.cmdAuth)
os.addCmd(p.cmdPlot)
os.addCmd(p.cmdPlotLink)
os.addCmd(srs.cmdShowRoundSplit)
os.addCmd(src.cmdShowRoundCombined)
os.addCmd(e.cmdEdit)
os.addCmd(fs.cmdRollback)
os.addCmd(ls.cmdLs)
os.addCmd(fs.cmdShow)
os.addCmd(w.cmdWatch)
os.addCmd(up.cmdUpload)

cmdStatus.cmd = `status`
cmdStatus.desc = `show status of app features and processes`
os.addCmd(cmdStatus)

os.addCmd(os.cmdKill)
os.addCmd(u.cmdVerbose)
os.addCmd(ui.cmdClear)

// Show status of features and processes.
export function cmdStatus({args}) {
  if (u.hasHelpFlag(u.splitCliArgs(args))) return os.cmdHelpDetailed(cmdStatus)

  return ui.LogParagraphs(
    a.bind(fs.fileConfStatusMsg, fs.SAVE_DIR_CONF),
    a.bind(fs.fileConfStatusMsg, fs.HISTORY_DIR_CONF),
    [`auth: `, au.authStatusMsg],
    os.showProcs,
  )
}

async function main() {
  ui.init()

  /*
  Attempt to load the FS handles before running anything else. Needed for FS
  migrations, and convenient for URL query "run" commands which rely on FS.
  */
  const [_loadedProg, _loadedSave, loadedHist] = await Promise.all([
    fs.loadedProgressFile(u.sig).catch(ui.logErr),
    fs.loadedSaveDir(u.sig).catch(ui.logErr),
    fs.loadedHistoryDir(u.sig).catch(ui.logErr),
  ]).catch(ui.logErr)

  if (!u.QUERY.get(`import`)) {
    ui.LOG.info(`welcome to Tabularius! 🚀`)
    await os.runCmd(`help`).catch(ui.logErr)
  }

  // Other code relies on up-to-date FS state, so FS migrations run first.
  if (loadedHist) await fs.migOpt().catch(ui.logErr)

  let imported = 0
  let ranPlots = 0
  let lastProcPromise

  for (const [key, val] of u.QUERY) {
    // Can plug-in arbitrary modules via URL query param.
    if (key === `import`) {
      if (!val) continue
      const url = new URL(val, globalThis.location.href)
      if (
        url.origin === globalThis.location.origin ||
        url.hostname === `localhost` ||
        url.hostname === `127.0.0.1` ||
        url.hostname === `0.0.0.0`
      ) {
        await import(new URL(val, globalThis.location.href)).catch(ui.logErr)
        imported++
      }
      else {
        ui.LOG.err(`rejecting foreign import `, a.show(val), ` to avoid XSS`)
      }
      continue
    }

    // Can run arbitrary commands on startup via URL query param.
    if (key === `run`) {
      if (!val) continue
      lastProcPromise = os.runCmd(val, {waitFor: lastProcPromise}).catch(ui.logErr)
      if (val.startsWith(`plot `)) ranPlots++
    }
  }

  /*
  Custom imports are for advanced users, so we skip the intro in that case.
  Users can run default stuff via URL query if they want.
  */
  if (imported) return

  w.watchStartOpt().catch(ui.logErr)
  up.uploadStartOpt().catch(ui.logErr)

  if (lastProcPromise) await lastProcPromise

  /*
  For fresh visitors, we want to render some default chart, as a sample. For
  active users with existing runs, we probably want to render analysis of the
  latest run. Maybe this should be togglable. If some command or plugin from
  the URL query has modified the media already, we should avoid touching it.
  TODO: make this togglable.
  */
  if (!ranPlots && ui.MEDIA.isDefault()) {
    await os.runProc({
      fun: p.plotDefault,
      args: `plot_default`,
      desc: `running default analysis`,
    }).catch(ui.logErr)
  }

  if (!se.isSetupDone()) se.updateSetupFlowMsg()
}

await main().catch(ui.logErr)
