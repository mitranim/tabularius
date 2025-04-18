export const CODES_TO_COMMANDERS_SHORT = {
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
}

export const COMMANDERS_TO_CODES_SHORT = invert(CODES_TO_COMMANDERS_SHORT)

export const CODES_TO_COMMANDERS = {
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
}

export const COMMANDERS_TO_CODES = invert(CODES_TO_COMMANDERS)

export const CODES_TO_BUILDINGS_SHORT = {
  CB01: `Bunker`,
  CB01R: `Bunker+`,
  CB02: `Bastion`,
  CB03: `Durend`,
  CB03R: `Durend+`,
  CB04: `Warwolf`,
  CB05: `Sanct`,
  CB06: `Slovek`,
  CB07: `Scout`,
  CB07R: `Scoot+`,
  CB08: `PlasFence`,
  CB09: `Retrib`,
  CB10: `OmegaEmit`,
  CB11: `SuperPulse`,
  CB12: `AirCom`,
  CB12A: `SmokSig`,
  CB13: `ArcCann`,
  CB14: `Missilo`,
  CB15: `Mirador`,
  CB15R: `Mirador+`,
  CB16: `Decimation`,
  CB17: `Puma`,
  CB17R: `Puma+`,
  CB18: `Claymore`,
  CB18R: `Claymore+`,
  CB19: `LigMort`,
  CB20: `MedMort`,
  CB21: `Salamand`,
  F101: `Barrack`,
  F101R: `Barrack+`,
  F102: `Trench`,
  F103: `SectFort`,
  F106: `OfficQuart`,
  F1H07CB01: `AgraftPuma`,
  F201: `ArmStaGro`,
  F202: `Fortress`,
  F207: `StarCall`,
  F208: `StarCall`,
  F2C01: `Praetorian`,
  F2C02: `Tank`,
  F2H09CB01: `Flame_of_Tsarstvo`,
  F2H10CB01: `Xeno-prog`,
  F301: `JOC`,
  F301A: `AssTeam`,
  F302: `Barricade`,
  F303: `SiegCit`,
  F3H07CB01: `ExperPulse`,
  F3H07CB01A1: `UnderChargeSys`,
  F3H10CB01: `Scarlett`,
  F3H10CB01A: `ScarlettTiger`,
  F3H10SB01: `CampAlpha`,
  HQ01: `BlueHQ`,
  HQ02: `RedHQ`,
  HQ03: `GreenHQ`,
  NB01: `SupplyPoint`,
  NB02: `AmmoStore`,
  NB03: `TechAmpl`,
  NB04: `GravWell`,
  NB05: `UnderCamp`,
  NB06: `IndSite`,
  NB07: `LongRangScan`,
  NB08: `CommRelay`,
  NB09: `ProcSite`,
  NB10: `Proto-turr`,
  NB11: `DeriumSpire`,
  NB12: `Orio-spect`,
  NB13: `SteelFac`,
  NB14: `AdvSteelFac`,
  NB15: `LocalUnder`,
  NB16: `Obuliscator`,
  NB17: `ClassSite`,
  NB18: `Mono-diss`,
  NB19: `Deci-ampl`,
  SB01: `AmmoDepo`,
  SB02: `DivRel`,
  SB02A: `AntRel`,
  SB04: `ZonCom`,
  SB06: `Platform`,
  SB07: `MissCtrl`,
  SB07A: `CtrlExt`,
  SB08: `DemoCharge`,
}

export const BUILDINGS_TO_CODES_SHORT = invert(CODES_TO_BUILDINGS_SHORT)

export const CODES_TO_NAMES_SHORT = {
  ...CODES_TO_COMMANDERS_SHORT,
  ...CODES_TO_BUILDINGS_SHORT,
}

export const NAMES_TO_CODES_SHORT = invert(CODES_TO_NAMES_SHORT)

function invert(src) {
  const out = {}
  for (const [key, val] of Object.entries(src)) out[val] = key
  return out
}
