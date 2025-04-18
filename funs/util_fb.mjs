/*
Shared code for Firebase cloud functions and migrations.
*/

import * as faa from 'firebase-admin/app'
import * as faf from 'firebase-admin/firestore'
import * as log from 'firebase-functions/logger'
import * as a from '@mitranim/js/all.mjs'
import * as fs from 'fs/promises'
import * as u from './util.mjs'
import * as s from './schema.mjs'

export const EMULATE = a.boolOpt(process.env.FIREBASE_EMULATE)
export const DRY_RUN = a.boolOpt(process.env.DRY_RUN)
export const BATCH_SIZE_MAX = 500

export function getDb() {
  return EMULATE ? dbEmulated() : dbReal()
}

export async function dbEmulated() {
  if (!EMULATE) return undefined
  const projectId = a.reqValidStr((await readFbOpts()).projectId)
  const port = a.reqKey((await readFbCliOpts()).emulators.firestore.port)

  return new faf.Firestore({
    projectId,
    host: `localhost:${port}`,
    ssl: false,
  })
}

// Requires env var `GOOGLE_APPLICATION_CREDENTIALS`,
// which must be the path to a
export function dbReal() {
  if (EMULATE) return undefined
  return faf.getFirestore(faa.initializeApp())
}

export async function readFbCliOpts() {
  const src = await fs.readFile(new URL(`../firebase.json`, import.meta.url), {encoding: `utf-8`})
  return JSON.parse(src)
}

export async function readFbOpts() {
  const src = await fs.readFile(new URL(`../firebase/firebase.json`, import.meta.url), {encoding: `utf-8`})
  return JSON.parse(src)
}

export function roundBatch(db, roundRef, round) {
  // log.debug(`deriving data from ${roundRef.path}`)

  const userId = round.tabularius_userId
  if (!userId) {
    log.error(`invalid round data: missing ".tabularius_userId" in ${roundRef.path}`)
    return
  }
  const runId = round.tabularius_runId
  if (!runId) {
    log.error(`invalid round data: missing ".tabularius_runId" in ${roundRef.path}`)
    return
  }
  const runNum = round.tabularius_runNum
  if (!a.isInt(runNum)) {
    log.error(`invalid round data: missing or invalid ".tabularius_runNum" in ${roundRef.path} ${a.show(runNum)}`)
    return
  }

  const roundCreatedAt = (
    round.tabularius_createdAt ||
    decodeTimestamp(round.LastUpdated) ||
    faf.FieldValue.serverTimestamp()
  )

  const dat = a.Emp()
  s.datAddRound({dat, round, runId, runNum, userId})

  /*
  Batching allows atomic writes. It has a limit of several hundred operations
  according to bots. We don't expect more than a few tens here.
  */
  const batch = db.batch()
  const {facts, ...dims} = dat

  for (const val of facts) {
    const ref = db.collection(s.COLL_FACTS).doc()
    val.factId = a.reqValidStr(ref.id)
    val.createdAt = roundCreatedAt
    batch.create(ref, val, {merge: true})
  }

  for (const coll in dims) {
    for (const [key, val] of a.entries(a.reqMap(dims[coll]))) {
      val.createdAt ||= roundCreatedAt
      const ref = db.collection(coll).doc(a.reqValidStr(key))
      // log.debug(`adding ${ref.path} to the batch`)
      batch.set(ref, val, {merge: true})
    }
  }

  batch.set(roundRef, {
    tabularius_derivedSchemaVersion: s.SCHEMA_VERSION,
    tabularius_createdAt: roundCreatedAt,
  }, {merge: true})
  return batch
}

export async function latestRunIds(db, where) {
  const {userId, runId: _, ...rest} = a.pickKeys(where, s.ALLOWED_RUN_FILTERS)
  const userIds = u.compactSet(userId)

  if (!userIds.size) {
    const query = queryLatest(queryWhere(db.collection(s.COLL_RUNS), rest))
    const snap = await query.get()
    return a.map(snap.docs, docId)
  }

  const out = []
  for (const id of userIds) {
    const query = queryWhere(db.collection(s.COLL_RUNS), rest).where(`userId`, `==`, id)
    const snap = await query.get()
    out.push(...a.map(snap.docs, docId))
  }
  return out
}

export function queryWhere(query, where) {
  for (const val of a.mapCompact(a.entries(where), whereOr)) {
    query = query.where(val)
  }
  return query
}

export function queryLatest(query) {
  return query.orderBy(`createdAt`, `desc`).limit(1)
}

function whereOr([key, val]) {
  const out = []
  for (val of val) out.push(faf.Filter.where(key, `==`, val))
  return out.length ? faf.Filter.or(...out) : undefined
}

export function docData(src) {return src.data()}
export function docId(src) {return a.reqValidStr(src.id)}

export function decodeTimestamp(src) {
  if (!a.isValidStr(src)) return undefined
  src = Date.parse(src)
  return src ? faf.Timestamp.fromMillis(src) : undefined
}

export async function* documentBatches(baseQuery) {
  const batchSize = BATCH_SIZE_MAX
  let startAfter

  for (;;) {
    let query = baseQuery
    if (startAfter) query = query.startAfter(startAfter)
    query = query.limit(batchSize)

    const snap = await query.get()
    const docs = a.laxArr(snap.docs)
    if (!docs.length) break

    yield docs

    if (docs.length < batchSize) break
    startAfter = a.last(docs)
  }
}
