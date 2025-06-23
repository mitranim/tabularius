/*
Work in progress.

- [x] Table type: building stats.
- [x] Table type: child stats.
- [x] Table type: weapon details.
- [x] Tabs for switching between table types.
- [x] Fix tooltip stucking.
- [x] Long-toggle rows.
- [x] Settings and hints: implement appropriately for this UI.
- [x] Ability to toggle each column off / on.
  - [x] Via dialog.
  - [x] Only columns suitable for current table type (stats vs wep details).
  - [x] When any columns are disabled, also disable the "hide narrow" feature.
- [x] Weapon details: add calculated damage against Air and Shield.
- [x] Weapon details: consider estimating ideal single-target DPS.
- [ ] CLI option to choose default table type.
- [ ] Colors! More colors.
  - [ ] Assign specific colors to specific entities, like in plots, or:
  - [ ] Implement a heatmap. Maybe assign a color per stat type, and shade it.
- [ ] Update help. The help for each version of the command should mention the
  other version of the command.
*/

import * as a from '@mitranim/js/all.mjs'
import * as s from '../shared/schema.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as ui from './ui.mjs'
import * as sr from './show_round_combined.mjs'

import * as self from './show_round_split.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.srs = self
a.patch(globalThis, namespace)

cmdShowRoundSplit.cmd = `show_round`
cmdShowRoundSplit.desc = `detailed breakdown of one round`
cmdShowRoundSplit.help = function cmdShowRoundCombinedHelp() {
  return sr.cmdShowRoundHelp(cmdShowRoundSplit)
}

export function cmdShowRoundSplit({sig, args}) {
  return sr.cmdShowRound({sig, cmd: cmdShowRoundSplit, args, View: ShowRound})
}

export const TABLE_TYPE = u.storageObs(`tabularius.round_table.type`)
export const TABLE_TYPE_BUI = `bui`
export const TABLE_TYPE_CHI = `chi`
export const TABLE_TYPE_WEP = `wep`
export const TABLE_TYPES = new Set([TABLE_TYPE_BUI, TABLE_TYPE_CHI, TABLE_TYPE_WEP])

// SYNC[bui_stat_types].
export const BUI_COLS = [
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_DONE,     type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_DONE_ACC, type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_OVER,     type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_OVER_ACC, type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_COST_EFF,     type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_COST_EFF_ACC, type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_EFF,      type: sr.TYPE_PERC})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_EFF_ACC,  type: sr.TYPE_PERC})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DPS,          type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DPS_ACC,      type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: `bui_cost`,               type: sr.TYPE_NUM})),
]

// SYNC[stat_types].
export const CHI_COLS = [
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_DONE,     type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_DONE_ACC, type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_OVER,     type: sr.TYPE_NUM})),
  withSortObs(withToggleObs({key: s.STAT_TYPE_DMG_OVER_ACC, type: sr.TYPE_NUM})),
]

// SYNC[wep_cols].
export const WEP_COLS = [
  withToggleObs({sortObs: sr.WEP_SORT, key: `bui_type`,     type: sr.TYPE_HELP, colspan: 2, props: {cls: ui.CLS_TEXT_MUTED}}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `wep_type`,     type: sr.TYPE_HELP, colspan: 2}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `range`,        type: sr.TYPE_ANY}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `mag`,          type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `rof`,          type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `rel`,          type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dmg_base`,     type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dmg`,          type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dmg_air`,      type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dmg_shld`,     type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `perc_dmg`,     type: sr.TYPE_PERC_MOD}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `perc_air`,     type: sr.TYPE_PERC_MOD}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `perc_shld`,    type: sr.TYPE_PERC_MOD}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dps_est`,      type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dps_air_est`,  type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `dps_shld_est`, type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `aoe`,          type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `targ`,         type: sr.TYPE_NUM}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `prio`,         type: sr.TYPE_PRIO}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `det`,          type: sr.TYPE_BOOL}),
  withToggleObs({sortObs: sr.WEP_SORT, key: `enab`,         type: sr.TYPE_BOOL}),
]

const DIALOG_BUI = ColumnToggleDialog(BUI_COLS)
const DIALOG_CHI = ColumnToggleDialog(CHI_COLS)
const DIALOG_WEP = ColumnToggleDialog(WEP_COLS)

class ShowRound extends sr.ShowRound {
  tableType = undefined

