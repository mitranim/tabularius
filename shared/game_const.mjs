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
  HQ01: `BlueHQ`,
  HQ02: `RedHQ`,
  HQ03: `GreenHQ`,
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
  F101: `ImpBar`,
  F101R: `ImpBar+`,
  F102: `Trench`,
  F103: `SectFort`,
  F106: `OfficQuart`,
  F1H07CB01: `AgraftPuma`,
  F1H10CB01: `Laethissa`,
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
  DBBAN01: `Attenuator`,
  DBBOOST01: `Amplifier`,
  SC01: `CuzeFort`,
  SC02: `UrsaCalc`,
  SC03: `SirioArt`,
  SC04: `DualAsro`,
  SC05: `EsnoDurend`,
  SC06: `LiegoDomin`,
  SB01: `AmmoDep`,
  SB02: `DivRel`,
  SB02A: `AntRel`,
  SB04: `ZonCom`,
  SB06: `Platform`,
  SB07: `MisCon`,
  SB07A: `CtrlExt`,
  SB08: `DemoChar`,
  NB01: `SupplPoint`,
  NB02: `AmmoStore`,
  NB03: `TechAmpl`,
  NB04: `GravWell`,
  NB05: `UndCamp`,
  NB06: `IndSite`,
  NB07: `LongRangScan`,
  NB08: `ComRel`,
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
  FB01: `DistortPit`,
  FB02: `ReactPit`,
  FB03: `HarrowTit`,
  FB04: `PheroEnh`,
  FB05: `SlumbPit`,
  FB06: `XenoExtr`,
  FB07: `EvoPit`,
  FB08: `PendorSpire`,
  FB09: `SurveyPit`,
  FB10: `BrainRelay`,
  FB11: `ExpXenoAmp`,
})

export const BUIS_TO_CODES_SHORT = invert(CODES_TO_BUIS_SHORT)

// SYNC[bui_doct].
export const BUI_DOCT = [
  undefined,
  `cost_1`,
  `cost_2`,
  `cost_3`,
  `efficiency_1`,
  `efficiency_2`,
  `efficiency_3`,
  `mastery`,
]

