import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import {E, S} from './ui.mjs'
import * as ui from './ui.mjs'
import * as fs from './fs.mjs'

export function BtnUrlAppend(val) {
  const href = globalThis.location.href + a.reqValidStr(val)
  return LinkBtnInline({href, chi: val})
}

/*
Using `<a>` for pseudo-buttons should generally be avoided.

If you're reading this code, remember:
- Use `<a>` for ALL links, and for almost nothing else (with this one exception
  explained below).
- Use `<button>` for almost all programmatic click actions and form submissions
  and for nothing else.
  - But mind `<input>`, `<option>`, `<summary>`, `<dialog>`, and more...
- More generally: use built-in semantically-appropriate elements, which tend to
  have proper keyboard support and good accessibility support.

But in this case, the browser rendering engines have left us no choice. It seems
that the native `<button>` cannot be made actually properly inline. Even with
`display: inline` and all available wrapping and word-breaking properties set,
native buttons don't play well with text. When internal text is too long, a
button doesn't wrap like a normal inline element; first it breaks out of its
line, then it wraps, and then it forces subsequent text to be placed on a new
line. Madness, and very inconvenient in our app, where very long text in
buttons is common. The same problem applies to `<input type="button">` which
seems equivalent to `<button>` in current engines.

Using `<a>` for pseudo-buttons also comes with a bonus: the user can
middle-click / ctrl-click / cmd-click to open the link in another tab.
Which is why we require the `href` to be provided.
*/
export function LinkBtnInline({onclick, href, chi, trunc, width}) {
  a.optFun(onclick)
  a.optStr(width)
  href = a.reqValidStr(a.render(href))

  if (trunc && !width) throw Error(`truncation requires width`)

  return E(`a`, {
    href,
    class: a.spaced(
      ui.CLS_BTN_INLINE_BASE,
      trunc ? `trunc` : `inline`,
      width,
    ),
    onkeydown: a.vac(onclick) && a.bind(u.btnOnKeydown, onclick),
    onclick: a.vac(onclick) && function fakeBtnOnclick(eve) {
      if (a.isEventModified(eve)) return
      onclick(eve)
    },
    chi: chi ?? href,
  })
}

export function BtnClip(val) {
  val = a.renderLax(val)
  if (!val) return undefined
  const text = `clipboard`

  return withTooltip({
    chi: text,
    elem: E(`button`, {
      type: `button`,
      class: a.spaced(
        ui.CLS_INLINE_ICON,
        `cursor-pointer hover:text-sky-700 dark:hover:text-sky-300`,
      ),
      onclick() {u.copyToClipboard(val, true).catch(ui.logErr)},
      chi: SvgClipboard(),
      [`aria-label`]: text,
    }),
  })
}

function SvgClipboard() {return Svg(`clipboard`, {class: ui.CLS_INLINE_ICON})}

const SPRITE_PATH = `./client/svg.svg?` + (u.DEV ? Date.now() : u.VERSION)

export function Svg(key, props) {
  return S(`svg`, {
    ...a.optDict(props),
    chi: S(`use`, {href: SPRITE_PATH + `#` + a.reqValidStr(key)}),
  })
}

/*
`capture` is required for detecting scroll inside elements.
`passive` indicates we don't prevent default, good for scroll performance.
*/
const SCROLL_LISTEN_OPT = Object.freeze({passive: true, capture: true, once: true})

export const TOOLTIP = E(`span`, {
  class: a.spaced(
    `fixed m-0 py-1 px-2 leading-tight decoration-none whitespace-pre rounded pointer-events-none`,
    `text-white bg-neutral-800 dark:text-black dark:bg-neutral-200`,
    `bg-opacity-60 dark:bg-opacity-60`,
  ),
  style: {
    transform: `translate(-50%, calc(-100% - 0.5rem))`,
    backdropFilter: `blur(2px)`,
  },
  popover: `hint`,
  ontoggle(eve) {if (eve.newState === `closed`) tooltipDeinit()},
})

export function withGlossary(elem, {key, val, glos, under}) {
  a.reqElement(elem)
  key = a.laxStr(key)
  val = a.laxStr(val)
  a.optDict(glos)
  a.optBool(under)

  const chi = glos[val] || glos[key]
  if (!chi) return elem

  return withTooltip({elem, chi, under})
}

export function withTooltip({
  elem, chi, under, help = true, inheritSize = true,
}) {
  a.reqElement(elem)
  if (!a.vac(chi)) return elem

  if (under) ui.clsAdd(elem, ui.CLS_HELP_UNDER)
  else if (help) ui.clsAdd(elem, `cursor-help`)

  elem.onpointermove = function reinit(eve) {
    tooltipOnPointerMove.call(this, chi, inheritSize, eve)
  }
  elem.onpointerleave = tooltipOnPointerLeave
  return elem
}

