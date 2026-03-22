# TypeScript migration

We're gradually adding TypeScript to the ClearlyDefined crawler. The approach is the same one used in the [service][service-migration]: use `tsc` to type-check our existing JavaScript, write `.d.ts` files for type information, and avoid a build step.

## Where we are

We run TypeScript as a linter, not a compiler. `tsc` checks JavaScript files via `allowJs` and `checkJs`, and `noEmit` means it never produces output. This runs as part of `npm run lint`.

The `include` array in tsconfig.json contains only `types/**/*` — custom type declarations for third-party packages. No source files are being type-checked yet. Files get checked when you add them to `include`.

There are no `.d.ts` sidecar files for our own modules yet, and almost no JSDoc annotations. That's where to start.

Type information comes from three places:

- `.d.ts` files sitting next to their corresponding `.js` modules (none yet)
- JSDoc annotations in the JavaScript itself
- custom type definitions in `types/` for third-party packages that don't ship their own types and aren't covered by DefinitelyTyped (`@types/` packages)

### tsconfig.json

The config extends three bases:

- [`@tsconfig/strictest`][tsconfig-strictest] — strict defaults
- [`@tsconfig/node24`][tsconfig-node24] — Node 24 target and lib settings
- [`@tsconfig/node-ts`][tsconfig-node-ts] — enables `erasableSyntaxOnly` for Node's native type stripping

We override a few strict options because they don't play well with JavaScript:

- `strictNullChecks: false`
- `exactOptionalPropertyTypes: false`

We also set `verbatimModuleSyntax: false`, overriding the `node-ts` default. Without this, all our CommonJS `require()` calls would be errors. Once we migrate imports, we can flip it back.

## Adding types

Write a `.d.ts` file next to the JavaScript module. Add JSDoc annotations to the `.js` file where they help. Then add both to the `include` array in [`tsconfig.json`][tsconfig]:

```json
{ "include": ["your/new/file.d.ts", "your/new/file.js"] }
```

Run `npm run tsc` to check your work.

## Where to start

The codebase has about 70 source files organized into a plugin architecture: the `ghcrawler/` core engine handles queuing and request lifecycle, while `providers/` implements ClearlyDefined-specific fetching, processing, and storage.

Type the core domain objects first — everything else depends on them:

1. `ghcrawler/lib/request.js` — the `Request` class, passed to every handler
2. `ghcrawler/lib/traversalPolicy.js` — used by Request
3. `lib/entitySpec.js` — coordinates for a component (type/provider/namespace/name/revision)
4. `lib/sourceSpec.js` — extends EntitySpec with source location info
5. `lib/baseHandler.js` — base class for all fetch and process handlers

Then do the abstract base classes:

6. `providers/fetch/abstractFetch.js` — base for all 16 fetchers
7. `providers/process/abstractProcessor.js` — base for all 22 processors

After that, the concrete implementations are repetitive. Each fetcher and processor follows the same `handle(request)` pattern, so once the base class is typed, the rest go quickly.

## What's next

### Native TypeScript in Node.js

Node 24 can run `.ts` files by stripping types at import time. The service has `erasableSyntaxOnly` enabled via `@tsconfig/node-ts` for this. Once we add that base config, new tests can be `.ts` files and the mocha glob can be updated to `test/unit/**/*.{js,ts}`.

Writing source files in `.ts` (not just tests) needs more groundwork — see the [service migration doc][service-migration] for the open questions around `verbatimModuleSyntax` and import conventions.

## Getting started

1. Find a `.js` file that doesn't have a `.d.ts` yet (that's all of them)
2. Write the type definitions
3. Add both files to `tsconfig.json`'s `include` list
4. Run `npm run tsc`
5. If something in this doc is wrong, fix it

[tsconfig]: ../tsconfig.json
[tsconfig-strictest]: https://www.npmjs.com/package/@tsconfig/strictest
[tsconfig-node24]: https://www.npmjs.com/package/@tsconfig/node24
[tsconfig-node-ts]: https://www.npmjs.com/package/@tsconfig/node-ts
[service-migration]: https://github.com/clearlydefined/service/blob/master/docs/typescript-migration.md
[service-types]: https://github.com/clearlydefined/service/tree/master/types
