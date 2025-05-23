import * as a from '@mitranim/js/all.mjs'

export const CODES_TO_HEROS_SHORT = dict({
  F1H01: `Anysia`,
  F1H02: `Silnio`,
  F1H03: `Tander`,
  F1H04: `Astor`,
  F1H05: `Gurtag`,
  F1H06: `Magel`,
  F1H07: `Agraft`,
  F1H08: `Gerhard`,
  F1H09: `Trevia`,
  F1H10: `Laethissa`,
  F2H01: `Denshikova`,
  F2H02: `Estelia`,
  F2H03: `Hertas`,
  F2H04: `Vladask`,
  F2H05: `Lyubov`,
  F2H06: `Beryt`,
  F2H07: `Liza`,
  F2H08: `Yevdoki`,
  F2H09: `Girosky`,
  F2H10: `Karia`,
  F3H01: `Droh`,
  F3H02: `Seculdi`,
  F3H03: `Obivim`,
  F3H04: `Delcia`,
  F3H05: `Delven`,
  F3H06: `Milio`,
  F3H07: `Jorg`,
  F3H08: `Eleonor`,
  F3H09: `Kosagi`,
  F3H10: `Scarlett`,
})

export const HEROS_TO_CODES_SHORT = invert(CODES_TO_HEROS_SHORT)

export const CODES_TO_HEROS = dict({
  F1H01: `Commissar Anysia`,
  F1H02: `Master of Ordnance Silnio`,
  F1H03: `Marshal Tander`,
  F1H04: `Colonel Astor`,
  F1H05: `Sergent Gurtag`,
  F1H06: `Army Command Staff Magel`,
  F1H07: `Colonel Agraft`,
  F1H08: `Warden Gerhard`,
  F1H09: `Air marshal Trevia`,
  F1H10: `Infiltrator Laethissa`,
  F2H01: `Knazyh Denshikova`,
  F2H02: `Prime-Knazyh Estelia`,
  F2H03: `Artifex Hertas`,
  F2H04: `Rotmistr Vladask`,
  F2H05: `Dvormester Lyubov`,
  F2H06: `Tank commander Beryt`,
  F2H07: `Rotmistr Liza`,
  F2H08: `Konigmester Yevdoki`,
  F2H09: `Legate Girosky`,
  F2H10: `Archeologist Karia`,
  F3H01: `Architectus Droh`,
  F3H02: `Captain Seculdi`,
  F3H03: `Siege Master Obivim`,
  F3H04: `Major Delcia`,
  F3H05: `Lieutenant Delven`,
  F3H06: `Iron Captain Milio`,
  F3H07: `Techno adept Jorg`,
  F3H08: `Colonel Eleonor`,
  F3H09: `Brigadier Kosagi`,
  F3H10: `Captain Scarlett`,
})

export const HEROS_TO_CODES = invert(CODES_TO_HEROS)

export const CODES_TO_BUIS_SHORT = dict({
  CB01: `Bunker`,
  CB01R: `Bunker+`,
  CB02: `Bastion`,
  CB03: `Durendal`,
  CB03R: `Durendal+`,
  CB04: `Warwolf`,
  CB05: `Sanction`,
  CB06: `Slovek`,
  CB07: `Scout`,
  CB07R: `Scout+`,
  CB08: `PlasFenc`,
  CB09: `Retrib`,
  CB10: `OmegEmit`,
  CB11: `Pulse`,
  CB12: `AirCom`,
  CB12A: `SmokSig`,
  CB13: `ArcCan`,
  CB14: `Rampart`,
  CB15: `Mirador`,
  CB15R: `Mirador+`,
  CB16: `Decima`,
  CB17: `Puma`,
  CB17R: `Puma+`,
  CB18: `Claymore`,
  CB18R: `Claymore+`,
  CB19: `LigMort`,
  CB20: `MedMort`,
  CB21: `Salamand`,
  F101: `ImpBarr`,
  F101R: `ImpBarr+`,
  F102: `Trench`,
  F103: `SectFort`,
  F106: `OfficQuart`,
  F1H07CB01: `AgraftPuma`,
  F201: `ArmStaGro`,
  F202: `Fortress`,
  F207: `StarCall`,
  F208: `StarCall`,
  F2C01: `Praetor`,
  F2C02: `Tank`,
  F2H09CB01: `FlamTsar`,
  F2H10CB01: `XenoProg`,
  F301: `JoinOp`,
  F302: `Barric`,
  F303: `SiegCit`,
  F3H07CB01: `ExpPulse`,
  F3H07CB01A: `CharSys`,
  F3H10CB01: `Scarlett`,
  F3H10CB01A: `ScarTig`,
  F3H10SB01: `CampAlph`,
  HQ01: `BlueHQ`,
  HQ02: `RedHQ`,
  HQ03: `GreenHQ`,
  NB01: `SupplPoint`,
  NB02: `AmmoStore`,
  NB03: `TechAmpl`,
  NB04: `GravWell`,
  NB05: `UndCamp`,
  NB06: `IndSite`,
  NB07: `LongRangScan`,
  NB08: `CommRelay`,
  NB09: `ProcSite`,
  NB10: `ProtTurr`,
  NB11: `DerSpir`,
  NB12: `OrioSpect`,
  NB13: `SteelFac`,
  NB14: `AdvSteelFac`,
  NB15: `LocalUnder`,
  NB16: `Obulisc`,
  NB17: `ClassSite`,
  NB18: `MonoDiss`,
  NB19: `DeciAmpl`,
  SB01: `AmmoDep`,
  SB02: `DivRel`,
  SB02A: `AntRel`,
  SB04: `ZonCom`,
  SB06: `Platform`,
  SB07: `MisCon`,
  SB07A: `CtrlExt`,
  SB08: `DemoChar`,
})