export const CODES_TO_DOCTS = dict({
  D1_01: `First_reserve`,
  D1_02: `Negotiation_skills`,
  D1_03: `Solid_foundations`,
  D1_04: `Personal_contact`,
  D1_05: `Thorough_scouting`,
  D1_06: `Drill_camps`,
  D1_07: `Shooting_drills`,
  D1_08: `Repair_team`,
  D1_09: `Conquest_triumph`,
  D1_10: `Stern_determination`,
  D1_11: `First_defense_line`,
  D1_12: `Structural_network`,
  D1_13: `Reinforced_structure`,
  D1_14: `Vicious_crossfire`,
  D1_15: `Imperial_program`,
  D1_16: `Simple_design`,
  D1_17: `Non-standard_fabrication`,
  D1_18: `Special_training`,
  D1_19: `Military_academy`,
  D1_20: `Intelligence_gathering`,
  D1_21: `Direct_orders`,
  D1_22: `Polyvalent_fireteams`,
  D1_23: `Local_acquisition`,
  D1_24: `Authority_requisition`,
  D1_25: `Stock_control`,
  D1_26: `Unbreakable_faith`,
  D1_27: `Advanced_Mirador`,
  D1_28: `Tight_ranks`,
  D1_29: `Development_opportunity`,
  D1_30: `Heavy_guns`,
  D1_31: `Planified_installations`,
  D1_32: `Local_collaboration`,
  D1_33: `First_batch`,
  D1_34: `Field_works`,
  D1_35: `Hulky_fortress`,
  D1_36: `Improved_foundation`,
  D1_37: `Tireless_patrols`,
  D1_38: `Batch_production`,
  D1_39: `Lead_by_example`,
  D1_40: `Simple_stock`,
  D1_41: `Axiom_Omega`,
  D1_42: `Axiom_Epsilon`,
  D1_43: `Auxiliary_deployment`,
  D2_01: `Optimised_setup`,
  D2_02: `Heavy_draft`,
  D2_03: `Polymesh_armor`,
  D2_04: `Better_practices`,
  D2_05: `Screening_patrol`,
  D2_06: `Strict_obedience`,
  D2_07: `Strenght_in_numbers`,
  D2_08: `Special_coolants`,
  D2_09: `Higher_intercession`,
  D2_10: `High_Priority_Process`,
  D2_11: `Mastercrafted_weapons`,
  D2_12: `Rushed_installations`,
  D2_13: `Efficient_design`,
  D2_14: `Special_dotations`,
  D2_15: `Surveying_sappers`,
  D2_16: `Rapid_construction`,
  D2_17: `Priority_clearance`,
  D2_18: `Scouts_findings`,
  D2_19: `High_orbit_relay`,
  D2_20: `Imperial_research`,
  D2_21: `Contingent_commission`,
  D2_22: `Overclocked_cogitors`,
  D2_23: `Headquarter_upgrade`,
  D2_24: `Adjusted_priorities`,
  D2_25: `Veteran_squads`,
  D2_26: `Supply_chain`,
  D2_27: `Acquisition_procedures`,
  D2_28: `First_line`,
  D2_29: `Imperial_fervor`,
  D2_30: `Xenos_expertise`,
  D2_31: `Pre-Calibrated_solutions`,
  D2_32: `Advanced_Sturdy_bunker`,
  D2_33: `Advanced_Durendal_position`,
  D2_34: `Advanced_Scout_hideout`,
  D2_35: `Advanced_Puma_position`,
  D2_36: `Advanced_Claymore_defense`,
  D2_37: `Advanced_Imperial_barrack`,
  D2_38: `Supply_drops`,
  D2_39: `Lofty_duties`,
  D2_40: `Focus_militarization`,
  D3_01: `High_grade_explosives`,
  D3_02: `Heavy_industry`,
  D3_03: `Best_armors`,
  D3_04: `Honour_guard`,
  D3_05: `Heavy_plating`,
  D3_06: `Simple_mechanisms`,
  D3_07: `For_the_Tsarina!`,
  D3_08: `Final_stand`,
  D3_09: `Suppressive_fire`,
  D3_10: `High_ground`,
  D3_11: `War_measures`,
  D3_12: `Simple_tactics`,
  D3_13: `Intelligence_expertise`,
  D3_14: `Negotiation_expertise`,
  D3_15: `Upgrade_Plans`,
  D3_16: `Quality_over_quantity`,
  D3_17: `Ionized_weapons`,
  D3_18: `Air_domination`,
  D3_19: `Unyielding_determination`,
  D3_20: `Perfected_trackings`,
  D3_21: `Final_mobilization`,
  D3_22: `Immortal_fortress`,
  D3_23: `Direct_assaults`,
  D3_24: `Demand_forecast`,
  D3_25: `Grande_offensive`,
  D3_26: `Navy_collaboration`,
  D3_27: `Veteran_garrison`,
  D3_28: `Guard_of_the_Knotev`,
  D3_29: `Grand_line`,

  TBCB01D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[1]),
  TBCB01D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[2]),
  TBCB01D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[3]),
  TBCB01D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[4]),
  TBCB01D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[5]),
  TBCB01D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[6]),
  TBCB01D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB01), BUI_DOCT[7]),

  TBCB02D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[1]),
  TBCB02D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[2]),
  TBCB02D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[3]),
  TBCB02D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[4]),
  TBCB02D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[5]),
  TBCB02D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[6]),
  TBCB02D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB02), BUI_DOCT[7]),

  TBCB03D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[1]),
  TBCB03D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[2]),
  TBCB03D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[3]),
  TBCB03D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[4]),
  TBCB03D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[5]),
  TBCB03D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[6]),
  TBCB03D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB03), BUI_DOCT[7]),

  TBCB04D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[1]),
  TBCB04D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[2]),
  TBCB04D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[3]),
  TBCB04D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[4]),
  TBCB04D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[5]),
  TBCB04D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[6]),
  TBCB04D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB04), BUI_DOCT[7]),

  TBCB05D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[1]),
  TBCB05D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[2]),
  TBCB05D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[3]),
  TBCB05D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[4]),
  TBCB05D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[5]),
  TBCB05D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[6]),
  TBCB05D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB05), BUI_DOCT[7]),

  TBCB06D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[1]),
  TBCB06D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[2]),
  TBCB06D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[3]),
  TBCB06D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[4]),
  TBCB06D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[5]),
  TBCB06D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[6]),
  TBCB06D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB06), BUI_DOCT[7]),

  TBCB07D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[1]),
  TBCB07D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[2]),
  TBCB07D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[3]),
  TBCB07D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[4]),
  TBCB07D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[5]),
  TBCB07D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[6]),
  TBCB07D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB07), BUI_DOCT[7]),

  TBCB08D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[1]),
  TBCB08D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[2]),
  TBCB08D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[3]),
  TBCB08D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[4]),
  TBCB08D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[5]),
  TBCB08D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[6]),
  TBCB08D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB08), BUI_DOCT[7]),

  TBCB09D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[1]),
  TBCB09D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[2]),
  TBCB09D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[3]),
  TBCB09D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[4]),
  TBCB09D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[5]),
  TBCB09D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[6]),
  TBCB09D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB09), BUI_DOCT[7]),

  TBCB10D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[1]),
  TBCB10D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[2]),
  TBCB10D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[3]),
  TBCB10D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[4]),
  TBCB10D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[5]),
  TBCB10D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[6]),
  TBCB10D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB10), BUI_DOCT[7]),

  TBCB11D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[1]),
  TBCB11D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[2]),
  TBCB11D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[3]),
  TBCB11D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[4]),
  TBCB11D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[5]),
  TBCB11D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[6]),
  TBCB11D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB11), BUI_DOCT[7]),

  TBCB13D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[1]),
  TBCB13D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[2]),
  TBCB13D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[3]),
  TBCB13D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[4]),
  TBCB13D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[5]),
  TBCB13D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[6]),
  TBCB13D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB13), BUI_DOCT[7]),

  TBCB14D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[1]),
  TBCB14D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[2]),
  TBCB14D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[3]),
  TBCB14D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[4]),
  TBCB14D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[5]),
  TBCB14D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[6]),
  TBCB14D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB14), BUI_DOCT[7]),

  TBCB15D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[1]),
  TBCB15D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[2]),
  TBCB15D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[3]),
  TBCB15D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[4]),
  TBCB15D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[5]),
  TBCB15D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[6]),
  TBCB15D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB15), BUI_DOCT[7]),

  TBCB16D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[1]),
  TBCB16D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[2]),
  TBCB16D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[3]),
  TBCB16D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[4]),
  TBCB16D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[5]),
  TBCB16D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[6]),
  TBCB16D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB16), BUI_DOCT[7]),

  TBCB17D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[1]),
  TBCB17D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[2]),
  TBCB17D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[3]),
  TBCB17D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[4]),
  TBCB17D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[5]),
  TBCB17D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[6]),
  TBCB17D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB17), BUI_DOCT[7]),

  TBCB18D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[1]),
  TBCB18D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[2]),
  TBCB18D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[3]),
  TBCB18D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[4]),
  TBCB18D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[5]),
  TBCB18D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[6]),
  TBCB18D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB18), BUI_DOCT[7]),

  TBCB19D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[1]),
  TBCB19D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[2]),
  TBCB19D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[3]),
  TBCB19D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[4]),
  TBCB19D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[5]),
  TBCB19D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[6]),
  TBCB19D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB19), BUI_DOCT[7]),

  TBCB20D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[1]),
  TBCB20D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[2]),
  TBCB20D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[3]),
  TBCB20D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[4]),
  TBCB20D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[5]),
  TBCB20D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[6]),
  TBCB20D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB20), BUI_DOCT[7]),

  TBCB21D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[1]),
  TBCB21D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[2]),
  TBCB21D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[3]),
  TBCB21D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[4]),
  TBCB21D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[5]),
  TBCB21D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[6]),
  TBCB21D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.CB21), BUI_DOCT[7]),

  TBF101D1: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[1]),
  TBF101D2: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[2]),
  TBF101D3: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[3]),
  TBF101D4: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[4]),
  TBF101D5: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[5]),
  TBF101D6: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[6]),
  TBF101D7: joinKeys(a.reqValidStr(CODES_TO_BUIS_SHORT.F101), BUI_DOCT[7]),
})

