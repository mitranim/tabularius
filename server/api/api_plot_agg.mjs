import * as a from '@mitranim/js/all.mjs'
import * as s from '../../shared/schema.mjs'
import * as u from '../util.mjs'

export async function apiPlotAgg(ctx, req) {
  const data = await plotAgg(ctx, req)
  return new u.Res(a.jsonEncode(data))
}

/*
Note on query building. We have to interpolate some client inputs raw, because
we allow clients to specify grouping and aggregation. We verify those against a
hardcoded whitelist, mostly for UX reasons; this should also prevent any danger
of SQL injection. For other inputs, we use SQL parameters / arguments.
*/
export async function plotAgg(ctx, req) {
  const opt = s.validPlotAggOpt(await u.reqResBodyJson(req))
  const Z = u.reqIdent(opt.Z)
  const X = u.reqIdent(opt.X)

  // SYNC[plot_user_current].
  if (opt.userCurrent) {
    const id = u.reqAuthReq(req)
    if (!id) {
      // SYNC[plot_user_current_err_msg].
      throw new u.ErrHttp(`filtering cloud data by current user requires authentication`, {status: 401})
    }
    opt.where.user_id = u.uniqArr(a.append(opt.where.user_id, id))
  }

  const [runLatestCte, runLatestJoin] = qLatestRunId(opt)
  const where = u.SqlWhere.fromDict(opt.where)
  const aggMode = opt.mode ?? req.headers.get(`plot_agg_mode`) ?? `db`

  const queryFacts = u.sql`
    with
      ${runLatestCte}
      _ as (select null)
    select *
    from
      facts
      ${runLatestJoin}
    ${where}
  `

  const queryAggs = u.sql`
    with src as (${queryFacts})
    select
      ${u.sqlRaw(Z)} as Z,
      ${u.sqlRaw(X)} as X,
      ${u.sqlRaw(opt.agg)}(stat_val) as Y
    from src
    group by
      ${u.sqlRaw(Z)},
      ${u.sqlRaw(X)}
  `

  const conn = await ctx.conn()

  /*
  Running the queries sequentially vs concurrently seems to take the same
  resulting total time.
  */
  const out = await queryPlotAgg(conn, queryAggs, aggMode)
  const totals = await queryPlotTotals(conn, queryFacts, opt)

  // Not faster.
  //
  // const [out, totals] = await Promise.all([
  //   queryPlotAgg(conn, queryAggs, aggMode),
  //   queryPlotTotals(conn, queryFacts, opt.totals),
  // ])

  out.totals = totals
  return out
}

let PLOT_AGG_TIMER_ID = 0

async function queryPlotAgg(conn, queryAggs, aggMode) {
  /*
  Option 0. Group and aggregate in DB, re-group to plot data in JS.
  Needs measurements.

  At the time of writing, on a local system with an in-RAM DuckDB, it seems
  faster to run just this query, and then iterate the resulting triplets in JS,
  building the `{X_vals, Z_vals, Z_X_Y}` that our plotting code needs. However,
  the difference is more proportional than absolute; single digit milliseconds
  and only tested in-RAM on a small dataset. Both approaches need production
  testing.
  */
  if (aggMode === `js`) {
    const id = ++PLOT_AGG_TIMER_ID
    if (u.LOG_DEBUG) console.time(`[plot_agg_${id}] [mode=js]`)
    const {text, args} = queryAggs
    const rows = await conn.queryRows(text, args)
    try {
      return tripletsToPlotAgg(rows)
    }
    finally {
      if (u.LOG_DEBUG) console.timeEnd(`[plot_agg_${id}] [mode=js]`)
    }
  }

  /*
  Option 1. Group, aggregate, re-group to plot data in DB.
  Needs measurements.
  */
  if (aggMode === `db`) {
    const query = u.sql`
      with
        incomplete_groups as (${queryAggs}),
        X_vals as (select distinct X from incomplete_groups order by X),
        Z_vals as (select distinct Z from incomplete_groups order by Z),
        Z_X as (select Z, X from Z_vals cross join X_vals),
        complete_groups as (
          select *
          from
            Z_X
            left join incomplete_groups using (Z, X)
        ),
        X_Y_arr as (
          select
            Z,
            array_agg(Y order by X) as Y_arr
          from
            complete_groups
          group by Z
        ),
        Z_X_Y_arr as (
          select array_agg(Y_arr order by Z)
          from X_Y_arr
        )
      select
        (select array_agg(X order by X) from X_vals) as X_vals,
        (select array_agg(Z order by Z) from Z_vals) as Z_vals,
        (table Z_X_Y_arr)                            as Z_X_Y
    `

    const id = ++PLOT_AGG_TIMER_ID
    if (u.LOG_DEBUG) console.time(`[plot_agg_${id}] [mode=db]`)
    try {
      const {text, args} = query
      let [X_vals, Z_vals, Z_X_Y] = await conn.queryRow(text, args)
      X_vals = a.laxArr(X_vals)
      Z_vals = a.laxArr(Z_vals)
      Z_X_Y = a.laxArr(Z_X_Y)

      s.dropEmptySeries(Z_vals, Z_X_Y)
      return {X_vals, Z_vals, Z_X_Y}
    }
    finally {
      if (u.LOG_DEBUG) console.timeEnd(`[plot_agg_${id}] [mode=db]`)
    }
  }

  throw Error(`unrecognized plot agg mode ${a.show(aggMode)}`)
}

