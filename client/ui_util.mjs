import * as a from '@mitranim/js/all.mjs'
import * as p from '@mitranim/js/prax.mjs'
import * as ob from '@mitranim/js/obs.mjs'
import * as od from '@mitranim/js/obs_dom.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as u from './util.mjs'
import * as ui from './ui.mjs'

const tar = globalThis.tabularius ??= a.Emp()
tar.lib ??= a.Emp()
tar.lib.a = a
tar.lib.p = p
tar.lib.ob = ob
tar.lib.od = od
tar.lib.dr = dr
a.patch(globalThis, tar)

/*
Needed for `dr.MixReg`, which enables automatic registration of any custom
elements that we define.
*/
dr.Reg.main.setDefiner(customElements)

export class Ren extends p.Ren {
  mutCls(tar, val, key) {
    if (a.isNil(val)) return tar.removeAttribute(`class`)
    return super.mutCls(tar, ui.TWIND(a.reqStr(val)), key)
  }
}

// Main renderer.
export const REN = new Ren()
export const {E, S} = REN

// Base class for UI components with custom behaviors.
export class Elem extends dr.MixReg(HTMLElement) {}

/*
Base class for reactive, stateful UI components. The mixin `od.MixReacElem`
causes the element to automatically monitor observables and update on changes:

- On `.connectedCallback`, `.run` is invoked.
- Observables synchronously accessed during `.run` are automatically monitored.
- When monitored observables change, `.run` is invoked.
*/
export class ReacElem extends od.MixReacElem(Elem) {}

/*
Similar to `ReacElem`, but with support for multiple different callbacks,
which are expected to monitor multiple different observables. Subclasses
should define a property or getter `.runs` which must be an iterable with
multiple functions, usually methods from the prototype of the same class.
*/
export class ReacsElem extends od.MixReacsElem(Elem) {}

export const TARBLAN = Object.freeze({
  target: `_blank`,
  rel: `noopener noreferrer`,
})

export function delCls(tar, src) {
  tar.classList.remove(...splitClasses(src))
  return tar
}

export function addCls(tar, src) {
  return E(a.reqElement(tar), {class: a.spaced(tar.className, src)})
}

export function replaceCls(tar, prev, next) {
  delCls(tar, prev)
  return addCls(tar, next)
}

export function toggleCls(tar, ok, cls) {
  if (a.optBool(ok)) return addCls(tar, cls)
  return delCls(tar, cls)
}

function splitClasses(src) {return a.split(src, /\s+/)}

/*
Purpose: return true if the current element has its own handling of arbitrary
text input or arbitrary keystrokes.
*/
export function isElemInput(val) {
  return a.isElement(val) && (
    a.isInst(val, HTMLInputElement) ||
    a.isInst(val, HTMLTextAreaElement) ||
    a.isInst(val, HTMLSelectElement) ||
    val.contentEditable === `true` ||
    val.contentEditable === `plaintext-only` ||
    val.role === `textbox`
  )
}

/*
Usage:

  ui.darkModeMediaQuery.matches
  ui.darkModeMediaQuery.addEventListener(`change`, someListener)
  function someListener(eve) {console.log(eve.matches)}
*/
export const darkModeMediaQuery = globalThis.matchMedia(`(prefers-color-scheme: dark)`)

// By luck, the Swedish locale mostly adheres to ISO 8601.
export const dateFormat = new Intl.DateTimeFormat(`sv-SE`, {
  hour12: false,
  timeZoneName: `short`,
  year: `numeric`,
  month: `2-digit`,
  day: `2-digit`,
  hour: `2-digit`,
  minute: `2-digit`,
})

export const timeFormat = new Intl.DateTimeFormat(`sv-SE`, {
  hour12: false,
  hour: `2-digit`,
  minute: `2-digit`,
  second: `2-digit`,
})

/*
We could have used `Intl.NumberFormat` with `notation: "compact"`.
The stacking `k`, `kk`, `kkk` notation seems easier to parse at a glance.
*/
export function formatNumCompact(val) {
  if (a.isNil(val)) return undefined
  a.reqNum(val)

  let scale = 0
  const mul = 1000
  while (a.isFin(val) && Math.abs(val) > mul) {
    scale++
    val /= mul
  }
  return numFormat.format(val) + `k`.repeat(scale)
}

const numFormat = new Intl.NumberFormat(`en-US`, {
  maximumFractionDigits: 1,
  roundingMode: `halfExpand`,
  useGrouping: false,
})

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

  const has = a.hasMeth(coll, `has`) ? coll.has(val) : val in u.reqPlainDict(coll)
  if (has) return val

  throw new ui.ErrLog(...ui.LogLines(
    [`unrecognized `, ui.BtnPrompt({cmd, suf: u.cliEq(flag, val)}), `, must be one of:`],
    ...a.map(
      a.keys(coll),
      key => ui.BtnPrompt({cmd, suf: u.cliEq(flag, key)}),
    ).map(u.indentNode),
  ))
}

export function cliNat(cmd, key, val) {
  a.reqValidStr(cmd)
  a.reqValidStr(key)
  a.reqStr(val)

  const out = a.intOpt(val)
  if (a.isSome(out)) return out

  const pre = u.cliEq(key)

  throw new ui.ErrLog(
    ui.BtnPrompt({cmd, suf: pre}),
    ` requires a positive integer, got `,
    ui.BtnPrompt({cmd, suf: pre, eph: val}),
  )
}
