import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as od from '@mitranim/js/obs_dom.mjs'
import * as gc from '../shared/game_const.mjs'
import * as s from '../shared/schema.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as d from './dat.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'

import * as self from './show_round.mjs'
const tar = window.tabularius ??= a.Emp()
tar.sr = self
a.patch(window, tar)

cmdShowRound.cmd = `show_round`
cmdShowRound.desc = `detailed breakdown of one round`
cmdShowRound.help = function cmdShowRoundHelp() {
  const saveDir = a.laxStr(fs.SAVE_DIR_CONF.handle?.name)
  const histDir = a.laxStr(fs.HISTORY_DIR_CONF.handle?.name)

  return ui.LogParagraphs(
    u.callOpt(cmdShowRound.desc),
    `usage:`,
    [
      `  `,
      os.BtnCmd(`show_round`),
      ` -- displays details of the latest round; checks the game's save directory (grant access via `,
      os.BtnCmdWithHelp(`saves`),
      `), falls back on the run history directory (create yourself, grant access via `,
      os.BtnCmdWithHelp(`history`), `)`,
    ],
    [
      `  `,
      (
        saveDir
        ? BtnAppend(u.paths.join(saveDir, fs.PROG_FILE_NAME))
        : BtnAppendEph(u.paths.join(`<saves>`, fs.PROG_FILE_NAME))
      ),
      ` -- show current state of save file; requires `,
      os.BtnCmdWithHelp(`saves`),
    ],
    [
      `  `,
      (
        histDir
        ? BtnAppend(u.paths.join(histDir, `latest/latest`))
        : BtnAppendEph(`<history>/latest/latest`)
      ),
      ` -- show latest round in latest run; requires `,
      os.BtnCmdWithHelp(`history`),
    ],
    [
      `  `,
      (
        histDir
        ? BtnAppend(
          u.paths.join(histDir, `latest`) + `/`,
          `<round_num>`,
        )
        : BtnAppendEph(`<history>/latest/<round_num>`)
      ),
      ` -- show specific round in latest run`,
    ],
    [
      `  `,
      (
        histDir
        ? BtnAppend(
          histDir + `/`,
          `<run_num>/<round_num>`,
        )
        : BtnAppendEph(`<history>/<run_num>/<round_num>`)
      ),
      ` -- show specific round in specific run`,
    ],
    [
      `when showing the game's progress file or the latest round file, the resulting table is "live": it automatically updates to the latest round when the `,
      os.BtnCmdWithHelp(`watch`),
      ` process detects changes and makes a new round backup`,
    ],
    [`tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse available files`],
  )
}

/*
The following is a placeholder. We plan to support cloud sources. We also want
to provide better help / error messages.
*/
export function cmdShowRound({sig, args}) {
  const cmd = cmdShowRound.cmd
  const inps = u.splitCliArgs(u.stripPreSpaced(args, cmd))
  if (u.hasHelpFlag(inps)) return os.cmdHelpDetailed(cmdShowRound)

  if (inps.length > 1) {
    ui.LOG.err(`too many inputs in `, ui.BtnPromptReplace({val: args}))
    return os.cmdHelpDetailed(cmdShowRound)
  }

  const path = inps[0]
  if (path) return showRoundAtPath({sig, path, args})
  return showRoundAny({sig, args})
}

export async function showRoundAtPath({sig, path, args}) {
  const {handle: file, path: resolvedPath} = await fs.handleAtPathFromTop({
    sig, path, magic: true,
  })

  if (!fs.isFile(file)) {
    throw new ui.ErrLog(`unable to show ${a.show(resolvedPath)}: not a file`)
  }

  // The overhead should be negligible.
  const saveDir = await fs.saveDirOpt(sig)
  const histDir = await fs.historyDirOpt(sig)
  const live = (
    resolvedPath === u.paths.join(a.laxStr(saveDir?.name), fs.PROG_FILE_NAME) ||
    resolvedPath === u.paths.join(a.laxStr(histDir?.name), `latest/latest`)
  )
  return showRoundFile({sig, file, args, live})
}

export async function showRoundAny({sig, args}) {
  const progFile = await fs.progressFileOpt(sig)
  let progRound

  if (progFile) {
    progRound = await fs.readDecodeGameFile(sig, progFile)

    /*
    The progress file is at round 0 with no useful data after ending a run.
    In such cases, we prefer to fall back on the latest round backup, below.
    */
    if (progRound?.RoundIndex) {
      return showRoundFile({sig, round: progRound, args, live: true})
    }
  }

  const histDir = await fs.historyDirOpt(sig)
  if (histDir) {
    const runDir = await fs.findLatestRunDir(sig, histDir)
    const roundFile = await fs.findLatestRoundFile(sig, runDir)
    if (roundFile) {
      return showRoundFile({sig, file: roundFile, args, live: true})
    }
  }

  /*
  When falling back on the latest round backup is unsuccessful, we use an
  existing progress file, if any.
  */
  if (progRound) return showRoundFile({sig, round: progRound, args, live: true})

  const saveDir = await fs.saveDirOpt(sig)

  if (!saveDir && !histDir) {
    throw new ui.ErrLog(
      `unable to show the latest round: need access to the `,
      os.BtnCmdWithHelp(`saves`), ` directory or the run `,
      os.BtnCmdWithHelp(`history`), ` directory`,
    )
  }

  if (!saveDir && histDir) {
    throw new ui.ErrLog(
      `unable to show the latest round: found no round files in the `,
      os.BtnCmdWithHelp(`history`), ` directory; lacking access to the `,
      os.BtnCmdWithHelp(`saves`), ` directory; grant access and build your run history by playing!`,
    )
  }

  /*
  This code should only be reachable if the user granted access to the saves
  directory, then the progress file somehow gets deleted. When picking the
  saves directory, we validate that the progress file is present.
  */
  throw new ui.ErrLog(
    `unable to show the latest round: missing file `,
    a.show(fs.PROG_FILE_NAME), ` in the `,
    os.BtnCmdWithHelp(`saves`), ` directory`,
  )
}

