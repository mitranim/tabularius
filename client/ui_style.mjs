import * as a from '@mitranim/js/all.mjs'
import * as tw from '@twind/core'
import tt from '@twind/preset-tailwind'
import tp from '@twind/preset-autoprefix'
import * as ttc from '@twind/preset-tailwind/colors.js'
import * as u from './util.mjs'

const namespace = globalThis.tabularius ??= a.Emp()
namespace.lib ??= a.Emp()
namespace.lib.tw = tw
namespace.lib.tt = tt
namespace.lib.ttc = ttc

/*
Add missing colors. Reference: https://tailwindcss.com/docs/colors

Twind accepts colors only in the hex and legacy HSL formats. Tailwind classes
are defined in `oklah` by default. When experimenting with colors in the
`oklah` format, use https://oklch.com for converting between `oklah` and hex.
Beware of browser devtools: at the time of writing, in Chrome 135 devtools,
conversion to `oklah` from many other formats (tested with hex and `hsl`)
often produces incorrect results.
*/
ttc.red[950] = `#450a0a`
ttc.orange[950] = `#431407`
ttc.amber[950] = `#451a03`
ttc.yellow[950] = `#422006`
ttc.lime[950] = `#1a2e05`
ttc.green[950] = `#052e16`
ttc.emerald[950] = `#022c22`
ttc.teal[950] = `#042f2e`
ttc.cyan[950] = `#083344`
ttc.sky[950] = `#082f49`
ttc.blue[950] = `#172554`
ttc.indigo[950] = `#1e1b4b`
ttc.violet[950] = `#2e1065`
ttc.purple[950] = `#3b0764`
ttc.fuchsia[950] = `#4a044e`
ttc.pink[950] = `#500724`
ttc.rose[950] = `#4c0519`
ttc.slate[950] = `#020617`
ttc.gray[950] = `#030712`
ttc.zinc[950] = `#09090b`
ttc.neutral[950] = `#0a0a0a`
ttc.stone[950] = `#0c0a09`

const GRID_AND_FLEX_CALC = `calc(var(--grid-col-wid) - var(--grid-pad-hor, 0px) * 2)`

/*
Should be kept minimal. Contains styles which are bothersome to implement with
Tailwind classes.

Also contains styles for plots rendered with the Uplot library. Adapted from the
original styles, with some modifications. We style the legend very differently.
We could import the original Uplot styles and add overrides, but styling from
scratch is cleaner and more controllable. Original styles:

  https://github.com/leeoniya/uPlot/blob/1c3000ce41943a75046420959e61b73dad992dbe/src/uPlot.css
  <link rel="stylesheet" href="https://esm.sh/uplot@1.6.27/dist/uPlot.min.css">
*/
export const STYLE = document.createElement(`style`)

