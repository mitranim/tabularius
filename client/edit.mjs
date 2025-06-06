import * as a from '@mitranim/js/all.mjs'
import * as gc from '../shared/game_const.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'
import * as fs from './fs.mjs'
import * as ui from './ui.mjs'

export const SETTINGS_FILE_NAME = `Settings.gd`
export const UNLOCKABLES_FILE_NAME = `Unlockables.gd`
export const SETTINGS_HERO_SCORES_KEY = `HeroSavedDataList`
export const UNLOCKABLES_ENTITIES_KEY = `LockedEntities`
export const UNLOCKABLES_DIFF_KEY = `maxDifficultyUnlocked`
export const UNLOCKABLES_ENDLESS_KEY = `endlessMode`
export const PROGRESS_BUIS_KEY = `SeenBuildings`
export const PROGRESS_NEUTS_KEY = `SeenNeutralBuildings`
export const PROGRESS_DOCTS_KEY = `SeenSkills`
export const PROGRESS_WEPS_KEY = `SeenWeapons`

cmdEdit.cmd = `edit`
cmdEdit.desc = `edit game files, lock or unlock parts of meta progression`
cmdEdit.help = function cmdEditHelp() {
  return ui.LogParagraphs(
    cmdEdit.desc,
    `build your edit by clicking the buttons below!`,

    [
      BtnAppend(`-w`), ` -- write files; without this option, `,
      ui.Bold(`no files will be written`),
      `; by default, the command performs a safe "dry run", letting you preview the future changes; with `,
      BtnAppend(`-w`),
      `, the command will backup the files before writing; backups are placed in the `,
      os.BtnCmdWithHelp(`history`), ` directory`,
    ],

    [
      BtnAppend(`-l`),
      ` -- lock instead of unlocking; by default, the command unlocks every selected entity; this option inverts the behavior, allowing you to lock selected entities`,
    ],

    [
      BtnAppend(`-a`),
      ` -- select all entities; if specified, the command will attempt to unlock everything; if combined with `,
      BtnAppend(`-l`),
      `, will instead attempt to lock everything; implies `,
      BtnAppendEq(`diff`, gc.DIFF_MIN),
      ` when locking and `, BtnAppendEq(`diff`, gc.DIFF_MAX),
      ` when unlocking`,
    ],

    ui.LogLines(
      [
        BtnAppend(`diff=`),
        ` -- maximum achieved difficulty; known values: `,
        ...ui.LogWords(...a.map(gc.DIFFS, BtnAppendDiffShort)),
      ],
      [
        `  ↑ when combined with `,
        BtnAppendEq(`hero`),
        `, sets the maximum achieved difficulty badge for every selected commander`,
      ],
    ),

    ui.LogLines(
      [
        BtnAppend(`frontier=`),
        ` -- maximum achieved Frontier; known values: `,
        ...ui.LogWords(...a.map(gc.FRONTIERS, BtnAppendFrontierShort)),
      ],

      [`  ↑ automatically forces `, BtnAppendEq(`diff`, gc.DIFF_MAX)],

      [
        `  ↑ when combined with `,
        BtnAppendEq(`hero`),
        `, sets the maximum achieved Frontier level badge for every selected commander`,
      ],
    ),

    ui.LogLines(
      [
        BtnAppend(`hero=`), ` -- select which commanders to edit`,
      ],
      [`  `, BtnAppend(`hero=all`), ` -- select all commanders`],
      SpecificOptions({key: `hero`, coll: gc.CODES_TO_HEROS, type: `commanders`}),
    ),

    ui.LogLines(
      [
        BtnAppend(`bui=`), ` -- select which buildings to lock or unlock`,
      ],
      [`  `, BtnAppend(`bui=all`), ` -- select all buildings`],
      SpecificOptions({key: `bui`, coll: gc.CODES_TO_BUIS_SHORT, type: `buildings`}),
    ),

    ui.LogLines(
      [
        BtnAppend(`doct=`), ` -- select which doctrines to lock or unlock`,
      ],
      [`  `, BtnAppend(`doct=all`), ` -- select all doctrines`],
      SpecificOptions({key: `doct`, coll: gc.CODES_TO_ALL_DOCTS, type: `doctrines`}),
    ),

    `tip: advanced building variants are hidden behind doctrines; in regular play, they're unlocked by finding an expertise doctrine for the corresponding regular building; here, they can be unlocked as doctrines`,

    ui.LogLines(
      [
        `all of the following `, ui.Bold(`examples`),
        ` are `, ui.Bold(`safe to run`),
        ` because `, BtnAppend(`-w`),
        ` is not included; you will be able to view the pending changes without any files being written:`
      ],
      [`  `, BtnAppend(`-a`), `                      -- unlock everything`],
      [`  `, BtnAppend(`-a -l`), `                   -- lock everything`],
      [`  `, BtnAppend(`hero=all`), `                -- all commanders: unlock`],
      [`  `, BtnAppend(`hero=all -l`), `             -- all commanders: lock`],
      [`  `, BtnAppend(`bui=all`), `                 -- all buildings: unlock`],
      [`  `, BtnAppend(`bui=all -l`), `              -- all buildings: lock`],
      [`  `, BtnAppend(`doct=all`), `                -- all doctrines: unlock`],
      [`  `, BtnAppend(`doct=all -l`), `             -- all doctrines: lock`],
      [`  `, BtnAppend(`diff=5`), `                  -- all difficulties: unlock`],
      [`  `, BtnAppend(`diff=0`), `                  -- all difficulties: lock`],
      [`  `, BtnAppend(`hero=all diff=4`), `         -- give every commander a badge for winning difficulty 4`],
      [`  `, BtnAppend(`hero=all frontier=` + gc.FRONTIER_MAX), `    -- give every commander a badge for winning maximum Frontier difficulty`],
      [`  `, BtnAppend(`hero=all diff=0`), `         -- reset all commander badges`],
      [`  `, BtnAppend(`-a hero=all frontier=` + gc.FRONTIER_MAX), ` -- unlock everything and max out commander badges (maximize progression)`],
      [`  `, BtnAppend(`-a -l hero=all diff=0`), `   -- lock everything and reset commander badges (reset progression)`],
    ),

    [
      `the game `,
      ui.Bold(`must be closed`),
      ` before running this command, otherwise this will have no effect: the game will ignore and overwrite the files`,
    ],

    [
      ui.Bold(`reminder:`),
      ` without `,
      BtnAppend(`-w`),
      `, the command is `,
      ui.Bold(`safe to run`),
      ` because no files will be modified; you can safely preview changes`,
    ],

    /*
    Pending feature, not yet implemented.

      `-t: target file path; if provided, only this file be written; the path may be magic, such as "<history>/latest/latest"`,
      `-s: source file path; requires -t`,
      `if -t is not provided, the command automatically determines which files to read and write in the game's [saves] directory`,
      `regardless of which files are targeted, when -w is used, the command always makes backups in the [history] directory`,
    */
  )
}

