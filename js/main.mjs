import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as w from './watch.mjs'
import * as ui from './ui.mjs'
import * as p from './plot.mjs'
const {fb, ms, up} = await u.cloudFeatureImport

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

cmdLs.cmd = `ls`
cmdLs.desc = cmdLsDesc
cmdLs.help = cmdLsHelp
os.addCmd(cmdLs)

os.addCmd(fs.cmdShow)
os.addCmd(w.cmdWatch)
if (up) os.addCmd(up.cmdUpload)

cmdStatus.cmd = `status`
cmdStatus.desc = `show status of app features and processes`
os.addCmd(cmdStatus)

os.addCmd(os.cmdKill)
os.addCmd(u.cmdVerbose)

if (ms) os.addCmd(ms.cmdFeedback)

cmdDeinit.cmd = `deinit`
cmdDeinit.desc = `stop all processes, revoke FS access`
os.addCmd(cmdDeinit)

os.addCmd(ui.cmdClear)

export async function cmdInit({sig, args}) {
  args = a.tail(u.splitCliArgs(args))

  const progInit = u.arrRemoved(args, `-p`)
  const histInit = u.arrRemoved(args, `-h`)

  const progHad = await fs.loadedProgressFile()
  const histHad = await fs.loadedHistoryDir()

  let progHave = progHad
  let histHave = histHad

  if (progInit) {
    if ((progHave ||= await fs.initedProgressFile(sig))) {
      u.log.info(`progress file: initialized`, a.vac(!histHave && !histInit) && [
        `; next step: run `, os.BtnCmd(`init -h`), ` to grant access to history dir`,
      ])
    }
    else {
      u.log.info(`progress file: not initialized; rerun `, os.BtnCmd(`init -p`))
    }
  }

  if (histInit) {
    if ((histHave ||= await fs.initedHistoryDir(sig))) {
      u.log.info(`history dir: initialized`, a.vac(!progHave) && [
        `; next step: run `, os.BtnCmd(`init -p`), ` to grant access to progress file`,
      ])
    }
    else {
      u.log.info(`history dir: not initialized; rerun `, os.BtnCmd(`init -h`))
    }
  }

  if (!histHad && histHave) u.optStartUploadAfterInit(sig)

  if (progHave && histHave) {
    if (!await w.watchStarted()) u.log.info(`FS watch: not initialized`)
    else u.log.info(`FS watch: initialized`)
  }
  else if (!(progInit || histInit)) {
    return [
      `no flags provided, nothing done; run `,
      os.BtnCmd(`init -p`), ` or `, os.BtnCmd(`init -h`),
    ]
  }
}

function cmdInitDesc() {
  return [
    `grant FS access, start `, os.BtnCmdWithHelp(`watch`), ` for local backups`,
  ]
}

function cmdInitHelp() {
  return u.LogParagraphs(
    cmdInit.desc(),
    [
      `enables the use of `,
      os.BtnCmdWithHelp(`plot`),
      ` for analyzing locally-stored runs`,
    ],

    u.LogLines(
      `run each of these once:`,
      [`  `, os.BtnCmd(`init -p`), ` -- pick progress file`],
      [`  `, os.BtnCmd(`init -h`), ` -- pick history dir`],
    ),

    fs.PROGRESS_FILE_LOCATION,
    fs.HISTORY_DIR_LOCATION,
    [`tip: also see `, os.BtnCmdWithHelp(`auth`), ` for cloud backups`],
  )
}

// Deinitialize features and stop all processes.
export async function cmdDeinit({sig}) {
  return u.LogParagraphs(
    await os.procKillAll(),
    ...await fs.deinitFileHandles(sig),
  )
}

// Show status of features and processes.
export function cmdStatus() {
  return u.LogParagraphs(
    new fs.FileConfStatus(fs.PROGRESS_FILE_CONF),
    new fs.FileConfStatus(fs.HISTORY_DIR_CONF),
    fb && [`auth: `, new fb.AuthStatus()],
    new os.Procs(),
  )
}

function cmdLsDesc() {
  return `list local dirs/files, or cloud runs/rounds`
}

function cmdLsHelp() {
  return u.LogParagraphs(
    cmdLs.desc(),
    u.LogLines(
      `supported sources:`,
      [`  local -- default -- requires `, os.BtnCmdWithHelp(`init`)],
      [
        `  cloud -- `, ui.BtnPromptAppend(`ls`, `-c`),
        `      -- requires `, os.BtnCmdWithHelp(`auth`),
      ],
    ),
    u.LogLines(
      `local usage:`,
      [`  `, ui.BtnPrompt(`ls /`)],
      [`  `, ui.BtnPrompt(`ls -i`), ` -- additional stats`],
      [`  `, os.BtnCmd(`ls /`)],
      [`  `, os.BtnCmd(`ls -i`)],
      `  ls <some_dir>`,
      `  ls <some_dir>/<some_file>`,
    ),
    u.LogLines(
      `cloud usage:`,
      [`  `, ui.BtnPrompt(`ls -c`)],
      [`  `, os.BtnCmd(`ls -c`)],
      `  ls -c <some_run_id>`,
    ),
    // TODO: don't bother telling about how to init when already inited.
    [
      `tip: to upload runs to the cloud, run `,
      os.BtnCmdWithHelp(`init`), ` to grant FS access, and `,
      os.BtnCmdWithHelp(`auth`), ` to authenticate`
    ],
  )
}

export function cmdLs(proc) {
  const pairs = a.tail(u.cliDecode(proc.args))
  if (!pairs.length) return os.cmdHelpDetailed(cmdLs)

  const args = []
  let cloud
  let info

  for (const [key, val] of pairs) {
    if (key === `-c`) {
      if (a.isSome(cloud)) throw Error(`redundant "-c"`)
      cloud = u.cliBool(key, val)
      if (cloud && !fb) throw Error(`cloud-related modules are unavailable`)
      continue
    }

    if (key === `-i`) {
      if (a.isSome(info)) throw Error(`redundant "-i"`)
      info = u.cliBool(key, val)
      continue
    }

    if (key) {
      return u.LogParagraphs(
        `unrecognized flag ${a.show(key)}`,
        os.cmdHelpDetailed(cmdLs),
      )
    }
    args.push(val)
  }

  if (args.length > 1) {
    return u.LogParagraphs(`too many arguments`, os.cmdHelpDetailed(cmdLs))
  }

  if (cloud) {
    if (info) u.LogParagraphs(`unsupported "-i" in cloud mode`, os.cmdHelpDetailed(cmdLs))
    return fb.listRunsRounds(proc, args[0])
  }

  return fs.listDirsFiles(proc, args[0], info)
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
