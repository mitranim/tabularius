* [ ] When zoomed-in, totals should be calculated only for the currently _visible_ ranges in the plot. In addition, series without data points in the zoomed area should be excluded from the legend.

---

Auto-updating. First from local data, then from cloud data. Demos:

https://leeoniya.github.io/uPlot/demos/stream-data.html
https://leeoniya.github.io/uPlot/demos/pixel-align.html
https://leeoniya.github.io/uPlot/demos/sine-stream.html

The file watcher needs to send new data to the plot.

* [x] Local.
* [ ] Cloud.

---

Button to toggle all series.

---

When the cursor is near many near-overlapping data points (within a certain proximity threshold), we should group them up, and include all in a tooltip.

---

* [x] Consider if even in damage per round plots, it's not useful to have a plot where values just go up as the rounds progress. Perhaps we should normalize the values per round in such a way that comparisons between rounds are meaningful.
  * Done via `-s=log`.

---

Support ranges for numeric filters: `< <= >= >`.
- [ ] `run_ms`
- [ ] `run_num`
- [ ] `round_ms`
- [ ] `round_num`
- [ ] `stat_val`
- [ ] `game_ver`
  * For efficient comparisons in SQL, normalize to a single integer.
  * In SQL, we could use `int64`, but for full compatibility with JS, we have to use `int32`, allocating 10 bits for each component; `0..1023` is realistically enough.
  * In JS, bitwise operation coerce the number to `int32`. As a result, part of the 45-bit range in `Number.MAX_SAFE_INTEGER` is unavailable.

---

In `help plot`, unusable / useless parameters should be shown but disabled (greyed out). For example, when not logged in, current user filter; when cloud is unavailable, cloud-related stuff; when FS unavailable, local-only stuff.

---

More presets.

TODO learn the lesson: we tried having defaults on various plot agg parameters, in the name of convenience and efficiency, and then we ended up with covariance between defaults and various options that disable various defaults, and the complexity blew up in our face. Not only was it hard to maintain across the codebase, since we have multiple querying implementations that had to support the defaults, but more importantly, it would be harder for the users to intuit how that stuff even works. Moral of the story: never use defaults, always use full presets; every feature is off by default, in every system, every time.

---

FIXME:
* [x] Drop default `run_id=current` from all presets; update warnings.
* [ ] Drop default `user_id=current` from all presets; update warnings.

---

* [ ] Support `latest` for rounds, like for runs.

---

Support bar plots to allow non-numeric X or Y.

* https://leeoniya.github.io/uPlot/demos/bars-grouped-stacked.html
* https://leeoniya.github.io/uPlot/demos/multi-bars.html

---

* [ ] `help plot`: collapse the listings of all known values for various options, like in `help edit`.
* [ ] List known values from `game_const.mjs` for various filters, similar to `help edit`:
  * `bui_type`
  * `ent_type`
  * `chi_type`
  * `stat_type`
  * `hero`
  * `diff` (list inline)
  * `frontier` (list inline)

---

* [x] When rendering a plot, show additional metadata such as:
- Set of unique `user_id` in the facts.
- Set of unique `run_id` in the facts.
- Set of unique `round_id` in the facts.

---

More diverse distribution of `FG_COLORS`.

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

* [ ] Add a search input for filtering series.

---

* [ ] Rename "plot totals" to something better. Maybe "plot summary".

---

Consider switching to an SVG-based plotting library. Motive: responsive scaling should be much easier. There's plenty of bloated choices, but we want something about as tiny and fast as Uplot.

If all SVG plotting libraries are slow, we're not interested.

---

* [ ] Make it possible to focus plot series by clicking lines or data points. Currently it requires clicking labels.

---

* [x] In help and plot titles, add tooltips which expand abbreviated terms to longer ones.
* [x] Add missing glossary entries.
* [x] Add dotted underlines to tooltipped terms which don't have them, like in plot titles (but no color indicator).
* [x] Add glossary tooltips to more occurrences of abbreviated terms.
* [ ] In multi-entry append/replace buttons, add tooltips to individual entries.

---

* [ ] Add an option to show Y as `%` of total per X.
* [ ] Implement by post-processing plot aggs, for any stat type. Does not require new stat types.
* [ ] Plot tooltip: show both the value and the percentage, by default.

---

Toggling a series should affect _all_ plots.

---

* [x] When `-a` is not `count`, count the data points anyway, and display the resulting counts in labels and tooltips.

---

* [ ] Schema and `plot`: HQ HP stat.

---

* [ ] When zoomed-in, make it possible to move the window by dragging the axis.
  * The feature can be viewed in Plotly (flashbang): https://plotly.com/javascript/log-plot/.
  * Check if Uplot has support.
  * Consider if dragging Y should only move the maximum, instead of a window.

---

* [ ] Schema / `plot`: more stat types:
  * [ ] `hq_hp`
  * [ ] `hq_hp_max`
  * [ ] `supply`
  * [ ] `recon`
  * [ ] `tech`
* [ ] A preset that plots all the stats above (with `-z=stat`).
* [ ] Another possible stat: `uptime`?

---

On Shift+click of legend labels, prevent text selection.

---

It seems that sometimes totals in `plot -p=dmg -z=bui_type` don't match `dmg_done_acc` values, even when no rounds were skipped. Need a repro.

---

Plot placeholder: when _all_ plots fail, and the placeholder is empty, show errors in the placeholder.