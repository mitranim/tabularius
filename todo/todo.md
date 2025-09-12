(Commented-out entries are either done or rejected.)

## Bot integration

Since we already have a terminal, it should be easy to integrate a bot. Users should be able to type:

```sh
ai Analyze latest run.
```

...and see charts and stuff. Here's how.

Bot requests are structured: we provide definitions of "functions" the bot can use. Functions may be optionally grouped into "tools". The function definitions correspond to actual JS functions. Minimum set:

* Browsing the local files (progress file and history dir)
  * Get a tree of dir and file names
  * Read specific file
    * Files are too large, so we'll need to cleanup/compact content here
* Functions for aggregating data, such as:
  * Aggregate metric A per round
  * Aggregate metric A per building
  * Aggregate metric A across the entire run
* Functions for displaying data, such as showing a line chart

When the bot response describes a function call, we execute that function, send the result to the bot, and wait for its next reply, rinse and repeat. Otherwise we simply print the output.

The state of our system is mutable. Our app could have public APIs that the bot can use. For example, modifying the log, the media content, and so on. After describing our interfaces and maybe our code, we could also tell the bot to _write JS_, and then evaluate it on the client.

The user can set their own API key to use newer or smarter models:

```sh
config set OPEN_AI_API_KEY <value>
config set OPEN_AI_MODEL <value>
```

We'll use the OpenAI API directly from the client. If we need a default API key and don't want it leaked, we can use a cloud service to proxy the request (keeping the API key secret there), and stay serverless.

## Misc

* [ ] Consider if there's a danger of the browser tab being unloaded, which would disable the file watching, backups, data upload.

---

* [ ] Analytics should ignore all rounds after the final one (number depends on difficulty).

---

* [ ] Provide a way to set a run seed.

---

* [ ] Various places in the UI that trigger errorful operations may display given errors as small links to the corresponding errors in the log. (By id and hash-href.)

---

* [ ] Make the pseudo-terminal font properly crisp. Compare to native terminal.

---

* [x] Setup `eslint`.
* [x] Disable gotcha environment globals, ensure sensible globals.
* [ ] Use relevant auto-formatting features.

---

Pending guidelines for bots:
- HTML best practices: accumulate bot mistakes here, move there later:
  - Every `button` must have an explicit `type`.
- Generic:
  - After completing a task, dedup new code with existing code; look harder; dedup harder.

---

Consistently prefix command logging with current command name. Find places in the code where we currently don't, and fix. Note that the last returned string, or the last error thrown, is auto-prefixed by `runCmd`. Consider consolidating.

---

An option to backup all save files, not just the progress file.

---

* [ ] Make it easy to edit game files by providing an inverse of `show -w`.

* [ ] Alternative editing approach: store a global var, user edits it in the browser console, then we can store that var to a file.

---

`logElem` / `logShow`: support error chains.

---

Support importing arbitrary local plugin scripts:
- Create a new command which picks a directory for JS plugin files, or configures a sub-dir in the history dir.
- Store the dir handle or the sub-dir path.
- On app startup, load modules from the plugin dir, in addition to importing modules via URL query.
- Keep track of which modules have already been imported, avoid redundant import.
- Provide an option to reload plugin modules or a specific one.
- `watch` could also watch plugin files (by timestamps) and auto-reload.

Evaluating plugin modules:
- Read text.
- Import as `Blob`.

```js
const SRC = `
import * as fs from 'tabularius/fs.mjs'
console.log(fs)
`

import(URL.createObjectURL(new Blob([SRC], {type: `application/javascript`})))
```

---

Comment in various Uplot issues related to dark mode, and provide code samples of how we support dark/light modes, with dynamic detection and switching:

https://github.com/leeoniya/uPlot/issues?q=dark%20

---

* [x] Consistently prefer lowercase msgs in log, errors, etc.

Still questioning this. When logging large chunks of text, using proper sentences would make it easier to tell where sentences begin and end. Lowercase without trailing dot is only good for errors, to make error messages composable.

---

<!-- Consider supporting non-string run and round indexes. For example, run `000000` should be considered same as `0` locally. -->

<!-- Consider supporting relative run and round indexes. For example, a user's first run fetched from cloud storage should be indexed as `0`, and so on. -->

---

When analyze one run, or group by commander: show commander name (add to code file, rename it). When analyze one faction, or group by faction: show faction name.

Where to show: probably on a combined stat screen (not a plot) which we're yet to implement.