STYLE.textContent = `
`+/* Make "[hidden]" take priority over CSS classes which set "display". */`
[hidden] {display: none !important}

`+/*
Make the font crisper. Default monospace fonts tend to be thicc.
May only work on some platforms and for some fonts.
*/`
:root {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: geometricPrecision;
}

`+/* SYNC[bord_color]. */`
:root {
  --border-color: ${a.reqValidStr(ttc.gray[300])};
  @media (prefers-color-scheme: dark) {--border-color: ${a.reqValidStr(ttc.neutral[700])}}
}

`+/*
Caution: in Safari (tested in version 18.3), for this particular grid,
`auto-fit` doesn't seem to work; children have no width. Only `auto-fill`
seems to work. This problem doesn't seem to occur in other grids.
*/`
.grid-auto {
  display: grid;
  padding-left: var(--grid-pad-hor);
  padding-right: var(--grid-pad-hor);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, ${GRID_AND_FLEX_CALC}), 1fr));
  > * {min-width: 0}

  `+/*
  This hack was suggested by Gemini:

    https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221rmJConq92u7i1ORAti4H2Fp-melFicsx%22%5D,%22action%22:%22open%22,%22userId%22:%22116685435269007578997%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing

  It avoids having single regular items dangling before or after items which
  span all columns.
  */`
  > .span-all,
  > :not(.span-all):first-child:has(+ .span-all),
  > .span-all + :not(.span-all):has(+ .span-all),
  > .span-all + :not(.span-all):last-child {
    grid-column: 1 / -1;
  }
}

.drag::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  border: 4px dashed var(--border-color);
  pointer-events: none;
}

`+/*
In Chromium, the `<summary>` marker is disabled when changing its `display`
property from the default. Safari and FF require CSS rules.
*/`
summary::marker {display: none;}
summary::-webkit-details-marker {display: none;}

dialog:not([open]) {display: none}

dialog[open] {
  &::backdrop {backdrop-filter: blur(6px)}
  outline: 0.5rem solid var(--outline-color);
  --outline-color: hsl(200deg 50% 30% / 20%);
  @media (prefers-color-scheme: dark) {
    --outline-color: hsl(200deg 50% 80% / 20%);
  }
}

.uplot, .u-wrap, .u-wrap *, .u-legend, .u-legend * {
  all: unset;
  box-sizing: border-box;
  line-height: 1;
  overflow: clip;
}

.uplot, .u-wrap, .u-wrap canvas, .u-legend {
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: stretch;
  width: 100%;
}

.u-title {
  white-space: pre-wrap;
  text-align: center;
  line-height: 1.5;
  padding: 0.5rem;
}

.u-wrap {
  position: relative;
  user-select: none;
  aspect-ratio: 16/9;
}

.u-over, .u-under, .u-axis {
  position: absolute;
}

`+/* Unchanged from default. */`
.u-select {
  background: rgba(0, 0, 0, 0.07);
  position: absolute;
  pointer-events: none;
}

@media(prefers-color-scheme: dark) {
  .u-select {background: rgba(255, 255, 255, 0.07)}
}

.u-wrap canvas {
  position: relative;
  height: 100%;
}

`+/* Unchanged from default. */`
.u-cursor-x, .u-cursor-y {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  will-change: transform;
}

`+/* Unchanged from default. */`
.u-hz .u-cursor-x,
.u-vt .u-cursor-y {
  height: 100%;
  border-right: 1px dashed #607D8B;
}

`+/* Unchanged from default. */`
.u-hz .u-cursor-y,
.u-vt .u-cursor-x {
  width: 100%;
  border-bottom: 1px dashed #607D8B;
}

`+/* Unchanged from default. */`
.u-cursor-pt {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50%;
  border: 0 solid;
  pointer-events: none;
  will-change: transform;
  background-clip: padding-box !important;
}

`+/* Unchanged from default. */`
.u-axis.u-off,
.u-select.u-off,
.u-cursor-x.u-off,
.u-cursor-y.u-off,
.u-cursor-pt.u-off {display: none}

.u-legend.u-inline.u-live {
  tbody {
    `+/* Match the plot padding. */`
    padding: 1rem;
    width: 100%;
    overflow: clip;
    display: grid;
    column-gap: 1rem;
    `+/* SYNC[plot_grid_column_len]. */`
    grid-template-columns: repeat(auto-fit, minmax(20ch, 1fr));
    justify-content: space-between;

    tr {
      min-width: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.3rem;

      &.u-off > * {opacity: 0.3}

      th {
        flex: 0 1 auto; /* Don't grow but allow shrinking. */
        min-width: 0; /* Enable shrinking below intrinsic size. */
        white-space: nowrap;
        overflow: clip;
        text-overflow: ellipsis;
        text-align: left;
        padding-top: 0.2rem;
        padding-bottom: 0.2rem;
        cursor: pointer;

        div {
          display: inline;
          min-width: 0;
        }

        .u-inline.u-live &::after {content: ':'}
      }

      td {
        flex: 1 0 auto;
        text-align: right;
      }
    }
  }
}
`

document.head.appendChild(STYLE)

export const TWIND = tw.twind({
  presets: [tp(), tt()],
  hash: false,
  theme: {
    extend: {
      animation: {
        'flash-light': `flash-light 1s ease-out`,
        'flash-dark': `flash-dark 1s ease-out`,
      },
      keyframes: {
        'flash-light': {
          '0%, 100%': {backgroundColor: `transparent`},
          '20%': {backgroundColor: `oklch(0.945 0.129 101.54)`}, // yellow-200
        },
        'flash-dark': {
          '0%, 100%': {backgroundColor: `transparent`},
          '20%': {backgroundColor: `oklch(0.476 0.114 61.907)`}, // yellow-800
        },
      },
    },
  },

  ignorelist: a.arr(findCssClasses(STYLE.textContent)),

  rules: [
    /*
    Callers MUST also set width.

    Uses `over-clip` rather than `overflow-hidden` because the latter
    creates a new formatting context, requiring additional `align-top` or
    `align-bottom` to avoid messing up alignment for other elements on the
    same line. `over-clip` seems strictly superior.
    */
    [`trunc`, `inline-block trunc-base`],

    /*
    For elements with their own `display` property, such as table cells.
    Caller must ensure that `display` is not `inline`.
    */
    [`trunc-base`, `text-clip text-ellipsis`],
    [`text-clip`, `min-w-0 whitespace-pre overflow-x-clip`],

    // Requires either `flex` or `inline-flex`.
    [`cen`, `row-cen-cen text-center`],

    [`row-sta-cen`, `flex-row justify-start items-center`],
    [`row-cen-cen`, `flex-row justify-center items-center`],
    [`row-bet-cen`, `flex-row justify-between items-center`],
    [`row-bet-str`, `flex-row justify-between items-stretch`],
    [`row-end-cen`, `flex-row justify-end items-center`],
    [`row-end-sta`, `flex-row justify-end items-start`],
    [`row-end-end`, `flex-row justify-end items-end`],
    [`row-cen-str`, `flex-row justify-center items-stretch`],
    [`col-cen-cen`, `flex-col justify-center items-center`],
    [`col-cen-sta`, `flex-col justify-center items-start`],
    [`col-sta-sta`, `flex-col justify-start items-start`],
    [`col-sta-str`, `flex-col justify-start items-stretch`],
    [`col-sta-cen`, `flex-col justify-start items-center`],
    [`col-sta-end`, `flex-col justify-start items-end`],
    [`over-wrap`, {overflowWrap: `anywhere`}],
    [`shrink-(0|1)`, `flex-shrink`],
    [`weight-unset`, {fontWeight: `unset`}],
    [`@container`, () => ({'container-type': `inline-size`})],

    [/^hide-below-\[(?<size>.*)\]$/, ({groups: {size}}) => {
      const key = `@container (inline-size < ${size})`
      return {[key]: {display: `none`}}
    }],

    [/^hide-above-\[(?<size>.*)\]$/, ({groups: {size}}) => {
      const key = `@container (inline-size >= ${size})`
      return {[key]: {display: `none`}}
    }],

    [/^grid-child-wide-\[(?<size>.*)\]$/, ({groups: {size}}) => {
      const key = `@container (inline-size >= ${size})`
      return {[key]: {gridColumn: `span 2`}}
    }]
  ],
}, tw.getSheet(!u.DEV))

