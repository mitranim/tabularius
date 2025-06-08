import * as a from '@mitranim/js/all.mjs'
import * as dr from '@mitranim/js/dom_reg.mjs'
import * as u from './util.mjs'
import {E} from './ui_util.mjs'
import * as uu from './ui_util.mjs'
import * as ui from './ui.mjs'

a.ShedMicro.main.onerror = logErr
a.ShedTask.main.onerror = logErr

export const LOG_MAX_MSGS = 1024
export const LOG_LINE_HEIGHT = `leading-[1.25]`
export const LOG_SPACE_Y = `space-y-[1.25em]`
export const LOG_GAP_Y = `gap-y-[1.25em]`

export function LogWords(...chi) {return u.intersperseOpt(chi, ` `)}
export function LogLines(...chi) {return u.intersperseOpt(chi, `\n`)}
export function LogParagraphs(...chi) {return u.intersperseOpt(chi, `\n\n`)}

/*
An error which may contain arbitrary DOM nodes. In the `LOG`, we append this
error's original nodes instead of its message string.
*/
export class ErrLog extends Error {
  constructor(...nodes) {
    const msg = E(`pre`, {}, nodes).textContent
    super(msg)
    this.nodes = nodes
  }

  // Special interface supported by our renderer.
  toNode() {return this.nodes}

  get name() {return this.constructor.name}
}

const CLS_MSG_NOTICE = a.spaced(
  ui.CLS_TEXT_MUTED,
  ui.CLS_BORD,
  `text-center border-b py-1`,
)

export const REMOVED_MSG_NOTICE = E(`div`, {class: CLS_MSG_NOTICE, hidden: true})

export let LOG_REMOVED_MSG_COUNT = 0

/*
Should be used when invoking any async function in sync context. In other words,
at the top level of async invocation. Logs the error and suppresses the
rejection. Usage:

  someAsyncFun().catch(ui.logErr)
  somePromise.catch(ui.logErr)
*/
export function logErr(err) {LOG.err(err)}

export const LOG = new class Log extends ui.Elem {
  constructor() {
    super()

    E(
      this,
      {
        class: a.spaced(
          ui.CLS_BG_1,
          `block w-full min-w-0 overflow-x-clip overflow-y-auto over-wrap`,
          LOG_LINE_HEIGHT,
        ),
      },
    )
  }

  // Must be used for all info logging.
  info(...msg) {return this.addMsg({}, ...msg)}

  // Must be used for all error logging.
  err(...msg) {
    if (a.some(msg, u.isErrAbort)) return undefined
    const out = this.addMsg({type: `err`}, ...msg)
    if (out) console.error(...msg)
    return out
  }

  // Should be used for optional verbose logging.
  verb(...msg) {
    if (!u.VERBOSE.val) return undefined
    return this.addMsg({}, ...msg)
  }

  inp(...msg) {return this.addMsg({type: `inp`}, ...msg)}

  clear() {
    LOG_REMOVED_MSG_COUNT = 0
    E(this, undefined, E(
      REMOVED_MSG_NOTICE,
      {class: CLS_MSG_NOTICE, hidden: false},
      `log cleared`,
    ))
    ui.PROMPT_INPUT.focus()
  }

  addMsg(props, ...chi) {
    const nextMsg = LogMsg.init(props, ...chi)
    if (!nextMsg) return nextMsg

    const prevMsg = this.lastElementChild
    if (prevMsg) {
      // `?.` is used because not all entries are `LogMsg`.
      // For example, `REMOVED_MSG_NOTICE` is plain.
      prevMsg.unsetLatest?.()
      prevMsg.setIndex?.(this.childElementCount)
    }

    nextMsg.setLatest()
    this.appendChild(nextMsg)
    this.enforceMessageLimit()

    // Scroll all the way to the bottom.
    this.scrollTop = this.scrollHeight
    return nextMsg
  }

  enforceMessageLimit() {
    REMOVED_MSG_NOTICE.remove()

    while (this.childElementCount > LOG_MAX_MSGS) {
      this.removeChild(this.firstElementChild)
      LOG_REMOVED_MSG_COUNT++
    }

    E(
      REMOVED_MSG_NOTICE,
      {class: CLS_MSG_NOTICE, hidden: !LOG_REMOVED_MSG_COUNT},
      LOG_REMOVED_MSG_COUNT, ` older messages removed`,
    )

    // Move the notice to the top of the message log.
    if (LOG_REMOVED_MSG_COUNT) this.prepend(REMOVED_MSG_NOTICE)
  }
}()

const LOG_MSG_CLS = `block w-full px-2 py-1 font-mono whitespace-pre-wrap over-wrap border-l-4`
const LOG_MSG_CLS_ERR = a.spaced(ui.CLS_ERR, `border-red-400 dark:border-red-600`)
const LOG_MSG_CLS_INFO = `border-transparent`
const LOG_MSG_CLS_INFO_LATEST = `border-yellow-600 dark:border-yellow-800 pb-2`
const LOG_MSG_CLS_INFO_EVEN = `border-sky-600 dark:border-sky-800`
const LOG_MSG_CLS_INFO_ODD = `border-emerald-600 dark:border-emerald-800`

export class LogMsg extends dr.MixReg(HTMLPreElement) {
  isErr = undefined

  static init({type} = {}, ...chi) {
    const isErr = type === `err`
    const isInp = type === `inp`

    const msg = MSG_REN.E(
      new this(),
      {
        class: a.spaced(
          LOG_MSG_CLS,
          a.vac(isErr) && LOG_MSG_CLS_ERR,
          a.vac(isInp) && `animate-flash-light dark:animate-flash-dark`,
        ),
      },
      ...chi,
    )

    const head = msg.firstChild
    if (!head) return undefined

    const pre = LogPrefix(isInp)
    if (a.hasMeth(head, `addLogPrefix`)) head.addLogPrefix(pre)
    else msg.prepend(pre)

    msg.isErr = isErr
    return msg
  }

  setLatest() {
    if (this.isErr) return
    ui.clsReplace(this, LOG_MSG_CLS_INFO, LOG_MSG_CLS_INFO_LATEST)
  }

  unsetLatest() {
    if (this.isErr) return
    ui.clsReplace(this, LOG_MSG_CLS_INFO_LATEST, LOG_MSG_CLS_INFO)
  }

  setIndex(ind) {
    if (!a.optNat(ind)) return
    if (this.isErr) return

    ui.clsReplace(
      this,
      LOG_MSG_CLS_INFO,
      (ind % 2 ? LOG_MSG_CLS_INFO_ODD : LOG_MSG_CLS_INFO_EVEN),
    )
  }
}

export const PROMPT_PREFIX = `>`

function LogPrefix(inp) {
  return ui.withTooltip({
    chi: ui.timeFormat.format(Date.now()),
    elem: E(
      `span`,
      {class: a.spaced(ui.CLS_TEXT_MUTED, `cursor-help`)},
      inp ? PROMPT_PREFIX + ` ` : `< `,
    )
  })
}

const MSG_REN = new class MsgRen extends uu.Ren {
  renderOpt(src, key) {
    if (u.DEV) return super.renderOpt(src, key)
    return a.renderOpt(src) ?? a.show(src)
  }
}()
