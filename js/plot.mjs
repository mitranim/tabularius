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

  E(document.body, {}, E(
    new pl.Plotter(opts),
    {class: `block w-full h-full`},
  ))

  ui.MEDIA.set(E(new pl.Plotter(opts), {class: `block w-full h-full`}))
*/
export class Plotter extends u.Elem {
  constructor(opts) {
    super()
    this.opts = a.reqDict(opts)
    this.resObs = new ResizeObserver(this.onResize.bind(this))
  }

  init() {
    this.deinit()
    if (!this.isConnected) return
    this.plot = new Plot({...this.opts, ...this.sizes()})
    E(this, {}, this.plot.root)
    this.resObs.observe(this)
    u.darkModeMediaQuery.addEventListener(`change`, this)
  }

  deinit() {
    u.darkModeMediaQuery.removeEventListener(`change`, this)
    this.resObs.disconnect()
    this.plot?.destroy()
    this.plot = undefined
  }

  connectedCallback() {
    // Need to wait a tick for the element's geometry to be determined.
    window.requestAnimationFrame(this.init.bind(this))
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

  sizes() {return {width: this.offsetWidth, height: this.offsetHeight / 2}}

  handleEvent(eve) {
    if (eve.type === `change` && eve.media) this.init()
  }
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

export function plugins() {
  return [new TooltipPlugin().opts()]
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

export function serieWithSum(label) {
  return {
    ...serie(label),
    value: serieFormatValWithSum,
  }
}

export function serieWithAvg(label) {
  return {
    ...serie(label),
    value: serieFormatValWithAvg,
  }
}

export function serie(label) {
  a.reqValidStr(label)
  return {label, stroke: nextFgColor(label), width: 2, value: formatVal}
}

export function serieFormatValWithSum(plot, val, ind) {
  return serieFormatVal(plot, val, ind, a.sum)
}

export function serieFormatValWithAvg(plot, val, ind) {
  return serieFormatVal(plot, val, ind, u.avg)
}

export function serieFormatVal(plot, val, seriesInd, fun) {
  a.reqFun(fun)
  if (a.isNil(val) && a.isNum(seriesInd)) {
    const dat = plot.data[seriesInd]
    if (a.isArr(dat)) val = fun(dat)
  }
  return formatVal(val)
}

/*
Our default value formatter, which should be used for displaying all plot
values. Needs to be included in every serie.
*/
export function formatVal(val) {return a.isNum(val) ? numFormat.format(val) : val}

export const numFormat = new Intl.NumberFormat(`en-US`, {
  maximumFractionDigits: 2,
  roundingMode: `halfExpand`,
})

export function nextFgColor() {
  COLOR_INDEX++
  COLOR_INDEX %= FG_COLORS.length
  return FG_COLORS[COLOR_INDEX]
}

let COLOR_INDEX = -1

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

TODO: avoid clipping the tooltip outside the container. We'd have to compare the
coordinates, the tooltip rectangle, and the parent element rectangle, and change
in which direction we transform/translate the tooltip
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
    tar.textContent = a.joinLinesOptLax([
      series.label,
      (axisNameX + nameSuf).padEnd(nameLen, ` `) + formatVal(valX),
      (axisNameY + nameSuf).padEnd(nameLen, ` `) + formatVal(valY),
    ])
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
