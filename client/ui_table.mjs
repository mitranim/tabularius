import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import {E} from './ui.mjs'
import * as ui from './ui.mjs'

export function sortObs(key, def) {return new SortObs(key, def)}

export class SortObs extends u.StorageObsJson {
  decode(src) {return a.laxDict(a.onlyDict(super.decode(src)))}
  isEnabled() {return !!this.val.key}
}

export const CLS_TABLE = `w-full table table-fixed border-collapse`
export const CLS_CELL_PAD = `px-2`
export const CLS_CELL_COMMON = a.spaced(CLS_CELL_PAD, `trunc-base text-left`)
export const CLS_CELL_HEAD = a.spaced(
  CLS_CELL_COMMON,
  ui.CLS_TEXT_MUTED,
  ui.CLS_BUSY_BG,
  `cursor-pointer pb-1 weight-unset`,
)
export const CLS_ROW_TOP = a.spaced(ui.CLS_BORD, `border-t border-dashed`)

export function ThWithSort({key, sortObs, ...props}) {
  a.reqValidStr(key)
  a.reqInst(sortObs, SortObs)

  function onclick(eve) {
    if (u.isEventModifiedPrimary(eve)) return
    a.eventKill(eve)
    a.reset(sortObs, cycleSort(key, a.deref(sortObs)))
  }

  return E(`th`, {
    tabIndex: 0,
    onclick,
    onkeydown: a.bind(u.btnOnKeydown, onclick),
    'aria-sort': a.bind(ariaSort, sortObs),
    ...props,
  })
}

export function SortIndicator(sortKey, obs) {
  a.reqInst(obs, SortObs)
  const {key, desc} = a.deref(obs)
  if (key !== sortKey) return ``
  if (a.isNil(desc)) return ``
  if (desc) return `▼ `
  return `△ `
}

export function cycleSort(key, opt) {
  a.reqValidStr(key)
  a.reqDict(opt)

  const keyPrev = a.optStr(opt.key)
  const descPrev = a.optBool(opt.desc)

  if (key !== keyPrev) return {key, desc: true}
  if (descPrev === true) return {key, desc: false}
  return {}
}

export function ariaSort(obs) {
  a.reqInst(obs, SortObs)
  const {desc} = a.deref(obs)
  if (desc === true) return `descending`
  if (desc === false) return `ascending`
  return undefined
}
