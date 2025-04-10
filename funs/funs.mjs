/*
https://firebase.google.com/docs/functions
https://firebase.google.com/docs/functions/firestore-events
https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https
https://firebase.google.com/docs/reference/node/firebase.functions.HttpsError
*/

import * as faa from 'firebase-admin/app'
import * as faf from 'firebase-admin/firestore'
import * as ffh from 'firebase-functions/v2/https'
import * as fff from 'firebase-functions/v2/firestore'
import * as log from 'firebase-functions/logger'
import * as a from '@mitranim/js/all.mjs'
import * as u from './util.mjs'
import * as s from './schema.mjs'

const app = faa.initializeApp()
const db = faf.getFirestore(app)

/*
For ordering. Firestore actually has its own timestamps, but hides them.
We could define this trigger for all collections generically, via
`/{path=**}/{docId}`, but that would incur considerable overhead for facts,
which is by far the largest table. Instead, we do this on a case-by-case basis.
For facts, we define `.createdAt` directly before creating, which is reliable
because unlike the other collections, we `.create` them rather than `.set`.

We don't need this for round snapshots because first, we never query them,
and second, they have their own timestamp field (as an ISO string).
*/
export const setCreatedAt_runs         = fff.onDocumentCreated(`/${a.reqValidStr(s.COLL_RUNS)}/{docId}`, setCreatedAt)
export const setCreatedAt_runRounds    = fff.onDocumentCreated(`/${a.reqValidStr(s.COLL_RUN_ROUNDS)}/{docId}`, setCreatedAt)
export const setCreatedAt_runBuis      = fff.onDocumentCreated(`/${a.reqValidStr(s.COLL_RUN_BUIS)}/{docId}`, setCreatedAt)
export const setCreatedAt_runRoundBuis = fff.onDocumentCreated(`/${a.reqValidStr(s.COLL_RUN_ROUND_BUIS)}/{docId}`, setCreatedAt)

async function setCreatedAt(eve) {
  const ref = eve.data.ref
  // log.debug(`adding "createdAt" to ${ref.path}`)
  await ref.update({createdAt: faf.FieldValue.serverTimestamp()}, {merge: true})
}

export const onRound = fff.onDocumentWritten(`${s.COLL_ROUND_SNAPS}/{roundId}`, async function onRound(eve) {
  const {before, after} = eve.data
  const prev = before.data()
  const next = after.data()

  if (prev?.tabularius_derivedSchemaVersion || next?.tabularius_derivedSchemaVersion) {
    // log.debug(`already derived data from ${eve.document}, skipping`)
    return
  }

  const round = after.data() || before.data()
  if (!round) return

  // log.debug(`deriving data from ${eve.document}`)

  const userId = round.tabularius_userId
  if (!userId) {
    log.error(`invalid round data: missing ".tabularius_userId" in ${after.ref.path}`)
    return
  }
  const runId = round.tabularius_runId
  if (!runId) {
    log.error(`invalid round data: missing ".tabularius_runId" in ${after.ref.path}`)
    return
  }
  const runNum = round.tabularius_runNum
  if (!a.isInt(runNum)) {
    log.error(`invalid round data: missing or invalid ".tabularius_runNum" in ${after.ref.path} ${a.show(runNum)}`)
    return
  }

  const dat = a.Emp()
  s.datAddRound({dat, round, runId, runNum, userId})

  /*
  Batching allows atomic writes. It has a limit of several hundred operations
  according to bots. We don't expect more than a few tens here.
  */
  const batch = db.batch()
  const {facts, ...dims} = dat
  let count = 0

  for (const val of facts) {
    count++
    const ref = db.collection(s.COLL_FACTS).doc()
    val.factId = a.reqValidStr(ref.id)
    val.createdAt = faf.FieldValue.serverTimestamp()
    batch.create(ref, val, {merge: true})
  }

  for (const coll in dims) {
    for (const [key, val] of a.entries(a.reqMap(dims[coll]))) {
      count++
      const ref = db.collection(coll).doc(a.reqValidStr(key))
      // log.debug(`adding ${coll}/${ref.id} to the batch`)
      batch.set(ref, val, {merge: true})
    }
  }

  await batch.commit()
  // log.debug(`derived ${count} documents from ${eve.document}`)

  await after.ref.update(
    {tabularius_derivedSchemaVersion: s.SCHEMA_VERSION},
    {merge: true},
  )
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
    where.runId.push(...await latestRunIds(req.data.where))
  }

  if (userCurrent) {
    const id = req.auth?.uid
    if (!id) return []
    u.dictPush(where, `userId`, id)
  }

  const query = queryCollWhere(s.COLL_FACTS, where)
  const snap = await query.get()
  const facts = a.map(snap.docs, docData)
  return s.plotAggFromFacts({facts, Z_key, X_key, agg})
})

async function latestRunIds(where) {
  const {userId, runId: _, ...rest} = a.laxDict(where)
  const userIds = u.compactSet(userId)

  if (!userIds.size) {
    const query = queryLatest(queryCollWhere(s.COLL_RUNS, rest))
    const snap = await query.get()
    return a.map(snap.docs, docId)
  }

  const out = []
  for (const id of userIds) {
    const query = queryCollWhere(s.COLL_RUNS, rest).where(`userId`, `==`, id)
    const snap = await query.get()
    out.push(...a.map(snap.docs, docId))
  }
  return out
}

function queryCollWhere(name, where) {
  return queryWhere(db.collection(name), where)
}

function queryWhere(query, where) {
  for (const val of a.mapCompact(a.entries(where), whereOr)) {
    query = query.where(val)
  }
  return query
}

function queryLatest(query) {
  return query.orderBy(`createdAt`, `desc`).limit(1)
}

function whereOr([key, val]) {
  const out = []
  for (val of val) out.push(faf.Filter.where(key, `==`, val))
  return out.length ? faf.Filter.or(...out) : undefined
}

function docData(src) {return src.data()}
function docId(src) {return a.reqValidStr(src.id)}
