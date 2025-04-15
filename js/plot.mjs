import * as a from '@mitranim/js/all.mjs'
import Plot from 'https://esm.sh/uplot@1.6.27'
import {E} from './util.mjs'
import * as u from './util.mjs'
import * as c from '../funs/codes.mjs'
import * as s from '../funs/schema.mjs'
import * as ui from './ui.mjs'
import * as fs from './fs.mjs'
import * as d from './dat.mjs'

import * as self from './plot.mjs'
const tar = window.tabularius ??= a.Emp()
tar.p = self
a.patch(window, tar)

document.head.append(E(`link`, {
  rel: `stylesheet`,
  href: `https://esm.sh/uplot@1.6.27/dist/uPlot.min.css`,
}))

cmdPlot.cmd = `plot`
cmdPlot.desc = `analyze data, visualizing with a plot 📈📉`

cmdPlot.help = function cmdPlotHelp() {
  return u.LogParagraphs(
    u.callOpt(cmdPlot.desc),

    `flags:`,

    u.LogLines(
      BtnPromptAppendPlot(`-p`),
      ` -- preset; can be overriden with other flags; supported values:`,
      ...a.map(a.entries(PLOT_PRESETS), PresetHelp).map(u.indentChi),
    ),

    u.LogLines(
      [
        BtnPromptAppendPlot(`-s`),
        ` -- data source; local data requires running the `,
        os.BtnCmdWithHelp(`init`),
        ` command to enable access to the progress file and history directory; `,
        `cloud data requires running the `,
        os.BtnCmdWithHelp(`auth`),
        ` command to enable cloud backups; supported values:`,
      ],
      ...FlagAppendBtns(PLOT_AGG_SRC, `-s`, PLOG_AGG_OPT_DEF_SRC).map(u.indentChi),
    ),

    u.LogLines(
      [
        BtnPromptAppendPlot(`-x`),
        ` -- X axis; supported values:`,
      ],
      ...FlagAppendBtns(s.ALLOWED_X_KEYS, `-x`, PLOG_AGG_OPT_DEF_X).map(u.indentChi),
    ),

    u.LogLines(
      [
        BtnPromptAppendPlot(`-y`),
        ` -- Y axis; supported values:`,
      ],
      ...FlagAppendBtns(s.ALLOWED_Y_STAT_TYPES, `-y`, PLOG_AGG_OPT_DEF_Y).map(u.indentChi),
    ),

    u.LogLines(
      [
        BtnPromptAppendPlot(`-z`),
        ` -- Z axis (plot series); supported values:`,
      ],
      ...FlagAppendBtns(s.ALLOWED_Z_KEYS, `-z`, PLOG_AGG_OPT_DEF_Z).map(u.indentChi),
    ),

    u.LogLines(
      [
        BtnPromptAppendPlot(`-a`),
        ` -- aggregation mode; supported values:`,
      ],
      ...FlagAppendBtns(s.AGGS, `-a`, PLOG_AGG_OPT_DEF_AGG).map(u.indentChi),
    ),

    u.LogLines(
      `tip: the special filter "run=" works for both "runId" and "runNum" if the input is an integer; examples:`,
      [`  `, BtnPromptAppendPlot(`run=123`)],
      [`  `, BtnPromptAppendPlot(`run=some_id`)],
    ),

    u.LogLines(
      `tip: the special filter "round=" works for both "roundId" and "roundNum" if the input is an integer; examples:`,
      [`  `, BtnPromptAppendPlot(`round=123`)],
      [`  `, BtnPromptAppendPlot(`round=some_id`)],
    ),

    u.LogLines(
      [
        `tip: `,
        BtnPromptAppendPlot(`run=latest`),
        ` or `,
        BtnPromptAppendPlot(`runId=latest`),
        ` filters the latest run only; examples:`,
      ],
      [`  `, BtnPromptAppendPlot(`-s=local run=latest`)],
      [`  `, BtnPromptAppendPlot(`-s=cloud run=latest`)],
    ),

    u.LogLines(
      [
        `tip: `,
        BtnPromptAppendPlot(`userId=current`),
        ` filters cloud data by current user id, if any; examples:`,
      ],
      [`  `, BtnPromptAppendPlot(`-s=cloud userId=current`)],
      [`  `, BtnPromptAppendPlot(`-s=cloud userId=current run=latest`)],
    ),

    `tip: try ctrl+click / cmd+click / shift+click on plot labels`,
    [`tip: use `, os.BtnCmdWithHelp(`ls`), ` to browse local runs`],
    [`tip: use `, os.BtnCmdWithHelp(`cls`), ` to browse cloud runs`],

    u.LogLines(
      `more examples:`,
      [`  `, os.BtnCmd(`plot`)],
      [`  `, os.BtnCmd(`plot -s=cloud`)],
      [`  `, os.BtnCmd(`plot -s=local -p=dmg runId=latest`)],
      [`  `, os.BtnCmd(`plot -s=local -p=eff runId=latest`)],
      [`  `, os.BtnCmd(`plot -s=cloud -p=dmg runId=latest`)],
      [`  `, os.BtnCmd(`plot -s=cloud -p=eff runId=latest`)],
      [`  `, os.BtnCmd(`plot -x=runNum -y=costEff -z=buiTypeUpg -a=avg`)],
    ),
  )
}

