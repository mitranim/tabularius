-include .env.default.properties
-include .env.properties

MAKEFLAGS := --silent --always-make
MAKE_CONC := $(MAKE) -j 128 clear=$(or $(clear),false)
CLEAR ?= $(if $(filter false,$(clear)),, )
DENO_FLAGS ?= --node-modules-dir=false
DENO_RUN ?= deno run -A --no-check $(DENO_FLAGS)
DENO_WATCH ?= $(DENO_RUN) --watch $(or $(CLEAR),--no-clear-screen)
WATCH ?= watchexec $(and $(CLEAR),-c) -r -d=1ms -n -q
WATCH_JS ?= $(WATCH) -e=mjs
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
SRV ?= server/srv.mjs
OK = echo [$@] ok

# SYNC[test_tmp_dir]
TEST_TMP_DIR := .test_tmp

help:
	echo "Select one of the following commands."
	echo "Run \`make -n <command_name>\` to see its definition."
	echo "Recommended default for development: \`make dev.w\`."
	echo
	for val in $(MAKEFILE_LIST); do grep -E '^\S+:' $$val; done | sed 's/:.*//' | sort | uniq

dev_w dev: export DEV := $(or $(DEV),true)

dev_w:
	$(MAKE_CONC) live srv_w

dev:
	$(MAKE_CONC) live srv

dev_w dev: export DEV := $(DEV)
srv_w srv: export SRV_HOST := $(SRV_HOST)
srv_w srv: export SRV_PORT := $(SRV_PORT)
srv_w srv: export LIVE_PORT := $(LIVE_PORT)
srv_w srv: export LOG_DEBUG := $(LOG_DEBUG)
srv_w srv: export DATA_DIR := $(DATA_DIR)
srv_w srv: export DB_FILE := $(DB_FILE)
srv_w srv: export TMP_DIR := $(TMP_DIR)

srv_w:
	$(DENO_WATCH) $(SRV)

srv:
	$(DENO_RUN) $(SRV)

live: export LIVE_PORT := $(LIVE_PORT)
live:
	$(DENO_RUN) server/live.mjs

run_w:
	$(DENO_WATCH) $(run)

run:
	$(DENO_RUN) $(run)

clean:
	rm -rf $(TMP_DIR) $(TEST_TMP_DIR)

server_test_w server_test shared_test_w shared_test: export TEST := true
server_test_w server_test shared_test_w shared_test: export LOG_DEBUG := $(LOG_DEBUG)

server_test_w:
	$(DENO_WATCH) $(SERVER_TEST) $(RUN)

server_test: export LOG_DEBUG := $(LOG_DEBUG)
server_test:
	$(DENO_RUN) $(SERVER_TEST) $(RUN)

server_bench_w:
	$(DENO_WATCH) $(SERVER_BENCH) $(RUN)

server_bench:
	$(DENO_RUN) $(SERVER_BENCH) $(RUN)

shared_test_w:
	$(DENO_WATCH) $(SHARED_TEST) $(RUN)

shared_test:
	$(DENO_RUN) $(SHARED_TEST) $(RUN)

shared_bench_w:
	$(DENO_WATCH) $(SHARED_BENCH) $(RUN)

shared_bench:
	$(DENO_RUN) $(SHARED_BENCH) $(RUN)

mig_samples:
	$(DENO_RUN) server/mig_samples.mjs

repl:
	deno repl $(DENO_FLAGS) $(args)

duck:
	duckdb $(DB_FILE) $(args)

duck_script:
	duckdb $(DB_FILE) < $(file)

duck_script_mem:
	duckdb < $(file)

duck_attach_dev:
	duckdb -cmd "attach 'http://localhost:$(SRV_PORT)/api/db' as db; use db;"

duck_attach_prod:
	duckdb -cmd "attach 'https://tabularius.mitranim.com/api/db' as db; use db;"

lint_w:
	$(MAKE_CONC) lint_deno.w lint_eslint_w

lint: lint_deno lint_eslint

lint_deno_w:
	$(WATCH_JS) -- $(MAKE) lint_deno

lint_deno:
	deno lint

lint_eslint_w:
	$(WATCH_JS) -- $(MAKE) lint_eslint

lint_eslint:
	$(DENO_RUN) npm:eslint@9.29.0 --ignore-pattern=local .
	$(OK)

docker_build_dev:
	$(DOCKER_BUILD) -t=$(DOCKER_TAG_LATEST_DEV) -f=dockerfile_dev

docker_build:
	$(DOCKER_BUILD) -t=$(DOCKER_TAG_LATEST) -f=dockerfile

# The `--init` flag seems required for killing this with Ctrl+C.
# FS watching and change detection doesn't seem to work here.
# Restarting the server requires restarting the container.
docker_srv_dev:
	$(DOCKER_RUN) $(DOCKER_PORTS) $(DOCKER_VOL_PWD) $(DOCKER_TAG_LATEST_DEV) run -A $(SRV)

# The `--init` flag seems required for killing this with Ctrl+C.
docker_srv:
	$(DOCKER_RUN) $(DOCKER_PORTS) $(DOCKER_VOL_DATA) $(DOCKER_TAG_LATEST) run -A $(SRV)

docker_sh:
	docker run --init -it $(DOCKER_ENV) $(DOCKER_VOL_DATA) --entrypoint=/bin/ash $(DOCKER_TAG_LATEST)

docker_clean:
	docker image prune -f --filter $(DOCKER_LABEL)

docker_ls:
	docker images --filter $(DOCKER_LABEL)

fly_deploy:
	fly deploy --yes

fly_repl:
	fly ssh console -a tabularius

fly_file:
	fly ssh sftp get -a tabularius /app/data/$(src_path) local/$(out_path)

# Must provide `out_path=...`.
fly_db_dump:
	curl https://tabularius.mitranim.com/api/db > local/$(out_path)

define HOOK_PRE_COMMIT_CODE
#!/bin/sh
cp .gitignore .dockerignore
endef
export HOOK_PRE_COMMIT_CODE
HOOK_PRE_COMMIT_FILE := .git/hooks/pre-commit

# Should be run once, after cloning the repo.
hook:
	echo "$${HOOK_PRE_COMMIT_CODE}" > $(HOOK_PRE_COMMIT_FILE)
	chmod +x $(HOOK_PRE_COMMIT_FILE)