export const DOCTS_TO_CODES = invert(CODES_TO_DOCTS)

export const CODES_TO_FRONTIER_MODS = dict({
  FM01: `Volcanic_underground`,
  FM02: `Jagged_terrain`,
  FM03: `Cursed_world`,
  FM04: `Foggy_world`,
  FM05: `Rotten_atmosphere`,
  FM06: `Massive_lifeforms`,
  FM07: `Bryta_infestation`,
  FM08: `Constant_blizzards`,
  FM09: `Extended_supply_lines`,
  FM10: `Low_tech_world`,
  FM11: `Feral_world`,
  FM12: `Teeming_invasion`,
  FM13: `Hostile_locals`,
  FM14: `Lurking_alpha_lecos`,
})

export const FRONTIER_MODS_TO_CODES = invert(CODES_TO_FRONTIER_MODS)

export const CODES_TO_CURSES = dict({
  ND01: `Maintenance_debt`,
  ND02: `Oversleeping_sentries`,
  ND03: `Corrupted_datastone`,
  ND04: `Safety_protocol_violation`,
  ND05: `Unscheduled_inspection`,
  ND06: `Low_grade_steel`,
  ND07: `Faulty_wirings`,
  ND08: `Scent_of_frizzled_meat`,
  ND09: `Mutagen_leak`,
  ND10: `Component_mismatch`,
  ND11: `Crypted_blueprints`,
  ND12: `Diplomatic_faux_pas`,
  ND13: `Blocked_ramp`,
  ND14: `Rushed_installations`,
  ND15: `Top-down_planning`,
  ND16: `Food_poisoning`,
  ND17: `Battered_armor`,
  ND18: `Local_landslide`,
  ND19: `Tangled_deliveries`,
  ND20: `Mixed_signals`,
  ND21: `Unsettling_sightings`,
  ND22: `Faulty_terrain`,
  ND23: `Rushed_deadlines`,
  ND24: `Faulty_radiator`,
})

