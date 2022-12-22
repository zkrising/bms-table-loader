import { LoadBMSTable } from "./main";
import t from "tap";

export const tbls = [
	"http://www.ribbit.xyz/bms/tables/insane.html",
	"http://www.ribbit.xyz/bms/tables/normal.html",
	"https://stellabms.xyz/st/table.html",
	"https://stellabms.xyz/sl/table.html",
	"https://rattoto10.github.io/second_table/insane_header.json",
	"https://rattoto10.github.io/second_table/header.json",
	"http://lr2.sakura.ne.jp/overjoy.php",
	"http://dpbmsdelta.web.fc2.com/table/insane.html",
	"http://dpbmsdelta.web.fc2.com/table/dpdelta.html",
	"https://stellabms.xyz/dp/table.html",
	"http://minddnim.web.fc2.com/sara/3rd_hard/bms_sara_3rd_hard.html",
	"http://flowermaster.web.fc2.com/lrnanido/gla/LN.html",
	"https://mqppppp.neocities.org/StardustTable.html",
	"https://djkuroakari.github.io/starlighttable.html",
	"https://notepara.com/glassist/lnoj",
	"https://ladymade-star.github.io/luminous/",
	"http://su565fx.web.fc2.com/Gachimijoy/gachimijoy.html",
	"https://lets-go-time-hell.github.io/Delay-joy-table/",
	"https://lets-go-time-hell.github.io/Arm-Shougakkou-table/",
	"https://stellabms.xyz/fr/table.html",
];

t.test("lazy smoke tests", (t) => {
	for (const tb of tbls) {
		t.test(`Load ${tb}.`, async (t) => {
			const res = await LoadBMSTable(tb);

			console.dir(res.getLevelOrder());
		});
	}

	t.end();
});
