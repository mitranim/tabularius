-include .env.default.properties
-include .env.properties

MAKEFLAGS := --silent --always-make
MAKE_CONC := $(MAKE) -j 128 clear=$(or $(clear),false)
CLEAR ?= $(if $(filter false,$(clear)),, )
DENO_RUN ?= deno run -A --no-check
BUN_RUN ?= bun run
WATCH ?= watchexec $(and $(CLEAR),-c) -r -d=1ms -n -q
WATCH_JS ?= $(WATCH) -e=mjs
JS_WATCH_OPT ?= $(if $(CLEAR),,--no-clear-screen)
RUN ?= $(and $(run),--run="$(run)")
SERVER_TEST ?= $(or $(file),server/test.mjs)
SERVER_BENCH ?= $(or $(file),server/bench.mjs)
SHARED_TEST ?= $(or $(file),shared/test.mjs)
SHARED_TEST ?= $(or $(file),shared/bench.mjs)
PROJECT ?= tabularius
DOCKER_LABEL ?= label=project=$(PROJECT)
DOCKER_TAG_LATEST_DEV ?= $(PROJECT):latest_dev
DOCKER_TAG_LATEST ?= $(PROJECT):latest
DOCKER_ENV ?= --env-file=.env.default.properties
DOCKER_VOL_PWD ?= -v=$(PWD):/app
DOCKER_VOL_DATA ?= -v=$(PWD)/$(DATA_DIR):/app/$(DATA_DIR)
DOCKER_PORTS ?= -p=$(SRV_PORT):$(SRV_PORT)
DOCKER_BUILD ?= docker build --build-arg=PROJECT=$(PROJECT)
DOCKER_RUN ?= docker run --init -it $(DOCKER_ENV)
ESLINT_VER ?= 9.31.0
ESLINT_OPT ?= --ignore-pattern=local .
SRV ?= server/srv.mjs
OK = echo [$@] ok

# SYNC[test_tmp_dir]
TEST_TMP_DIR := .test_tmp

ifeq ($(engine),bun)
	JS_RUN ?= $(BUN_RUN)
	ESLINT ?= bunx --bun eslint@$(ESLINT_VER) $(ESLINT_OPT)
else
	JS_RUN ?= $(DENO_RUN)
	ESLINT ?= $(DENO_RUN) npm:eslint@$(ESLINT_VER) $(ESLINT_OPT)
endif


ifeq ($(engine),bun)
	JS_WATCH ?= $(JS_RUN) --watch $(JS_WATCH_OPT)
	JS_WATCH_HOT ?= $(JS_RUN) --hot $(JS_WATCH_OPT)
else
	JS_WATCH ?= $(JS_RUN) --watch --quiet $(JS_WATCH_OPT)
	JS_WATCH_HOT ?= $(JS_RUN) --watch-hmr --quiet $(JS_WATCH_OPT)
endif

help: # Print help.
	echo "Select one of the following commands."
	echo "Run \`make -n <command_name>\` to see its definition."
	echo "Recommended default for development: \`make dev_w\`."
	echo
	for val in $(MAKEFILE_LIST); do \
		grep -E '^\S+:' $$val | sed 's/:.*#/#--/;s/:.*$$/#--/;s/^/  /' | column -t -s '#' | uniq || true; \
	done
	echo

dev_w: # Dev mode with full auto-reload.
	$(MAKE_CONC) live srv_w

dev: # Dev with auto-reload but without auto-restart.
	$(MAKE_CONC) live srv

dev_w dev srv_w srv: export DEV := $(DEV)
dev_w dev srv_w srv: export LOCAL := $(LOCAL)
srv_w srv: export SRV_HOST := $(SRV_HOST)
srv_w srv: export SRV_PORT := $(SRV_PORT)
dev_w dev live: export LIVE_PORT := $(LIVE_PORT)
srv_w srv: export LOG_DEBUG := $(LOG_DEBUG)
srv_w srv: export DATA_DIR := $(DATA_DIR)
srv_w srv: export DB_FILE := $(DB_FILE)
srv_w srv server_test_w server_test: export TMP_DIR := $(TMP_DIR)

srv_w: # Run server with auto-restart.
	$(JS_WATCH_HOT) $(SRV)

srv: # Run server without auto-restart.
	$(JS_RUN) $(SRV)

live: # Run "live reload" server.
	$(JS_RUN) server/live.mjs

run_w: # Run JS `file` in watch mode.
	$(JS_WATCH) $(file)

run: # Run JS `file`.
	$(JS_RUN) $(file)

clean: # Drop temp dirs.
	rm -rf $(TMP_DIR) $(TEST_TMP_DIR)

server_test_w server_test shared_test_w shared_test: export TEST := true
server_test_w server_test shared_test_w shared_test: export LOG_DEBUG := $(LOG_DEBUG)