function findCssClasses(src) {
  return new Set(a.reqStr(src).match(/(?<!\d)(?<=\.)[a-z-][\w-]*/gi))
}

// SYNC[bord_color].
export const CLS_BORD = `border-gray-300 dark:border-neutral-700`
export const CLS_BORD_BRIGHT = `border-gray-500 dark:border-neutral-500`

export const CLS_FG = `text-black dark:text-white`
export const CLS_BG_ROOT = `bg-gray-50 dark:bg-stone-950`

/*
When stacking elements, we can alternate the themes.
This dark background is somewhere between stone-950 and stone-900.
*/
export const CLS_BG_0 = `bg-gray-50 dark:bg-[#121110]`
export const CLS_BG_HOVER_0 = `hover:bg-gray-100 dark:hover:bg-stone-800`

export const CLS_BG_1 = `bg-gray-100 dark:bg-stone-900`
export const CLS_BG_HOVER_1 = `bg-gray-200 dark:bg-stone-700`
export const CLS_THEME_1 = a.spaced(CLS_BG_1, CLS_FG)

export const CLS_TEXT_MUTED = `text-gray-500 dark:text-neutral-400`
export const CLS_TEXT_MUTED_BUSY = a.spaced(CLS_TEXT_MUTED, `hover:text-gray-800 dark:hover:text-neutral-200`)

export const CLS_TEXT_PALE = `text-gray-300 dark:text-neutral-700`
// export const CLS_TEXT_PALE = `text-gray-400 dark:text-neutral-600`

export const CLS_BTN_INLINE_BASE = `text-sky-700 dark:text-sky-300 hover:underline hover:decoration-dotted cursor-pointer text-left`
export const CLS_BTN_INLINE = a.spaced(`inline`, CLS_BTN_INLINE_BASE)
export const CLS_ERR = `text-red-600 dark:text-red-500`

export const ICON_BTN_SIZE = `1em`

/*
When using an SVG in a button, this must be set on BOTH.
Otherwise dimensions and vertical alignment are out of whack.
The `display: inline` property seems optional but added just in case.
*/
export const CLS_INLINE_ICON = `inline w-[${ICON_BTN_SIZE}] h-[${ICON_BTN_SIZE}] align-text-top`

export const CLS_UNDER_TWEAKS = `decoration-1 underline-offset-4`
export const CLS_BUSY_UNDER = a.spaced(CLS_UNDER_TWEAKS, `cursor-pointer underline decoration-dotted hover:decoration-solid`)
export const CLS_BUSY_UNDER_OPT = a.spaced(CLS_UNDER_TWEAKS, `cursor-pointer hover:underline hover:decoration-dotted`)
export const CLS_BUSY_BG = `hover:bg-neutral-300 dark:hover:bg-neutral-700`
export const CLS_BUSY_BG_SELECTED = `bg-neutral-200 dark:bg-neutral-800 underline decoration-dashed underline-offset-4`
export const CLS_HELP_UNDER = a.spaced(CLS_UNDER_TWEAKS, `cursor-help underline decoration-dotted`)
export const CLS_BUSY_BTN = a.spaced(CLS_FG, `bg-neutral-200 dark:bg-stone-700 hover:bg-gray-300 dark:hover:bg-stone-600`)
export const CLS_BUSY_BTN_NEUT = a.spaced(CLS_FG, `bg-neutral-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600`)

// Used for hiding and showing parts of media items, such as table columns.
// Should be slightly wider than `MEDIA_ITEM_WID`.
export const WIDE_BREAKPOINT = `48rem`
export const CLS_ONLY_WIDE = `hide-below-[${WIDE_BREAKPOINT}]`
export const CLS_ONLY_NARROW = `hide-above-[${WIDE_BREAKPOINT}]`

export function clsWide(wide) {
  if (a.isNil(wide)) return undefined
  return a.optBool(wide) ? CLS_ONLY_WIDE : CLS_ONLY_NARROW
}
