import * as a from '@mitranim/js/all.mjs'
import {apiDbOpt} from './api/api_db.mjs'
import {apiUploadRoundOpt} from './api/api_upload_round.mjs'
import {apiDownloadFileOpt} from './api/api_download_file.mjs'
import {apiDownloadRoundOpt} from './api/api_download_round.mjs'
import {apiPlotAggOpt} from './api/api_plot_agg.mjs'
import {apiLsOpt} from './api/api_ls.mjs'
import {apiLatestRunOpt} from './api/api_latest_run.mjs'

export function apiRes(ctx, rou) {
  a.reqInst(rou, a.ReqRou)
  return (
    apiDbOpt(ctx, rou) ||
    apiUploadRoundOpt(ctx, rou) ||
    apiDownloadFileOpt(ctx, rou) ||
    apiDownloadRoundOpt(ctx, rou) ||
    apiPlotAggOpt(ctx, rou) ||
    apiLsOpt(ctx, rou) ||
    apiLatestRunOpt(ctx, rou) ||
    rou.notFound()
  )
}
