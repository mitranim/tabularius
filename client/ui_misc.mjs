import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import {E, S} from './ui.mjs'
import * as ui from './ui.mjs'

export function BtnUrlAppend(val) {
  const href = globalThis.location.href + a.reqValidStr(val)
  return FakeBtnInline({href, chi: val})
}

/*
Using `<a>` for pseudo-buttons should generally be avoided.

If you're reading this code, remember:
- Use `<a>` for ALL links, and for almost nothing else (with this one exception
  explained below).
- Use `<button>` for all programmatic click actions and form submissions,
  and for NOTHING ELSE.
  - But mind `<input>`, `<select><option>`, `<details><summary>`, `<dialog>`,
    and more...
- More generally: use built-in semantically-appropriate elements, which tend to
  have proper keyboard support and good accessibility support.

But in this case, the browser rendering engines have left us no choice. It seems
that the native `<button>` cannot be made actually properly inline. Even with
`display: inline` and all available wrapping and word-breaking properties set,
native buttons don't play well with text. When internal text is too long, a
button doesn't wrap like a normal inline element; first it breaks out of its
line, then it wraps, and then it forces subsequent text to be placed on a new
line. Madness, which is very inconvenient in our app, where very long text in
buttons is common. The same problem applies to `<input type="button">` which
seems equivalent to `<button>` in current engines.

Using `<a>` for pseudo-buttons also comes with a bonus: the user can
middle-click / ctrl-click / cmd-click to open the link in another tab.
Which is why we require the `href` to be provided.
*/
export function FakeBtnInline({onclick, href, chi, trunc, width}) {
  a.optFun(onclick)
  a.optStr(width)
  href = a.reqValidStr(a.render(href))

  if (trunc && !width) throw Error(`truncation requires width`)

  return E(
    `a`,
    {
      href,
      class: a.spaced(
        ui.CLS_BTN_INLINE_BASE,
        trunc ? `trunc` : `inline`,
        width,
      ),
      onkeydown: a.vac(onclick) && function fakeBtnOnKeydown(eve) {
        if (a.isEventModified(eve)) return
        if (eve.key === `Enter`) this.onclick(eve)
        if (eve.key === ` `) this.onclick(eve)
      },
      onclick: a.vac(onclick) && function fakeBtnOnclick(eve) {
        if (a.isEventModified(eve)) return
        onclick(eve)
      },
    },
    chi ?? href,
  )
}

export function BtnClip(val) {
  val = a.renderLax(val)
  if (!val) return undefined

  return withTooltip({
    chi: `clipboard`,
    elem: E(
      `button`,
      {
        type: `button`,
        class: a.spaced(
          ui.CLS_INLINE_ICON,
          `cursor-pointer hover:text-sky-700 dark:hover:text-sky-300`,
        ),
        onclick() {u.copyToClipboard(val, true).catch(ui.logErr)},
      },
      SvgClipboard(),
    ),
  })
}

function SvgClipboard() {return Svg(`clipboard`, {class: ui.CLS_INLINE_ICON})}

const SPRITE_PATH = `./client/svg.svg` + (u.DEV ? `?` + Date.now() : ``)

export function Svg(key, attr) {
  return S(`svg`, attr,
    S(`use`, {href: SPRITE_PATH + `#` + a.reqValidStr(key)}),
  )
}

// Single global because we wouldn't want multiple concurrent tooltips anyway.
export const TOOLTIP = E(
  `span`,
  {
    class: a.spaced(
      `fixed py-1 px-2 leading-tight decoration-none whitespace-pre rounded pointer-events-none`,
      `text-white bg-neutral-800 dark:text-black dark:bg-neutral-200`,
      `bg-opacity-60 dark:bg-opacity-60`,
    ),
    style: {
      transform: `translate(-50%, calc(-100% - 0.5rem))`,
      backdropFilter: `blur(2px)`,
    },
  },
)

let TOOLTIP_LAST_ELEM

// TODO: remove the tooltip from the DOM when the element leaves the DOM.
export function withTooltip({
  elem, chi, under, help = true, suffixLine, inheritSize = true,
}) {
  if (!a.vac(chi)) return a.optElement(elem)
  a.reqElement(elem)

  if (a.vac(suffixLine)) chi = ui.LogLines(chi, suffixLine)
  if (under) ui.clsAdd(elem, ui.CLS_HELP_UNDER)
  else if (help) ui.clsAdd(elem, `cursor-help`)

  elem.onpointerover = function reinit(eve) {tooltipReinitFor(elem, chi, inheritSize, eve)}
  elem.onpointermove = function reinit(eve) {tooltipReinitFor(elem, chi, inheritSize, eve)}
  elem.onpointerleave = function deinit() {tooltipDeinitFor(elem)}
  return elem
}

export function withGlossary({elem, key, val, glos, under, suffixLine}) {
  a.reqElement(elem)
  key = a.laxStr(key)
  val = a.laxStr(val)
  a.optDict(glos)
  a.optBool(under)

  const chi = glos[val] || glos[key]
  if (!chi) return elem

  return withTooltip({elem, chi, under, suffixLine})
}

