import * as u from '../util.mjs'

/*
Usage in DuckDB SQL:

  attach 'https://tabularius.mitranim.com/api/db' as db;
  select * from db.facts limit 1;

  attach 'https://tabularius.mitranim.com/api/db' as db;
  use db;
  select * from facts limit 1;

Note that the download may take a while.
*/
export function apiDbOpt(ctx, rou) {
  return rou.get(`/api/db`) && apiDb(ctx)
}

export async function apiDb(ctx) {
  const path = ctx.dbFile
  if (path === `:memory:`) throw Error(`unable to serve memory DB file`)

  /*
  Merge the `.wal` file into the `.duckdb` file, allowing the client
  to observe the current state of the database.
  */
  try {await (await ctx.conn()).run(`checkpoint`)}
  catch (err) {console.error(`[api_db] unable to checkpoint:`, err)}

  return u.HttpFileStream.res(path)
}