export function cmdPlot({sig, args}) {
  const inp = plotAggCliArgsDecode(args)
  const src = u.dictPop(inp, `src`)
  if (src === `local`) return cmdPlotLocal(sig, inp)
  if (src === `cloud`) return cmdPlotCloud(sig, inp)
  throw `unknown plot data source ${a.show(src)}`
}

// TODO: avoid updating when the dat change doesn't affect the current plot.
export async function cmdPlotLocal(sig, inp) {
  const opt = s.validPlotAggOpt(inp)
  const {Z: Z_key, X: X_key, agg} = opt
  await d.datLoad(sig, d.DAT, opt)

  ui.MEDIA.add(new LivePlotter(function plotOpts() {
    const facts = d.datQueryFacts(d.DAT, opt)
    const data = s.plotAggFromFacts({facts, Z_key, X_key, agg})
    return plotOptsWith({data, inp})
  }))
}

// TODO: avoid updating when the dat change doesn't affect the current plot.
export async function cmdPlotCloud(sig, inp) {
  const fb = await import(`./fb.mjs`)
  const {data} = await u.wait(sig, fb.fbCall(`plotAgg`, inp))
  ui.MEDIA.add(new Plotter(plotOptsWith({data, inp})))
}

export function plotOptsWith({data, inp}) {
  a.reqArr(data)
  a.reqDict(inp)

  const agg = s.AGGS.get(inp.agg)
  const [X_row, Z_labels, Z_X_Y_arr] = data
  const Z_rows = a.map(Z_labels, plotLabelTitle).map((val, ind) => serieWithAgg(val, ind, agg))

  // Hide the total serie by default.
  // TODO: when updating a live plot, preserve series show/hide state.
  if (Z_rows[0]) Z_rows[0].show = false

  return {
    ...LINE_PLOT_OPTS,
    plugins: plugins(),
    // TODO human readability.
    title: `${inp.agg} of ${inp.Y} per ${inp.Z} per ${inp.X}`,
    series: [{label: inp.X}, ...Z_rows],
    data: [X_row, ...Z_X_Y_arr],
    axes: axes(inp.X, inp.Y),
  }
}

