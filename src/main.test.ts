import t from "tap";
import {LoadBMSTable} from "./main";

const tbls = [
	"http://www.ribbit.xyz/bms/tables/insane.html",
	"http://www.ribbit.xyz/bms/tables/normal.html",
	"https://notepara.com/glassist/lnoj",
	"https://bms.hexlataia.xyz/tables/ai.html",
	"http://www.ribbit.xyz/bms/tables/insane_header.json",
]

t.test("lazy smoke tests", (t) => {
	for (const tb of tbls) {
		t.test(`Load ${tb}.`, async (t) => {
			const res = await LoadBMSTable(tb); 

			console.dir(res.getLevelOrder());
		});
	}
	
	t.end()
});