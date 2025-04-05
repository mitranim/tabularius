import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as dr from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/dom_reg.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'
import * as os from './os.mjs'

import * as self from './ui.mjs'
const tar = window.tabularius ??= a.Emp()
tar.ui = self
a.patch(window, tar)

cmdMedia.cmd = `media`
cmdMedia.desc = `toggle media panel`

export function cmdMedia() {MEDIA.toggle()}

// Increment by 1 when publishing an update.
const VERSION = 15
let INITED

/*
Should be called exactly once.

Any further UI updates must be done either via observables and reactive elements
such as `u.reac`/`u.ReacElem`, or via `u.E`/`u.ren`, or by manual manipulation
in very simple cases.
*/
export function init() {
  if (INITED) return

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
  INITED = true
}

export const TITLEBAR = E(
  `div`,
  {class: `flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800`},

  // Left side with title
  E(`h1`, {}, document.title),

  // Right side with links
  E(`div`, {class: `flex gap-4`},
    E(`span`, {class: `text-gray-600 dark:text-gray-400`}, `v` + VERSION),
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
      {class: a.spaced(MEDIA_CHI_CLS, MEDIA_CHI_PAD, `flex flex-col gap-2`)},
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
    E(`pre`, {class: `truncate font-medium flex-1 shrink-0`},
      src.id, `: `, src.args,
    ),
    // TODO: place description on its own line (under).
    a.vac(src.desc && undefined) && E(
      `pre`,
      {class: `truncate text-sm text-gray-500 dark:text-gray-500`},
      `(`, src.desc, `)`,
    ),
    a.vac(src.startAt) && E(
      `pre`,
      {class: `truncate text-sm text-gray-500 dark:text-gray-500`},
      u.timeFormat.format(src.startAt),
    ),
    a.vac(src.id) && BtnKill({
      onclick() {os.runCmd(`kill ` + src.id).catch(u.logErr)},
    }),
  )
}

function BtnKill({class: cls, ...attrs}) {
  return E(`button`, {
    type: `button`,
    class: a.spaced(
      `w-8 h-8 text-center align-middle leading-none bg-red-500 text-white rounded hover:bg-red-600`,
      cls,
    ),
    ...attrs
  }, `✕`)
}

const MEDIA_CHI_CLS = `border border-gray-300 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800`
const MEDIA_CHI_PAD = `p-4`

export const MEDIA_PLACEHOLDER = E(`div`, {class: a.spaced(MEDIA_CHI_CLS, `flex flex-col gap-4`)},
  E(`div`, {class: `text-center`}, `Sample Plot`),
  E(`div`, {class: `h-64 flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded bg-white dark:bg-gray-700`},
    E(`div`, {class: `text-gray-500 dark:text-gray-400`}, `[Plot Placeholder]`)
  )
)

export const MEDIA = new class MediaPanel extends u.Elem {
  constructor() {
    super()
    E(this, {class: `flex-1 min-w-0 min-h-full w-full overflow-y-auto flex flex-col gap-4 p-4 bg-white dark:bg-gray-900`},
      MEDIA_PLACEHOLDER,
      PROCESS_LIST,
    )
  }

  add(val) {
    a.reqElement(val)
    val.classList.add(...u.splitCliArgs(MEDIA_CHI_CLS), `relative`)
    val.appendChild(BtnKill({
      class: `absolute top-2 right-2`,
      onclick() {MEDIA.delete(val)},
    }))
    MEDIA_PLACEHOLDER.remove()
    this.prepend(val)
    this.append(PROCESS_LIST)
  }

  delete(val) {
    val.remove()
    if (this.children.length <= 1) this.prepend(MEDIA_PLACEHOLDER)
  }

  clear() {E(this, {}, undefined)}

  // Too fragile, TODO simplify.
  isDefault() {
    return (
      this.childElementCount === 2 &&
      MEDIA_PLACEHOLDER.parentNode === this &&
      PROCESS_LIST.parentNode === this
    )
  }
}()

export const MIDDLE = E(`div`, {class: `flex flex-1 min-h-0`}, u.log, MEDIA)

export const PROMPT_FOCUS_KEY = `/`
export const PROMPT_HIST_KEY = `tabularius.prompt_hist`
export const PROMPT_HIST_MAX = 256

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
    this.placeholder = `type a command (try "help"; press ${a.show(PROMPT_FOCUS_KEY)} to focus)`
  }

  onKeydown(eve) {
    if (eve.key === `ArrowUp`) {
      a.eventKill(eve)
      this.histPrev()
      return
    }

    if (eve.key === `ArrowDown`) {
      a.eventKill(eve)
      this.histNext()
      return
    }

    if (eve.key === `Enter`) {
      a.eventKill(eve)
      this.cmdSubmit()
      return
    }

    // Lets the user spam the prompt-focusing key without fear of repercussion.
    if (eve.key === PROMPT_FOCUS_KEY && !this.value) {
      a.eventKill(eve)
    }
  }

  // Command submission (on Enter).
  cmdSubmit() {
    const src = this.value.trim()
    if (!src) return
    u.log.info(src)
    this.histPush(src)
    os.runCmd(src).catch(u.logErr)
  }

  hist = a.laxArr(
    histDecode(sessionStorage.getItem(PROMPT_HIST_KEY)) ??
    histDecode(localStorage.getItem(PROMPT_HIST_KEY))
  )
  histInd = this.hist.length
  histPrompt = ``

  histPush(val) {
    val = a.trim(val)
    if (!val) return
    histStore(sessionStorage, this.hist, val)
    histStore(localStorage, histDecode(localStorage.getItem(PROMPT_HIST_KEY)), val)
    this.histInd = this.hist.length
    this.value = this.histPrompt = ``
  }

  histPrev() {
    a.reqArr(this.hist)
    a.reqNat(this.histInd)
    if (!this.hist.length) return
    if (!this.histInd) return
    if (this.histInd === this.hist.length) this.histPrompt = this.value
    this.value = this.hist[--this.histInd]
  }

  histNext() {
    a.reqArr(this.hist)
    a.reqNat(this.histInd)
    if (!(this.histInd < this.hist.length)) return
    this.value = this.hist[++this.histInd] ?? this.histPrompt
  }

  histClear() {
    this.hist = []
    this.histInd = 0
    this.value = ``
    u.storageSet(sessionStorage, PROMPT_HIST_KEY)
  }
}

function histStore(store, hist, val) {
  a.reqValidStr(val)
  if (val === a.last(hist)) return
  hist = a.laxArr(hist)
  hist.push(val)
  hist = validPromptHist(hist)
  u.storageSet(store, PROMPT_HIST_KEY, histEncode(hist))
}

function validPromptHist(src) {
  src = a.onlyArr(src) ?? []
  const ind = src.length - PROMPT_HIST_MAX
  return ind > 0 ? src.slice(ind) : src
}

function histDecode(src) {return a.isNil(src) ? src : a.lines(src)}
function histEncode(src) {return a.joinLines(src)}

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
  id: `input`,
})

export const PROMPT = E(
  `div`,
  {class: `p-4 bg-gray-200 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700`},
  E(`div`, {class: `flex items-center`},
    E(`span`, {class: `text-green-600 dark:text-green-400`}, `>`),
    PROMPT_INPUT,
  )
)