---

A way to "stick" a run id, round id, building id for subsequent commands. Persist to storage.

---

Share the `watch` logging between all tabs, but make it clear that only one backup was made, or that another tab made it.

---

- [ ] Better Discord icon.

---

Support multiple CLI commands in one line. We may consider shell-style `&&` and `&`, with corresponding behaviors.

---

Add a command to list, get, and set all our settings in `sessionStorage` and `localStorage`.

---

Consider logging even less by default.

---

More interactive logging, particularly for chains of operations. Examples:

* [x] `help` -> every command name is a clickable button.
* [x] Any command help -> every example is a clickable button.
* [x] Similar for other commands, wherever possible.
* [ ] `plot` -> help includes `plot ps` -> clickable -> list of run ids which are clickable and thus plottable (either local or remote, depending on `-s`).

---

Top right: collapse text into icons: Steam (add TD link), Discord, Github.

---

Keyboard hotkeys for activating visible clickables in the log. For example, holding Alt might enumerate them and show numbers; pressing a number activates the corresponding clickable.

---

Have something clickable somewhere which is always displayed which runs `help`, so you can never be without help. Maybe on the left side of the prompt. (Some kinda "home" or "help" emoji maybe.)

---

Make a YouTube video guide. Maybe get Claude Code to analyze the app and write a script for the video.

---

Client: bundle and minify for production.

Bundling is a pain, but it avoids another pain: our modules other than `client/main.mjs` tend to be cached by browsers, which often causes them to be not properly updated on deployments.

Alternatively, get around that with `sw.mjs`.

---

Change the color scheme (both light and dark) to what I use in ST.

---

`watch`: not reliable enough, needs to retry local files harder.

---

Find out where the game stores its "foes in current run" information.

---

Add `active:` indicators to all buttons and maybe some links.

---

On startup, when FS unavailable, instead of example run analysis, consider trying latest cloud run (`user_id=all run_id=latest`).

---

* [ ] Drop the backwards compatibility code related to progress file picking.

---

* [ ] `ls -c /` should list all user dirs; `ls -c current` should list the current user's runs.

---

* [ ] `show`: use the same interface as `ls`:
  * [ ] Display available FS entries.
  * [ ] Clicking a directory displays inner entries.
  * [ ] Clicking a file runs `showFile`.
  * [ ] Drop support for combining multiple files in a directory.
  * This also unifies the handling of save dir and history dir.

---

* [ ] `show`: support cloud source.
  * Same as `ls -c`: all user dirs by default, `-c current` for current user, `-c current/latest` for latest run of current user, and so on.

---

* [ ] When save dir and history dir are available, periodically make a backup of the entire save dir. Keep two latest versions.

---

