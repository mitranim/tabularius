import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as hd from '@mitranim/js/http_deno.mjs'
import * as u from './util.mjs'
import * as s from '../shared/schema.mjs'
import * as db from './db.mjs'

export function apiRes(ctx, rou) {
  a.reqInst(rou, a.ReqRou)
  return (
    rou.get(`/api/db`) && apiDb(ctx) ||
    rou.post(`/api/upload_round`) && apiUploadRound(ctx, rou.req) ||
    rou.post(`/api/plot_agg`) && apiPlotAgg(ctx, rou.req) ||
    (
      rou.method(a.GET) &&
      rou.pre(`/api/ls`) &&
      apiLs(ctx, pt.posix.relTo(rou.url.pathname, `/api/ls`))
    ) ||
    (
      rou.get(/^[/]api[/]latest_run(?:[/](?<user>\w+))?$/) &&
      apiLatestRun(ctx, rou.groups?.user)
    ) ||
    rou.notFound()
  )
}

/*
Usage in DuckDB SQL:

  attach 'https://tabularius.mitranim.com/api/db' as db;
  select * from db.facts limit 1;

  attach 'https://tabularius.mitranim.com/api/db' as db;
  use db;
  select * from facts limit 1;

Note that the download may take a while.

Note that the `.duckdb` file may be heavily outdated if a lot of recent data is
currently in the `.wal` file, which we're not bothering to expose.
*/
export function apiDb(ctx) {
  const path = ctx.dbFile
  if (path === `:memory:`) throw Error(`unable to serve memory DB file`)
  return hd.HttpFileStream.res(path)
}

let UPLOAD_TIMER_ID = 0

export async function apiUploadRound(ctx, req) {
  const id = ++UPLOAD_TIMER_ID
  console.time(`[upload_${id}]`)
  try {return new u.Res(a.jsonEncode(await uploadRound(ctx, req)))}
  finally {console.timeEnd(`[upload_${id}]`)}
}

export async function uploadRound(ctx, req) {
  const reqUserId = u.reqAuth(req)
  if (!reqUserId) {
    throw new u.ErrHttp(`round upload requires authentication`, {status: 401})
  }

  const round = await u.reqBodyJson(req)
  if (!a.isDict(round)) {
    throw new u.ErrHttp(`round upload: request body must be a JSON object`, {status: 400})
  }

  const gameVer = round.Version
  if (gameVer !== 1) {
    throw new u.ErrHttp(`round upload: game schema version mismatch: only schema version 1 is supported, got schema version ${a.show(gameVer)}`, {status: 400})
  }

  const tabVer = round.tabularius_fields_schema_version
  if (tabVer !== s.ROUND_FIELDS_SCHEMA_VERSION) {
    throw new u.ErrHttp(`round upload: Tabularius schema version mismatch: expected schema version ${s.ROUND_FIELDS_SCHEMA_VERSION}, got schema version ${tabVer}; suggestion: update your client by reloading the page`, {status: 400})
  }

  const user_id = round.tabularius_user_id
  if (!user_id) {
    throw new u.ErrHttp(`round upload: missing user id`, {status: 400})
  }
  if (user_id !== reqUserId) {
    throw new u.ErrHttp(`round upload: user id mismatch: required ${a.show(reqUserId)}, got ${a.show(user_id)}`, {status: 400})
  }

  const round_num = round.RoundIndex

  /*
  Legacy behavior which should no longer happen. Our client, when walking files
  and uploading, should ignore round files with zero round num. That's because
  rounds before 1 have no useful statistics to tell. Meaning, the game has to
  save the final state of round 0, and advance to round 1, for our watcher to
  detect that change and upload the resulting data with the `round_num` 1, not
  0. We're one round behind, but it works out perfectly.
  */
  if (!a.isIntPos(round_num)) {
    throw new u.ErrHttp(`round upload: round number must be a positive integer, got ${a.show(round_num)}`, {status: 400})
  }

  const run_num = round.tabularius_run_num
  if (!a.isNat(run_num)) {
    throw new u.ErrHttp(`round upload: run number must be a natural integer, got ${a.show(run_num)}`, {status: 400})
  }

  const run_ms = round.tabularius_run_ms
  if (!a.isNat(run_ms)) {
    throw new u.ErrHttp(`round upload: run timestamp must be a natural integer, got ${a.show(run_ms)}`, {status: 400})
  }

  const runName = s.makeRunName(run_num, run_ms)
  const outDir = io.paths.join(ctx.userRunsDir, user_id, runName)
  const outPath = io.paths.join(outDir, u.intPadded(round_num) + u.GAME_FILE_EXT_REAL)
  const info = await io.FileInfo.statOpt(outPath)

  if (info) {
    const round_id = s.makeRoundId(user_id, run_num, run_ms, round_num)
    if (!info.isFile) {
      throw new u.ErrHttp(`round upload: internal error: existing round ${a.show(round_id)} is not a file`, {status: 400})
    }
    return {redundant: true}
  }

  const dat = a.Emp()
  s.datAddRound({
    dat, round, user_id, run_num, run_ms,
    composite: u.SCHEMA_FACTS_COMPOSITE,
    tables: {facts: true},
  })

  const factCount = a.len(dat.facts)
  if (!factCount) return {factCount}

  // Prepare everything we can before inserting and writing.
  const outBin = await u.data_to_json_to_gzipByteArr(round)
  await Deno.mkdir(outDir, {recursive: true})

  const conn = await ctx.conn()
  await db.insertBatch(conn, `facts`, dat.facts)
  await Deno.writeFile(outPath, outBin)
  return {factCount}
}

