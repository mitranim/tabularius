## App overview

We're developing an app with the following goals:
* Make periodic snapshots of a save file from a game.
  * Store snapshots to a user-chosen directory, building a history.
  * Upload snapshots to our server.
* Display run history.
* Analyze the data, with visualizations, plots.
  * Analyze local data.
  * Query global data from our server for more broad analysis.

The client is a SPA. The server runs in Deno and uses an embedded DuckDB.

In development, the SPA is hosted by a local server running in Deno. In production, it's hosted on GitHub Pages.

## UI

The app looks like a terminal emulator. It does not interact with the OS shell; the set of commands is unique to our web app.

Four main UI elements:
* Titlebar (top)
* Log (left)
* Media (right)
* Prompt (bottom)

At the bottom we have a prompt for typing commands.

At the top we have a narrow horizontal strip with the app's title on the left, links to Discord and GitHub on the right.

Most of the UI is taken up by the log (left side) and media (right side). The divider between them is draggable. Only the log and media are scrollable.

The log is similar to stdout and stderr in OS terminals. It's a DOM element implemented in `./client/util.mjs`.`log`, a singleton. It's used for logging by _all_ of our client code.

The media area, to the right from the log, is used for arbitrary non-text content, similar to special media content in LLM chat apps. Any command can add any content there.

Unlike in regular terminals, commands don't block the prompt. Instead, each command starts a "process", which is added to set of currently running processes. This is similar to OS process management, and implemented in `./client/os.mjs`.

The media panel allows adding any amount of media items. They're vertically scrollable. The bottom item always shows currently running processes. Each process has a pid, a command's name and args, and a tiny button that kills it.

In the terminal, processes can be viewed with `ps` and killed with `kill` (via `AbortController`; our processes respect `AbortSignal` where possible).

## File system

FS access is done via `window.showOpenFilePicker` and `window.showDirectoryPicker`.

We store obtained file handles in IndexedDB for later access.

We have terminal commands for initializing the FS access, and showing the current status.

## Backups

The commands `saves` and `history` grant FS access and start the `watch` process, which can also be killed and started separately.

The `watch` process watches the progress file in the save directory, detects modifications, detects new rounds, makes one backup per round per run (no redundancies), making new run directories when necessary. It also broadcasts FS events to all instances of our app (browser tabs), making it possible to update locally-sourced plots on the fly.

## Cloud

When authenticated via `auth`, progress file snapshots are uploaded to our server, which derives a schema suitable for analytics.

We check the entire run history on app startup and auto-upload it. When `watch` makes a new backup, we upload just the newly created file.

Upload can also be invoked manually with `upload`.

## Analytics and plots

We support filtering, grouping, aggregating stats over fairly arbitrary parameters (via the `plot` command). This is supported for both local and cloud data (selected with the `-c` flag).