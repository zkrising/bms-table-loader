# BMS Table Loader Library

This is a TypeScript library for loading BMS tables from a URL.

The types indicate what *must* be present for a BMS Table to be valid. Anything else might/will
be something completely unexpected. You should handle these extensions yourself.

You can install it with your preferred NodeJS package manager:
```sh
# npm
npm install bms-table-loader

# yarn
yarn add bms-table-loader

# pnpm
pnpm add bms-table-loader
```

## API

```ts
import { Loader } from "bms-table-loader";

const table = await Loader("http://nekokan.dyndns.info/~lobsak/genocide/insane.html");
// { head: ..., body: [...] }
```

### Library

We use [PNPM](https://pnpm.io) as our package manager. Use `pnpm install` to install dependencies.

### Build Script

We use [TypeScript](https://typescriptlang.org). This means you have to run `pnpm build` to compile the library up into something usable by node.

**NOTE**: This does not have to be done if running tests or if you use `ts-node`.

### Tests

To run the tests, use `pnpm test`.

We use [Node TAP](https://node-tap.org) as our test runner.

The tests are extremely lazy "can we load tables off the internet" style. I'm lazy.