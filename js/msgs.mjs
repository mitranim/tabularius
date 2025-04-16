import * as a from '@mitranim/js/all.mjs'
import * as fbs from 'firebase/firebase-firestore.js'
import * as u from './util.mjs'
import * as fb from './fb.mjs'

import * as self from './msgs.mjs'
const tar = window.tabularius ??= a.Emp()
tar.ms = self
a.patch(window, tar)

export const COLL_MSGS = `msgs`
export const TAG_FEEDBACK = `feedback`

cmdFeedback.cmd = `feedback`
cmdFeedback.desc = `send feedback to Tabularius dev, or list sent feedback`
cmdFeedback.help = function cmdShowHelp() {
  return u.LogParagraphs(
    cmdFeedback.desc,
    u.LogLines(
      `usage:`,
      [`  feedback `, ui.BtnPromptAppend(`feedback`, `-s`), ` <your feedback here>`],
      [`  `, os.BtnCmd(`feedback -l`)],
    ),
    u.LogLines(
      `modes:`,
      [`  `, ui.BtnPromptAppend(`feedback`, `-s`), ` -- send new feedback`],
      [`  `, ui.BtnPromptAppend(`feedback`, `-l`), ` -- list sent feedbacks`],
    ),
    u.LogLines(
      `example:`,
      [
        `  feedback `,
        ui.BtnPromptAppend(`feedback`, `-s`),
        ` Would be nice to have more plotting options!`,
      ],
    ),
  )
}

export async function cmdFeedback({sig, args}) {
  let send
  let list
  args = u.stripPreSpaced(args, `feedback`)

  while (args) {
    if (args !== (args = u.stripPreSpaced(args, `-s`))) {
      send = true
      continue
    }
    if (args !== (args = u.stripPreSpaced(args, `-l`))) {
      list = true
      continue
    }
    break
  }
  const text = args.trim()

  if (!(send || list)) {
    return u.LogParagraphs(
      `must specify at least one mode: "-s" or "-l"`,
      os.cmdHelpDetailed(cmdFeedback),
    )
  }

  if (send) {
    if (text) {
      await msgCreate({text, tags: [TAG_FEEDBACK]})
      u.log.info(`[feedback] sent! the dev might appreciate it`)
    }
    else {
      u.log.info(`[feedback] empty text, nothing sent`)
    }
  }

  if (list) {
    const userId = fb.reqFbUserId()
    const query = fbs.query(
      fbs.collection(fb.fbStore, COLL_MSGS),
      fbs.where(`userId`, `==`, userId),
      fbs.where(`tags`, `array-contains`, TAG_FEEDBACK),
      fbs.orderBy(`createdAt`, `asc`),
    )
    const docs = fb.snapDocs(await u.wait(sig, fbs.getDocs(query)))
    const texts = a.mapCompact(docs, getText)

    if (texts.length) {
      u.log.info(u.LogParagraphs(`[feedback] sent feedbacks:`, ...texts))
    }
    else {
      u.log.info(`[feedback] no feedbacks found`)
    }
  }
}

function getText(src) {return src.text}

export async function msgCreate({text, tags, userIds, chanIds}) {
  a.reqValidStr(text)
  tags = u.arrOfUniqValidStr(tags)
  userIds = u.arrOfUniqValidStr(userIds)
  chanIds = u.arrOfUniqValidStr(chanIds)

  const userId = fb.reqFbUserId()
  if (!userIds.includes(userId)) userIds.push(userId)

  const coll = fbs.collection(fb.fbStore, COLL_MSGS)
  return await fbs.addDoc(coll, {
    userId, text, tags, userIds, chanIds, createdAt: fbs.serverTimestamp(),
  })
}

export function msgsListen() {
  const query = fbs.query(
    fbs.collection(fb.fbStore, COLL_MSGS),
    fbs.orderBy(`createdAt`, `asc`),
  )
  fbs.onSnapshot(query, {
    error: onMsgQueryErr,
    next: onMsgQuerySnap,
  })
}

function onMsgQueryErr(err) {u.log.err(`msg query error: `, err)}

function onMsgQuerySnap(snap) {
  for (const change of snap.docChanges()) {
    if (change.type !== `added`) continue
    const msg = change.doc.data()
    console.log(`msg added:`, msg)
    u.log.info(`msg text: `, msg.text)
  }
}
