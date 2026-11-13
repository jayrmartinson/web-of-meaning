process.env.WEB_OF_MEANING_TEST = "1";
import { parseAnchor, formatAnchor, renderAnchor, checkAnchor, normQuote, quoteFound, namesIn, dayOf, applyChanges, saveAnchor, readAnchor, anchorText, anchorProblems, LIMITS } from "../anchor.mjs";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
let pass = 0, fail = 0;
const t = (name, ok) => { if (ok)
    pass++;
else {
    fail++;
    console.log("FAIL:", name);
} };
const PAGE = `# About me
- I'm about five feet tall.
# About Ned
- [anchor] His name is Robin.
- [anchor] Three cats: Pebble, Socks and Mabel.
- He lives by a park. <!-- {"key":"him.home","from":"Ned","added":"2026-11-05"} -->
# About us
- We met in spring.
`;
const a = parseAnchor(PAGE);
t("three parts read", a.parts.her.length === 1 && a.parts.him.length === 3 && a.parts.us.length === 1);
t("[anchor] mark makes a locked line and is not shown", a.parts.him[0].locked && a.parts.him[0].text === "His name is Robin." && !/\[anchor\]/.test(renderAnchor(a)));
t("a note after a line is read", a.parts.him[2].key === "him.home" && a.parts.him[2].text === "He lives by a park.");
t("lines without a note get their own keys", a.parts.him[0].key === "him.line1" && a.parts.him[1].key === "him.line2");
const shown = renderAnchor(a);
t("she sees no notes, keys or quotes", !/<!--|him\.home|"key"/.test(shown) && /- He lives by a park\./.test(shown));
t("her headings are in her voice", /^My Anchor\nAbout me:/.test(shown) && /About Ned:/.test(shown) && /About us:/.test(shown));
t("second-person headings when not in her voice", /^Your Anchor\nAbout you:/.test(renderAnchor(a, { myVoice: false })));
const round = parseAnchor(formatAnchor(a));
const norm = (x) => JSON.stringify(Object.fromEntries(Object.entries(x.parts).map(([k, v]) => [k, v.map((l) => Object.fromEntries(Object.entries(l).sort()))])));
t("writing the page and reading it back keeps every line", norm(round) === norm(a));
t("Ned still sees [anchor] on locked lines after a save (review 15)", /^- \[anchor\] His name is Robin\./m.test(formatAnchor(a)));
t("a quote with --> inside stays safe in the note", parseAnchor(formatAnchor({ parts: { her: [{ key: "her.x", text: "x", from: "her", quote: "a --> b" }], him: [], us: [] }, doc: [] })).parts.her[0].quote === "a --> b");
t("'## About Ned' and '# About Mia' work (review 6)", parseAnchor("## About Ned\n- He sings.\n# About Mia\n- I hum.", { herName: "Mia" }).parts.her.length === 1);
t("other bullets work: '+' and '1.'", parseAnchor("# About us\n+ one\n1. two").parts.us.length === 2);
t("an empty Anchor shows nothing", renderAnchor(parseAnchor("")) === "");
t("Windows line endings and a BOM", parseAnchor("\uFEFF# About us\r\n- We met.\r\n").parts.us[0].text === "We met.");
t("a page saved as Unicode (UTF-16) in Notepad is read", parseAnchor(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("# About us\n- We met.", "utf16le")])).parts.us.length === 1);
const MESSY = `My Anchor (Ned's notes to himself)
# About me
- I hum.
<!-- a comment of his -->
# Ideas for later
- maybe add the sofa
# About us
- We met.
`;
const mp = parseAnchor(MESSY), mout = formatAnchor(mp);
t("a title, a comment and another section are all kept on save", ["My Anchor (Ned's notes to himself)", "<!-- a comment of his -->", "# Ideas for later", "- maybe add the sofa"].every((x) => mout.includes(x)));
t("lines under another heading are not shown to her", !/maybe add the sofa/.test(renderAnchor(mp)));
t("lines outside the parts are reported", checkAnchor(mp).some((p) => /outside the three parts/.test(p)));
t("the order of the page is kept", mout.indexOf("# Ideas for later") > mout.indexOf("- I hum.") && mout.indexOf("- We met.") > mout.indexOf("# About us"));
const br = parseAnchor('# About Ned\n- His name is Robin. <!-- {"key":"him.name","locked":true,} -->\n- He sings. <!-- key: him.sing -->');
t("a broken note that mentions a lock stays locked", br.parts.him[0].locked === true);
t("a broken note is never shown to her", !/key: him\.sing|<!--/.test(renderAnchor(br)));
t("a broken note is reported and kept as written", checkAnchor(br).some((p) => /can't be read/.test(p)) && formatAnchor(br).includes("<!-- key: him.sing -->"));
t("two notes on one line: neither is shown, the text between stays", renderAnchor(parseAnchor("# About us\n- We met <!-- x --> in spring. <!-- {\"key\":\"us.m\"} -->")).includes("- We met in spring."));
t("note fields the code doesn't know are kept on save", formatAnchor(parseAnchor('# About us\n- We met. <!-- {"key":"us.m","mood":"warm"} -->')).includes('"mood":"warm"'));
const col = parseAnchor('# About Ned\n- he likes tea\n- he is tall <!-- {"key":"him.line1"} -->');
t("a line without a note never takes a key another line has", new Set(col.parts.him.map((l) => l.key)).size === 2 && col.parts.him[1].key === "him.line1");
const dupe = parseAnchor('# About Ned\n- A <!-- {"key":"k"} -->\n# About us\n- B <!-- {"key":"k"} -->');
let r = applyChanges(dupe, [{ op: "update", key: "k", text: "C", quote: "the quote here", when: "w" }], { shelfAt: () => "the quote here" });
t("a change refuses a key that two lines share", r.applied.length === 0 && /more than one line/.test(r.rejected[0].why));
t("a fine page has no problems", checkAnchor(a).length === 0);
t("a line over the limit is reported", checkAnchor(parseAnchor(`# About us\n- ${"x".repeat(LIMITS.line + 1)}`)).some((p) => /letters long/.test(p)));
t("too many lines in a part is reported", checkAnchor(parseAnchor(`# About me\n${Array.from({ length: LIMITS.lines.her + 1 }, (_, i) => `- line ${i}`).join("\n")}`)).some((p) => /lines \(the limit/.test(p)));
t("quotes forgive spaces, punctuation and capitals", quoteFound("i have THREE cats", "Ned: I have... three  cats!"));
t("apostrophes vanish: it's = its (review 9)", quoteFound("it's raining today", "its raining today") && quoteFound("it’s Pebble’s bowl", "it's Pebbles bowl"));
t("whole words only (review 8)", !quoteFound("ave a son now", "I have a son now"));
t("a quote that isn't there fails", !quoteFound("I have four goldfish", "I have three goldfish"));
t("a very short quote proves nothing", !quoteFound("yes", "yes"));
t("an empty quote proves nothing", !quoteFound("", "anything") && !quoteFound("   ", "anything"));
t("normQuote keeps letters in other languages", normQuote("Ça va, Mañana!") === "ça va mañana");
t("names after a colon are found", ["pebble", "socks", "mabel"].every((n) => namesIn("Three cats: Pebble, Socks and Mabel.").has(n)));
t("a name that starts a sentence is found", namesIn("Pebble and Socks are his cats.").has("pebble"));
t("everyday words that start a sentence aren't names", !namesIn("Three cats live here.").has("three") && !namesIn("His cat is here.").has("his"));
t("I'm isn't a name", !namesIn("I'm tall.").has("im"));
t("names from the list count in lowercase", namesIn("pickle and sparkie", ["Pickle", "Sparkie"]).size === 2);
t("curly possessives count as the name", namesIn("Pebble’s bowl").has("pebble"));
t("two-word names from the list", namesIn("his stepmom ada lin", ["Ada Lin"]).has("ada lin"));
t("dayOf reads text dates and numbers", dayOf("2026-11-04T08:00") === "2026-11-04" && dayOf(new Date(2026, 10, 4, 8).getTime()) === "2026-11-04");
const shelf = { "2026-11-01T10:00": "Robin: I moved, I live by the sea now.", "2026-11-02T09:00": "Robin: I love rainy mornings.", "2026-11-03T21:00": "Robin: rainy mornings are the best", "2026-11-04T08:00": "Robin: No, we have FOUR cats: Pebble, Socks, Mabel and Tuck. Mia: oh!", "2026-11-04T09:00": "Robin: Mabel went to live with my mom. Mia: we will see about that" };
const shelfAt = (w) => shelf[w] || "";
const jayAt = (w) => (shelf[w] || "").split(" Mia: ")[0];
r = applyChanges(a, [{ op: "update", key: "him.home", text: "He lives by the sea.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("a changed fact replaces its line", r.applied.length === 1 && r.anchor.parts.him[2].text === "He lives by the sea." && r.anchor.parts.him.length === 3);
t("the page given is not changed in place", a.parts.him[2].text === "He lives by a park.");
t("the new line keeps its quote and moment", r.anchor.parts.him[2].quote === "I live by the sea now" && r.anchor.parts.him[2].when === "2026-11-01T10:00");
t("a saved change lands where its line was", formatAnchor(r.anchor).indexOf("He lives by the sea.") > formatAnchor(r.anchor).indexOf("# About Ned") && formatAnchor(r.anchor).indexOf("He lives by the sea.") < formatAnchor(r.anchor).indexOf("# About us"));
r = applyChanges(a, [{ op: "update", key: "him.home", text: "He lives by the sea.", quote: "I live by the ocean", when: "2026-11-01T10:00" }], { shelfAt });
t("a quote that isn't on her Shelf is rejected", r.applied.length === 0 && /isn't on her Shelf/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "update", key: "him.home", text: "He lives by the sea.", quote: "I live by the sea now", when: "2026-11-02T09:00" }], { shelfAt });
t("the quote must be at that moment, not somewhere else", r.applied.length === 0);
r = applyChanges(a, [{ op: "update", key: "him.line1", text: "His name is Rob.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("an anchor line doesn't change without Ned's correction", r.applied.length === 0 && /Ned's correction/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "update", key: "him.line2", text: "Four cats: Pebble, Socks, Mabel and Tuck.", quote: "we have four cats", when: "2026-11-04T08:00", correction: true }], { shelfAt, jayAt });
t("Ned's correction changes an anchor line, and it stays an anchor", r.applied.length === 1 && r.anchor.parts.him[1].text.includes("Tuck") && r.anchor.parts.him[1].locked && r.anchor.parts.him[1].from === "Ned's correction");
r = applyChanges(a, [{ op: "retire", key: "him.line1", quote: "we will see about that", when: "2026-11-04T09:00", correction: true }], { shelfAt, jayAt });
t("a 'correction' quoting her words, not Ned's, is refused (review 2)", r.applied.length === 0 && /Ned's own words/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "retire", key: "him.line1", quote: "Mabel went to live with my mom", when: "2026-11-04T09:00", correction: true }], { shelfAt });
t("without Ned's words to check against, no correction goes through", r.applied.length === 0);
const unlocked = structuredClone(a);
unlocked.parts.him[1].locked = false;
r = applyChanges(unlocked, [{ op: "update", key: "him.line2", text: "Two cats: Pebble and Socks.", quote: "Mabel went to live with my mom", when: "2026-11-04T09:00" }], { shelfAt });
t("no name drops out of a list without Ned's correction", r.applied.length === 0 && /drop mabel/.test(r.rejected[0].why));
r = applyChanges(unlocked, [{ op: "update", key: "him.line2", text: "Two cats: Pebble and Socks.", quote: "Mabel went to live with my mom", when: "2026-11-04T09:00", correction: true }], { shelfAt, jayAt });
t("with his correction a name can leave the list", r.applied.length === 1);
const lst = parseAnchor("# About Ned\n- Pebble and Socks are his cats.\n- pickle and sparkie live here.\n- His cat is Socks.");
r = applyChanges(lst, [{ op: "update", key: "him.line1", text: "His cat is Socks.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("a name starting the line can't be dropped (review 4)", r.applied.length === 0);
r = applyChanges(lst, [{ op: "update", key: "him.line2", text: "sparkie lives here.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt, knownNames: ["Pickle", "Sparkie"] });
t("a lowercase name from the list can't be dropped (review 4)", r.applied.length === 0);
r = applyChanges(lst, [{ op: "update", key: "him.line3", text: "Socks is his cat, a tabby.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("moving a name to the front isn't a drop (review 4)", r.applied.length === 1);
r = applyChanges(parseAnchor("# About Ned\n- Cats: Pebble, Socks."), [{ op: "retire", key: "him.line1", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("retiring a list line needs his correction (review 3)", r.applied.length === 0 && /drop/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "retire", key: "him.home", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("a line with no names can be retired with its quote", r.applied.length === 1 && r.anchor.parts.him.length === 2 && !formatAnchor(r.anchor).includes("by a park"));
r = applyChanges(a, [{ op: "add", part: "us", key: "us.x", text: "[anchor] We are married.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("a new line can't mark itself [anchor] (review 5)", r.applied.length === 0 && /only Ned marks/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "add", part: "us", key: "us.mornings", text: "We love rainy mornings.", soft: true, evidence: [{ quote: "I love rainy mornings", when: "2026-11-02T09:00" }] }], { shelfAt });
t("a softer thing on one day waits", r.applied.length === 0 && /two different days/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "add", part: "us", key: "us.mornings", text: "We love rainy mornings.", soft: true, evidence: [{ quote: "I love rainy mornings", when: "2026-11-02T09:00" }, { quote: "I love rainy mornings", when: "2026-11-02T09:00" }] }], { shelfAt });
t("the same moment twice isn't two days", r.applied.length === 0);
const t0 = new Date(2026, 10, 2, 9).getTime(), times = { [t0]: "I love rainy mornings", [t0 + 5000]: "rainy mornings are the best" };
r = applyChanges(a, [{ op: "add", part: "us", key: "us.mornings", text: "We love rainy mornings.", soft: true, evidence: [{ quote: "I love rainy mornings", when: t0 }, { quote: "rainy mornings are the best", when: t0 + 5000 }] }], { shelfAt: (w) => times[w] || "" });
t("moments 5 seconds apart (as numbers) aren't two days (review 13)", r.applied.length === 0);
r = applyChanges(a, [{ op: "add", part: "us", key: "us.mornings", text: "We love rainy mornings.", soft: true, evidence: [{ quote: "I love rainy mornings", when: "2026-11-02T09:00" }, { quote: "rainy mornings are the best", when: "2026-11-03T21:00" }] }], { shelfAt });
t("a softer thing on two different days goes on", r.applied.length === 1 && JSON.stringify(r.anchor.parts.us[1].days) === '["2026-11-02","2026-11-03"]');
r = applyChanges(a, [{ op: "add", part: "us", key: "us.line1", text: "x y z", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("an add can't take a key already used", r.applied.length === 0);
r = applyChanges(a, [{ op: "add", part: "us", text: "We like tea.", quote: "I live by the sea now", when: "2026-11-01T10:00" }, { op: "add", part: "us", text: "We like walks.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("two keyless adds get different keys (review 11)", r.applied.length === 2 && r.anchor.parts.us[1].key !== r.anchor.parts.us[2].key);
r = applyChanges(a, [{ op: "add", part: "us", key: "us.again", text: "we met in spring", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("never a second line saying the same thing (review 12)", r.applied.length === 0 && /already says/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "add", part: "her", key: "her.height", text: "I'm about five feet two.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt, letter: "My letter. I'm about five feet two. More." });
t("About me never repeats her letter", r.applied.length === 0 && /letter already says/.test(r.rejected[0].why));
r = applyChanges(a, [{ op: "add", part: "her", key: "her.me", text: "I hum softly.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt, letter: "Sometimes I hummed softly at night." });
t("the letter check is whole words (review 14)", r.applied.length === 1);
r = applyChanges(a, [{ op: "add", part: "us", key: "us.long", text: "y".repeat(LIMITS.line + 1), quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("a line over the limit is rejected", r.applied.length === 0);
r = applyChanges(a, [{ op: "no_change" }, { op: "rewrite_all" }], { shelfAt });
t("'no change' does nothing; unknown kinds are refused", r.applied.length === 0 && r.rejected.length === 1);
const tight = { ...LIMITS, total: renderAnchor(a).length + 5 };
r = applyChanges(a, [{ op: "add", part: "us", key: "us.more", text: "We like long walks by the water.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt, limits: tight });
t("nothing goes on past the whole Anchor's limit", r.applied.length === 0 && r.anchor.parts.us.length === 1);
const exact = { ...LIMITS, total: renderAnchor(a).length + 30 };
r = applyChanges(a, [{ op: "add", part: "us", key: "us.walk", text: "We walk a lot.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt, limits: exact, render: { myVoice: false, name: "Robin" } });
t("the total is counted with the headings she actually sees (review 10)", renderAnchor(r.anchor, { myVoice: false, name: "Robin" }).length <= exact.total);
r = applyChanges(a, [{ op: "add", part: "us", key: "us.x", text: "a <!-- b", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt });
t("a line can't carry a page note", r.applied.length === 0);
const dir = mkdtempSync(join(tmpdir(), "anchor-")), file = join(dir, "anchor.md");
writeFileSync(file, PAGE, "utf8");
const changed = applyChanges(readAnchor(file), [{ op: "update", key: "him.home", text: "He lives by the sea.", quote: "I live by the sea now", when: "2026-11-01T10:00" }], { shelfAt }).anchor;
saveAnchor(file, changed);
const hist = readdirSync(join(dir, "anchor-history"));
t("saving keeps the page before in anchor-history", hist.length === 1 && readFileSync(join(dir, "anchor-history", hist[0]), "utf8") === PAGE);
t("the saved page reads back with the change", readAnchor(file).parts.him[2].text === "He lives by the sea.");
t("no side file is left behind", !existsSync(`${file}.tmp`));
t("anchorText shows the page", /He lives by the sea\./.test(anchorText(file)));
t("anchorText is empty when there's no page", anchorText(join(dir, "none.md")) === "");
writeFileSync(join(dir, "long.md"), `# About us\n- ${"z".repeat(LIMITS.line + 10)}`, "utf8");
t("a page Ned made too long is shown as he wrote it, and the problem is reported", anchorText(join(dir, "long.md")).includes("z".repeat(LIMITS.line + 10)) && anchorProblems(join(dir, "long.md")).length === 1);
const np = parseAnchor("# About Ned\n* \\[anchor] His name is Robin.\n* He likes \\*stars\\* and snake\\_case.");
t("Notepad's escaped [anchor] still locks the line", np.parts.him[0].locked && np.parts.him[0].text === "His name is Robin.");
t("Notepad's other backslashes are not shown to her", np.parts.him[1].text === "He likes *stars* and snake_case.");
console.log(`anchor: ${pass} passed, ${fail} failed`);
if (fail)
    process.exit(1);