/*
Converts CLI args to a format suitable for the cloud function `plotAgg` or its
local equivalent. This is an intermediary data format. See `validPlotAggOpt`
which validates and converts this to the final representation used by querying
functions.
*/
export function plotAggCliArgsDecode(src) {
  const out = a.Emp()
  out.where = a.Emp()
  out.runLatest = false
  out.userCurrent = false

  for (const [key, val] of a.tail(u.cliDecode(src))) {
    if (key === `-p`) {
      const preset = PLOT_PRESETS.get(u.reqEnum(key, val, PLOT_PRESETS))
      a.patch(out, preset)
      continue
    }

    if (key === `-s`) {
      u.assUniq(out, `src`, `-s`, u.reqEnum(key, val, PLOT_AGG_SRC))
      continue
    }

    if (key === `-x`) {
      u.assUniq(out, `X`, `-x`, u.reqEnum(key, val, s.ALLOWED_X_KEYS))
      continue
    }

    if (key === `-y`) {
      u.assUniq(out, `Y`, `-y`, u.reqEnum(key, val, s.ALLOWED_Y_STAT_TYPES))
      continue
    }

    if (key === `-z`) {
      u.assUniq(out, `Z`, `-z`, u.reqEnum(key, val, s.ALLOWED_Z_KEYS))
      continue
    }

    if (key === `-a`) {
      u.assUniq(out, `agg`, `-a`, u.reqEnum(key, val, s.AGGS))
      continue
    }

    if (!key) {
      throw Error(`plot args must be one of: "-flag", "-flag=val", or "field=val", got ${a.show(val)}`)
    }

    if (key === `userId`) {
      if (val === `current`) {
        out.userCurrent = true
        continue
      }
      u.dictPush(out.where, key, val)
      continue
    }

    if (key === `run`) {
      if (val === `latest`) {
        out.runLatest = true
        continue
      }
      const int = u.toIntOpt(val)
      if (a.isSome(int)) u.dictPush(out.where, `runNum`, int)
      else u.dictPush(out.where, `runId`, val)
      continue
    }

    if (key === `round`) {
      const int = u.toIntOpt(val)
      if (a.isSome(int)) u.dictPush(out.where, `roundNum`, int)
      else u.dictPush(out.where, `roundId`, val)
      continue
    }

    if (key === `runId`) {
      if (val === `latest`) {
        out.runLatest = true
        continue
      }
      u.dictPush(out.where, key, val)
      continue
    }

    if (key === `runNum`) {
      const int = u.toIntOpt(val)
      if (a.isNil(int)) throw Error(`"runNum" must be an integer, got: ${a.show(val)}`)
      u.dictPush(out.where, key, int)
      continue
    }

    if (key === `roundNum`) {
      const int = u.toIntOpt(val)
      if (a.isNil(int)) throw Error(`"roundNum" must be an integer, got: ${a.show(val)}`)
      u.dictPush(out.where, key, int)
      continue
    }

    u.reqEnum(`plot filters`, key, s.ALLOWED_FILTER_KEYS)

    /*
    Inputs: `one=two one=three four=five`.
    Outputs: `{one: ["two", "three"], four: ["five"]}`.
    SYNC[field_pattern].
    */
    u.dictPush(out.where, key, val)
  }

  out.src ||= PLOG_AGG_OPT_DEF_SRC
  out.X ||= PLOG_AGG_OPT_DEF_X
  out.Y ||= PLOG_AGG_OPT_DEF_Y
  out.Z ||= PLOG_AGG_OPT_DEF_Z
  out.agg ||= PLOG_AGG_OPT_DEF_AGG
  return out
}

export const PLOT_AGG_SRC = new Set([`local`, `cloud`])
export const PLOG_AGG_OPT_DEF_SRC = a.head(PLOT_AGG_SRC)
export const PLOG_AGG_OPT_DEF_X = `roundNum`
export const PLOG_AGG_OPT_DEF_Y = s.STAT_TYPE_DMG_DONE
export const PLOG_AGG_OPT_DEF_Z = `buiTypeUpg`
export const PLOG_AGG_OPT_DEF_AGG = a.head(a.keys(s.AGGS))

export const PLOT_PRESETS = new Map()
  .set(`dmg`, {X: PLOG_AGG_OPT_DEF_X, Y: s.STAT_TYPE_DMG_DONE, Z: PLOG_AGG_OPT_DEF_Z, agg: `sum`})
  .set(`eff`, {X: PLOG_AGG_OPT_DEF_X, Y: s.STAT_TYPE_COST_EFF, Z: PLOG_AGG_OPT_DEF_Z, agg: `avg`})

