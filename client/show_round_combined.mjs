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

import * as self from './show_round_combined.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.sr = self
a.patch(globalThis, namespace)

cmdShowRoundCombined.cmd = `show_round_combined`
cmdShowRoundCombined.desc = `detailed breakdown of one round`
cmdShowRoundCombined.help = function cmdShowRoundCombinedHelp() {
  return cmdShowRoundHelp(cmdShowRoundCombined)
}

export function cmdShowRoundHelp({cmd, desc}) {
  const saveDir = a.laxStr(fs.SAVE_DIR_CONF.handle?.name)
  const histDir = a.laxStr(fs.HISTORY_DIR_CONF.handle?.name)

  return ui.LogParagraphs(
    desc,
    ls.helpSources(cmd),

    `local usage:`,

    [
      `  `,
      os.BtnCmd(cmd),
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
          ? BtnReplace(cmd, u.paths.join(saveDir, fs.PROG_FILE_NAME))
          : BtnReplaceEph(cmd, u.paths.join(`<saves>`, fs.PROG_FILE_NAME))
        ),
        ` -- use save file`,
        a.vac(!saveDir) && [`; requires `, os.BtnCmdWithHelp(`saves`)],
      ],
      [
        `  `,
        (histDir ? BtnReplace(cmd, histDir) : BtnReplaceEph(cmd, `<history>`)),
        ` -- latest round in latest run`,
        a.vac(!histDir) && [`; requires `, os.BtnCmdWithHelp(`history`)],
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(cmd, histDir + `/`, `<run_num>`)
          : BtnReplaceEph(cmd, `<history>/<run_num>`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(cmd, histDir + `/`, `<run_num>/<round_num>`)
          : BtnReplaceEph(cmd, `<history>/<run_num>/<round_num>`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(cmd, u.paths.join(histDir, `latest`))
          : BtnReplaceEph(cmd, `<history>/latest`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(
            cmd,
            u.paths.join(histDir, `latest`) + `/`,
            `<round_num>`,
          )
          : BtnReplaceEph(cmd, `<history>/latest/<round_num>`)
        ),
      ],
      [
        `  `,
        (
          histDir
          ? BtnReplace(cmd, u.paths.join(histDir, `latest/latest`))
          : BtnReplaceEph(cmd, `<history>/latest/latest`)
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
        os.BtnCmd(`${cmd} -c`),
        ` -- latest round from any user`,
      ],
      [
        `  `,
        os.BtnCmd(`${cmd} -c -u`),
        ` -- latest round from current user`,
        a.vac(!au.isAuthed()) && [`; requires `, os.BtnCmdWithHelp(`auth`)],
      ],
      [
        `  `,
        BtnReplace(cmd, `-c `, `<user_id>`),
        ` -- latest round from specific user`,
      ],
      [
        `  `,
        BtnReplace(cmd, `-c `, `<user_id>/<run_num>`),
        ` -- latest round from specific user and run`,
      ],
      [
        `  `,
        BtnReplace(cmd, `-c `, `<user_id>/<run_num>/<round_num>`),
        ` -- specific user, run, round`,
      ],
    ),

    [`tip: use `, os.BtnCmdWithHelp(`ls -c`), ` to browse uploaded rounds`],
  )
}

export function cmdShowRoundCombined({sig, args}) {
  return cmdShowRound({sig, cmd: cmdShowRoundCombined, args, View: ShowRoundCombined})
}

export async function cmdShowRound({sig, cmd: cmdFun, args, View}) {
  u.reqSig(sig)
  os.reqCmd(cmdFun)
  a.reqStr(args)
  a.reqCls(View)

  const cmd = u.cliArgHead(args)
  const paths = []
  let cloud
  let user

  for (const [key, val, pair] of u.cliDecode(u.cliArgTail(args))) {
    if (u.isHelpFlag(key)) return os.cmdHelpDetailed(cmdFun)
    if (key === `-c`) {
      cloud = ui.cliBool({cmd, key, val})
      continue
    }
    if (key === `-u`) {
      user = ui.cliBool({cmd, key, val})
      continue
    }
    if (key) {
      ui.LOG.err(ui.msgUnrecInput(pair, args))
      return os.cmdHelpDetailed(cmdFun)
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

  const opt = {sig, args, View}

  return new os.Combo({mediaItems: await Promise.all(a.map(paths, path => (
    cloud
    ? showRoundCloud({...opt, path})
    : showRoundLocal({...opt, path})
  )))})
}

export async function showRoundLocal({sig, args, path, View}) {
  const {handle, round, live} = await fs.findRoundFileAny({sig, path})
  return showRoundFile({sig, args, handle, round, live, View})
}

export async function showRoundCloud({sig, args, path, View}) {
  const round = await apiDownloadRound(sig, path)
  return showRoundFile({sig, args, round, View})
}

export async function showRoundFile({sig, args, handle, round, live, View}) {
  u.reqSig(sig)
  a.optInst(handle, FileSystemFileHandle)
  a.optDict(round)
  a.reqValidStr(args)
  a.optBool(live)
  a.reqCls(View)

  round ??= await fs.readDecodeGameFile({sig, file: handle})

  const user_id = round.tabularius_user_id || d.USER_ID
  const run_num = round.tabularius_run_num ?? 0
  const run_ms = round.tabularius_run_ms ?? Date.parse(round.LastUpdated)
  const run_id = s.makeRunId(user_id, run_num, run_ms)

  return new View({
    round, user_id, run_id, run_num, run_ms, args, live,
  }).init()
}

// TODO: more colors for different types.
export const CLS_PERC = `text-sky-700 dark:text-sky-300`

export const TYPE_ANY = undefined
export const TYPE_HELP = `help`
export const TYPE_BOOL = `bool`
export const TYPE_NUM = `num`
export const TYPE_NUM_MOD = `num_mod`
export const TYPE_PERC = `perc`
export const TYPE_PERC_MOD = `perc_mod`
export const TYPE_PRIO = `prio`

export const NUM_MODE_BOTH = ``
export const NUM_MODE_NUM = `num`
export const NUM_MODE_PERC = `perc`
export const NUM_MODES = [NUM_MODE_BOTH, NUM_MODE_NUM, NUM_MODE_PERC]

export const NUM_MODE = u.storageObs(`tabularius.show_round.num_mode`)
export const SHOW_CHI = u.storageObsBool(`tabularius.round_table.show_chi`)
export const MISSING_LAST = u.storageObsBool(`tabularius.show_round.missing_last`, true)
export const WIDE = u.storageObsBool(`tabularius.show_round.wide`)
export const LONG = u.storageObsBool(`tabularius.show_round.long`)
export const SETTINGS_OPEN = u.storageObsBool(`tabularius.show_round.settings_open`)
export const LONG_ROW_BREAKPOINT = 12

export class ShowRoundCombined extends ui.Elem {
  closeBtn = a.obsRef()
  opt = undefined

  constructor(opt) {
    super()
    this.opt = {...a.reqDict(opt), closeBtn: this.closeBtn}

    E(this, {
      class: () => a.spaced(
        `@container flex col-sta-str max-w-none min-h-8 text-sm`,
        ui.CLS_MEDIA_CHI,
        a.vac(a.deref(WIDE)) && ui.CLS_MEDIA_ITEM_WIDE,
      ),
    })

    if (a.optBool(opt.live)) d.listenNewRound(this, this.onNewRound)
  }

  init() {
    const opt = a.reqDict(this.opt)
    const dat = a.Emp()
    s.datAddRound({...opt, dat, composite: false, tables: {round_buis: true}})
    opt.roundBuis = a.laxDict(dat.round_buis)

    return E(this, {chi: [
      E(RoundHead, {
        ...opt,
        chi: E(TableHintsAndControls, [
          [
            E(TableHintHidden, {class: ui.CLS_ONLY_NARROW}),
            E(TableHintSort, {class: ui.CLS_ONLY_WIDE}),
          ],
          E(TableHintClick),
          E(TableControlNumMode),
          E(TableControlShowChi),
          E(TableControlMissingLast),
          E(TableControlWide),
          E(TableControlLong, `building`),
        ]),
      }),
      E(RoundTableCombined, opt),
    ]})
  }

  // Invoked by `MEDIA`.
  addCloseBtn(btn) {a.reset(this.closeBtn, btn)}

  onNewRound(src) {
    const {round, run_num, run_ms} = src
    this.opt.round = round
    this.opt.run_num = run_num
    this.opt.run_ms = run_ms
    this.init()
  }
}

export function RoundHead({round, user_id, run_id, run_num, args, chi, closeBtn}) {
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
  const [cmd, ...rest] = u.splitCliArgs(args)
  args = a.spaced(...rest)

  return E(`div`, {
    class: `w-full flex col-sta-str gap-y-2 p-2`,
    chi: [
      E(`div`, {
        class: `w-full flex row-bet-sta gap-x-2`,
        chi: [
          E(`div`, {
            class: `flex-1 min-w-0 flex col-sta-sta gap-y-2`,
            chi: [
              E(`h2`, {
                class: `trunc-base w-full`,
                chi: [`run `, ui.Bold(run_num), ` round `, ui.Bold(round.RoundIndex)],
              }),
              a.vac(a.optStr(args)) && ui.BtnPrompt({
                cmd, suf: args, full: true, trunc: true, width: `w-full`,
              }),
            ],
          }),
          closeBtn,
        ],
      }),
      E(`div`, {
        class: a.spaced(
          ui.CLS_BG_0,
          ui.CLS_BORD,
          `w-full grid-auto gap-x-4 gap-y-2 py-2 rounded border`,
        ),
        style: {
          '--grid-col-wid': `20ch`,
          '--grid-pad-hor': `0.5rem`,
        },
        chi: [
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
        ]
      }),
      DetailsGrid(
        Details(`doctrines`, a.map(doctrines, gc.codeToNameShort)),
        Details(`frontier modifiers`, a.map(frontierMods, gc.codeToNameShort)),
        Details(`frontier dotations`, a.map(dotations, gc.codeToNameShort)),
        Details(`frontier curses`, a.map(curses, gc.codeToNameShort)),
        Details(`blueprints`, a.entries(blueprints).map(Blueprint)),
      ),
      chi,
    ],
  })
}

function DetailsGrid(...chi) {
  if (!a.vac(chi)) return undefined

  return E(`div`, {
    class: `grid-auto justify-between gap-2`,
    style: {'--grid-col-wid': `32ch`, '--grid-pad-hor': `0px`},
    chi,
  })
}

function Details(summary, chi) {
  return ui.DetailsPre({summary, chi, chiLvl: 1, trunc: false})
}

function Pair(key, val) {
  if (a.isNil(val)) return undefined

  return E(`span`, {
    class: `flex row-bet-end gap-1 whitespace-pre overflow-clip`,
    chi: [
      withGlossary(ui.Muted(key), key),
      E(`span`, {
        class: a.spaced(ui.CLS_BORD, `flex-1 shrink-1 min-w-0 border-b border-dashed`),
      }),
      E(`span`, {class: `trunc`, chi: val}),
    ],
  })
}

function Blueprint([code, count]) {
  return [
    gc.codeToNameShortOpt(a.stripPre(code, `BP`)) || code,
    a.vac(a.laxInt(count) > 1) && ` (${count})`,
  ]
}

export function TableHintsAndControls(chi) {
  return ui.DetailsPre({
    summary: `hints and settings`,
    count: false,
    trunc: false,
    chiLvl: 1,
    obs: SETTINGS_OPEN,
    chi,
  })
}

export function TableHintHidden(props) {
  return E(`span`, {
    ...props,
    chi: [
      ui.Muted(`hint:`),
      ` some columns are hidden; make the media panel wider to see them`,
    ],
  })
}

export function TableHintSort(props) {
  return E(`span`, {
    ...props,
    chi: [ui.Muted(`hint:`), ` click columns to sort`],
  })
}

export function TableHintClick() {
  return E(`span`, {
    chi: [
      ui.Muted(`hint:`),
      ` ctrl+click a building row to toggle `,
      ui.Bold(`all`), ` children`,
    ]
  })
}

export function TableControlNumMode() {
  return E(ui.ObsRadio, {
    label: `numbers`,
    obs: NUM_MODE,
    vals: NUM_MODES,
  })
}

export function TableControlShowChi() {
  return E(ui.ObsCheckbox, {
    obs: SHOW_CHI,
    label: ui.withTooltip({
      elem: ui.Muted(`show children`),
      chi: `same as ctrl+click on any building row`,
    }),
  })
}

export function TableControlMissingLast() {
  return E(ui.ObsCheckbox, {
    obs: MISSING_LAST,
    label: ui.withTooltip({
      elem: ui.Muted(`missing last`),
      chi: `prefer to sort missing values to the bottom`
    }),
  })
}

export function TableControlWide() {
  return E(ui.ObsCheckbox, {
    obs: WIDE,
    label: ui.withTooltip({
      elem: ui.Muted(`wide`),
      chi: `take the entire width of the media panel`
    }),
  })
}

export function TableControlLong(desc) {
  return E(ui.ObsCheckbox, {
    obs: LONG,
    label: ui.withTooltip({
      elem: ui.Muted(`long`),
      chi: [`show every `, desc],
    }),
  })
}

export const BUI_SORT = ui.sortObs(`tabularius.round_table.sort_bui`)
export const CHI_SORT = ui.sortObs(`tabularius.round_table.sort_chi`)
export const WEP_SORT = ui.sortObs(`tabularius.round_table.sort_wep`)
export const SORTS = [BUI_SORT, CHI_SORT, WEP_SORT]

// SYNC[bui_cols].
export const BUI_COLS = [
  {sortObs: BUI_SORT, key: `bui_type_upg`,           type: TYPE_ANY, colspan: 3},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_DONE,     type: TYPE_NUM, colspan: 2},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_OVER,     type: TYPE_NUM, colspan: 2},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_DONE_ACC, type: TYPE_NUM, colspan: 2, wide: true},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_DMG_OVER_ACC, type: TYPE_NUM, colspan: 2, wide: true},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_COST_EFF,     type: TYPE_NUM, colspan: 2},
  {sortObs: BUI_SORT, key: s.STAT_TYPE_COST_EFF_ACC, type: TYPE_NUM, colspan: 2, wide: true},
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
  {sortObs: CHI_SORT, key: `enab`, type: TYPE_BOOL, colspan: 6, wide: true},
]

