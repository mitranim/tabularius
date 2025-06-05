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

* [ ] Plot: when zoomed-in, totals should be calculated only for the currently _visible_ ranges in the chart. In addition, series without data points in the zoomed area should be excluded from the legend.

---

Plot auto-updating. First from local data, then from cloud data. Demos:

https://leeoniya.github.io/uPlot/demos/stream-data.html
https://leeoniya.github.io/uPlot/demos/pixel-align.html
https://leeoniya.github.io/uPlot/demos/sine-stream.html

The file watcher needs to send new data to the plot.

* [x] Local.
* [ ] Cloud.

---

Plot: button to toggle all series.

---

Plot: when the cursor is near many near-overlapping data points (within a certain proximity threshold), we should group them up, and include all in a tooltip.

---

Plot: when grouping multiple sources, such as buildings or weapons, into one series, indicate the count of grouped entries in the label. Might be WONTFIX because the count _changes_ between rounds.

---

Plot: consider if even in damage per round charts, it's not useful to have a chart where values just go up as the rounds progress. Perhaps we should normalize the values per round in such a way that comparisons between rounds are meaningful.

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

The `analyze` command (now `plot`) should support specifying multiple runs, run ranges, filters, or simply grabbing everything.

---

When plotting over all cloud data, we should have an option to limit to only the latest game version, and an option to limit by date. It's useful to be able to prefer recent data over old data (outdata, if you will). When no other filter is provided, this should probably be the default. Limiting the data recency also prevents this from getting slower with time and data.

---

More interactive logging, particularly for chains of operations. Examples:

* [x] `help` -> every command name is a clickable button.
* [x] Any command help -> every example is a clickable button.
* [x] Similar for other commands, wherever possible.
* [ ] `plot` -> help includes `plot ps` -> clickable -> list of run ids which are clickable and thus plottable (either local or remote, depending on `-s`).

---

Top right: collapse text into icons: Steam (add TD link), Discord, Github.

---

Make plot titles human-readable.

---

Keyboard hotkeys for activating visible clickables in the log. For example, holding Alt might enumerate them and show numbers; pressing a number activates the corresponding clickable.

---

Have something clickable somewhere which is always displayed which runs `help`, so you can never be without help. Maybe on the left side of the prompt. (Some kinda "home" or "help" emoji maybe.)

---

In `plot` help, unusable / useless parameters should be shown but disabled (greyed out). For example, when not logged in, current user filter; when cloud is unavailable, cloud-related stuff; when FS unavailable, local-only stuff.

---

Make a YouTube video guide. Maybe get Claude Code to analyze the app and write a script for the video.

---

Consider how to auto-update cloud-based plots.

---

`plot`: more presets.

TODO learn the lesson: we tried having defaults on various plot agg parameters, in the name of convenience and efficiency, and then we ended up with covariance between defaults and various options that disable various defaults, and the complexity blew up in our face. Not only was it hard to maintain across the codebase, since we have multiple querying implementations that had to support the defaults, but more importantly, it would be harder for the users to intuit how that stuff even works. Moral of the story: never use defaults, always use full presets; every feature is off by default, in every system, every time.

---

`plot`: filters should support `< <= >= >` for numeric ranges, such as `roundNum`, `runNum`, maybe `statValue`.

---

`plot`: support `latest` for rounds, like for runs.

---

`plot`: support bar charts to allow non-numeric X or Y.

* https://leeoniya.github.io/uPlot/demos/bars-grouped-stacked.html
* https://leeoniya.github.io/uPlot/demos/multi-bars.html

---

* [ ] `help plot`: collapse the listings of all known values for various options.
* [ ] List known values from `game_const.mjs` for various filters, similar to `help edit`:
  * `bui_type`
  * `ent_type`
  * `chi_type`
  * `stat_type`
  * `hero`
  * `diff` (list inline)
  * `frontier` (list inline)

---

`plot`: when plotting child facts, include their types into labels.

---

`plot`: when `run_id` or `round_id` is specified, disregard `user_id` instead of filtering by current user.

Note: we're migrating to a new system where `run_id` and `round_id` are ephemeral, and only exist in client data. The server might end up with special cases for them, decomposing them into composite keys. It needs to observe the same rule.

---

`plot`: when rendering a plot, show additional metadata such as:
- Set of unique `user_id` in the facts.
- Set of unique `run_id` in the facts.
- Set of unique `round_id` in the facts.

---

Client: bundle and minify for production.