export async function showRoundFile({sig, file, round, args, live}) {
  u.reqSig(sig)
  a.optInst(file, FileSystemFileHandle)
  a.optDict(round)
  a.reqValidStr(args)
  a.optBool(live)

  round ??= await fs.readDecodeGameFile(sig, file)

  const user_id = round.tabularius_user_id || d.USER_ID
  const run_num = round.tabularius_run_num ?? 0
  const run_ms = round.tabularius_run_ms ?? Date.parse(round.LastUpdated)
  const run_id = s.makeRunId(user_id, run_num, run_ms)
  const out = new ShowRound({
    round, user_id, run_id, run_num, run_ms, args, live,
  }).init()
  return new os.Combo({mediaItems: [out]})
}

export const HIDE_BREAKPOINT = a.reqValidStr(ui.MEDIA_ITEM_WID)
export const CLS_HIDE_BELOW = `hide-below-[${HIDE_BREAKPOINT}]`
export const CLS_HIDE_ABOVE = `hide-above-[${HIDE_BREAKPOINT}]`
export const CLS_CELL_COMMON = `px-2 trunc-base text-left`

export const TYPE_ANY = undefined
export const TYPE_BOOL = `bool`
export const TYPE_NUM = `num`
export const TYPE_NUM_MOD = `num_mod`
export const TYPE_PERC = `perc`
export const TYPE_PERC_MOD = `perc_mod`

export const NUM_MODE_BOTH = ``
export const NUM_MODE_NUM = `num`
export const NUM_MODE_PERC = `perc`
export const NUM_MODES = [NUM_MODE_BOTH, NUM_MODE_NUM, NUM_MODE_PERC]

export const NUM_MODE = u.storageObs(`tabularius.show_round.num_mode`)
export const WIDE = u.storageObsBool(`tabularius.show_round.wide`)
export const LONG = u.storageObsBool(`tabularius.show_round.long`)
export const LONG_ROW_BREAKPOINT = 16

class ShowRound extends d.MixDatSub(ui.ReacElem) {
  opt = undefined

  constructor(opt) {
    super()
    this.opt = a.reqDict(opt)

    E(
      this,
      {class: `@container flex col-sta-str max-w-none text-sm gap-2`},
      new RoundHead(),
      TableHintsAndControls(),
      new RoundTable(),
    )
  }

  // Invoked by `MEDIA`.
  addCloseBtn(btn) {a.descendant(this, RoundHead).addCloseBtn(btn)}

  // Invoked on observable changes.
  run() {ui.MEDIA.toggleWide(this, WIDE.val)}

  init() {
    a.descendant(this, RoundHead).init(this.opt)
    a.descendant(this, RoundTable).init(this.opt)
    return this
  }

  onNewRound(src) {
    const {round, run_num, run_ms} = src
    this.opt.round = round
    this.opt.run_num = run_num
    this.opt.run_ms = run_ms
    this.init()
  }

  connectedCallback() {
    super.connectedCallback()
    if (this.opt.live) this.datSubInit()
  }

  disconnectedCallback() {
    this.datSubDeinit()
    super.disconnectedCallback()
  }
}

class RoundHead extends ui.Elem {
  constructor() {
    E(
      super(),
      {class: a.spaced(
        `w-full flex col-sta-str gap-2`,
        ui.CLS_MEDIA_PAD_X,
        ui.CLS_MEDIA_PAD_T,
      )},
    )
  }

  closeBtn = undefined
  addCloseBtn(btn) {
    this.closeBtn = btn
    this.header?.appendChild(btn)
  }

  init({round, user_id, run_id, run_num, args}) {
    a.reqDict(round)

    const round_ms = a.onlyFin(Date.parse(round.LastUpdated))
    const game_ver = (
      round.tabularius_game_ver ||
      gc.findGameReleaseForMs(round_ms)?.ver
    )
    const hpCur = round.HqHp
    const hpMax = reify(round.HqMaxHpData)
    const grenadiers = (
      a.laxFin(round.Currencies?.Grenadier) +
      a.laxFin(round.Currencies?.CompanyStandard) +
      a.laxFin(round.Currencies?.CompanyBugler) +
      a.laxFin(round.Currencies?.Chaplain) +
      a.laxFin(round.Currencies?.FieldMedic) +
      a.laxFin(round.Currencies?.CompanyLieutenant) +
      a.laxFin(round.Currencies?.QuarterMaster)
    )
    const [curses, dotations, doctrines] = bin(round.Skills, [
      gc.CODES_TO_CURSES,
      gc.CODES_TO_DOTATIONS,
    ])
    const frontierMods = round.OwnedExpertSkills

    const cmd = cmdShowRound.cmd
    args = u.stripPreSpaced(args, cmd)

    return E(this, {},
      this.header = E(
        `div`,
        {class: `flex row-bet-cen gap-2`},
        E(`div`, {class: `flex col-sta-sta gap-2`},
          E(`h2`, {class: `trunc-base`},
            `run `, ui.Bold(run_num), ` round `, ui.Bold(round.RoundIndex),
          ),
          a.vac(a.optStr(args)) && ui.BtnPromptReplace({
            val: u.preSpacedOpt(args, cmd),
          }),
        ),
        this.closeBtn,
      ),
      E(
        `div`,
        {
          class: a.spaced(
            ui.CLS_BG_0,
            ui.CLS_BORD,
            `w-full grid-auto gap-x-4 gap-y-2 rounded border`,
          ),
          style: {
            '--grid-col-wid': `20ch`,
            '--grid-pad': `1rem`,
          },
        },
        // Keep the total number of pairs at 12, nicely divisible.
        Pair(`game_ver`, game_ver),
        Pair(`user_id`, user_id),
        Pair(`run_id`, run_id),
        Pair(`seed`, round.EncodedSeed),
        Pair(`diff`, round.DifficultyLevel),
        Pair(`frontier`, round.CurrentExpertScore),
        Pair(`hero`, gc.codeToNameShort(round.HeroType)),
        Pair(`neutral_odds`, fmtCentPerc(round.CurrentNeutralOdds)),
        Pair(`hq_hp`, a.vac(a.isSome(hpCur) || a.isSome(hpMax)) && (
          hpCur === hpMax
          ? ui.formatNumCompact(hpCur)
          : [ui.formatNumCompact(hpCur), `/`, ui.formatNumCompact(hpMax)]
        )),
        a.vac(grenadiers) && Pair(`grenadiers`, grenadiers),
        Pair(`supply_reinf`, fmtNumPercMod(a.laxFin(round.Currencies?.SupplyMultiplier) - 1)),
        Pair(`recon_reinf`, fmtNumPercMod(a.laxFin(round.Currencies?.ReconMultiplier) - 1)),
        Pair(`supply`, ui.formatNumCompact(round.Currencies?.Supply)),
        Pair(`recon`, ui.formatNumCompact(round.Currencies?.Reconnaissance)),
        Pair(`tech`, ui.formatNumCompact(round.Currencies?.Tech)),
      ),
      DetailsGrid(
        Details(`doctrines`, doctrines),
        Details(`frontier modifiers`, frontierMods),
        Details(`frontier dotations`, dotations),
        Details(`frontier curses`, curses),
      ),
    )
  }
}

