import * as a from '@mitranim/js/all.mjs'
import * as u from '../util.mjs'

export async function apiLatestRun(ctx, userId) {
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
    order by run_ms desc, round_ms desc, run_num desc
    limit 1
  `

  /*
  `reader.getRowObjectsJS()` parses `bigint` into JS `BigInt`.
  But our millisecond timestamps always fit into JS floats.
  TODO solve this in a general way. Maybe just use floats for timestamps.
  */
  const out = await conn.queryDoc(text, args)
  if (out) out.run_ms = Number(out.run_ms)
  return u.jsonRes(out)
}
