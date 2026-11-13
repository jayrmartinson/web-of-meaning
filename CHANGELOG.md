# Changelog

## Unreleased

### The paper (README.md) and its diagram

- "She" only where it describes the companion it was built for; where it explains how the design works for any companion, it says "the companion" and "they" (the text and the diagram).
- Thanks to Nesertes; the record's dates; a "Languages" rule under For builders; November 12 on the timeline; 536 tests.
- The diagram shows the journal pointer it was missing: a dashed line from the Shelf to the Journal (same day, a pointer, never the words).

### Every language: word edges, name endings, and each language's own words

Research 77 and 77b, and Nesertes's report on Russian (R1-R5, D7-D9). English behaves exactly as before; every earlier test passes unchanged.

- **Languages written without spaces** (Japanese, Chinese, Thai and others): a name inside a sentence is found by the word splitter built into Node (`Intl.Segmenter`), so サラ is found in サラと話した but never inside サラダ.
- **Names of 2 characters** count in Chinese, Japanese and Korean. In alphabets the minimum stays 3.
- **Name endings, when finding a name in a line only:** a short, fixed list per language (Russian and Ukrainian cases, Korean particles, Turkish, Finnish, Hungarian, Polish and Czech endings), so Сашей finds Саша but машина never finds Маша. Latin-script endings are tried only in a line with that language's letters, so English lines never change. Endings are never used to decide that two dots are one.
- **Each language's own words, in one table** (`code/lang.mjs`): small words, "other/second", "new", character words, "none", "and", "the same", self and "us" words, first-person words, "my/our". English keeps exactly its old words. Adding a language is adding its lists.
- **Guards:** "Алёна, другая" (the other one) no longer folds into a listed Алёна (R1); "наши отношения", "мы с ..." and "нас" are never dots, like "our relationship" and "us" (R2).
- **Feeling words:** "нет", "なし" and the like give no feeling word; "и", "、" and the like split two feeling words (R3). Small words like "наша" and "у" aren't counted in the rename check (R5).
- **Dates** in other languages: "март 2026", "12 марта 2026", "в марте", "2026年3月", "3月12日", "12.03.2026", and ranges like "с 1 по 10 марта" or "3月1日から3月10日まで" (D7).
- **Quotes** «», „“, 「」 and 『』 turn on recall's exact-words search (D8). An Anchor heading "About <name>" works with a name in any alphabet (D9).
- **Widths:** fullwidth letters and the fullwidth ｜ and ： a brain may write in Japanese or Chinese are read as their ordinary forms.
- **Card search** splits Japanese, Chinese and Thai into words for its keyword half. Japanese, Thai and Hindi prose is never taken for machine output.

What this changes for an existing web: names in other languages may match differently on a rebuild (for example "моя Алёна" and "Алёна" are now one name, as "my Sam" and "Sam" always were). Run a dry-run rebuild first. English-only webs rebuild the same.

Known limits: Russian names whose vowel drops in other cases (Лев and Льва, Павел and Павла) are not found in those forms; Hungarian and Turkish endings are only tried in a line that shows that language's letters.

### Letters of every alphabet in name matching

Name matching, the place check, the feeling words, the rename test and the machine-output check used to keep only the English letters `a-z` and the digits `0-9`. They now keep letters, combining marks and digits of every alphabet (`\p{L}\p{M}\p{N}`).

What this changes for an existing web:

- **Names with letters outside English may split into separate dots on a rebuild.** Before, a name lost every such letter before it was compared, so `Zoë` and `Zo` were one dot, and a name written only in Cyrillic compared equal to any other. Those are now different names. Names made only of English letters and digits rebuild the same as before.
- **Run a dry-run rebuild first** and compare the shape of the web before rebuilding for real.
- **Names are now compared after NFC.** A name typed with combining marks and the same name typed with ready-made letters are one name.
- A piece of the Shelf written in another alphabet is no longer skipped as machine output. Pieces that were skipped that way before stay marked as read in the log.
