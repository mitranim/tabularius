## App overview

We're developing a SPA with the following goals:
* Make periodic snapshots of a save file from a game.
  * Store snapshots to a user-chosen directory, building a history.
  * Optional: upload snapshots to Firebase.
* Display run history.
* Analyze the data, with visualizations, charts.
  * Analyze local data.
  * Optional: query global data from Firebase for more broad analysis.

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

The log is similar to stdout and stderr in OS terminals. It's a DOM element implemented in `./js/util.mjs` as the variable `log`, a singleton. It's used for logging by _all_ of our browser code.

The media area, to the right from the log, is used for arbitrary non-text content, similar to special media content in LLM chat apps. Any command can put arbitrary content there. The user can always close that area.

Unlike in regular terminals, commands don't block the prompt. Instead, each command starts a "process", which is added to set of currently running processes.

In the default state of the media panel (when no other content is put there), at the bottom it shows currently running processes. Each process has a pid, a command's name and args, and a tiny button (with a cross) that kills it.

In the terminal, processes can be viewed with `ps` and killed with `kill` (using `AbortController`).

## File system

FS access is done via `window.showOpenFilePicker` and `window.showDirectoryPicker`.

We store obtained file handles in IndexedDB for later access.

We have terminal commands for initializing the FS access, and showing the current status.

## Backups

Status: done. The description below is somewhat outdated.

Goals:
- Watch the save/progress file.
- Detect file modifications.
- Detect new rounds (via round index).
- Detect new rounds (also via round index).
- Make one backup per round per run.
- No redundant backups.
- In the history dir: one sub-dir per run. Place all backups for that run there (1 per round).
  - Run ids: auto-generated.
  - Backup file name = round index + `.json`.
  - For each run directory: name = id. No prefix.

Details:
- When the watch command starts:
  - Check permissions for history dir and crash (by throwing) if not granted.
    - Dedup with existing code as much as possible.
  - Inspect history dir.
  - Get names of sub-dirs.
  - Sort names alphabetically (default JS sorting).
  - Get last one via `a.last`.
  - If not exists: return from this sub-procedure.
  - Store its name to a variable. This is the latest run id.
  - Inspect its files.
  - Get file names.
  - Sort alphabetically (default JS sorting).
  - Get last one via `a.last`.
  - Get base name without extension via `mitranim/js/path.mjs`>`posix.name(name)`.
  - Parse via `a.intOpt`, store to a variable.
  - Now we have the latest round index (or nil).
  - Inspect file timestamp, store to variable.
  - Parse file as JSON, get `?.RoundIndex`, store to variable.
  - No error handling here. Crashing is fine. Error will be auto-logged.
- When checking source file:
  - Compare with prev timestamp.
  - If prev timestamp >= next timestamp, then skip this iteration.
  - Update prev timestamp to next.
  - Compare round index. Both prev and next round indexes are either finite numbers (`a.onlyFin`) or nil (`a.onlyFin` returns nil for non-finite-numbers). This means 4 possible states: nil+nil, nil+num, num+nil, num+num.
    - If next is nil: skip this iteration.
    - If prev = next: overwrite prev with next.
    - If prev < next: backup to a new file in the target directory for that run. Round index is file name. Pad the file name by zeroes up to length 4 to ensure predictable sorting.
    - If prev > next:
      - New run detected.
      - Generate new run id.
      - Create new run dir.
      - Write next backup to new run dir (name according to round index).
    - Otherwise: throw an internal error / unreachable / programmer error.

Define small reusable utility functions (and constants) instead of hardcoding inline.

Be terse.

Consider the project's goals. Don't hesitate to offer suggestions for improvement!
