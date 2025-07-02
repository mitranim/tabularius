Also see `todo.md` in repo root.

- [x] Implement separate tables for bui, chi, wep.
- [x] Rename the commands, prioritize the one that makes separate tables.
- [ ] CLI option to choose default table type.
- [ ] Colors! More colors.
  - [ ] Assign specific colors to specific entities, like in plots, or:
  - [ ] Implement a heatmap. Maybe assign a color per stat type, and shade it.
- [ ] Update help. The help for each version of the command should mention the
  other version of the command.

- [x] Local sources.
  - [x] If no path provided:
    - [x] If have access to `saves`:
      - [x] Inspect `Progress.gd`. If `.RoundIndex > 0`, use it.
    - [x] If no access to `saves` or not `.RoundIndex > 0`, fall back on
      `history`, looking for `latest/latest`.
    - [x] If neither:
      - [x] If one of the accesses is missing: print an error message
        encouraging to grant access to `saves` and/or `history`.
  - [x] If path is provided:
    - [x] If file, verify that it's a round file, and use.
- [x] Cloud sources.
  - [x] Requires backend support for downloading round files as-is.
    - [x] Add an endpoint for downloading one specific round file, by the
      `<user>/<run>/<round>` path. Stream `.json.gz` from disk as-is; don't
      forget to set `content-encoding`.
- [x] Decode the round; add an element with various details in the media grid.
- [x] When local, the data is live.
  - [x] On any watch broadcast: grab the round data from the event, don't need
    to read any files.
  - [x] Preserve any user-made changes, such as expand / collapse, sort, etc.
- [ ] Add "left" and "right" buttons for showing prev / next rounds.
- [x] Implement `addCloseBtn`, place the button properly.
- [x] Tooltips to un-abbreviate various stats, via `ui.withTooltip`.
- [x] Add the clickable `show_round` command args to the header, like in plots.
- [ ] When created by `show_run`, _also_ include the `show_run` command.
- [ ] Flexible grouping options, like in `plot`.
  - [x] Group stats by building instance.
  - [ ] Make it possible to group stats by `bui_type`.
  - [ ] Make it possible to group stats by `bui_type_upg`.
- [x] Add an option to always "zero last" in sorting, which would always put zero and nil at the end.
- [x] Calculate totals and percentages for child stats.
- [x] Show blueprints, as collapsable similar to doctrines.

- [x] Each bui:
  - [x] One row: bui stats.
  - [x] Indicate how many [weps + chis] the bui has.
  - [x] If have at least 2 [weps + chis]: a row with sub-table for their stats.
  - [x] If exactly one 1 wep or chi: replace chi count indicator with its name, don't render subtable for its stats.
  - [x] If have weps: a row with sub-table for wep details.
  - [x] Clicking bui row toggles all of its subtable rows.
  - [x] Wep details table:
    - [x] Headers: wep property columns.
    - [x] One row per wep: various properties of that wep.
  - [x] Deduplicate chis and weps, similar to `datAddRound`:
    - Loop `.Weapons`, register types of weps and bullets.
    - Loop `.ChildLiveStats`, find non-wep, non-bullet chis.
  - [x] Columns: key fields and stats.
    - [x] First col: type, converted to name if possible.
      - [x] Wep or chi: indented.
      - [x] Bui: include count of weps and chis; if only one, inline its type.
      - [x] Use `trunc`.

- [ ] Wep cols:
  - [x] Type, indented.
  - [x] If `.IsAntiAircraft`: see below.
  - [x] From dummy bullet:
    - Combine `.AircraftModifier` and `.AntiAircraftModifier`.
      - If `..IsAntiAircraft`: add an AA icon indicator.
    - `.AntiShieldModifier`.
    - `.MaxTarget`.
    - `.SizeValue`: separate + `reify`.
    - `.Damage`: separate + `reify`.
  - [x] Stats: from corresponding `.WeaponStats` of bui.
  - [ ] Calculate final damage values for different target types.
  - [ ] Consider estimating DPS. Calculate approximate min and max, display as range. Calculate for different target types, too.
  - [ ] Add percentages:
    - [ ] For each computed value: instead of raw and percentage being separate, put calculated final value and percentage in one cell, subject to the global toggle. The percentage is shown as a modifier, slightly green / red depending on sign. Just like the game does it.
    - [ ] Column for `dmg_air`.
    - [ ] Column for `dmg_shield`.

- [x] Chi cols:
  - Type, indented.
  - Various stats from bui `.ChildLiveStats`.
- [x] Collapse weps and chis by default.
  - [x] Clicking the bui row expands or collapses weps and chis.
  - [x] Persist this preference.
- [ ] Support hiding / showing columns. One possible approach: have a
  `<details>` near the table with a list of columns and checkboxes.
- [x] Unlike `datAddRound`, include neutrals.
- [x] All columns are sortable.
  - [x] Default sorting: same as in round data.
  - [x] Clicking a column cycles through: desc, asc, none.
  - [x] Persist the sort preference.
  - [x] Sorting uses `compareAsc` and `compareDesc`, which support numbers.
- [x] By default, only show a certain number of buildings, with a final row
  showing how many are hidden and expand / collapse on click. Persist the
  expand / collapse preference for this.
- [x] An option to take up an entire grid row in the media.
  - [x] Persist this preference.
- [x] Hide less-important columns when container is narrow.
- [ ] Heatmap: in each column, indicate higher-performing rows with a color,
  as a gradient between worst and best, by comparing the "canonical" values
  which are also used for sorting.
- [ ] Table headers: `sticky` with proper `top` and a background. Tricky because of sub-tables. Probably need to enforce a fixed header height, and provide it as an offset when stacking.
- [x] Actually show the damage of non-weapon children, such as Grenadier variants and Anysia.
- [ ] Show which neutrals are active and not.

- [x] Each cell: store the corresponding header key on creation.
- [x] Each cell: store the sortable value on creation.
- [x] Each row: lazily build an index of keys to cells.
- [x] Each row: return sortable value from matching cell.
- [x] Actually sort by those.
- [x] If we still have pseudo-theads, skip those, or rather bundle
  them with the corresponding "parent" rows.

`BuiRow`:
- [x] Proper styling.
- [x] On click:
  - [x] Toggle sub-rows of this bui row.
  - [x] Persist preference which specific bui row was expanded, by bui id.

`wepDetailRow`:
- [x] Proper styling.
- [x] Proper `trunc` in all cells.
