import * as a from '@mitranim/js/all.mjs'
import {E} from './ui_util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as ui from './ui.mjs'

// TODO waste less space.
// SYNC[media_pad].
export const MEDIA_PAD = `1rem`
export const CLS_MEDIA_PAD = `p-[${MEDIA_PAD}]`
export const CLS_MEDIA_PAD_T = `pt-[${MEDIA_PAD}]`
export const CLS_MEDIA_PAD_X = `px-[${MEDIA_PAD}]`
export const MEDIA_STICKY = `sticky top-[-${MEDIA_PAD}]`
export const MEDIA_ITEM_WID = `36rem`
export const CLS_MEDIA_ITEM_WIDE = `span-all self-start`

export const CLS_MEDIA_CHI = a.spaced(
  ui.CLS_BG_1,
  ui.CLS_BORD,
  `border rounded overflow-x-clip`,
)

export const PLOT_PLACEHOLDER = new class PlotPlaceholder extends ui.Elem {
  state = a.obs({count: 0})

  constructor() {
    super()

    const obs = this.state
    const placeholder = `[Plot Placeholder]`

    E(this,
      {class: a.spaced(
        CLS_MEDIA_CHI,
        CLS_MEDIA_ITEM_WIDE,
        CLS_MEDIA_PAD,
        `flex flex-col gap-3`,
      )},
      E(`div`, {class: `text-center`},
        () => obs.count ? `Plots loading...` : placeholder,
      ),
      E(
        `div`,
        {class: `h-64 flex row-cen-cen border border-gray-400 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800`},
        E(
          `div`,
          {class: a.spaced(ui.CLS_TEXT_MUTED, `w-full text-center`)},
          () => (
            obs.count ? [`Loading `, obs.count, ` plots...`] : placeholder
          ),
        )
      )
    )
  }
}()

export const PROCESS_LIST = new class ProcessList extends ui.Elem {
  /*
  Delay until connected, as opposed to rendering synchronously at module init,
  because we have an import cycle between modules, and `os.PROCS` is not yet
  available at construction time.
  */
  connectedCallback() {
    E(
      this,
      {class: a.spaced(
        `flex flex-col gap-2`, CLS_MEDIA_CHI, CLS_MEDIA_ITEM_WIDE, CLS_MEDIA_PAD,
      )},
      ActiveProcs,
    )
  }
}()

function ActiveProcs() {
  const vals = a.values(os.PROCS)
  const len = vals.length

  if (!len) return ui.Muted(`no active processes`)

  return [
    E(`div`, {}, `active processes (${len}):`),
    a.map(vals, Process),
  ]
}

export const MEDIA = new class MediaPanel extends ui.Elem {
  constructor() {
    super()
    E(
      this,
      {
        class: a.spaced(
          `@container w-full min-w-0 min-h-full grid-auto content-between gap-4`,
          `overflow-y-auto overflow-x-clip break-words over-wrap`,
        ),
        style: {
          '--grid-col-wid': `36rem`,
          '--grid-pad': MEDIA_PAD,
        },
      },
      PLOT_PLACEHOLDER, PROCESS_LIST,
    )
  }

  add(val) {
    a.reqElement(val)
    ui.clsAdd(val, CLS_MEDIA_CHI)

    const onclick = () => {this.delete(val)}
    const btn = BtnKill({onclick})

    if (a.hasMeth(val, `addCloseBtn`)) {
      val.addCloseBtn(btn)
    }
    else {
      ui.clsAdd(val, `relative`)
      ui.clsAdd(btn, `absolute top-2 right-2`)
      val.appendChild(btn)
    }

    PLOT_PLACEHOLDER.remove()
    for (const val of this.children) {
      if (isElementMediaDefault(val)) val.remove()
    }
    this.prepend(val)
  }

  delete(val) {
    if (!a.optElement(val)) return
    if (val.parentNode !== this) return
    val.remove()
    this.updatePlaceholder()
  }

  toggleWide(tar, ok) {
    a.reqElement(tar)
    a.optBool(ok)
    ui.clsToggle(tar, ok, CLS_MEDIA_ITEM_WIDE)
  }

  clear() {E(this, undefined, PLOT_PLACEHOLDER, PROCESS_LIST)}

  updatePlaceholder() {
    if (this.children.length <= 1) {
      this.prepend(PLOT_PLACEHOLDER)
    }
    else {
      PLOT_PLACEHOLDER.remove()
    }
  }

  isDefault() {
    return a.every(this.children, isElementMediaDefaultOrBase)
  }
}()

function isElementMediaDefaultOrBase(val) {
  return (
    isElementMediaDefault(val) ||
    val === PLOT_PLACEHOLDER ||
    val === PROCESS_LIST
  )
}

export function isElementMediaDefault(val) {
  return val?.dataset?.isDefault === `true`
}

export function markElementMediaDefault(val) {
  a.reqElement(val)
  val.dataset.isDefault = `true`
  return val
}

function Process(src) {
  a.reqInst(src, os.Proc)
  const cls = a.spaced(ui.CLS_TEXT_MUTED, `trunc text-sm`)

  return E(`div`, {class: `flex row-bet-cen gap-2`},
    E(`pre`, {class: `flex-1 basis-auto trunc font-medium flex-1`},
      ui.withTooltip({
        chi: `process id`,
        elem: E(`span`, {class: `cursor-help`}, src.id),
      }),
      ui.Muted(`: `),
      ui.BtnPromptReplace(src.args),
    ),
    // TODO: place description on its own line (under).
    a.vac(src.desc && undefined) && E(
      `pre`,
      {class: cls},
      `(`, u.callOpt(src.desc), `)`,
    ),
    a.vac(src.startAt) && ui.withTooltip({
      chi: `started at: ` + ui.dateFormat.format(src.startAt),
      elem: E(
        `pre`,
        {class: a.spaced(cls, `cursor-help`)},
        ui.timeFormat.format(src.startAt),
      ),
    }),
    a.vac(src.id) && BtnKill({
      onclick() {os.runCmd(`kill ` + src.id).catch(ui.logErr)},
    }),
  )
}

export function BtnKill({class: cls, ...attrs}) {
  return E(`button`, {
    type: `button`,
    class: a.spaced(
      `w-6 h-6 shrink-0 text-center align-middle leading-none bg-red-500 text-white rounded hover:bg-red-600`,
      cls,
    ),
    ...attrs
  }, `✕`)
}
