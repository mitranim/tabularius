## Setup

<!-- (Done) Serve with GitHub Pages. If build/deploy is necessary, use GitHub Actions. -->

Firebase: maybe DB-side aggregations for clients, for analytics.

Snapshots include user ID, from Firebase authentication.

Snapshots include run ID (auto-generate it).

In case of defeat, last snapshot indicates defeat.

<!-- (Done) The SPA asks for permissions for the save directory (or just progress file), and for the run history directory. The SPA watches the progress file by periodically checking timestamps. On changes, it also checks the round index or run ID. On changes, it cleans up the data and stores it in the run history directory. -->

The SPA lets you view run history, per round, per run.

The SPA may provide an option to roll back the save.

Detect multiple concurrent instances of the app, only one should deal with files.

## Data cleaning

We store snapshots without cleanup, because any changes might break the game in case of rollbacks.

We cleanup either before analyzing the data, or before uploading to Firebase. Rollbacks are supported only from local files, not from Firebase.

Cleanup: drop zero values. Recursively: empty children, empty parents.

Maybe before uploading to Firebase, remove stuff not useful for analytics, like unlocks.

Upgrades: convert to the `ABA`-style format.

Convert long field names to shortened ones for smaller sizes. Choose well, because we're stuck with them. Semi-abbreviated field names are fine.

## Forks

We detect rollbacks. Rollbacks fork the history of a run.

Maybe something like:

* current branch has index 0
* when adding a round, check if there is already that round in the current run
* if true, get that round and all higher rounds, assign them index + 1, and stash them in a folder with the current run ID and the index + 1
* in the Firebase data, update those rounds, assigning them index + 1
* when querying all data, we include old branches
* when querying a specific run, include only rounds with index 0

Could even not bother with indexing, and just set a boolean `isOutdated = true`.

## Permissions

In the Firebase rules, we set restrictions. A user is only allowed to upload snapshots with their own user ID, the snapshots are immutable except for that one field (branch index or "outdated") which is mutable.

Thus, they can't fuck around with other players' data.

Guess we'll have to authenticate them, Firebase has OAuth integrations, it's like 2 clicks.

In the UI, we explain something like:

> Why authentication? To isolate data per player, keeping it safe.
> The app does not store _any_ of your personal information. (No name, no email, etc.)

And display the randomly assigned user ID in the UI, so they can share it with others when asking to look at their data.

Data filtering has an option to filter by user ID.

We _could_ make all data viewable without authentication. We could also make local run history collection available without auth. The uploading of data to Firebase is what needs authentication. We could also require auth from the get-go, to make sure users provide data. Later when the game launches, we might lift that restriction.

If data collection is optional, show "please send us the data!" (rephrase this), with many animated arrows pointing from all sides to the button that authenticates and enables data collection, and the whole thing pulsating.

Sell data upload by mentioning that this gives you your personal run history, in the cloud and safe from local data deletion, cross-platform, viewable from any device, and shareable. (And it helps the devs improve the game.)

## Misc

(Commented-out entries are either done or rejected.)

Consider if there's a danger of the browser tab being unloaded, which would disable the file watching, backups, data upload.

Analytics should ignore all rounds after the final one (number depends on difficulty).

When reading and decoding files:

* Try to detect is the file is just JSON, or also gzipped and base64-encoded.
* Perform the appropriate decoding.
* If decoding or parsing fails, assume that the file may be partially written, and retry after a second, a few times, up to a limit.

UI: have logs of operations. Maybe segregated. Each log may have info msgs and errors. (Ordering: new-to-old? Not sure.)

Add `log.verb` and a UI toggle for verbose logging.

Add log filters.

To reduce size, compress the logs (zip, gzip, whatever works).

Rename "run progress" to "game progress" everywhere.

Provide a way to set a run seed.

Various places in the UI that trigger errorful operations may display given errors as small links to the corresponding errors in the log. (By id and hash-href.)

Wild idea for later: integrate an LLM (e.g. OpenAI API) where we send it the code and what's happening. In case of errors, we can ask for arbitrary suggestions, maybe arbitrary code. The user could have a chat prompt with it for troubleshooting, do this, click that. Maybe suggestions for data analysis?

Make the pseudo-terminal font properly crisp. Compare to native terminal.

Viable commands:

