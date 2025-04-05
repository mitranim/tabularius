import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import Plot from 'https://esm.sh/uplot@1.6.27'
import {E} from './util.mjs'
import * as u from './util.mjs'

import * as self from './plot.mjs'
const tar = window.tabularius ??= a.Emp()
tar.pl = self
a.patch(window, tar)

document.head.append(E(`link`, {
  rel: `stylesheet`,
  href: `https://esm.sh/uplot@1.6.27/dist/uPlot.min.css`,
}))

/*
Interfaces:
  https://github.com/leeoniya/uPlot/blob/master/dist/uPlot.d.ts

Source:
  https://github.com/leeoniya/uPlot/blob/master/src/uPlot.js

Demos:
  https://leeoniya.github.io/uPlot/demos/index.html

Dark mode demo:
  https://leeoniya.github.io/uPlot/demos/line-paths.html

Usage examples:

  E(document.body, {}, new pl.Plotter(opts))
  ui.MEDIA.add(new pl.Plotter(opts))
*/
export class Plotter extends u.Elem {
  constructor(opts) {
    super()
    this.opts = a.reqDict(opts)
    this.resObs = new ResizeObserver(this.onResize.bind(this))
    this.className = `block w-full`
  }

  init() {
    this.deinit()
    this.plot = new Plot({...this.opts, ...this.sizes()})
    this.appendChild(this.plot.root)
    this.resObs.observe(this)
    u.darkModeMediaQuery.addEventListener(`change`, this)
  }

  deinit() {
    u.darkModeMediaQuery.removeEventListener(`change`, this)
    this.resObs.disconnect()
    this.plot?.root?.remove()
    this.plot?.destroy()
    this.plot = undefined
  }

  connectedCallback() {
    // Need to wait a tick for the element's geometry to be determined.
    const init = () => {if (this.isConnected) this.init()}
    window.requestAnimationFrame(init)
  }

  disconnectedCallback() {this.deinit()}

  resizing = false
  onResize() {
    // Precaution against recursively triggering resize.
    if (this.resizing) return
    this.resizing = true
    const done = () => {this.resizing = false}
    window.requestAnimationFrame(done)
    this.plot?.setSize(this.sizes())
  }

  sizes() {
    return {
      width: this.offsetWidth,
      height: this.offsetWidth/(16/9), // Golden ratio.
    }
  }

  handleEvent(eve) {if (eve.type === `change` && eve.media) this.init()}
}

export const SCALE_X = {time: false}
export const SCALE_Y = SCALE_X
export const SCALES = {x: SCALE_X, y: SCALE_Y}

export const LINE_PLOT_OPTS = {
  axes: axes(),
  scales: SCALES,
  legend: {
    // Apply colors directly to serie labels instead of showing dedicated icons.
    markers: {show: false},

    /*
    Inverts the default behavior of clicking legend labels. By default, clicking
    a label disables it, and Ctrl+ or Cmd+clicking isolates it, disabling
    others. With the inverted behavior, clicking a label isolates that series,
    and Ctrl+ or Cmd+ clicking enables other series one by one. The default
    behavior makes it easy to disable individual series. The inverted behavior
    makes it easy to disable everything else and select a few. In our case,
    it tends to be more useful to easily disable outliers who are spoiling the
    chart, for one reason or another.

      isolate: true,
    */
  },
  focus: {alpha: 0.2},
  cursor: {
    // When hovering near a datapoint, apply the setting `../focus/alpha`
    // to all other series.
    focus: {prox: 8},
  },
}

export const pluginSortLabels = {hooks: {setLegend: sortPlotLabels}}

export function plugins() {
  return [new TooltipPlugin().opts(), pluginSortLabels]
}

export function axes(nameX, nameY) {
  return [
    // This one doesn't have a label, not even an empty string, because that
    // causes the plot library to waste space.
    {
      scale: `x`,
      stroke: axisStroke,
      secretName: nameX,
    },
    // This one does have an empty label to prevent the numbers from clipping
    // through the left side of the container.
    {
      scale: `y`,
      label: ``,
      stroke: axisStroke,
      secretName: nameY,
    },
  ]
}

export function axisStroke() {
  return u.darkModeMediaQuery.matches ? `white` : `black`
}

