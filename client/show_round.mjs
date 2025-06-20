import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as gc from '../shared/game_const.mjs'
import * as s from '../shared/schema.mjs'
import {E} from './ui.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as d from './dat.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'
import * as au from './auth.mjs'
import * as ls from './ls.mjs'

import * as self from './show_round.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.sr = self
a.patch(globalThis, namespace)

cmdShowRound.cmd = `show_round`
cmdShowRound.desc = `detailed breakdown of one round`
cmdShowRound.help = function cmdShowRoundHelp() {
  const saveDir = a.laxStr(fs.SAVE_DIR_CONF.handle?.name)
  const histDir = a.laxStr(fs.HISTORY_DIR_CONF.handle?.name)

  return ui.LogParagraphs(
    u.callOpt(cmdShowRound.desc),
    ls.helpSources(`show_round`),

    `local usage:`,

    [
      `  `,
      os.BtnCmd(`show_round`),
      ` -- displays details of the latest round; checks the `,
      os.BtnCmdWithHelp(`saves`),
      ` directory, falls back on the `,
      os.BtnCmdWithHelp(`history`),
      ` directory`,
    ],

    ui.LogLines(
      [
        `  `,
        (
          saveDir
          ? BtnReplace(u.paths.join(saveDir, fs.PROG_FILE_NAME))
          : BtnReplaceEph(u.paths.join(`<saves>`, fs.PROG_FILE_NAME))
        ),
        ` -- use save file`,
        a.vac(!saveDir) && [`; requires `, os.BtnCmdWithHelp(`saves`)],
      ],
      [
        `  `,
        (histDir ? BtnReplace(histDir) : BtnReplaceEph(`<history>`)),
        ` -- latest round in latest run`,
        a.vac(!histDir) && [`; requires `, os.BtnCmdWithHelp(`history`)],
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(
            histDir + `/`,
            `<run_num>`,
          )
          : BtnReplaceEph(`<history>/<run_num>`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(
            histDir + `/`,
            `<run_num>/<round_num>`,
          )
          : BtnReplaceEph(`<history>/<run_num>/<round_num>`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(u.paths.join(histDir, `latest`))
          : BtnReplaceEph(`<history>/latest`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(
            u.paths.join(histDir, `latest`) + `/`,
            `<round_num>`,
          )
          : BtnReplaceEph(`<history>/latest/<round_num>`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(u.paths.join(histDir, `latest/latest`))
          : BtnReplaceEph(`<history>/latest/latest`)
        ),
      ],
    ),

    [
      `in local mode, when showing the progress file or the latest round file, the resulting table is "live": it automatically updates to the latest round when the `,
      os.BtnCmdWithHelp(`watch`),
      ` process detects changes and makes a new round backup`,
    ],

    [`tip: use `, os.BtnCmdWithHelp(`ls /`), ` to browse local files`],

    ui.LogLines(
      `cloud usage:`,
      [
        `  `,
        os.BtnCmd(`show_round -c`),
        ` -- latest round from any user`,
      ],
      [
        `  `,
        os.BtnCmd(`show_round -c -u`),
        ` -- latest round from current user`,
        a.vac(!au.isAuthed()) && [`; requires `, os.BtnCmdWithHelp(`auth`)],
      ],
      [
        `  `,
        BtnReplace(`-c `, `<user_id>`),
        ` -- latest round from specific user`,
      ],
      [
        `  `,
        BtnReplace(`-c `, `<user_id>/<run_num>`),
        ` -- latest round from specific user and run`,
      ],
      [
        `  `,
        BtnReplace(`-c `, `<user_id>/<run_num>/<round_num>`),
        ` -- specific user, run, round`,
      ],
    ),

    [`tip: use `, os.BtnCmdWithHelp(`ls -c`), ` to browse uploaded rounds`],
  )
}

export async function cmdShowRound({sig, args}) {
  const cmd = cmdShowRound.cmd
  const paths = []
  let cloud
  let user

  for (const [key, val, pair] of u.cliDecode(u.stripPreSpaced(args, cmd))) {
    if (u.isHelpFlag(key)) return os.cmdHelpDetailed(cmdShowRound)
    if (key === `-c`) {
      cloud = ui.cliBool(cmd, key, val)
      continue
    }
    if (key === `-u`) {
      user = ui.cliBool(cmd, key, val)
      continue
    }
    if (key) {
      ui.LOG.err(ui.msgUnrecInput(pair, args))
      return os.cmdHelpDetailed(cmdShowRound)
    }
    paths.push(val)
  }

  if (user) {
    if (!cloud) {
      ui.LOG.err(
        `ignoring `, ui.BtnPrompt({cmd, suf: `-u`}),
        ` in local mode in `, ui.BtnPromptReplace(args),
      )
    }
    else if (paths.length) {
      ui.LOG.err(
        `ignoring `, ui.BtnPrompt({cmd, suf: `-u`}),
        ` in `, ui.BtnPromptReplace(args),
        ` because some paths were provided`,
      )
    }
    else paths.push(au.reqUserId())
  }

  if (!paths.length) paths.push(``)

  return new os.Combo({mediaItems: await Promise.all(a.map(paths, path => (
    cloud
    ? showRoundCloud({sig, args, path})
    : showRoundLocal({sig, args, path})
  )))})
}

export async function showRoundLocal({sig, args, path}) {
  const {handle, round, live, hasProg, hasHist} = await fs.findRoundFileAny(sig, path)
  if (handle) return showRoundFile({sig, args, handle, round, live})

  if (!hasProg && !hasHist) {
    ui.LOG.err(
      `unable to show latest round: no access to `,
      os.BtnCmdWithHelp(`saves`), ` or `, os.BtnCmdWithHelp(`history`),
      `; click to grant`,
    )
    return undefined
  }

  if (!hasProg) {
    ui.LOG.err(
      `unable to show latest round: no access to `,
      os.BtnCmdWithHelp(`saves`),
      ` (click to grant), and found no rounds in `,
      os.BtnCmdWithHelp(`history`), `; build your history by playing!`,
    )
    return undefined
  }

  // This should only be possible if the progress file was manually deleted
  // from the saves dir.
  ui.LOG.err(
    `unable to show latest round: found no progress file in `,
    os.BtnCmdWithHelp(`saves`),
    `; also no rounds in `,
    os.BtnCmdWithHelp(`history`),
    `; build your history by playing`,
  )
  return undefined
}

export async function showRoundCloud({sig, args, path}) {
  const round = await apiDownloadRound(sig, path)
  return showRoundFile({sig, args, round})
}

export async function showRoundFile({sig, args, handle, round, live}) {
  u.reqSig(sig)
  a.optInst(handle, FileSystemFileHandle)
  a.optDict(round)
  a.reqValidStr(args)
  a.optBool(live)

  round ??= await fs.readDecodeGameFile(sig, handle)

  const user_id = round.tabularius_user_id || d.USER_ID
  const run_num = round.tabularius_run_num ?? 0
  const run_ms = round.tabularius_run_ms ?? Date.parse(round.LastUpdated)
  const run_id = s.makeRunId(user_id, run_num, run_ms)

  return new ShowRound({
    round, user_id, run_id, run_num, run_ms, args, live,
  })
}

export const HIDE_BREAKPOINT = `40rem`
export const CLS_HIDE_BELOW = `hide-below-[${HIDE_BREAKPOINT}]`
export const CLS_HIDE_ABOVE = `hide-above-[${HIDE_BREAKPOINT}]`
export const CLS_CELL_COMMON = `px-2 trunc-base text-left`
export const CLS_CELL_HEAD = a.spaced(
  CLS_CELL_COMMON,
  ui.CLS_TEXT_MUTED,
  ui.CLS_BUSY_BG,
  `cursor-pointer pb-1 weight-unset`,
)
export const CLS_ROW_TOP = a.spaced(ui.CLS_BORD, `border-t border-dashed`)

// TODO: more colors for different types.
export const CLS_PERC = `text-sky-700 dark:text-sky-300`

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
export const SHOW_CHI = u.storageObsBool(`tabularius.round_table.show_chi`)
export const MISSING_LAST = u.storageObsBool(`tabularius.show_round.missing_last`)
export const WIDE = u.storageObsBool(`tabularius.show_round.wide`)
export const LONG = u.storageObsBool(`tabularius.show_round.long`)
export const SETTINGS_OPEN = u.storageObsBool(`tabularius.show_round.settings_open`)
export const LONG_ROW_BREAKPOINT = 12

class ShowRound extends d.MixDatSub(ui.Elem) {
  opt = undefined

  constructor(opt) {
    super()
    this.opt = a.reqDict(opt)

    E(this, () => ({class: a.spaced(
      `@container flex col-sta-str max-w-none min-h-8 text-sm gap-2`,
      ui.CLS_MEDIA_CHI,
      a.vac(WIDE.val) && ui.CLS_MEDIA_ITEM_WIDE,
    )}))

    this.init()
  }

  init() {
    return E(this, undefined,
      new RoundHead(this.opt),
      new TableSettingsAndHints(),
      new RoundTable(this.opt),
    )
  }

  // Invoked by `MixDatSub`.
  onNewRound(src) {
    const {round, run_num, run_ms} = src
    this.opt.round = round
    this.opt.run_num = run_num
    this.opt.run_ms = run_ms
    this.init()
  }

  // Invoked by `MEDIA`.
  addCloseBtn(btn) {a.descendant(this, RoundHead)?.addCloseBtn(btn)}
  connectedCallback() {if (this.opt.live) this.datSubInit()}
  disconnectedCallback() {this.datSubDeinit()}
}

class RoundHead extends ui.Elem {
  closeBtn = a.obsRef()

  constructor({round, user_id, run_id, run_num, args}) {
    super()
    a.reqDict(round)

    const round_ms = a.onlyFin(Date.parse(round.LastUpdated))
    const game_ver = gc.findGameReleaseForMs(round_ms)?.ver
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
    const blueprints = a.laxDict(round.Blueprints)

    const cmd = cmdShowRound.cmd
    args = u.stripPreSpaced(args, cmd)

    E(
      this,
      {class: a.spaced(
        `w-full flex col-sta-str gap-2`,
        ui.CLS_MEDIA_PAD_X,
        ui.CLS_MEDIA_PAD_T,
      )},
      E(
        `div`,
        {class: `w-full flex row-bet-sta gap-2`},
        E(`div`, {class: `flex-1 min-w-0 flex col-sta-sta gap-2`},
          E(`h2`, {class: `trunc-base w-full`},
            `run `, ui.Bold(run_num), ` round `, ui.Bold(round.RoundIndex),
          ),
          a.vac(a.optStr(args)) && ui.BtnPrompt({
            cmd, suf: args, full: true, trunc: true, width: `w-full`,
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
        Details(`doctrines`, a.map(doctrines, gc.codeToNameShort)),
        Details(`frontier modifiers`, a.map(frontierMods, gc.codeToNameShort)),
        Details(`frontier dotations`, a.map(dotations, gc.codeToNameShort)),
        Details(`frontier curses`, a.map(curses, gc.codeToNameShort)),
        Details(`blueprints`, a.entries(blueprints).map(Blueprint)),
      ),
    )
  }

  addCloseBtn(btn) {this.closeBtn.val = btn}
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

function Details(summary, chi) {return ui.DetailsPre({summary, chi, chiLvl: 1})}

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

function Blueprint([code, count]) {
  return [
    gc.codeToNameShortOpt(a.stripPre(code, `BP`)) || code,
    a.vac(a.laxInt(count) > 1) && ` (${count})`,
  ]
}

class TableSettingsAndHints extends dr.MixReg(HTMLDetailsElement) {
  constructor() {
    super()

    ui.DetailsPre({
      elem: this,
      summary: `settings and hints`,
      class: a.spaced(ui.CLS_MEDIA_PAD_X, `whitespace-pre-wrap`),
      count: false,
      chiLvl: 1,
      open: SETTINGS_OPEN.val,
      ontoggle: this.onToggle,
      chi: [
        ...TableHints(),
        TableControlNumMode(),
        TableControlShowChi(),
        TableControlMissingLast(),
        TableControlWide(),
        TableControlLong(),
      ],
    })
  }

  rec = a.recurTask(this, this.onSettings)
  onSettings() {this.open = SETTINGS_OPEN.val}
  onToggle() {SETTINGS_OPEN.val = this.open}
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
    ui.Muted(`hint:`), ` click columns to sort`,
  )
}

function TableHintClick() {
  return [
    ui.Muted(`hint:`),
    ` ctrl+click a building row to toggle `,
    ui.Bold(`all`), ` children`,
  ]
}

function TableControlNumMode() {
  return new ObsRadio({
    label: `numbers`,
    obs: NUM_MODE,
    vals: NUM_MODES,
  })
}

function TableControlShowChi() {
  return new ObsCheckbox({
    label: `show children`,
    obs: SHOW_CHI,
    tooltip: `same as ctrl+click on any building row`,
  })
}

function TableControlMissingLast() {
  return new ObsCheckbox({
    label: `missing last`,
    obs: MISSING_LAST,
    tooltip: `prefer to sort missing values to the bottom`,
  })
}

function TableControlWide() {
  return new ObsCheckbox({
    label: `wide`,
    obs: WIDE,
    tooltip: `take the entire width of the media panel`,
  })
}

function TableControlLong() {
  return new ObsCheckbox({
    label: `long`,
    obs: LONG,
    tooltip: `show every building`,
  })
}

class SortObs extends u.StorageObsJson {
  decode(src) {return a.laxDict(a.onlyDict(super.decode(src)))}
  isEnabled() {return !!this.get()?.key}
}

export const BUI_SORT = new SortObs(`tabularius.round_table.sort_bui`)
export const CHI_SORT = new SortObs(`tabularius.round_table.sort_chi`)
export const WEP_SORT = new SortObs(`tabularius.round_table.sort_wep`)
export const SORTS = [BUI_SORT, CHI_SORT, WEP_SORT]

// SYNC[bui_stat_types].
export const BUI_STAT_TYPES = [...s.STAT_TYPES, `bui_cost`]

// SYNC[bui_cols].
export const BUI_COLS = [
  {sortObs: BUI_SORT, key: `bui_type_upg`,           type: TYPE_ANY, colspan: 3},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_DONE,     type: TYPE_NUM, colspan: 2},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_OVER,     type: TYPE_NUM, colspan: 2},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_DONE_ACC, type: TYPE_NUM, colspan: 2, hide: true},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_OVER_ACC, type: TYPE_NUM, colspan: 2, hide: true},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_COST_EFF,     type: TYPE_NUM, colspan: 2},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_COST_EFF_ACC, type: TYPE_NUM, colspan: 2, hide: true},
  {sortObs: BUI_SORT, key: `bui_cost`,               type: TYPE_NUM, colspan: 2},
]

