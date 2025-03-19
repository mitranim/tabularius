import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as d from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom.mjs'
import * as p from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/prax.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs.mjs'
import * as od from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/obs_dom.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom_reg.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'

os.COMMANDS.add(new os.Cmd({
  name: `help`,
  desc: `show help`,
  fun: cmdHelp,
}))

os.COMMANDS.add(new os.Cmd({
  name: `clear`,
  desc: `clear the log`,
  fun: cmdClear,
}))

os.COMMANDS.add(new os.Cmd({
  name: `ps`,
  desc: `list running processes`,
  fun: cmdPs,
}))

os.COMMANDS.add(new os.Cmd({
  name: `status`,
  desc: `show status of app features and processes`,
  fun: cmdStatus,
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
  name: `kill`,
  desc: `kill a process`,
  help: `kill <id>`,
  fun: cmdKill,
}))

os.COMMANDS.add(new os.Cmd({
  name: `media`,
  desc: `toggle media panel`,
  fun: cmdMedia
}))

os.COMMANDS.add(new os.Cmd({
  name: `sync`,
  desc: `sync files (mock process)`,
  fun: cmdMockProcess,
}))

os.COMMANDS.add(new os.Cmd({
  name: `analyze`,
  desc: `analyze data (mock process)`,
  fun: cmdMockProcess,
}))

const TITLEBAR = E(
  `div`,
  {class: `flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800`},

  // Left side with title
  E(`h1`, {}, `Tabularius`),

  // Right side with links
  E(`div`, {class: `flex gap-4`},
    E(`a`, {href: `https://github.com/mitranim/tabularius`, target: `_blank`, class: `text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200`}, `GitHub`),
    E(`a`, {href: `https://discord.gg/vYNuXDfJ`, target: `_blank`, class: `text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200`}, `Discord`)
  ),
)

// A reactive element that shows running processes.
const PROCESS_LIST = new class ProcessList extends u.ReacElem {
  run() {
    const vals = a.values(os.PROCS)
    const len = vals.length

    /*
    Ensure we're monitoring the observable; `a.values` doesn't do that
    when the dict is empty.
    */
    os.PROCS[``]

    E(
      this,
      {class: `flex flex-col gap-2 border border-gray-300 dark:border-gray-700 rounded p-4 bg-gray-100 dark:bg-gray-800`},
      (
        len
        ? [
          E(`div`, {}, `active processes (${len}):`),
          a.map(vals, Process),
        ]
        : E(`div`, {class: `text-gray-500`}, `no active processes`)
      )
    )
  }
}()

function Process(src) {
  a.reqInst(src, os.Proc)
  return E(`div`, {class: `flex items-center justify-between gap-2`},
    E(`span`, {class: `font-medium flex-1`}, src.id, `: `, u.joinSpaced(src.args)),
    a.vac(src.startAt) && E(
      `span`,
      {class: `text-sm text-gray-500 dark:text-gray-500`},
      u.timeFormat.format(src.startAt),
    ),
    E(`button`, {
      type: `button`,
      class: `bg-red-500 text-white rounded hover:bg-red-600`,
      style: STYLE_BTN_CEN,
      onclick() {os.runCommand(`kill ` + src.id)},
    }, `✕`),
  )
}

// For single-character or icon buttons.
// TODO convert to Tailwind classes.
const STYLE_BTN_CEN = {
  width: `2rem`,
  height: `2rem`,
  textAlign: `center`,
  verticalAlign: `middle`,
  alignItems: `center`,
  lineHeight: `1`,
}

// Default children of the media panel, shown when not overridden by other content.
const MEDIA_PANEL_DEFAULT_CHI = [
  E(`div`, {}, `Media Panel`),

  // Example content - could be a chart, image, etc.
  E(`div`, {class: `border border-gray-300 dark:border-gray-700 rounded p-4 bg-gray-100 dark:bg-gray-800`},
    E(`div`, {class: `text-center`}, `Sample Chart`),
    E(`div`, {class: `h-64 flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded bg-white dark:bg-gray-700`},
      E(`div`, {class: `text-gray-500 dark:text-gray-400`}, `[Chart placeholder]`)
    )
  ),

  PROCESS_LIST,
]

const MEDIA_PANEL = new class MediaPanel extends u.Elem {
  constructor() {
    super()
    E(
      this,
      {class: `flex flex-col gap-4 flex-1 min-w-0 bg-white dark:bg-gray-900 p-4 overflow-y-auto`},
      MEDIA_PANEL_DEFAULT_CHI,
    )
  }

  // Placeholder implementation. Later this will toggle between default content
  // and custom content, which can be added by arbitrary code.
  toggle() {this.hidden = !this.hidden}
}()

const MIDDLE = E(`div`, {class: `flex flex-1 min-h-0`}, u.log, MEDIA_PANEL)

const PROMPT_FOCUS_KEY = `/`

class PromptInput extends dr.MixReg(HTMLInputElement) {
  connectedCallback() {
    this.onBlur()
    this.onfocus = this.onFocus
    this.onblur = this.onBlur
    this.onkeydown = this.onKeydown
  }

  // When focused, simplify the placeholder
  onFocus() {
    this.placeholder = `type a command (try "help")`
  }

  // When unfocused, mention the shortcut
  onBlur() {
    this.placeholder = `type a command (try "help") (press ${a.show(PROMPT_FOCUS_KEY)} to focus)`
  }

  onKeydown(eve) {
    if (eve.key === `ArrowUp`) {
      a.eventKill(eve)
      this.historyPrev()
      return
    }

    if (eve.key === `ArrowDown`) {
      a.eventKill(eve)
      this.historyNext()
      return
    }

    if (eve.key === `Enter`) {
      a.eventKill(eve)
      this.commandSubmit()
      return
    }

    // Lets the user spam the prompt-focusing key without fear of repercussion.
    if (eve.key === PROMPT_FOCUS_KEY && !this.value) {
      a.eventKill(eve)
    }
  }

