import * as a from '@mitranim/js/all.mjs'
import * as pt from '@mitranim/js/path.mjs'
import * as s from '../../shared/schema.mjs'
import * as u from '../util.mjs'
import * as adf from './api_download_file.mjs'

export function apiDownloadRoundOpt(ctx, rou) {
  return (
    // Tentative path. May revise later.
    rou.get(/^[/]api[/]download_round(?:[/](?<path>.*))?$/) &&
    apiDownloadRound(ctx, rou)
  )
}

let TIMER_ID = 0

export async function apiDownloadRound(ctx, rou) {
  const id = ++TIMER_ID
  console.time(`[download_round_${id}]`)

  try {
    const path = a.laxStr(rou.groups?.path)
    return await downloadRound(ctx, path)
  }
  finally {
    console.timeEnd(`[download_round_${id}]`)
  }
}

export async function downloadRound(ctx, path) {
  path = a.laxStr(path)

  const where = a.Emp()
  {
    const [userId, runName, roundName] = u.paths.splitRel(path)
    if (userId) where.user_id = [userId]
    if (runName) where.run_num = [u.toNatReq(runName)]
    if (roundName) where.round_num = [u.toNatReq(roundName)]
  }

  // SYNC[latest_run].
  const {text, args} = u.sql`
    select user_id, run_ms, run_num, round_num
    from facts
    ${u.SqlWhere.fromDict(where)}
    order by run_ms desc, run_num desc, round_num desc
    limit 1
  `

  const conn = await ctx.conn()
  const row = await conn.queryDoc(text, args)

  // TODO better error message.
  if (!row) {
    throw new u.ErrHttp(`unable to find round ${a.show(path)}`, {status: 404})
  }

  const {user_id, run_ms, run_num, round_num} = row
  const runName = s.makeRunName(run_num, run_ms)
  const roundName = s.makeRoundFileNameBase(round_num) + u.GAME_FILE_EXT_REAL
  const filePath = pt.join(user_id, runName, roundName)
  return adf.resolveUserFile(ctx, path, filePath)
}
