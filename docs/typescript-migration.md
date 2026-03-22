# TypeScript migration

We're gradually adding TypeScript to the ClearlyDefined crawler. The approach is the same one used in the [service][service-migration]: use `tsc` to type-check our existing JavaScript, write `.d.ts` files for type information, and avoid a build step.

## Where we are

We run TypeScript as a linter, not a compiler. `tsc` checks JavaScript files via `allowJs` and `checkJs`, and `noEmit` means it never produces output. This runs as part of `npm run lint`.

Every source module has a `.d.ts` sidecar file with type declarations. A handful of the core `.js` files (`lib/` and `ghcrawler/lib/`) also have JSDoc annotations and are type-checked directly. The rest have declarations available for consumers but their `.js` internals aren't checked yet — adding JSDoc to those can happen incrementally.

Type information comes from three places:

- `.d.ts` files sitting next to their corresponding `.js` modules
- JSDoc annotations in the JavaScript itself
- custom type definitions in `types/` for third-party packages that don't ship their own types and aren't covered by DefinitelyTyped (`@types/` packages)

Tests can be `.ts` files. Mocha runs both `test/**/*.js` and `test/**/*.ts`, and the tsconfig includes the `.ts` glob.

### tsconfig.json

The config extends three bases:

- [`@tsconfig/strictest`][tsconfig-strictest] — strict defaults
- [`@tsconfig/node24`][tsconfig-node24] — Node 24 target and lib settings
- [`@tsconfig/node-ts`][tsconfig-node-ts] — enables `erasableSyntaxOnly` for Node's native type stripping

We override a few strict options because they don't play well with JavaScript:

- `strictNullChecks: false`
- `exactOptionalPropertyTypes: false`
- `noPropertyAccessFromIndexSignature: false`

We also set `verbatimModuleSyntax: false`, overriding the `node-ts` default. Without this, all our CommonJS `require()` calls would be errors. Once we migrate imports, we can flip it back.

## Adding types

Write a `.d.ts` file next to the JavaScript module. Add JSDoc annotations to the `.js` file where they help. Then add both to the `include` array in [`tsconfig.json`][tsconfig]:

```json
{ "include": ["your/new/file.d.ts", "your/new/file.js"] }
```

Run `npm run tsc` to check your work.

## Checking a .js file

Most `.js` files have `.d.ts` sidecars but aren't in the `include` list themselves. To start type-checking the JavaScript:

1. Add the `.js` file to `include` in tsconfig.json
2. Run `npm run tsc` — you'll likely get `noImplicitAny` errors on parameters
3. Add JSDoc `@param` and `@type` annotations until it passes
4. The `.d.ts` file types the exports; JSDoc types the internals

The core `lib/` and `ghcrawler/lib/` files are already done this way and can serve as examples.

## What's next

### Native TypeScript in Node.js

Node 24 can run `.ts` files by stripping types at import time. The tsconfig has `erasableSyntaxOnly` enabled via `@tsconfig/node-ts` for this. New tests can be `.ts` files — the mocha glob already picks them up.

Writing source files in `.ts` (not just tests) needs more groundwork — see the [service migration doc][service-migration] for the open questions around `verbatimModuleSyntax` and import conventions.

## Getting started

1. Pick a `.js` file that isn't in tsconfig's `include` yet
2. Add it to the `include` list
3. Fix type errors with JSDoc annotations
4. Run `npm run tsc`
5. If something in this doc is wrong, fix it

[tsconfig]: ../tsconfig.json
[tsconfig-strictest]: https://www.npmjs.com/package/@tsconfig/strictest
[tsconfig-node24]: https://www.npmjs.com/package/@tsconfig/node24
[tsconfig-node-ts]: https://www.npmjs.com/package/@tsconfig/node-ts
[service-migration]: https://github.com/clearlydefined/service/blob/master/docs/typescript-migration.md
[service-types]: https://github.com/clearlydefined/service/tree/master/types
