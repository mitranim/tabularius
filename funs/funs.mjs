/*
https://firebase.google.com/docs/functions
https://firebase.google.com/docs/functions/firestore-events
https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https
https://firebase.google.com/docs/reference/node/firebase.functions.HttpsError
https://firebase.google.com/docs/reference/admin/node/firebase-admin.firestore
*/

import * as faa from 'firebase-admin/app'
import * as faf from 'firebase-admin/firestore'
import * as ffh from 'firebase-functions/v2/https'
import * as fff from 'firebase-functions/v2/firestore'
// import * as log from 'firebase-functions/logger'
import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as uf from './util_fb.mjs'
import * as s from './schema.mjs'

const app = faa.initializeApp()
const db = faf.getFirestore(app)

export const onRound = fff.onDocumentCreated(`${s.COLL_ROUND_SNAPS}/{roundId}`, async function onRound(eve) {
  const snap = eve.data
  if (!snap) return

  const round = snap.data()
  if (!round) return

  if (round?.tabularius_derivedSchemaVersion) {
    // log.debug(`already derived data from ${snap.ref.path}, skipping`)
    return
  }

  const batch = uf.roundBatch(db, snap.ref, round)
  await batch.commit()

  // const count = a.len(await batch.commit())
  // log.debug(`derived ${count - 1} documents from ${snap.ref.path}`)
})

/*
TODO:
- Load and process data in controlled batches.
- Prefer latest data.
- Hard limits:
  - Total documents.
  - Time elapsed.
*/
export const plotAgg = ffh.onCall(async function plotAgg(req) {
  const src = req.data
  let opt
  try {opt = s.validPlotAggOpt(src)}
  catch (err) {throw new ffh.HttpsError(`invalid-argument`, err, src)}

  if (opt.runLatest) {
    opt.where.runId ??= []
    opt.where.runId.push(...await uf.latestRunIds(db, opt.Z, opt.where.userId))
  }

  if (opt.userCurrent) {
    const id = req.auth?.uid
    if (!id) return []
    u.dictPush(opt.where, `userId`, id)
  }

  opt.where.schemaVersion = [s.SCHEMA_VERSION]
  const query = uf.queryWhere(db.collection(s.COLL_FACTS), opt.where)
  const state = new s.PlotAggState()

  for await (const [_ref, fact] of uf.streamDocuments(query)) {
    s.plotAggAddFact({fact, state, opt})
  }
  return s.plotAggWithTotals({...s.plotAggCompact(state), agg: opt.agg})
})
