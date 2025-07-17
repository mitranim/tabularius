import * as a from '@mitranim/js/all.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as w from './watch.mjs'
import * as ui from './ui.mjs'
import * as au from './auth.mjs'
import * as up from './upload.mjs'
import * as p from './plot.mjs'

cmdSaves.cmd = `saves`
cmdSaves.desc = `grant or revoke access to the game's saves directory`
cmdSaves.help = function cmdSavesHelp() {
  return ui.LogParagraphs(
    cmdSaves.desc,

    ui.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`saves`), `        -- grant access`],
      [`  `, os.BtnCmd(`saves revoke`), ` -- revoke access`],
    ),

    fs.SaveDirLocation(),
    tipEnablesFeatures(),
    `access is read-only and safe`,
  )
}

export async function cmdSaves({sig, args}) {
  const set = u.cliArgSet(cmdSaves.cmd, args)
  if (u.hasHelpFlag(set)) return os.cmdHelpDetailed(cmdSaves)

  if (set.size > 1) {
    ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace(args))
    return os.cmdHelpDetailed(cmdSaves)
  }

  try {
    if (!set.has(`revoke`)) await savesGrant({sig, args})
    else await savesRevoke(sig)
  }
  finally {updateSetupFlowMsg(true)}
  return undefined
}

export async function savesGrant({sig, args}) {
  const conf = fs.SAVE_DIR_CONF
  if (!await confGranted({sig, conf, args})) return
  await w.watchStartOpt()
  await up.uploadStartOpt()
}

export async function savesRevoke(sig) {
  const conf = fs.SAVE_DIR_CONF
  if (!await confRevoked({sig, conf})) return
  os.procKillOpt(`watch`)
}

cmdHistory.cmd = `history`
cmdHistory.desc = `grant or revoke access to a run history directory`
cmdHistory.help = function cmdSavesHelp() {
  return ui.LogParagraphs(
    cmdHistory.desc,

    ui.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`history`), `        -- grant access`],
      [`  `, os.BtnCmd(`history revoke`), ` -- revoke access`],
    ),

    fs.HistDirSuggestedLocation(),
    tipEnablesFeatures(),
  )
}

export async function cmdHistory({sig, args}) {
  const set = u.cliArgSet(cmdHistory.cmd, args)
  if (u.hasHelpFlag(set)) return os.cmdHelpDetailed(cmdHistory)

  if (set.size > 1) {
    ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace(args))
    return os.cmdHelpDetailed(cmdHistory)
  }

  try {
    if (!set.has(`revoke`)) await historyGrant({sig, args})
    else await historyRevoke(sig)
  }
  finally {updateSetupFlowMsg(true)}
  return undefined
}

export async function historyGrant({sig, args}) {
  const conf = fs.HISTORY_DIR_CONF
  if (!await confGranted({sig, conf, args})) return
  await w.watchStartOpt()
  await up.uploadStartOpt()
  p.plotDefaultLocalOpt({quiet: true}).catch(ui.logErr)
}

export async function historyRevoke(sig) {
  const conf = fs.HISTORY_DIR_CONF
  if (!await confRevoked({sig, conf})) return
  os.procKillOpt(`watch`)
  os.procKillOpt(`upload`)
}

export async function confGranted({sig, conf, args}) {
  a.reqInst(conf, fs.FileConf)

  const handle = await fs.fileConfLoadedWithPermIdemp(sig, conf)
  if (handle) {
    const {name} = handle
    ui.LOG.info(
      conf.desc, `: access granted`,
      // TODO: support quotes in CLI parsing.
      (
        name.includes(` `)
        ? `: ` + name
        : [`; browse with `, os.BtnCmd(a.spaced(`ls`, name))]
      ),
    )
    return false
  }

  if (!await fs.fileConfInitedIdemp(sig, conf)) {
    ui.LOG.info(conf.desc, `: access not granted; rerun `, os.BtnCmd(args))
    return false
  }

  ui.LOG.info(conf.desc, `: access granted`)
  return true
}

export async function confRevoked({sig, conf}) {
  a.reqInst(conf, fs.FileConf)

  if (!conf.handle) {
    ui.LOG.info(conf.desc, `: access not granted`)
    return false
  }

  await fs.fileConfDeinit(sig, conf)
  ui.LOG.info(conf.desc, `: access revoked`)
  return true
}

function tipEnablesFeatures() {
  return [
    `needed for backups, run history, and analyzing runs with `,
    os.BtnCmdWithHelp(`plot`),
  ]
}

// SYNC[setup_state].
export function isSetupDone() {
  return (
    !!fs.SAVE_DIR_CONF.handle &&
    !!fs.HISTORY_DIR_CONF.handle &&
    au.isAuthed()
  )
}