function DetailsGrid(...src) {
  if (!a.vac(src)) return undefined

  return E(
    `div`,
    {
      class: `grid-auto justify-between gap-2`,
      style: {'--grid-col-wid': `32ch`, '--grid-pad': `0px`},
    },
    ...src,
  )
}

function Details(summary, src) {
  return ui.DetailsPre({summary, chi: a.map(src, gc.codeToNameShort), chiLvl: 1})
}

function Pair(key, val) {
  if (a.isNil(val)) return undefined

  return E(
    `span`,
    {class: `flex row-bet-end gap-1 whitespace-pre overflow-clip`},
    withGlossary(key, ui.Muted(key)),
    E(`span`, {
      class: a.spaced(ui.CLS_BORD, `flex-1 shrink-1 min-w-0 border-b border-dashed`),
    }),
    E(`span`, {class: `trunc`}, val),
  )
}

function TableHintsAndControls() {
  return ui.DetailsPre({
    summary: `settings and hints`,
    class: a.spaced(ui.CLS_MEDIA_PAD_X, `whitespace-pre-wrap`),
    count: false,
    chiLvl: 1,
    chi: [
      ...TableHints(),
      TableControlNumMode(),
      TableControlWide(),
    ],
  })
}

function TableHints() {
  return [
    [TableHintHidden(), TableHintSort()],
    TableHintClick(),
  ]
}

function TableHintHidden() {
  return E(
    `span`,
    {class: CLS_HIDE_ABOVE},
    ui.Muted(`hint:`),
    ` some columns are hidden; make the media panel wider to see them`,
  )
}

function TableHintSort() {
  return E(
    `span`,
    {class: CLS_HIDE_BELOW},
    ui.Muted(`hint:`),
    ` click columns to sort`,
  )
}

function TableHintClick() {
  return [
    ui.Muted(`hint:`),
    ` ctrl+click a building row to toggle `,
    ui.Bold(`all`), ` building children`,
  ]
}

function TableControlNumMode() {
  return E(
    `fieldset`,
    {class: `inline-flex row-sta-cen gap-2`, onchange: onNumModeChange},
    E(`span`, {class: a.spaced(ui.CLS_TEXT_GRAY, `trunc`)}, `numbers:`),
    a.map(NUM_MODES, NumModeRadio),
  )
}

function onNumModeChange(eve) {NUM_MODE.val = eve.target.value}

function NumModeRadio(val) {
  a.reqStr(val)

  return E(
    `label`,
    {class: `flex row-sta-cen gap-1 cursor-pointer`},
    E(
      `input`,
      {
        type: `radio`,
        name: `numPref`,
        class: `cursor-pointer`,
        value: val,
        checked: a.laxStr(NUM_MODE.val) === val,
      },
    ),
    E(`span`, {class: `flex row-cen-cen trunc-base`}, val || `both`),
  )
}

function TableControlWide() {
  return E(
    `label`,
    {class: `inline-flex row-sta-cen gap-2 cursor-pointer`},
    ui.withTooltip({
      elem: ui.Muted(`wide:`),
      chi: `take the entire width of the media panel`,
    }),
    E(`input`, {
      type: `checkbox`,
      value: ``,
      checked: !!WIDE.val,
      class: `cursor-pointer`,
      onchange() {WIDE.val = this.checked},
    })
  )
}

class SortObs extends u.StorageObsJson {
  decode(src) {return a.laxDict(a.onlyDict(super.decode(src)))}
}

export const BUI_SORT = new SortObs(`tabularius.round_table.sort_bui`)

// SYNC[bui_stat_types].
const BUI_STAT_TYPES = [...s.STAT_TYPES, `bui_cost`]

const BUI_COL_BASE = {sortObs: BUI_SORT}

