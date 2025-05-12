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
const VERSION = 66
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
    {class: `bg-gray-100 text-black dark:bg-dark-root dark:text-white flex flex-col h-screen overflow-clip`},
    TITLEBAR,
    MIDDLE,
    PROMPT,
  )

  document.getElementById(`loading_style`)?.remove()
  document.getElementById(`loading_msg`)?.remove()
  document.addEventListener(`keydown`, onKeydownGlobal)
  INITED = true
}

export const TARBLAN = Object.freeze({
  target: `_blank`,
  rel: `noopener noreferrer`,
})

const TITLEBAR_PAD = `p-2`
const TITLEBAR_ICON_SIZE = `w-6 h-6`
const TITLEBAR_LINK_CLS = a.spaced(`flex row-cen-cen`, TITLEBAR_PAD)
const TITLEBAR_ICON_CLS = a.spaced(TITLEBAR_ICON_SIZE, `hover:scale-[1.2]`)

const GITHUB_LINK = `https://github.com/mitranim/tabularius`
const STEAM_LINK = `https://store.steampowered.com/app/3226530`

// SYNC[discord_link].
const DISCORD_LINK = `https://discord.gg/upPxCEVxgD`

export const TITLEBAR = E(
  `div`,
  {class: `flex justify-between items-center gap-2 border-b border-gray-300 dark:border-neutral-700 bg-gray-200 dark:bg-dark-base`},

  // Left side with title.
  E(
    `h1`,
    {class: a.spaced(`flex-1`, TITLEBAR_PAD)},
    E(`a`, {href: u.URL_CLEAN, class: u.CLS_BTN_INLINE}, `Tabularius`),
    ` — book-keeper for `,
    E(`a`, {href: STEAM_LINK, ...TARBLAN, class: u.CLS_BTN_INLINE},
      `Tower Dominion`,
    ),
  ),

  // Right side with links.
  E(`div`, {class: `flex items-center`},
    E(`span`, {class: a.spaced(TITLEBAR_LINK_CLS, u.CLS_TEXT_GRAY)}, `v` + VERSION),
    E(`a`, {href: GITHUB_LINK, ...TARBLAN, class: TITLEBAR_LINK_CLS},
      u.Svg(`github`, {class: a.spaced(TITLEBAR_ICON_CLS, `text-[#1f2328] dark:text-[#f0f6fc]`)}),
    ),
    E(`a`, {href: STEAM_LINK, ...TARBLAN, class: TITLEBAR_LINK_CLS},
      u.Svg(`steam`, {class: TITLEBAR_ICON_CLS}),
    ),
    E(`a`, {href: DISCORD_LINK, ...TARBLAN, class: TITLEBAR_LINK_CLS},
      u.Svg(`discord`, {class: TITLEBAR_ICON_CLS}),
    ),
  ),
)

const MEDIA_CHI_CLS = `border border-gray-300 dark:border-neutral-700 rounded bg-gray-100 dark:bg-dark-base overflow-x-clip`
const MEDIA_CHI_PAD = `p-4`

export const PLOT_PLACEHOLDER = new class PlotPlaceholder extends u.ReacElem {
  state = o.obs({count: 0})

  run() {
    const {count} = this.state
    const placeholder = `[Plot Placeholder]`

    E(
      this,
      {class: a.spaced(MEDIA_CHI_CLS, `flex flex-col`)},
      E(`div`, {class: `text-center p-2`},
        count ? `Plots loading...` : placeholder,
      ),
      E(
        `div`,
        {class: `h-64 flex row-cen-cen border border-gray-400 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700`},
        E(
          `div`,
          {class: a.spaced(u.CLS_TEXT_GRAY, `w-full text-center`)},
          count ? [`Loading `, count, ` plots...`] : placeholder,
        )
      )
    )
  }
}

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
        : E(`div`, {class: `text-gray-500 dark:text-neutral-500`}, `no active processes`)
      )
    )
  }
}()

/*
Holds all dynamically added media items.
The styling is done in CSS. See `index.html`.
*/
export const MEDIA_GRID = E(`div`, {class: `media-grid`})