* `help`
* `help <cmd>`
* `ps`
* `ls <dir>` (permission must be granted)
* `cat <file>` (permission must be granted)
* `...`

The notice "N older messages removed" should just be a regular message (but grey).

<!-- In the log, when logging something multi-line, align the lines. (Seems already done.) -->

In the log, timestamps waste too much space. Convert them to single-character indicators, with timestamp tooltips on hover.

<!-- Unfuck msg printing, use functions from `@mitranim/js/lang.mjs`. -->

Unfuck a lot of low-level stuff by using library functions.

<!-- Command `clear` should clear the log. -->

Preserve the output log in `sessionStorage` (primary) and/or `IndexedDB` (fallback). Each entry should be labeled with a type: "inf" or "err".
* DOM elements inside messages should be either excluded from this, or saved as text (`.textContent`).

---

Command history:

We have a dual command history: one local in `sessionStorage`, and one global in either `localStorage` or `IndexedDB`.

When executing a command, add it to _both_ histories (`try/catch` each).

When the app loads, it looks for the history in `sessionStorage`. If there is none, it falls back on the other storage.

---

<!-- Add the command `status` which displays the current status of the features supported by `init`, and also a short list of active processes. -->

---

<!-- The messages passed to `log` may include DOM elements. They should be included as-is without stringifying. -->

---

<!-- In the command `ps`, when listing active processes, for each process, include a small button with a cross that, when clicked, kills the process by calling `.deinit()` on the `Ctx` associated with that process. -->

<!-- Command `ps` should include `pid` for each process in the listing. -->

---

Command `kill` should take a process id (`pid`) and use `.deinit()`, similar to the above. It should also support command names; killing by name kills the first matching process, unless `-a` is passed, then it kills all matching by name. `kill` without arguments produces help for that command. `kill -a` without any other arguments kills all processes.

(Partially done: deinit is supported, `-a` is not.)

---

The default state of the media area should include the list of active processes, reactive and always up to date. This should be placed at the bottom of the area. The code for rendering this must be shared with the command `ps`.

---

In the actual commands, support cancelation via `sig.aborted` from the signal passed when starting the process.

---

For each command, before invoking, create an `AbortController` via `new a.Ctx()` (this is a subclass with support for Go-style context chaining), and pass its `.signal` to the command (the argument is called `sig`). This is intended for Go-style cancelation.

---

Maybe convert prompt textarea to input, so we don't have to think about newlines.

---

Unfuck the bot's code style.

---

Limit length of command history.

---

`help <cmd>` should show help for specific command.

---

Export our modules into global scope, under a single namespace (`tabularius`).

---

When printing a command's output synchronously, skip the time.

---

Refactor quotes into backticks. Automate with `eslint`. Can't use `dprint` or `deno fmt` (which uses `dprint`) because they don't support it.

---

<!-- Tooltips on floating buttons. -->

---

<!-- Unfuck floating button positioning, they shouldn't have hardcoded offsets. -->

---

<!-- Unfuck `ProcessButton`. -->

---

Pending guidelines for bots:
- HTML best practices: accumulate bot mistakes here, move there later:
  - Every `button` must have an explicit `type`.
- Generic:
  - After completing a task, dedup new code with existing code; look harder; dedup harder

---

<!-- In `PROCESS_LIST`, drop "started N ago". -->

---

Log: only scroll to bottom if already scrolled to bottom. Meaning, if scrolled up even by one pixel, don't scroll to bottom.

---

<!-- `kill`: instead of immediately removing a process from the list, give it a status "killing..." and remove it only when its promise completes. This requires us to store each proc's promise in the proc. -->

---

`runCommand` currently adds a history entry even when invoked programmatically. Gotcha? Useful? Unsure.

---

Less vertical spacing in `u.log`.

---

Consistently prefix command logging with current command name. Find places in the code where we currently don't, and fix. Note that the last returned string, or the last error thrown, is auto-prefixed by `runCommand`. Consider consolidating.

---

When round index is increased in `handleBackupScenario`, when we log "Created backup for new round", the next and prev rounds are logged the same. Expected behavior: correctly log the prev round. Avoid doing math.

---

<!-- Initial log width should be 2/3rd of the screen. -->

---

<!-- Since we store `.gd` data, backed up files should use the extension `.gd`. -->

---