/*
Goal: if FS is inited and we have an actual latest run, show its analysis.
Otherwise, show a sample run for prettiness sake.
*/
export async function plotDefault({sig}) {
  try {
    if (await fs.loadedHistoryDir()) {
      await cmdPlot({sig, args: `plot run=latest`})
      return
    }
  }
  catch (err) {
    if (u.LOG_VERBOSE) u.log.err(`error analyzing latest run: `, err)
    u.log.verb(`unable to plot latest run, plotting example run`)
  }
  await plotExampleRun()
}

export async function plotExampleRun() {
  const runId = `example_run`
  const rounds = await u.jsonDecompressDecode(await u.fetchText(
    new URL(`../data/example_run.gd`, import.meta.url)
  ))
  if (!a.len(rounds)) throw Error(`internal error: missing chart data`)

  const dat = a.Emp()
  s.datInit(dat)

  for (const round of rounds) {
    s.datAddRound({dat, round, runId, runNum: 0, userId: d.USER_ID})
  }

  const inp = plotAggCliArgsDecode()
  delete inp.src

  const {Z: Z_key, X: X_key, where, agg} = s.validPlotAggOpt(inp)
  const facts = d.datQueryFacts(dat, where)
  const data = s.plotAggFromFacts({facts, Z_key, X_key, agg})
  const opts = plotOptsWith({data, inp})

  opts.title = `example run analysis: ` + opts.title
  ui.MEDIA.add(new Plotter(opts))
}

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

export class LivePlotter extends Plotter {
  constructor(fun) {
    super(fun())
    this.fun = fun
  }

  init() {
    super.init()
    this.unsub = u.listenMessage(d.DAT, this.onDatMsg.bind(this))
  }

  deinit() {
    this.unsub?.()
    super.deinit()
  }

  onDatMsg(src) {
    if (!this.isConnected) {
      console.error(`internal error: ${a.show(this)} received a dat event when not connected to the DOM`)
      return
    }

    const opts = this.fun(src)
    if (!opts) return

    this.opts = opts
    this.init()
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

export function serieWithAgg(label, ind, agg) {
  a.reqFun(agg)

  return {
    ...serie(label, ind),
    value(plot, val, ind) {
      return serieFormatVal(plot, val, ind, agg)
    },
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

// See comment in `serie` why we don't format the value here.
export function serieFormatVal(plot, val, seriesInd, agg) {
  a.reqInt(seriesInd)
  a.reqFun(agg)
  const ind = plot.cursor.idx
  if (a.isInt(ind) && ind >= 0) return a.laxFin(val)
  return plot.data[seriesInd].reduce(agg, 0)
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

/*
Converts labels such as `CB01_ABA` into the likes of `Bunker_ABA`. We could
generate and store those names statically, but doing this dynamically seems
more reliable, considering that new entities may be added later. Updating the
table of codes is easier than updating the data.
*/
export function plotLabelTitle(val) {
  const [pre, suf] = a.laxStr(val).split(`_`, 2)
  return u.joinKeys(c.CODES_SHORT[pre] || pre, suf)
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

function BtnPromptAppendPlot(val) {return ui.BtnPromptAppend(val, `plot`)}

function PresetHelp([key, val]) {
  return [
    BtnPromptAppendPlot(`-p=${key}`),
    ` -- same as `,
    BtnPromptAppendPlot(`-x=${val.X} -y=${val.Y} -z=${val.Z} -a=${val.agg}`),
  ]
}

function FlagAppendBtns(src, flag, def) {
  a.reqValidStr(flag)
  a.reqValidStr(def)
  return a.keys(src).map(key => [
    BtnPromptAppendPlot(`${flag}=${key}`),
    a.vac(key === def) && ` (default)`,
  ])
}