// SYNC[wep_cols].
export const WEP_COLS = [
  {sortObs: WEP_SORT, key: `wep_type`,  type: TYPE_ANY, colspan: 3},
  {sortObs: WEP_SORT, key: `range`,     type: TYPE_ANY, wide: true},
  {sortObs: WEP_SORT, key: `mag`,       type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `rof`,       type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `rel`,       type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `dmg`,       type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `targ`,      type: TYPE_NUM},
  {sortObs: WEP_SORT, key: `dmg_base`,  type: TYPE_NUM, wide: true},
  {sortObs: WEP_SORT, key: `perc_dmg`,  type: TYPE_PERC_MOD, wide: true},
  {sortObs: WEP_SORT, key: `perc_air`,  type: TYPE_PERC_MOD},
  {sortObs: WEP_SORT, key: `perc_shld`, type: TYPE_PERC_MOD},
  {sortObs: WEP_SORT, key: `aoe`,       type: TYPE_NUM, wide: true},
  {sortObs: WEP_SORT, key: `det`,       type: TYPE_BOOL, wide: true},
  {sortObs: WEP_SORT, key: `prio`,      type: TYPE_PRIO, wide: false},
  {sortObs: WEP_SORT, key: `prio`,      type: TYPE_PRIO, colspan: 2, wide: true},
]