const TOOLTIP_MUT_OBS = new MutationObserver(onMutationForTooltip)
let TOOLTIP_OBSERVING = false
let TOOLTIP_LAST_ELEM

function tooltipOnPointerMove(chi, inheritSize, eve) {
  if (this !== TOOLTIP_LAST_ELEM) {
    TOOLTIP_LAST_ELEM = this

    E(TOOLTIP, {chi})

    if (inheritSize) {
      const val = this.computedStyleMap()?.get(`font-size`)
      if (val) TOOLTIP.style.fontSize = val
    }
  }

  if (!TOOLTIP_OBSERVING) {
    TOOLTIP_OBSERVING = true
    TOOLTIP_MUT_OBS.observe(document.body, {childList: true, subtree: true})
  }

  /*
  TODO: snap to the element rather than the cursor, and remove the `pointermove`
  listener. In plots, we snap tooltips to data points, which are point-like.
  For non-point elements such as buttons, we'd have to figure out where to
  position the tooltip in relation to the element. An element can be partially
  outside of the viewport.

  TODO: after implementing the above, also show the tooltip when the given
  element is focused, and hide when blurred, positioning the tooltip just
  outside the element to avoid impeding its visibility.
  */
  tooltipOrient({
    elem: TOOLTIP, posX: eve.clientX, posY: eve.clientY, off: `0.5rem`,
  })

  if (!TOOLTIP.isConnected) {
    document.body.appendChild(TOOLTIP)

    // In supporting browsers, this allows the tooltip to appear in a higher
    // stacking context than a `<dialog>`.
    TOOLTIP.showPopover?.({source: this})

    document.addEventListener(`scroll`, tooltipDeinit, SCROLL_LISTEN_OPT)
  }
}

function tooltipOnPointerLeave() {
  if (this === TOOLTIP_LAST_ELEM) tooltipDeinit()
}

function tooltipDeinit() {
  TOOLTIP.hidePopover?.()
  TOOLTIP.remove()
  TOOLTIP_LAST_ELEM = undefined
  TOOLTIP_OBSERVING = false
  TOOLTIP_MUT_OBS.disconnect()
  document.removeEventListener(`scroll`, tooltipDeinit, SCROLL_LISTEN_OPT)
}

function onMutationForTooltip(src) {
  if (!TOOLTIP_LAST_ELEM) return

  for (src of src) {
    for (src of src.removedNodes) {
      if (src === TOOLTIP_LAST_ELEM) {
        tooltipDeinit()
        return
      }
    }
  }
}

export function tooltipOrient({
  elem, posX, posY, off,
  wid = globalThis.innerWidth,
  hei = globalThis.innerHeight,
}) {
  a.reqElement(elem)
  a.reqFin(posX)
  a.reqFin(posY)
  a.optStr(off)
  a.reqFin(wid)
  a.reqFin(hei)

  const isRig = posX > (wid / 2)
  const isBot = posY > (hei / 2)
  const tran = off ? `calc(-100% - ${off})` : `-100%`
  const tranX = isRig ? tran : (off || `0`)
  const tranY = isBot ? tran : (off || `0`)

  elem.style.left = posX + `px`
  elem.style.top = posY + `px`
  elem.style.transform = `translate(${tranX}, ${tranY})`
}

export function Span(...chi) {return E(`span`, {chi})}
export function Bold(...chi) {return E(`b`, {chi})}
export function Italic(...chi) {return E(`em`, {chi})}
export function Muted(...chi) {return E(`span`, {class: ui.CLS_TEXT_MUTED, chi})}
export function Pale(...chi) {return E(`span`, {class: ui.CLS_TEXT_PALE, chi})}
export function ErrSpan(...chi) {return E(`span`, {class: ui.CLS_ERR, chi})}

export function External() {
  return E(`span`, {class: `leading-none align-text-bottom`, chi: `↗`})
}

const TOGGLE = Symbol.for(`toggle`)

/*
TODO convert to a more shallow abstraction with support for just the count and
the summary toggle indicator.
*/
export function Details({
  elem, chi, lvl, open, trunc, summary, cls, obs, ontoggle,
}) {
  a.optArr(chi)
  a.optNat(lvl)
  a.optBool(open)
  a.optBool(trunc)
  a.optObsRef(obs)
  a.optFun(ontoggle)

  if (!a.vac(chi)) return undefined

  const sumCls = ui.CLS_BUSY_UNDER_OPT
  if (a.isElement(summary)) ui.clsAdd(summary, sumCls)
  else summary = E(`span`, {class: sumCls, chi: summary})
  const indent = `  `.repeat(lvl ?? 0)

  const details = E(elem || `details`, {
    class: a.spaced(
      `inline-block`,
      a.vac(trunc) && `w-full`,
      trunc ? `whitespace-pre` : `whitespace-pre-wrap`,
      cls,
    ),
    open,
    ontoggle,
    chi: [
      E(`summary`, {
        /*
        We assign `display: inline-block` by default to disable the default
        open / closed marker in Chrome. Safari and FF require CSS rules for
        that; see `ui_style.mjs`.
        */
        class: trunc ? `w-full trunc` : `inline-block`,
        chi: [indent, summary],
      }),
      ...chi,
    ]
  })

  if (obs) {
    details[TOGGLE] = a.recurTask(function onObsChange() {
      details.open = !!a.deref(obs)
    })
    details.addEventListener(`toggle`, function onToggle() {
      a.reset(obs, details.open)
    })
  }

  return details
}