export const BUIS_TO_CODES_SHORT = invert(CODES_TO_BUIS_SHORT)

// TODO: add Scarlett, she probably has a special code like Laethissa.
export const CODES_TO_CHIS_SHORT = dict({
  // Red commanders spawn as "children" of their HQ.
  ...CODES_TO_HEROS_SHORT,
  F1H10CB01: `Laethissa`,
  F301A: `AssTeam`,
})

export const CHIS_TO_CODES_SHORT = invert(CODES_TO_CHIS_SHORT)

export const CODES_TO_NAMES_SHORT = dict({
  ...CODES_TO_HEROS_SHORT,
  ...CODES_TO_BUIS_SHORT,
})

export const NAMES_TO_CODES_SHORT = invert(CODES_TO_NAMES_SHORT)

export const SELL_COST_MUL = 0.8

export const DIFF_MAX_ROUND_NUM = new Map()
  .set(0, 25)
  .set(1, 28)
  .set(2, 32)
  .set(4, 35)
  .set(5, 35)

export const MAX_KNOWN_ROUND_NUM = 35

function dict(val) {return a.assign(a.Emp(), val)}

function invert(src) {
  const out = a.Emp()
  for (const [key, val] of a.entries(src)) out[val] = key
  return out
}

export function findGameReleaseForMs(ms) {
  a.reqFin(ms)

  let prev
  let next

  for (next of GAME_RELEASES) {
    if (!prev) {
      // Fuzzy match: earliest available.
      if (ms < next.ms) return next

      prev = next
      continue
    }

    // Precise match.
    if (ms >= prev.ms && ms < next.ms) return prev
  }

  if (!next) throw Error(`internal: no game release found for timestamp ${ms}`)

  // Fuzzy match: latest available.
  return next
}

/*
We treat SmokSig as having the cost of an AirCom added to it.
But Trevia's one is different and requires special handling.
See `buiCost`.
*/
export const COST_AIR_COM = 1500
export const BUI_CODE_SMOK_SIG = `CB12A`
export const BUI_CODE_EXP_CHAR_SYS = `F3H07CB01A`