// SYNC[bui_cols].
const BUI_COLS = [
  {...BUI_COL_BASE, key: `bui_type_upg`,           type: TYPE_ANY, colspan: 3},
  {...BUI_COL_BASE, key: s.STAT_TYPE_DMG_DONE,     type: TYPE_NUM, colspan: 2},
  {...BUI_COL_BASE, key: s.STAT_TYPE_DMG_OVER,     type: TYPE_NUM, colspan: 2},
  {...BUI_COL_BASE, key: s.STAT_TYPE_COST_EFF,     type: TYPE_NUM, colspan: 2},
  {...BUI_COL_BASE, key: `bui_cost`,               type: TYPE_NUM, colspan: 2},
  {...BUI_COL_BASE, key: s.STAT_TYPE_DMG_DONE_ACC, type: TYPE_NUM, colspan: 2, hide: true},
  {...BUI_COL_BASE, key: s.STAT_TYPE_DMG_OVER_ACC, type: TYPE_NUM, colspan: 2, hide: true},
  {...BUI_COL_BASE, key: s.STAT_TYPE_COST_EFF_ACC, type: TYPE_NUM, colspan: 2, hide: true},
]

export const CHI_SORT = new SortObs(`tabularius.round_table.sort_chi`)

const CHI_COL_BASE = {sortObs: CHI_SORT}

// SYNC[chi_cols].
const CHI_COLS = [
  {...CHI_COL_BASE, key: `chi_type`,               type: TYPE_ANY, colspan: 3, pre: subRowPrefix},
  {...CHI_COL_BASE, key: s.STAT_TYPE_DMG_DONE,     type: TYPE_NUM, colspan: 2},
  {...CHI_COL_BASE, key: s.STAT_TYPE_DMG_DONE_ACC, type: TYPE_NUM, colspan: 2},
  {...CHI_COL_BASE, key: s.STAT_TYPE_DMG_OVER,     type: TYPE_NUM, colspan: 2},
  {...CHI_COL_BASE, key: s.STAT_TYPE_DMG_OVER_ACC, type: TYPE_NUM, colspan: 2},
  {...CHI_COL_BASE, key: `enabled`,                type: TYPE_BOOL, colspan: 6, hide: true},
]

export const WEP_SORT = new SortObs(`tabularius.round_table.sort_wep`)

const WEP_COL_BASE = {sortObs: WEP_SORT}

// SYNC[wep_cols].
const WEP_COLS = [
  {...WEP_COL_BASE, key: `wep_type`, type: TYPE_ANY, colspan: 3, pre: subRowPrefix},
  {...WEP_COL_BASE, key: `range`,    type: TYPE_ANY, hide: true},
  {...WEP_COL_BASE, key: `mag`,      type: TYPE_NUM},
  {...WEP_COL_BASE, key: `rof`,      type: TYPE_NUM},
  {...WEP_COL_BASE, key: `rel`,      type: TYPE_NUM},
  {...WEP_COL_BASE, key: `dmg`,      type: TYPE_NUM},
  {...WEP_COL_BASE, key: `targs`,    type: TYPE_NUM},
  {...WEP_COL_BASE, key: `dmg_base`, type: TYPE_NUM_MOD, hide: true},
  {...WEP_COL_BASE, key: `dmg_perc`, type: TYPE_PERC_MOD, hide: true},
  {...WEP_COL_BASE, key: `air`,      type: TYPE_PERC_MOD},
  {...WEP_COL_BASE, key: `shield`,   type: TYPE_PERC_MOD},
  {...WEP_COL_BASE, key: `aoe`,      type: TYPE_NUM, hide: true},
  {...WEP_COL_BASE, key: `detec`,    type: TYPE_BOOL, hide: true},
  {...WEP_COL_BASE, key: `targ`,     type: TYPE_ANY, colspan: 2, hide: true},
]

validateColAlignment()

class RoundTable extends dr.MixReg(HTMLTableElement) {
  constructor() {
    E(super(), {class: `w-full table media-pad`})
  }

  init(opt) {
    E(this, {},
      new TableHead(),
      new TableBody().init(opt),
    )
    this.sort()
    return this
  }

  toggleAssocRows(show) {
    for (const body of this.tBodies) body.toggleAssocRows(show)
  }

  sort() {
    this.tHead.sort()
    for (const body of this.tBodies) body.sort()
  }
}

class TableHead extends dr.MixReg(HTMLTableSectionElement) {
  static localName = `thead`

  constructor() {
    super()
    E(this, {}, a.map(BUI_COLS, Th))
  }

  sort() {for (const cell of this.children) cell.sort()}
}

class TableBody extends dr.MixReg(HTMLTableSectionElement) {
  static localName = `tbody`

  init(opt) {
    const {tbodyRows, buiRows} = roundTableRows(opt)
    const lenBui = buiRows.length
    const lenMax = LONG_ROW_BREAKPOINT

    if (lenBui > lenMax) {
      for (const row of buiRows.slice(lenMax)) row.showObs = LONG

      tbodyRows.push(new BuiLongToggleRow({
        lenBui, lenMax, obs: LONG, colspan: sumColspans(BUI_COLS).all,
      }))
    }

    for (const [ind, row] of a.entries(tbodyRows)) row.sortInd = ind
    return E(this, {}, tbodyRows)
  }

  sort() {return E(this, {}, a.arr(this.children).sort(compareRowsDeep))}

  toggleAssocRows(show) {
    a.optBool(show)
    for (const row of this.rows) row.toggleAssocRows?.(show)
  }
}

class TableRow extends dr.MixReg(HTMLTableRowElement) {
  parent = undefined
  sortInd = a.optNat()
  sortObs = undefined
  showObs = undefined

  constructor({parent, sortObs, showObs} = {}) {
    super()
    this.parent = a.optNode(parent)
    this.sortObs = a.optInst(sortObs, SortObs)
    this.showObs = a.optInst(showObs, u.StorageObsBool)
    if (showObs) this.hidden = !showObs.val
  }

  isSortable() {return true}

  getCell(key) {
    a.reqValidStr(key)
    return this.getCellIndex()[key]
  }

  cellDict = undefined

