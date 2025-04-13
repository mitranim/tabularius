## App overview

We're developing a SPA with the following goals:
* Make periodic snapshots of a save file from a game.
  * Store snapshots to a user-chosen directory, building a history.
  * Upload snapshots to Firestore.
* Display run history.
* Analyze the data, with visualizations, plots.
  * Analyze local data.
  * Query global data from Firestore for more broad analysis.

In development, the SPA is hosted by a local server running in Deno. In production, it's hosted on GitHub Pages.

## UI

The app looks like a terminal emulator. It does not interact with the OS shell; the set of commands is unique to our web app.

Four main UI elements:
* Titlebar (top)
* Log (left)
* Media (right)
* Prompt (bottom)

At the bottom we have a prompt for typing commands. It's a textarea starting at 1 row, automatically resizing itself to the content. It's always interactive.

At the top we have a narrow horizontal strip with the app's title on the left, links to Discord and GitHub on the right.

Most of the UI is taken up by the log (left side) and media (right side). The divider between them is draggable. Only the log and media are scrollable.

The log is similar to stdout and stderr in OS terminals. It's a DOM element implemented in `./js/util.mjs`.`log`, a singleton. It's used for logging by _all_ of our browser code.

The media area, to the right from the log, is used for arbitrary non-text content, similar to special media content in LLM chat apps. Any command can add any content there.

Unlike in regular terminals, commands don't block the prompt. Instead, each command starts a "process", which is added to set of currently running processes. This is similar to OS process management, and implemented in `./js/os.mjs`.

The media panel allows adding any amount of media items. They're vertically scrollable. The bottom item always shows currently running processes. Each process has a pid, a command's name and args, and a tiny button that kills it.

In the terminal, processes can be viewed with `ps` and killed with `kill` (via `AbortController`; our processes respect `AbortSignal` where possible).

## File system

FS access is done via `window.showOpenFilePicker` and `window.showDirectoryPicker`.

We store obtained file handles in IndexedDB for later access.

We have terminal commands for initializing the FS access, and showing the current status.

## Backups

The `init` command requests FS access and starts the `watch` process, which can also be killed and started separately.

The `watch` process watches the progress file in the save directory, detects modifications, detects new rounds, makes one backup per round per run (no redundancies), making new run directories when necessary. It also broadcasts FS events to all instances of our app (browser tabs), making it possible to update their plots on the fly.

The `upload` command makes it possible to upload backups to Firestore. Currently it's manual; we plan to make it automatic after authenticating.

## Cloud

When authenticated, run history is uploaded to Firestore (currently manually). By using cloud functions, we derive our own schema suitable for analytics.

## Analytics and plots

We support filtering, grouping, aggregating stats over fairly arbitrary parameters (via the `plot` command). This is supported for both local and cloud data (selected with the `-s` flag).