import { GetEntryChecksum } from "./main";
import t from "tap";

const VALID_MD5 = "d0f497c0f955e7edfb0278f446cdb6f8";
const VALID_SHA256 = "769359ebb55d3d6dff3b5c6a07ec03be9b87beda1ffb0c07d7ea99590605a732";

t.test("#GetEntryChecksum", (t) => {
	function test(obj: any, wanted: any) {
		obj.level = "1";

		t.strictSame(GetEntryChecksum(obj), wanted);
	}

	test({ md5: VALID_MD5 }, { type: "md5", value: VALID_MD5 });
	test({ md5: VALID_MD5, sha256: null }, { type: "md5", value: VALID_MD5 });
	test({ md5: VALID_MD5, sha256: "" }, { type: "md5", value: VALID_MD5 });
	test({ md5: VALID_MD5, sha256: [] }, { type: "md5", value: VALID_MD5 });
	test({ md5: VALID_MD5, sha256: {} }, { type: "md5", value: VALID_MD5 });

	test({ sha256: VALID_SHA256 }, { type: "sha256", value: VALID_SHA256 });
	test({ sha256: VALID_SHA256, md5: "" }, { type: "sha256", value: VALID_SHA256 });
	test({ sha256: VALID_SHA256, md5: null }, { type: "sha256", value: VALID_SHA256 });
	test({ sha256: VALID_SHA256, md5: "null" }, { type: "sha256", value: VALID_SHA256 });
	test({ sha256: VALID_SHA256, md5: [] }, { type: "sha256", value: VALID_SHA256 });
	test({ sha256: VALID_SHA256, md5: {} }, { type: "sha256", value: VALID_SHA256 });

	t.end();
});