  getCellIndex() {
    if (this.cellDict) return this.cellDict
    const out = a.Emp()
    for (const node of this.cells) {
      const {key} = node
      if (a.isValidStr(key)) out[key] = node
    }
    return this.cellDict = out
  }

  hasAnc(val) {
    if (!a.isSome(val)) return false
    let tar = this
    while (a.isSome(tar = tar.parent)) if (tar === val) return true
    return false
  }

  hasChi() {return !!this.nextElementSibling?.hasAnc(this)}

  firstChi() {
    const out = this.nextElementSibling
    if (out?.hasAnc(this)) return out
    return undefined
  }

  *iterChi() {
    let val = this
    while ((val = val.nextElementSibling) && val.hasAnc(this)) yield val
  }

  #ancs = undefined

  ancs() {
    let out = this.#ancs
    if (out) return out

    out = this.#ancs = []
    let val = this
    while (a.isSome(val = val.parent)) out.push(val)
    return out.reverse()
  }
}

class PseudoHeadRow extends TableRow {
  constructor({parent, sortObs, showObs, cols}) {
    super({parent, sortObs, showObs})
    this.sortObs = a.reqInst(sortObs, SortObs)

    E(
      this,
      {class: `tr-sub`, hidden: showObs && !showObs.val},
      a.map(cols, Th),
    )
  }

  sort() {for (const cell of this.children) cell.sort()}
  isSortable() {return false}
}

function Th(opt) {return new TableHeadCell(opt)}

class TableHeadCell extends dr.MixReg(HTMLTableCellElement) {
  static localName = `th`
  key = undefined
  sortObs = undefined

  constructor({key, sortObs, pre, colspan, hide, attrs}) {
    super()
    this.key = a.reqValidStr(key)
    this.sortObs = a.reqInst(sortObs, SortObs)

    E(
      this,
      {
        ...a.optDict(attrs),
        colspan,
        class: a.spaced(
          attrs?.class,
          ui.CLS_TEXT_GRAY,
          CLS_CELL_COMMON,
          `cursor-pointer pb-1`,
          ui.CLS_BUSY_BG,
          a.vac(a.optBool(hide) && CLS_HIDE_BELOW),
        ),
      },
      u.callOpt(pre),
      ui.withGlossary({
        key,
        elem: ui.Span(key),
        glos: STAT_GLOSSARY,
        under: true,
      }),
    )
  }

  connectedCallback() {this.onclick = this.onClick}

  onClick() {this.sortNext()}

  sortNext() {
    const {key, sortObs} = this
    sortObs.val = cycleSort(key, sortObs.val)

    const anc = a.ancestor(this, RoundTable)
    if (!anc) return

    anc.sort(sortObs)
    this.sort()
  }

  sort() {
    const {key, desc} = this.sortObs.val
    E(this, {'aria-sort': ariaSort(a.vac(key === this.key) && desc)})
  }
}

class TableCell extends od.MixReac(dr.MixReg(HTMLTableCellElement)) {
  static localName = `td`
  type = a.optStr()
  key = a.optValidStr()
  pre = undefined
  val = undefined
  suf = undefined
  perc = a.optFin()
  tooltip = undefined

  constructor({type, key, val, pre, suf, colspan, hide, attrs}) {
    super()
    this.type = a.optStr(type)
    this.key = a.reqValidStr(key)
    this.val = val
    this.pre = pre
    this.suf = suf

    E(this, {
      ...a.optDict(attrs),
      colspan,
      class: a.spaced(
        attrs?.class,
        CLS_CELL_COMMON,
        a.vac(a.optBool(hide) && CLS_HIDE_BELOW),
      ),
    })
  }

  setPre(val) {this.pre = val}
  setSuf(val) {this.suf = val}

  addPref(...chi) {
    if (a.isSome(this.val)) this.val = [...chi, this.val]
    return this
  }

  addPerc(val) {
    if (!a.isFin(this.val) || !a.onlyFin(val)) return this
    this.perc = a.onlyFin(this.val / val)
    return this
  }

  // TODO: more colors for different types.
  showVal() {
    const {type, val} = this
    return fmtVal(type, val)
  }

  showPerc() {
    return E(`span`, {class: `text-sky-700 dark:text-sky-300`},
      u.callOpt(this.pre),
      fmtNumPerc(this.perc),
      u.callOpt(this.suf),
    )
  }

  drawVal() {
    return E(this, {},
      u.callOpt(this.pre), this.showVal(), u.callOpt(this.suf),
    )
  }

  drawPerc() {
    return E(this, {},
      u.callOpt(this.pre), this.showPerc(), u.callOpt(this.suf),
    )
  }

  drawBoth() {
    return E(this, {},
      u.callOpt(this.pre),
      E(`span`, {class: `flex row-bet-cen gap-2`},
        E(`span`, {class: `trunc`}, this.showVal()),
        this.showPerc(),
      ),
      u.callOpt(this.suf),
    )
  }

  run() {
    const {type} = this
    if (type !== TYPE_NUM) return this.drawVal()

    const mode = NUM_MODE.val
    if (mode === NUM_MODE_NUM) return this.drawVal()
    if (mode === NUM_MODE_PERC) return this.drawPerc()

    const {val, perc} = this
    if (a.isNil(perc)) return this.drawVal()
    if (a.isNil(val)) return this.drawPerc()
    return this.drawBoth()
  }
}

function Tds(src, cols) {
  a.reqDict(src)
  const out = []

  for (const col of a.values(cols)) {
    const {key} = a.reqDict(col)
    a.reqValidStr(key)

    if (u.DEV && !a.hasOwn(src, key)) {
      throw Error(`internal: missing column ${a.show(key)} in ${a.show(src)}`)
    }

    const val = src[key]
    out.push(new TableCell({...col, val}).drawVal())
  }
  return out
}

