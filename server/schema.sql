/*
Must be kept in sync with the data definitions in `schema.mjs`.
*/

create table schema_version (
  id bool primary key default true check (id),
  val int not null
);

/*
There is no primary key because facts are always aggregated and never referenced.

`game_ver` must be normalized to our strict semver format; see `Semver`.

TODO consider supporting (not in the data, but in the code) the ability to group
on combinations of fields, for example (user_id, run_num).

TODO consider removing the columns listed below, because they are equivalent to
composite keys. We'd need to implement special support for decomposing those
keys into combinations of columns in our `apiPlotAgg`. The purpose of that
change would be to save storage space, and possibly improve query performance.
We're unable to evaluate this optimization until our data is large. When our
data does get large, we're able to re-derive the DB data from the source data.

  - `run_id`           = `user_id, run_num, run_ms`
  - `round_id`         = `user_id, run_num, run_ms, round_num`
  - `run_round_bui_id` = `user_id, run_num, run_ms, round_num, bui_inst`

TODO consider switching to a proper star schema, offloading various fields to
dimensions, while preserving the same querying interface. Some columns would be
"virtual": when they're present in a client query, we join the necessary table
to the facts. Ideally, when joining, we grab only those columns from the other
table, instead of everything. The purpose would be to reduce the size of the
`facts` table, but it would make queries significantly more complex. The true
impact on size and performance is unknown.
*/
create table facts (
  game_ver         text   not null,
  user_id          text   not null,
  run_id           text   not null,
  run_num          int    not null,
  run_ms           bigint not null,
  round_id         text   not null,
  round_num        int    not null,
  round_ms         bigint not null,
  bui_inst         int    not null,
  run_bui_id       text   not null,
  run_round_bui_id text   not null,
  hero             text   not null,
  diff             int    not null,
  frontier         int    not null,
  bui_type         text   not null,
  bui_type_upg     text   not null,
  ent_type         text   not null,
  chi_type         text   not null,
  stat_type        text   not null,
  stat_val         double not null

  /*
  Sanity checks. Enable in development, disable in production.
  We validate this in JS before creating facts; see `datAddRound`.
  DB-level constraints are redundant and waste performance.
  */
  /*
  constraint "facts.user_id"      check (user_id      <> ''),
  constraint "facts.round_num"    check (round_num    >  0),
  constraint "facts.bui_inst"     check (bui_inst     <> 0),
  constraint "facts.hero"         check (hero         <> ''),
  constraint "facts.bui_type"     check (bui_type     <> ''),
  constraint "facts.bui_type_upg" check (bui_type_upg <> ''),
  constraint "facts.ent_type"     check (ent_type     <> ''),
  constraint "facts.stat_type"    check (stat_type    <> '')
  */
);