/*
`capture` is required for detecting scroll inside elements.
`passive` indicates we don't prevent default, good for scroll performance.
*/
const SCROLL_LISTEN_OPT = {passive: true, capture: true, once: true}

function tooltipReinitFor(elem, chi, inheritSize, eve) {
  a.reqElement(elem)

  if (TOOLTIP_LAST_ELEM !== elem) {
    E(TOOLTIP, undefined, chi)
    if (inheritSize) {
      const val = elem.computedStyleMap()?.get(`font-size`)
      if (val) TOOLTIP.style.fontSize = val
    }
  }
  TOOLTIP_LAST_ELEM = elem

  /*
  TODO: snap to the element rather than the cursor, and remove the `pointermove`
  listener. In plots, we snap tooltips to data points, which are, well, points.
  For sized elements such as buttons, we'd have to figure out where in relation
  to the element to position the tooltip. And elements can be partially outside
  of the viewport.
  */
  tooltipOrient({
    elem: TOOLTIP,
    posX: eve.clientX,
    posY: eve.clientY,
    wid: globalThis.innerWidth,
    hei: globalThis.innerHeight,
    off: `0.5rem`,
  })

  if (!TOOLTIP.isConnected) {
    document.body.appendChild(TOOLTIP)
    document.addEventListener(`scroll`, tooltipDeinit, SCROLL_LISTEN_OPT)
  }
}

function tooltipDeinitFor(elem) {
  if (TOOLTIP_LAST_ELEM === elem) tooltipDeinit()
}

function tooltipDeinit() {
  TOOLTIP.remove()
  TOOLTIP_LAST_ELEM = undefined
  document.removeEventListener(`scroll`, tooltipDeinit, SCROLL_LISTEN_OPT)
}

export function tooltipOrient({elem, posX, posY, wid, hei, off}) {
  a.reqElement(elem)
  a.reqFin(posX)
  a.reqFin(posY)
  a.reqFin(wid)
  a.reqFin(hei)
  a.optStr(off)

  const isRig = posX > (wid / 2)
  const isBot = posY > (hei / 2)
  const tran = off ? `calc(-100% - ${off})` : `-100%`
  const tranX = isRig ? tran : (off || `0`)
  const tranY = isBot ? tran : (off || `0`)

  elem.style.left = posX + `px`
  elem.style.top = posY + `px`
  elem.style.transform = `translate(${tranX}, ${tranY})`
}

export function Span(...chi) {return E(`span`, {}, chi)}
export function Bold(...chi) {return E(`b`, {}, chi)}
export function Muted(...chi) {return E(`span`, {class: ui.CLS_TEXT_MUTED}, chi)}
export function Pale(...chi) {return E(`span`, {class: ui.CLS_TEXT_PALE}, chi)}
export function ErrSpan(...chi) {return E(`span`, {class: ui.CLS_ERR}, chi)}

export function External() {
  return E(`span`, {class: `leading-none align-text-bottom`}, `↗`)
}

export function Details({
  elem, chi, lvl, open, class: cls, summary, summaryCls, ontoggle,
}) {
  a.optArr(chi)
  a.optNat(lvl)
  a.optBool(open)
  a.optStr(cls)
  a.optStr(summaryCls)
  a.optFun(ontoggle)

  if (!a.vac(chi)) return undefined

  summaryCls ||= ui.CLS_BUSY_UNDER_OPT

  if (a.isElement(summary)) ui.clsAdd(summary, summaryCls)
  else summary = E(`span`, {class: summaryCls}, summary)

  const indent = `  `.repeat(lvl ?? 0)

  return E(
    elem || `details`,
    {class: a.spaced(`inline-block w-full`, cls), open, ontoggle},
    E(`summary`, {class: `w-full trunc`}, indent, summary),
    ...chi,
  )
}

export function DetailsPre({summary, inf, chi, chiLvl, count, ontoggle, ...opt}) {
  a.optArr(chi)
  a.reqValidStr(summary)
  a.optBool(count)
  a.optFun(ontoggle)

  if (!chi?.length) return undefined
  if (chi.length === 1) return [ui.Muted(summary, `: `), chi[0]]

  count ??= true
  if (count) inf ??= chi.length
  const suf = ui.Muted(detailsSuf(opt.open))
  summary = [ui.Muted(summary, `: `), inf, a.vac(inf) && ` `, suf]

  return Details({
    class: `whitespace-pre`,
    summary,
    ontoggle(eve) {
      const {open} = a.ancestor(this, HTMLDetailsElement)
      suf.textContent = detailsSuf(open)
      ontoggle?.call(this, eve)
    },
    summaryCls: ui.CLS_BUSY_UNDER_OPT,
    chi: ui.LogLines(...u.indentNodes(chi, a.laxNat(chiLvl))),
    ...opt,
  })
}

function detailsSuf(open) {return open ? `↓` : `→`}

const CLS_DRAG = `drag`
let DRAG_COUNT = 0

export function onDragLeave() {
  if (--DRAG_COUNT) return
  ui.clsDel(document.body, CLS_DRAG)
}

export function onDragEnter(eve) {
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

  await fs.writeFile(u.sig, handle, text, outName)

  ui.LOG.info(`saved decoded content of `, a.show(name), ` to `, a.show(outName))
}