export const CHI_SHOW = u.storageObsBool(`tabularius.round_table.show_chi`)

class BuiRow extends od.MixReac(TableRow) {
  constructor() {super({sortObs: BUI_SORT})}

  connectedCallback() {
    super.connectedCallback()
    if (!this.hasChi()) return
    ui.addCls(this, `cursor-pointer`)
    ui.addCls(this, ui.CLS_BUSY_BG)
    this.onclick = this.onClick
  }

  /*
  This method is a bit tricky. This collapses / uncollapses associated rows,
  either only for the current row, or for all `BuiRow`s. When you click a row,
  or Ctrl+click / Cmd+click one, the result should be based entirely on the
  state of that row, not on any hidden state. If you click a row whose assoc
  rows are hidden, then if modified, this should show _all_ rows, but otherwise
  this should only show the assoc rows of the target. Inverse for a row whose
  assoc rows are visible.
  */
  onClick(eve) {
    const show = !!this.firstChi()?.hidden
    CHI_SHOW.set(show)

    if (u.isEventModifiedPrimary(eve)) {
      a.ancestor(this, RoundTable).toggleAssocRows(show)
      return
    }

    this.toggleAssocRows(show)
  }

  sortables = undefined

  addPerc(total) {
    a.reqDict(total)
    for (const type of BUI_STAT_TYPES) {
      this.getCell(type).addPerc(total[type])
    }
  }

  toggleAssocRows(show) {
    a.optBool(show)
    for (const val of this.iterChi()) val.hidden = !show
  }

  run() {
    const obs = this.showObs
    if (!obs) return

    const show = obs.val
    this.toggleAssocRows(show && CHI_SHOW.get())
    this.hidden = !show
  }
}

class BuiLongToggleRow extends od.MixReac(TableRow) {
  lenBui = undefined
  lenMax = undefined
  obs = undefined

  constructor({lenBui, lenMax, obs, colspan}) {
    super()

    this.lenBui = a.reqNat(lenBui)
    this.lenMax = a.reqNat(lenMax)
    this.obs = a.reqObj(obs)

    E(
      this,
      {class: a.spaced(`cursor-pointer`, ui.CLS_BUSY_BG, ui.CLS_TEXT_GRAY)},
      E(`td`, {colspan, class: `text-center pt-1`}),
    )
  }

  run() {
    const {lenBui, lenMax, obs} = this
    const show = a.optBool(obs.val)

    this.cells[0].textContent = (
      show
      ? `click to see first ${lenMax} of ${lenBui} buildings`
      : `click to show ${lenBui - lenMax} hidden buildings of ${lenBui}`
    )
  }

  connectedCallback() {
    super.connectedCallback()
    this.onclick = this.onClick
  }

  onClick() {this.obs.val = !this.obs.val}
}

function PseudoTableRows({parent, cols, datas, sortObs, showObs}) {
  const head = new PseudoHeadRow({parent, cols, sortObs, showObs})

  return [
    head,
    ...a.map(datas, src => E(
      new TableRow({parent: head, sortObs, showObs}),
      {class: `tr-sub`},
      Tds(src, cols),
    )),
  ]
}

function roundTableRows({round, user_id, run_num, run_ms}) {
  const dat = a.Emp()

  s.datAddRound({
    dat, round, user_id, run_num, run_ms, composite: false,
    tables: {round_buis: true},
  })

  const total = a.Emp()
  const tbodyRows = []
  const buiRows = []

  for (const [bui_inst, bui] of a.entries(round.Buildings)) {
    const round_bui = a.reqDict(dat.round_buis[bui_inst])
    addRoundTableRows({tbodyRows, buiRows, bui, round_bui, total})
  }

  for (const row of buiRows) row.addPerc(total)
  return {tbodyRows, buiRows}
}

function addRoundTableRows({tbodyRows, buiRows, bui, round_bui, total}) {
  a.reqArr(tbodyRows)
  a.reqArr(buiRows)

  const buiData = buiStatData({round_bui, total})
  const buiRow = E(new BuiRow(), {}, Tds(buiData, BUI_COLS))
  tbodyRows.push(buiRow)
  buiRows.push(buiRow)

  const {wepTypes, dumBulTypes, stats} = a.reqDict(round_bui)
  const chiDatas = []
  const wepDatas = []

  for (const [ind, wep] of a.entries(bui.Weapons)) {
    const stats = bui.WeaponStats[ind]?.stats
    if (!shouldShowWep(wep, stats)) continue
    chiDatas.push(wepStatData({wep, stats}))
    wepDatas.push(wepDetailData(wep))
  }

  for (const type of a.keys(bui.ChildLiveStats)) {
    if (wepTypes.has(type) || dumBulTypes.has(type)) continue
    chiDatas.push(chiStatData({type, stats}))
  }

  const showObs = CHI_SHOW

  if (chiDatas.length) {
    const head = buiRow.cells[0]
    const cols = CHI_COLS
    const sortObs = CHI_SORT

    if (chiDatas.length === 1) {
      const key = a.reqValidStr(a.head(cols).key)
      head.setSuf([`: `, ui.Muted(chiDatas[0][key])])
    }
    else {
      tbodyRows.push(...PseudoTableRows({
        parent: buiRow, cols, datas: chiDatas, sortObs, showObs,
      }))
      head.setSuf([`: `, ui.Muted(chiDatas.length)])
    }
  }

  if (wepDatas.length) {
    const cols = WEP_COLS
    const sortObs = WEP_SORT
    tbodyRows.push(...PseudoTableRows({
      parent: buiRow, cols, datas: wepDatas, sortObs, showObs,
    }))
  }
}