* [ ] Add an `edit` command for unlocking commanders, difficulties, etc.
  * [x] Default without `-w`: dry run.
    * [x] Requires read access to save dir.
  * [x] Takes a `-w` flag to confirm overwriting the files.
    * [x] Requires readwrite access to history dir for backups.
    * [x] Requires readwrite access to save dir.
  * [x] With or without `-w`, we always report every change, as well as non-changes for the specified edits.
    * Accumulate the entire summary and log it at once.
  * [x] With `-w`:
    * [x] Requires access to history dir.
    * [x] If don't have readwrite permission for save dir:
      * [x] Display a warning:
        * Game files will be modified.
        * Backups can be found in `<history_dir>/backup`.
        * Game must be closed. If game is running, it will ignore and overwrite all edits.
        * This warning is only displayed before granting readwrite access.
      * [x] Request readwrite permission.
    * [x] Make backups of all affected files:
      * [x] Add a timestamp after the name, like for runs.
      * [x] Write to `<history_dir>/backup`.
  * [x] Takes multiple inputs which specify which edits to make.
  * [x] Inputs are similar to plot filters. They act simultaneously as feature-enabling flags and as filters depending on the feature, due to co-dependencies. Examples:
    * [x] Unlocking commanders: `hero=all` unlocks all, filter `hero=A hero=B ...` limits which ones to unlock. In other edits, `hero=` is a filter.
    * [ ] Unlocking buildings, or limiting which buildings are affected by other edits: `bui_type=Mirad bui_type=Bunk ...`. In other edits, `bui_type=` is a filter.
      * [ ] Support full names as well; add a title-to-code table to `game_const.mjs` which includes both short and long titles.
      * [x] This also unlocks full building upgrades, skipping the initial level 1 lock.
        * [x] Key in unlockables: bui code + `AdvUpg`.
      * [x] `bui_type=all` unlocks all buildings.
    * [x] Unlocking commander difficulty badges: either `diff=` or `frontier=` tells us to perform this action, and `hero=` is an optional filter.
      * [x] Rename `frontier_diff` to `frontier` across the system.
      * [x] `diff=all` sets all badges to maximum.
    * [x] Unlocking difficulty: `diff=all` unlocks up to max, `diff=1|2|3|4|5` unlocks up to corresponding mode.
      * `frontier=` (with or without any value) implies `diff=5`, suppresses other values of `diff=`, and unlocks Frontier.
    * [x] Unlocking doctrines: `doctrine=all` unlocks everything; `doctrine=A doctrine=B ...` specifies which to unlock, and acts as filter in other edits.
      * [x] Consider adding doctrine names to the code-title mapping tables.
  * [x] Log warnings about unused edit options.
  * [x] Support locking, an inverse of unlocking. Might be a boolean flag that flips the behavior for all unlocks, or something more specific and inline.
  * [x] When unlocking something, make it "seen" for the Codex, and the opposite when locking.
  * [ ] Support specifying a source file and a target file.
    * [ ] If only source is specified: error; requires target.
      * Mention that you can specify just the target; print the modified command as clickable.
    * [ ] If only target is specified: edit that file in-place (with a backup).
    * [ ] If both specified, check if the two files share a common prefix (split on `.` then on `_`), display a warning if not.
    * [ ] The rest of the behavior is unchanged, but flags which don't apply to the content of the source file raise warnings.
    * [ ] When neither is specified: automatically look for "known" files which match the provided edit flags.
    * [ ] Source and target may be provided repeatedly; they apply to all subsequent edit options; providing them again overrides them for the further options.
  * [x] `-a`: also lock or unlock difficilties.
  * [ ] Add an option to only mark selected entities as "seen" without unlocking anything new.
  * [ ] Consider _not_ decreasing global max difficulty when `diff=` or `frontier=` is specified _and_ `hero=` is also specified.
  * [ ] Cheat options:
    * [ ] Editing any field anywhere:
      * Require a single specific source file.
      * Dot-separated path-value: `one.two.three=<val>`.
      * If value looks like a null, boolean, number, dict, or list, parse as JSON. Otherwise, use as-is.
      * Split on dots, ignoring the leading dot. If leading dot with only one key, then it's at the top level.
      * Ensure that everything up to the last key exists in the data.
      * Set the value.
    * [ ] Support appending to lists.
    * [ ] Currency editing:
      * [ ] `supply=`
      * [ ] `recon=`
      * [ ] `tech=`
      * [ ] `supply_mul=`
        * Mention that this is for Reinforcements only.
      * [ ] `recon_mul=`
        * Mention that this is for Reinforcements only.
      * [ ] `grenadier=`
      * [ ] `anysia=`
        * Mention that it only works on Blue.
      * Specify the expected format for each, with examples, like:
        * `supply=1048576`
        * `recon=65536`
        * `tech=128`
    * [ ] Discovery: `discovery=` (`.CurrentNeutralOdds`).
      * Mention the format: 0 to 100.
    * [ ] Get arbitrary amounts of arbitrary blueprints.

---

Make it easier to filter runs by run directory names.

Consider adding `run_name` to the schema.

---

* [ ] Add a `make` command or script for backing up cloud data by downloading, preferably the entire volume.

---

* [ ] Add a command for downloading all of a user's cloud backups, either merging them into the history dir, or (as an option) placing into a sub-dir.

---

`game_const.mjs` / `plot` / `namedToCoded`: support matching full (or at least fuller) building names, not just our shortenings. Motive: using full names in plot URLs makes them less likely to break when we change short names in our table. Also, users could type them without having to remember our very specific short names.

---

* [ ] `ls` entries: use truncation with ellipsis, like plot totals.

---

* [ ] `ls` entries: show brief info for run dirs, such as faction, commander, difficulty, round count.

---

`watch`: don't assume new run if `.tabularius_run_num` matches.

---

`watch` and `upload`: avoid the overhead of re-reading the freshly backed-up file, pass the data to the upload code. Since we still want it to be invoked as a process, this requires us to introduce the ability to pass inputs other than CLI arguments to commands / processes.