export function serieWithSum(label, ind) {
  return {
    ...serie(label, ind),
    value: serieFormatValWithSum,
  }
}

export function serieWithAvg(label, ind) {
  return {
    ...serie(label, ind),
    value: serieFormatValWithAvg,
  }
}

export function serie(label, ind) {
  a.reqValidStr(label)

  return {
    label,
    stroke: nextFgColor(ind),
    width: 2,

    /*
    When formatting series, we preserve values exactly as-is, in order to be
    able to parse them back and reorder serie DOM nodes by those values. Which
    seems like the cleanest, least invasive approach to dynamic reordering of
    series, since Uplot doesn't support that at all. See `pluginSortLabels`.
    */
    value: a.id,
  }
}

export function serieFormatValWithSum(plot, val, ind) {
  return serieFormatVal(plot, val, ind, a.sum)
}

export function serieFormatValWithAvg(plot, val, ind) {
  return serieFormatVal(plot, val, ind, u.avg)
}

// See comment in `serie` why we don't format the value here.
export function serieFormatVal(plot, val, seriesInd, agg) {
  a.reqFun(agg)
  if (a.isNil(val) && a.isNum(seriesInd)) {
    const dat = plot.data[seriesInd]
    if (a.isArr(dat)) val = agg(dat)
  }
  return val
}

// Our default value formatter, which should be used for all plot values.
export function formatVal(val) {
  if (!a.isNum(val)) return val
  return formatNumCompact(val)
}

/*
We could also use `Intl.NumberFormat` with `notation: "compact"`.
This `k`, `kk`, `kkk` notation is experimental.
*/
export function formatNumCompact(val) {
  a.reqNum(val)
  let scale = 0
  const mul = 1000
  while (a.isFin(val) && Math.abs(val) > mul) {
    scale++
    val /= mul
  }
  return numFormat.format(val) + `k`.repeat(scale)
}

export const numFormat = new Intl.NumberFormat(`en-US`, {
  maximumFractionDigits: 1,
  roundingMode: `halfExpand`,
})

let COLOR_INDEX = -1

export function resetColorIndex() {COLOR_INDEX = -1}

export function nextFgColor(ind) {
  ind = a.optNat(ind) ?? ++COLOR_INDEX
  ind++
  ind %= FG_COLORS.length
  return FG_COLORS[ind]
}

/*
Copy-paste of `*-500` color variants from:
  https://tailwindcss.com/docs/colors#default-color-palette-reference
*/
const FG_COLORS = [
  `oklch(0.637 0.237 25.331)`,  // red
  `oklch(0.705 0.213 47.604)`,  // orange
  `oklch(0.769 0.188 70.08)`,   // amber
  `oklch(0.795 0.184 86.047)`,  // yellow
  `oklch(0.768 0.233 130.85)`,  // lime
  `oklch(0.723 0.219 149.579)`, // green
  `oklch(0.696 0.17 162.48)`,   // emerald
  `oklch(0.704 0.14 182.503)`,  // teal
  `oklch(0.715 0.143 215.221)`, // cyan
  `oklch(0.685 0.169 237.323)`, // sky
  `oklch(0.623 0.214 259.815)`, // blue
  `oklch(0.585 0.233 277.117)`, // indigo
  `oklch(0.606 0.25 292.717)`,  // violet
  `oklch(0.627 0.265 303.9)`,   // purple
  `oklch(0.667 0.295 322.15)`,  // fuchsia
  `oklch(0.656 0.241 354.308)`, // pink
  `oklch(0.645 0.246 16.439)`,  // rose
  `oklch(0.554 0.046 257.417)`, // slate
  `oklch(0.551 0.027 264.364)`, // gray
  `oklch(0.552 0.016 285.938)`, // zinc
  `oklch(0.556 0 0)`,           // neutral
  `oklch(0.553 0.013 58.071)`,  // stone
]