// SYNC[chi_stat_types].
export const CHI_STAT_TYPES = [
  s.STAT_TYPE_DMG_DONE,
  s.STAT_TYPE_DMG_OVER,
  s.STAT_TYPE_DMG_DONE_ACC,
  s.STAT_TYPE_DMG_OVER_ACC,
]

// SYNC[chi_cols].
export const CHI_COLS = [
  {sortObs: CHI_SORT, key: `chi_type`, type: TYPE_ANY, colspan: 3},
  ...a.map(CHI_STAT_TYPES, key => ({sortObs: CHI_SORT, key, type: TYPE_NUM, colspan: 2})),
  {sortObs: CHI_SORT, key: `enabled`, type: TYPE_BOOL, colspan: 6, hide: true},
]

// SYNC[wep_cols].
export const WEP_COLS = [
  {sortObs: WEP_SORT, key: `wep_type`, type: TYPE_ANY, colspan: 3},
  {sortObs: WEP_SORT, key: `range`,    type: TYPE_ANY, hide: true},
  {sortObs: WEP_SORT, key: `mag`,      type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `rof`,      type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `rel`,      type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `dmg`,      type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `targs`,    type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `dmg_base`, type: TYPE_NUM, hide: true},
  {sortObs: WEP_SORT, key: `dmg_perc`, type: TYPE_PERC_MOD, hide: true},
  {sortObs: WEP_SORT, key: `air`,      type: TYPE_PERC_MOD},
  {sortObs: WEP_SORT, key: `shield`,   type: TYPE_PERC_MOD},
  {sortObs: WEP_SORT, key: `aoe`,      type: TYPE_NUM, hide: true},
  {sortObs: WEP_SORT, key: `detec`,    type: TYPE_BOOL, hide: true},
  {sortObs: WEP_SORT, key: `targ`,     type: TYPE_ANY, colspan: 2, hide: true},
]

