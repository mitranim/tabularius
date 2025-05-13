-include .env.default.properties
-include .env.properties

MAKEFLAGS := --silent --always-make
MAKE_CONC := $(MAKE) -j 128 clear=$(or $(clear),false)
CLEAR ?= $(if $(filter false,$(clear)),, )
DENO_FLAGS ?= --node-modules-dir=false
DENO_RUN ?= deno run -A --no-check $(DENO_FLAGS)
DENO_WATCH ?= $(DENO_RUN) --watch $(if $(CLEAR),,--no-clear-screen)
PROJECT ?= tabularius
DOCKER_LABEL ?= label=project=$(PROJECT)
DOCKER_TAG_LATEST_DEV ?= $(PROJECT):latest_dev
DOCKER_TAG_LATEST ?= $(PROJECT):latest
DOCKER_ENV ?= --env-file=.env.default.properties
DOCKER_VOL_PWD ?= -v=$(PWD):/app
DOCKER_VOL_DATA ?= -v=$(PWD)/$(DATA_DIR):/app/$(DATA_DIR)
DOCKER_PORTS ?= -p=$(PORT):$(PORT)
DOCKER_BUILD := docker build --build-arg=PROJECT=$(PROJECT)
DOCKER_RUN := docker run --init -it $(DOCKER_ENV)
SRV := server/srv.mjs

# SYNC[test_tmp_dir]
TEST_TMP_DIR := .test_tmp

help:
	echo "Select one of the following commands."
	echo "Run \`make -n <command_name>\` to see its definition."
	echo "Recommended default for development: \`make dev_w\`."
	echo
	for val in $(MAKEFILE_LIST); do grep -E '^\S+:' $$val; done | sed 's/:.*//' | sort | uniq

dev_w dev: export DEV := $(or $(DEV),true)

dev_w:
	$(MAKE_CONC) live srv_w

dev:
	$(MAKE_CONC) live srv

dev_w dev: export DEV := $(DEV)
srv_w srv: export PORT := $(PORT)
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
	$(DENO_WATCH) server/test.mjs

server_test: export LOG_DEBUG := $(LOG_DEBUG)
server_test:
	$(DENO_RUN) server/test.mjs

server_bench_w:
	$(DENO_WATCH) server/bench.mjs

server_bench:
	$(DENO_RUN) server/bench.mjs

shared_test_w:
	$(DENO_WATCH) shared/test.mjs

shared_test:
	$(DENO_RUN) shared/test.mjs

shared_bench_w:
	$(DENO_WATCH) shared/bench.mjs

shared_bench:
	$(DENO_RUN) shared/bench.mjs

mig_samples:
	$(DENO_RUN) server/mig_samples.mjs

repl:
	deno repl $(DENO_FLAGS) $(args)

duck:
	duckdb $(DB_FILE) $(args)

duck.script:
	duckdb $(DB_FILE) < $(file)

duck.script.mem:
	duckdb < $(file)

duck.attach.dev:
	duckdb -cmd "attach 'http://localhost:$(PORT)/api/db' as db; use db;"

duck.attach.prod:
	duckdb -cmd "attach 'https://tabularius.mitranim.com/api/db' as db; use db;"

lint:
	deno lint

docker.build.dev:
	$(DOCKER_BUILD) -t=$(DOCKER_TAG_LATEST_DEV) -f=dockerfile_dev

docker.build:
	$(DOCKER_BUILD) -t=$(DOCKER_TAG_LATEST) -f=dockerfile

# The `--init` flag seems required for killing this with Ctrl+C.
# FS watching and change detection doesn't seem to work here.
# Restarting the server requires restarting the container.
docker.srv.dev:
	$(DOCKER_RUN) $(DOCKER_PORTS) $(DOCKER_VOL_PWD) $(DOCKER_TAG_LATEST_DEV) run -A $(SRV)

# The `--init` flag seems required for killing this with Ctrl+C.
docker.srv:
	$(DOCKER_RUN) $(DOCKER_PORTS) $(DOCKER_VOL_DATA) $(DOCKER_TAG_LATEST) run -A $(SRV)

docker.sh:
	docker run --init -it $(DOCKER_ENV) $(DOCKER_VOL_DATA) --entrypoint=/bin/ash $(DOCKER_TAG_LATEST)

docker.clean:
	docker image prune -f --filter $(DOCKER_LABEL)

docker.ls:
	docker images --filter $(DOCKER_LABEL)

fly.deploy:
	fly deploy --yes

fly.repl:
	fly ssh console -a tabularius

fly.file:
	fly ssh sftp get -a tabularius /app/data/$(src_file) ./local/$(out_file)

# Must provide `out_file=...`. Note that the `.duckdb` file may be heavily
# outdated if a lot of recent data is currently in the `.wal` file, which
# we're not bothering to download.
fly.db.dump:
	$(MAKE) fly.file src_file=tabularius.duckdb

# Keeps .dockerignore in sync with .gitignore.
#
# Trims trailing whitespace from all tracked files.
# Bots such as Claude Code spam trailing whitespace.
# The `-i ''` is required on MacOS, do not remove.
#
# `bash` (or `zsh`) is needed for process substitution: <(cmd).
define HOOK_PRE_COMMIT_CODE
#!/bin/bash
cp .gitignore .dockerignore &&

comm -23 <(git ls-files | sort) <(git ls-files --deleted | sort) |
	xargs sed -i '' 's/[[:space:]]*$$//' &&

git add $(git diff --cached --name-only)
endef
export HOOK_PRE_COMMIT_CODE
HOOK_PRE_COMMIT_FILE := .git/hooks/pre-commit

# Should be run once, after cloning the repo.
hook:
	echo "$${HOOK_PRE_COMMIT_CODE}" > $(HOOK_PRE_COMMIT_FILE)
	chmod +x $(HOOK_PRE_COMMIT_FILE)