validateColAlignment()

function RoundTableCombined(opt) {
  return E(`table`, {
    class: ui.CLS_TABLE,
    chi: [
      E(`thead`, {
        chi: a.map(BUI_COLS, col => E(TableHeadCell, {...col, sortObs: BUI_SORT})),
      }),
      E(RoundTableBody, opt),
    ],
  })
}

function RoundTableBody(opt) {
  const {sortableRows: sortable, otherRows} = roundTableRows(opt)

  const rowObs = a.obsRef(sortable)

  const sorter = a.recur(function sortRows() {
    a.each(SORTS, a.deref)
    const enabled = a.some(SORTS, isEnabled)
    const rows = enabled ? a.sort(sortable, compareRowsDeep) : sortable

    a.RUN_REF.set()

    afterSort(rows)

    /*
    Instead of concatenating, we could also have told the rendering framework
    that the tbody's children are `[rowObs, otherRows]`. But that seems to run
    up against a strange behavior in Chrome, possibly a bug, where re-inserting
    the newly sorted rows before the `otherRows` (via a single `.after` call
    executed internally by the rendering framework after building up a list of
    nodes) causes the browser to scroll up on any re-sort, for no apparent
    reason. Replacing all rows together (done internally via a single `.append`
    call) avoids that.
    */
    a.reset(rowObs, rows.concat(otherRows))
  })

  const body = E(`tbody`, {chi: rowObs})
  u.retain(body, sorter)
  return body
}