  // Navigate to the previous entry in the command history
  historyPrev() {
    if (!os.CMD_HISTORY.length) return

    if (a.isNil(os.CMD_HISTORY_INDEX.index)) {
      os.CMD_HISTORY_INDEX.index = os.CMD_HISTORY.length - 1
    } else if (os.CMD_HISTORY_INDEX.index > 0) {
      os.CMD_HISTORY_INDEX.index--
    }

    this.value = os.CMD_HISTORY[os.CMD_HISTORY_INDEX.index]
  }

  // Navigate to the next entry in the command history
  historyNext() {
    if (!os.CMD_HISTORY.length || a.isNil(os.CMD_HISTORY_INDEX.index)) return

    if (os.CMD_HISTORY_INDEX.index < os.CMD_HISTORY.length - 1) {
      os.CMD_HISTORY_INDEX.index++
      this.value = os.CMD_HISTORY[os.CMD_HISTORY_INDEX.index]
    } else {
      os.CMD_HISTORY_INDEX.index = undefined
      this.value = ``
    }
  }

  // Command submission (on Enter)
  commandSubmit() {
    const src = this.value.trim()
    if (!src) return
    u.log.inf(`> ${src}`)
    this.value = ``
    os.CMD_HISTORY_INDEX.index = undefined
    os.runCommand(src).catch(u.logErr)
  }
}

const PROMPT_INPUT = E(new PromptInput(), {
  class: `w-full bg-transparent resize-none overflow-hidden dark:text-gray-200 outline-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded p-2 transition-all duration-150 ease-in-out`,
  autofocus: true,
})

const PROMPT = E(
  `div`,
  {class: `p-4 bg-gray-200 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700`},
  E(`div`, {class: `flex items-center`},
    E(`span`, {class: `text-green-600 dark:text-green-400`}, `>`),
    PROMPT_INPUT,
  )
)

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

function cmdClear() {u.log.clear()}

function cmdPs() {return showProcs()}

function procToStatus(src) {
  a.reqInst(src, os.Proc)
  return a.spaced(src.id + `:`, a.show(src.cmd()) + `:`, src.status)
}

function cmdKill(sig, args) {
  u.reqArrOfStr(args)
  switch (a.len(args)) {
    case 0:
    case 1: return `missing process id or name; usage: kill <id|name>`
    case 2: return procKill(sig, args[1])
    default: return `too many args; usage: kill <id|name>`
  }
}

async function procKill(sig, key) {
  u.reqSig(sig)
  a.reqStr(key)
  if (!key) return undefined

  const proc = os.PROCS[key] || a.find(os.PROCS, val => val.args[0] === key)
  if (!proc) return `no process with id or name ${a.show(key)}`

  try {
    proc.deinit()
    await u.wait(sig, proc.promise)
  }
  finally {
    if (proc.control.signal.aborted) {
      delete os.PROCS[proc.id]
    }
  }
}

function cmdMedia() {
  MEDIA_PANEL.toggle()
  return `panel toggled`
}

async function cmdMockProcess(sig, args) {
  u.reqArrOfStr(args)
  u.log.inf(`running`, a.show(args))
  await u.wait(sig, a.after(4096))
  return `done (mock)`
}

function showProcs() {
  if (!a.len(os.PROCS)) return `No active processes`
  return a.joinLines([
    `Active processes (pid, name, status):`,
    ...a.map(os.PROCS, procToStatus),
  ])
}


// Initialize features that require user action.
async function cmdInit(sig) {
  await fs.initProgressFile(sig)
  await fs.initHistoryDir(sig)
  return `all features initialized`
}

// Deinitialize features and stop all processes.
async function cmdDeinit(sig) {
  const procs = os.PROCS

  for (const key in procs) {
    procs[key].deinit()
    delete procs[key]
  }

  return a.joinLinesLax([
    `All processes stopped`,
    await fs.deinitProgressFile(sig),
    await fs.deinitHistoryDir(sig),
  ])
}

// Show status of features and processes.
async function cmdStatus(sig) {
  return a.joinLinesLax([
    await fs.statusProgressFile(sig),
    await fs.statusHistoryDir(sig),
    showProcs(),
  ])
}


/*
We render the top-level elements exactly once. Any further UI updates must be
done via observables and reactive elements such as `u.reac`. (And sometimes
with direct manipulation.)
*/
E(
  document.body,
  {class: `dark:bg-gray-900 dark:text-gray-100 flex flex-col h-screen overflow-hidden`},
  TITLEBAR,
  MIDDLE,
  PROMPT,
)

// Remove loading style.
document.getElementById(`loading_style`)?.remove()

/*
Add a global keyboard shortcut for focusing the command prompt.

Goal: focus the command prompt when the focusing key is pressed, but only if not
already in an input field.
*/
document.addEventListener(`keydown`, function focusPromptOnSlash(eve) {
  if (eve.key !== PROMPT_FOCUS_KEY) return
  if (a.findAncestor(eve.target, u.isElemInput)) return
  // Prevent the prompt-focusing character from being typed.
  a.eventKill(eve)
  PROMPT_INPUT.focus()
})

// Add some initial log messages.
u.log.inf(`welcome to Tabularius`)
u.log.inf(`type "help" for a list of commands`)

os.runCommand(`sync`)
os.runCommand(`analyze`)
os.runCommand(`help`)

await fs.loadHandles().catch(u.logErr)
await fs.maybeStartWatch().catch(u.logErr)

// Must always be at the very end of this file.
import * as module from './main.mjs'
window.tabularius.main = module
