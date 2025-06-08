import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as u from './util.mjs'
import * as ui from './ui.mjs'

const namespace = globalThis.tabularius ??= a.Emp()
namespace.lib ??= a.Emp()
namespace.lib.a = a
namespace.lib.dr = dr
a.patch(globalThis, namespace)

/*
Needed for `dr.MixReg`, which enables automatic registration of any custom
elements that we define.
*/
dr.Reg.main.setDefiner(customElements)

export class Ren extends a.Ren {
  /*
  Hook Twind into our rendering system. It generates Tailwind-compliant styles
  as needed. To make this actually work, we must always set element classes by
  calling `E(tar, {class})` or `REN.mutCls`, and avoid directly mutating
  `.classList` and `.className`.

  Previously, we used Twind's `install` feature, which hooked itself into the
  DOM and didn't require this. Eventually we ran into a case where its "magic"
  became a horrible performance bottleneck. This approach avoids the issue.
  */
  mutCls(tar, val, key) {
    if (!a.optStr(val)) return tar.removeAttribute(`class`)
    return super.mutCls(tar, ui.TWIND(val), key)
  }
}

// Main renderer.
export const REN = new Ren()
export const {E, S} = REN

// Base class for UI components with custom behaviors.
export class Elem extends dr.MixReg(HTMLElement) {}

export const TARBLAN = Object.freeze({
  target: `_blank`,
  rel: `noopener noreferrer`,
})

export function clsDel(tar, src) {
  tar.classList.remove(...splitClasses(src))
  return tar
}

export function clsAdd(tar, src) {
  REN.mutCls(tar, a.spaced(tar.className, src))
  return tar
}

export function clsReplace(tar, prev, next) {
  clsDel(tar, prev)
  return clsAdd(tar, next)
}

export function clsToggle(tar, ok, cls) {
  if (a.optBool(ok)) return clsAdd(tar, cls)
  return clsDel(tar, cls)
}

function splitClasses(src) {return a.split(src, /\s+/)}

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

  ui.MEDIA_QUERY_DARK.matches
  ui.MEDIA_QUERY_DARK.addEventListener(`change`, someListener)
  function someListener(eve) {console.log(eve.matches)}
*/
export const MEDIA_QUERY_DARK = globalThis.matchMedia(`(prefers-color-scheme: dark)`)

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

export function msgUnrecInput(pair, args) {
  return [
    `unrecognized input `, a.show(pair),
    ` in `, ui.BtnPromptReplace(args),
  ]
}