server_test_w: # Run server tests in watch mode.
	$(JS_WATCH) $(SERVER_TEST) $(RUN)

server_test: # Run server tests once.
	$(JS_RUN) $(SERVER_TEST) $(RUN)

server_bench_w: # Run server benchmarks in watch mode.
	$(JS_WATCH) $(SERVER_BENCH) $(RUN)

server_bench: # Run server benchmarks once.
	$(JS_RUN) $(SERVER_BENCH) $(RUN)

shared_test_w: # Run shared tests in watch mode.
	$(JS_WATCH) $(SHARED_TEST) $(RUN)

shared_test: # Run shared tests once.
	$(JS_RUN) $(SHARED_TEST) $(RUN)

shared_bench_w: # Run shared benchmarks in watch mode.
	$(JS_WATCH) $(SHARED_BENCH) $(RUN)

shared_bench: # Run shared benchmarks once.
	$(JS_RUN) $(SHARED_BENCH) $(RUN)

mig_samples: # Run migration for sample files.
	$(JS_RUN) server/mig_samples.mjs

duck: # Open `DB_FILE` with DuckDB.
	duckdb $(DB_FILE) $(args)

duck_script: # Run SQL `file` on `DB_FILE` with DuckDB.
	duckdb $(DB_FILE) < $(file)

duck_script_mem: # Run SQL `file` on in-memory DuckDB.
	duckdb < $(file)

duck_attach_dev: # Attach DuckDB to local `/api/db`; read-only.
	duckdb -cmd "attach 'http://localhost:$(SRV_PORT)/api/db' as db; use db;"

duck_attach_prod: # Attach DuckDB to prod `/api/db`; read-only.
	duckdb -cmd "attach 'https://tabularius.mitranim.com/api/db' as db; use db;"

db_dump_prod: # Dump prod DB to `out_path`.
	curl https://tabularius.mitranim.com/api/db > "$(out_path)"

lint_w: # Run all linters in watch mode.
	$(MAKE_CONC) lint_deno_w lint_eslint_w

lint: lint_deno lint_eslint # Run all linters once.

lint_deno_w: # Run Deno lint in watch mode.
	$(WATCH_JS) -- $(MAKE) lint_deno

lint_deno: # Run Deno lint once.
	deno lint

lint_eslint_w: # Run Eslint in watch mode.
	$(WATCH_JS) -- $(MAKE) lint_eslint

lint_eslint: # Run Eslint once.
	$(ESLINT)
	$(OK)

docker_build_dev: # Build Docker image for development (no app files).
	$(DOCKER_BUILD) -t=$(DOCKER_TAG_LATEST_DEV) -f=dockerfile_dev

docker_build: # Build Docker image in production mode.
	$(DOCKER_BUILD) -t=$(DOCKER_TAG_LATEST) -f=dockerfile

# The `--init` flag in `DOCKER_RUN` seem to be required for being able to kill
# this with Ctrl+C. FS watching and change detection doesn't seem to work here.
# Restarting the server requires restarting the container.
docker_srv_dev: # Run server in Docker in dev mode.
	$(DOCKER_RUN) $(DOCKER_PORTS) $(DOCKER_VOL_PWD) $(DOCKER_TAG_LATEST_DEV) run -A $(SRV)

docker_srv: # Run server in Docker in prod mode.
	$(DOCKER_RUN) $(DOCKER_PORTS) $(DOCKER_VOL_DATA) $(DOCKER_TAG_LATEST) run -A $(SRV)

docker_sh: # Run Docker container interactively.
	$(DOCKER_RUN) $(DOCKER_VOL_DATA) --entrypoint=/bin/ash $(DOCKER_TAG_LATEST)

docker_clean: # Prune Docker images created by this app.
	docker image prune -f --filter $(DOCKER_LABEL)

docker_ls: # List Docker images created by this app.
	docker images --filter $(DOCKER_LABEL)

fly_deploy: # Deploy to `fly.io`.
	fly deploy --yes

fly_repl: # Connect to our machine on `fly.io`.
	fly ssh console -a tabularius

fly_file: # Dowload remote `src_path` to local `out_path`.
	fly ssh sftp get -a tabularius /app/data/$(src_path) local/$(out_path)

define HOOK_PRE_COMMIT_CODE
#!/bin/sh
cp .gitignore .dockerignore
endef
export HOOK_PRE_COMMIT_CODE
HOOK_PRE_COMMIT_FILE := .git/hooks/pre-commit

hook: # Create Git hook which syncs "ignore" files.
	echo "$${HOOK_PRE_COMMIT_CODE}" > $(HOOK_PRE_COMMIT_FILE)
	chmod +x $(HOOK_PRE_COMMIT_FILE)