/*
As a special case, all Tech costs are 0. That's because their values are so low
that they would dominate the plots without providing any useful info. Meanwhile,
Recon costs are somewhat similar to Supply, so we mix them together.
*/
export const BUI_COSTS_1_9 = dict({
  HQ01: {base: 0, upg: [[400, 250], [550, 200], [1500, 950]]},
  F101: {base: 300, upg: [[350, 300], [250, 280], [300, 0]]},
  F102: {base: 100, upg: [[100, 25], [150, 30], [200, 35]]},
  F106: {base: 150, upg: [[250, 75], [150, 250], [1000, 450]]},

  HQ02: {base: 0, upg: [[150, 175], [350, 400], [1500, 5000]]},
  F201: {base: 1500, upg: [[400, 1250], [350, 2000], [250, 400]]},
  F202: {base: 2600, upg: [[500, 700], [1000, 2250], [2300, 7500]]},
  F207: {base: 100, upg: [[100, 675], [200, 10], [800, 0]]},

  HQ03: {base: 0, upg: [[0, 0], [0, 0], [0, 0]]},
  F301: {base: 700, upg: [[200, 150], [100, 150], [300, 600]]},
  F302: {base: 150, upg: [[100, 220], [250, 30], [1, 350]]},

  F1H07CB01: {base: 200, upg: [[200, 200], [250, 1100], [3500, 300]]},
  F2H09CB01: {base: 50},
  F2H10CB01: {base: 50, upg: [[50, 80], [100, 100], [250, 250]]},

  F3H07CB01: {base: 50, upg: [[50, 250], [200, 250], [800, 800]]},
  [BUI_CODE_EXP_CHAR_SYS]: {base: 50}, // Can also be 0. We special-case it in `buiCost`.

  F3H10CB01A: {base: 200},
  F3H10SB01: {base: 350, upg: [[50, 50], [125, 125], [250, 250]]},

  CB01: {base: 200, upg: [[110, 125], [150, 300], [600, 1250]]},
  CB02: {base: 575, upg: [[100, 200], [300, 800], [850, 750]]},
  CB03: {base: 525, upg: [[150, 175], [350, 0], [7200, 1050]]},
  CB04: {base: 300, upg: [[180, 150], [300, 0], [600, 2000]]},
  CB05: {base: 1250, upg: [[35, 250], [350, 100], [1350, 800]]},
  CB06: {base: 800, upg: [[0, 600], [75, 1200], [2700, 2000]]},
  CB07: {base: 55, upg: [[50, 10], [55, 30], [60, 130]]},
  CB08: {base: 2500, upg: [[350, 800], [0, 2100], [0, 2800]]},
  CB09: {base: 900, upg: [[100, 450], [550, 1400], [0, 3250]]},
  CB10: {base: 1200, upg: [[200, 450], [600, 600], [0, 750]]},
  CB11: {base: 1400, upg: [[450, 350], [2200, 400], [0, 4500]]},
  CB12: {base: COST_AIR_COM, upg: [[550, 100], [0, 300], [350, 1500]]},
  [BUI_CODE_SMOK_SIG]: {base: COST_AIR_COM + 5},
  CB13: {base: 2200, upg: [[400, 300], [350, 700], [0, 1250]]},
  CB14: {base: 2000, upg: [[2500, 1000], [750, 400], [3500, 5500]]},
  CB15: {base: 200, upg: [[150, 190], [140, 1100], [325, 350]]},
  CB16: {base: 270, upg: [[220, 450], [220, 350], [85, 600]]},
  CB17: {base: 400, upg: [[225, 240], [80, 400], [450, 0]]},
  CB18: {base: 350, upg: [[350, 325], [350, 315], [650, 90]]},
  CB19: {base: 100, upg: [[35, 65], [110, 90], [280, 300]]},
  CB20: {base: 400, upg: [[130, 90], [180, 250], [550, 0]]},
  CB21: {base: 850, upg: [[150, 40], [275, 250], [450, 0]]},
  SB01: {base: 300, upg: [[75, 150], [110, 200], [0, 360]]},
  SB02: {base: 350, upg: [[650, 0], [600, 350], [0, 300]]},
  SB02A: {base: 25},
  SB04: {base: 125, upg: [[150, 900], [50, 300], [125, 0]]},
  SB06: {base: 50},
  SB07: {base: 450, upg: [[450, 350], [0, 375], [50, 1400]]},
  SB07A: {base: 250},
})

BUI_COSTS_1_9.CB01R = a.reqObj(BUI_COSTS_1_9.CB01)
BUI_COSTS_1_9.CB03R = a.reqObj(BUI_COSTS_1_9.CB03)
BUI_COSTS_1_9.CB07R = a.reqObj(BUI_COSTS_1_9.CB07)
BUI_COSTS_1_9.CB15R = a.reqObj(BUI_COSTS_1_9.CB15)
BUI_COSTS_1_9.CB17R = a.reqObj(BUI_COSTS_1_9.CB17)
BUI_COSTS_1_9.CB18R = a.reqObj(BUI_COSTS_1_9.CB18)
BUI_COSTS_1_9.F101R = a.reqObj(BUI_COSTS_1_9.F101)

export const BUI_COSTS_1_11 = dict({
  ...BUI_COSTS_1_9,

  //    {base: 525, upg: [[150, 175], [350, 0], [7200, 1050]]}
  CB03: {base: 525, upg: [[150, 175], [350, 0], [4400, 1050]]},

  //    {base: 575, upg: [[100, 200], [300, 800], [850, 750]]}
  CB02: {base: 575, upg: [[75, 200], [300, 800], [850, 750]]},

  //    {base: 850, upg: [[150, 40], [275, 250], [450, 0]]}
  CB21: {base: 850, upg: [[150, 40], [275, 375], [450, 0]]},

  //    {base: 900, upg: [[100, 450], [550, 1400], [0, 3250]]}
  CB09: {base: 900, upg: [[100, 450], [550, 1400], [0, 2900]]},

  //    {base: 2200, upg: [[400, 300], [350, 700], [0, 1250]]},
  CB13: {base: 1600, upg: [[400, 300], [350, 700], [0, 1250]]},

  //    {base: 270, upg: [[220, 450], [220, 350], [85, 600]]},
  CB16: {base: 270, upg: [[120, 450], [120, 350], [85, 600]]},
})

export const GAME_RELEASES = [
  {ver: `1.9.0`, ms: a.reqFin(Date.parse(`2025-05-15T16:00:00Z`)), costs: BUI_COSTS_1_9},
  {ver: `1.11.0`, ms: a.reqFin(Date.parse(`2025-05-22T18:40:00Z`)), costs: BUI_COSTS_1_11},
]
