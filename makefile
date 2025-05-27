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
DOCKER_PORTS ?= -p=$(SRV_PORT):$(SRV_PORT)
DOCKER_BUILD := docker build --build-arg=PROJECT=$(PROJECT)
DOCKER_RUN := docker run --init -it $(DOCKER_ENV)
SRV := server/srv.mjs

# SYNC[test_tmp_dir]
TEST_TMP_DIR := .test_tmp

help:
	echo "Select one of the following commands."
	echo "Run \`make -n <command_name>\` to see its definition."
	echo "Recommended default for development: \`make dev.w\`."
	echo
	for val in $(MAKEFILE_LIST); do grep -E '^\S+:' $$val; done | sed 's/:.*//' | sort | uniq

dev.w dev: export DEV := $(or $(DEV),true)

dev.w:
	$(MAKE_CONC) live srv.w

dev:
	$(MAKE_CONC) live srv

dev.w dev: export DEV := $(DEV)
srv.w srv: export SRV_HOST := $(SRV_HOST)
srv.w srv: export SRV_PORT := $(SRV_PORT)
srv.w srv: export LIVE_PORT := $(LIVE_PORT)
srv.w srv: export LOG_DEBUG := $(LOG_DEBUG)
srv.w srv: export DATA_DIR := $(DATA_DIR)
srv.w srv: export DB_FILE := $(DB_FILE)
srv.w srv: export TMP_DIR := $(TMP_DIR)

srv.w:
	$(DENO_WATCH) $(SRV)

srv:
	$(DENO_RUN) $(SRV)

live: export LIVE_PORT := $(LIVE_PORT)
live:
	$(DENO_RUN) server/live.mjs

run.w:
	$(DENO_WATCH) $(run)

run:
	$(DENO_RUN) $(run)

clean:
	rm -rf $(TMP_DIR) $(TEST_TMP_DIR)

server.test.w server.test shared.test.w shared.test: export TEST := true
server.test.w server.test shared.test.w shared.test: export LOG_DEBUG := $(LOG_DEBUG)

server.test.w:
	$(DENO_WATCH) server/test.mjs

server.test: export LOG_DEBUG := $(LOG_DEBUG)
server.test:
	$(DENO_RUN) server/test.mjs

server.bench.w:
	$(DENO_WATCH) server/bench.mjs

server.bench:
	$(DENO_RUN) server/bench.mjs

shared.test.w:
	$(DENO_WATCH) shared/test.mjs

shared.test:
	$(DENO_RUN) shared/test.mjs

shared.bench.w:
	$(DENO_WATCH) shared/bench.mjs

shared.bench:
	$(DENO_RUN) shared/bench.mjs

mig.samples:
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
	duckdb -cmd "attach 'http://localhost:$(SRV_PORT)/api/db' as db; use db;"

duck.attach.prod:
	duckdb -cmd "attach 'https://tabularius.mitranim.com/api/db' as db; use db;"

lint:
	deno lint --compact

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
	fly ssh sftp get -a tabularius /app/data/$(src_path) local/$(out_path)

# Must provide `out_path=...`.
fly.db.dump:
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
