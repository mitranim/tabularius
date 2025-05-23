import * as a from '@mitranim/js/all.mjs'
import * as t from '@mitranim/js/test.mjs'
import * as tu from './test_util.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as db from './db.mjs'
import * as api from './api.mjs'

// SYNC[plot_agg_opt_dmg].
const PLOT_AGG_OPT = {
  X: `round_num`,
  Y: `dmg_done`,
  Z: `bui_type_upg`,
  agg: `sum`,
  where: {ent_type: [`run_round_bui`]},
}

/*
TODO missing tests (non-exhaustive list):
- Filter on `run_id`.
- Filter on `round_id`.
- Filter on `run_round_bui_id`.
- More combinations of filters.
*/
await t.test(async function test_plotAgg() {
  const srcUrl = new URL(`../samples/example_runs.gd`, import.meta.url)
  const srcText = await Deno.readTextFile(srcUrl)
  const rounds = await u.decodeGdStr(srcText)
  const dat = datFromRounds(rounds)
  const ctx = new tu.TestCtx()

  function req(inp, {mode, auth} = {}) {
    return new Request(`http://localhost/api/plot_agg`, {
      method: a.POST,
      body: a.isObj(inp) ? JSON.stringify(inp) : undefined,
      headers: a.compact([
        mode && [`plot_agg_mode`, mode],
        auth && u.authHeaderOpt(tu.TEST_PUBLIC_KEY, tu.TEST_SECRET_KEY),
      ])
    })
  }

  function call(...src) {return api.plotAgg(ctx, req(...src))}

  async function fail(inp, msg) {
    await t.throws(async () => await call(inp), Error, msg)
  }

  async function test({auth, ...inp}, X_exp, Z_exp, Z_X_Y_exp) {
    {
      const {X_vals, Z_vals, Z_X_Y} = await call(inp, {mode: `js`, auth})
      t.eq(X_vals, X_exp)
      t.eq(Z_vals, Z_exp)
      t.eq(u.consistentNil_null(Z_X_Y), Z_X_Y_exp)
    }

    {
      const {X_vals, Z_vals, Z_X_Y} = await call(inp, {mode: `db`, auth})
      t.eq(X_vals, X_exp)
      t.eq(Z_vals, Z_exp)
      t.eq(Z_X_Y, Z_X_Y_exp)
    }
  }

  const conn = await ctx.conn()
  await db.initSchema(conn)
  await loadFixtureFromRounds(conn, rounds)

  {
    const FACT_COUNT = 18090
    const count = await conn.queryScalar(`select count(*) from facts`)
    t.is(count, BigInt(FACT_COUNT))
    t.is(a.len(dat.facts), FACT_COUNT)
  }

  await fail(undefined, `Unexpected end of JSON input`)

  {
    const dataJsAgg = u.consistentNil_null(await call(PLOT_AGG_OPT, {mode: `js`}))
    const dataDbAgg = await call(PLOT_AGG_OPT, {mode: `db`})

    t.eq(a.keys(dataJsAgg), [`X_vals`, `Z_vals`, `Z_X_Y`, `totals`])
    t.eq(a.keys(dataDbAgg), [`X_vals`, `Z_vals`, `Z_X_Y`, `totals`])

    const X_vals = a.range(1, 36)
    t.eq(dataJsAgg.X_vals, X_vals)
    t.eq(dataDbAgg.X_vals, X_vals)

    const Z_vals = [`CB01`, `CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_AA`, `CB01_AAA`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02`, `CB02_B`, `CB02_BA`, `CB02_BB`, `CB02_BBB`, `CB03`, `CB03R_A`, `CB04`, `CB04_A`, `CB04_AA`, `CB04_AAA`, `CB04_AAB`, `CB05_B`, `CB05_BAB`, `CB05_BB`, `CB05_BBA`, `CB05_BBB`, `CB06_B`, `CB07`, `CB09_B`, `CB09_BBB`, `CB11_AAA`, `CB12A`, `CB14`, `CB14_AB`, `CB14_ABA`, `CB15`, `CB15R_A`, `CB15R_AA`, `CB15R_AAA`, `CB15R_AAB`, `CB15_A`, `CB15_AA`, `CB15_AAA`, `CB15_AAB`, `CB15_B`, `CB15_BA`, `CB15_BAA`, `CB17`, `CB17R_ABB`, `CB17_ABB`, `CB17_BBB`, `CB19_AB`, `CB19_BA`, `CB19_BAA`, `CB20_AAA`, `CB20_AAB`, `CB21`, `CB21_A`, `CB21_AB`, `F101_AA`, `F101_BA`, `F101_BAA`, `F102_B`, `F102_BB`, `F102_BBB`, `F302`, `F302_B`, `F302_BA`, `F302_BAB`, `HQ01_AA`, `HQ01_AAA`, `HQ03_AB`]
    t.eq(dataJsAgg.Z_vals, Z_vals)
    t.eq(dataDbAgg.Z_vals, Z_vals)
  }

  await test(
    {
      ...PLOT_AGG_OPT,
      where: {
        ...PLOT_AGG_OPT.where,
        user_id: [`one`],
      },
    },
    [],
    [],
    [],
  )

  // SYNC[plot_user_current_err_msg].
  await fail(
    {...PLOT_AGG_OPT, userCurrent: true},
    `filtering cloud data by current user requires authentication`,
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      userCurrent: false,
      runLatest: false,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01`, `CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_AA`, `CB01_AAA`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02`, `CB02_B`, `CB02_BA`, `CB02_BB`, `CB02_BBB`, `CB03`, `CB03R_A`, `CB04`, `CB04_A`, `CB04_AA`, `CB04_AAA`, `CB04_AAB`, `CB05_B`, `CB05_BAB`, `CB05_BB`, `CB05_BBA`, `CB05_BBB`, `CB06_B`, `CB07`, `CB09_B`, `CB09_BBB`, `CB11_AAA`, `CB12A`, `CB14`, `CB14_AB`, `CB14_ABA`, `CB15`, `CB15R_A`, `CB15R_AA`, `CB15R_AAA`, `CB15R_AAB`, `CB15_A`, `CB15_AA`, `CB15_AAA`, `CB15_AAB`, `CB15_B`, `CB15_BA`, `CB15_BAA`, `CB17`, `CB17R_ABB`, `CB17_ABB`, `CB17_BBB`, `CB19_AB`, `CB19_BA`, `CB19_BAA`, `CB20_AAA`, `CB20_AAB`, `CB21`, `CB21_A`, `CB21_AB`, `F101_AA`, `F101_BA`, `F101_BAA`, `F102_B`, `F102_BB`, `F102_BBB`, `F302`, `F302_B`, `F302_BA`, `F302_BAB`, `HQ01_AA`, `HQ01_AAA`, `HQ03_AB`],
    [
      [null, null, null, null, null, null, null, null, null, 686.199951, 773, 765.2, 999, 1018.9, 912.2999, 657.199951, 1204.4, 991.7999, 965.0999, null, null, null, null, null, 388.619965, 299.879974, 417.860046, 375.94, 424.429962, 739.7897949999999, 857.339874, 753.4499209999999, 1666.9202489999998, 1705.8836930000002, 1831.3002999999999],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4044, 3980.49976, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 13302.4, 7714.25, 9374.35, 11566.42, 7988.2, 9579, 13903.3623],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1251.88989, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3297.1, 3649.2, 3380.77979, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9483.27051, 9981.867, 9577.453, 8224.948, 11577.49, 12038.59, 12211.9492, 17341.6484, 25479.1055, 20749.8828, 19003.9, 23942.6738, 21503.1484],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 41111.25, 31528.451, 43723.8488, 48040.975, 55590.1016, 45838.152089999996, 61744.149999999994, 58826.748999999996, 66107.85801, 87704.13961, 140038.144],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 19137.6, 21330, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 38436.799999999996, 25162.799610000002, 34327.04971, 41226.1474, 29376.44822, 31704.098510000003, 59563.99770000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 1112.79932, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 989.550354, 2199.54785, 3781.045, 124.5, 1204.1, null, null, 1020.81653, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5788.14063],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4404.973, 19562.102030000002, 10334.8223, 17292.136, 65562.8997, 26138.8926, null, 13687.3115],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 31825.6035, 38053.34, 26234.5, 69642.5429, 124590.20490000001, 153837.461],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1172.18347, 972.5413, 1153.55, 1742.73059, 1444.95007, 1144.5, 1836.90051, 3863.4],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3839.85, 4387.5, 4886.95, 5065.45, 3231.15, 3521.4, 4802.34961, 5195.55, 6766.42627, 7829.51855, 6724.81348, 6372.11768, 7601.588, 7225.35742],
      [null, null, null, null, 600.0999, 468, 861.5, 1247.1497239999999, 2006.2493800000002, 1124.9, 1301.8, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 2881.0994899999996, 3399.09861, 3575.69981, 1455.29956, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4685.19812, 7815.595659999999, 1045.49988, 506.200043, 2247.199, 297.6, 0, 1523.25, 2333.92017, 6812.9873, 3322.33, 0, null, null, null, null, null, null, 5429.16455, null, 13567.377],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16233.68, 16801.90742, 20860.011100000003, 14196.80337, 7916.799849999999, 16394.049, 19725.47361, 28937.523800000003, 35745.80422, 22078.15, 37385.262800000004, 50070.9688, 59475.05962, 31718.232799999998, 46843.270539, 88877.90599999999, 61500.55034, 51480.43651, 88743.7744],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 27189.2754, 12698.8213, 17133.877, 20265.3555, 22179.2051, 10063.8193, 22122.3184, 20575.584, 16838.2715, 31543.322200000002, 59900.5762],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 21697.5488, null, null, 17292.5, 16522.5, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 35940.67, 26975.5176, 34976.84, 23925.7461, 31472.38],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14977.27, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 69120.7],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 21723.65, 26622.5566, 30260.0059, 87981.5647, 91231.8367, 86861.4942, 115528.3398, 120191.24220000001, 121529.93, 98859.2383, 138718.9883],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 12851.7676],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 456.94986, 892.8100430000001, 1718.0262930000001, 1448.1801659999999, 1324.310018, 1486.300091, 7588.236039999999],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6424.601, 11001.3574, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 17035.9063, 32149.6035, 39957.793, 25871.5371, 37937.4727, 60204.4649, 53825.2168, 58873.9142, 75739.44140000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6741.244, 24219.0254, 45851.1641, 59011.61, 41834.13, 35150.02, 98855.9141],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8468.79971, 6920.1, 9984.69876, 12838.30029, 17277.700210000003, 39760.038, 20480.58, 18805.30031, 26065.422399999996, 38230.1232, 13590.85139, 26569.1142, 48098.2549, 38737.6078, 27836.154499999997, 62787.5059],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6349.19873, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 10676.1992, 14962.2, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 60494.22, 67061.2656, 67166.03, 49400.4375, 95594.35],
      [188.2000046, 184.00001500000002, 323.150024, 143.75, 465.349945, 212.05, 204.500015, 209.25, 328.9, 404.799957, 413.349976, null, null, null, null, null, null, null, 766.399841, 1503.8696289999998, 917.829845, 1345.85971, 1362.4479999999999, 1536.940154, 1537.110059, 1338.6302, 979.2753, 600.6501, 919.475342, 476.650055, 684.9001, 720.750061, 777.290161, 167.499985, 795.3002],
      [null, null, null, 517.740051, 749.299866, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, 1005.25952, 701.0598, 1009.69452, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 2636.023, 3439.28369, 4418.01953, 1109.70044, 1939.30054, 3305.22339, 2560.649, 3408.24756, 4687.62549, 5135.37451, 5898.88037, 4873.12451, 5349.27734, 4660.76758, 4163.018, 4116.776, 5114.903, 6079.76758, 7421.81348, 5897.93066, 7085.46533, 7256.9375, 7909.16748, 7780.09, 9811.821, 8137.72852, 8431.584, 7357.421, 7888.654],
      [null, null, null, null, null, null, null, null, 1635.35059, 100.950005, 985.2002, 676.420166, 1544.57043, 262, 842.6002, 1279.30066, 810.0503, 1239.74939, 3722.14673, 1765.781, 1699.23669, 534.679932, 201.60997, 2275.05151, 3021.84424, 0, 978.2003, 859.499756, 570.299744, 173.88002, 386.8481, 1362.85327, 466.409973, 93.5, 1393.55981],
      [null, null, null, 507.2999, 621.0999, 793.9999, 894.7498, 663.3501, 1247.99927, 819.9997, 1437.29932, 1457.09912, 2486.80029, 1913.69873, 1939.79932, 1515.99939, 2044.87622, 1981.29883, 2139.499, 1848.59912, 1753.15088, 2607.252, 2667.077, 3026.67773, 3315.193, 1690.19055, 1983.44092, 3105.80273, 2264.429, 4343.76855, 3911.12354, 6360.159, 3799.42749, 5697.73242, 4625.082],
      [null, null, null, 992.249634, null, null, null, 501.900055, null, 2140.95142, 1484.60046, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, 894, 1498.201, 1575.30054, 2106.702, 1935.051, 1832.80127, 2117.00122, 2999.55469, 1499.79956, 3380.70386, 5362.8042000000005, 9742.01612, 6422.5061000000005, 7553.4587599999995, 7154.83862, 7766.045, 7821.56234, 11571.41454, 9949.72627, 6424.10954, 10158.80559, 10090.49207, 15391.61824, 17981.03914, 6537.18838, 11737.871, 12979.767329999999, 14547.40742, 11966.92279, 12975.29738, 24295.6226, 12050.062564599999, 18930.802200000002, 23280.70166],
      [null, null, null, null, 809.799744, 1165.25012, 1685.37527, 1761.750186, 4581.1007, 1352.300262, 1352.1251668, 2138.900577, 3499.42489, 2322.800804, 3697.32549, 3721.1253399999996, 2736.9747099999995, 2850.2499820000003, 3518.7757149999998, 4366.80127, 2106.4493486, 2692.7762709999997, 3355.175315, 7543.89929, 12676.760462000002, 6064.3765241, 9059.208246, 8645.551095, 16969.322749, 10532.71191, 14286.07697, 16073.425245510001, 7614.14941, 5506.4590180000005, 16407.924561],
      [null, null, null, null, null, null, null, null, null, null, null, 952.099854, 1167.45, 1075.54993, 1033.99988, 1137.95, 1323.80017, 1210.5, 995.3601, 1369.52063, 1444.4, null, null, null, null, null, 627.91, 1420.95056, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1734.82068, null, null, null, null, null, null, 5348.83447, 6337.30762, 7567.417, 9920.693360000001, 6550.367, 6915.724, 11573.065910000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3031.40356, 5286.786, 3798.37983, 9644.45665, 13707.16992, 15068.414, 14045.5474, 12870.288349999999, 15372.512999999999, 16332.721000000001, 15883.150000000001, 15217.798999999999, 20508.5766],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 264.4, 2550.2002, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3040.25, 3288.25024, 4174.74, 6433.409, 6914.219, 8468.485, 9888.418, 8319.893, 9907.121, 8051.474, 7828.78, 9480.272, 6859.773, 9298.828, 12210.1533, 9873.007, 6738.277, 11862.7285],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3202.68042, 5364.539, 6667.94971, 5110.156, 8546.92, 5978.62646, 6773.313, 11689.010409999999, 13443.801, 12967.53027, 9589.07227, 10138.855, 15026.915680000002, 20066.8435, 14606.167969999999, 12158.60326, 20038.1695],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2312, 9517.09888, 9743.649070000001, 6480.12314, 9062.59887, 14963.44531, 13749.28973, 7065.329, 10356.73936, 11148.02051, 9779.67431, 19365.17725, 16904.48143, 30854.5706, 12189.68505, 27475.6162, 17863.7654],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1117.02344, 1056, 1005.68329, 1817.685942],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1292.2, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4708.69971, 4015.784, 4833.585, 2679.09961, 4618.866, 8596.69, 7254.484, 8404.048, 5949.521, 7515.836, 7577.675, 6219.46045, 6304.954, 10323.8232],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4339.89941, 8237.876, 7748.9, 11109.1, 13576.1006, 13908.9277, 10296.4482, 9175.351, 13458.0977, 9365.329, 10638.55, 18021.7539],
      [null, null, null, null, null, null, null, null, null, 3165.5, 2441.89941, 1537.50024, 4646.29932, 2039.35, 3120.79956, 4585.74951, 4378.50049, 4507.59961, 5588.69971, 8246.049, 12133.575, 13479.699219999999, 14570.15, 13030.59951, 33670.7488, 24346.5732, 32137.2276, 28680.399400000002, 39343.378899999996, 28013.1506, 27467.923600000002, 44967.0245, 40347.9492, 41468.2481, 46671.6043],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7824.792, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9918.001, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 15730.5625, 18084.459, 11479.9395, 16403.9531, 22341.98, 25732.5371, 28897.2227, 27861.29, 25171.5273, 38088.0156, 47896.21],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 341.5501, 51.7499962, 66.7999954, 0, 0, 0, 0, 0, 0, 175.4, 0, 0, 101.25, 0, 0, 0],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 9, 81, 1525.8391023, 97.92, 455.5599847, 948.0343109999999, 6943.183700000001, 412.65807399999994, 2523.4284589999997, 2182.700629, 1008.6356999999999, 558.3901, 2828.609854],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 89.7],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1314.6001, 1061.3, 401.8, 1086.9, 1106.50012, 1398.80017, 2115.50024, 1711.30017, null, null, null, null, null, null, null, null, 1282.90588],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4565.69873],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6255.68555, 5816.63965, 7493.01953, 6524.01465, 9373.523, 7319.602, 6874.36475, 6955.633, 23844.228000000003],
      [0, 254, 254, 635.0001, 1449.27, 351.5, 228.7002, null, null, null, 179.599976, 348.2002, 124.199951, 567.6003, 778.400151, 1153.399849, 217.400024, 0, 425.199951, 0, 0, 0, 0, 0, 219, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 0, 490.800049, 554.4001, 0, 0, 0, 0, 0, 430.900024, 1500, 518.5, 0, 520.800049, 0, 422.06897, 0, 0, 163.469727, 0, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, 1144.27, 0, 0, 0, 0, 0, 0, 0, 0, 0, 561.1001, 1440.3, 0, 2761.19775, 91.5, 0, 6000, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 729.224854, 0, 0, 4194.4838899999995, 0, 2139.17969, 4990.74939],
      [2885.8000389999997, 5130.500106, 6714.60188, 7331.009164000001, 14268.313, 9849.43407, 10528.042819, 12072.625705999999, 19448.133389, 10542.502830000001, 12946.333149999999, 11522.767950999998, 17944.93186, 12016.411333, 19027.639982, 21362.036863, 11741.262, 9272.991699999999, 20015.072549999997, 17952.36695, 5324.88382, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 20350.3031, 22260.3307, 40680.035161, 51830.912899999996, 31156.774999999998, 60449.15845, 62127.8365, 91158.2771, 136909.3129, 57606.898198999996, 75519.59979, 66492.51845, 148404.42341000002, 74247.23440999999, 115982.49187, 140520.23728, 104570.5318, 103061.786, 195014.63651],
      [704.4999, 566.5, 406.799927, 584.3999, 748.5999, 515.449463, 1262.25, 1514.1991, 1573.79968, 885.599854, 638.6997, 0, 0, 0, 0, 34, 0, 0, 0, 0, 0, 0, 0, 0, 6196.14844, 0, 0, 0, 0, 0, 0, 6700.52246, 0, 57.2714844, 19350.28],
    ],
  )

  await test(
    {
      auth: true,
      ...PLOT_AGG_OPT,
      userCurrent: true,
      runLatest: true,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02_BA`, `CB04_AA`, `CB04_AAB`, `CB09_B`, `CB09_BBB`, `CB12A`, `CB15`, `CB15_AAB`, `F101_BA`, `F102_B`, `F102_BB`, `F102_BBB`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4044, 3980.49976, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 13302.4, 7714.25, 9374.35, 11566.42, 7988.2, 9579, 13903.3623],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1251.88989, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 20758, 12840.5, 7822.3, 9771.5, 13080.4, 7407.89941, 9390.5, 9827.999, 14918.599610000001, 16052.69871, 20332.0052],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 19137.6, 21330, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 38436.799999999996, 25162.799610000002, 34327.04971, 41226.1474, 29376.44822, 31704.098510000003, 59563.99770000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5788.14063],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5783.846],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14325.3213],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6424.601, 11001.3574, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 17035.9063, 32149.6035, 39957.793, 25871.5371, 37937.4727, 60204.4649, 53825.2168, 58873.9142, 75739.44140000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8468.79971, 6920.1, 9984.69876, 12838.30029, 17277.700210000003, 39760.038, 20480.58, 18805.30031, 26065.422399999996, 38230.1232, 13590.85139, 26569.1142, 32565.454100000003, 29400.7578, 16833.0539, 40771.4082],
      [null, 57.5, 57.5, 143.75, 465.349945, 212.05, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 463.7001, 739.400146, 1422.47546, 1015.60028, 853.6002, 556.850037, 1522.50049, 566.9501, 1251.07544, 1545.20068, 313.95, 410.699982, 249.649979, 1453.40063, 533.699951, 858.1002, 89.7, 656.7001, 652.679932, 0, 285.999847, 804.500061, 4426.891, 1017.06018, 2317.74561, 2833.01978, 2616.90112, 1078.01025, 2988.28613],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 9, 81, 642.0398023, 9.72, 405.159987, 736.55958, 6589.283600000001, 412.65807399999994, 2107.628359, 2182.700629, 1008.6356999999999, 558.3901, 2647.109854],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1282.90588],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4565.69873],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16024.12],
      [889.0001, 1784.0012259999999, 2228.502, 2650.25059, 5123.919, 3915.44922, 4806.804, 5483.60547, 8357.80133, 4002.25254, 6818.50869, 6684.9629509999995, 9337.278, 7449.81074, 10594.315, 12370.4662, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16108.4531, 17603.3057, 27832.8574, 32569.9043, 24024.8, 31742.4082, 40983.7, 48081.58, 63573.8547, 39537.729999999996, 50714.834989999996, 36176.35, 115418.461, 39319.530999999995, 66083.7977, 77757.72950999999, 73261.7965, 73695.15, 121012.52472999999],
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      userCurrent: false,
      runLatest: true,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01`, `CB02_B`, `CB02_BB`, `CB02_BBB`, `CB03`, `CB04_AA`, `CB04_AAB`, `CB05_BB`, `CB05_BBB`, `CB06_B`, `CB07`, `CB11_AAA`, `CB15`, `CB15R_A`, `CB15R_AA`, `CB15R_AAB`, `CB15_AA`, `CB15_AAA`, `CB15_B`, `CB15_BA`, `CB15_BAA`, `CB17R_ABB`, `CB17_ABB`, `CB19_AB`, `CB19_BA`, `CB19_BAA`, `CB21`, `CB21_A`, `CB21_AB`, `F101_BAA`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 388.619965, 299.879974, 417.860046, 375.94, 424.429962, 739.7897949999999, 857.339874, 753.4499209999999, 1666.9202489999998, 1705.8836930000002, 1831.3002999999999],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1020.81653, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8852.618, 13120.8242, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16714.2246, 12314.877, 26765.5078],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1172.18347, 972.5413, 1153.55, 1742.73059, 1444.95007, 1144.5, 1836.90051, 3863.4],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2333.92017, 4549.7373, null, null, null, null, null, null, null, null, 5429.16455, null, 7783.531],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 27189.2754, 12698.8213, 17133.877, 20265.3555, 22179.2051, 10063.8193, 22122.3184, 20575.584, 16838.2715, 31543.322200000002, 45575.2549],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14977.27, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 49469.8047, 53893.8867, 37248.5742, 58460.625, 64510.2578, 63229.01, 52117.8945, 78048.125],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 12851.7676],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 456.94986, 892.8100430000001, 1718.0262930000001, 1448.1801659999999, 1324.310018, 1486.300091, 2590.2593500000003],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6741.244, 24219.0254, 45851.1641, 59011.61, 41834.13, 35150.02, 98855.9141],
      [null, null, null, null, null, null, null, 209.25, 328.9, 404.799957, 413.349976, null, null, null, null, null, null, null, 766.399841, 952.219666, 600.9799, 837.559753, 848.1231, 781.6398, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, 517.740051, 749.299866, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, 1005.25952, 701.0598, 1009.69452, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, 1635.35059, 100.950005, 985.2002, 676.420166, 1544.57043, 262, 842.6002, 1279.30066, 810.0503, 1239.74939, 3722.14673, 1765.781, 1699.23669, 534.679932, 201.60997, 2275.05151, 3021.84424, 0, 978.2003, 859.499756, 570.299744, 173.88002, 386.8481, 1362.85327, 466.409973, 93.5, 1393.55981],
      [null, null, null, null, null, null, null, null, null, 2140.95142, 1484.60046, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 2286.60181, 4099.53467, 3363.00366, 3599.85376, 3252.83325, 4568.042, 4636.16, 7035.208, 6716.123, 5080.809, 6495.653, 5840.06738, 6930.722, 7330.42773, 3996.6626, 6832.293, 6575.22949, 7308.564, 5066.811, 7306.96338, 6451.64, 8574.115, 5674.208, 9062.509],
      [null, null, null, null, null, null, null, null, null, null, null, 952.099854, 1167.45, 1075.54993, 1033.99988, 1137.95, 1323.80017, 1210.5, 995.3601, 1369.52063, 1444.4, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1734.82068, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3031.40356, 5286.786, 3798.37983, 9644.45665, 13707.16992, 15068.414, 14045.5474, 12870.288349999999, 15372.512999999999, 16332.721000000001, 15883.150000000001, 15217.798999999999, 20508.5766],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3040.25, 3288.25024, 4174.74, 6433.409, 6914.219, 8468.485, 9888.418, 8319.893, 9907.121, 8051.474, 7828.78, 9480.272, 6859.773, 9298.828, 12210.1533, 9873.007, 6738.277, 11862.7285],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3202.68042, 5364.539, 6667.94971, 5110.156, 8546.92, 5978.62646, 6773.313, 11689.010409999999, 13443.801, 12967.53027, 9589.07227, 10138.855, 15026.915680000002, 20066.8435, 14606.167969999999, 12158.60326, 20038.1695],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1117.02344, 1056, 1005.68329, 1103.72],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1292.2, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4708.69971, 4015.784, 4833.585, 2679.09961, 4618.866, 8596.69, 7254.484, 8404.048, 5949.521, 7515.836, 7577.675, 6219.46045, 6304.954, 10323.8232],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7824.792, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9918.001, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 15730.5625, 18084.459, 11479.9395, 16403.9531, 22341.98, 25732.5371, 28897.2227, 27861.29, 25171.5273, 38088.0156, 47896.21],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 89.7],
      [857.499939, 1885.49988, 2402.251, 2625.01028, 4745.928, 3352.73729, 4766.93848, 5583.557680999999, 8696.211, 6167.30029, 4257.5495599999995, 4138.53, 7052.45886, 4043.00063, 6970.900000000001, 7264.521, 11741.262, 9272.991699999999, 20015.072549999997, 17952.36695, 5324.88382, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16683.09205, 8177.6336, 17960.1033, 44295.6555, 4409.420899, 7125.38893, 7488.84615, 3875.57031, 9957.96591, 9740.39727, 26371.984, 14910.1914, 8235.536, 36460.36178],
    ],
  )

  await test(
    {
      auth: true,
      ...PLOT_AGG_OPT,
      userCurrent: true,
      runLatest: false,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02_BA`, `CB04_AA`, `CB04_AAB`, `CB05_B`, `CB05_BBA`, `CB09_B`, `CB09_BBB`, `CB12A`, `CB14`, `CB14_AB`, `CB14_ABA`, `CB15`, `CB15R_AAA`, `CB15_AA`, `CB15_AAA`, `CB15_AAB`, `CB20_AAA`, `CB20_AAB`, `F101_AA`, `F101_BA`, `F102_B`, `F102_BB`, `F102_BBB`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4044, 3980.49976, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 13302.4, 7714.25, 9374.35, 11566.42, 7988.2, 9579, 13903.3623],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1251.88989, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 41111.25, 31528.451, 43723.8488, 48040.975, 55590.1016, 45838.152089999996, 61744.149999999994, 58826.748999999996, 66107.85801, 76868.42871, 102273.704],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 19137.6, 21330, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 38436.799999999996, 25162.799610000002, 34327.04971, 41226.1474, 29376.44822, 31704.098510000003, 59563.99770000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5788.14063],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5783.846],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14325.3213],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 17292.5, 16522.5, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 69120.7],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6424.601, 11001.3574, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 17035.9063, 32149.6035, 39957.793, 25871.5371, 37937.4727, 60204.4649, 53825.2168, 58873.9142, 75739.44140000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8468.79971, 6920.1, 9984.69876, 12838.30029, 17277.700210000003, 39760.038, 20480.58, 18805.30031, 26065.422399999996, 38230.1232, 13590.85139, 26569.1142, 48098.2549, 38737.6078, 27836.154499999997, 62787.5059],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6349.19873, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 10676.1992, 14962.2, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 60494.22, 67061.2656, 67166.03, 49400.4375, 95594.35],
      [67.2000046, 184.00001500000002, 323.150024, 143.75, 465.349945, 212.05, 204.500015, null, null, null, null, null, null, null, null, null, null, null, null, 551.649963, 316.849945, 508.299957, 514.3249, 755.300354, 1126.55, 730.2002, 979.2753, 600.6501, 919.475342, 476.650055, 684.9001, 720.750061, 777.290161, 167.499985, 795.3002],
      [null, null, null, null, null, null, 2636.023, 3439.28369, 4418.01953, 1109.70044, 1939.30054, 3305.22339, 2560.649, 3408.24756, 4687.62549, 5135.37451, 5898.88037, 4873.12451, 5349.27734, 4660.76758, 4163.018, 4116.776, 5114.903, 6079.76758, 7421.81348, 5897.93066, 7085.46533, 7256.9375, 7909.16748, 7780.09, 9811.821, 8137.72852, 8431.584, 7357.421, 7888.654],
      [null, null, null, 992.249634, null, null, null, 501.900055, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1743.99915, 2770.37671, 4485.14941, 2386.92578, 1671.32483, 2561.55371, 4062.05542, 3850.655, 3036.702, 5240.257, 66.7000046, 1443.601, 4475.82666],
      [null, null, null, null, 809.799744, 1165.25012, 1685.37527, 1761.750186, 4581.1007, 1352.300262, 1352.1251668, 2138.900577, 3499.42489, 2322.800804, 3697.32549, 3721.1253399999996, 2736.9747099999995, 2850.2499820000003, 3518.7757149999998, 4366.80127, 2106.4493486, 2692.7762709999997, 3355.175315, 7543.89929, 12676.760462000002, 6064.3765241, 9059.208246, 8645.551095, 16969.322749, 10532.71191, 14286.07697, 16073.425245510001, 7614.14941, 5506.4590180000005, 16407.924561],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4339.89941, 8237.876, 7748.9, 11109.1, 13576.1006, 13908.9277, 10296.4482, 9175.351, 13458.0977, 9365.329, 10638.55, 18021.7539],
      [null, null, null, null, null, null, null, null, null, 3165.5, 2441.89941, 1537.50024, 4646.29932, 2039.35, 3120.79956, 4585.74951, 4378.50049, 4507.59961, 5588.69971, 8246.049, 12133.575, 13479.699219999999, 14570.15, 13030.59951, 33670.7488, 24346.5732, 32137.2276, 28680.399400000002, 39343.378899999996, 28013.1506, 27467.923600000002, 44967.0245, 40347.9492, 41468.2481, 46671.6043],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 341.5501, 51.7499962, 66.7999954, 0, 0, 0, 0, 0, 0, 175.4, 0, 0, 101.25, 0, 0, 0],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 9, 81, 1525.8391023, 97.92, 455.5599847, 948.0343109999999, 6943.183700000001, 412.65807399999994, 2523.4284589999997, 2182.700629, 1008.6356999999999, 558.3901, 2828.609854],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1314.6001, 1061.3, 401.8, 1086.9, 1106.50012, 1398.80017, 2115.50024, 1711.30017, null, null, null, null, null, null, null, null, 1282.90588],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4565.69873],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6255.68555, 5816.63965, 7493.01953, 6524.01465, 9373.523, 7319.602, 6874.36475, 6955.633, 23844.228000000003],
      [2028.3001, 3245.000226, 4312.35088, 4705.9988840000005, 9522.385, 6496.69678, 5761.104339, 6489.0680250000005, 10751.922389, 4375.20254, 8688.78359, 7384.237950999999, 10892.473, 7973.410703, 12056.739982000001, 14097.515863, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 20350.3031, 22260.3307, 40680.035161, 51830.912899999996, 31156.774999999998, 43766.0664, 53950.2029, 73198.1738, 92613.6574, 53197.4773, 68394.21085999999, 59003.6723, 144528.8531, 64289.26849999999, 106242.0946, 114148.25327999999, 89660.3404, 94826.25, 158554.27473],
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      where: {
        ...PLOT_AGG_OPT.where,
        user_id: [tu.TEST_PUB],
        run_num: [12],
      },
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01_ABA`, `CB05_B`, `CB05_BBA`, `CB12A`, `CB14`, `CB14_AB`, `CB14_ABA`, `CB15`, `CB15R_AAA`, `CB15_AA`, `CB15_AAA`, `CB15_AAB`, `CB20_AAA`, `CB20_AAB`, `F101_AA`, `F101_BA`, `F102_B`, `F102_BBB`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 20353.25, 18687.951, 35901.5488, 38269.475, 42509.7016, 38430.25268, 52353.649999999994, 48998.75, 51189.2584, 60815.729999999996, 81941.6988],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 17292.5, 16522.5, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 69120.7],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 15532.8008, 9336.85, 11003.1006, 22016.0977],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6349.19873, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 10676.1992, 14962.2, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 60494.22, 67061.2656, 67166.03, 49400.4375, 95594.35],
      [67.2000046, 126.500015, 265.650024, null, null, null, 204.500015, null, null, null, null, null, null, null, null, null, null, null, null, 551.649963, 316.849945, 508.299957, 514.3249, 755.300354, 1126.55, 730.2002, 979.2753, 600.6501, 919.475342, 476.650055, 684.9001, 720.750061, 777.290161, 167.499985, 795.3002],
      [null, null, null, null, null, null, 2636.023, 3439.28369, 4418.01953, 1109.70044, 1939.30054, 3305.22339, 2560.649, 3408.24756, 4687.62549, 5135.37451, 5898.88037, 4873.12451, 5349.27734, 4660.76758, 4163.018, 4116.776, 5114.903, 6079.76758, 7421.81348, 5897.93066, 7085.46533, 7256.9375, 7909.16748, 7780.09, 9811.821, 8137.72852, 8431.584, 7357.421, 7888.654],
      [null, null, null, 992.249634, null, null, null, 501.900055, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1743.99915, 2770.37671, 4485.14941, 2386.92578, 1671.32483, 2561.55371, 4062.05542, 3850.655, 3036.702, 5240.257, 66.7000046, 1443.601, 4475.82666],
      [null, null, null, null, 809.799744, 1165.25012, 1221.67517, 1022.35004, 3158.62524, 336.699982, 498.5249668, 1582.05054, 1976.9243999999999, 1755.850704, 2446.25005, 2175.9246599999997, 2423.0247099999997, 2439.55, 3269.125736, 2913.40064, 1572.7493976, 1834.6760709999999, 3265.475315, 6887.19919, 12024.080530000001, 6064.3765241, 8773.208399000001, 7841.051034, 12542.431748999998, 9515.65173, 11968.33136, 13240.40546551, 4997.2482899999995, 4428.448768, 13419.638431],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4339.89941, 8237.876, 7748.9, 11109.1, 13576.1006, 13908.9277, 10296.4482, 9175.351, 13458.0977, 9365.329, 10638.55, 18021.7539],
      [null, null, null, null, null, null, null, null, null, 3165.5, 2441.89941, 1537.50024, 4646.29932, 2039.35, 3120.79956, 4585.74951, 4378.50049, 4507.59961, 5588.69971, 8246.049, 12133.575, 13479.699219999999, 14570.15, 13030.59951, 33670.7488, 24346.5732, 32137.2276, 28680.399400000002, 39343.378899999996, 28013.1506, 27467.923600000002, 44967.0245, 40347.9492, 41468.2481, 46671.6043],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 341.5501, 51.7499962, 66.7999954, 0, 0, 0, 0, 0, 0, 175.4, 0, 0, 101.25, 0, 0, 0],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 883.7993, 88.2, 50.3999977, 211.474731, 353.9001, 0, 415.8001, 0, 0, 0, 181.5],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1314.6001, 1061.3, 401.8, 1086.9, 1106.50012, 1398.80017, 2115.50024, 1711.30017, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6255.68555, 5816.63965, 7493.01953, 6524.01465, 9373.523, 7319.602, 6874.36475, 6955.633, 7820.108],
      [1139.3, 1460.999, 2083.84888, 2055.748294, 4398.466, 2581.24756, 954.300339, 1005.4625550000001, 2394.121059, 372.95, 1870.2749, 699.275, 1555.195, 523.599963, 1462.424982, 1727.049663, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4241.85, 4657.025, 12847.177761, 19261.0086, 7131.974999999999, 12023.6582, 12966.5029, 25116.5938, 29039.8027, 13659.747299999999, 17679.37587, 22827.3223, 29110.3921, 24969.7375, 40158.2969, 36390.52377, 16398.5439, 21131.1, 37541.75],
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      where: {
        ...PLOT_AGG_OPT.where,
        user_id: [tu.TEST_PUB],
        run_num: [19],
      },
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02_BA`, `CB04_AA`, `CB04_AAB`, `CB09_B`, `CB09_BBB`, `CB12A`, `CB15`, `CB15_AAB`, `F101_BA`, `F102_B`, `F102_BB`, `F102_BBB`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4044, 3980.49976, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 13302.4, 7714.25, 9374.35, 11566.42, 7988.2, 9579, 13903.3623],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1251.88989, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 20758, 12840.5, 7822.3, 9771.5, 13080.4, 7407.89941, 9390.5, 9827.999, 14918.599610000001, 16052.69871, 20332.0052],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 19137.6, 21330, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 38436.799999999996, 25162.799610000002, 34327.04971, 41226.1474, 29376.44822, 31704.098510000003, 59563.99770000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5788.14063],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5783.846],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14325.3213],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6424.601, 11001.3574, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 17035.9063, 32149.6035, 39957.793, 25871.5371, 37937.4727, 60204.4649, 53825.2168, 58873.9142, 75739.44140000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8468.79971, 6920.1, 9984.69876, 12838.30029, 17277.700210000003, 39760.038, 20480.58, 18805.30031, 26065.422399999996, 38230.1232, 13590.85139, 26569.1142, 32565.454100000003, 29400.7578, 16833.0539, 40771.4082],
      [null, 57.5, 57.5, 143.75, 465.349945, 212.05, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 463.7001, 739.400146, 1422.47546, 1015.60028, 853.6002, 556.850037, 1522.50049, 566.9501, 1251.07544, 1545.20068, 313.95, 410.699982, 249.649979, 1453.40063, 533.699951, 858.1002, 89.7, 656.7001, 652.679932, 0, 285.999847, 804.500061, 4426.891, 1017.06018, 2317.74561, 2833.01978, 2616.90112, 1078.01025, 2988.28613],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 9, 81, 642.0398023, 9.72, 405.159987, 736.55958, 6589.283600000001, 412.65807399999994, 2107.628359, 2182.700629, 1008.6356999999999, 558.3901, 2647.109854],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1282.90588],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4565.69873],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16024.12],
      [889.0001, 1784.0012259999999, 2228.502, 2650.25059, 5123.919, 3915.44922, 4806.804, 5483.60547, 8357.80133, 4002.25254, 6818.50869, 6684.9629509999995, 9337.278, 7449.81074, 10594.315, 12370.4662, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16108.4531, 17603.3057, 27832.8574, 32569.9043, 24024.8, 31742.4082, 40983.7, 48081.58, 63573.8547, 39537.729999999996, 50714.834989999996, 36176.35, 115418.461, 39319.530999999995, 66083.7977, 77757.72950999999, 73261.7965, 73695.15, 121012.52472999999],
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      where: {
        ...PLOT_AGG_OPT.where,
        user_id: [`jqEa1rwdcmZmB4uByt6xoj7r1mi2`],
        run_num: [0],
      },
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01`, `CB01_AA`, `CB01_AAA`, `CB01_ABA`, `CB02`, `CB02_B`, `CB02_BB`, `CB02_BBB`, `CB03R_A`, `CB04`, `CB04_A`, `CB04_AA`, `CB04_AAA`, `CB05_B`, `CB05_BAB`, `CB05_BBB`, `CB07`, `CB15`, `CB15_A`, `CB15_AAA`, `CB15_B`, `CB15_BA`, `CB17`, `CB17_BBB`, `CB19_AB`, `F302`, `F302_B`, `F302_BA`, `F302_BAB`, `HQ03_AB`],
    [
      [null, null, null, null, null, null, null, null, null, 686.199951, 773, 765.2, 999, 1018.9, 912.2999, 657.199951, 1204.4, 991.7999, 965.0999, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3297.1, 3649.2, 3380.77979, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9483.27051, 9981.867, 9577.453, 8224.948, 11577.49, 12038.59, 12211.9492, 17341.6484, 25479.1055, 20749.8828, 19003.9, 23942.6738, 21503.1484],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 10835.7109, 37764.44],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 1112.79932, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 989.550354, 2199.54785, 3781.045, 124.5, 1204.1, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4404.973, 19562.102030000002, 10334.8223, 8439.518, 52442.0755, 26138.8926, null, 13687.3115],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 31825.6035, 38053.34, 26234.5, 52928.3183, 112275.3279, 127071.9532],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3839.85, 4387.5, 4886.95, 5065.45, 3231.15, 3521.4, 4802.34961, 5195.55, 6766.42627, 7829.51855, 6724.81348, 6372.11768, 7601.588, 7225.35742],
      [null, null, null, null, 600.0999, 468, 861.5, 1247.1497239999999, 2006.2493800000002, 1124.9, 1301.8, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 2881.0994899999996, 3399.09861, 3575.69981, 1455.29956, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4685.19812, 7815.595659999999, 1045.49988, 506.200043, 2247.199, 297.6, 0, 1523.25, null, 2263.25, 3322.33, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16233.68, 16801.90742, 20860.011100000003, 14196.80337, 7916.799849999999, 16394.049, 19725.47361, 28937.523800000003, 35745.80422, 22078.15, 37385.262800000004, 50070.9688, 59475.05962, 31718.232799999998, 46843.270539, 88877.90599999999, 61500.55034, 51480.43651, 88743.7744],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 21697.5488, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 35940.67, 26975.5176, 34976.84, 23925.7461, 31472.38],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 21723.65, 26622.5566, 30260.0059, 38511.76, 37337.95, 49612.92, 57067.7148, 55680.9844, 58300.92, 46741.3438, 60670.8633],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4997.9766899999995],
      [121, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 410.560059, 608.43, null, null, null, null, null, null, null, null, null],
      [null, null, null, 507.2999, 621.0999, 793.9999, 894.7498, 663.3501, 1247.99927, 819.9997, 1437.29932, 1457.09912, 2486.80029, 1913.69873, 1939.79932, 1515.99939, 2044.87622, 1981.29883, 2139.499, 1848.59912, 1753.15088, 2607.252, 2667.077, 3026.67773, 3315.193, 1690.19055, 1983.44092, 3105.80273, 2264.429, 4343.76855, 3911.12354, 6360.159, 3799.42749, 5697.73242, 4625.082],
      [null, 894, 1498.201, 1575.30054, 2106.702, 1935.051, 1832.80127, 2117.00122, 2999.55469, 1499.79956, 3380.70386, 3076.20239, 5642.48145, 3059.50244, 3953.605, 3902.00537, 3198.003, 3185.40234, 4536.20654, 3233.60327, 1343.30054, 3663.15259, 2506.42554, 5690.51953, 6165.462, 153.6, 3234.25317, 3842.98413, 3176.788, 3049.45679, 2631.632, 12603.7256, 3409.24756, 11812.9932, 9742.366],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 627.91, 1420.95056, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5348.83447, 6337.30762, 7567.417, 9920.693360000001, 6550.367, 6915.724, 11573.065910000001],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 264.4, 2550.2002, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2312, 9517.09888, 9743.649070000001, 6480.12314, 9062.59887, 14963.44531, 13749.28973, 7065.329, 10356.73936, 11148.02051, 9779.67431, 19365.17725, 16904.48143, 30854.5706, 12189.68505, 27475.6162, 17863.7654],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 713.965942],
      [0, 254, 254, 635.0001, 1449.27, 351.5, 228.7002, null, null, null, 179.599976, 348.2002, 124.199951, 567.6003, 778.400151, 1153.399849, 217.400024, 0, 425.199951, 0, 0, 0, 0, 0, 219, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 0, 490.800049, 554.4001, 0, 0, 0, 0, 0, 430.900024, 1500, 518.5, 0, 520.800049, 0, 422.06897, 0, 0, 163.469727, 0, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, 1144.27, 0, 0, 0, 0, 0, 0, 0, 0, 0, 561.1001, 1440.3, 0, 2761.19775, 91.5, 0, 6000, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 729.224854, 0, 0, 4194.4838899999995, 0, 2139.17969, 4990.74939],
      [704.4999, 566.5, 406.799927, 584.3999, 748.5999, 515.449463, 1262.25, 1514.1991, 1573.79968, 885.599854, 638.6997, 0, 0, 0, 0, 34, 0, 0, 0, 0, 0, 0, 0, 0, 6196.14844, 0, 0, 0, 0, 0, 0, 6700.52246, 0, 57.2714844, 19350.28],
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      where: {
        ...PLOT_AGG_OPT.where,
        user_id: [`jqEa1rwdcmZmB4uByt6xoj7r1mi2`],
        run_num: [2],
      },
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01`, `CB02_B`, `CB02_BB`, `CB02_BBB`, `CB03`, `CB04_AA`, `CB04_AAB`, `CB05_BB`, `CB05_BBB`, `CB06_B`, `CB07`, `CB11_AAA`, `CB15`, `CB15R_A`, `CB15R_AA`, `CB15R_AAB`, `CB15_AA`, `CB15_AAA`, `CB15_B`, `CB15_BA`, `CB15_BAA`, `CB17R_ABB`, `CB17_ABB`, `CB19_AB`, `CB19_BA`, `CB19_BAA`, `CB21`, `CB21_A`, `CB21_AB`, `F101_BAA`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 388.619965, 299.879974, 417.860046, 375.94, 424.429962, 739.7897949999999, 857.339874, 753.4499209999999, 1666.9202489999998, 1705.8836930000002, 1831.3002999999999],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1020.81653, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8852.618, 13120.8242, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16714.2246, 12314.877, 26765.5078],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1172.18347, 972.5413, 1153.55, 1742.73059, 1444.95007, 1144.5, 1836.90051, 3863.4],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2333.92017, 4549.7373, null, null, null, null, null, null, null, null, 5429.16455, null, 7783.531],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 27189.2754, 12698.8213, 17133.877, 20265.3555, 22179.2051, 10063.8193, 22122.3184, 20575.584, 16838.2715, 31543.322200000002, 45575.2549],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14977.27, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 49469.8047, 53893.8867, 37248.5742, 58460.625, 64510.2578, 63229.01, 52117.8945, 78048.125],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 12851.7676],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 456.94986, 892.8100430000001, 1718.0262930000001, 1448.1801659999999, 1324.310018, 1486.300091, 2590.2593500000003],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6741.244, 24219.0254, 45851.1641, 59011.61, 41834.13, 35150.02, 98855.9141],
      [null, null, null, null, null, null, null, 209.25, 328.9, 404.799957, 413.349976, null, null, null, null, null, null, null, 766.399841, 952.219666, 600.9799, 837.559753, 848.1231, 781.6398, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, 517.740051, 749.299866, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, 1005.25952, 701.0598, 1009.69452, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, 1635.35059, 100.950005, 985.2002, 676.420166, 1544.57043, 262, 842.6002, 1279.30066, 810.0503, 1239.74939, 3722.14673, 1765.781, 1699.23669, 534.679932, 201.60997, 2275.05151, 3021.84424, 0, 978.2003, 859.499756, 570.299744, 173.88002, 386.8481, 1362.85327, 466.409973, 93.5, 1393.55981],
      [null, null, null, null, null, null, null, null, null, 2140.95142, 1484.60046, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 2286.60181, 4099.53467, 3363.00366, 3599.85376, 3252.83325, 4568.042, 4636.16, 7035.208, 6716.123, 5080.809, 6495.653, 5840.06738, 6930.722, 7330.42773, 3996.6626, 6832.293, 6575.22949, 7308.564, 5066.811, 7306.96338, 6451.64, 8574.115, 5674.208, 9062.509],
      [null, null, null, null, null, null, null, null, null, null, null, 952.099854, 1167.45, 1075.54993, 1033.99988, 1137.95, 1323.80017, 1210.5, 995.3601, 1369.52063, 1444.4, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1734.82068, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3031.40356, 5286.786, 3798.37983, 9644.45665, 13707.16992, 15068.414, 14045.5474, 12870.288349999999, 15372.512999999999, 16332.721000000001, 15883.150000000001, 15217.798999999999, 20508.5766],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3040.25, 3288.25024, 4174.74, 6433.409, 6914.219, 8468.485, 9888.418, 8319.893, 9907.121, 8051.474, 7828.78, 9480.272, 6859.773, 9298.828, 12210.1533, 9873.007, 6738.277, 11862.7285],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3202.68042, 5364.539, 6667.94971, 5110.156, 8546.92, 5978.62646, 6773.313, 11689.010409999999, 13443.801, 12967.53027, 9589.07227, 10138.855, 15026.915680000002, 20066.8435, 14606.167969999999, 12158.60326, 20038.1695],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1117.02344, 1056, 1005.68329, 1103.72],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1292.2, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4708.69971, 4015.784, 4833.585, 2679.09961, 4618.866, 8596.69, 7254.484, 8404.048, 5949.521, 7515.836, 7577.675, 6219.46045, 6304.954, 10323.8232],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7824.792, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9918.001, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 15730.5625, 18084.459, 11479.9395, 16403.9531, 22341.98, 25732.5371, 28897.2227, 27861.29, 25171.5273, 38088.0156, 47896.21],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 89.7],
      [857.499939, 1885.49988, 2402.251, 2625.01028, 4745.928, 3352.73729, 4766.93848, 5583.557680999999, 8696.211, 6167.30029, 4257.5495599999995, 4138.53, 7052.45886, 4043.00063, 6970.900000000001, 7264.521, 11741.262, 9272.991699999999, 20015.072549999997, 17952.36695, 5324.88382, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 16683.09205, 8177.6336, 17960.1033, 44295.6555, 4409.420899, 7125.38893, 7488.84615, 3875.57031, 9957.96591, 9740.39727, 26371.984, 14910.1914, 8235.536, 36460.36178],
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      where: {
        ...PLOT_AGG_OPT.where,
        user_id: [tu.TEST_PUB],
        run_num: [12],
        round_num: [5]
      },
    },
    [5],
    [`CB15_AAB`, `HQ01_AA`],
    [[809.799744], [4398.466]],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      Z: `user_id`,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [tu.TEST_PUB, `jqEa1rwdcmZmB4uByt6xoj7r1mi2`],
    [
      [2095.5001045999998, 3429.0002409999997, 4635.500904, 5841.998518, 10797.534689, 7873.996899999999, 10287.002623999999, 12192.001956, 19751.042619, 10002.703242, 14422.108706800002, 14365.862158, 21598.846209999996, 15743.809067, 23562.490522, 27539.765223000002, 33364.65867, 34491.30480199999, 56451.38802600001, 79527.83052300001, 57250.3172898, 75702.0166034, 93202.555675, 126475.517034, 244745.18289429997, 154190.6348341, 239893.71311069996, 265005.238056, 438446.20092100004, 271740.038179, 424049.5347389999, 500584.28062551, 444640.2034556001, 439706.58562300005, 790217.1500450002],
      [1682.999839, 3599.9998800000003, 4561.251927, 6444.750770999999, 11020.999566, 8421.997173, 10547.99955, 12835.002394, 20186.734709999997, 13830.500737, 14851.803052, 16581.45303, 26515.594261000002, 18878.9555, 26602.855915, 29512.80513, 42905.513594000004, 43130.659623, 76142.43372100001, 72126.394886, 53372.03743, 84781.333715, 98202.134664, 140515.92131700003, 234798.45622399997, 145147.55198299998, 202894.56584599998, 275076.4197760001, 315365.17213, 354480.928928, 483818.13774599985, 628536.874357, 530110.82603, 560573.1181483999, 898900.8979919999],
    ],
  )

  /*
  This is where DB calculations diverge from purely-JS client calculations.
  Due to float imprecision, we have differences in the range of 10^-14.
  This makes testing unreliable.

  TODO: round to 10^-10 to compare server and client results automatically.
  */
  await test(
    {
      ...PLOT_AGG_OPT,
      Y: s.STAT_TYPE_COST_EFF,
      agg: `avg`,
      userCurrent: false,
      runLatest: false,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01`, `CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_AA`, `CB01_AAA`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02`, `CB02_B`, `CB02_BA`, `CB02_BB`, `CB02_BBB`, `CB03`, `CB03R_A`, `CB04`, `CB04_A`, `CB04_AA`, `CB04_AAA`, `CB04_AAB`, `CB05_B`, `CB05_BAB`, `CB05_BB`, `CB05_BBA`, `CB05_BBB`, `CB06_B`, `CB07`, `CB09_B`, `CB09_BBB`, `CB11_AAA`, `CB12A`, `CB14`, `CB14_AB`, `CB14_ABA`, `CB15`, `CB15R_A`, `CB15R_AA`, `CB15R_AAA`, `CB15R_AAB`, `CB15_A`, `CB15_AA`, `CB15_AAA`, `CB15_AAB`, `CB15_B`, `CB15_BA`, `CB15_BAA`, `CB17`, `CB17R_ABB`, `CB17_ABB`, `CB17_BBB`, `CB19_AB`, `CB19_BA`, `CB19_BAA`, `CB20_AAA`, `CB20_AAB`, `CB21`, `CB21_A`, `CB21_AB`, `F101_AA`, `F101_BA`, `F101_BAA`, `F102_B`, `F102_BB`, `F102_BBB`, `F302`, `F302_B`, `F302_BA`, `F302_BAB`, `HQ01_AA`, `HQ01_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, 3.430999755, 3.865, 3.826, 4.995, 5.0945, 4.5614995, 3.285999755, 6.022, 4.9589995, 4.8254995, null, null, null, null, null, 1.943099825, 1.49939987, 2.08930023, 1.8797, 2.12214981, 1.8494744874999998, 2.143349685, 1.8836248025, 2.778200415, 2.8431394883333336, 3.0521671666666665],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 6.629508196721312, 6.525409442622951, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 10.993719008264463, 6.375413223140496, 7.747396694214876, 9.55902479338843, 6.601818181818182, 7.916528925619835, 11.490382066115703],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4.038354483870967, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7.167608695652174, 7.933043478260869, 7.349521282608696, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8.946481613207547, 9.416855660377358, 9.035333018867924, 7.759384905660378, 10.922160377358491, 11.357160377358491, 11.52070679245283, 16.360045660377356, 24.036891981132076, 19.57536113207547, 17.928207547169812, 22.587428113207547, 20.28598905660377],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 11.325413223140496, 6.5141427685950415, 7.227082446280991, 7.9406570247933885, 9.188446545454546, 7.57655406446281, 10.205644628099174, 9.72342958677686, 9.105765566115702, 9.060345001033058, 12.859333700642791],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7.655040000000001, 8.532, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7.844244897959183, 5.135265226530612, 7.005520348979592, 8.413499469387755, 5.995193514285714, 6.470224185714286, 12.155917897959183],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 1.9353031652173915, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1.2768391664516128, 2.838126258064516, 4.878767741935484, 0.16064516129032258, 1.5536774193548386, null, null, 1.3171826193548386, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5.384316865116279],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2.796808253968254, 6.210191120634921, 6.5617919365079365, 5.489566984126984, 13.875745968253968, 16.596122285714284, null, 8.690356507936508],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 13.688431612903226, 16.367027956989247, 11.283655913978494, 9.984593964157707, 13.396796225806451, 16.54166247311828],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2.232730419047619, 1.852459619047619, 2.197238095238095, 3.319486838095238, 2.752285847619048, 2.18, 3.498858114285714, 7.358857142857143],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5.688666666666666, 6.5, 7.239925925925926, 7.50437037037037, 4.786888888888889, 5.216888888888889, 7.114592014814815, 7.697111111111111, 10.024335214814815, 11.599286740740741, 9.962686637037036, 9.440174340740741, 11.261611851851852, 10.704233214814815],
      [null, null, null, null, 2.0003330000000004, 1.56, 2.8716666666666666, 2.078582873333333, 3.343748966666667, 1.8748333333333336, 2.1696666666666666, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 3.001145302083333, 3.54072771875, 2.4831248680555555, 3.0318740833333333, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.003332128205128, 3.339998145299145, 1.3403844615384617, 0.6489744141025641, 2.881024358974359, 0.38153846153846155, 0, 1.9528846153846153, 2.992205346153846, 4.367299551282051, 4.259397435897436, 0, null, null, null, null, null, null, 6.960467371794873, null, 8.69703653846154],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 5.8817681159420285, 6.0876476159420285, 7.557975036231885, 5.143769336956522, 2.868405742753623, 5.939872826086956, 4.764607152173913, 6.989740048309179, 8.63425222705314, 3.9996648550724636, 5.418154028985507, 7.256662144927536, 8.619573857971014, 4.596845333333333, 6.788879788260869, 12.880855942028983, 8.913123237681159, 7.460932827536231, 12.861416579710143],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9.78031489208633, 4.567921330935252, 6.163265107913669, 7.289696223021584, 7.978131330935252, 3.620078884892086, 7.957668489208634, 7.401289208633093, 6.056932194244604, 5.673259388489209, 7.1823232853717025],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 14.465032533333334, null, null, 11.528333333333334, 11.015, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 13.562516981132076, 10.179440603773585, 13.19880754716981, 9.028583433962265, 11.876369811320755],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9.360793750000001, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 23.430745762711865],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9.051520833333335, 11.092731916666667, 12.608335791666667, 18.329492645833334, 19.00663264583333, 18.096144625, 24.068404125, 25.039842125, 25.31873541666667, 20.595674645833334, 28.899789229166664],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9.179834],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8.308179272727273, 8.116454936363636, 10.412280563636363, 8.77684949090909, 8.026121321212122, 9.00787933939394, 22.994654666666666],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4.758963703703704, 8.14915362962963, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2.8393177166666663, 5.35826725, 6.6596321666666665, 4.31192285, 6.322912116666666, 5.017038741666666, 4.485434733333333, 4.906159516666667, 6.311620116666667],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1.6645046913580246, 5.980006271604938, 11.321275086419753, 14.570767901234568, 10.329414814814815, 8.679017283950616, 24.408867679012346],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7.48643725152824, 5.5277910299003326, 7.369027823920265, 7.621649127209302, 13.00367934152824, 28.987123670431895, 13.505279003322258, 11.53784774986711, 19.840833699003323, 23.120209833887046, 8.076739592657807, 18.421260872093022, 17.358240713178294, 14.360012323145071, 8.781288928017718, 20.96734581749723],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.174599365, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2.178816163265306, 3.0535102040816327, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 7.201692857142858, 7.983484, 7.995955952380952, 5.881004464285715, 11.380279761904763],
      [0.4705000115, 0.4600000375, 0.80787506, 0.71875, 2.326749725, 1.0602500000000001, 1.022500075, 1.04625, 1.6444999999999999, 2.023999785, 2.06674988, null, null, null, null, null, null, null, 3.8319992050000002, 3.7596740724999993, 2.2945746125, 3.364649275, 3.4061200000000005, 3.842350385, 3.8427751475, 3.3465755, 4.8963765, 3.0032504999999996, 4.59737671, 2.383250275, 3.4245004999999997, 3.6037503049999997, 3.886450805, 0.837499925, 3.9765010000000003],
      [null, null, null, 1.4792572885714286, 2.1408567599999997, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, 2.0515500408163265, 1.4307342857142857, 2.0606010612244896, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 3.234384049079755, 4.219979987730062, 5.420882858895705, 1.3615956319018405, 2.3795098650306747, 4.05548882208589, 3.1419006134969325, 4.181898846625766, 5.751687717791412, 6.3010730184049075, 7.237890024539877, 5.979293877300613, 6.563530478527607, 5.718733226993865, 5.10799754601227, 5.051258895705521, 6.275954601226994, 7.459837521472393, 9.106519607361962, 7.236724736196319, 8.693822490797546, 8.904217791411043, 9.704499975460124, 9.546122699386503, 12.03904417177914, 9.984942969325154, 10.3455018404908, 9.027510429447853, 9.679330061349694],
      [null, null, null, null, null, null, null, null, 1.9468459404761904, 0.12017857738095239, 1.172857380952381, 0.8052621023809524, 1.8387743214285714, 0.3119047619047619, 1.0030954761904762, 1.5229769761904763, 0.9643455952380953, 1.475892130952381, 4.431127059523809, 2.102120238095238, 2.0229008214285713, 0.6365237285714286, 0.24001186904761906, 2.7083946547619044, 3.597433619047619, 0, 1.1645241666666666, 1.0232139952380952, 0.6789282666666667, 0.20700002380952381, 0.4605334523809524, 1.6224443690476191, 0.5552499678571429, 0.1113095238095238, 1.6589997738095237],
      [null, null, null, 1.4494282857142857, 1.774571142857143, 2.268571142857143, 2.556428, 1.895286, 3.5657122, 2.3428562857142854, 4.106569485714286, 4.163140342857143, 7.105143685714286, 5.467710657142858, 5.542283771428572, 4.331426828571429, 5.842503485714286, 5.6608538, 6.112854285714286, 5.281711771428571, 5.009002514285714, 7.449291428571429, 7.620220000000001, 8.647650657142856, 9.47198, 4.829115857142857, 5.666974057142857, 8.873722085714286, 6.469797142857143, 12.410767285714286, 11.174638685714285, 18.171882857142855, 10.855507114285714, 16.27923548571429, 13.21452],
      [null, null, null, 2.0249992530612246, null, null, null, 1.0242858265306123, null, 4.3692886122448975, 3.0297968571428573, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, 1.0969325153374234, 1.8382834355828221, 1.9328840981595092, 2.584910429447853, 2.3742957055214724, 2.2488359141104293, 2.597547509202454, 3.6804352024539875, 1.8402448588957054, 4.148102895705522, 3.290063926380368, 5.97669700613497, 3.9401877914110432, 4.6340237791411045, 4.38947154601227, 4.764444785276074, 4.798504503067484, 7.099027325153374, 6.104126546012269, 3.9411714969325153, 6.232396067484663, 4.1269906216768915, 6.295140384458077, 7.354208237218814, 2.6736966789366057, 4.800765235173824, 5.3086982944785275, 5.949859885480573, 4.894446948875255, 5.30687009406953, 9.936859959100204, 4.928450946666667, 7.742659386503068, 9.52175937014315],
      [null, null, null, null, 0.9640473142857143, 1.3872025238095238, 1.0031995654761905, 1.048660825, 1.8178971031746032, 0.5366270880952381, 0.5365576058730158, 0.8487700702380953, 1.3886606706349205, 0.9217463507936507, 1.467192654761905, 1.4766370396825395, 1.0861010753968252, 1.1310515801587302, 1.3963395694444445, 1.732857646825397, 0.8358925986507937, 1.0685620123015873, 0.7988512654761906, 1.4968054146825398, 2.1559116431972787, 1.031356551717687, 1.3480964651785712, 1.2865403415178573, 2.5251968376488096, 1.56736784375, 2.125904311011905, 2.3918787567723214, 1.1330579479166665, 0.8194135443452382, 2.441655440625],
      [null, null, null, null, null, null, null, null, null, null, null, 2.441281676923077, 2.9934615384615384, 2.757820333333333, 2.651281743589744, 2.917820512820513, 3.3943594102564103, 3.103846153846154, 2.5522053846153847, 3.511591358974359, 3.703589743589744, null, null, null, null, null, 1.610025641025641, 3.6434629743589744, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.273246566037736, null, null, null, null, null, null, 10.092140509433962, 11.957184188679244, 14.278145283018869, 9.359144679245283, 6.179591509433963, 6.524267924528302, 10.91798670754717],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.545501239766082, 6.183375438596491, 2.221274754385965, 5.640033128654971, 8.015888842105264, 8.811938011695908, 8.213770409356725, 7.526484415204679, 8.989773684210526, 9.551298830409358, 9.288391812865498, 8.899297660818712, 11.993319649122807],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.6609999999999999, 6.3755005, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2.96609756097561, 3.2080490146341463, 4.072917073170731, 6.276496585365853, 6.745579512195122, 8.261936585365854, 9.647237073170732, 8.116968780487804, 9.665483902439023, 7.855096585365854, 7.637834146341463, 9.249045853658538, 6.692461463414634, 9.07202731707317, 11.912344682926829, 9.632201951219512, 6.573928780487805, 11.573393658536585],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.1245662634146343, 5.233696585365854, 6.505316790243902, 4.985518048780488, 8.338458536585366, 5.832806302439025, 6.6081102439024395, 5.701956297560976, 6.557951707317073, 6.3256245219512195, 4.677596229268293, 4.945782926829268, 7.330202770731708, 9.788704146341463, 7.124959985365853, 5.931025980487805, 9.774716829268293],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2.223076923076923, 4.5755283076923075, 4.6844466682692305, 3.1154438173076926, 4.3570186875, 7.193964091346153, 6.610235447115384, 3.3967927884615383, 4.979201615384616, 5.359625245192308, 4.701766495192308, 9.310181370192307, 8.127154533653846, 14.833928173076924, 5.860425504807692, 13.209430865384615, 8.588348750000002],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4.964548622222222, 4.693333333333333, 4.469703511111112, 4.039302093333333],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4.698909090909091, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 8.484143621621621, 7.235646846846847, 8.709162162162162, 4.827206504504505, 8.322281081081082, 15.489531531531533, 13.071142342342343, 15.14242882882883, 10.719857657657657, 13.542046846846848, 13.65346846846847, 11.206235045045045, 11.360277477477476, 18.601483243243244],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3.4443646111111113, 6.537996825396825, 6.149920634920635, 8.816746031746032, 10.774683015873016, 11.038831507936509, 8.171784285714287, 7.282024603174603, 10.68102992063492, 7.432800793650793, 8.44329365079365, 14.302979285714285],
      [null, null, null, null, null, null, null, null, null, 4.458450704225352, 3.439294943661972, 2.165493295774648, 6.544083549295775, 2.872323943661972, 4.395492338028169, 6.458802126760563, 6.1669020985915495, 6.348731845070422, 7.871408042253521, 11.614153521126761, 8.544771126760562, 9.492745929577463, 10.260669014084506, 9.176478528169014, 23.711794929577465, 17.145474084507043, 22.631850422535212, 20.197464366197185, 27.70660485915493, 19.727570845070424, 19.343608169014082, 31.666918661971827, 28.414048732394367, 29.20299161971831, 32.867326971830984],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9.205637647058824, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 9.918001, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 12.58445, 14.4675672, 9.1839516, 13.12316248, 17.873584, 20.58602968, 23.11777816, 22.289032000000002, 20.137221840000002, 30.47041248, 38.316968],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.3795001111111111, 0.05749999577777778, 0.07422221711111111, 0, 0, 0, 0, 0, 0, 0.1948888888888889, 0, 0, 0.1125, 0, 0, 0],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 0.010588235294117647, 0.09529411764705882, 0.5983682754117646, 0.0288, 0.13398823079411765, 0.278833620882353, 1.6336902823529413, 0.0970960174117647, 0.49478989392156864, 0.42798051549019606, 0.19777170588235293, 0.10948825490196079, 0.5546293831372548],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.078],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 10.5168008, 8.4904, 3.2144, 8.695200000000002, 8.85200096, 11.19040136, 16.92400192, 13.69040136, null, null, null, null, null, null, null, null, 10.26324704],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 29.456120838709676],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 32.924660789473684, 30.613892894736843, 39.43694489473684, 34.33691921052632, 49.33433157894736, 38.52422105263158, 36.180867105263154, 36.60859473684211, 41.83197894736842],
      [0, 0.8466666666666667, 0.8466666666666667, 2.116667, 4.8309, 1.1716666666666666, 1.524668, null, null, null, 1.1973331733333332, 1.1606673333333333, 0.4139998366666667, 1.8920009999999998, 2.59466717, 3.844666163333333, 1.4493334933333333, 0, 2.83466634, 0, 0, 0, 0, 0, 1.46, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 0, 0.6632433094594594, 1.4983786486486486, 0, 0, 0, 0, 0, 1.1645946594594594, 4.054054054054054, 0.7006756756756757, 0, 0.7037838499999999, 0, 1.140726945945946, 0, 0, 0.441810072972973, 0, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, 1.8455967741935484, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9050001612903226, 1.161532258064516, 0, 2.226772379032258, 0.07379032258064516, 0, 4.838709677419355, 0, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0.18794455000000002, 0, 0, 1.081052548969072, 0, 0.5513349716494845, 1.2862756159793816],
      [1.0125614171929824, 1.8001754757894737, 2.3560006596491228, 2.572283917192983, 5.006425614035088, 3.455941778947368, 3.694050111929825, 4.2360090196491225, 6.823906452280702, 3.6991238, 4.542573035087719, 4.043076474035087, 6.296467319298245, 4.216284678245613, 6.676364905964912, 7.495451530877193, 12.359223157894737, 9.76104389473684, 21.06849742105263, 18.897228368421054, 5.605140863157895, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4.153123081632653, 4.542924632653062, 8.302047992040817, 10.577737326530613, 6.358525510204082, 8.224375299319728, 8.452766870748299, 12.402486680272107, 18.627117401360547, 7.83767322435374, 10.274775481632654, 9.046601149659864, 20.191078014965985, 10.101664545578231, 15.779930866666668, 19.11839962993197, 14.227283238095238, 14.022011700680272, 26.53260360680272]
    ],
  )

  // See the comment above. Same TODO.
  await test(
    {
      ...PLOT_AGG_OPT,
      Z: `user_id`,
      Y: s.STAT_TYPE_COST_EFF,
      agg: `avg`,
      userCurrent: false,
      runLatest: false,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [tu.TEST_PUB, `jqEa1rwdcmZmB4uByt6xoj7r1mi2`],
    [
      [0.8236842532807017, 1.0839474466447367, 1.5387667089473682, 1.5394864577701397, 2.6628720394360905, 1.8572161426566418, 1.7610862302677486, 2.0245979121876148, 2.774048401184018, 1.337267106478627, 1.841618401753931, 1.8377971535843374, 2.8130808030365606, 2.023613971173714, 2.7240063264315824, 3.202927664631835, 2.2699401375079282, 2.255184520741214, 3.518834924092007, 3.9048865983792016, 2.8070526524459147, 3.557755750657271, 3.5491055714674014, 4.50334353869469, 7.205047732635083, 4.168411671453873, 5.02464238941159, 5.324408183016756, 7.122461256507336, 4.441538638633777, 5.984207547974679, 6.326291213933746, 5.2195916555386335, 4.942670543749012, 8.67922510681381],
      [0.3769078786842105, 0.955000512892046, 1.0100503386790083, 1.317563598692744, 2.315818501651552, 1.2842679427178816, 1.422742076858068, 1.4585204672236358, 2.3094517703765525, 1.5230705989379856, 1.6710220071747752, 1.6942102563431272, 2.4566038652206017, 1.9474462145374638, 2.4082349927567503, 2.644600641671128, 2.845575092513836, 2.125375487193024, 3.1698546280022337, 2.8459807926699217, 2.087517398457525, 2.7802021443237925, 2.8415648396535587, 3.7473718939563554, 4.464736177781212, 2.723597874321343, 3.624282809071053, 4.371242770426403, 4.614453896770635, 4.715237965242365, 5.8909622654965945, 7.302912092539255, 5.769780797737013, 6.006026312163216, 9.368752712105248]
    ],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      agg: `count`,
      where: {
        ...PLOT_AGG_OPT.where,
        bui_type_upg: [`CB04`],
      },
      userCurrent: false,
      runLatest: false,
    },
    [5, 6, 7, 8, 9, 10, 11],
    [`CB04`],
    [[1, 1, 1, 2, 2, 2, 2]],
  )

  await test(
    {
      ...PLOT_AGG_OPT,
      agg: `count`,
      userCurrent: false,
      runLatest: false,
    },
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    [`CB01`, `CB01R_AB`, `CB01R_ABA`, `CB01_A`, `CB01_AA`, `CB01_AAA`, `CB01_ABA`, `CB01_BB`, `CB01_BBA`, `CB02`, `CB02_B`, `CB02_BA`, `CB02_BB`, `CB02_BBB`, `CB03`, `CB03R_A`, `CB04`, `CB04_A`, `CB04_AA`, `CB04_AAA`, `CB04_AAB`, `CB05_B`, `CB05_BAB`, `CB05_BB`, `CB05_BBA`, `CB05_BBB`, `CB06_B`, `CB07`, `CB09_B`, `CB09_BBB`, `CB11_AAA`, `CB12A`, `CB12_B`, `CB12_BB`, `CB14`, `CB14_AB`, `CB14_ABA`, `CB15`, `CB15R_A`, `CB15R_AA`, `CB15R_AAA`, `CB15R_AAB`, `CB15_A`, `CB15_AA`, `CB15_AAA`, `CB15_AAB`, `CB15_B`, `CB15_BA`, `CB15_BAA`, `CB17`, `CB17R_ABB`, `CB17_ABB`, `CB17_BBB`, `CB19_AB`, `CB19_BA`, `CB19_BAA`, `CB20_AAA`, `CB20_AAB`, `CB21`, `CB21_A`, `CB21_AB`, `F101_AA`, `F101_BA`, `F101_BAA`, `F102_B`, `F102_BB`, `F102_BBB`, `F106_A`, `F106_AA`, `F106_AAA`, `F302`, `F302_B`, `F302_BA`, `F302_BAB`, `HQ01_AA`, `HQ01_AAA`, `HQ03_AB`, `SB01_B`, `SB01_BB`, `SB01_BBA`, `SB01_BBB`, `SB06`, `SB07A`, `SB07_AA`, `SB07_AAA`],
    [
      [null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, null, null, null, null, null, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3, 4, 5, 5, 5, 5, 5, 5, 6, 8, 9],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, 4, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, 4, 4, 4, 4, 4, 4],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, null, null, 1, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 2, 1, 2, 3, 1, null, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 3, 4, 4],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, 1, 1, 1, 2, 2, 2, 2, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 2, 2, 3, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2, 3, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, null, null, null, null, null, null, 1, null, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, 1, 1, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 2, 3, 3, 3, 3, 6],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1],
      [2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, null, null, null, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, 1, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, 1, null, null, null, 1, null, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      [null, null, null, null, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      [null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, null, null, null, null, null, 1, 1, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, 1, 1, 1, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 3, 4, 4, 4, 5, 5, 6, 6, 6, 6, 6],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, null, null, null, null, null, null, null, null, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 3],
      [null, null, 1, 1, 1, 1, 1, 1, 2, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, 1, 2, 1, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      [1, 2, 2, 2, 2, 2, 1, null, null, null, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, 1, null, 1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3],
      [null, null, null, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 5, 8, 8, 9, 9, 10, 10, 11, 11, 15, 15, 17, 19, 20, 21, 22, 24, 24],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  )
})

function _bigIntsToNums(src) {
  if (a.isArr(src)) return a.map(src, _bigIntsToNums)
  if (a.isBigInt(src)) return Number(src)
  return src
}

function _numsToBigInts(src) {
  if (a.isArr(src)) return a.map(src, _numsToBigInts)
  if (a.isNum(src)) return BigInt(src)
  return src
}

async function loadFixtureFromRounds(conn, src) {
  const dat = datFromRounds(src)
  await db.insertBatch(conn, `facts`, dat.facts)
}

function datFromRounds(src) {
  const dat = a.Emp()

  for (const round of src) {
    a.reqObj(round)
    const user_id = a.reqValidStr(round.tabularius_user_id)
    const run_num = a.reqInt(round.tabularius_run_num)
    const run_ms = a.reqInt(round.tabularius_run_ms)

    s.datAddRound({
      dat, round, user_id, run_num, run_ms,
      composite: u.SCHEMA_FACTS_COMPOSITE,
      tables: {facts: true},
    })
  }
  return dat
}