Bundling is a pain, but it avoids another pain: our modules other than `client/main.mjs` tend to be cached by browsers, which often causes them to be not properly updated on deployments.

Alternatively, get around that with `sw.mjs`.

---

Change the color scheme (both light and dark) to what I use in ST.

---

`plot.mjs`: more diverse distribution of `FG_COLORS`.

---

`watch`: not reliable enough, needs to retry local files harder.

---

Various `plot` enhancements.

* [x] When waiting for plot agg data (either cloud or local), indicate that in the media.
  * [x] The sample plot placeholder has a method to increment or decrement the count of pending plots; when count > 0, it says "plot loading" or something like that. `cmdPlot` uses `try/finally` to modify the count.
* [x] `plot_link` generates a link.
  * [x] By default, orders multiple plots, with various presets, for the same filter, which is the current user's latest cloud run (but with fixed `run_num` or `run_id`).
  * ~~[ ] Takes arbitrary plot options as overrides.~~
  * ~~[ ] An override on `user_id` cancels the default `user_id=current`.~~
  * ~~[ ] An override on `run_id` or `run_num` cancels the default `run_id=latest`.~~
  * [x] Copy link to clipboard.
  * [x] Print to log, something like: `plot URL <url> copied to clipboard` where the link is clickable (tarblan) with an indicator that it's external.
* [ ] Cloud-based plots should have a shareable link somewhere.
* [ ] `watch`:
  * [ ] Print run plot link when run ends.
    * [ ] Detection 1: when new run begins.
    * [ ] Detection 2: when run reaches last wave for that difficulty.
    * [ ] Avoid duplication.

---

* [x] `plot`:
  * [x] Show various info about the found data (only when data is found):
    * Which `user_id`, `run_id`, `run_num` were found. Maybe more.
    * [x] Print in terminal.
    * [x] Consider making this optional (a toggle).
    * [x] Server: support in `apiPlotAgg`. Make it optional.
    * [x] Client: support in various places where we build and query `dat`.
  * [x] Have an optional CLI flag to enable this.
    * [x] When mentioned once with an empty value, it counts as a boolean.
    * [x] When mentioned multiple times, it acts as a filter, requesting totals only on those keys.
  * [x] Add the CLI flag either to all presets, or to `plot_link`.
  * [x] Querying (only if enabled):
    * [x] Server: just run an additional query on `facts`.
    * [x] Client: build totals while aggregating from facts, see `plotAggAddFact`.
  * [x] Client: print in log, one line per stat (count + values on the same line), stat shown only if count >= 1, values collapsed by default unless exactly 1.
    * [x] `cmdPlotLocal`: totals must be live.
  * Showing totals in terminal (only when enabled):
    * [x] Multiple lines. Each line:
      * [x] Stat name.
      * [x] Count. Show only when non-0.
      * [x] Sample values: collapsed by default, expandable `<details>`.
  * [x] `chi_type`: only if `ent_type=run_round_bui_chi`.

Additional:
* [x] Make sure it works with `dropEmptySeries`. Tricky on both server and client.
* [ ] Maybe show some totals in plot (under, or in title).
  * Not the same as the totals of the Y values per X and Z, which we already have.

---

Find out where the game stores its "foes in current run" information.

---

`plot`: consider removing the default `user_id=current` and `run_id=all` filters from all presets, and altering the warnings.

---

Add `active:` indicators to all buttons and maybe some links.

---

`plot`: add a search bar to each plot for filtering series.

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

* [ ] Rename "plot totals" to something better. Maybe "plot summary".

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

Consider switching to an SVG-based plotting library. Motive: responsive scaling should be much easier. There's plenty of bloated choices, but we want something about as tiny and fast as Uplot.

If all SVG plotting libraries are slow, we're not interested.

---

`plot`: make it possible to focus plot series by clicking lines or data points.

---

Provide an ability to find a specific run that matches the provided filters. Maybe something like `run_id=one` or `run_limit=1`.

---

Consolidate exclusion of empty plot series between plot agg and plot totals, or rather add it to plot totals.

---

Plot totals: add `round_num`.

---

* [ ] Add a `make` command or script for backing up cloud data by downloading, preferably the entire volume.

---

* [ ] Add a command for downloading all of a user's cloud backups, either merging them into the history dir, or (as an option) placing into a sub-dir.

---

* [ ] `plot`: add a flag acting as a shortcut for `user_id=all run_id=all`.

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