export const MEDIA = new class MediaPanel extends u.Elem {
  constructor() {
    super()
    E(
      this,
      {class: a.spaced(
        `flex-1 min-w-0 min-h-full w-full`,
        `p-4 gap-4 flex col-sta-str`,
        `overflow-y-auto overflow-x-clip break-words overflow-wrap-anywhere`,
      )},
      MEDIA_GRID, PLOT_PLACEHOLDER, PROCESS_LIST,
    )
  }

  add(val) {
    a.reqElement(val)
    u.addClasses(val, MEDIA_CHI_CLS)

    const onclick = () => {this.delete(val)}
    const btn = BtnKill({onclick})

    if (a.hasMeth(val, `addCloseBtn`)) {
      val.addCloseBtn(btn)
    }
    else {
      val.classList.add(`relative`)
      btn.classList.add(`absolute`, `top-2`, `right-2`)
      val.appendChild(btn)
    }

    PLOT_PLACEHOLDER.remove()
    MEDIA_GRID.prepend(val)
  }

  delete(val) {
    if (!a.optElement(val)) return
    if (val.parentNode !== MEDIA_GRID) return
    val.remove()
    this.updatePlaceholder()
  }

  clear() {
    E(MEDIA_GRID, {}, undefined)
    this.updatePlaceholder()
  }

  updatePlaceholder() {
    if (this.isDefault()) {
      this.insertBefore(PLOT_PLACEHOLDER, PROCESS_LIST)
    } else {
      PLOT_PLACEHOLDER.remove()
    }
  }

  isDefault() {return !MEDIA_GRID.children.length}
}()

function Process(src) {
  a.reqInst(src, os.Proc)
  const cls = a.spaced(u.CLS_TEXT_GRAY, `truncate text-sm`)

  return E(`div`, {class: `flex row-bet-cen gap-2`},
    E(`pre`, {class: `truncate font-medium flex-1 shrink-0`},
      src.id, `: `, src.args,
    ),
    // TODO: place description on its own line (under).
    a.vac(src.desc && undefined) && E(
      `pre`,
      {class: cls},
      `(`, u.callOpt(src.desc), `)`,
    ),
    a.vac(src.startAt) && E(
      `pre`,
      {class: cls},
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
      `w-6 h-6 text-center align-middle leading-none bg-red-500 text-white rounded hover:bg-red-600`,
      cls,
    ),
    ...attrs
  }, `✕`)
}

export const MIDDLE = E(`div`, {class: `flex flex-1 min-h-0`}, u.log, MEDIA)

export const PROMPT_FOCUS_KEY = `/`
export const PROMPT_HIST_KEY = `tabularius.prompt_hist`
export const PROMPT_HIST_MAX = 256

class PromptInput extends dr.MixReg(HTMLInputElement) {
  unlistenGlobal = undefined

  connectedCallback() {
    this.onBlur()
    this.onfocus = this.onFocus
    this.onblur = this.onBlur
    this.onkeydown = this.onKeydown
  }

  disconnectedCallback() {this.clearGlobalListener()}

  onFocus() {
    if (this.type === `password`) {
      this.placeholder = `type a passphrase/password or press Esc to cancel`
    }
    else {
      this.placeholder = `type a command (try "help" or "help <cmd>", ↑↓ for history)`
    }
  }

  onBlur() {
    if (this.type === `password`) {
      this.placeholder = `type a passphrase/password or press Esc to cancel; press ${a.show(PROMPT_FOCUS_KEY)} to focus`
    }
    else {
      this.placeholder = `type a command (try "help" or "help <cmd>"; press ${a.show(PROMPT_FOCUS_KEY)} to focus)`
    }
  }

  onKeydown(eve) {
    if (eve.key === `Escape`) {
      this.clearGlobalListener()
      if (this.type === `password`) {
        a.eventKill(eve)
        this.disablePassMode()
        return
      }
    }

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
      this.onSubmit()
      return
    }

