// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
import { spawnSync } from "node:child_process";
const MAKERS = { "1462": "MSI", "3842": "EVGA", "1043": "ASUS", "1458": "Gigabyte", "19DA": "Zotac", "10DE": "NVIDIA", "196E": "PNY", "1569": "Palit", "1B4C": "Galax/KFA2", "7377": "Colorful", "1682": "XFX", "1DA2": "Sapphire", "148C": "PowerColor" };
let makers = null;
function makerOf(i) {
    if (!makers) {
        makers = {};
        try {
            const r = spawnSync("nvidia-smi", ["--query-gpu=index,pci.sub_device_id", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true });
            for (const l of String(r.stdout || "").trim().split(/\r?\n/)) {
                const [ix, sub] = l.split(",").map((x) => x.trim());
                if (ix !== undefined && ix !== "")
                    makers[ix] = MAKERS[String(sub || "").replace(/^0x/i, "").slice(-4).toUpperCase()] || "";
            }
        }
        catch { }
    }
    return makers[String(i)] || "";
}
export function cardLabel(gpu) {
    if (gpu === undefined || gpu === null)
        gpu = "1";
    if (String(gpu) === "none")
        return "the processor (card 0)";
    const m = makerOf(gpu);
    return `card ${Number(gpu) + 1}${m ? ` (${m})` : ""}`;
}