class TableRow extends dr.MixReg(HTMLTableRowElement) {
  parent = undefined
  ancs = undefined

  constructor({parent} = {}) {super().parent = a.optNode(parent)}
  hasSortData() {return false}
  afterSort() {}

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

function MixSortable(cls) {
  return class Sortable extends cls {
    sortObs = undefined
    sortInd = undefined
    data = undefined

    constructor(opt) {
      super(opt)
      this.sortObs = a.reqInst(opt.sortObs, ui.SortObs)
      this.sortInd = a.reqNat(opt.sortInd)
      this.data = a.reqDict(opt.data)
    }

    hasSortData() {return true}
    getSortVal(key) {return this.data[a.reqValidStr(key)]}
  }
}

class SubRowBase extends TableRow {
  pre = ui.Pale()

  constructor({showRow, ...opt}) {
    E(super(opt), {
      class: `tr-sub`,
      hidden: a.vac(showRow) && (() => !a.deref(showRow)),
    })
  }

  afterSort({rows, ind}) {
    this.pre.textContent = a.reqStr(rowPre(this, ind, rows))
  }
}

class SubRowTheadPseudo extends SubRowBase {
  sortObs = undefined
  sortInd = undefined

  constructor({cols, sortObs, sortInd, ...opt}) {
    super(opt)
    this.sortObs = a.reqInst(sortObs, ui.SortObs)
    this.sortInd = a.reqNat(sortInd)
    E(this, {
      chi: a.reqArr(cols).map((col, ind) => Th({col, ind, headPre: this.pre})),
    })
  }
}

export class SubRow extends MixSortable(SubRowBase) {
  constructor(opt) {
    super(opt)
    const {data, total, cols} = opt
    E(this, {
      chi: a.reqArr(cols).map((col, ind) => Td({
        data, col, ind, total, headPre: this.pre,
      })),
    })
  }
}

function Th({col, ind, headPre, headSuf}) {
  const isHead = ind === 0

  return E(TableHeadCell, {
    ...a.reqDict(col),
    pre: a.vac(isHead) && headPre,
    suf: a.vac(isHead) && headSuf,
  })
}

function TableHeadCell(opt) {
  const {key, sortObs, pre, suf} = opt

  return E(ui.ThWithSort, {
    ...ui.withCls(cellProps(opt), ui.CLS_CELL_HEAD),
    key, sortObs,
    chi: [
      pre,
      a.bind(ui.SortIndicator, key, sortObs),
      ui.withGlossary(ui.Span(key), {key, glos: STAT_GLOSSARY, under: true}),
      suf,
    ],
  })
}

export function Td({data, col, ind, total, headPre, headSuf}) {
  const {key} = col

  if (u.DEV) {
    a.reqDict(data)
    a.optDict(total)
    reqColVal(data, key)
  }

  const val = data[key]
  const perc = optColPerc(total, val, key)
  const isHead = ind === 0

  return E(TableCell, {
    ...col,
    ind,
    val,
    perc,
    pre: a.vac(isHead) && headPre,
    suf: a.vac(isHead) && headSuf,
  })
}

export function cellProps({props, colspan, wide}) {
  return {
    ...a.optDict(props),
    colspan,
    class: a.spaced(props?.cls, ui.clsWide(wide)),
  }
}

function TableCell(opt) {
  const {type, key, val, perc, pre, suf} = opt
  a.optStr(type)
  a.reqValidStr(key)
  a.optFin(perc)

  const cell = E(`td`, {
    ...ui.withCls(cellProps(opt), ui.CLS_CELL_COMMON),
    chi: [
      pre,
      (
        type === TYPE_NUM && a.isSome(perc)
        ? a.bind(CellInner, {type, val, perc})
        : fmtVal(type, val)
      ),
      suf,
    ],
  })

  if (type === TYPE_HELP) {
    return ui.withTooltip({elem: cell, chi: val})
  }
  if (type === TYPE_PRIO) {
    return ui.withTooltip({elem: cell, chi: u.intersperseOpt(val, `\n`)})
  }
  return cell
}

function CellInner({type, val, perc}) {
  if (type !== TYPE_NUM) return fmtVal(type, val)

  const mode = a.deref(NUM_MODE)
  if (mode === NUM_MODE_NUM) return fmtVal(type, val)

  if (mode === NUM_MODE_PERC) {
    return E(`span`, {class: CLS_PERC, chi: fmtNumPerc(perc)})
  }

  if (a.isNil(perc)) return fmtVal(type, val)

  return E(`span`, {
    class: `flex row-bet-cen gap-2`,
    chi: [
      E(`span`, {class: `trunc`, chi: fmtVal(type, val)}),
      E(`span`, {class: CLS_PERC, chi: fmtNumPerc(perc)}),
    ],
  })
}

class BuiRow extends MixSortable(TableRow) {
  buiInd = a.obsRef()
  showRow = a.calc(calcShowRow, this)
  expandChi = a.calc(SHOW_CHI, a.deref)
  showChi = a.calc(calcShowChi, this)