// TODO better name. We always use `white-space: pre` or `pre-wrap`.
export function DetailsPre({summary, inf, chi, chiLvl, count, ...opt}) {
  a.optArr(chi)
  a.reqValidStr(summary)
  a.optBool(count)

  if (!chi?.length) return undefined
  if (chi.length === 1) return [ui.Muted(summary, `: `), chi[0]]

  count ??= true
  if (count) inf ??= chi.length

  const suf = ui.Muted(detailsSuf(opt.open))
  summary = [ui.Muted(summary, `: `), inf, a.vac(inf) && ` `, suf]

  const details = Details({
    summary,
    chi: ui.LogLines(...u.indentNodes(chi, a.laxNat(chiLvl))),
    ...opt,
  })

  details.addEventListener(`toggle`, function onToggle() {
    suf.textContent = detailsSuf(details.open)
  })

  return details
}

function detailsSuf(open) {return open ? `↓` : `→`}

const CLS_DRAG = `drag`
let DRAG_COUNT = 0

export function onDragLeave() {
  if (--DRAG_COUNT) return
  ui.clsDel(document.body, CLS_DRAG)
}

export function onDragEnter() {
  if (!DRAG_COUNT++) return
  ui.clsAdd(document.body, CLS_DRAG)
}

export function onDrop(eve) {
  a.eventKill(eve)
  DRAG_COUNT = 0
  ui.clsDel(document.body, CLS_DRAG)

  for (const file of a.arr(eve.dataTransfer?.files)) {
    onFileDrop(file).catch(ui.logErr)
  }
}

async function onFileDrop(file) {
  const {name} = a.reqInst(file, File)

  if (!u.isGameFileName(name)) {
    ui.LOG.err(
      `unable to decide what to do with file `,
      a.show(name), `: unsupported extension`,
    )
    return
  }

  const data = await fs.readDecodeGameFileBlob(file)
  const text = a.jsonEncode(data, null, 2)
  const outName = u.paths.replaceExt(name, `.json`)

  const handle = await fs.reqFsSaveFilePick()({
    suggestedName: outName,
    types: [{
      description: `decoded game file as JSON`,
      accept: {'text/plain': [`.json`]},
    }],
  })

  await fs.writeFile({sig: u.sig, file: handle, body: text, path: outName})
  ui.LOG.info(`saved decoded content of `, a.show(name), ` to `, a.show(outName))
}

export function ObsCheckbox({obs, label, cls, invert}) {
  a.reqObsRef(obs)
  a.reqElement(label)
  a.optBool(invert)

  return E(`label`, {
    class: a.spaced(`inline-flex row-bet-cen gap-x-2 cursor-pointer`, cls),
    chi: [
      label,
      E(`input`, {
        type: `checkbox`,
        value: ``,
        class: `cursor-pointer`,
        checked: invert ? (() => !a.deref(obs)) : obs,
        onchange() {
          let val = this.checked
          if (invert) val = !val
          a.reset(obs, val)
        },
      }),
    ],
  })
}

export function ObsRadio({obs, label, vals}) {
  a.reqObsRef(obs)
  a.reqSome(label)
  const name = a.uuid()

  return E(`fieldset`, {
    class: `inline-flex row-sta-cen gap-2`,
    onchange(eve) {a.reset(obs, a.laxStr(eve.target.value))},
    chi: [
      E(`span`, {class: a.spaced(ui.CLS_TEXT_MUTED, `trunc`), chi: [label, `:`]}),
      a.map(vals, val => E(ObsRadioInput, {obs, val, name})),
    ],
  })
}

export function ObsRadioInput({obs, val, name}) {
  a.reqObsRef(obs)
  a.reqStr(val)
  a.reqValidStr(name)

  return E(`label`, {
    class: `inline-flex row-sta-cen gap-1 cursor-pointer`,
    chi: [
      E(`input`, {
        type: `radio`,
        class: `inline cursor-pointer`,
        name,
        value: val,
        checked: () => a.laxStr(a.deref(obs)) === val,
        onchange() {a.reset(obs, val)},
      }),
      E(`span`, {
        class: `inline-flex row-cen-cen trunc-base`,
        chi: val || `all`,
      }),
    ]
  })
}