export function cmdEdit({sig, args}) {
  const state = new EditState()
  state.args = args
  return edit(sig, state)
}

export async function edit(sig, state) {
  if (editDecodeCliArgs(state) === `help`) {
    return os.cmdHelpDetailed(cmdEdit)
  }

  reqNoErrs(state)

  if (!state.hasActions()) {
    ui.LOG.info(...ui.LogParagraphs(
      `no edit actions specified, nothing to be done`,
      os.cmdHelpDetailed(cmdEdit),
    ))
    return undefined
  }

  await editAll(sig, state)
  await editDiff(sig, state)
  await editHeros(sig, state)
  await editBuis(sig, state)
  await editDocts(sig, state)
  await editCommit(sig, state)
  return undefined
}

export function editDecodeCliArgs(state) {
  a.reqInst(state, EditState)
  const cmd = cmdEdit.cmd
  const args = a.reqValidStr(state.args)
  const {errs, msgs} = a.reqInst(state, EditState)

  for (const [key, val, pair] of u.cliDecode(u.stripPreSpaced(args, cmd))) {
    if (u.isHelpFlag(key)) return `help`

    if (key === `-w`) {
      try {state.write = ui.cliBool(cmd, key, val)}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-l`) {
      try {state.lock = ui.cliBool(cmd, key, val)}
      catch (err) {errs.push(err)}
      continue
    }

    if (key === `-a`) {
      try {state.all = ui.cliBool(cmd, key, val)}
      catch (err) {errs.push(err)}
      continue
    }

    /*
    Not currently useful. Meta progression editing usually involves editing
    multiple correlated files, and fails when targeting a specific file.

    This is mostly intended for a not-yet-implemented feature of specifying
    arbitrary keys and values, which is handy for cheating or editing something
    that our tool has no special support for.
    */
    if (key === `-t`) {
      if (val) {
        state.tarPath = val
        continue
      }
      errs.push([`option `, BtnAppend(`-t`), ` requires a file path`])
    }

    if (key === `-s`) {
      if (val) {
        state.srcPath = val
        continue
      }
      errs.push([`option `, BtnAppend(`-s`), ` requires a file path`])
    }

    if (key === `diff`) {
      try {state.diff = ui.cliNat(cmd, key, val)}
      catch (err) {errs.push(err)}
      if (state.diff) {
        const msg = msgEnumWarn(`diff`, state.diff, gc.DIFFS)
        if (msg) msgs.push(msg)
      }
      continue
    }

    if (key === `frontier`) {
      try {state.frontier = ui.cliNat(cmd, key, val)}
      catch (err) {errs.push(err)}
      if (state.frontier) {
        const msg = msgEnumWarn(`frontier`, state.frontier, gc.FRONTIERS)
        if (msg) msgs.push(msg)
      }
      continue
    }

    if (key === `hero`) {
      editAddToColl({
        state, stateKey: `heros`, val, pair,
        codeToName: gc.CODES_TO_HEROS_SHORT,
        nameToCode: gc.HEROS_TO_CODES_SHORT,
      })
      continue
    }

    if (key === `bui`) {
      editAddToColl({
        state, stateKey: `buis`, val, pair,
        codeToName: gc.CODES_TO_BUIS_SHORT,
        nameToCode: gc.BUIS_TO_CODES_SHORT,
      })
      continue
    }

    if (key === `doct`) {
      editAddToColl({
        state, stateKey: `docts`, val, pair,
        codeToName: gc.CODES_TO_ALL_DOCTS,
        nameToCode: gc.ALL_DOCTS_TO_CODES,
      })
      continue
    }

    errs.push([`unrecognized option `, BtnAppend(pair)])
  }

  const {tarPath, srcPath} = state
  if (srcPath && !tarPath) {
    errs.push([
      `when source path `, BtnAppendEq(`-s`, srcPath), ` is provided, `,
      `target path `, BtnAppendEq(`-t`), ` must also be provided; `,
      `to read and write the same file, simply specify `,
      `target path `, BtnAppendEq(`-t`, srcPath),
    ])
  }
  else if (!srcPath && tarPath) {
    state.srcPath = tarPath
  }

  if (state.all && a.isNil(state.diff) && a.isNil(state.frontier)) {
    state.diff = state.lock ? gc.DIFF_MIN : gc.DIFF_MAX
  }
  /*
  Non-nil Frontier implies difficulty of at least `DIFF_MAX`.
  Difficulty < `DIFF_MAX` implies Frontier 0.
  Difficulty = `DIFF_MAX` does _not_ imply any specific Frontier.
  This also means that if either is specified, then `diff` is
  always there, while `frontier` may be missing.
  */
  else if (a.isSome(state.frontier)) {
    if (a.isSome(state.diff) && state.diff !== gc.DIFF_MAX) {
      state.changes.push([
        Warn(), ` `,
        BtnAppendEq(`frontier`, state.frontier),
        ` overrides `,
        BtnAppendEq(`diff`, state.diff),
        ` and forces `,
        BtnAppendEq(`diff`, gc.DIFF_MAX),
      ])
    }
    state.diff = gc.DIFF_MAX
  }
  else if (a.isSome(state.diff) && state.diff < gc.DIFF_MAX) {
    state.frontier = 0
  }
  return undefined
}

function editAddToColl({state, stateKey, val, pair, codeToName, nameToCode}) {
  a.reqInst(state, EditState)
  a.reqValidStr(stateKey)
  a.reqStr(val)
  a.reqStr(pair)
  a.reqDict(codeToName)
  a.reqDict(nameToCode)

  const coll = state[stateKey] ??= new Set()
  if (val === `all`) return

  const code = nameToCode[val]
  if (code) {
    coll.add(code)
    return
  }

  if (!codeToName[val]) {
    state.msgs.push([Warn(), `: `, `unrecognized `, BtnAppend(pair)])
  }
  coll.add(val)
}

export async function editDiff(sig, state) {
  const {diff, frontier, msgs, changes, nonChanges} = a.reqInst(state, EditState)
  if (a.isNil(diff) && a.isNil(frontier)) return

  const eqs = u.cliEqs([`diff`, diff], [`frontier`, frontier])
  function Btn() {return ui.BtnPrompt({cmd: cmdEdit.cmd, suf: eqs})}
  const diffKey = UNLOCKABLES_DIFF_KEY
  const endlessKey = UNLOCKABLES_ENDLESS_KEY

  const {
    file, data, msgs: fileMsgs,
    entries: {[diffKey]: diffPrev, [endlessKey]: endlessPrev},
  } = await loadSaveFileAndValidate({
    sig, state, name: UNLOCKABLES_FILE_NAME, pre: Btn,
    entries: {[diffKey]: a.isNat, [endlessKey]: a.isBool},
  })

  if (fileMsgs.length) {
    msgs.push(...fileMsgs)
    return
  }

  const subChanges = []
  if (diffPrev !== diff) {
    subChanges.push(`changing difficulty from ${diffPrev} to ${diff}`)
  }

  const endless = diff >= gc.DIFF_MAX
  if (endlessPrev !== endless) {
    subChanges.push(
      endless
      ? `unlocking endless mode and Frontier`
      : `locking endless mode and Frontier`
    )
  }

  if (!subChanges.length) {
    nonChanges.push([
      preOpt(Btn), `skipping this edit in `, a.show(file.path), `: `,
      `maximum unlocked difficulty and access to endless / Frontier mode are unchanged`,
    ])
    return
  }

  data[diffKey] = diff
  data[endlessKey] = endless
  file.changed = true

  changes.push([
    preOpt(Btn), `editing `, a.show(file.path), `: `,
    ...subChanges.join(`; `),
  ])
}

export async function editAll(sig, state) {
  const {all, msgs, nonChanges} = a.reqInst(state, EditState)
  if (!all) return

  function Btn() {return BtnAppend(`-a`)}

  const {file: unlockablesFile, msgs: unlockablesMsgs, unlockables} =
    await loadUnlockables({sig, state, pre: Btn})

  if (unlockablesMsgs.length) {
    msgs.push(...unlockablesMsgs)
    return
  }

  const codes = a.keys(unlockables)
  if (!codes.length) {
    nonChanges.push([
      preOpt(Btn), Warn(),
      ` skipping: no unlockables in `,
      a.show(unlockablesFile.path),
    ])
    return
  }

  const {
    file: progressFile, msgs: progressMsgs,
    entries: {
      [PROGRESS_BUIS_KEY]: seenBuis,
      [PROGRESS_NEUTS_KEY]: seenNeuts,
      [PROGRESS_DOCTS_KEY]: seenDocts,
      [PROGRESS_WEPS_KEY]: seenWeps,
    },
  } = await loadSaveFileAndValidate({
    sig, state, name: fs.PROG_FILE_NAME, pre: Btn,
    entries: {
      [PROGRESS_BUIS_KEY]: a.isArr,
      [PROGRESS_NEUTS_KEY]: a.isArr,
      [PROGRESS_DOCTS_KEY]: a.isArr,
      [PROGRESS_WEPS_KEY]: a.isArr,
    },
  })

  if (progressMsgs.length) {
    msgs.push(...progressMsgs)
    return
  }

  for (const code of codes) {
    const key = codeToKey(code)
    const name = gc.codeToNameShort(code)
    const pre = key ? (() => BtnAppendEq(key, name)) : name
    editUnlockConds({state, code, file: unlockablesFile, unlockables, pre})
  }

  editSeenBuisAll({state, file: progressFile, unlockables, seenBuis, seenNeuts})
  editSeenDoctsAll({state, file: progressFile, unlockables, seenDocts})
  editSeenWepsAll({state, file: progressFile, unlockables, seenWeps})
}

export async function editHeros(sig, state) {
  const {lock, all, heros, msgs, nonChanges} = a.reqInst(state, EditState)
  if (!heros) return

  function Btn() {return BtnEdit(`hero`, heros)}

  const {file: unlockablesFile, msgs: unlockablesMsgs, unlockables} =
    await loadUnlockables({sig, state, pre: Btn})

  if (unlockablesMsgs.length) {
    msgs.push(...unlockablesMsgs)
    return
  }

  const {
    file: settingsFile, msgs: settingsMsgs,
    entries: {[SETTINGS_HERO_SCORES_KEY]: heroScores},
  } = await loadSaveFileAndValidate({
    sig, state, name: SETTINGS_FILE_NAME, pre: Btn,
    entries: {[SETTINGS_HERO_SCORES_KEY]: a.isDict},
  })

  if (settingsMsgs.length) {
    msgs.push(...settingsMsgs)
    return
  }

  let codes
  if (heros.size) {
    codes = a.values(heros)
  }
  else {
    codes = a.filter(a.keys(unlockables), isHeroCode)

    if (!codes.length) {
      nonChanges.push(msgNoCodes(`commander`, unlockablesFile.path, Btn))
      return
    }

    codes = u.uniqArr(a.concat(
      codes,
      a.keys(heroScores),
      a.keys(gc.CODES_TO_HEROS_SHORT),
    ))
  }

  // TODO: partition by locked / unlocked, and place the msg in `changes` and
  // `nonChanges` as appropriate. Do the same for buis and doctrines.
  msgs.push([
    preOpt(Btn), msgAction(lock, !heros.size), ` commanders: `,
    ...ui.LogWords(...a.map(codes, BtnAppendHeroShort)),
  ])

  for (const code of codes) {
    editHeroDiff({state, code, file: settingsFile, scores: heroScores})
    if (!all) editHeroConds({state, code, file: unlockablesFile, unlockables})
  }
}

function editHeroDiff({state, code, file, scores}) {
  a.reqValidStr(code)
  a.reqInst(file, EditFile)
  a.reqDict(scores)

  const {diff, frontier, msgs, changes, nonChanges} = a.reqInst(state, EditState)
  a.optNat(diff)
  a.optNat(frontier)
  if (a.isNil(diff) && a.isNil(frontier)) return

  const name = gc.CODES_TO_HEROS_SHORT[code] || code
  const eqs = u.cliEqs([`hero`, name], [`diff`, diff], [`frontier`, frontier])
  function Btn() {return ui.BtnPrompt({cmd: cmdEdit.cmd, suf: eqs})}

  /*
  The game initializes the scores collection to an empty dict, but does not
  initially create entries for all commanders. When editing, we need to create
  one ourselves.
  */
  const score = scores[code] ?? {
    IsNew: true,
    MaxLevelAchieved: 0,
    MaxExpertScore: 0,
  }

  if (!a.isDict(score)) {
    msgs.push([
      preOpt(Btn), Warn(),
      ` skipping: unexpected format of "${SETTINGS_HERO_SCORES_KEY}.${code}" in `,
      a.show(file.path),
    ])
    return
  }

  const diffPrev = a.onlyFin(score.MaxLevelAchieved)

  if (a.isNil(frontier)) {
    if (diffPrev === diff) {
      nonChanges.push([preOpt(Btn), `maximum achieved difficulty already `, diff])
      return
    }

    score.IsNew = false
    score.MaxLevelAchieved = diff
    scores[code] = score
    file.changed = true
    changes.push([preOpt(Btn), `setting maximum achieved difficulty to `, diff])
    return
  }

  const frontierPrev = a.onlyFin(score.MaxExpertScore)

  if (diffPrev === diff && frontierPrev === frontier) {
    nonChanges.push([
      preOpt(Btn), `maximum achieved difficulty already `, diff,
      ` and maximum achieved Frontier difficulty already `, frontier,
    ])
    return
  }

  score.IsNew = false
  score.MaxLevelAchieved = diff
  score.MaxExpertScore = frontier
  scores[code] = score
  file.changed = true

  changes.push([
    preOpt(Btn), `setting maximum achieved difficulty to `, diff,
    ` and maximum achieved Frontier difficulty to `, frontier,
  ])
}

function editHeroConds({state, code, file, unlockables}) {
  function Btn() {return BtnAppendHero(code)}
  return editUnlockConds({state, code, file, unlockables, pre: Btn})
}

export async function editBuis(sig, state) {
  const {lock, all, buis, msgs, nonChanges} = a.reqInst(state, EditState)
  if (all || !buis) return
  function Btn() {return BtnEdit(`bui`, buis)}

  const {file: settingsFile, msgs: settingsMsgs, unlockables} =
    await loadUnlockables({sig, state, pre: Btn})

  if (settingsMsgs.length) {
    msgs.push(...settingsMsgs)
    return
  }

  const {
    file: progressFile, msgs: progressMsgs,
    entries: {
      [PROGRESS_BUIS_KEY]: seenBuis,
      [PROGRESS_NEUTS_KEY]: seenNeuts,
    },
  } = await loadSaveFileAndValidate({
    sig, state, name: fs.PROG_FILE_NAME, pre: Btn,
    entries: {
      [PROGRESS_BUIS_KEY]: a.isArr,
      [PROGRESS_NEUTS_KEY]: a.isArr,
    },
  })

  if (progressMsgs.length) {
    msgs.push(...progressMsgs)
    return
  }

  let buiCodes
  let advUpgCodes

  if (buis.size) {
    buiCodes = a.values(buis)
  }
  else {
    const keys = a.keys(unlockables)
    buiCodes = a.filter(keys, isBuiCode)

    if (!buiCodes.length) {
      nonChanges.push(msgNoCodes(`building`, settingsFile.path, Btn))
      return
    }

    advUpgCodes = new Set(a.filter(keys, isAdvUpgCode))
  }

  msgs.push([
    preOpt(Btn), msgAction(lock, !buis.size), ` buildings: `,
    ...ui.LogWords(...a.map(buiCodes, BtnAppendBuiShort)),
  ])

  for (const code of buiCodes) {
    editBui({
      state, code, settingsFile, progressFile,
      unlockables, advUpgCodes, seenBuis, seenNeuts,
    })
  }

  if (advUpgCodes) {
    for (const code of advUpgCodes) {
      const pre = gc.buiAdvUpgName(gc.advUpgCodeToBuiCode(code))
      editUnlockConds({state, code, file: settingsFile, unlockables, pre})
    }
  }

  if (!buis.size) {
    editSeenBuisAll({state, file: progressFile, unlockables, seenBuis, seenNeuts, codes: buiCodes})
  }
}

export function editSeenBuisAll({state, file, unlockables, seenBuis, seenNeuts, codes}) {
  const [neutCodes, buiCodes] = a.partition(a.keys(gc.CODES_TO_BUIS_SHORT), isNeutBuiCode)

  editSeenAll({
    state, file, unlockables, seen: seenBuis,
    type: `buildings`,
    codes: exclude(buiCodes, codes),
    showShort: BtnAppendBuiShort, showLong: BtnAppendBui,
  })

  editSeenAll({
    state, file, unlockables, seen: seenNeuts,
    type: `neutral buildings`,
    codes: exclude(neutCodes, codes),
    showShort: BtnAppendBuiShort, showLong: BtnAppendBui,
  })
}

export function editBui({
  state, code, settingsFile, progressFile,
  unlockables, advUpgCodes, seenBuis, seenNeuts,
}) {
  editBuiConds({state, code, file: settingsFile, unlockables})
  editBuiAdvUpg({state, code, file: settingsFile, unlockables, advUpgCodes})
  editSeenBui({state, code, file: progressFile, seenBuis, seenNeuts})
}

export function editSeenBui({state, code, file, seenBuis, seenNeuts}) {
  a.reqArr(seenBuis)
  a.reqArr(seenNeuts)
  const seen = isNeutBuiCode(code) ? seenNeuts : seenBuis
  function Btn() {return BtnAppendBui(code)}
  editSeen({state, code, file, seen, pre: Btn})
}

export function editBuiAdvUpg({state, code: buiCode, file, unlockables, advUpgCodes}) {
  a.optSet(advUpgCodes)

  const advUpgCode = gc.buiCodeToAdvUpgCode(buiCode)
  if (!a.isDict(unlockables[advUpgCode])) return

  const pre = gc.buiAdvUpgName(buiCode)
  editUnlockConds({state, code: advUpgCode, file, unlockables, pre})
  advUpgCodes?.delete(advUpgCode)
}

export function editBuiConds({state, code, file, unlockables}) {
  function Btn() {return BtnAppendBui(code)}
  return editUnlockConds({state, code, file, unlockables, pre: Btn})
}

export async function editDocts(sig, state) {
  const {lock, all, docts, msgs, nonChanges} = a.reqInst(state, EditState)
  if (all || !docts) return

  function Btn() {return BtnEdit(`doct`, docts)}

  const {file: unlockablesFile, msgs: unlockablesMsgs, unlockables} =
    await loadUnlockables({sig, state, pre: Btn})

  if (unlockablesMsgs.length) {
    msgs.push(...unlockablesMsgs)
    return
  }

  const {
    file: progressFile, msgs: progressMsgs,
    entries: {[PROGRESS_DOCTS_KEY]: seenDocts},
  } = await loadSaveFileAndValidate({
    sig, state, name: fs.PROG_FILE_NAME, pre: Btn,
    entries: {[PROGRESS_DOCTS_KEY]: a.isArr},
  })

  if (progressMsgs.length) {
    msgs.push(...progressMsgs)
    return
  }

  let codes
  if (docts.size) {
    codes = a.values(docts)
  }
  else {
    const keys = a.keys(unlockables)
    codes = a.filter(keys, isDoctCode)
    if (!codes.length) {
      nonChanges.push(msgNoCodes(`doctrine`, unlockablesFile.path, Btn))
      return
    }
  }

  msgs.push([
    preOpt(Btn), msgAction(lock, !docts.size), ` doctrines: `,
    ...ui.LogWords(...a.map(codes, BtnAppendDoctShort)),
  ])

  const updatedCodes = new Set(codes)

  for (const code of codes) {
    editDoct({state, code, unlockablesFile, progressFile, unlockables, seenDocts})
    if (!isDoctMasteryCode(code)) continue

    const relCodes = gc.masteryCodeToRelatedCodes(code)
    if (!relCodes) continue

    for (const relCode of relCodes) {
      updatedCodes.add(relCode)
      editSeenDoct({state, code: relCode, file: progressFile, seenDocts})
    }
  }

  if (!docts.size) {
    editSeenDoctsAll({state, file: progressFile, unlockables, seenDocts, codes: updatedCodes})
  }
}

export function editDoct({state, code, unlockablesFile, progressFile, unlockables, seenDocts}) {
  function Btn() {return BtnAppendDoct(code)}
  editUnlockConds({state, code, file: unlockablesFile, unlockables, pre: Btn})
  editSeenDoct({state, code, file: progressFile, seenDocts})
}

export function editSeenDoct({state, code, file, seenDocts}) {
  function Btn() {return BtnAppendDoct(code)}
  editSeen({state, code, file, seen: seenDocts, pre: Btn})
}

export function editSeenDoctsAll({state, file, unlockables, seenDocts, codes}) {
  return editSeenAll({
    state, file, unlockables, seen: seenDocts,
    type: `doctrines`,
    codes: exclude(a.keys(gc.CODES_TO_ALL_DOCTS), codes),
    showShort: BtnAppendDoctShort, showLong: BtnAppendDoct,
  })
}

export function editSeenWepsAll({state, file, unlockables, seenWeps}) {
  return editSeenAll({
    state, file, unlockables, seen: seenWeps,
    type: `weapons`, codes: a.keys(gc.WEPS),
    showShort: a.id, showLong: a.id,
  })
}

export function editSeenAll({
  state, file, unlockables, seen, type, codes, showShort, showLong,
}) {
  a.reqInst(file, EditFile)
  a.reqArr(seen)
  a.reqDict(unlockables)
  a.reqArr(seen)
  a.reqValidStr(type)
  u.reqArrOfValidStr(codes)
  a.reqFun(showShort)
  a.reqFun(showLong)

  const {lock, changes} = a.reqInst(state, EditState)

  if (lock) {
    if (!seen.length) return
    changes.push([
      `marking all previously-seen ${type} as not seen: `,
      ...ui.LogWords(...a.map(seen, showShort)),
    ])
    seen.length = 0
    file.changed = true
    return
  }

  for (const code of codes) {
    if (a.hasOwn(unlockables, code)) continue
    const pre = a.bind(showLong, code)
    editSeen({state, code, file, seen, pre})
  }
}

function editSeen({state, code, file, seen, pre}) {
  a.reqValidStr(code)
  a.reqInst(file, EditFile)
  a.reqArr(seen)

  const {lock, changes, nonChanges} = a.reqInst(state, EditState)

  if (lock) {
    const changed = arrRemoved(seen, code)
    if (changed) file.changed = true

    if (!changed) {
      nonChanges.push([preOpt(pre), `already not seen`])
      return
    }
    changes.push([preOpt(pre), `marking as not seen`])
    return
  }

  const changed = arrAdded(seen, code)
  if (changed) file.changed = true

  if (!changed) {
    nonChanges.push([preOpt(pre), `already seen`])
    return
  }
  changes.push([preOpt(pre), `marking as seen`])
}

export async function editCommit(sig, state) {
  reqNoErrs(state)

  const {args, write, msgs, changes, nonChanges} = a.reqInst(state, EditState)
  const changedFiles = a.filter(state.editFiles, isChanged)

  if (msgs.length || changes.length || nonChanges.length) {
    msgs.unshift([
      (
        (changes.length || nonChanges.length)
        ? [ui.Bold(`planned actions`), ` in `]
        : `notes in `
      ),
      ui.BtnPromptReplace({val: args}), `:`,
    ])
  }

  if (changes.length) {
    msgs.push(ui.DetailsPre({summary: `changes`, chi: changes, chiLvl: 1}))
  }

  if (nonChanges.length) {
    msgs.push(ui.DetailsPre({summary: `non-changes`, chi: nonChanges, chiLvl: 1}))
  }

  if (!changedFiles.length) {
    if (write) {
      msgs.push([
        BtnAppend(`-w`),
        ` specified, but no data has been modified, no writes needed`,
      ])
    }
    else {
      msgs.push([`no `, BtnAppend(`-w`), ` specified and no data has been modified`])
    }
  }
  else {
    msgs.push(ui.LogLines(
      `the following files need to be modified:`,
      ...a.map(changedFiles, val => [`  `, val.path]),
    ))

    if (write) {
      msgs.push([
        BtnAppend(`-w`),
        ` specified; attempting to backup and write files`,
      ])
    }
    else {
      msgs.push(ui.LogParagraphs(
        [
          `showing a `, ui.Bold(`preview`), ` of the planned changes, `,
          ui.Bold(`without writing any files`),
          `; add `, BtnAppend(`-w`), ` to commit the changes:`,
        ],
        [`  `, ui.BtnPromptReplace({val: a.spaced(args, `-w`)})],
      ))
    }
  }

  ui.LOG.info(...ui.LogParagraphs(...msgs))
  if (!write) return

  const histDir = await loadHistDir(sig, state)

  for (const file of changedFiles) {
    const path = await fs.backupFile({
      sig, file: file.handle, dir: histDir, uniq: true,
    })
    ui.LOG.info(fs.msgBackedUp(file.path, path))
  }

  for (const file of changedFiles) {
    await fs.writeEncodeGameFile(sig, file.handle, file.data)
    ui.LOG.info([`modified `, a.show(file.path)])
  }

  ui.LOG.info(`edit done! 🎉`)
}

export function editUnlockConds({state, code, unlockables, file, pre}) {
  a.reqValidStr(code)
  a.reqInst(file, EditFile)
  a.reqDict(unlockables)

  const {lock, msgs, nonChanges} = a.reqInst(state, EditState)
  const edit = lock ? `locking` : `unlocking`

  if (!a.hasOwn(unlockables, code)) {
    nonChanges.push([
      preOpt(pre),
      `skipping ${edit}: unable to locate in the unlockables in `,
      a.show(file.path),
    ])
    return
  }

  const unlockable = unlockables[code]
  const conds = unlockable?.UnlockableConditionsSD

  if (!a.isDict(unlockable) || !a.isDict(conds)) {
    msgs.push([
      preOpt(pre), Warn(),
      ` skipping ${edit}: unrecognized format of the unlockable in `,
      a.show(file.path),
    ])
    return
  }

  let found
  for (const cond of a.values(conds)) {
    if (!a.isDict(cond)) continue
    found = true
    editUnlockCond({state, code, unlockable, cond, file, pre})
  }

  if (!found) {
    msgs.push([
      preOpt(pre), Warn(),
      ` unable to find valid unlockable condition in `,
      a.show(file.path),
    ])
  }
}

export function editUnlockCond({state, code, unlockable, cond, file, pre}) {
  a.reqValidStr(code)
  a.reqInst(file, EditFile)
  a.reqDict(unlockable)
  a.reqDict(cond)

  const {lock, msgs, changes, nonChanges} = a.reqInst(state, EditState)
  const {AlreadyDisplayed: dispPrev} = unlockable
  const {TargetValue: targ} = cond

  const msg = msgProgTarg(targ, pre)
  if (msg) {
    msgs.push(msg)
    return
  }

  const prog = a.onlyFin(cond.Progression) ?? 0

  if (lock) {
    if (!prog) {
      nonChanges.push([preOpt(pre), `already locked, progression at 0`])
      return
    }

    unlockable.AlreadyDisplayed = false
    cond.Progression = 0
    file.changed = true

    if (prog < targ) {
      changes.push([preOpt(pre), `already locked; resetting progression to 0`])
      return
    }

    changes.push([preOpt(pre), `locking by resetting progression to 0`])
    return
  }

  if (prog >= targ) {
    if (!(prog >= (targ * 2))) {
      if (!dispPrev) {
        changes.push([
          preOpt(pre),
          `already unlocked, but not previously seen; marking as seen`,
        ])
        unlockable.AlreadyDisplayed = true
        file.changed = true
        return
      }

      nonChanges.push([preOpt(pre), `already unlocked`])
      return
    }

    changes.push([
      preOpt(pre),
      `seems already unlocked; resetting progression to `,
      targ,
      ` to ensure the game properly recognizes the unlock`,
    ])
  }
  else {
    changes.push([preOpt(pre), `unlocking by setting progression to `, targ])
  }

  unlockable.AlreadyDisplayed = true
  cond.Progression = targ
  file.changed = true
}

export function isHeroCode(val) {
  a.reqStr(val)
  return /^F\dH/.test(val)
}

export function isBuiCode(val) {
  a.reqStr(val)
  return (
    isNeutBuiCode(val) ||
    (!isAdvUpgCode(val) && (val.startsWith(`CB`) || val.startsWith(`SB`)))
  )
}

export function isNeutBuiCode(val) {
  a.reqStr(val)
  return val.startsWith(`NB`)
}

export function isAdvUpgCode(val) {return a.reqStr(val).endsWith(`AdvUpg`)}

export function isDoctCode(val) {
  a.reqStr(val)
  return val.startsWith(`D`) || val.startsWith(`TB`)
}

// SYNC[bui_doct].
export function isDoctMasteryCode(val) {
  a.reqStr(val)
  return val.startsWith(`TB`) && val.endsWith(`7`)
}

export class EditState extends a.Emp {
  /* Inputs. */
  args = a.optStr()
  write = undefined
  lock = a.optBool()
  all = a.optBool()
  diff = a.optNat()
  frontier = a.optNat()
  heros = a.optInst(undefined, Set)
  buis = a.optInst(undefined, Set)
  docts = a.optInst(undefined, Set)

  /* Outputs. */
  errs = []
  msgs = []
  changes = []
  nonChanges = []
  resolvedPaths = a.Emp()
  editFiles = a.Emp() // Record<resolved_path: string, EditFile>
  saveDir = a.optInst(undefined, FileSystemDirectoryHandle)
  histDir = a.optInst(undefined, FileSystemDirectoryHandle)

  hasActions() {
    return (
      a.isSome(this.diff) ||
      a.isSome(this.frontier) ||
      a.isSome(this.all) ||
      a.isSome(this.heros) ||
      a.isSome(this.buis) ||
      a.isSome(this.docts)
    )
  }
}

export class EditFile extends a.Emp {
  constructor({handle, path}) {
    super()
    this.handle = a.reqInst(handle, FileSystemFileHandle)
    this.path = a.reqValidStr(path)
    this.data = undefined
    this.changed = false
  }
}

export async function loadUnlockables({sig, state, pre}) {
  const {
    file, msgs,
    entries: {[UNLOCKABLES_ENTITIES_KEY]: unlockables},
  } = await loadSaveFileAndValidate({
    sig, state, name: UNLOCKABLES_FILE_NAME, pre,
    entries: {[UNLOCKABLES_ENTITIES_KEY]: a.isDict},
  })
  return {file, msgs, unlockables}
}

export async function loadSaveFileAndValidate({sig, state, name, pre, entries}) {
  a.optDict(entries)

  const {file, custom} = await loadSrcOrSaveFile(sig, state, name)
  const data = await loadData(sig, file)
  const out = u.dict({file, custom, data, msgs: [], entries: a.Emp()})

  if (!a.isDict(data)) {
    out.msgs.push(ui.ErrSpan(
      preOpt(pre),
      `unexpected top-level data format in `, a.show(file.path),
    ))
    return out
  }

  for (const [key, fun] of a.entries(entries)) {
    a.reqFun(fun)

    if (!a.hasOwn(data, key)) {
      out.msgs.push(ui.ErrSpan(
        preOpt(pre),
        `missing top-level entry `, a.show(key),
        ` in `, a.show(file.path),
      ))
      continue
    }

    const val = data[key]

    if (!fun(val)) {
      out.msgs.push(ui.ErrSpan(
        preOpt(pre),
        `unrecognized top-level entry `, a.show(key),
        ` in `, a.show(file.path), `; expected a value that passes the test `,
        a.show(fun), `, got `, a.show(val),
      ))
      continue
    }

    out.entries[key] = val
  }
  return out
}

/*
TODO: detect if the file consists entirely of null bytes and print a more
specific error message. Happens sometimes.
*/
export async function loadData(sig, file) {
  a.reqInst(file, EditFile)
  if (a.isSome(file.data)) return file.data

  try {
    return file.data = await fs.readDecodeGameFile(sig, file.handle)
  }
  catch (err) {
    ui.LOG.info(ui.LogParagraphs(
      [`the content of `, a.show(file.path), ` could not be decoded`],
      `one of the possible reasons: save file corruption, which may occur when the OS is unexpectedly shut down while the game is running, for example due to power cuts`,
      [
        ui.Bold(`recommendation:`),
        ` run the game and let it update the files by saving your progress, by reaching round 2 in any run; then close the game and rerun your edit`,
      ],
    ))
    throw err
  }
}

export async function loadSaveDir(sig, state) {
  a.reqInst(state, EditState)
  return state.saveDir ??= await fs.saveDirReq(sig)
}

export async function loadHistDir(sig, state) {
  a.reqInst(state, EditState)
  return state.histDir ??= await fs.historyDirReq(sig)
}

export async function loadSaveFile(sig, state, name) {
  a.reqValidStr(name)
  const dir = await loadSaveDir(sig, state)
  const path = u.paths.join(dir.name, name)
  return state.editFiles[path] ??= new EditFile({
    handle: (await fs.getFileHandle(sig, dir, name)),
    path,
  })
}

export async function loadSrcOrSaveFile(sig, state, name) {
  a.reqValidStr(name)
  const {srcPath} = state
  if (srcPath) return {file: (await loadPath(sig, state, srcPath)), custom: true}
  return {file: (await loadSaveFile(sig, state, name)), custom: false}
}

export async function loadPath(sig, state, path) {
  a.reqInst(state, EditState)
  a.reqValidStr(path)

  const {editFiles, resolvedPaths} = state
  if (editFiles[path]) return editFiles[path]

  let resolved = resolvedPaths[path]
  if (resolved && editFiles[resolved]) return editFiles[resolved]

  const out = await fs.handleAtPathFromTop({sig, path, magic: true})
  const {handle} = out
  resolved = out.path
  return editFiles[resolved] ??= new EditFile({handle, path: resolved})
}

function BtnAppendHero(val) {return BtnAppendCoded({key: `hero`, val})}

function BtnAppendHeroShort(val) {
  return BtnAppendCoded({key: `hero`, val, short: true})
}

function BtnAppendBui(val) {return BtnAppendCoded({key: `bui`, val})}

function BtnAppendBuiShort(val) {
  return BtnAppendCoded({key: `bui`, val, short: true})
}

function BtnAppendDoct(val) {
  return BtnAppendCoded({key: `doct`, val})
}

function BtnAppendDoctShort(val) {
  return BtnAppendCoded({key: `doct`, val, short: true})
}

function BtnAppendDiffShort(val) {return BtnAppendShort(`diff`, val)}

function BtnAppendFrontierShort(val) {return BtnAppendShort(`frontier`, val)}

function BtnAppendShort(key, val) {
  return ui.BtnPrompt({cmd: cmdEdit.cmd, suf: u.cliEq(key, val), chi: val})
}

function BtnAppendCoded({key, val, short, ...opt}) {
  a.reqValidStr(key)
  a.reqStr(val)
  val = gc.codeToNameShort(val) || val
  const cmd = cmdEdit.cmd
  const chi = a.optBool(short) ? val : undefined
  return ui.BtnPrompt({cmd, suf: u.cliEq(key, val), chi, ...opt})
}

function BtnAppendEq(key, val) {
  return ui.BtnPrompt({cmd: cmdEdit.cmd, suf: u.cliEq(key, val)})
}

function BtnAppend(suf, eph) {
  return ui.BtnPrompt({cmd: cmdEdit.cmd, suf, eph})
}

function BtnEdit(key, set) {
  a.reqValidStr(key)
  a.optSet(set)
  const cmd = cmdEdit.cmd
  if (!set.size) return ui.BtnPrompt({cmd, suf: u.cliEq(key, `all`)})
  return ui.BtnPrompt({cmd, suf: u.cliEq(key), eph: `...`})
}

function Warn() {return ui.Bold(`warning:`)}

function SpecificOptions({key, coll, type}) {
  a.reqValidStr(key)
  a.reqValidStr(type)

  const pre = `    `
  const width = `w-[calc(100%-${pre.length}ch)]`

  function Btn(val) {
    return [pre, BtnAppendCoded({key, val, trunc: true, width})]
  }

  return ui.Details({
    lvl: 1,
    summary: ui.Muted(`specific ${type}: click to expand`),
    chi: ui.LogLines(...a.map(a.keys(coll), Btn)),
  })
}

function reqNoErrs(state) {
  const {errs, args} = a.reqInst(state, EditState)
  if (!errs.length) return
  throw new ui.ErrLog(...ui.LogParagraphs(
    [`errors in `, ui.BtnPromptReplace({val: args}), `:`],
    ...errs,
  ))
}

// Similar to `ui.cliEnum`, but a warning, not a requirement.
function msgEnumWarn(key, val, coll) {
  if (coll.has(val)) return undefined

  const cmd = cmdEdit.cmd
  const vals = ui.LogWords(...a.map(a.keys(coll), val => ui.BtnPrompt({
    cmd, suf: u.cliEq(key, val), chi: val,
  })))

  return [
    Warn(), ` known values of `, ui.BtnPrompt({cmd, suf: u.cliEq(key)}),
    ` are: `, vals, `; the unrecognized value `,
    ui.BtnPrompt({cmd, suf: u.cliEq(key, val), chi: val}),
    ` may have unintended consequences`,
  ]
}

function msgProgTarg(val, pre) {
  if (a.isFin(val)) return undefined
  return [
    preOpt(pre), Warn(),
    ` skipping: expected the target progression value to be a number, found `,
    a.show(val),
  ]
}

function msgAction(lock, all) {
  return (
    (lock ? `locking` : `unlocking`) +
    (all ? ` all` : ``)
  )
}

function msgNoCodes(type, path, pre) {
  return [
    preOpt(pre), Warn(),
    ` skipping: unable to find any `, a.reqValidStr(type), ` codes in `,
    a.show(a.reqValidStr(path)),
  ]
}

function preOpt(val) {
  if (a.isFun(val)) val = val()
  if (a.isNil(val)) return undefined
  return [val, `: `]
}

function codeToKey(val) {
  a.reqStr(val)
  if (isHeroCode(val)) return `hero`
  if (isBuiCode(val)) return `bui`
  if (isDoctCode(val)) return `doct`
  return undefined
}

function arrRemoved(tar, val) {
  a.reqArr(tar)

  let ind = tar.length
  let out = false

  while (--ind >= 0) {
    if (!a.is(tar[ind], val)) continue
    tar.splice(ind, 1)
    out = true
  }
  return out
}

function arrAdded(tar, val) {
  a.reqArr(tar)
  return !tar.includes(val) && (tar.push(val), true)
}

function exclude(one, two) {
  one = a.setFrom(one)
  two = a.setFrom(two)
  const out = []
  for (const val of one) if (!two.has(val)) out.push(val)
  return out
}

function isChanged(val) {return val?.changed}
