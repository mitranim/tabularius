MAKEFLAGS := --silent --always-make
TAR := .tar
DENO_RUN := deno run -A --no-check

help:
	echo "Select one of the following commands."
	echo "Definition: \`make -n <command_name>\`."
	echo
	for val in "$(MAKEFILE_LIST)"; do grep -E '^\S+:' $$val; done | sed 's/:.*//' | sort | uniq

clean:
	rm -rf "$(TAR)"

srv: export TAR := $(TAR)
srv:
	$(DENO_RUN) cmd_srv.mjs

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
