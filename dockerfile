from denoland/deno:alpine-2.2.12
arg PROJECT
label project=$PROJECT

# `libstdc++` seems to be required by DuckDB dylibs.
run apk add --no-cache make libstdc++

workdir $DENO_DIR
copy package.json deno.json .
run deno install
workdir /app
copy . .
entrypoint ["deno"]