export async function apiPlotAgg(ctx, req) {
  const data = await plotAgg(ctx, req)
  return new u.Res(a.jsonEncode(data, jsonReplacer))
}

/*
Note on query building. We have to interpolate some client inputs raw, because
we allow clients to specify grouping and aggregation. We verify those against a
hardcoded whitelist, mostly for UX reasons; this should also prevent any danger
of SQL injection. For other inputs, we use SQL parameters / arguments.
*/
export async function plotAgg(ctx, req) {
  const opt = s.validPlotAggOpt(await u.reqBodyJson(req))
  const Z = u.reqIdent(opt.Z)
  const X = u.reqIdent(opt.X)

  // SYNC[plot_user_current].
  if (opt.userCurrent) {
    const id = u.reqAuth(req)
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

  /*
  The cast to `double` is redundant for most stats, but necessary for `count`
  which otherwise produces a JS `BigInt` which is not JSON-serializable.
  */
  const queryAggs = u.sql`
    with src as (${queryFacts})
    select
      ${u.sqlRaw(Z)} as Z,
      ${u.sqlRaw(X)} as X,
      ${u.sqlRaw(opt.agg)}(stat_val)::double as Y
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
  return [
    u.sql`
      latest_runs as (
        select run_id
        from facts
        order by run_ms desc, time_ms desc, run_num desc
        limit 1
      ),
    `,
    u.sql`inner join latest_runs using (run_id)`
  ]
}

const TOTAL_VAL_LIMIT = 4

const TOTAL_VAL_LIMITS = new Map()
  .set(`user_id`, TOTAL_VAL_LIMIT)
  .set(`run_id`, TOTAL_VAL_LIMIT)
  .set(`round_id`, TOTAL_VAL_LIMIT)
  .set(`bui_inst`, TOTAL_VAL_LIMIT)

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
    counts.push(/*sql*/`${key} := count(distinct ${key})::double`)

    const limit = TOTAL_VAL_LIMITS.get(key)

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

let LS_TIMER_ID = 0

/*
If invoked at the root (empty path), this leaks the name of `ctx.userRunsDir`.
That's fine.

Missing feature: converting `/` to `\` on Windows. Not necessary.
*/
export async function apiLs(ctx, path) {
  const id = ++LS_TIMER_ID
  console.time(`[ls_${id}]`)
  try {
    path = u.gameFilePathFakeToReal(path)
    path = io.paths.join(ctx.userRunsDir, path)
    return new u.Res(a.jsonEncode(await apiLsEntry(path)))
  }
  finally {console.timeEnd(`[ls_${id}]`)}
}

/*
The format `{kind, name}` aligns with the browser File System API, which is
utilized by our client code. The additional `entries` are non-standard.
*/
async function apiLsEntry(path) {
  const info = await io.FileInfo.statOpt(path)
  if (!info) return undefined
  const name = pt.posix.base(path)
  if (info.isFile()) {
    return {kind: `file`, name: u.gameFilePathRealToFake(name)}
  }
  return {kind: `directory`, name, entries: await apiLsEntries(path)}
}

async function apiLsEntries(path) {
  const out = []
  for await (const {name, isFile} of Deno.readDir(path)) {
    out.push(
      isFile
      ? {kind: `file`, name: u.gameFilePathRealToFake(name)}
      : {kind: `directory`, name}
    )
  }
  return out.sort(compareLsEntriesAsc)
}

function compareLsEntriesAsc(one, two) {return u.compareAsc(one.name, two.name)}

/*
We want to treat SQL `bigint` (`int64`) as JS number (`float64`) because we care
more about actually showing data to client than about minor rounding errors.
We could define a DB value converter, but this is much terser and easier.
*/
function jsonReplacer(_, val) {
  if (a.isBigInt(val)) return Number(val)
  return val
}

async function apiLatestRun(ctx, userId) {
  a.optStr(userId)
  const conn = await ctx.conn()
  const where = userId ? u.sql`where user_id = ${userId}` : u.sqlRaw()
  const {text, args} = u.sql`
    select
      user_id,
      run_id,
      run_num,
      run_ms
    from facts
    ${where}
    order by run_ms desc, time_ms desc, run_num desc
    limit 1
  `

  /*
  `reader.getRowObjectsJS()` parses `bigint` into JS `BigInt`.
  But our millisecond timestamps always fit into JS floats.
  TODO solve this in a general way. Maybe just use floats for timestamps.
  */
  const out = await conn.queryDoc(text, args)
  if (out) out.run_ms = Number(out.run_ms)

  return new u.Res(a.jsonEncode(out))
}
