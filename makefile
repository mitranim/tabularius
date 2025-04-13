MAKEFLAGS := --silent --always-make
MAKE_CONC := $(MAKE) -j 128 clear=$(or $(clear),false)
TAR ?= .tar
CLEAR ?= $(if $(filter false,$(clear)),, )
DENO_FLAGS ?= --node-modules-dir=false
DENO_RUN ?= deno run -A --no-check $(DENO_FLAGS)
DENO_WATCH ?= $(DENO_RUN) --watch $(if $(CLEAR),,--no-clear-screen)

help:
	echo "Select one of the following commands."
	echo "Run \`make -n <command_name>\` to see its definition."
	echo
	for val in $(MAKEFILE_LIST); do grep -E '^\S+:' $$val; done | sed 's/:.*//' | sort | uniq

clean:
	rm -rf firebase-debug.log firestore-debug.log "$(TAR)"

srv: export TAR := $(TAR)
srv:
	$(DENO_RUN) cmd_srv.mjs

run.w:
	$(DENO_WATCH) $(run)

run:
	$(DENO_RUN) $(run)

fb:
	firebase emulators:start --log-verbosity QUIET

# Requires `gcloud auth login` or equivalent.
# May require some retries.
fb.deploy:
	firebase deploy

lint:
	deno lint --rules-exclude=no-window,no-window-prefix,constructor-super

# Trims trailing whitespace from all tracked files.
# The `-i ''` is required on MacOS, do not remove.
define HOOK_PRE_COMMIT_CODE
#!/bin/sh
git ls-files | xargs sed -i '' 's/[[:space:]]*$$//' &&
git add -u
endef
export HOOK_PRE_COMMIT_CODE
HOOK_PRE_COMMIT_FILE := .git/hooks/pre-commit

# Should be run once, after cloning the repo.
hook:
	echo "$${HOOK_PRE_COMMIT_CODE}" > $(HOOK_PRE_COMMIT_FILE)
	chmod +x $(HOOK_PRE_COMMIT_FILE)
