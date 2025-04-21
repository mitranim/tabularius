/*
Must be kept in sync with the data definitions in `schema.mjs`.
*/

create table schema_version (
  id bool primary key default true check (id),
  val int not null
);

/*
There is no primary key because facts are always aggregated and never referenced.

The constraints are for dev/debug purposes. TODO avoid them in production.
We validate those fields in JS before creating facts(see `datAddRound`),
so the DB-level constraints are redundant and waste performance.

TODO consider supporting (not in the data, but in the code) the ability to group
on combinations of fields, for example (user_id, run_num).

TODO consider removing the columns listed below, because they are equivalent to
composite keys. We'd need to implement special support for decomposing those
keys into combinations of columns in our `apiPlotAgg`. The purpose of that
change would be to save storage space, and possibly improve query performance.
We're unable to evaluate this optimization until our data is large. When our
data does get large, we're able to re-derive the DB data from the source data.

- `run_id`           = `user_id, run_num`
- `round_id`         = `user_id, run_num, round_num`
- `run_round_bui_id` = `user_id, run_num, round_num, bui_inst`
*/
create table facts (
  time_ms          bigint not null,
  user_id          text   not null,
  run_id           text   not null,
  run_num          int    not null,
  round_id         text   not null,
  round_num        int    not null,
  bui_inst         int    not null,
  run_round_bui_id text   not null,
  hero             text   not null,
  diff             int    not null,
  frontier_diff    int    not null,
  bui_type         text   not null,
  bui_type_upg     text   not null,
  ent_type         text   not null,
  chi_type         text   not null,
  stat_type        text   not null,
  stat_val         double not null

  -- Sanity checks. Enable in development, disable in production.
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