function buiStatData({round_bui, total}) {
  a.reqDict(round_bui)
  a.reqDict(total)

  const bui_type_upg = a.reqValidStr(round_bui.bui_type_upg)
  const stats = a.optDict(round_bui.stats)

  // SYNC[bui_cols].
  const out = a.Emp()
  out.bui_type_upg = s.codedToNamed(`bui_type_upg`, bui_type_upg)

  // SYNC[bui_stat_types].
  for (const type of s.STAT_TYPES) {
    a.reqValidStr(type)
    const val = a.laxFin(stats?.[type])
    out[type] = val
    addTotal(total, type, val)
  }

  const cost = a.laxFin(round_bui.cost)
  out.bui_cost = cost
  addTotal(total, `bui_cost`, cost)
  return out
}

function addTotal(tar, key, val) {
  a.reqDict(tar)
  a.reqValidStr(key)
  if (a.isFin(val)) tar[key] = a.laxFin(tar[key]) + val
}

function wepStatData({wep, stats}) {
  a.reqDict(wep)
  // SYNC[chi_cols].
  const out = chiStatData({type: wep.EntityID, stats})
  out.enabled = wep.Enabled
  return out
}

function chiStatData({type, stats}) {
  a.reqStr(type)
  a.optDict(stats)

  // SYNC[chi_cols].
  const out = a.Emp()
  out.chi_type = type
  out.dmg_done = stats?.DamageDone?.valueThisWave
  out.dmg_done_acc = stats?.DamageDone?.valueThisGame
  out.dmg_over = stats?.DamageOverkill?.valueThisWave
  out.dmg_over_acc = stats?.DamageOverkill?.valueThisGame
  out.enabled = undefined
  return out
}

function wepDetailData(wep) {
  a.reqDict(wep)

  const out = a.Emp()
  const bul = wep.DummyBullet
  const aoe = bul.AreaOfEffect

  // SYNC[wep_cols].
  out.wep_type = wep.EntityID

  out.range = (
    wep.DistanceRangeMin
    ? wep.DistanceRangeMin + `-` + wep.DistanceRangeMax
    : wep.DistanceRangeMax
  )

  out.mag = wep.MagazineSize
  out.rel = reify(wep.ReloadTime)
  out.rof = reify(wep.RateOfFire)

  const targs = wep.TargetingPriorities

  // TODO move the tooltip to the `td` and get rid of the span.
  out.targ = a.vac(targs) && ui.withTooltip({
    elem: ui.Span(abbrs(targs)),
    chi: a.joinLines(targs),
  })

  out.detec = wep.IsDetection

  out.air = (
    bul.IsAntiAircraft
    ? a.laxFin(bul.AntiAircraftModifier) / 100
    : a.laxFin(bul.AircraftModifier) / 100
  )

  out.shield = (
    isWepAntiShield(wep)
    ? a.laxFin(bul.AntiShieldModifier) / 100
    : a.laxFin(bul.ShieldModifier) / 100
  )

  out.dmg = reify(aoe.Damage)
  out.dmg_base = a.laxFin(aoe.Damage.baseValue) + a.laxFin(aoe.Damage.rawModifier)
  out.dmg_perc = a.laxFin(aoe.Damage.pctModifier) / 100
  out.aoe = reify(aoe.SizeValue)
  out.targs = aoe.MaxTarget
  return out
}

// TODO simplify, add explanatory comments.
export function compareRowsDeep(one, two) {
  reqRow(one)
  reqRow(two)

  one.sort?.()
  two.sort?.()

  const oneAncs = one.ancs()
  const twoAncs = two.ancs()

  const oneLen = oneAncs.length
  const twoLen = twoAncs.length

  let ind = -1
  while (++ind < oneLen || ind < twoLen) {
    if (ind > oneLen) break
    if (ind > twoLen) break

    let oneAnc = oneAncs[ind]
    let twoAnc = twoAncs[ind]

    if (ind === oneLen) {
      a.reqNil(oneAnc)
      oneAnc = one
    }
    else if (ind === twoLen) {
      a.reqNil(twoAnc)
      twoAnc = two
    }

    const out = compareRows(oneAnc, twoAnc)
    if (out) return out
  }

  if (oneLen === twoLen) {
    const out = compareRows(one, two)
    if (out) return out
  }

  return a.reqFin(one.sortInd) - a.reqFin(two.sortInd)
}

// TODO simplify, add explanatory comments.
export function compareRows(one, two) {
  if (one === two) {
    if (!u.DEV) return 0
    throw Error(`internal: pointless comparison of the same row`)
  }

  const oneInd = a.reqFin(one.sortInd)
  const twoInd = a.reqFin(two.sortInd)

  const obs = one.sortObs
  if (!obs || obs !== two.sortObs) return oneInd - twoInd

  const {key, desc} = obs.val
  if (key && one.isSortable() && two.isSortable()) {
    const oneCell = one.getCell(key)
    const twoCell = two.getCell(key)

    if (oneCell && twoCell) {
      const oneVal = oneCell.val
      const twoVal = twoCell.val
      const out = (
        desc
        ? u.compareDesc(oneVal, twoVal)
        : u.compareAsc(oneVal, twoVal)
      )
      if (out) return out
    }
  }

  return oneInd - twoInd
}

function withGlossary(key, elem) {
  return ui.withGlossary({elem, key, glos: STAT_GLOSSARY, under: true})
}

function subRowPrefix() {
  return ui.Muted(`└ `)
}

function BtnAppend(suf, eph) {
  return ui.BtnPrompt({cmd: cmdShowRound.cmd, suf, eph, full: true})
}

function BtnAppendEph(eph) {
  return ui.BtnPrompt({cmd: cmdShowRound.cmd, eph, full: true})
}

