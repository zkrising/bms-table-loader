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

export interface BMSTableEntry {
	/**
	 * The MD5 for this BMS chart.
	 */
	md5: string;

	/**
	 * The folder this chart resides in. This property must be present, but might not be declared
	 * as existing in the header.
	 */
	level: string;

	/**
	 * BMS Tables entries may - of course - have any kind of undocumented properties. As such, this type
	 * is indexable by anything.
	 */
	[unknownProperty: string]: unknown;
}

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

const BODY_SCHEMA = z.array(
	z.object({
		md5: z.string(),
		level: z.string(),
	})
);

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
		headerJSON = JSON.parse(resText) as BMSTableHead;
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
			headerJSON = (await headerJSONRes.json()) as BMSTableHead;
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
	let bodyJSON: Array<BMSTableEntry>;

	try {
		bodyJSON = (await body.json()) as Array<BMSTableEntry>;
	} catch (err) {
		throw new Error(`Failed to read body.json: ${err}.`);
	}

	const bodyResult = BODY_SCHEMA.safeParse(bodyJSON);

	if (!bodyResult.success) {
		throw new Error(`Invalid body.json: ${bodyResult.error.toString()}.`);
	}

	return new BMSTable(headerJSON, bodyJSON);
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