validateColAlignment()

class RoundTable extends dr.MixReg(HTMLTableElement) {
  constructor(opt) {
    super()
    E(
      this,
      {class: `w-full table table-fixed border-collapse`},
      new RoundTableHead(opt),
      new RoundTableBody(opt),
    )
  }
}

class RoundTableHead extends dr.MixReg(HTMLTableSectionElement) {
  static localName = `thead`

  constructor() {
    super()
    for (const col of BUI_COLS) {
      this.appendChild(new TableHeadCell({...col, sortObs: BUI_SORT}))
    }
  }
}

class RoundTableBody extends dr.MixReg(HTMLTableSectionElement) {
  static localName = `tbody`
  inited = false
  sorter = undefined
  rowList = undefined
  rowObs = a.obsRef()

  constructor(opt) {
    super()
    this.rowList = roundTableRows(opt).tbodyRows
    this.sorter = a.recur(this, this.sort)
    E(this, undefined, this.rowObs)
  }

  sort() {
    a.each(SORTS, getVal)

    let rows = this.rowList

    if ((this.inited !== (this.inited = true)) || a.some(SORTS, isEnabled)) {
      rows = a.sort(this.rowList, compareRowsDeep)
    }

    afterSort(rows)
    this.rowObs.val = rows
  }
}