export const CURSES_TO_CODES = invert(CODES_TO_CURSES)

export const CODES_TO_DOTATIONS = dict({
  FH01: `Vanguard_team`,
  FH02: `Large_cargo`,
  FH03: `Special_delivery`,
  FH04: `Personal_stash`,
  FH05: `Early_propaganda`,
  FH06: `Light_mortars_delivery`,
  FH07: `Ammo_depot_delivery`,
  FH08: `Barricade_delivery`,
  FH09: `Staging_ground_delivery`,
  FH10: `Antenna_relay_delivery`,
  FH11: `Advanced_Mirador_delivery`,
  FH12: `Sturdy_bunkers_delivery`,
  FH13: `Platforms_delivery`,
  FH14: `Delayed_help`,
  FH15: `Personal_squad`,
  FH16: `Light_plating`,
  FH17: `Engineering_skills`,
  FH18: `Gunnery_skills`,
  FH19: `Elite_regiment`,
})

export const DOTATIONS_TO_CODES = invert(CODES_TO_DOTATIONS)

export const CODES_TO_ALL_DOCTS = dict({
  ...CODES_TO_DOCTS,
  ...CODES_TO_CURSES,
  ...CODES_TO_DOTATIONS,
  ...CODES_TO_FRONTIER_MODS,
})

export const ALL_DOCTS_TO_CODES = invert(CODES_TO_ALL_DOCTS)

export const CODES_TO_CHIS_SHORT = dict({
  // Red commanders spawn as "children" of their HQ.
  ...CODES_TO_HEROS_SHORT,
  F1H10CB01: `Laethissa`,
  F301A: `AssTeam`,
})

export const CHIS_TO_CODES_SHORT = invert(CODES_TO_CHIS_SHORT)

/*
Unlike all other code-to-name collections, we intentionally do not create an
inverse of this dictionary, because it would be a gotcha. We have some name
collisions, which means this is not properly invertible. Mapping names to codes
needs to be done with knowledge of entity type.
*/
export const CODES_TO_NAMES_SHORT = dict({
  ...CODES_TO_HEROS_SHORT,
  ...CODES_TO_BUIS_SHORT,
  ...CODES_TO_ALL_DOCTS,
})

export const WEPS = new Set([
  `AssaultTeam_Launcher`,
  `Avenger_rack`,
  `Barrage_LMG`,
  `C2_mine_launcher`,
  `C2_mine_launcher_area_denial`,
  `Cruiser_canon`,
  `Defender_M5`,
  `Dual_Barrage_LMG`,
  `Dual_Durendal_cannon`,
  `Dual_Peacemaker_M3_pistol`,
  `Durendal_blessed_canon`,
  `Durendal_cannon`,
  `Electric_arc_generator`,
  `Eminus_M4`,
  `Eminus_M4_F1`,
  `Eminus_M4_modified`,
  `F1H10CB01_Launcher`,
  `Frag_launcher`,
  `Gravity_well`,
  `Heavy_flamer`,
  `Heavy_vencedor`,
  `Kladen_cannon`,
  `Light_mortar_B2`,
  `Mace`,
  `Medium_mortar_B3`,
  `Missile_launcher_GlorySeeker`,
  `Missile_launcher_Python`,
  `Multi_pulse`,
  `Omega_emitter`,
  `Omega_emitter_dual`,
  `Pistol_flamer`,
  `Protector_M2`,
  `Pulse_cannon`,
  `Pulse_rifle`,
  `Quad_Barrage_LMG`,
  `Rampart_silo`,
  `Rampart_silo3A`,
  `Rampart_silo3B`,
  `Reaper_cannon`,
  `Retribution_rack`,
  `Sanction_cannon_B5`,
  `Sanction_cannon_B5_flak`,
  `Shotgun_AS4`,
  `Slovek_howitzer`,
  `StormRifle_M8`,
  `Super_Heavy_Pulse_cannon`,
  `Super_Heavy_Pulse_cannon_experimental`,
  `T8_Bomber`,
  `Vencedor_MK2`,
  `Vencedor_Pistol`,
  `Warwolf_GM8`,
  `Xenoprognosis_decelaration_field`,
  `Xenoprognosis_modular_core`,
])

