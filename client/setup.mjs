import * as a from '@mitranim/js/all.mjs'
import {E} from './util.mjs'
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
  return u.LogParagraphs(
    cmdSaves.desc,

    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`saves`), `        -- grant access`],
      [`  `, os.BtnCmd(`saves revoke`), ` -- revoke access`],
    ),

    fs.SAVE_DIR_LOCATION,
    tipEnablesFeatures(),
    `access is read-only and safe`,
  )
}

export async function cmdSaves({sig, args}) {
  const set = u.cliArgSet(cmdSaves.cmd, args)
  const help = set.has(`-h`) || set.has(`--help`)
  if (help) return os.cmdHelpDetailed(cmdSaves)

  if (set.size > 1) {
    u.log.err(`too many inputs in `, ui.BtnPromptReplace({val: args}))
    return os.cmdHelpDetailed(cmdSaves)
  }

  try {
    if (!set.has(`revoke`)) await savesGrant({sig, args})
    else await savesRevoke(sig)
  }
  finally {updateSetupFlowMsg(true)}
}

export async function savesGrant({sig, args}) {
  const conf = fs.SAVE_DIR_CONF
  if (!await confGranted({sig, conf, args})) return
  await w.watchStartOpt()
}

export async function savesRevoke(sig) {
  const conf = fs.SAVE_DIR_CONF
  if (!await confRevoked({sig, conf})) return
  os.procKillOpt(`watch`)
}

cmdHistory.cmd = `history`
cmdHistory.desc = `grant or revoke access to a run history directory`
cmdHistory.help = function cmdSavesHelp() {
  return u.LogParagraphs(
    cmdHistory.desc,

    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`history`), `        -- grant access`],
      [`  `, os.BtnCmd(`history revoke`), ` -- revoke access`],
    ),

    fs.HISTORY_DIR_LOCATION,
    tipEnablesFeatures(),
  )
}

export async function cmdHistory({sig, args}) {
  const set = u.cliArgSet(cmdHistory.cmd, args)
  const help = set.has(`-h`) || set.has(`--help`)
  if (help) return os.cmdHelpDetailed(cmdHistory)

  if (set.size > 1) {
    u.log.err(`too many inputs in `, ui.BtnPromptReplace({val: args}))
    return os.cmdHelpDetailed(cmdHistory)
  }

  try {
    if (!set.has(`revoke`)) await historyGrant({sig, args})
    else await historyRevoke(sig)
  }
  finally {updateSetupFlowMsg(true)}
}

export async function historyGrant({sig, args}) {
  const conf = fs.HISTORY_DIR_CONF
  if (!await confGranted({sig, conf, args})) return
  await w.watchStartOpt()
  await up.uploadStartOpt()
  // Suppress totals here to avoid polluting the log during setup.
  p.plotDefaultLocalOpt({quiet: true}).catch(u.logErr)
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
    u.log.info(
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
    u.log.info(conf.desc, `: not initialized; rerun `, os.BtnCmd(args))
    return false
  }

  u.log.info(conf.desc, `: access granted`)
  return true
}

export async function confRevoked({sig, conf}) {
  a.reqInst(conf, fs.FileConf)

  if (!conf.handle) {
    u.log.info(conf.desc, `: access not granted`)
    return false
  }

  await fs.fileConfDeinit(sig, conf)
  u.log.info(conf.desc, `: access revoked`)
  return true
}

function tipEnablesFeatures() {
  return [
    `this enables backups, run history, and analyzing runs with `,
    os.BtnCmdWithHelp(`plot`),
  ]
}

// SYNC[setup_state].
export function isSetupDone() {
  return (
    !!fs.SAVE_DIR_CONF.handle &&
    !!fs.HISTORY_DIR_CONF.handle &&
    !!au.STATE.userId
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
  const auth = !!au.STATE.userId
  const state = boolMask(save, hist, auth)
  const change = state !== SETUP_FLOW_PREV_STATE

  SETUP_FLOW_PREV_STATE = state
  if (!change || (opt && save && hist && auth)) return

  SETUP_FLOW_PREV_MSG?.remove()
  SETUP_FLOW_PREV_MSG = u.log.info(new SetupFlow())
}

class SetupFlow extends u.ReacElem {
  // SYNC[setup_state].
  run() {
    const save = !!fs.SAVE_DIR_CONF.handle
    const hist = !!fs.HISTORY_DIR_CONF.handle
    const auth = !!au.STATE.userId

    E(this, {}, ...u.LogParagraphs(
      u.LogLines(
        u.Bold(`essential setup steps:`),
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
    ))
  }
}

function Step(ok, ...chi) {
  return [
    checkmark(ok), ` `,
    E(`span`, {class: a.vac(ok) && `line-through`}, ...chi),
  ]
}

function NextStepSaves() {
  return u.LogParagraphs(
    [
      u.Bold(`recommended next step:`),
      ` click `, os.BtnCmdWithHelp(`saves`),
      ` and pick the game's save directory`,
      ` (read-only and safe); note that "AppData" is hidden by default:`,
    ],
    [`  `, fs.SAVE_DIR_PATH],
    tipEnablesFeatures(),
  )
}

function NextStepHist() {
  return u.LogParagraphs(
    u.Bold(`recommended next steps:`),

    [
      checkmark(),
      ` create a directory for your run history and backups; suggested location below; use a name without spaces:`,
    ],

    [`  `, fs.HISTORY_DIR_SUGGESTED_PATH],

    [
      checkmark(), ` click `, os.BtnCmdWithHelp(`history`),
      ` and pick the directory you created above`,
    ],

    [
      `the app will automatically watch save files, build the run history,`,
      ` and display plots for analysis via `, os.BtnCmdWithHelp(`plot`),
    ],
  )
}

function NextStepAuth() {
  return u.LogParagraphs(
    [
      u.Bold(`recommended next step:`),
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

function checkmark(ok) {return a.optBool(ok) ? `✅` : `➡️`}

function boolMask(...src) {
  let out = 0
  for (src of src) out = (out << 1) | (a.optBool(src) ? 1 : 0)
  return out
}