Low priority because file reads tend to take single digit milliseconds. (Unlike file _writes_ which tend to be horribly slow in the web FS API.)

---

* [ ] CLI parsing:
  * [ ] Support a set of operators: = < > ≤ ≥ ≠.
  * [ ] Consider supporting ASCII digraphs: = == < <= >= > != <>.
  * [ ] Return `{key, val, op, src}`.
  * [ ] Caller must opt into operators, otherwise only `=` is allowed.
* [ ] Plot aggs: support those operators.

---

* [ ] A reminder to provide feedback (with links to Discord and GitHub).

---

Server: start immediately, migrate DB asynchronously. While migrating, API requests which require DB access should return errors telling the client that the DB is being migrated, wait and retry later. We simply display those errors to users.

Or, even better, for lower uptime:
* On startup, if migration is needed:
* Open a temporary DB file.
* Build the new schema in the new DB.
* During this operation, the upload endpoint builds a set of newly-uploaded rounds which are missing from the new DB.
* After going through existing files, the migrate function enters a loop:
  * Deduplicate the set of newly uploaded files with what it inserted (remember ids of all inserted rounds, or simply query the DB).
  * Insert any missing rounds.
  * As soon as there are no more pending rounds, acquire a lock on all DB operations, which we'll need to define, and which will be shared with all endpoints that use the DB.
  * When the lock is acquired, check for newly uploaded rounds again.
  * Once there are none:
    * Checkpoint both DBs.
    * Disconnect both DBs.
    * Rename the old DB file.
    * Rename the new DB file to the old file.
    * Release the lock.

---

* [ ] Figure out why some `facts` don't have `run_ms`, prevent it from happening. Similar for other timestamps.

---

* [ ] Add an API for error reporting, and use it in `logErr`. Need to carefully select only "unexpected" errors, excluding `ErrLog`, abort errors, CLI decoding errors, and possibly more.
  * [ ] Store reported errors in table `errs`.
  * [ ] Send to Discord private server via webhook.

---

* [ ] Update notifications:
  * [ ] Move the UI version into a JSON file.
  * [ ] Once a day, download that file and see if the version is increased.
  * [ ] In the navbar: the version indicator changes its appearance and suggests reloading to update.

---

* [ ] Consider packaging as a single executable which serves the UI on `localhost` and runs all FS operations in Deno. Requires downloading once, but no FS setup whatsoever.
  * [ ] `deno compile` + GitHub Actions.
  * [ ] Updating: click a button, app downloads a new executable and replaces the old one.
    * [ ] Automatically check for updates and notify.
  * [ ] Store data exactly like on the cloud server. Consolidate the code and remove client-side data manipulation.
  * [ ] Instruct the user to place the executable into its own directory (suggest a path), where it will also store the accumulated data.

---

* [ ] Figure out how to shorten user ids.

---

* [ ] Persistent processes (`watch` and `upload`): instead of giving up after 3 errors, gradually increase the retry interval: 1 hour, then 1 day. Set the retry limit higher.

---

Also see `./todo_show_round.md`.

* [x] Add a new command (tentative name `show_round`) for showing a breakdown of a round, with various damage / efficiency stats, _and_ with weapon details. This is a new media type.
  * [x] At the top: various run details: game version, run number, round number, commander, difficulty, frontier, HQ HP, etc.
  * [x] Below: collapsed, expandable groups of doctrines:
    * - [x] Regular doctrines.
    * - [x] Frontier curses.
    * - [x] Frontier dotations.
    * - [x] Frontier modifiers.
  * [x] Below: table with various stats.
    - [x] The table has two levels: top level for stats, and sub-level for weapon details.
    - [x] For each building:
      - [x] One row for its own stats.
      - [x] One row for each statful weapon, with stats for that weapon.
        - Statful weapon is defined as either currently enabled, or having had dealt some damage at any point during the run.
      - [x] One row for each non-weapon, non-bullet child, with its stats.
      - [x] If has at least one statful weapon:
        - [x] Add a full-colspan row below, which contains a sub-table.
        - [x] One row per statful weapon.
        - [x] Each row describes various details of that weapon: damage, rof, reload, mag, range, targeting, detection, and other properties.
    - [x] By default, weapon and child rows are collapsed (hidden).
      - [x] Clicking a building row toggles the weapon and child rows.
      - [x] The row containing the weapon details sub-table is toggled by clicking another row, just above it.
      - [x] Persist the latest "show"/"hide" preference for the toggled row type to storage, respect it for new tables.
    - [x] Support sorting by any column.
      - [x] Clicking a `th` cycles between sort types: desc, asc, none.
      - [x] Persist the latest sorting preference to storage, respect it for new tables.
    - [x] Stat cells have a numeric value and % of this value among all entities of this kind (bui vs (wep|chi)).
    - [x] Use overflow ellipsis (our `trunc` class) in all cells, except for the cells which contain sub-tables. Ensure it works properly.
    - [x] Use `@container` queries to hide less-important columns when the container is narrow.

