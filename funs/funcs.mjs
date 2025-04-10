import * as faa from 'firebase-admin/app'
import * as faf from 'firebase-admin/firestore'
import * as ff from 'firebase-functions/v2'
// import * as ffh from 'firebase-functions/v2/https'
import * as fff from 'firebase-functions/v2/firestore'
import * as log from 'firebase-functions/logger'
import * as a from '@mitranim/js/all.mjs'
import * as s from './schema.mjs'

// ff.setGlobalOptions({maxInstances: 1})

const app = faa.initializeApp()
const db = faf.getFirestore()

// export const helloWorld = ffh.onRequest((req, res) => {
//   log.info(`incoming request`, {url: req.url, data: req.body.data})
//   res.send({data: {msg: `Hello from Firebase!`, echo: req.body.data}})
// })

export const onRound = fff.onDocumentWritten(`rounds/{roundId}`, async function onRound(eve) {
  const prev = eve.data.before.data()
  const next = eve.data.after.data()

  if (prev?.tabularius_derivedSchemaVersion || next?.tabularius_derivedSchemaVersion) {
    log.debug(`already derived data from ${eve.document}, skipping`)
    return undefined
  }

  const round = eve.data.after.data() || eve.data.before.data()
  if (!round) return

  // log.debug(`deriving data from ${eve.document}`)

  // Batching allows atomic writes.
  const batch = db.batch()
  const userId = round.tabularius_userId
  const runId = round.tabularius_runId
  const dat = Object.create(null)
  let count = 0

  s.datAddRound(dat, round, runId, userId)

  for (const coll in dat) {
    for (const [key, val] of a.entries(dat[coll])) {
      count++

      const ref = (
        a.isStr(key)
        ? db.collection(coll).doc(key)
        : db.collection(coll).doc()
      )

      // log.debug(`adding ${coll}/${ref.id} to the batch`)
      batch.set(ref, val, {merge: true})
    }
  }

  await batch.commit()
  log.info(`derived ${count} documents from ${eve.document}`)

  return eve.data.after.ref.set(
    {tabularius_derivedSchemaVersion: s.SCHEMA_VERSION},
    {merge: true},
  )
})
