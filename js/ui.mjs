import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as o from '@mitranim/js/obs.mjs'
import * as u from './util.mjs'
import {E} from './util.mjs'
import * as os from './os.mjs'

import * as self from './ui.mjs'
const tar = window.tabularius ??= a.Emp()
tar.ui = self
a.patch(window, tar)

// Increment by 1 when publishing an update.
const VERSION = 31
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
  document.addEventListener(`keydown`, onKeydownGlobal)
  INITED = true
}

const tarblan = Object.freeze({
  target: `_blank`,
  rel: `noopener noreferrer`,
})

export const TITLEBAR = E(
  `div`,
  {class: `flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800`},

  // Left side with title.
  E(`h1`, {}, `Tabularius — book-keeper for `,
    E(`a`, {href: `https://store.steampowered.com/app/3226530`, ...tarblan, class: u.INLINE_BTN_CLS},
      `Tower Dominion`,
    ),
  ),

  // Right side with links.
  // TODO: add Steam link.
  // TODO: collapse into icons.
  E(`div`, {class: `flex gap-4`},
    E(`span`, {class: `text-gray-600 dark:text-gray-400`}, `v` + VERSION),
    E(`a`, {href: `https://github.com/mitranim/tabularius`, ...tarblan, class: `text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200`}, `GitHub`),
    E(`a`, {href: `https://discord.gg/upPxCEVxgD`, ...tarblan, class: `text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200`}, `Discord`)
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
      {class: `truncate text-sm text-gray-500 dark:text-gray-400`},
      `(`, u.callOpt(src.desc), `)`,
    ),
    a.vac(src.startAt) && E(
      `pre`,
      {class: `truncate text-sm text-gray-500 dark:text-gray-400`},
      u.timeFormat.format(src.startAt),
    ),
    a.vac(src.id) && BtnKill({
      onclick() {os.runCmd(`kill ` + src.id).catch(u.logErr)},
    }),
  )
}