  constructor({buiInd, sortInd, data, total, chiDatas, hasAssoc}) {
    super({data, sortInd, sortObs: BUI_SORT})

    a.reset(this.buiInd, a.reqNat(buiInd))

    const headSuf = (
      a.len(chiDatas) === 1
      ? [`: `, ui.Muted(a.head(chiDatas)[a.reqValidStr(a.head(CHI_COLS).key)])]
      : a.len(chiDatas) > 1
      ? [`: `, ui.Muted(a.len(chiDatas))]
      : undefined
    )

    E(this, {
      class: a.spaced(
        ui.CLS_ROW_TOP,
        a.vac(hasAssoc) && a.spaced(`cursor-pointer`, ui.CLS_BUSY_BG),
      ),
      hidden: () => !a.deref(this.showRow),
      onclick: a.vac(hasAssoc) && this.onClick,
      chi: BUI_COLS.map((col, ind) => Td({data, col, ind, total, headSuf})),
    })
  }

  afterSort({buiInd}) {a.reset(this.buiInd, a.reqNat(buiInd))}

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
    const show = !a.deref(this.expandChi)
    a.reset(this.expandChi, show)

    if (!u.isEventModifiedPrimary(eve)) return

    a.reset(SHOW_CHI, show)

    // Rerun all observers even if the value didn't change.
    // This causes all manually opened bui rows to close when `!show`.
    SHOW_CHI.flush()
  }
}

function calcShowRow(row) {
  const long = a.laxBool(a.deref(LONG))
  const ind = a.reqNat(a.deref(row.buiInd))
  return long || (ind <= LONG_ROW_BREAKPOINT)
}

function calcShowChi(row) {
  const showRow = a.deref(row.showRow)
  const expandChi = a.deref(row.expandChi)
  return a.laxBool(showRow && expandChi)
}

export function LongToggleRows({count, cols, type}) {
  return [
    E(LongToggleRow, {
      count, type,
      cols: colsNarrow(cols),
      cls: ui.CLS_ONLY_NARROW,
    }),
    E(LongToggleRow, {
      count, type,
      cols: colsWide(cols),
      cls: ui.CLS_ONLY_WIDE,
    }),
  ]
}