* [ ] Support cloud sources.
* [ ] Add more stats (DPS, damage efficiency, uptime).
* [ ] Make it possible to enable and disable column sets.

---

* [ ] Add a new command (tentative name `show_run`) which takes a run id (for cloud stuff) or a run num (for local stuff) and renders various default analyses (currently plots, but more in the future).
  * [ ] Server: add an endpoint that takes a run id and returns the data needed for this command.
  * [ ] Client: an analogous function.
  * [ ] Both environments:
    * [ ] Find latest round and use it for an equivalent of `show_round`.
    * [ ] Query multiple plot aggs and render corresponding plots, with one total (can opt-out via `-t=false`).
  * [ ] Server: query plot aggs and one total from DB, as for plots.
  * [ ] Server: return round data as part of the JSON response, as base64 gzipped JSON.
  * [ ] Client: load matching rounds into a `dat` once, then query the same `dat` for each plot agg.
    * [ ] `datLoad` should also return the latest round it found.
  * [ ] When using local data, the plots must be live. However, we'll need to change how we update them. The current approach in `cmdPlotLocal` would cause redundant re-aggregations of the total. The total needs to become live by itself, independent of the plots.
* [ ] Options:
  * [ ] Take any number of `-p=` for plot presets. If at least one is provided, the provided set of presets overrides the default set of presets.
  * [ ] `-t` for plot totals.
* [ ] Replace `plot_link` with `run_link` which generates a link for the above.
* [ ] On app startup:
  * [ ] Auto-detect if the current URL is one of the old "plot link" style links, and interpret it as the new format, extracting the run id.
  * [ ] Replace `plotDefaultLocal` with invoking `show_run` for the latest local run.

---

Consider if the Web Authentication API and/or Web Credentials API could be relevant for us.

---

* [ ] Additional stat: estimated resources spent so far.
  * Can probably just store `bui_cost` for each building in a round.
  * In plots, it should automatically be possible to aggregate them by `sum`.

---

* [ ] Detect "expired" rounds (which only exist on disk during the defeat screen) and back them up too.
  * [ ] May need special handling when rollbacks are involved.

---

<!-- Support Ctrl+V for game files. Something like:
- If a JSON file is pasted:
  - Rename to `.gd`. (No need to encode.)
  - If name matches one of game files:
    - Backup original file.
    - Write new file.
  - Otherwise, show a file save dialog.
- If a JSON file is dragged-in: same as above.
- If JSON is pasted without a file name:
  - Show a file save dialog as `.gd`.
- If `.gd` is pasted: convert to JSON and show file save dialog.
- Consider adding a command:
  - Reads from clipboard.
  - Stores a file to a specified path, or shows a save dialog. -->

---

* [x] Support in-place decoding for `.gd` files, without renaming. Add as an option to the `show` command.

---

* [ ] Consider using a `SharedWorker` to deduplicate work between tabs. For example, the `DAT` cache and its querying could be moved there to reduce its RAM cost in cases where multiple tabs query the same data. Similarly, `watch` could be moved there; the backup messages would be broadcasted and seen in all tabs. This is probably silly overkill.

---

`sw.mjs`: when fetching a non-semver asset:
- Respond immediately from cache, hit the network in the background.
- If the responses differ (or more precisely: if the new app version is different; we'd have to parse it out of HTML), cache the new version and notify the app.
- In the UI: notify the user that an update has arrived and they should reload.

When offline on Windows, this would remove the initial delay on reload when the OS tries to work out if it's really offline.

The downside is that actual updates would require 2 reloads.

---

`edit`: it seems that locking a difficulty by editing can sometimes break its ingame UI tooltip on the commander + difficilty selection screen. Needs investigation.

---

`schema.mjs`: consider excluding non-weapon building upgrades from cost efficiency analysis.
