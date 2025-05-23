/*
DuckDB docs:

  https://duckdb.org/docs/stable/index
*/

import * as a from '@mitranim/js/all.mjs'
import * as io from '@mitranim/js/io_deno.mjs'
import * as s from '../shared/schema.mjs'
import * as u from './util.mjs'
import * as ud from './util_db.mjs'

export async function migrate(ctx) {
  const version = await dbGetSchemaVersion(await ctx.conn())
  if (version >= s.DATA_SCHEMA_VERSION) {
    console.log(`[mig] DB schema already up to date`)
    return
  }

  console.log(`[mig] target schema version: ${s.DATA_SCHEMA_VERSION}, schema version in DB: ${version}, migrating`)

  const conn = await ctx.connect()
  await conn.run(`begin`)
  try {
    console.log(`[mig] dropping existing tables and re-creating schema`)
    await dropTables(conn)
    await initSchema(conn)

    console.log(`[mig] initing DB data from rounds`)
    await initDataFromRounds(ctx, conn)

    await conn.run(`commit`)
    console.log(`[mig] committed DB migration`)
  }
  catch (err) {
    await conn.run(`rollback`)
    throw err
  }
  finally {conn.closeSync()}

  {
    const version = await dbGetSchemaVersion(await ctx.conn())
    if (version !== s.DATA_SCHEMA_VERSION) {
      throw Error(`internal: unexpected DB schema version after migration: ${a.show(version)}`)
    }
  }
}

/*
A simplified special case. We currently create only a few tables in the main
schema, nothing else. If our app's schema gets more complicated, with not just
tables but types / functions / triggers / etc., we may choose to allocate a
dedicated schema / namespace, and simply drop it when migrating.
*/
async function dropTables(conn) {
  for (const name of await conn.queryScalars(ud.Q_TABLE_NAMES)) {
    await conn.run(`drop table ${a.reqValidStr(name)} cascade`)
  }
}

export async function initSchema(conn) {
  const sql = await Deno.readTextFile(new URL(`schema.sql`, import.meta.url))
  await conn.run(sql)
  dbSetSchemaVersion(conn)
}

async function dbGetSchemaVersion(conn) {
  const exists = await conn.queryScalar(/*sql*/`
    select exists(
      select table_name
      from information_schema.tables
      where table_name = 'schema_version'
    ) as exists
  `)
  if (!exists) return undefined
  return conn.queryScalar(`select val from schema_version`)
}

async function dbSetSchemaVersion(conn) {
  const {text, args} = u.sql`
    insert into schema_version (val) values (${s.DATA_SCHEMA_VERSION})
    on conflict do update set val = excluded.val
  `
  await conn.run(text, args)
}

/*
TODO add internal sanity checks:

  `round.tabularius_user_id === user_id`
  `round.tabularius_run_num === run_num`
  `round.tabularius_run_ms === run_ms`

If there's a mismatch, log it without throwing.
*/
export async function initDataFromRounds(ctx, conn) {
  const rootDirPath = a.reqValidStr(ctx.userRunsDir)

  if (!await io.FileInfo.statOpt(rootDirPath)) {
    console.log(`[mig] runs dir not found, no rounds loaded`)
    return
  }

  const BATCH_SIZE = 262_144 // 2 ** 18
  let dat

  for await (const {name: user_id, isDirectory} of Deno.readDir(rootDirPath)) {
    if (!isDirectory) continue
    const userDir = io.paths.join(rootDirPath, user_id)

    for (const runName of await u.readRunDirs(userDir)) {
      const runDir = io.paths.join(userDir, runName)
      const [run_num, run_ms] = s.splitRunName(runName)

      for (const roundName of await u.readRoundFiles(runDir)) {
        const roundFile = io.paths.join(runDir, roundName)
        const round = await u.readDecodeGameFile(roundFile, roundName)

        dat ??= a.Emp()

        s.datAddRound({
          dat, round, user_id, run_num, run_ms,
          composite: ud.SCHEMA_FACTS_COMPOSITE,
          tables: {facts: true},
        })

        const len = a.len(dat.facts)
        if (!(len >= BATCH_SIZE)) continue

        console.log(`[mig] batch-inserting ${len} facts`)
        await insertBatch(conn, `facts`, dat.facts)
        dat = undefined
      }
    }
  }

  const len = a.len(dat?.facts)
  if (len) {
    console.log(`[mig] batch-inserting ${len} facts`)
    await insertBatch(conn, `facts`, dat.facts)
  }
}

/*
Performance notes.

We insert docs in somewhat large batches: hundreds per round upload, many more
when migrating schema and re-creating facts.

We've compared the following:
- Building a huge SQL insert query with repeating value lists, with values
  inlined.
- Using prepared statements, one insert per statement invocation.
- Using prepared statements with batched inserts, a repeating value list per
  prepared statement, fixed batch size.
- Using the DuckDB Appender API via the FFI, with and without intermediary
  flushing at a certain batch size.
- Dumping data to a JSON file and telling DuckDB to read it.

Prepared statements were particularly horrifyingly slow. The `.bind` step was
the bottleneck, with inexcusable delays.

Dumping to a JSON file and telling the DB to load it was the only approach that
wasn't horrifyingly slow. The FFI bindings and/or the SQL queries seem to come
with insane overheads, and loading in bulk is the only viable solution. We
don't love having to dump files to disk and having to clean them up, but the
alternatives are worse.

DuckDB prefers newline-separated JSON, but also supports top-level-array JSON.
The newline-separated version seems to perform significantly better, to the
point where it's worth a bit of encoding overhead, given that the JS JSON
encoders don't properly support it.
*/
export async function insertBatch(conn, coll, src) {
  a.reqInst(conn, ud.DuckConn)
  u.reqIdent(coll)
  a.optArr(src)
  if (!src?.length) return

  await Deno.mkdir(u.TMP_DIR, {recursive: true})
  const path = await Deno.makeTempFile({dir: u.TMP_DIR, suffix: `.json`})
  try {
    await Deno.writeTextFile(path, u.jsonLines(src))
    await conn.run(`copy ${coll} from ${ud.sqlStr(path)}`)
  }
  finally {await Deno.remove(path)}
}
