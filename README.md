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

### `table.body`

Although `table.head` is kept identical, **`table.body` entries are wrapped in some information about their checksum.**

Recent developments in the BMS ecosystem have resulted in people spitting out sha256 styled entries, like:
- `{ sha256: "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732", md5: "", level: 1 }`
- `{ sha256: "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732", md5: "null", level: 1 }`.
- `{ sha256: "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732", level: 1 }`.

This means it's no longer possible to just use `md5` to identify a chart, and this requires some more complex validation (as `sha256` is - too - an optional property with type unknown).

A table `body.json` of
```json
[{
	"title": "example song 1",
	"level": "1",
	"md5": "935ac8a2d9a3e2307a6e0206f87c22ad",
	"sha256": "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
},
{
	"title": "example song 2",
	"level": "1",
	"sha256": "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
},
{
	"title": "example song 3",
	"level": "1",
	"md5": null,
	"sha256": "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
},
{
	"title": "example song 3",
	"level": "1",
	"md5": "null",
	"sha256": "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
}]
```
will result in `table.body` being
```js
[
	{
		checksum: { type: "md5", value: "935ac8a2d9a3e2307a6e0206f87c22ad" },
		content: {
			title: "example song 1",
			level: "1",
			md5: "935ac8a2d9a3e2307a6e0206f87c22ad",
			sha256: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
		},
	},
	{
		checksum: { type: "sha256", value: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56" },
		content: {
			title: "example song 2",
			level: "1",
			sha256: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
		},
	},
	{
		checksum: { type: "sha256", value: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56"},
		content: {
			title: "example song 3",
			level: "1",
			md5: null,
			sha256: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
		}
	},
	{
		checksum: { type: "sha256", value: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56" },
		content: {
			title: "example song 3",
			level: "1",
			md5: "null",
			sha256: "5b7cbf452689aa56410c753cd48390df1dceaf723944d0023e352eaea3a2bf56",
		}
	}
]
```

Due to the complexities involved in determining *how* a chart was hashed, the convenience of pre-wrapping every chart with its checksum information outweigh the additional boilerplate needed.

If you want the body with no wrapping, see `table.getRawBody()`.

### getLevelOrder()

Returns the levels in this table in order. This is a utility method because there's
three possible ways and places this can be defined in a BMS Table. Good fun.

### getRawBody()

Returns the content of the BMS Tables' `body.json` without any checksum information - so exactly as it was sent over the wire (with invalid entries removed).

## Library

We use [PNPM](https://pnpm.io) as our package manager. Use `pnpm install` to install dependencies.

## Build Script

We use [TypeScript](https://typescriptlang.org). This means you have to run `pnpm build` to compile the library up into something usable by node.

**NOTE**: This does not have to be done if running tests or if you use `ts-node`.

## Tests

To run the tests, use `pnpm test`.

We use [Node TAP](https://node-tap.org) as our test runner.

The tests are extremely lazy "can we load tables off the internet" style. I'm lazy.