export const FOES = dict({
  F01: dict({code: `F01`, name: `Minimucos`, tier: 0}),
  F02: dict({code: `F02`, name: `Devorare`, tier: 0}),
  F03: dict({code: `F03`, name: `Pendor`, tier: 0}),
  F04: dict({code: `F04`, name: `Aramobis`, tier: 0}),
  F05: dict({code: `F05`, name: `Mimucos`, tier: 1}),
  F06: dict({code: `F06`, name: `Medacris`, tier: 1}),
  F07: dict({code: `F07`, name: `Phagotrope`, tier: 1}),
  F08: dict({code: `F08`, name: `Cnid`, tier: 2}),
  F09: dict({code: `F09`, name: `Deviscor`, tier: 1}),
  F10: dict({code: `F10`, name: `Bryta`, tier: 1}),
  F11: dict({code: `F11`, name: `Sanatrope`, tier: 2}),
  F12: dict({code: `F12`, name: `Megamucos`, tier: 3}),
  F14: dict({code: `F14`, name: `Parasis`, tier: 2}),
  F15: dict({code: `F15`, name: `Coleptis`, tier: 3}),
  F16: dict({code: `F16`, name: `Lecos`, tier: 3}),
  F17: dict({code: `F17`, name: `Medacris_brood`, tier: 3}),
  F18: dict({code: `F18`, name: `Krylo`, tier: 2}),
  F19: dict({code: `F19`, name: `Torrest`, tier: 3}),
  F22: dict({code: `F22`, name: `Mucos`, tier: 2}),
  FW01: dict({code: `FW01`, name: `Hell_from_above`, tier: 4}),
  FW02: dict({code: `FW02`, name: `Threat_majoris`, tier: 4}),
  FW03: dict({code: `FW03`, name: `Terminus_maximus`, tier: 4}),
  FW04: dict({code: `FW04`, name: `Undying_onslaught`, tier: 4}),
  FW05: dict({code: `FW05`, name: `Spearhead_attack`, tier: 4}),
  FW06: dict({code: `FW06`, name: `Breeding_grounds`, tier: 4}),
  FW07: dict({code: `FW07`, name: `Full_invasion`, tier: 4}),
  FW08: dict({code: `FW08`, name: `Major_breach`, tier: 4}),
  FW09: dict({code: `FW09`, name: `Powerful_host`, tier: 4}),
  FW10: dict({code: `FW10`, name: `Colossal_outbreak`, tier: 4}),
  FW11: dict({code: `FW11`, name: `Disrupted_logistic`, tier: 4}),
  FE01: dict({code: `FE01`, name: `???`, tier: 5}),
  FE03: dict({code: `FE03`, name: `Vagus`, tier: 5}),
  FE04: dict({code: `FE04`, name: `Omegamucos`, tier: 5}),
  FE05: dict({code: `FE05`, name: `???`, tier: 5}),
  FE06: dict({code: `FE06`, name: `Threxid`, tier: 5}),
})

