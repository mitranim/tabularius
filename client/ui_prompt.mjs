import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as o from '@mitranim/js/obs.mjs'
import {E} from './ui_util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'

// SYNC[prompt_focus_key].
export const PROMPT_FOCUS_KEY = `/`
export const PROMPT_HIST_KEY = `tabularius.prompt_hist`
export const PROMPT_HIST_MAX = 256

const PROMPT_INPUT_CLS_REGULAR = `focus:ring-blue-500 dark:focus:ring-blue-400`
const PROMPT_INPUT_CLS_PASSWORD = `focus:ring-green-500 dark:focus:ring-green-400`

/*
The vertical padding should be large enough to prevent browser href previews
from completely overlaying the prompt text. When hovering links, some browsers
show a preview of the href in the bottom left corner, which can visually
interfere with our prompt. We have links in abundance; see `FakeBtnInline`
which is used all over the place.
*/
const CLS_PROMPT_INPUT = a.spaced(
  `w-full pl-8 pr-4 py-4 bg-transparent resize-none overflow-clip`,
  // SYNC[bord-color].
  `shadow-[inset_0_1px_0_0_#d1d5db] dark:shadow-[inset_0_1px_0_0_#404040]`,
  `outline-none focus:outline-none focus:shadow-none focus:ring-2 focus:ring-inset focus:rounded`,
)

export const PROMPT_INPUT = new class PromptInput extends dr.MixReg(HTMLInputElement) {
  unlistenGlobal = undefined

  constructor() {
    super()
    E(this, {
      id: `prompt`, type: `text`, autofocus: true, autocomplete: `off`,
      class: a.spaced(CLS_PROMPT_INPUT, PROMPT_INPUT_CLS_REGULAR),
    })
  }

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
      ui.LOG.err(`internal: unexpected attempt to submit a command in password mode`)
      return
    }

    const src = this.value.trim()
    if (!src) return

    const obs = o.obs({proc: undefined})
    ui.LOG.inp(new SubmittedCmd(src, obs))
    this.histPush(src)
    os.runCmd(src, {obs, user: true}).catch(ui.logErr)
  }

  enablePassMode() {
    if (this.type === `password`) return

    this.value = ``
    this.type = `password`
    this.autocomplete = `on`
    ui.replaceCls(this, PROMPT_INPUT_CLS_REGULAR, PROMPT_INPUT_CLS_PASSWORD)

    if (document.activeElement === this) this.onFocus()
    else this.focus()

    this.clearGlobalListener()
    this.unlistenGlobal = u.listenEvent(document, `keydown`, this)
  }

  disablePassMode() {
    if (!(this.type === `password`)) return

    this.value = ``
    this.type = `text`
    this.autocomplete = `off`
    ui.replaceCls(this, PROMPT_INPUT_CLS_PASSWORD, PROMPT_INPUT_CLS_REGULAR)
    this.onBlur()

    this.clearGlobalListener()
    u.dispatch(this, `disable_pass_mode`)
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

  addSpaced(pre, suf) {
    a.reqValidStr(pre)
    a.optStr(suf)
    if (this.value) this.value = a.spaced(a.trim(this.value), a.trim(suf))
    else this.value = a.spaced(a.trim(pre), a.trim(suf))
    this.focus()
  }

  clearGlobalListener() {this.unlistenGlobal = this.unlistenGlobal?.()}
}()

export const PROMPT = E(
  `div`,
  {
    class: a.spaced(
      ui.CLS_BG_1,
      ui.CLS_BORD,
      `flex row-bet-str relative`,
    ),
  },
  E(
    `span`,
    {class: a.spaced(
      `flex row-cen-cen text-green-600 dark:text-green-400`,
      `absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none`
    )},
    ui.PROMPT_PREFIX,
  ),
  PROMPT_INPUT,
)

class SubmittedCmd extends ui.ReacElem {
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
        ui.Muted(
          `(`, a.vac(proc.desc) || `running`, `; `, os.BtnCmd(`kill ${proc.id}`), `)`
        ),
      ],
    )
  }
}

export function BtnPrompt({full, cmd, suf, chi, eph, ...opt}) {
  a.optBool(full)
  a.reqValidStr(cmd)
  a.optStr(suf)
  a.optStr(eph)

  chi ??= [
    a.vac(full) && cmd,
    a.vac(full && cmd && (suf || eph)) && ` `,
    suf,
    a.vac(eph) && ui.Muted(eph),
  ]
  return BtnPromptAppend({pre: cmd, suf, chi, ...opt})
}

export function BtnPromptAppend({pre, suf, chi, ...opt}) {
  a.reqValidStr(pre)
  a.optStr(suf)

  return ui.FakeBtnInline({
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

  return ui.FakeBtnInline({
    onclick(eve) {
      a.eventKill(eve)
      PROMPT_INPUT.value = val
      PROMPT_INPUT.focus()
    },
    href: `?run=` + val,
    chi: chi ?? val,
  })
}

// Shortcut for focusing the prompt input.
export function onKeydownFocusPrompt(eve) {
  if (
    eve.key === PROMPT_FOCUS_KEY &&
    !a.findAncestor(eve.target, ui.isElemInput)
  ) {
    // Prevent the prompt-focusing character from being typed.
    a.eventKill(eve)
    PROMPT_INPUT.focus()
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