export function LongToggleRow({count, limit, type, cols, cls}) {
  a.reqNat(count)
  a.optNat(limit)
  a.reqArr(cols)

  limit ??= LONG_ROW_BREAKPOINT
  if (!(count > limit)) return undefined

  return E(`tr`, {
    class: a.spaced(
      ui.CLS_ROW_TOP, `cursor-pointer`, ui.CLS_BUSY_BG, ui.CLS_TEXT_MUTED, cls,
    ),
    onclick: toggleLong,
    chi: E(`td`, {
      class: `text-center py-1`,
      colspan() {return sumColspans(cols).all},
      chi() {
        const show = a.optBool(a.deref(LONG))
        const diff = count - limit
        return [
          `click to `,
          (show ? `collapse` : `expand`),
          ` trailing `, diff, ` of `, count, ` `, type,
        ]
      },
    }),
  })
}

function toggleLong() {a.reset(LONG, !a.deref(LONG))}

function roundTableRows({round, roundBuis}) {
  a.reqDict(roundBuis)
  const buiEntries = a.entries(round.Buildings)
  const buiTotal = a.Emp()
  const buiDatas = a.Emp()
  const sortableRows = []
  const buiRows = []

  for (const [buiInst] of buiEntries) {
    const roundBui = a.reqDict(roundBuis[buiInst])
    buiDatas[buiInst] = buiStatData({roundBui, buiTotal})
  }

  for (const [buiInst, bui] of buiEntries) {
    const roundBui = a.reqDict(roundBuis[buiInst])
    const buiData = buiDatas[buiInst]
    addRoundTableRows({rows: sortableRows, buiRows, bui, buiData, roundBui, buiTotal})
  }

  const otherRows = LongToggleRows({
    count: buiRows.length, cols: BUI_COLS, type: `buildings`,
  })
  return {sortableRows, otherRows, buiRows}
}

function addRoundTableRows({rows, buiRows, bui, buiData, roundBui, buiTotal}) {
  a.reqArr(rows)
  a.reqArr(buiRows)

  const chiTotal = a.Emp()
  const chiDatas = []
  const wepDatas = []
  addChiWepData({chiDatas, wepDatas, chiTotal, bui, roundBui})

  // SYNC[bui_has_assoc].
  const hasAssoc = (chiDatas.length > 1) || (wepDatas.length > 0)

  const buiRow = new BuiRow({
    buiInd: buiRows.length, sortInd: rows.length,
    data: buiData, total: buiTotal, chiDatas, hasAssoc,
  })

  rows.push(buiRow)
  buiRows.push(buiRow)

  // SYNC[bui_has_assoc].
  if (chiDatas.length > 1) {
    const cols = CHI_COLS
    const sortObs = CHI_SORT

    addPseudoTableRows({
      rows, parent: buiRow, cols, datas: chiDatas,
      sortObs, showRow: buiRow.showChi, total: chiTotal,
    })
  }

  if (wepDatas.length) {
    const cols = WEP_COLS
    const sortObs = WEP_SORT

    addPseudoTableRows({
      rows, parent: buiRow, cols, datas: wepDatas,
      sortObs, showRow: buiRow.showChi,
    })
  }
}

function addChiWepData({chiDatas, wepDatas, chiTotal, bui, roundBui}) {
  a.reqArr(chiDatas)
  a.reqArr(wepDatas)
  a.reqDict(chiTotal)
  a.reqDict(bui)

  const {wepTypes, dumBulTypes} = a.reqDict(roundBui)

  for (const [ind, wep] of a.entries(bui.Weapons)) {
    const stats = bui.WeaponStats[ind]?.stats
    if (!shouldShowWep(wep, stats)) continue

    const type = wep.EntityID
    chiDatas.push(chiStatData({type, stats, total: chiTotal, enabled: wep.Enabled}))
    wepDatas.push(wepDetailData(wep))
  }

  for (const [type, val] of a.entries(bui.ChildLiveStats)) {
    if (wepTypes.has(type) || dumBulTypes.has(type)) continue
    const stats = val?.stats
    chiDatas.push(chiStatData({type, stats, total: chiTotal}))
  }
}

function addPseudoTableRows({
  rows, parent, cols, datas, total, sortObs, ...opt
}) {
  a.reqArr(rows)
  a.reqArr(datas)

  const head = new SubRowTheadPseudo({
    parent, cols, sortInd: rows.length, sortObs, ...opt
  })

  rows.push(head)

  for (const data of datas) {
    rows.push(new SubRow({
      parent: head, sortInd: rows.length, sortObs,
      data, total, cols, ...opt,
    }))
  }
}

function buiStatData({roundBui, buiTotal}) {
  a.reqDict(roundBui)
  a.reqDict(buiTotal)

  const bui_type_upg = a.reqValidStr(roundBui.bui_type_upg)
  const stats = a.optDict(roundBui.stats)

  // SYNC[bui_cols].
  const out = a.Emp()
  out.bui_type_upg = s.codedToNamed(`bui_type_upg`, bui_type_upg)

  for (const type of s.BUI_STAT_TYPES) {
    a.reqValidStr(type)
    const val = a.laxFin(stats?.[type])
    out[type] = val
    addTotal(buiTotal, type, val)
  }
  return out
}

// TODO: consider if this works properly for "sum" vs "avg" stats.
export function addTotal(tar, key, val) {
  a.reqDict(tar)
  a.reqValidStr(key)
  if (a.isFin(val)) tar[key] = a.laxFin(tar[key]) + val
}