/*
Plugin interface:

  export interface Plugin {
    opts?: (plot: uPlot, opts: Options) => void | Options
    hooks: Hooks.ArraysOrFuncs
  }

Hooks (paraphrased):

  interface Hooks {
    init?:       func | func[]
    addSeries?:  func | func[]
    delSeries?:  func | func[]
    setScale?:   func | func[]
    setCursor?:  func | func[]
    setLegend?:  func | func[]
    setSelect?:  func | func[]
    setSeries?:  func | func[]
    setData?:    func | func[]
    setSize?:    func | func[]
    drawClear?:  func | func[]
    drawAxes?:   func | func[]
    drawSeries?: func | func[]
    draw?:       func | func[]
    ready?:      func | func[]
    destroy?:    func | func[]
    syncRect?:   func | func[]
  }

Relevant demos with tooltips:

  https://leeoniya.github.io/uPlot/demos/tooltips.html
  https://leeoniya.github.io/uPlot/demos/tooltips-closest.html
*/
export class TooltipPlugin extends a.Emp {
  // Index of currenly hovered series.
  indS = undefined

  opts() {
    return {
      hooks: {
        // Called when a cursor hovers a particular series.
        setSeries: this.setSeries.bind(this),
        // Called on any cursor movement.
        setCursor: this.draw.bind(this),
      }
    }
  }

  /*
  Known gotcha / limitation: when multiple series _overlap_ on a data point,
  either completely, or at least visually, we still select just one series,
  instead of grouping them and including all in the tooltip.
  */
  setSeries(plot, ind) {
    this.indS = ind
    this.draw(plot)
  }

  draw(plot) {
    const {indS} = this
    const indX = plot.cursor.idx
    if (a.isNil(indS) || a.isNil(indX)) {
      this.tooltip?.remove()
      return
    }

    const series = plot.series[indS]
    const valX = plot.data[0][indX]
    const valY = plot.data[indS][indX]
    const posX = plot.valToPos(valX, `x`, false)
    const posY = plot.valToPos(valY, `y`, false)

    if (!a.isFin(valX) || !a.isFin(valY) || !a.isFin(posX) || !a.isFin(posY)) {
      this.tooltip?.remove()
      return
    }

    const axisNameX = plot.axes?.[0]?.secretName || `X`
    const axisNameY = plot.axes?.[1]?.secretName || `Y`
    const nameSuf = `: `
    const nameLen = nameSuf.length + Math.max(axisNameX.length, axisNameY.length)

    const tar = this.tooltip ??= this.makeTooltip()
    const wid = plot.over.offsetWidth / 2
    const hei = plot.over.offsetHeight / 2
    const isRig = posX > wid
    const isBot = posY > hei

    tar.style.transform = `translate(${isRig ? -100 : 0}%, ${isBot ? -100 : 0}%)`
    tar.style.left = posX + `px`
    tar.style.top = posY + `px`
    tar.textContent = u.joinLines(
      series.label,
      (axisNameX + nameSuf).padEnd(nameLen, ` `) + formatVal(valX),
      (axisNameY + nameSuf).padEnd(nameLen, ` `) + formatVal(valY),
    )
    plot.over.appendChild(tar)
  }

  makeTooltip() {
    return E(`div`, {
      // TODO convert inline styles to Tailwind classes.
      style: {
        padding: `0.3rem`,
        pointerEvents: `none`,
        position: `absolute`,
        background: `oklch(0.45 0.31 264.05 / 0.1)`,
        whiteSpace: `pre`,
      },
    })
  }
}

export function sortPlotLabels(plot) {
  const body = plot.root.getElementsByTagName(`table`)?.[0]?.getElementsByTagName(`tbody`)?.[0]
  if (!body) return

  const nodes = body.children
  const len = nodes.length
  if (!len) return

  // Enables `.style.order` on child nodes.
  body.style.display = `flex`
  body.style.flexWrap = `wrap`
  body.style.justifyContent = `center`

  for (const [ind, val] of a.arr(nodes).map(labelSortable).sort(compareLabelSortable).entries()) {
    if (!val.ind) continue // Skip X label.
    val.node.style.order = ind
    labelValNode(val.node).textContent = formatVal(val.val)
  }
}

function labelSortable(node, ind) {
  const val = parseFloat(labelValNode(node).textContent)
  return {ind, val, node}
}

function labelValNode(val) {return val.childNodes[1]}

function compareLabelSortable(one, two) {return two.val - one.val}
