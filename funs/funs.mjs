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
  let inp
  try {inp = s.validPlotAggOpt(req.data)}
  catch (err) {throw new ffh.HttpsError(`invalid-argument`, err, inp)}
  const {X: X_key, Z: Z_key, where, runLatest, userCurrent, agg} = inp

  if (runLatest) {
    where.runId ??= []
    where.runId.push(...await uf.latestRunIds(db, Z_key, where.userId))
  }

  if (userCurrent) {
    const id = req.auth?.uid
    if (!id) return []
    u.dictPush(where, `userId`, id)
  }

  where.schemaVersion = [s.SCHEMA_VERSION]

  const query = uf.queryWhere(db.collection(s.COLL_FACTS), where)
  const snap = await query.get()
  const facts = a.map(snap.docs, uf.docData)
  return s.plotAggFromFacts({facts, Z_key, X_key, agg})
})