class TableRow extends dr.MixReg(HTMLTableRowElement) {
  parent = undefined
  ancs = undefined
  sortInd = undefined
  sortObs = undefined
  cellDict = undefined

  constructor({parent, sortInd, sortObs} = {}) {
    super()
    this.parent = a.optNode(parent)
    this.sortInd = a.reqNat(sortInd)
    this.sortObs = a.optInst(sortObs, SortObs)
  }

  isSortable() {return true}
  afterSort() {}
  getCell(key) {return this.getCellDict()[a.reqValidStr(key)]}

  getCellDict() {
    if (this.cellDict) return this.cellDict
    const out = a.Emp()
    for (const node of this.cells) {
      const {key} = node
      if (a.isValidStr(key)) out[key] = node
    }
    return this.cellDict = out
  }

  ancestorLen() {
    let out = 0
    let val = this
    while (a.isSome(val = val.parent)) out++
    return out
  }

  ancestors() {
    let out = this.ancs
    if (out) return out

    out = this.ancs = []
    let val = this
    while (a.isSome(val = val.parent)) out.push(val)
    return out.reverse()
  }
}

class SubRow extends TableRow {
  pre = ui.Pale()

  constructor({showRow, ...opt}) {
    super(opt)
    E(this, () => ({class: `tr-sub`, hidden: !showRow.val}))
  }

  afterSort({rows, ind}) {
    this.pre.textContent = a.reqStr(rowPre(this, ind, rows))
  }
}

class SubRowTheadPseudo extends SubRow {
  constructor({cols, ...opt}) {
    E(
      super(opt),
      undefined,
      a.reqArr(cols).map(a.bind(Th, {headPre: this.pre})),
    )
  }

  isSortable() {return false}
}

class SubRowTr extends SubRow {
  constructor({data, total, cols, ...opt}) {
    E(
      super(opt),
      undefined,
      a.reqArr(cols).map(a.bind(Td, {data, total, headPre: this.pre})),
    )
  }
}

