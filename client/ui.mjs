import * as a from '@mitranim/js/all.mjs'
import {E} from './ui_util.mjs'
import * as u from './util.mjs'
import * as os from './os.mjs'

export * from './ui_util.mjs'
export * from './ui_style.mjs'
export * from './ui_misc.mjs'
export * from './ui_log.mjs'
export * from './ui_media.mjs'
export * from './ui_split.mjs'
export * from './ui_prompt.mjs'

import * as ui from './ui.mjs'
const namespace = globalThis.tabularius ??= a.Emp()
namespace.ui = ui
a.patch(globalThis, namespace)

// Increment by 1 when publishing an update.
const VERSION = 124
let INITED

/*
Should be called exactly once.

Any further UI updates must be done either via observables, or or semi-manually
via `E`, or by lower-level manipulation in very simple cases. The rendering
library we're using has built-in support for observables and reactivity. We can
simply pass observables or functions into markup as "child nodes". Functions
are invoked in a reactive context, and any observables they access during the
call are automatically monitored, causing an update on change.
*/
export function init() {
  if (INITED) return

  E(
    document.body,
    {class: a.spaced(
      ui.CLS_FG,
      ui.CLS_BG_ROOT,
      `flex flex-col h-screen overflow-clip)`,
    )},
    NAV,
    ui.MIDDLE,
    ui.PROMPT,
  )

  document.getElementById(`loading_style`)?.remove()
  document.getElementById(`loading_msg`)?.remove()
  document.addEventListener(`keydown`, onKeydownClear)
  document.addEventListener(`keydown`, ui.onKeydownFocusPrompt)
  INITED = true
}

cmdClear.cmd = `clear`
cmdClear.desc = `clear log and/or media`
cmdClear.help = function cmdClearHelp() {
  return ui.LogParagraphs(
    u.callOpt(cmdClear.desc),
    ui.LogLines(
      `flags:`,
      [`  `, ui.BtnPrompt({cmd: `clear`, suf: `-l`}), ` -- clear only the log`],
      [`  `, ui.BtnPrompt({cmd: `clear`, suf: `-m`}), ` -- clear only the media`],
    ),
    ui.LogLines(
      `usage:`,
      [`  `, os.BtnCmd(`clear`)],
      [`  `, os.BtnCmd(`clear -l`)],
      [`  `, os.BtnCmd(`clear -m`)],
    ),
    `pro tip: clear the log by pressing "ctrl+k" or "cmd+k"`,
  )
}

export function cmdClear({args}) {
  args = u.cliArgSet(cmdClear.cmd, args)
  if (u.hasHelpFlag(args)) return os.cmdHelpDetailed(cmdClear)

  const log = args.delete(`-l`)
  const media = args.delete(`-m`)
  if (args.size) return os.cmdHelpDetailed(cmdClear)

  if (log || !media) ui.LOG.clear()
  if (media || !log) ui.MEDIA.clear()
  return undefined
}

/*
Shortcut for clearing the log. Mimics the MacOS convention (Cmd+K). On other
systems, Ctrl+L would be more correct, but it would conflict with the hotkey
for focusing the browser URL.

We also support Shift+Ctrl+K for clearing both the log and the media.
*/
function onKeydownClear(eve) {
  if (eve.key !== `k` && eve.key !== `K`) return
  if (eve.altKey) return
  if (!eve.ctrlKey && !eve.metaKey) return

  a.eventKill()
  ui.LOG.clear()
  if (eve.shiftKey) ui.MEDIA.clear()
}

const NAV_PAD = `p-2`
const NAV_ICON_SIZE = `w-6 h-6`
const NAV_LINK_CLS = a.spaced(`flex row-cen-cen`, NAV_PAD)
const NAV_ICON_CLS = a.spaced(NAV_ICON_SIZE, `hover:scale-[1.2]`)

const GITHUB_LINK = `https://github.com/mitranim/tabularius`
const STEAM_LINK = `https://store.steampowered.com/app/3226530`

// SYNC[discord_link].
const DISCORD_LINK = `https://discord.gg/upPxCEVxgD`

export const NAV = E(
  `nav`,
  {
    class: a.spaced(
      ui.CLS_BG_1,
      ui.CLS_BORD,
      `flex justify-between items-center gap-2 px-2 border-b`,
    ),
  },

  // Left side with title.
  E(
    `h1`,
    {class: a.spaced(`flex-1 trunc`, NAV_PAD)},
    E(`a`, {href: u.URL_CLEAN, class: ui.CLS_BTN_INLINE}, `Tabularius`),
    ` — book-keeper for `,
    E(`a`, {href: STEAM_LINK, ...ui.TARBLAN, class: ui.CLS_BTN_INLINE},
      `Tower Dominion`, ` `, ui.External(),
    ),
  ),

  // Right side with links.
  E(`div`, {class: `flex items-center`},
    E(`span`, {class: a.spaced(NAV_LINK_CLS, ui.CLS_TEXT_MUTED)}, `v` + VERSION),
    E(`a`, {href: GITHUB_LINK, ...ui.TARBLAN, class: NAV_LINK_CLS},
      ui.Svg(`github`, {class: a.spaced(NAV_ICON_CLS, `text-[#1f2328] dark:text-[#f0f6fc]`)}),
    ),
    E(`a`, {href: STEAM_LINK, ...ui.TARBLAN, class: NAV_LINK_CLS},
      ui.Svg(`steam`, {class: NAV_ICON_CLS}),
    ),
    E(`a`, {href: DISCORD_LINK, ...ui.TARBLAN, class: NAV_LINK_CLS},
      ui.Svg(`discord`, {class: NAV_ICON_CLS}),
    ),
  ),
)

ui.setSplitWidths(ui.LOG, ui.MEDIA)

export const MIDDLE = E(
  `div`,
  {class: `flex flex-1 min-h-0`},
  ui.LOG, ui.DRAG_HANDLE, ui.MEDIA,
)