// Courtesy of Shmafoo on Discord.
// Only generic zones are listed. HQ zones are missing.
export const ZONES = new Set([
  `ZoneC1_001`, `ZoneC1_002`, `ZoneC1_003`, `ZoneC1_004`, `ZoneC1_005`, `ZoneC1_006`, `ZoneC1_007`, `ZoneC1_008`, `ZoneC1_009`, `ZoneC1_010`, `ZoneC1_011`,
  `ZoneC2_001`, `ZoneC2_002`, `ZoneC2_003`, `ZoneC2_004`, `ZoneC2_005`, `ZoneC2_006`, `ZoneC2_007`, `ZoneC2_008`, `ZoneC2_009`, `ZoneC2_010`, `ZoneC2_011`,
  `ZoneC3_001`, `ZoneC3_002`, `ZoneC3_003`, `ZoneC3_004`, `ZoneC3_005`, `ZoneC3_006`, `ZoneC3_007`, `ZoneC3_008`, `ZoneC3_009`, `ZoneC3_010`, `ZoneC3_011`,
  `ZoneC4_001`, `ZoneC4_002`, `ZoneC4_003`, `ZoneC4_004`, `ZoneC4_005`, `ZoneC4_006`, `ZoneC4_007`, `ZoneC4_008`, `ZoneC4_009`, `ZoneC4_010`,
  `ZoneL1_001`, `ZoneL1_002`, `ZoneL1_003`, `ZoneL1_004`, `ZoneL1_005`, `ZoneL1_006`, `ZoneL1_007`, `ZoneL1_008`, `ZoneL1_009`, `ZoneL1_010`, `ZoneL1_011`, `ZoneL1_012`,
  `ZoneL2_001`, `ZoneL2_002`, `ZoneL2_003`, `ZoneL2_004`, `ZoneL2_005`, `ZoneL2_006`, `ZoneL2_007`, `ZoneL2_008`, `ZoneL2_009`, `ZoneL2_010`, `ZoneL2_011`, `ZoneL2_012`,
  `ZoneL3_001`, `ZoneL3_002`, `ZoneL3_003`, `ZoneL3_004`, `ZoneL3_005`, `ZoneL3_006`, `ZoneL3_007`, `ZoneL3_008`, `ZoneL3_009`, `ZoneL3_010`, `ZoneL3_011`, `ZoneL3_012`,
  `ZoneP1_001`, `ZoneP1_002`, `ZoneP1_003`, `ZoneP1_004`, `ZoneP1_005`,
  `ZoneT1_001`, `ZoneT1_002`, `ZoneT1_003`, `ZoneT1_004`, `ZoneT1_005`, `ZoneT1_006`, `ZoneT1_007`, `ZoneT1_008`, `ZoneT1_009`, `ZoneT1_010`, `ZoneT1_011`, `ZoneT1_012`,
  `ZoneT2_001`, `ZoneT2_002`, `ZoneT2_003`, `ZoneT2_004`, `ZoneT2_005`, `ZoneT2_006`, `ZoneT2_007`, `ZoneT2_008`, `ZoneT2_009`, `ZoneT2_010`, `ZoneT2_011`, `ZoneT2_012`,
  `ZoneT3_001`, `ZoneT3_002`, `ZoneT3_003`, `ZoneT3_004`, `ZoneT3_005`, `ZoneT3_006`, `ZoneT3_007`, `ZoneT3_008`, `ZoneT3_009`, `ZoneT3_010`, `ZoneT3_011`, `ZoneT3_012`,
  `ZoneX1_001`, `ZoneX1_002`, `ZoneX1_003`, `ZoneX1_004`, `ZoneX1_005`, `ZoneX1_006`, `ZoneX1_007`, `ZoneX1_008`, `ZoneX1_009`, `ZoneX1_010`, `ZoneX1_011`, `ZoneX1_012`, `ZoneX1_013`,
])

export const SELL_COST_MUL = 0.8

export const DIFF_MAX_ROUND_NUM = new Map()
  .set(0, 25)
  .set(1, 28)
  .set(2, 32)
  .set(3, 35)
  .set(4, 35)

export const MAX_KNOWN_ROUND_NUM = 35

export const DIFFS = new Set(a.range(0, DIFF_MAX_ROUND_NUM.size + 1))
export const DIFF_MIN = a.head(DIFFS)
export const DIFF_MAX = a.last(DIFFS)
export const FRONTIERS = new Set(a.range(0, 20))
export const FRONTIER_MIN = a.head(FRONTIERS)
export const FRONTIER_MAX = a.last(FRONTIERS)

function dict(val) {return a.assign(a.Emp(), val)}

function invert(src) {
  const out = a.Emp()
  for (const [key, val] of a.entries(src)) out[val] = key
  return out
}

export const ADV_UPG_SUF = `AdvUpg`

export function buiCodeToAdvUpgCode(key) {
  a.reqValidStr(key)
  return key + ADV_UPG_SUF
}

export function advUpgCodeToBuiCode(key) {
  a.reqValidStr(key)
  if (!key.endsWith(ADV_UPG_SUF)) return undefined
  return key.slice(0, -ADV_UPG_SUF.length)
}

export function codeToNameShortOpt(key) {
  if (!a.optStr(key)) return undefined

  const name = CODES_TO_NAMES_SHORT[key]
  if (name) return name

  const buiCode = advUpgCodeToBuiCode(key)
  if (buiCode) return buiAdvUpgName(buiCode)

  return undefined
}

