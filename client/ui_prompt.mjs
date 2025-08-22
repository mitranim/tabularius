import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import {E} from './ui_util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'

export const PROMPT_HIST_KEY = `tabularius.prompt_hist`
export const PROMPT_HIST_MAX = 256

const PROMPT_INPUT_CLS_REGULAR = `focus:ring-blue-500 dark:focus:ring-blue-400`
const PROMPT_INPUT_CLS_PASSWORD = `focus:ring-green-500 dark:focus:ring-green-400`

/*
The vertical padding should be large enough to prevent browser href previews
from completely overlaying the prompt text. When hovering links, some browsers
show a preview of the href in the bottom left corner, which can visually
interfere with our prompt. We have links in abundance; see `LinkBtnInline`
which is used all over the place.

The left padding must compensate for the prefix.
*/
const CLS_PROMPT_INPUT = a.spaced(
  `w-full pl-8 pr-3 py-4 bg-transparent resize-none overflow-clip`,
  // SYNC[bord-color].
  `shadow-[inset_0_1px_0_0_#d1d5db] dark:shadow-[inset_0_1px_0_0_#404040]`,
  `outline-none focus:outline-none focus:shadow-none focus:ring-2 focus:ring-inset`,
)

export const PROMPT_INPUT = new class PromptInput extends dr.MixReg(HTMLInputElement) {
  listener = new a.ListenRef({self: this, src: document, type: `keydown`, fun: this.onKeydown})

  constructor() {
    super()

    E(this, {
      id: `prompt`, type: `text`, autofocus: true, autocomplete: `off`,
      class: a.spaced(CLS_PROMPT_INPUT, PROMPT_INPUT_CLS_REGULAR),
    })

    this.onfocus = this.onFocus
    this.onblur = this.onBlur
    this.onkeydown = this.onKeydown
    this.onBlur()
  }

  disconnectedCallback() {this.listener.deinit()}

  onFocus() {
    if (this.type === `password`) {
      this.placeholder = `type a passphrase/password or press Esc to cancel`
    }
    else {
      this.placeholder = `type a command (try "help" or "help <some_cmd>"; ↑↓ for history)`
    }
  }

  onBlur() {
    if (this.type === `password`) {
      this.placeholder = `type a passphrase/password or press Esc to cancel`
    }
    else {
      this.placeholder = `type a command (try "help" or "help <some_cmd>"; Esc to focus)`
    }
  }

  onKeydown(eve) {
    if (eve.key === `Escape`) {
      if (this.type === `password`) {
        a.eventKill(eve)
        this.disablePassMode()
      }
      return
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
  }

  onSubmit() {
    if (this.type === `password`) return this.submitPass()
    return this.submitCmd()
  }

  submitPass() {a.eventDispatch({src: this, type: `submit_pass`})}

  // Command submission (on Enter).
  submitCmd() {
    if (this.type === `password`) {
      ui.LOG.err(`internal: unexpected attempt to submit a command in password mode`)
      return
    }

    const src = this.value.trim()
    if (!src) return

    const obs = a.obsRef()
    ui.LOG.inp(a.bind(SubmittedCmd, src, obs))

    this.histPush(src)
    os.runCmd(src, {obs, user: true}).catch(ui.logErr)
  }

  enablePassMode() {
    if (this.type === `password`) return

    this.value = ``
    this.type = `password`
    this.autocomplete = `on`
    ui.clsReplace(this, PROMPT_INPUT_CLS_REGULAR, PROMPT_INPUT_CLS_PASSWORD)

    if (document.activeElement === this) this.onFocus()
    else this.focus()

    this.listener.init()
  }

  disablePassMode() {
    if (this.type !== `password`) return

    this.value = ``
    this.type = `text`
    this.autocomplete = `off`
    ui.clsReplace(this, PROMPT_INPUT_CLS_PASSWORD, PROMPT_INPUT_CLS_REGULAR)
    this.onBlur()

    this.listener.deinit()
    a.eventDispatch({src: this, type: `disable_pass_mode`})
  }

  hist = a.laxArr(histDecode(u.storagesGet(PROMPT_HIST_KEY)))
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
}()

const PROMPT_PRE = E(`span`, {
  class: a.spaced(
    `absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none`,
    `flex row-cen-cen`,
    ui.CLS_FG_GREEN,
  ),
  chi: ui.PROMPT_PREFIX,
})

const PROMPT_BTN = ui.withTooltip({
  chi: `submit command`,
  help: false,
  under: false,
  inheritSize: false,
  elem: E(`button`, {
    class: a.spaced(
      `h-full w-auto aspect-square`,
      `text-center align-middle leading-none text-2xl`,
      ui.CLS_BUSY_BTN_NEUT,
    ),
    type: `button`,
    onclick() {
      PROMPT_INPUT.onSubmit()
      PROMPT_INPUT.focus()
    },
    chi: `⏎`,
  }),
})

export const PROMPT = E(`div`, {
  class: a.spaced(
    ui.CLS_BG_1,
    ui.CLS_BORD,
    `flex row-bet-str relative`,
  ),
  chi: [
    PROMPT_PRE,
    PROMPT_INPUT,
    PROMPT_BTN,
  ],
})

function SubmittedCmd(src, obs) {
  a.reqValidStr(src)
  const proc = a.optInst(a.deref(obs), os.Proc)
  if (!proc) return src

  return [
    src,
    ` `,
    ui.Muted(
      `(`, a.vac(proc.desc) || `running`, `; `, os.BtnCmd(`kill ${proc.id}`), `)`,
    ),
  ]
}

export function BtnPrompt({cmd, suf, eph, chi, full, replace, ...opt}) {
  a.reqValidStr(cmd)
  a.optStr(suf)
  a.optStr(eph)
  a.optBool(full)
  a.optBool(replace)

  if (full) replace ??= true

  const ephSpace = (full && !suf && eph) ? ` ` : ``
  const args = a.spaced(cmd, suf) + ephSpace

  return ui.LinkBtnInline({
    ...opt,
    onclick(eve) {
      a.eventKill(eve)
      PROMPT_INPUT.value = replace ? args : a.spaced(
        a.trim(PROMPT_INPUT.value) || cmd,
        suf,
      )
      PROMPT_INPUT.focus()
    },
    href: `?run=` + args,
    chi: chi ?? [
      a.vac(full) && cmd,
      a.vac(full && suf) && ` `,
      suf,
      ephSpace,
      a.vac(eph) && ui.Muted(eph),
    ],
  })
}

export function BtnPromptReplace(args) {
  const [cmd, ...rest] = u.splitCliArgs(args)

  return BtnPrompt({
    cmd,
    suf: a.vac(rest) && a.spaced(...rest),
    full: true,
  })
}

// https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
export const MODIFIER_KEYS = new Set([
  `Alt`, `AltGraph`, `CapsLock`, `Control`, `Fn`, `FnLock`, `Hyper`,
  `Meta`, `NumLock`, `ScrollLock`, `Shift`, `Super`, `Symbol`, `SymbolLock`,
])

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