function Th({headPre, headSuf}, col, ind) {
  const isHead = ind === 0

  return new TableHeadCell({
    ...a.reqDict(col),
    pre: a.vac(isHead) && headPre,
    suf: a.vac(isHead) && headSuf,
  })
}

class TableHeadCell extends dr.MixReg(HTMLTableCellElement) {
  static localName = `th`
  sortObs = undefined
  key = undefined
  pre = undefined
  sort = new Text()

  constructor({sortObs, key, colspan, hide, pre, suf, attrs}) {
    super()
    this.sortObs = a.reqInst(sortObs, SortObs)
    this.key = a.reqValidStr(key)

    E(
      this,
      {
        ...a.optDict(attrs),
        colspan,
        class: a.spaced(
          CLS_CELL_HEAD,
          attrs?.class,
          a.vac(a.optBool(hide) && CLS_HIDE_BELOW),
        ),
      },
      pre,
      this.sortIndicator.bind(this),
      ui.withGlossary({
        key, elem: ui.Span(key), glos: STAT_GLOSSARY, under: true,
      }),
      suf,
    )

    // TODO: add a `.tabIndex` and a proper `.onkeydown`.
    this.onclick = this.onClick
  }

  sortIndicator() {
    const {key, desc} = this.sortObs.val
    if (key !== this.key) return ``
    if (a.isNil(desc)) return ``
    if (desc) return `▼ `
    return `△ `
  }

  onClick(eve) {
    if (u.isEventModifiedPrimary(eve)) return
    this.sortNext()
  }

  sortNext() {
    const {key, sortObs} = this
    sortObs.val = cycleSort(key, sortObs.val)
  }
}

function Td({data, total, headPre, headSuf}, col, ind) {
  const {key} = col

  if (u.DEV) {
    a.reqDict(data)
    a.optDict(total)
    reqCol(data, key)
  }

  const val = data[key]
  const perc = total && percOpt(val, total[key])
  const isHead = ind === 0

  return new TableCell({
    ...col,
    ind,
    val,
    perc,
    pre: a.vac(isHead) && headPre,
    suf: a.vac(isHead) && headSuf,
  })
}

class TableCell extends dr.MixReg(HTMLTableCellElement) {
  static localName = `td`

  type = a.optStr()
  key = a.optValidStr()
  val = undefined
  perc = a.optFin()

  constructor({type, key, val, perc, pre, suf, colspan, hide, attrs}) {
    super()
    this.type = a.optStr(type)
    this.key = a.reqValidStr(key)
    this.val = val
    this.perc = a.optFin(perc)

    return E(
      this,
      {
        ...a.optDict(attrs),
        colspan,
        class: a.spaced(
          attrs?.class,
          CLS_CELL_COMMON,
          a.vac(a.optBool(hide) && CLS_HIDE_BELOW),
        ),
      },
      pre,
      (
        type === TYPE_NUM && a.isSome(perc)
        ? this.inner.bind(this)
        : this.fmtVal()
      ),
      suf,
    )
  }

  inner() {
    const {type, perc} = this
    if (type !== TYPE_NUM) return this.fmtVal()

    const mode = NUM_MODE.val
    if (mode === NUM_MODE_NUM) return this.fmtVal()

    if (mode === NUM_MODE_PERC) {
      return E(`span`, {class: CLS_PERC}, this.fmtPerc())
    }

    if (a.isNil(perc)) return this.fmtVal()

    return E(`span`, {class: `flex row-bet-cen gap-2`},
      E(`span`, {class: `trunc`}, this.fmtVal()),
      E(`span`, {class: CLS_PERC}, this.fmtPerc()),
    )
  }

  fmtVal() {return fmtVal(this.type, this.val)}
  fmtPerc() {return fmtNumPerc(this.perc)}
}

class BuiRow extends TableRow {
  sortObs = BUI_SORT
  buiInd = a.obsRef()
  showRow = a.calc(this, calcShowRow)
  expandChi = a.calc(SHOW_CHI, getVal)
  showChi = a.calc(this, calcShowChi)

  constructor({buiInd, sortInd, data, total, chiDatas, hasAssoc}) {
    super({sortInd})

    this.buiInd.val = a.reqNat(buiInd)

    const headSuf = (
      a.len(chiDatas) === 1
      ? [`: `, ui.Muted(a.head(chiDatas)[a.reqValidStr(a.head(CHI_COLS).key)])]
      : a.len(chiDatas) > 1
      ? [`: `, ui.Muted(a.len(chiDatas))]
      : undefined
    )

    E(
      this,
      () => ({
        class: a.spaced(
          CLS_ROW_TOP,
          a.vac(hasAssoc) && a.spaced(`cursor-pointer`, ui.CLS_BUSY_BG),
        ),
        hidden: !this.showRow.val,
        onclick: a.vac(hasAssoc) && this.onClick,
      }),
      BUI_COLS.map(a.bind(Td, {data, total, headSuf})),
    )
  }

  afterSort({buiInd}) {this.buiInd.val = a.reqNat(buiInd)}