export function codeToNameShort(key) {
  return codeToNameShortOpt(key) || key || undefined
}

// SYNC[bui_doct].
export function masteryCodeToBuiCode(key) {
  const mat = a.reqStr(key).match(/^TB(?<code>\S+)D7$/)
  if (mat) return mat.groups.code
  return undefined
}

export function masteryCodeToRelatedCodes(key) {
  key = masteryCodeToBuiCode(key)
  if (!key) return undefined
  return a.map(a.range(1, BUI_DOCT.length), ind => `TB${key}D${ind}`)
}

export function buiAdvUpgName(key) {
  a.reqValidStr(key)
  const name = CODES_TO_BUIS_SHORT[key]
  return joinKeys((name || key), `advanced_upgrades`)
}

function joinKeys(...src) {return a.joinOptLax(src, `_`)}

export function findGameReleaseForMs(ms) {
  ms = a.laxFin(ms)

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
    prev = next
  }

  if (!next) throw Error(`internal: no game release found for timestamp ${ms}`)

  // Fuzzy match: latest available.
  return next
}

/*
Older game versions use strings.
Version 1.47 (and higher, presumably) uses integers.
We map them to "old" strings.
*/
export const TARG_PRIO = new Map()
  .set(0, `FullHealth`)
  .set(1, `LowestHealth`)
  .set(2, `MostHealth`)
  .set(3, `Slowest`)
  .set(4, `Fastest`)
  .set(5, `Armored`)
  .set(6, `LowestArmor`)
  .set(7, `ClosestToHQ`)
  .set(8, `ExitPoints`)
  .set(9, `MostFar`)
  .set(10, `OnPath`)
  .set(11, `FreeTileAsideOfPath`)
  .set(12, `Air`)
  .set(13, `MostShield`)
  .set(14, `PreviousTarget`)
  .set(15, `Self`)

