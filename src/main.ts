/* eslint-disable no-await-in-loop */
/* eslint-disable lines-around-comment */
import fetch from "node-fetch";
import { z } from "zod";
import { URL } from "url";
import type { RequestInit, Response } from "node-fetch";

export interface BMSTableHead {
	name: string;
	symbol: string;
	data_url: string;

	/**
	 * A BMS Table *may* have an array of levels specified. This specifies the order of folders
	 * for this table. These may be numbers, so you should coerce them to strings before you
	 * interact with them.
	 */
	levels?: Array<number | string>;

	/**
	 * Alternatively, a BMS Table may define its levels under `level_order` instead of `levels`.
	 *
	 * See BMSTableHead.levels for more information on this.
	 */
	level_order?: Array<number | string>;

	/**
	 * BMS Tables may - of course - have any kind of undocumented properties. As such, this type
	 * is indexable by anything.
	 */
	[unknownProperty: string]: unknown;
}

interface BaseBMSTableEntry {
	/**
	 * The folder this chart resides in. This property must be present, but might not be declared
	 * as existing in the header.
	 *
	 * Some tables declare these as numbers instead of strings. Who knows why.
	 */
	level: number | string;

	/**
	 * BMS Tables entries may - of course - have any kind of undocumented properties. As such, this type
	 * is indexable by anything.
	 */
	[unknownProperty: string]: unknown;
}

export interface BMSTableEntryMD5 extends BaseBMSTableEntry {
	/**
	 * The MD5 for this BMS chart. This may not be present, or may be the empty string/
	 * an invalid MD5 entry. If this is the case, sha256 *must* be present.
	 */
	md5: string;
}

export interface BMSTableEntrySHA256 extends BaseBMSTableEntry {
	/**
	 * The SHA256 for this BMS chart. This is guaranteed to be present if the provided
	 * MD5 is not exactly a 32 character string.
	 */
	sha256: string;
}

export type BMSTableEntry = BMSTableEntryMD5 & BMSTableEntrySHA256;

export class BMSTable {
	head: BMSTableHead;
	body: Array<BMSTableEntry>;

	constructor(head: BMSTableHead, body: Array<BMSTableEntry>) {
		this.head = head;
		this.body = body;
	}

	/**
	 * Get all of the levels in this table, and return them in the right order.
	 */
	getLevelOrder() {
		if (this.head.levels) {
			return this.head.levels;
		}

		if (this.head.level_order) {
			return this.head.level_order;
		}

		// otherwise, sniff.
		const levels: Array<number | string> = [];

		// Assume that the order in which levels appear in the chart body is the order
		// of the folders in the table.
		// This is a safe assumption, because this is what other tools do
		// and therefore people write their tools to work under this assumption.
		for (const chart of this.body) {
			if (!levels.includes(chart.level)) {
				levels.push(chart.level);
			}
		}

		return levels;
	}
}

const HEAD_SCHEMA = z.object({
	name: z.string(),
	symbol: z.string(),
	data_url: z.string(),
	levels: z.optional(z.array(z.union([z.number(), z.string()]))),
	level_order: z.optional(z.array(z.union([z.number(), z.string()]))),
});

/**
 * Load a BMS table from a URL. This can be a .html URL, or a link to a JSON header.
 *
 * Returns a class with exposed `head` and `body` properties, alongside some utility methods
 * for interacting with them.
 */
export async function LoadBMSTable(url: string) {
	const firstRes = await FetchWithRetry(url);
	let headerJSON: BMSTableHead;
	const resText = await firstRes.text();

	const type = IsHTMLOrJSON(firstRes, resText);

	let headerLocation: string;

	if (type === "json") {
		headerLocation = url;
		headerJSON = BrokenBMSJSONParse(resText) as BMSTableHead;
	} else {
		const bmstable = ReadMetaTag(resText);

		if (!bmstable) {
			throw new Error(
				`${url} returned HTML, but had no readable bmstable tag. Cannot parse table.`
			);
		}

		headerLocation = new URL(bmstable, url).href;
		const headerJSONRes = await FetchWithRetry(headerLocation);

		try {
			headerJSON = BrokenBMSJSONParse(await headerJSONRes.text()) as BMSTableHead;
		} catch (err) {
			throw new Error(`Failed to read header.json: ${err}.`);
		}
	}

	const headerResult = HEAD_SCHEMA.safeParse(headerJSON);

	if (!headerResult.success) {
		throw new Error(`Invalid head.json: ${headerResult.error.toString()}.`);
	}

	const bodyLocation = new URL(headerJSON.data_url, headerLocation).href;
	const body = await FetchWithRetry(bodyLocation);
	let rawBodyJSON: unknown;

	try {
		rawBodyJSON = BrokenBMSJSONParse(await body.text()) as Array<BMSTableEntry>;
	} catch (err) {
		throw new Error(`Failed to read body.json: ${err}.`);
	}

	// assert that this is *atleast* an array of objects.
	const bodyJSON = ExtractBMSBody(rawBodyJSON);

	return new BMSTable(headerJSON, bodyJSON);
}

const LEN_MD5_HEX_HASH = "d0f497c0f955e7edfb0278f446cdb6f8".length;
const LEN_SHA256_HEX_HASH = "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732"
	.length;