    // Lets the user spam the prompt-focusing key.
    if (eve.key === PROMPT_FOCUS_KEY && !this.value) {
      a.eventKill(eve)
    }
  }

  handleEvent(eve) {if (eve.type === `keydown`) this.onKeydown(eve)}

  onSubmit() {
    if (this.type === `password`) return this.submitPass()
    return this.submitCmd()
  }

  submitPass() {u.dispatch(this, `submit_pass`)}

  // Command submission (on Enter).
  submitCmd() {
    if (this.type === `password`) {
      u.log.err(`internal: unexpected attempt to submit a command in password mode`)
      return
    }

    const src = this.value.trim()
    if (!src) return

    const obs = o.obs({proc: undefined})
    u.log.inp(new SubmittedCmd(src, obs))
    this.histPush(src)
    os.runCmd(src, {obs, user: true}).catch(u.logErr)
  }

  enablePassMode() {
    if (this.type === `password`) return

    this.type = `password`
    this.value = ``

    u.replaceClasses(this, PROMPT_INPUT_CLS_REGULAR, PROMPT_INPUT_CLS_PASSWORD)

    if (document.activeElement === this) this.onFocus()
    else this.focus()

    this.clearGlobalListener()
    this.unlistenGlobal = u.listenEvent(document, `keydown`, this)
  }

  disablePassMode() {
    if (!(this.type === `password`)) return

    this.value = ``
    this.type = `text`
    u.replaceClasses(this, PROMPT_INPUT_CLS_PASSWORD, PROMPT_INPUT_CLS_REGULAR)
    this.onBlur()

    this.clearGlobalListener()
    u.dispatch(this, `disable_pass_mode`)
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

  clearGlobalListener() {this.unlistenGlobal = this.unlistenGlobal?.()}
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
        E(`span`, {class: u.CLS_TEXT_GRAY},
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
    (eve.key === `k` && !eve.altKey && eve.ctrlKey && !eve.metaKey && !eve.shiftKey)
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

const PROMPT_INPUT_CLS_REGULAR = `focus:ring-blue-500 dark:focus:ring-blue-400`
const PROMPT_INPUT_CLS_PASSWORD = `focus:ring-green-500 dark:focus:ring-green-400`

// TODO: avoid wasting space, remove the parent's padding.
export const PROMPT_INPUT = E(new PromptInput(), {
  id: `input`,
  type: `text`,
  autofocus: true,
  class: a.spaced(
    `w-full p-2 bg-transparent resize-none overflow-clip dark:text-neutral-200 outline-none focus:outline-none focus:ring-2 rounded p-2`,
    PROMPT_INPUT_CLS_REGULAR,
  ),
})

export const PROMPT = E(
  `div`,
  {class: `flex items-center p-2 bg-gray-200 dark:bg-dark-base border-t border-gray-300 dark:border-neutral-700`},
  E(`span`, {class: `text-green-600 dark:text-green-400`}, `>`),
  PROMPT_INPUT,
)

export function BtnPrompt(src) {
  const [head, ...tail] = u.splitCliArgs(src)
  return BtnPromptAppend(head, tail.join(` `), src)
}

export function BtnPromptAppend(pre, suf, chi) {
  return BtnPromptAppendWith({pre, suf, chi})
}

export function BtnPromptAppendWith({pre, suf, chi, ...opt}) {
  a.reqValidStr(pre)
  a.reqValidStr(suf)

  return u.FakeBtnInline({
    ...opt,
    onclick(eve) {
      a.eventKill(eve)
      PROMPT_INPUT.addSpaced(pre, suf)
    },
    href: `?run=` + a.spaced(pre, suf),
    chi: chi ?? suf,
  })
}

export function BtnPromptReplace({val, chi}) {
  a.reqValidStr(val)

  return u.FakeBtnInline({
    onclick(eve) {
      a.eventKill(eve)
      PROMPT_INPUT.value = val
      PROMPT_INPUT.focus()
    },
    href: `?run=` + val,
    chi: chi ?? val,
  })
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
    [E(`b`, {}, `pro tip`), `: can also clear the log by pressing "ctrl+k" or "cmd+k"`],
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

const CLI_BOOL = new Set([``, `true`, `false`])

export function cliBool(cmd, flag, val) {
  a.reqValidStr(cmd)
  a.reqValidStr(flag)
  cliEnum(cmd, flag, val, CLI_BOOL)
  return !val || val === `true`
}

export function cliEnum(cmd, flag, val, coll) {
  a.reqValidStr(cmd)
  a.reqValidStr(flag)
  a.reqStr(val)

  if (coll.has(val)) return val

  throw new u.ErrLog(...u.LogLines(
    [`unrecognized `, BtnPromptAppend(cmd, u.cliEq(flag, val)), `, must be one of:`],
    ...a.map(
      a.keys(coll),
      key => BtnPromptAppend(cmd, u.cliEq(flag, key)),
    ).map(u.indentNode),
  ))
}