export function BtnKill({class: cls, ...attrs}) {
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

export const MEDIA_PLACEHOLDER = E(`div`, {class: a.spaced(MEDIA_CHI_CLS, `flex flex-col`)},
  E(`div`, {class: `text-center p-2`}, `Sample Plot`),
  E(`div`, {class: `h-64 flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded bg-white dark:bg-gray-700`},
    E(`div`, {class: `w-full text-center text-gray-500 dark:text-gray-400`}, `[Plot Placeholder]`)
  )
)

export const MEDIA = new class MediaPanel extends u.Elem {
  constructor() {
    super()
    E(this, {class: `flex-1 min-w-0 min-h-full w-full overflow-y-auto break-words overflow-wrap-anywhere flex flex-col gap-4 p-4 bg-white dark:bg-gray-900`})
    this.clear()
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

  clear() {E(this, {}, MEDIA_PLACEHOLDER, PROCESS_LIST)}

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
polyfill in some browsers. Our `index.html` should import
`https://github.com/ungap/custom-elements`.
*/
class PromptInput extends dr.MixReg(HTMLInputElement) {
  connectedCallback() {
    this.onBlur()
    this.onfocus = this.onFocus
    this.onblur = this.onBlur
    this.onkeydown = this.onKeydown
  }

  onFocus() {
    this.placeholder = `type a command (try "help" or "help <cmd>", ↑↓ for history)`
  }

  onBlur() {
    this.placeholder = `type a command (try "help" or "help <cmd>"; press ${a.show(PROMPT_FOCUS_KEY)} to focus)`
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

    // Lets the user spam the prompt-focusing key without fear.
    if (eve.key === PROMPT_FOCUS_KEY && !this.value) {
      a.eventKill(eve)
    }
  }

  // Command submission (on Enter).
  cmdSubmit() {
    const src = this.value.trim()
    if (!src) return

    const obs = o.obs({proc: undefined})
    u.logMsgFlash(u.log.info(new SubmittedCmd(src, obs)))
    this.histPush(src)
    os.runCmd(src, obs).catch(u.logErr)
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

  addSpaced(pre, suf) {
    if (a.reqValidStr(suf))
    if (a.reqValidStr(pre))
    if (this.value) this.value = a.spaced(a.trim(this.value), a.trim(suf))
    else this.value = a.spaced(a.trim(pre), a.trim(suf))
    this.focus()
  }
}

class SubmittedCmd extends u.ReacElem {
  constructor(src, obs) {
    super()
    this.src = a.reqValidStr(src)
    this.obs = a.reqObj(obs)
  }

  run() {
    const {src, obs: {proc}} = this
    E(this, {},
      src,
      a.vac(proc) && [
        ` `,
        E(`span`, {class: `text-gray-500 dark:text-gray-400`},
          `(`, a.vac(proc.desc) || `running`, `; `, os.BtnCmd(`kill ${proc.id}`), `)`
        )
      ],
    )
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

function onKeydownGlobal(eve) {
  /*
  Shortcut for clearing the log. Seems consistent with existing precedent in:
    - MacOS Terminal.
    - Windows Terminal (the good one and the bad one).
    - Chrome devtools on MacOS.
    - Chrome devtools on Windows.
  TODO: what about Linux?
  */
  if (
    (eve.key === `k` && !eve.altKey && !eve.ctrlKey && eve.metaKey && !eve.shiftKey) ||
    (eve.key === `l` && !eve.altKey && eve.ctrlKey && !eve.metaKey && !eve.shiftKey)
  ) {
    a.eventKill(eve)
    u.log.clear()
    PROMPT_INPUT.focus()
    return
  }

  // Shortcut for focusing the prompt input.
  if (
    eve.key === PROMPT_FOCUS_KEY &&
    !a.findAncestor(eve.target, u.isElemInput)
  ) {
    // Prevent the prompt-focusing character from being typed.
    a.eventKill(eve)
    PROMPT_INPUT.focus()
  }
}

// TODO: avoid wasting space, remove the parent's padding.
// Need to convert this element's outline to a border.
export const PROMPT_INPUT = E(new PromptInput(), {
  class: `w-full p-2 bg-transparent resize-none overflow-hidden dark:text-gray-200 outline-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded p-2`,
  autofocus: true,
  id: `input`,
})

export const PROMPT = E(
  `div`,
  {class: `flex items-center p-2 bg-gray-200 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700`},
  E(`span`, {class: `text-green-600 dark:text-green-400`}, `>`),
  PROMPT_INPUT,
)

export function BtnPrompt(src) {
  const [head, ...tail] = u.splitCliArgs(src)
  return BtnPromptAppend(head, tail.join(` `), src)
}

export function BtnPromptAppend(pre, suf, alias) {
  a.reqValidStr(pre)
  a.reqValidStr(suf)
  a.optStr(alias)

  return E(
    `button`,
    {
      type: `button`,
      class: u.INLINE_BTN_CLS,
      onclick() {PROMPT_INPUT.addSpaced(pre, suf)},
    },
    alias || suf,
  )
}

cmdClear.cmd = `clear`
cmdClear.desc = `clear log and/or media`
cmdClear.help = function cmdClearHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdClear.desc),
    u.LogLines(
      `flags:`,
      [`  `, ui.BtnPromptAppend(`clear`, `-l`), ` -- clear only the log`],
      [`  `, ui.BtnPromptAppend(`clear`, `-m`), ` -- clear only the media`],
    ),
    u.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`clear`)],
      [`  `, os.BtnCmd(`clear -l`)],
      [`  `, os.BtnCmd(`clear -m`)],
    ),
    [E(`b`, {}, `pro tip`), `: can also clear the log by pressing "ctrl+l" or "cmd+k"`],
  )
}

export function cmdClear({args}) {
  args = u.splitCliArgs(args)
  const log = u.arrRemoved(args, `-l`)
  const media = u.arrRemoved(args, `-m`)

  switch (args.length) {
    case 1:
    case 2: break
    default: return os.cmdHelpDetailed(cmdClear)
  }

  if (log || !media) u.log.clear()
  if (media || !log) MEDIA.clear()
}