// SYNC[chi_cols].
// SYNC[chi_stat_types].
export function chiStatData({type, stats, total, enabled}) {
  a.reqStr(type)
  a.optDict(stats)

  function add(key, val) {
    out[key] = val
    addTotal(total, key, val)
  }

  const out = a.Emp()
  out.chi_type = s.codedToNamed(`chi_type`, type)

  const dmg_done = stats?.DamageDone?.valueThisWave
  const dmg_done_acc = stats?.DamageDone?.valueThisGame
  const dmg_over = stats?.DamageOverkill?.valueThisWave
  const dmg_over_acc = stats?.DamageOverkill?.valueThisGame

  add(s.STAT_TYPE_DMG_DONE,     dmg_done)
  add(s.STAT_TYPE_DMG_DONE_ACC, dmg_done_acc)
  add(s.STAT_TYPE_DMG_OVER,     dmg_over)
  add(s.STAT_TYPE_DMG_OVER_ACC, dmg_over_acc)
  add(s.STAT_TYPE_DMG_EFF,      s.dmgEff(dmg_done, dmg_over))
  add(s.STAT_TYPE_DMG_EFF_ACC,  s.dmgEff(dmg_done_acc, dmg_over_acc))

  out.enab = enabled
  return out
}

/*
TODO: "reified" values should have a tooltip with the source values for the
calculation, maybe in the shape of a formula.

SYNC[wep_cols].
*/
export function wepDetailData(wep) {
  a.reqDict(wep)

  const out = a.Emp()
  const bul = wep.DummyBullet
  const aoe = bul.AreaOfEffect

  out.wep_type = wep.EntityID

  out.range = (
    wep.DistanceRangeMin
    ? wep.DistanceRangeMin + `-` + wep.DistanceRangeMax
    : wep.DistanceRangeMax
  )

  const mag = out.mag = wep.MagazineSize
  const rof = out.rof = reify(wep.RateOfFire)
  const rel = out.rel = reify(wep.ReloadTime)
  out.det = wep.IsDetection

  const antiAir = out.has_aa = a.optBool(bul.IsAntiAircraft)
  const antiShield = out.has_as = isWepAntiShield(wep)

  out.perc_dmg = a.laxFin(aoe.Damage.pctModifier) / 100

  const percAir = out.perc_air = (
    antiAir
    ? a.laxFin(bul.AntiAircraftModifier) / 100
    : a.laxFin(bul.AircraftModifier) / 100
  )

  const percShld = out.perc_shld = (
    antiShield
    ? a.laxFin(bul.AntiShieldModifier) / 100
    : a.laxFin(bul.ShieldModifier) / 100
  )

  out.dmg_base = a.laxFin(aoe.Damage.baseValue) + a.laxFin(aoe.Damage.rawModifier)
  const dmg = out.dmg = reify(aoe.Damage)
  const dmgAir = out.dmg_air = dmg * (1 + percAir)
  const dmgShld = out.dmg_shld = dmg * (1 + percShld)

  out.dps_est = dpsEstimate(dmg, mag, rof, rel)
  out.dps_air_est = dpsEstimate(dmgAir, mag, rof, rel)
  out.dps_shld_est = dpsEstimate(dmgShld, mag, rof, rel)

  out.aoe = reify(aoe.SizeValue)
  out.targ = aoe.MaxTarget
  out.prio = a.map(wep.TargetingPriorities, gc.targPrioCodeToName)
  out.enab = wep.Enabled
  return out
}

