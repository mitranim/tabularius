import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as w from './watch.mjs'
import * as ui from './ui.mjs'
import * as au from './auth.mjs'
import * as up from './upload.mjs'
import * as p from './plot.mjs'
import * as e from './edit.mjs'
import * as sr from './show_round.mjs'
import * as se from './setup.mjs'

import * as self from './main.mjs'
const tar = globalThis.tabularius ??= a.Emp()
tar.m = self
a.patch(globalThis, tar)

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
os.addCmd(sr.cmdShowRound)
os.addCmd(e.cmdEdit)
os.addCmd(fs.cmdRollback)

cmdLs.cmd = `ls`
cmdLs.desc = cmdLsDesc
cmdLs.help = cmdLsHelp
os.addCmd(cmdLs)

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
    new fs.FileConfStatus(fs.SAVE_DIR_CONF),
    new fs.FileConfStatus(fs.HISTORY_DIR_CONF),
    [`auth: `, new au.AuthStatus()],
    new os.Procs(),
  )
}

function cmdLsDesc() {
  return `list local dirs / files, or cloud runs / rounds`
}

function cmdLsHelp() {
  return ui.LogParagraphs(
    cmdLs.desc(),
    ui.LogLines(
      `supported sources:`,
      [
        `  local -- default -- requires `,
        os.BtnCmdWithHelp(`saves`),
        ` and `,
        os.BtnCmdWithHelp(`history`),
      ],
      [
        `  cloud -- `, ui.BtnPrompt({cmd: `ls`, suf: `-c`}),
        `      -- requires `, os.BtnCmdWithHelp(`auth`),
      ],
    ),
    ui.LogLines(
      `local usage:`,
      [`  `, os.BtnCmd(`ls /`)],
      [`  `, os.BtnCmd(`ls -s`), ` -- additional stats`],
      [`  `, ui.BtnPrompt({full: true, cmd: `ls`, eph: `<some_dir>`})],
      [`  `, ui.BtnPrompt({full: true, cmd: `ls`, eph: `<some_dir>/<some_file>`})],
    ),
    ui.LogLines(
      `cloud usage:`,
      [`  `, os.BtnCmd(`ls -c`)],
      [`  `, ui.BtnPrompt({full: true, cmd: `ls`, suf: `-c `, eph: `<some_run_id>`})],
    ),
    ui.LogLines(
      `tip: filter plots by run numbers from directory names; this works for both local and cloud plots:`,
      [`  `, ui.BtnPrompt({
        full: true,
        cmd: `plot`,
        suf: `user_id=current run_id=all run_num=`,
        eph: `<dir_name>`,
      })],
      [`  `, ui.BtnPrompt({
        full: true,
        cmd: `plot`,
        suf: `user_id=current run_id=all run_num=`,
        eph: `<dir_0> run_num=<dir_1>`,
      })],
    ),
  )
}

export function cmdLs({sig, args}) {
  const cmd = cmdLs.cmd
  const pairs = a.tail(u.cliDecode(args))
  if (!pairs.length) return os.cmdHelpDetailed(cmdLs)

  const paths = []
  let cloud
  let stat

  for (const [key, val, pair] of pairs) {
    if (u.isHelpFlag(key)) return os.cmdHelpDetailed(cmdLs)

    if (key === `-c`) {
      cloud = ui.cliBool(cmd, key, val)
      continue
    }

    if (key === `-s`) {
      stat = ui.cliBool(cmd, key, val)
      continue
    }

    if (key) {
      ui.LOG.err(`unrecognized input `, a.show(pair), ` in `, ui.BtnPromptReplace({val: args}))
      return os.cmdHelpDetailed(cmdLs)
    }
    paths.push(val)
  }

  if (paths.length > 1) {
    ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace({val: args}))
    return os.cmdHelpDetailed(cmdLs)
  }
  const path = paths[0]

  if (cloud) {
    if (stat) {
      ui.LOG.err(`ignoring `, ui.BtnPrompt({cmd, suf: `-s`}), ` in cloud mode in `, ui.BtnPromptReplace({val: args}))
    }
    // TODO use user id as directory name.
    return au.listDirsFiles(sig, path)
  }

  return fs.listDirsFiles({sig, path, stat})
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
    /*
    Help is convenient to have on startup so you can click the commands. But
    when the initial setup is not finished, we'd rather focus their attention
    on the setup flow message, and avoid overwhelming them with help.
    */
    if (se.isSetupDone()) {
      ui.LOG.info(`welcome to Tabularius! 🚀`)
      await os.runCmd(`help`).catch(ui.logErr)
    }
    else {
      ui.LOG.info(
        `welcome to Tabularius! type or click `,
        os.BtnCmd(`help`), ` to see available commands 🚀`,
      )
    }
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

  /*
  For fresh visitors, we want to render some default chart, as a sample. For
  active users with existing runs, we probably want to render analysis of the
  latest run. Maybe this should be togglable. If some command or plugin from
  the URL query has modified the media already, we should avoid touching it.
  TODO: make this togglable.
  */
  if (lastProcPromise) await lastProcPromise

  if (!ranPlots && ui.MEDIA.isDefault()) {
    await os.runProc({
      fun: p.plotDefault,
      args: `plot_default`,
      desc: `running default analysis`,
    }).catch(ui.logErr)
  }

  if (!se.isSetupDone()) se.updateSetupFlowMsg()
}

main().catch(ui.logErr)