  constructor(opt) {
    const dat = a.Emp()
    s.datAddRound({...opt, dat, composite: false, tables: {round_buis: true}})
    opt.roundBuis = dat.round_buis

    super(opt)

    let type = a.deref(TABLE_TYPE)
    if (!TABLE_TYPES.has(type)) type = TABLE_TYPE_BUI
    this.tableType = a.obsRef(type)
  }

  init() {
    const {opt, tableType} = this
    return E(this, {chi: [
      E(sr.RoundHead, {
        ...opt,
        chi: E(sr.TableHintsAndControls, [
          [E(sr.TableHintHidden), E(sr.TableHintSort)],
          E(sr.TableControlMissingLast),
          E(sr.TableControlWide),
          E(sr.TableControlLong, `row`),
        ]),
      }),
      E(Tabs, tableType),
      a.bind(SelectedTable, tableType, opt),
    ]})
  }
}

function Tabs(obs) {
  return E(`div`, {
    class: `w-full flex row-cen-cen rounded mb-2`,
    chi: [
      E(Tab, {obs, val: TABLE_TYPE_BUI, dialog: DIALOG_BUI, chi: `bui_stats`}),
      E(Tab, {obs, val: TABLE_TYPE_CHI, dialog: DIALOG_CHI, chi: `chi_stats`}),
      E(Tab, {obs, val: TABLE_TYPE_WEP, dialog: DIALOG_WEP, chi: `wep_details`}),
    ],
  })
}

function Tab({obs, val, dialog, chi}) {
  return E(`span`, {
    class: `inline-flex row-cen-str`,
    chi: [
      TabBtn({obs, val, chi}),
      () => a.vac(a.deref(obs) === val) && ColumnToggler(dialog),
    ],
  })
}

function TabBtn({obs, val, chi}) {
  a.reqInst(obs, a.ObsRef)
  a.reqValidStr(val)

  return E(`button`, {
    type: `button`,
    role: `tab`,
    class: () => a.spaced(
      `inline-flex cen p-2 cursor-pointer`,
      ui.CLS_BUSY_BG,
      a.vac(a.deref(obs) === val) && ui.CLS_BUSY_BG_SELECTED,
    ),
    onclick() {
      a.reset(obs, val)
      a.reset(TABLE_TYPE, val)
    },
    chi,
  })
}

function ColumnToggler(dialog) {
  return ui.withTooltip(
    E(`button`, {
      type: `button`,
      class: a.spaced(
        `inline-flex cen px-2 py-1 cursor-pointer relative`,
        ui.CLS_BUSY_BG,
      ),
      onclick() {
        document.body.appendChild(dialog)
        dialog.showModal()
      },
      chi: ui.Svg(`table`, {class: `w-6 h-6`}),
    }),
    {chi: `toggle columns`},
  )
}

function ColumnToggleDialog(cols) {
  return E(`dialog`, {
    class: a.spaced(`flex col-sta-str p-0 rounded`, ui.CLS_FG, ui.CLS_BG_1),
    closedby: `any`,
    chi: a.map(cols, a.bind(ColToggle, cols)),
  })
}

function ColToggle(cols, {key, toggleObs}) {
  a.reqArr(cols)
  a.reqValidStr(key)
  a.reqInst(toggleObs, u.StorageObsBool)

  return E(ui.ObsCheckbox, {
    obs: toggleObs,
    label: ui.withTooltip(ui.Span(key), {
      chi: sr.STAT_GLOSSARY[key], under: true, help: false,
    }),
    cls: a.spaced(`gap-x-4 px-3 py-2`, ui.CLS_BUSY_BG),
  })
}

function SelectedTable(type, opt) {
  type = a.deref(type)
  if (type === TABLE_TYPE_BUI) return E(BuiTable, opt)
  if (type === TABLE_TYPE_CHI) return E(ChiTable, opt)
  if (type === TABLE_TYPE_WEP) return E(WepTable, opt)

  return E(`div`, {
    class: a.spaced(ui.CLS_ERR, `w-full p-4 flex row-cen-cen`),
    chi: [`unrecognized table type `, a.show(type)],
  })
}

function BuiTable(opt) {
  const data = buiData({...opt, cols: BUI_COLS})
  const {rows, cols} = data

  return E(`table`, {
    class: ui.CLS_TABLE,
    chi: [
      E(`thead`, {chi: a.map(cols, HeadCell)}),
      E(StatTableBody, {
        data,
        chi: E(LongToggleRow, {count: rows.length, cols, type: `buildings`}),
      }),
    ],
  })
}

