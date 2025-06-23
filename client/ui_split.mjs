import * as a from '@mitranim/js/all.mjs'
import {E} from './ui_util.mjs'
import * as ui from './ui_util.mjs'
import * as u from './util.mjs'

// Cleanup outdated storage property.
u.storagesSet(`tabularius.log_width`)

export const SPLIT_OBS = u.storageObsFin(`tabularius.ui_split`)
export const SPLIT_DEFAULT = 0.5
export const SPLIT_MIN = 0
export const SPLIT_MAX = 1

// This key is used in existing URLs shared on Discord, no sense breaking it.
export const QUERY_KEY_UI_SPLIT = `log_width`

let SPLIT_URL = a.finOpt(u.QUERY.get(QUERY_KEY_UI_SPLIT))
if (a.isFin(SPLIT_URL)) SPLIT_URL /= 100

export let SPLIT = SPLIT_URL ?? SPLIT_OBS.val ?? SPLIT_DEFAULT

/*
Normally we size everything in `rem`. This one is sized in `px` because it has a
tiny `::after` which needs to be sized as a few pixels. Using different units
would produce mis-alignment for some font sizes.
*/
const DRAG_HANDLE_WID = `10px`

export const DRAG_HANDLE = E(
  `div`,
  {
    class: a.spaced(
      `w-[${DRAG_HANDLE_WID}]`,
      `h-full bg-gray-400 dark:bg-neutral-600 opacity-50 hover:opacity-100`,
      `flex row-cen-cen`,
      `cursor-ew-resize active:cursor-col-resize`,
      `after:content-[''] after:block after:w-[4px] after:h-8 after:shrink-1 after:min-w-0 after:bg-white dark:after:bg-black after:rounded`,
    ),
    style: {flex: `0 0 ${DRAG_HANDLE_WID}`},
    onpointerdown,
    onpointerup,
  },
)

// Indicates the percentage visually while resizing.
export const DRAG_INDICATOR = new class DragIndicator extends ui.Elem {
  constructor() {
    E(
      super(),
      {class: `fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded shadow-lg z-50`},
    )
  }

  show() {
    this.textContent = fmtPercCen(Math.round(SPLIT * 100))
    const tar = document.body
    if (this.parentNode !== tar) tar.appendChild(this)
  }
}()

function onpointerdown(eve) {
  // Prevent text selection during drag.
  a.eventKill(eve)

  if (u.isEventModifiedPrimary(eve)) {
    SPLIT = SPLIT_OBS.val = SPLIT_DEFAULT
    updateSplitWidths()
    return
  }

  document.addEventListener(`pointermove`, onpointermove)
  document.addEventListener(`pointerup`, onpointerup)
  DRAG_INDICATOR.show()
}

function onpointerup(eve) {
  a.eventKill(eve)
  document.removeEventListener(`pointermove`, onpointermove)
  document.removeEventListener(`pointerup`, onpointerup)
  DRAG_INDICATOR.remove()
  SPLIT_OBS.val = SPLIT
}

function onpointermove(eve) {
  SPLIT = u.clampFin(
    SPLIT_MIN,
    (
      a.reqFin(eve.clientX) /
      a.reqFin(DRAG_HANDLE.parentElement.getBoundingClientRect().width)
    ),
    SPLIT_MAX
  )
  updateSplitWidths()
  DRAG_INDICATOR.show()
}

function updateSplitWidths() {
  setSplitWidths(DRAG_HANDLE.previousElementSibling, DRAG_HANDLE.nextElementSibling)
}

export function setSplitWidths(prev, next) {
  const perc = fmtPercNum(SPLIT)
  prev = a.reqElement(prev).style
  next = a.reqElement(next).style
  prev.width = `calc(${perc} - ${DRAG_HANDLE_WID} / 2)`
  prev.maxWidth = `calc(100% - ${DRAG_HANDLE_WID})`
  prev.flex = `0 0 auto`
  next.flex = `1 1 0`
}

function fmtPercNum(src) {return fmtPercCen(a.reqFin(src) * 100)}
function fmtPercCen(src) {return a.reqFin(src) + `%`}