* [x] `plot`: in help and plot titles, add tooltips which expand abbreviated terms to longer ones.
* [x] Add missing glossary entries.
* [x] Add dotted underlines to tooltipped terms which don't have them, like in plot titles (but no color indicator).
* [x] Add glossary tooltips to more occurrences of abbreviated terms.
* [ ] In multi-entry append/replace buttons, add tooltips to individual entries.

---

* [ ] `plot`: add an option to show Y as `%` of total per X.
* [ ] Implement by post-processing plot aggs, for any stat type. Does not require new stat types.
* [ ] Plot tooltip: show both the value and the percentage, by default.

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

`plot`: toggling a series should affect _all_ plots. Maybe even those which are added later.

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
  * [ ] In the titlebar: the version indicator changes its appearance and suggests reloading to update.

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

* [ ] Add a new command (tentative name `show_round`) for showing a breakdown of a round, with various damage / efficiency stats, _and_ with weapon details. This is a new media type.
  * [ ] At the top: various run details: game version, run number, round number, commander, difficulty, frontier, HQ HP, etc.
  * [ ] Below: collapsed, expandable groups of doctrines:
    * - [ ] Regular doctrines.
    * - [ ] Frontier curses.
    * - [ ] Frontier dotations.
    * - [ ] Frontier modifiers.
  * [ ] Below: table with various stats.
    - [ ] The table has two levels: top level for stats, and sub-level for weapon details.
    - [ ] For each building:
      - [ ] One row for its own stats.
      - [ ] One row for each statful weapon, with stats for that weapon.
        - Statful weapon is defined as either currently enabled, or having had dealt some damage at any point during the run.
      - [ ] One row for each non-weapon, non-bullet child, with its stats.
      - [ ] If has at least one statful weapon:
        - [ ] Add a full-colspan row below, which contains a sub-table.
        - [ ] One row per statful weapon.
        - [ ] Each row describes various details of that weapon: damage, rof, reload, mag, range, targeting, detection, and other properties.
    - [ ] By default, weapon and child rows are collapsed (hidden).
      - [ ] Clicking a building row toggles the weapon and child rows.
      - [ ] The row containing the weapon details sub-table is toggled by clicking another row, just above it.
      - [ ] Persist the latest "show"/"hide" preference for the toggled row type to storage, respect it for new tables.
    - [ ] Support sorting by any column.
      - [ ] Clicking a `th` cycles between sort types: desc, asc, none.
      - [ ] Persist the latest sorting preference to storage, respect it for new tables.
    - [ ] Stat cells have multiple numbers, displayed in a 2x2 fashion:
      - [ ] Top left: value this round.
      - [ ] Top right: % of value this round among all entities of this kind (bui vs (wep|chi)).
      - [ ] Bottom left: accumulated value this run.
      - [ ] Bottom right: % of accumulated value this run.
      - [ ] Dim all except one (value this round), which is "canonical" and used for sorting.
    - [ ] Use overflow ellipsis (our `trunc` class) in all cells, except for the cells which contain sub-tables. Ensure it works properly.
    - [ ] Use `@container` queries to hide less-important columns when the container is narrow.

---

* [ ] Add a new command (tentative name `show_run`) which takes a run id (for cloud stuff) or a run num (for local stuff) and renders various default analyses (currently plots, but more in the future).
  * [x] Preliminary implementation: only local and manual.
  * [ ] Server: add an endpoint that takes a run id and returns the data needed for this command.
  * [ ] Client: an analogous function.
  * [ ] Both environments:
    * [ ] Find the run directory.
    * [ ] Iterate rounds, load them into a `dat`.
    * [ ] Query multiple plot aggs for the default plot presets.
    * [ ] Query a single plot total.
    * [ ] Return the resulting plot aggs and total.
    * [ ] Render multiple plots with one total.
    * [ ] When using local data, the plots must be live. However, we'll need to change how we update them. The current approach in `cmdPlotLocal` would cause redundant re-aggregations of the total. The total needs to become live by itself, independent of the plots.
    * [ ] After we implement `show_round`:
      * [ ] Server endpoint: if the opt-in query parameter `?include_round` is true, include the latest round in this run into the response, as base64 of gzipped JSON.
      * [ ] Client: use the latest round to render the equivalent of the output of `show_round` above the plots.
* [ ] Replace `plot_link` with `run_link` which generates a link for the above.
* [ ] On app startup:
  * [ ] Auto-detect if the current URL is one of the old "plot link" style links, and interpret it as the new format, extracting the run id.
  * [ ] Replace `plotDefaultLocal` with invoking `show_run` for the latest local run.