let PLOT_TOTAL_TIMER_ID = 0

async function queryPlotTotals(conn, queryFacts, opt) {
  const query = qPlotAggTotals(queryFacts, opt)
  if (!query) return undefined

  const id = ++PLOT_TOTAL_TIMER_ID
  if (u.LOG_DEBUG) console.time(`[plot_stats_${id}]`)
  try {
    const {text, args} = query
    return await conn.queryDoc(text, args)
  }
  finally {
    if (u.LOG_DEBUG) console.timeEnd(`[plot_stats_${id}]`)
  }
}

export function tripletsToPlotAgg(src) {
  const state = a.Emp()
  s.plotAggStateInit(state)
  const {Z_X_Y, X_set} = state

  // SYNC[plot_agg_add_data_point].
  for (const [Z, X, Y] of src) {
    const X_Y = Z_X_Y[Z] ??= a.Emp()

    // Our DB query must produce unique aggregations for each Z_X_Y.
    if (X in X_Y) throw Error(`redundant Z = ${Z}, X = ${X}`)

    /*
    The `[Y]` wrapping makes the result compatible with `plotAggStateToPlotAgg`,
    which is shared with client-side code. A minor inefficiency, which
    shouldn't matter because the dataset is small at this point. Makes it
    easier to produce consistent results.
    */
    X_Y[X] = [Y]
    X_set.add(X)
  }

  // This also calls `s.dropEmptySeries`.
  return s.plotAggStateToPlotAgg(state)
}

/*
How this should work:

- When no `runLatest`, then nothing done.
- When the `user_id` filter is provided, get the latest run for each
  specific `user_id`.
- Otherwise get just one latest run overall.

TODO: needs performance measurements.
*/
function qLatestRunId(opt) {
  if (!opt.runLatest) return [u.sqlRaw(), u.sqlRaw()]

  // SYNC[plot_run_latest_by_user_id].
  if (a.vac(opt.where.user_id)) {
    /*
    The filter should actually be:

      where user_id = any(${opt.where.user_id}::text[])

    But the clown library complains:

      Cannot create values of type ANY. Specify a specific type.

    Despite us specifying the type `text[]`.
    Same result when using `cast(? as text[])`.
    So as a workaround, we splurge the ids.
    */
    return [
      u.sql`
        latest_runs as (
          select user_id, max(run_ms) as run_ms
          from facts
          ${u.SqlWhere.fromDict({user_id: opt.where.user_id})}
          group by user_id
        ),
      `,
      u.sql`inner join latest_runs using (user_id, run_ms)`,
    ]
  }

  // SYNC[plot_run_latest_by_user_id_no_user_filter].
  // SYNC[plot_compare_run_desc].
  // SYNC[latest_run].
  return [
    u.sql`latest_runs as (
      select user_id, run_id, run_num
      from facts
      order by run_ms desc, run_num desc
      limit 1
    ),`,
    u.sql`inner join latest_runs using (run_id)`
  ]
}

const TOTAL_VAL_LIMIT = 4

const TOTAL_VAL_LIMITS = u.dict({
  user_id: TOTAL_VAL_LIMIT,
  run_id: TOTAL_VAL_LIMIT,
  round_id: TOTAL_VAL_LIMIT,
  bui_inst: TOTAL_VAL_LIMIT,
})

export function qPlotAggTotals(facts, opt) {
  a.reqInst(facts, u.Sql)

  let keys = opt?.totals
  if (!a.optArr(keys)) return undefined
  if (!keys.length) keys = s.defaultTotalKeys(opt)

  const counts = []
  const values = []

  /*
  Interpolation is an anti-pattern, but SQL injection should be impossible
  because `s.validPlotAggOpt` ensures stat keys are safe.
  */
  for (const key of keys) {
    counts.push(/*sql*/`${key} := count(distinct ${key})`)

    const limit = TOTAL_VAL_LIMITS[key]

    if (limit) {
      values.push(/*sql*/`${key} := min(distinct ${key}, ${limit})`)
    }
    else {
      values.push(/*sql*/`${key} := array_agg(distinct ${key} order by ${key})`)
    }
  }

  const countFields = counts.join(`, `)
  const valueFields = values.join(`, `)

  return u.sql`
    with
      src as (${facts})
    select
      struct_pack(${u.sqlRaw(countFields)}) as counts,
      struct_pack(${u.sqlRaw(valueFields)}) as values
    from
      src
  `
}