let SETUP_FLOW_PREV_STATE
let SETUP_FLOW_PREV_MSG

/*
Moves the message to the end of the log when relevant, ensuring that we guide
the user through the setup steps.

SYNC[setup_state].
*/
export function updateSetupFlowMsg(opt) {
  a.optBool(opt)
  const save = !!fs.SAVE_DIR_CONF.handle
  const hist = !!fs.HISTORY_DIR_CONF.handle
  const auth = au.isAuthed()
  const state = boolMask(save, hist, auth)
  const change = state !== SETUP_FLOW_PREV_STATE

  SETUP_FLOW_PREV_STATE = state
  if (!change || (opt && save && hist && auth)) return

  SETUP_FLOW_PREV_MSG?.remove()
  SETUP_FLOW_PREV_MSG = ui.LOG.info(SetupFlow)
}

// SYNC[setup_state].
function SetupFlow() {
  const save = !!fs.SAVE_DIR_CONF.handle
  const hist = !!fs.HISTORY_DIR_CONF.handle
  const auth = au.isAuthed()

  return ui.LogParagraphs(
    ui.LogLines(
      ui.Bold(`essential setup steps (any order):`),
      Step(save,
        `run `, os.BtnCmdWithHelp(`saves`),
        ` to grant access to the game save directory`
      ),
      Step(hist,
        `create a directory for run history and backups`,
      ),
      Step(hist,
        `run `, os.BtnCmdWithHelp(`history`),
        ` to grant access to the run history directory`
      ),
      Step(auth,
        `run `, os.BtnCmdWithHelp(`auth`), ` to enable cloud backups`,
      ),
    ),
    (
      !save
      ? NextStepSaves()
      : !hist
      ? NextStepHist()
      : !auth
      ? NextStepAuth()
      : `setup done; all features available! 🎉`
    ),
  )
}

function Step(ok, ...chi) {
  return [
    checkmark(ok), ` `,
    E(`span`, {class: a.vac(ok) && `line-through`, chi}),
  ]
}

function NextStepSaves() {
  const path = `%UserProfile%\\${fs.SAVE_DIR_PATH}`

  return ui.LogParagraphs(
    [
      ui.Bold(`recommended next step:`),
      ` click `, os.BtnCmdWithHelp(`saves`),
      ` and pick the game's save directory (read-only and safe)`,
    ],
    fs.SaveDirLocation(),
    [ui.Bold(`option 1:`), ` copy-paste into the Explorer address bar:`],
    [`  `, ui.Bold(path), `\u00a0`, ui.BtnClip(path)],
    [ui.Bold(`option 2:`), ` find "AppData" manually:`],
    ui.LogLines(
      `  * open Explorer`,
      `  * goto your user directory; if you're unsure where, goto "C:\\Users" and look for your username`,
      `  * in the ribbon above: click View → tick "Hidden items"`,
      `  * look for "AppData" in your user directory`,
    ),
    // AfterSavesAndHistory(),
  )
}

function NextStepHist() {
  return ui.LogParagraphs(
    ui.Bold(`recommended next steps:`),

    [
      checkmark(),
      ` create a directory for your run history and backups; suggested location below; use a name without spaces:`,
    ],

    [`  `, fs.HistDirSuggestedPath()],

    [
      checkmark(), ` click `, os.BtnCmdWithHelp(`history`),
      ` and pick the directory you created above`,
    ],

    // AfterSavesAndHistory(),
  )
}

function NextStepAuth() {
  return ui.LogParagraphs(
    [
      ui.Bold(`recommended next step:`),
      ` click `, os.BtnCmdWithHelp(`auth`),
      ` and enter a password or passphrase to authenticate;`,
      ` easy and completely anonymous`,
    ],
    [
      `the app will automatically backup your run history to the cloud;`,
      ` this lets you contribute to the global statistics and share your`,
      ` runs with others via `, os.BtnCmdWithHelp(`plot_link -c`),
    ],
  )
}

// Unused, TODO drop.
function _AfterSavesAndHistory() {
  return [
    `after `, os.BtnCmdWithHelp(`saves`), ` and `, os.BtnCmdWithHelp(`history`),
    `, the app will automatically watch save files, build the run history`,
    `, and display plots for analysis via `, os.BtnCmdWithHelp(`plot`),
  ]
}

function checkmark(ok) {return a.optBool(ok) ? `✅` : `➡️`}

function boolMask(...src) {
  let out = 0
  for (src of src) out = (out << 1) | (a.optBool(src) ? 1 : 0)
  return out
}