function ChiTable(opt) {
  const data = chiData({...opt, cols: CHI_COLS})
  const {rows, cols} = data

  return E(`table`, {
    class: ui.CLS_TABLE,
    chi: [
      E(`thead`, {chi: a.map(cols, HeadCell)}),
      E(StatTableBody, {
        data,
        chi: E(LongToggleRow, {count: rows.length, cols, type: `children`}),
      }),
    ],
  })
}

function StatTableBody({data, chi}) {
  const {rows} = data
  return E(`tbody`, {chi: [a.times(rows.length, a.bind(StatRow, data)), chi]})
}

function StatRow({rows, cols, total}, rowInd) {
  return E(`tr`, {
    ...rowProps(rowInd),
    chi: cols.map(a.bind(StatCell, {rows, cols, total, rowInd})),
  })
}

function rowProps(ind) {
  a.reqNat(ind)
  return {
    class: ui.CLS_ROW_TOP,
    hidden: a.vac(ind > sr.LONG_ROW_BREAKPOINT) && (() => !a.deref(sr.LONG)),
  }
}

function WepTable(opt) {
  const data = wepData({...opt, cols: WEP_COLS})
  const {rows, cols} = data

  return E(`table`, {
    class: ui.CLS_TABLE,
    chi: [
      E(`thead`, {chi: a.map(cols, HeadCell)}),
      E(WepTableBody, {
        data,
        chi: E(LongToggleRow, {count: rows.length, cols, type: `weapons`}),
      }),
    ],
  })
}

function WepTableBody({data, chi}) {
  const {cols, sorted} = a.reqDict(data)
  return E(`tbody`, {chi: [a.bind(WepRows, sorted, cols), chi]})
}

function WepRows(rows, cols) {
  rows = a.deref(rows)
  return a.reqArr(rows).map(a.bind(WepRow, cols))
}

function WepRow(cols, data, ind) {
  a.reqRec(data)
  return E(`tr`, {
    ...rowProps(ind),
    chi: a.reqArr(cols).map((col, ind) => sr.Td({data, col, ind})),
  })
}

function HeadCell(col) {
  const {key, sortObs, props} = col

  return E(ui.ThWithSort, {
    ...props,
    ...ui.withCls(sr.cellProps(col), ui.CLS_CELL_HEAD, `font-normal`),
    key, sortObs,
    chi: [
      a.bind(ui.SortIndicator, key, sortObs),
      ui.withGlossary(ui.Span(key), {key, glos: sr.STAT_GLOSSARY, under: true}),
    ],
  })
}

function StatCell({rows, cols, total, rowInd}, col, colInd) {
  const {type, props} = col

  return E(`td`, {
    ...props,
    ...sr.cellProps(col),
    chi: E(`span`, {
      class: a.spaced(ui.CLS_CELL_PAD, `flex row-bet-cen`),
      chi: a.bind(
        StatCellInner,
        {rows, cols, total, type, rowInd, colInd},
      ),
    }),
  })
}

/*
TODO: either support percentages like in `show_round_combined`,
or don't bother building `total`.
*/
function StatCellInner({rows, cols, total: __, type, rowInd, colInd}) {
  const {val, rowInd: cellRowInd} = a.deref(cols[colInd].sorted)[rowInd]
  const label = rows[cellRowInd]

  return [
    ui.withTooltip(
      E(`span`, {class: a.spaced(ui.CLS_TEXT_MUTED, `trunc`), chi: label}),
      {chi: label},
    ),
    E(`span`, {class: `whitespace-pre`, chi: sr.fmtVal(type, val)}),
  ]
}

function LongToggleRow({count, cols, type}) {
  const limit = sr.LONG_ROW_BREAKPOINT
  if (count <= limit) return undefined
  return E(sr.LongToggleRow, {count, limit, type, cols})
}

// TODO: dedup with `chiData`.
function buiData({cols, round, roundBuis}) {
  cols = a.map(cols, makeStatCol)
  const rows = []
  const total = a.Emp()
  let rowInd = -1

  for (const buiInst of a.keys(round.Buildings)) {
    rowInd++

    const roundBui = a.reqDict(roundBuis[buiInst])
    const stats = a.optDict(roundBui.stats)
    const label = s.codedToNamed(`bui_type_upg`, a.reqValidStr(roundBui.bui_type_upg))

    for (const [colInd, {key}] of cols.entries()) {
      a.reqValidStr(key)
      const val = a.laxFin(stats?.[key])
      sr.addTotal(total, key, val)
      cols[colInd].cells.push({val, rowInd})
    }

    rows.push(label)
  }

  return {rows, cols, total}
}