  /*
  When clicking a bui row to toggle its children, we actually want other bui
  rows to remain unchanged. For example, if you scroll down and click a row in
  the middle, toggling ALL child rows would shift all rows and you'd lose track
  of what you clicked.

  When you click a row, or Ctrl+click / Cmd+click one, the result should be
  based entirely on the state of that row, not on any hidden state. If you
  click a row whose assoc rows are hidden, then if modified, this should
  show _all_ rows, but otherwise this should only show the assoc rows of the
  target. Inverse for a row whose assoc rows are visible.
  */
  onClick(eve) {
    const show = !this.expandChi.val
    this.expandChi.val = show

    if (!u.isEventModifiedPrimary(eve)) return

    SHOW_CHI.val = show

    // Rerun all observers even if the value didn't change.
    // This causes all manually opened bui rows to close when `!show`.
    SHOW_CHI.flush()
  }
}

function calcShowRow() {
  const long = a.laxBool(LONG.val)
  const ind = a.reqNat(this.buiInd.val)
  return long || (ind <= LONG_ROW_BREAKPOINT)
}

function calcShowChi() {
  const showRow = this.showRow.val
  const expandChi = this.expandChi.val
  return a.laxBool(showRow && expandChi)
}

class BuiLongToggleRow extends TableRow {
  lenBui = undefined
  lenMax = undefined

  get obs() {return LONG}
  get cols() {return BUI_COLS}

  constructor({lenBui, lenMax, class: cls, colspan, ...opt}) {
    super(opt)
    this.lenBui = a.reqNat(lenBui)
    this.lenMax = a.reqNat(lenMax)

    E(
      this,
      {class: a.spaced(
        CLS_ROW_TOP,
        `cursor-pointer`, ui.CLS_BUSY_BG, ui.CLS_TEXT_MUTED,
        cls,
      )},
      E(`td`, {class: `text-center py-1`, colspan}, this.text.bind(this)),
    )
    this.onclick = this.onClick
  }

  text() {
    const {lenBui, lenMax, obs} = this
    const show = a.optBool(obs.val)
    return (
      show
      ? `click to see first ${lenMax} of ${lenBui} buildings`
      : `click to show ${lenBui - lenMax} hidden buildings of ${lenBui}`
    )
  }

  onClick() {this.obs.val = !this.obs.val}
}

function roundTableRows({round, user_id, run_num, run_ms}) {
  const dat = a.Emp()

  s.datAddRound({
    dat, round, user_id, run_num, run_ms, composite: false,
    tables: {round_buis: true},
  })

  const buiEntries = a.entries(round.Buildings)
  const buiTotal = a.Emp()
  const buiDatas = a.Emp()
  const tbodyRows = []
  const buiRows = []

  for (const [bui_inst] of buiEntries) {
    const round_bui = a.reqDict(dat.round_buis[bui_inst])
    buiDatas[bui_inst] = buiStatData({round_bui, buiTotal})
  }

  for (const [bui_inst, bui] of buiEntries) {
    const round_bui = a.reqDict(dat.round_buis[bui_inst])
    const buiData = buiDatas[bui_inst]
    addRoundTableRows({tbodyRows, buiRows, bui, buiData, round_bui, buiTotal})
  }

  addBuiToggleRows({tbodyRows, buiRows})
  return {tbodyRows, buiRows}
}

function addRoundTableRows({tbodyRows, buiRows, bui, buiData, round_bui, buiTotal}) {
  a.reqArr(tbodyRows)
  a.reqArr(buiRows)

  const {wepTypes, dumBulTypes} = a.reqDict(round_bui)
  const chiTotal = a.Emp()
  const chiDatas = []
  const wepDatas = []

  for (const [ind, wep] of a.entries(bui.Weapons)) {
    const stats = bui.WeaponStats[ind]?.stats
    if (!shouldShowWep(wep, stats)) continue

    chiDatas.push(wepStatData({wep, stats, chiTotal}))
    wepDatas.push(wepDetailData(wep))
  }

  for (const [type, val] of a.entries(bui.ChildLiveStats)) {
    if (wepTypes.has(type) || dumBulTypes.has(type)) continue
    const stats = val?.stats
    chiDatas.push(chiStatData({type, stats, chiTotal}))
  }

  // SYNC[bui_has_assoc].
  const hasAssoc = (chiDatas.length > 1) || (wepDatas.length > 0)

  const buiRow = new BuiRow({
    buiInd: buiRows.length, sortInd: tbodyRows.length,
    data: buiData, total: buiTotal, chiDatas, hasAssoc,
  })

  tbodyRows.push(buiRow)
  buiRows.push(buiRow)

  // SYNC[bui_has_assoc].
  if (chiDatas.length > 1) {
    const cols = CHI_COLS
    const sortObs = CHI_SORT

    addPseudoTableRows({
      tbodyRows, parent: buiRow, cols, datas: chiDatas,
      sortObs, showRow: buiRow.showChi, total: chiTotal,
    })
  }

  if (wepDatas.length) {
    const cols = WEP_COLS
    const sortObs = WEP_SORT

    addPseudoTableRows({
      tbodyRows, parent: buiRow, cols, datas: wepDatas,
      sortObs, showRow: buiRow.showChi,
    })
  }
}