/**
 * There's no standard for the contents of a BMS table. There's a rough understanding
 * that each object **must** contain a `level` field and a `md5` field, but recently
 * people have been migrating their tables to use `sha256` instead of `md5`, sometimes
 * leaving `md5` in a nonsensical/invalid sentinel value.
 *
 * This means we have to do all of this validation logic by hand.
 *
 * A cursory look at the beatoraja codebase shows that the table parser seems to
 * discard any table entry it can't understand. As such, we need to do the same.
 * "compatibility".
 *
 * @param rawData - Anything. Could be **ANY** json.parsed value.
 */
function ExtractBMSBody(rawData: unknown): Array<BMSTableEntry> {
	if (!Array.isArray(rawData)) {
		throw new Error(
			`Invalid body.json -- got ${typeof rawData} (${rawData}) instead of an array.`
		);
	}

	const bmsTableEntries: Array<BMSTableEntry> = [];

	for (const entry of rawData) {
		if (entry === null) {
			// not an object
			continue;
		}

		if (typeof entry !== "object" || Array.isArray(entry)) {
			// not an object, or is an array
			continue;
		}

		// we need to start doing arbitrary property access now.
		const rec = entry as Record<string, unknown>;

		if (typeof rec.level !== "number" && typeof rec.level !== "string") {
			// the "level" property was not a number or string.
			continue;
		}

		// if MD5 isn't a string, or if md5 cannot possibly be a valid md5
		// hash (isn't 32 chars long)
		// this is because to indicate that a table entry doesn't use md5
		// sometimes people leave rec.md5 undefined, sometimes they set it to null
		// and sometimes they set it to sentinel strings like "". This is ostensibly
		// safe against idiots.
		if (typeof rec.md5 !== "string" || rec.md5.length !== LEN_MD5_HEX_HASH) {
			// then we **MUST** have sha256.

			if (typeof rec.sha256 !== "string" || rec.sha256.length !== LEN_SHA256_HEX_HASH) {
				// no md5, no sha256, this is nonsense.
				continue;
			}

			// we have a valid sha256
		} else {
			// we have a valid md5
			// (we may also have a valid sha256, but we don't need to check)
			// we only guarantee that either md5 exists and is sensible
			// or sha256 exists and is sensible
		}

		// it's gotta have level: string | number, and it's gotta have *atleast* one
		// of sha256 or md5.
		bmsTableEntries.push(entry as BMSTableEntry);
	}

	return bmsTableEntries;
}

function IsHTMLOrJSON(res: Response, resText: string): "html" | "json" {
	const contentType = res.headers.get("Content-Type");

	// no content type? We gotta guess.
	if (!contentType) {
		const firstChar = resText.trimStart()[0];

		// we know for a fact that bms headers need to be objects
		// so even though json can technically be arrays or literals
		// it doesn't really matter.
		if (firstChar === "{") {
			return "json";
		}

		// probably html
		return "html";
	}

	if (contentType.includes("application/json")) {
		return "json";
	}

	return "html";
}

/**
 * Given some HTML, attempt to read a bms `<meta` tag.
 *
 * These tags are like <meta name="bmstable" key="head.json">
 * and may be malformed. They may use `content=` as a key, or `value=`, or anything. No existing
 * parsers check, and there's no spec, so anything goes.
 *
 * As such, this isn't a robust html parser or anything, but neither are the actual tools
 * that read bms tables, and people make their tables to work with those tools, so we're guaranteed
 * that they are readable like this. In many ways, it's unwise to consider this HTML format actual
 * worthwhile-to-parse html.
 */
function ReadMetaTag(html: string) {
	const match = /<meta[\s]+name="bmstable".*?="(.*?)"/gmu.exec(html) as [string, string] | null;

	if (!match) {
		return null;
	}

	return match[1];
}

/**
 * Fetch. If the response is not a 200, retry N more times with some debounce.
 *
 * This is because BMS tables are typically on unstable hosting providers that might just randomly
 * fail. You might think we shouldn't retry on something like a 403, but it turns out some of the
 * hosting providers 403 and then suddenly stop. Honestly, very odd.
 */
async function FetchWithRetry(url: string, options?: RequestInit, retryCount = 3) {
	let tries = 0;
	let lastRes: Response | undefined;

	while (tries < retryCount) {
		const res = await fetch(url, options);

		if (res.status === 200) {
			return res;
		}

		lastRes = res;

		tries++;
	}

	if (!lastRes) {
		throw new Error(`Attempted to fetch ${url} with 0 retries. Very funny.`);
	}

	throw new Error(`Failed to fetch ${url}: ${lastRes.status}`);
}

/**
 * Despite the fact that JSON is one of the simplest specifications in the world
 * and every single programming language has good support for it...
 *
 * ...BMS Table authors still find themselves outputting completely invalid JSON.
 * Honestly, I'm quite impressed. Or depressed.
 *
 * BOM is not legal in JSON.
 * It's never been legal, it is BY SPECIFICATION not legal.
 *
 * RFC 7159, Section 8.1:
 *     Implementations MUST NOT add a byte order mark to the beginning of a JSON text.
 * This is put as clearly as it can be. This is the only "MUST NOT" in the entire RFC.
 *
 * Anyway. Some people are outputting json by raw string concatenation in PHP. This,
 * for some unfathomable reason, results in byte-order-marks being sent over the wire.
 */
function BrokenBMSJSONParse(str: string) {
	let cleanStr = str;

	if (str.startsWith("\ufeff")) {
		cleanStr = str.replace("\ufeff", "");
	}

	return JSON.parse(cleanStr) as unknown;
}