export function targPrioCodeToName(src) {
  if (a.isInt(src)) return TARG_PRIO.get(src) ?? src
  return src
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

  F3H10CB01: {base: 0},
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

BUI_COSTS_1_9.CB01R = a.reqRec(BUI_COSTS_1_9.CB01)
BUI_COSTS_1_9.CB03R = a.reqRec(BUI_COSTS_1_9.CB03)
BUI_COSTS_1_9.CB07R = a.reqRec(BUI_COSTS_1_9.CB07)
BUI_COSTS_1_9.CB15R = a.reqRec(BUI_COSTS_1_9.CB15)
BUI_COSTS_1_9.CB17R = a.reqRec(BUI_COSTS_1_9.CB17)
BUI_COSTS_1_9.CB18R = a.reqRec(BUI_COSTS_1_9.CB18)
BUI_COSTS_1_9.F101R = a.reqRec(BUI_COSTS_1_9.F101)

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

export const BUI_COSTS_1_20 = dict({
  ...BUI_COSTS_1_11,

  //    {base: 1500, upg: [[400, 1250], [350, 2000], [250, 400]]},
  F201: {base: 1500, upg: [[400, 1250], [200, 2000], [250, 400]]},

  //         {base: 50, upg: [[50, 80], [100, 100], [250, 250]]},
  F2H10CB01: {base: 50, upg: [[50, 80], [100, 100], [150, 250]]},
})

export const BUI_COSTS_1_37 = dict({
  ...BUI_COSTS_1_11,

  //    {base: 1250, upg: [[35, 250], [350, 100], [1350, 800]]},
  CB05: {base: 1250, upg: [[35, 250], [350, 100], [1350, 750]]},

  //    {base: 1200, upg: [[200, 450], [600, 600], [0, 750]]},
  CB10: {base: 1200, upg: [[200, 325], [600, 600], [0, 750]]},

  //    {base: 1600, upg: [[400, 300], [350, 700], [0, 1250]]},
  CB13: {base: 1600, upg: [[400, 300], [350, 550], [0, 1250]]},
})

export const BUI_COSTS_1_47 = dict({
  ...BUI_COSTS_1_37,
  DBBAN01: {base: 200, upg: [[25, 50], [800, 800], [300, 800]]},
  DBBOOST01: {base: 200, upg: [[25, 200], [250, 30], [700, 0]]},
  SB01A: {base: 0}, // Unconfirmed.
  SB02A: {base: 0}, // Unconfirmed.
  SB03A: {base: 0}, // Unconfirmed.
  SB04A: {base: 0}, // Unconfirmed.
  SB05A: {base: 0}, // Unconfirmed.
  SB06A: {base: 0}, // Confirmed.
  SC01: {base: 1000},
  SC02: {base: 50},
  SC03: {base: 150},
  SC04: {base: 50},
  SC05: {base: 50},
  SC06: {base: 1200},
  FB01: {base: 0},
  FB02: {base: 0},
  FB03: {base: 0},
  FB04: {base: 0},
  FB05: {base: 0},
  FB06: {base: 0},
  FB07: {base: 0},
  FB08: {base: 0},
  FB09: {base: 0, upg: [[5, 10], [10, 20], [15, 30]]},
  FB10: {base: 0},
  FB11: {base: 0, upg: [[200, 0], [300, 0], [200, 100]]},
})

export const BUI_COSTS_1_64 = dict({
  ...BUI_COSTS_1_47,

  //    {base: 700, upg: [[200, 150], [100, 150], [300, 600]]},
  F301: {base: 650, upg: [[200, 150], [100, 150], [300, 600]]},

  //    {base: 800, upg: [[0, 600], [75, 1200], [2700, 2000]]},
  CB06: {base: 800, upg: [[0, 500], [75, 1200], [2700, 1500]]},

  //    {base: COST_AIR_COM, upg: [[550, 100], [0, 300], [350, 1500]]},
  CB12: {base: COST_AIR_COM, upg: [[350, 100], [0, 300], [350, 1500]]},

  //    {base: 200, upg: [[150, 190], [140, 1100], [325, 350]]},
  CB15: {base: 200, upg: [[150, 190], [140, 950], [325, 350]]},

  //    {base: 1250, upg: [[35, 250], [350, 100], [1350, 750]]},
  CB05: {base: 1500, upg: [[35, 250], [350, 100], [1350, 750]]},

  //    {base: 270, upg: [[120, 450], [120, 350], [85, 600]]},
  CB16: {base: 270, upg: [[120, 450], [120, 200], [85, 600]]},
})

// https://steamdb.info/app/3226530/patchnotes/
export const GAME_RELEASES = [
  {ver: `1.9.0`, ms: a.reqFin(Date.parse(`2025-05-15T16:00:00Z`)), costs: BUI_COSTS_1_9},
  {ver: `1.11.0`, ms: a.reqFin(Date.parse(`2025-05-22T18:40:00Z`)), costs: BUI_COSTS_1_11},
  {ver: `1.14.0`, ms: a.reqFin(Date.parse(`2025-05-29T17:15:00Z`)), costs: BUI_COSTS_1_11},
  {ver: `1.20.0`, ms: a.reqFin(Date.parse(`2025-06-05T18:50:00Z`)), costs: BUI_COSTS_1_20},
  {ver: `1.27.0`, ms: a.reqFin(Date.parse(`2025-06-16T17:00:00Z`)), costs: BUI_COSTS_1_20},
  {ver: `1.28.0`, ms: a.reqFin(Date.parse(`2025-06-16T21:00:00Z`)), costs: BUI_COSTS_1_20},
  {ver: `1.29.0`, ms: a.reqFin(Date.parse(`2025-06-18T15:45:00Z`)), costs: BUI_COSTS_1_20},
  {ver: `1.31.0`, ms: a.reqFin(Date.parse(`2025-06-19T18:00:00Z`)), costs: BUI_COSTS_1_20},
  {ver: `1.32.0`, ms: a.reqFin(Date.parse(`2025-06-23T11:25:00Z`)), costs: BUI_COSTS_1_20},
  {ver: `1.37.0`, ms: a.reqFin(Date.parse(`2025-07-15T15:40:00Z`)), costs: BUI_COSTS_1_37},
  {ver: `1.39.0`, ms: a.reqFin(Date.parse(`2025-07-17T17:30:00Z`)), costs: BUI_COSTS_1_37},
  {ver: `1.47.0`, ms: a.reqFin(Date.parse(`2025-08-28T18:30:00Z`)), costs: BUI_COSTS_1_47},
  {ver: `1.51.0`, ms: a.reqFin(Date.parse(`2025-09-11T14:05:00Z`)), costs: BUI_COSTS_1_47},
  {ver: `1.52.0`, ms: a.reqFin(Date.parse(`2025-09-12T15:00:00Z`)), costs: BUI_COSTS_1_47},
  {ver: `1.64.0`, ms: a.reqFin(Date.parse(`2025-10-16T15:00:00Z`)), costs: BUI_COSTS_1_64},
  {ver: `1.65.0`, ms: a.reqFin(Date.parse(`2025-10-27T17:35:00Z`)), costs: BUI_COSTS_1_64},
]
