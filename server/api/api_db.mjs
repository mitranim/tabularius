import * as u from '../util.mjs'

/*
Usage:

  make duck_attach_prod
  make duck_attach_dev
  make db_dump_prod out_path=<some_path>

Usage in DuckDB SQL:

  attach 'https://tabularius.mitranim.com/api/db' as db;
  select * from db.facts limit 1;

Unqualified usage:

  attach 'https://tabularius.mitranim.com/api/db' as db;
  use db;
  select * from facts limit 1;

Note that the download may take a while.
*/
export async function apiDb(ctx) {
  const path = ctx.dbFile
  if (path === `:memory:`) throw Error(`unable to serve memory DB file`)

  /*
  Merge the `.wal` file into the `.duckdb` file, allowing the client
  to observe the current state of the database.
  */
  try {await (await ctx.conn()).run(`checkpoint`)}
  catch (err) {console.error(`[api_db] unable to checkpoint:`, err)}

  const file = await u.HttpFile.resolve({fsPath: path, urlPath: ``})
  if (!file) throw Error(`internal: missing DB file`)
  return file.response()
}