// TODO: dedup with `buiData`.
function chiData({cols, round, roundBuis}) {
  cols = a.map(cols, makeStatCol)
  const rows = []
  const total = a.Emp()
  let rowInd = -1

  for (const [buiInst, bui] of a.entries(round.Buildings)) {
    rowInd++

    const {wepTypes, dumBulTypes, bui_type_upg} = a.reqDict(roundBuis[buiInst])
    const buiLabel = s.codedToNamed(`bui_type_upg`, bui_type_upg)

    // Linter false positive.
    // deno-lint-ignore no-inner-declarations
    function addRow(type, stats) {
      if (!a.optDict(stats)) return

      const data = sr.chiStatData({type, stats, total})
      const label = [buiLabel, `: `, data.chi_type]

      for (const [colInd, {key}] of cols.entries()) {
        const val = a.laxFin(data?.[key])
        sr.addTotal(total, key, val)
        cols[colInd].cells.push({val, rowInd})
      }

      rows.push(label)
    }

    for (const [ind, wep] of a.entries(bui.Weapons)) {
      const stats = bui.WeaponStats[ind]?.stats
      if (!sr.shouldShowWep(wep, stats)) continue
      addRow(wep.EntityID, stats)
    }

    for (const [type, val] of a.entries(bui.ChildLiveStats)) {
      if (wepTypes.has(type) || dumBulTypes.has(type)) continue
      addRow(type, val?.stats)
    }
  }

  return {rows, cols}
}

function wepData({cols, round, roundBuis}) {
  const rows = []

  for (const [buiInst, bui] of a.entries(round.Buildings)) {
    const {bui_type_upg} = a.reqDict(roundBuis[buiInst])
    const buiLabel = s.codedToNamed(`bui_type_upg`, bui_type_upg)

    for (const [ind, wep] of a.entries(bui.Weapons)) {
      const stats = bui.WeaponStats[ind]?.stats
      if (!sr.shouldShowWep(wep, stats)) continue

      const row = sr.wepDetailData(wep)
      row.bui_type = buiLabel
      rows.push(row)
    }
  }

  const sortObs = sr.WEP_SORT
  const sorted = a.calc(sortRecs, {sortObs, recs: rows})
  return {rows, cols, sorted}
}

function withSortObs(opt) {
  a.reqDict(opt)
  const key = a.reqValidStr(opt.key)
  opt.sortObs = ui.sortObs(`tabularius.sort.${key}`, {key, desc: true})
  return opt
}

function withToggleObs(opt) {
  a.reqDict(opt)
  const key = a.reqValidStr(opt.key)
  opt.toggleObs = u.storageObsBool(`tabularius.toggle.${key}`, true)
  return opt
}

function makeStatCol(src) {
  const cells = []
  const sortObs = a.reqInst(src.sortObs, ui.SortObs)
  const sorted = a.calc(sortCol, {sortObs, cells})
  return {...a.reqDict(src), cells, sorted}
}

function sortCol({sortObs, cells}) {
  const {desc} = a.deref(sortObs)
  if (a.isNil(desc)) return cells
  return a.sort(cells, a.bind(compareCells, desc))
}

function compareCells(desc, one, two) {
  a.optBool(desc)

  const fallback = a.reqFin(one.rowInd) - a.reqFin(two.rowInd)
  const oneVal = one.val
  const twoVal = two.val

  if (a.isNil(desc)) return fallback

  const miss = sr.compareMissing(oneVal, twoVal)
  if (miss) return miss
  return u.compareNumerically(oneVal, twoVal, desc) || fallback
}

function sortRecs({sortObs, recs}) {
  const {key, desc} = a.deref(sortObs)
  if (a.isNil(desc)) return recs
  return a.sort(recs, a.bind(compareRecs, key, desc))
}

function compareRecs(key, desc, one, two) {
  a.reqValidStr(key)
  one = a.reqRec(one)[key]
  two = a.reqRec(two)[key]

  const miss = sr.compareMissing(one, two)
  if (miss) return miss
  return u.compareNumerically(one, two, desc)
}