function addPseudoTableRows({
  tbodyRows, parent, cols, datas, total, sortObs, ...opt
}) {
  a.reqArr(tbodyRows)
  a.reqArr(datas)

  const head = new SubRowTheadPseudo({
    parent, cols, sortInd: tbodyRows.length, sortObs, ...opt
  })

  tbodyRows.push(head)

  for (const data of datas) {
    tbodyRows.push(new SubRowTr({
      parent: head, sortInd: tbodyRows.length, sortObs,
      data, total, cols, ...opt,
    }))
  }
}

function addBuiToggleRows({tbodyRows, buiRows}) {
  a.reqArr(tbodyRows)
  a.reqArr(buiRows)

  const lenBui = buiRows.length
  const lenMax = LONG_ROW_BREAKPOINT
  if (lenBui <= lenMax) return

  tbodyRows.push(
    new BuiLongToggleRow({
      lenBui, lenMax, class: CLS_HIDE_BELOW, sortInd: tbodyRows.length,
      colspan: sumColspans(BUI_COLS).all,
    }),
    new BuiLongToggleRow({
      lenBui, lenMax, class: CLS_HIDE_ABOVE, sortInd: tbodyRows.length,
      colspan: sumColspans(BUI_COLS).show,
    }),
  )
}

function buiStatData({round_bui, buiTotal}) {
  a.reqDict(round_bui)
  a.reqDict(buiTotal)

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
    addTotal(buiTotal, type, val)
  }

  const cost = a.laxFin(round_bui.cost)
  out.bui_cost = cost
  addTotal(buiTotal, `bui_cost`, cost)
  return out
}

function addTotal(tar, key, val) {
  a.reqDict(tar)
  a.reqValidStr(key)
  if (a.isFin(val)) tar[key] = a.laxFin(tar[key]) + val
}

function wepStatData({wep, stats, chiTotal}) {
  a.reqDict(wep)
  // SYNC[chi_cols].
  const out = chiStatData({type: wep.EntityID, stats, chiTotal})
  out.enabled = wep.Enabled
  return out
}

