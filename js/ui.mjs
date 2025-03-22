import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/all.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.61/dom_reg.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'
import * as os from './os.mjs'

import * as self from './ui.mjs'
window.tabularius ??= a.Emp()
window.tabularius.ui = self

export function cmdMedia() {MEDIA.toggle()}

let inited

/*
Should be called exactly once.

Any further UI updates must be done either via observables and reactive elements
such as `u.reac`/`u.ReacElem`, or via `u.E`/`u.ren`, or by manual manipulation
in very simple cases.
*/
export function init() {
  if (inited) return

  E(
    document.body,
    {class: `dark:bg-gray-900 dark:text-white flex flex-col h-screen overflow-hidden`},
    TITLEBAR,
    MIDDLE,
    PROMPT,
  )

  document.getElementById(`loading_style`)?.remove()
  document.getElementById(`loading_msg`)?.remove()

  /*
  Add a global keyboard shortcut for focusing the command prompt. Goal: focus
  the command prompt when the focusing key is pressed, but only if not already
  in an input field.
  */
  document.addEventListener(`keydown`, focusPromptOnSlash)
}

export const TITLEBAR = E(
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
export const PROCESS_LIST = new class ProcessList extends u.ReacElem {
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
      onclick: a.vac(src.id) && function onclick() {os.runCmd(`kill`, src.id)},
    }, `✕`),
  )
}

// For single-character or icon buttons.
// TODO convert to Tailwind classes.
export const STYLE_BTN_CEN = {
  width: `2rem`,
  height: `2rem`,
  textAlign: `center`,
  verticalAlign: `middle`,
  alignItems: `center`,
  lineHeight: `1`,
}

/*
Default children of the media panel, shown when not replaced by other content.
Could be defined as a list, but having a wrapper element makes us more flexible
at displaying replacement content, such as not forcing padding or a particular
layout.
*/
export const MEDIA_CHI_DEFAULT = E(
  `div`,
  {class: `flex flex-col gap-4 p-4 flex-1 min-w-0 bg-white dark:bg-gray-900 overflow-y-auto`},

  E(`div`, {}, `Media Panel`),

  // Example content - could be a chart, image, etc.
  E(`div`, {class: `border border-gray-300 dark:border-gray-700 rounded p-4 bg-gray-100 dark:bg-gray-800`},
    E(`div`, {class: `text-center`}, `Sample Chart`),
    E(`div`, {class: `h-64 flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded bg-white dark:bg-gray-700`},
      E(`div`, {class: `text-gray-500 dark:text-gray-400`}, `[Chart placeholder]`)
    )
  ),

  PROCESS_LIST,
)

export const MEDIA = new class MediaPanel extends u.Elem {
  constructor() {
    super()
    this.lastChi = undefined
    E(this, {class: `flex-1 min-w-0 min-h-full w-full overflow-y-auto`})
    this.setDefault()
  }

  setDefault() {
    E(this, {}, MEDIA_CHI_DEFAULT)
    this.isDefaultChi = true
  }

  set(...chi) {
    if (a.vac(chi)) {
      E(this, {}, chi)
      this.lastChi = chi
      this.isDefaultChi = false
    }
    else {
      this.setDefault()
    }
  }

  toggle() {
    if (this.isDefaultChi && a.vac(this.lastChi)) {
      E(this, {}, this.lastChi)
      this.isDefaultChi = false
    }
    else {
      this.setDefault()
    }
  }
}()

export const MIDDLE = E(`div`, {class: `flex flex-1 min-h-0`}, u.log, MEDIA)

export const PROMPT_FOCUS_KEY = `/`

/*
Subclassing a built-in element class which is NOT `HTMLElement` requires a
polyfill in some browsers. TODO use `https://github.com/ungap/custom-elements`.
*/
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
    os.runScript(src).catch(u.logErr)
  }
}

function focusPromptOnSlash(eve) {
  if (eve.key !== PROMPT_FOCUS_KEY) return
  if (a.findAncestor(eve.target, u.isElemInput)) return
  // Prevent the prompt-focusing character from being typed.
  a.eventKill(eve)
  PROMPT_INPUT.focus()
}

export const PROMPT_INPUT = E(new PromptInput(), {
  class: `w-full bg-transparent resize-none overflow-hidden dark:text-gray-200 outline-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded p-2 transition-all duration-150 ease-in-out`,
  autofocus: true,
})

export const PROMPT = E(
  `div`,
  {class: `p-4 bg-gray-200 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700`},
  E(`div`, {class: `flex items-center`},
    E(`span`, {class: `text-green-600 dark:text-green-400`}, `>`),
    PROMPT_INPUT,
  )
)