// SYNC[wep_cols].
const STAT_GLOSSARY = u.dict({
  ...s.GLOSSARY,
  wep_type: `weapon type`,
  targ: `targeting modes`,
  range: `weapon range (squares)`,
  mag: `magazine size`,
  rof: `rate of fire (shots per second)`,
  rel: `reload duration (seconds)`,
  dmg: `calculated damage`,
  dmg_base: `base damage before ±%`,
  dmg_perc: `damage ±%`,
  air: `anti-air ±%`,
  shield: `anti-shield ±%`,
  aoe: `area of effect radius (squares)`,
  targs: `maximum targets in AoE`,
  detec: `has detection or not`,
  seed: `initial state of random number generator`,
  neutral_odds: `chance of neutral building on next zone`,
  supply_reinf: `±% supply in reinforcements`,
  recon_reinf: `±% recon in reinforcements`,
})

// All values in the game are supposed to be calculated like this.
export function reify(src) {
  if (!a.optObj(src)) return undefined
  const base = a.laxFin(src.baseValue)
  const baseMod = a.laxFin(src.rawModifier)
  const percMod = a.laxFin(src.pctModifier)
  return (base + baseMod) * (1 + (percMod / 100))
}

let FMT_WARNED = false

function fmtVal(type, val) {
  a.optValidStr(type)
  if (a.isNil(val)) return undefined

  if (type === TYPE_ANY) return val
  if (type === TYPE_BOOL) return checktick(val)
  if (type === TYPE_NUM) return fmtNum(val)
  if (type === TYPE_NUM_MOD) return fmtNumMod(val)
  if (type === TYPE_PERC) return fmtNumPerc(val)
  if (type === TYPE_PERC_MOD) return fmtNumPercMod(val)

  if (!FMT_WARNED) {
    FMT_WARNED = true
    ui.logErr(`internal error: unable to format: unrecognized type ${a.show(type)}; value: ${a.show(val)}`)
  }
  return val
}

function checktick(val) {return a.vac(a.optBool(val)) && `✓`}

function fmtNum(src) {
  return finOpt(src) && ui.formatNumCompact(src)
}

function fmtNumMod(src) {
  return finOpt(src) && numFormatSign.format(a.reqFin(src))
}

function fmtNumPerc(src) {
  return finOpt(src) && fmtCentPerc(a.laxFin(src) * 100)
}

function fmtCentPerc(src) {
  return finOpt(src) && (fmtNum(src) + `%`)
}

function fmtNumPercMod(src) {
  return finOpt(src) && (numFormatSign.format(src * 100) + `%`)
}

/*
function fmtCentPercMod(src) {
  return finOpt(src) && (numFormatSign.format(src) + `%`)
}

function fmtNumPercFromMod(src) {
  return finOpt(src) && fmtNumPerc(a.reqFin(src) + 1)
}

function fmtCentPercFromMod(src) {
  return finOpt(src) && fmtCentPerc(a.reqFin(src) + 100)
}

const numFormat = new Intl.NumberFormat(`en-US`, {
  maximumFractionDigits: 2,
  roundingMode: `halfExpand`,
  useGrouping: false,
})
*/

export const numFormatSign = new Intl.NumberFormat(`en-US`, {
  maximumFractionDigits: 2,
  roundingMode: `halfExpand`,
  signDisplay: `exceptZero`,
  useGrouping: false,
})

/*
Game data doesn't seem to have an actual "is anti shield" property on weapons or
dummy bullets, unlike `.IsAntiAircraft`.
*/
function isWepAntiShield(wep) {
  return /pulse/i.test(a.reqStr(wep.EntityID))
}

function shouldShowWep(wep, stats) {
  a.reqDict(wep)
  a.optDict(stats)
  return !!a.optBool(wep.Enabled) || !!(stats?.DamageDone?.valueThisGame)
}

/*
Takes a list of keys and a set of dicts, and "bins" the keys into groups
according to which dicts they occur in.
*/
export function bin(src, dicts) {
  const len = a.reqArr(dicts).length
  const keyToInd = a.Emp()

  let ind = -1
  while (++ind < len) {
    for (const key of a.keys(a.reqDict(dicts[ind]))) {
      keyToInd[key] = ind
    }
  }

  const out = a.alloc(len + 1)
  for (const key of a.values(src)) {
    const ind = keyToInd[a.reqStr(key)] ?? len
    const tar = out[ind] ??= []
    tar.push(key)
  }
  return out
}

function reqRow(val) {return a.reqInst(val, TableRow)}
// function strOpt(val) {return a.optStr(val) || undefined}
function finOpt(val) {return a.optFin(val) || undefined}

function ariaSort(desc) {
  a.optBool(desc)
  if (desc === false) return `ascending`
  if (desc === true) return `descending`
  return undefined
}

function cycleSort(key, opt) {
  a.reqValidStr(key)
  a.reqDict(opt)

  const keyPrev = a.optStr(opt.key)
  const descPrev = a.optBool(opt.desc)

  if (key !== keyPrev) return {key, desc: true}
  if (descPrev === true) return {key, desc: false}
  return {}
}

function validateColAlignment() {
  const bui = sumColspans(BUI_COLS)
  const chi = sumColspans(CHI_COLS)
  const wep = sumColspans(WEP_COLS)
  if (bui.all === chi.all && chi.all === wep.all) return
  ui.logErr(`colspan mismatch: bui = ${a.show(bui)}, chi = ${a.show(chi)}, wep = ${a.show(wep)}`)
}

function sumColspans(cols) {
  let show = 0
  let hide = 0
  for (const col of cols) {
    const val = a.optNat(col.colspan) ?? 1
    if (a.optBool(col.hide)) hide += val
    else show += val
  }
  return {all: show + hide, show, hide}
}

function abbrs(src) {return a.spaced(...a.map(src, abbr))}
function abbr(src) {return Words.from(src).abbr()}
class Words extends a.Words {abbr() {return this.mapMut(first).join(``)}}
function first(src) {return src[0]}