// SYNC[chi_cols].
// SYNC[chi_stat_types].
function chiStatData({type, stats, chiTotal}) {
  a.reqStr(type)
  a.optDict(stats)

  function add(key, val) {
    out[key] = val
    addTotal(chiTotal, key, val)
  }

  const out = a.Emp()
  out.chi_type = s.codedToNamed(`chi_type`, type)

  add(`dmg_done`, stats?.DamageDone?.valueThisWave)
  add(`dmg_done_acc`, stats?.DamageDone?.valueThisGame)
  add(`dmg_over`, stats?.DamageOverkill?.valueThisWave)
  add(`dmg_over_acc`, stats?.DamageOverkill?.valueThisGame)

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
  out.rel = reifyReload(wep.ReloadTime)
  out.rof = reify(wep.RateOfFire)

  const targs = wep.TargetingPriorities

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
function compareRowsDeep(one, two) {
  if (u.DEV) reqRow(one), reqRow(two)

  const oneAncs = one.ancestors()
  const twoAncs = two.ancestors()
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
function compareRows(one, two) {
  if (one === two) return 0
  if (a.isNil(two.sortInd)) return -1
  if (a.isNil(one.sortInd)) return 1

  const fallback = a.reqFin(one.sortInd) - a.reqFin(two.sortInd)
  const obs = one.sortObs
  if (!obs || obs !== two.sortObs) return fallback

  const {key, desc} = obs.val
  if (!key) return fallback
  if (!one.isSortable()) return fallback
  if (!two.isSortable()) return fallback

  const oneCell = one.getCell(key)
  if (!oneCell) return fallback

  const twoCell = two.getCell(key)
  if (!twoCell) return fallback

  const oneVal = oneCell.val
  const twoVal = twoCell.val

  if (MISSING_LAST.val) {
    if (!oneVal && twoVal) return 1
    if (oneVal && !twoVal) return -1
  }

  return (
    desc
    ? u.compareDesc(oneVal, twoVal)
    : u.compareAsc(oneVal, twoVal)
  ) || fallback
}

function withGlossary(key, elem) {
  return ui.withGlossary({elem, key, glos: STAT_GLOSSARY, under: true})
}

function BtnReplace(suf, eph) {
  return ui.BtnPrompt({cmd: cmdShowRound.cmd, suf, eph, full: true})
}

function BtnReplaceEph(eph) {return BtnReplace(undefined, eph)}

class ObsCheckbox extends dr.MixReg(HTMLLabelElement) {
  input = undefined

  constructor({label, obs, tooltip, onchange}) {
    super()
    a.reqRec(obs)

    E(
      this,
      {class: `inline-flex row-sta-cen gap-2 cursor-pointer`},

      ui.Muted((
        tooltip
        ? ui.withTooltip({
          chi: tooltip,
          elem: ui.clsAdd(ui.Span(label), ui.CLS_HELP_UNDER),
        })
        : label
      ), `:`),

      E(`input`, () => ({
        type: `checkbox`,
        value: ``,
        class: `cursor-pointer`,
        checked: a.laxBool(obs.val),
        onchange() {
          obs.val = this.checked
          onchange?.call(this, obs.val)
        },
      })),
    )
  }
}

class ObsRadio extends dr.MixReg(HTMLFieldSetElement) {
  obs = undefined

  constructor({label, obs, vals}) {
    super()
    a.reqSome(label)
    this.obs = a.reqRec(obs)
    const name = a.uuid()

    E(
      this,
      {class: `inline-flex row-sta-cen gap-2`, onchange: onNumModeChange},
      E(`span`, {class: a.spaced(ui.CLS_TEXT_MUTED, `trunc`)}, label, `:`),
      a.map(vals, val => ObsRadioInput({val, obs, name})),
    )
  }
}

function onNumModeChange(eve) {NUM_MODE.val = eve.target.value}

function ObsRadioInput({val, obs, name}) {
  a.reqStr(val)
  a.reqRec(obs)
  a.optStr(name)

  return E(
    `label`,
    {class: `flex row-sta-cen gap-1 cursor-pointer`},
    E(
      `input`,
      () => ({
        type: `radio`,
        class: `cursor-pointer`,
        name,
        value: val,
        checked: a.laxStr(obs.val) === val,
        onchange() {obs.val = this.value},
      }),
    ),
    E(`span`, {class: `flex row-cen-cen trunc-base`}, val || `all`),
  )
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
function reify(src) {
  if (!a.optRec(src)) return undefined
  const base = a.laxFin(src.baseValue)
  const baseMod = a.laxFin(src.rawModifier)
  const percMod = a.laxFin(src.pctModifier)
  return (base + baseMod) * (1 + (percMod / 100))
}

/*
The game seems to calculate reload differently than other values. It seems to
treat the base value as reload time in seconds, while treating the percentages
as modifiers for reload _speed_ rather than time, and with an opposite sign to
boot. Negative sign seems to be treated as reload speed bonus, and vice versa.
*/
function reifyReload(src) {
  if (!a.optRec(src)) return undefined
  const timeBase = a.laxFin(src.baseValue)
  const timeMod = a.laxFin(src.rawModifier)
  const speedPercMod = a.laxFin(src.pctModifier)
  const time = timeBase + timeMod
  const speedBase = 1 / time
  const speedFinal = speedBase * (1 + (-speedPercMod / 100))
  return 1 / speedFinal
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

function percOpt(one, two) {
  return a.isFin(one) && a.isFin(two) ? a.onlyFin(one / two) : undefined
}

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
function bin(src, dicts) {
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
function finOpt(val) {return a.optFin(val) || undefined}

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

class Words extends a.Words {abbr() {return this.mapMut(first).join(``)}}
function abbrs(src) {return a.spaced(...a.map(src, abbr))}
function abbr(src) {return Words.from(src).abbr()}
function first(src) {return src[0]}
function isEnabled(val) {return val.isEnabled()}
function getVal(val) {return a.reqObs(val).val}

function reqCol(src, key) {
  a.reqValidStr(key)
  if (a.hasOwn(src, key)) return
  throw Error(`internal: missing column ${a.show(key)} in ${a.show(src)}`)
}

function afterSort(rows) {
  let ind = -1
  let buiInd = -1

  for (const row of rows) {
    ind++
    if (a.isInst(row, BuiRow)) buiInd++
    row.afterSort({rows, ind, buiInd})
  }
}

function rowPre(row, ind, rows) {
  a.reqNat(ind)
  a.reqArr(rows)

  const ancs = a.reqArr(row.ancestors())
  const lvls = ancs.length
  if (!lvls) return ``

  const prev = rows[ind - 1]
  const next = rows[ind + 1]
  const prevAncs = a.optArr(prev?.ancestors())
  const nextAncs = a.optArr(next?.ancestors())

  let pre = ``
  let lvl = -1

  while (++lvl < lvls) {
    const anc = a.reqSome(ancs[lvl])
    const lvlLast = lvl >= lvls - 1

    const upAnc = anc === prevAncs?.[lvl] || anc === prev
    const upShow = upAnc && !(prevAncs?.length > lvls)

    const downAnc = anc === nextAncs?.[lvl] || anc === next
    const downShow = downAnc && !(nextAncs?.length > lvls)

    pre += (
      !lvlLast
      ? (upAnc ? `  ` : `──`)
      : (
        upShow && downShow
        ? `├─`
        : upShow && !downShow
        ? `└─`
        : !upShow && downShow
        ? `┌─`
        : `  `
      )
    )
  }
  return pre
}

export function apiDownloadRound(sig, path) {
  const url = u.paths.join(u.API_URL, `download_round`, a.laxStr(path))
  const opt = {signal: u.reqSig(sig)}
  return u.fetchJson(url, opt)
}
