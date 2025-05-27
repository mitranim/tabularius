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
export let SPLIT = SPLIT_OBS.val ?? SPLIT_DEFAULT

const DRAG_HANDLE_WID = `10px`

export const DRAG_HANDLE = E(
  `div`,
  {
    class: a.spaced(
      `w-[${DRAG_HANDLE_WID}]`,
      `h-full cursor-ew-resize bg-gray-400 dark:bg-neutral-600 opacity-50 hover:opacity-100`,
      `flex row-cen-cen`,
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
  setSplitWidths(DRAG_HANDLE.previousElementSibling, DRAG_HANDLE.nextElementSibling)
  DRAG_INDICATOR.show()
}

export function setSplitWidths(prev, next) {
  const perc = fmtPercNum(SPLIT)
  prev = a.reqElement(prev).style
  next = a.reqElement(next).style
  prev.width = `calc(${perc} - ${DRAG_HANDLE_WID})`
  prev.flex = `0 0 auto`
  next.flex = `1 1 0`
}

function fmtPercNum(src) {return fmtPercCen(a.reqFin(src) * 100)}
function fmtPercCen(src) {return a.reqFin(src) + `%`}