// TODO simplify, add explanatory comments.
function compareRowsDeep(one, two) {
  if (u.DEV) {
    reqRow(one)
    reqRow(two)
  }

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
export function compareRows(one, two) {
  if (one === two) return 0
  if (a.isNil(two.sortInd)) return -1
  if (a.isNil(one.sortInd)) return 1

  const fallback = a.reqFin(one.sortInd) - a.reqFin(two.sortInd)
  const obs = one.sortObs
  if (!obs || obs !== two.sortObs) return fallback

  const {key, desc} = a.deref(obs)
  if (!key) return fallback
  if (!one.hasSortData()) return fallback
  if (!two.hasSortData()) return fallback

  const oneVal = one.getSortVal(key)
  const twoVal = two.getSortVal(key)
  const miss = compareMissing(oneVal, twoVal)
  if (miss) return miss
  return u.compareNumerically(oneVal, twoVal, desc) || fallback
}

export function compareMissing(one, two) {
  if (a.deref(MISSING_LAST)) {
    if (!one && two) return 1
    if (one && !two) return -1
  }
  return undefined
}

function withGlossary(elem, key) {
  return ui.withGlossary(elem, {key, glos: STAT_GLOSSARY, under: true})
}

function BtnReplace(cmd, suf, eph) {
  return ui.BtnPrompt({cmd, suf, eph, full: true})
}

function BtnReplaceEph(cmd, eph) {return BtnReplace(cmd, undefined, eph)}

// SYNC[wep_cols].
export const STAT_GLOSSARY = u.dict({
  ...s.GLOSSARY,
  wep_type: `weapon type`,
  range: `weapon range (squares)`,
  mag: `magazine size`,
  rof: `rate of fire (shots per second)`,
  rel: `reload duration (seconds)`,
  dmg_base: `base damage before ±%`,
  dmg: `calculated damage`,
  dmg_air: `calculated anti-air damage`,
  dmg_shld: `calculated anti-shield damage`,
  has_aa: `has anti-air`,
  has_as: `has anti-shield`,
  perc_dmg: `damage ±%`,
  perc_air: `anti-air damage ±%`,
  perc_shld: `anti-shield damage ±%`,
  dps_est: `
estimated sustained DPS;
assumes one target and no overkill
`.trim(),
  dps_air_est: `
estimated sustained anti-air DPS;
assumes one target and no overkill
`.trim(),
  dps_shld_est: `
estimated sustained anti-shield DPS;
assumes one target and no overkill
`.trim(),
  aoe: `area of effect radius (squares)`,
  targ: `maximum targets in AoE`,
  prio: `targeting priorities`,
  det: `has detection or not`,
  enab: `enabled or not`,
  seed: `initial state of random number generator`,
  neutral_odds: `chance of neutral building on next zone`,
  supply_reinf: `±% supply in reinforcements`,
  recon_reinf: `±% recon in reinforcements`,
})

// All values in the game are supposed to be calculated like this.
export function reify(src) {
  if (!a.optRec(src)) return undefined
  const base = a.laxFin(src.baseValue)
  const flatMod = a.laxFin(src.rawModifier)
  const percMod = a.laxFin(src.pctModifier)
  return (base + flatMod) * (100 + percMod) / 100
}

export function dpsEstimate(dmg, mag, rof, rel) {
  a.reqFin(dmg)
  a.reqFin(mag)
  a.reqFin(rof)
  a.reqFin(rel)

  if (!dmg || !mag || !rof) return 0

  const cycleDmg = dmg * mag

  /*
  The game waits for the refire delay after each shot, thus effectively adding
  one refire delay to each reload. This simple division matches that behavior.
  */
  const magTime = mag / rof

  const cycleTime = magTime + rel
  return cycleDmg / cycleTime
}

let FMT_WARNED = false

export function fmtVal(type, val) {
  a.optValidStr(type)
  if (a.isNil(val)) return undefined

  if (type === TYPE_ANY) return val
  if (type === TYPE_HELP) return val
  if (type === TYPE_BOOL) return checktick(val)
  if (type === TYPE_NUM) return fmtNum(val)
  if (type === TYPE_NUM_MOD) return fmtNumMod(val)
  if (type === TYPE_PERC) return fmtNumPerc(val)
  if (type === TYPE_PERC_MOD) return fmtNumPercMod(val)
  if (type === TYPE_PRIO) return fmtTargPrios(val)

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

function fmtTargPrios(src) {
  return u.intersperseOpt(a.map(src, fmtTargPrio), ` `)
}

function fmtTargPrio(src) {
  if (a.isStr(src)) return a.words(src).mapMut(first).upper().solid()
  return src
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

export function shouldShowWep(wep, stats) {
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

function validateColAlignment() {
  const bui = sumColspans(BUI_COLS)
  const chi = sumColspans(CHI_COLS)
  const wep = sumColspans(WEP_COLS)

  if (
    (bui.wide !== chi.wide || bui.wide !== wep.wide) ||
    (bui.narrow !== chi.narrow || bui.narrow !== wep.narrow)
  ) {
    ui.logErr(`colspan mismatch: bui = ${a.show(bui)}, chi = ${a.show(chi)}, wep = ${a.show(wep)}`)
  }
}

function sumColspans(cols) {
  let all = 0
  let wide = 0
  let narrow = 0

  for (const col of cols) {
    const colspan = a.optNat(col.colspan) ?? 1
    if (a.deref(col.props?.hidden)) continue

    all += colspan
    if (isColWide(col)) wide += colspan
    if (isColNarrow(col)) narrow += colspan
  }
  return {all, wide, narrow}
}

function first(src) {return src[0]}
function getKey(src) {return src.key}
function isEnabled(val) {return val.isEnabled()}
function isColWide(val) {return a.optBool(val.wide) !== false}
function isColNarrow(val) {return a.optBool(val.wide) !== true}
export function colsWide(src) {return a.filter(src, isColWide)}
export function colsNarrow(src) {return a.filter(src, isColNarrow)}
export function colsDedup(src) {return u.uniqBy(src, getKey)}

export function reqColVal(src, key) {
  a.reqDict(src)
  a.reqValidStr(key)
  if (a.hasOwn(src, key)) return src[key]
  throw Error(`internal: missing column ${a.show(key)} in ${a.show(src)}`)
}

export function optColPerc(src, val, key) {
  a.reqValidStr(key)
  return a.optDict(src) && percOpt(val, src[key])
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
