Error.stackTraceLimit = Infinity

for await (const {name, isFile} of Deno.readDir(new URL(`.`, import.meta.url))) {
  if (isFile && name.endsWith(`_test.mjs`)) {
    await import(new URL(name, import.meta.url))
  }
}

await import(`../shared/test.mjs`)
console.log(`[test_server] ok`)
