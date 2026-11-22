# Changelog

## 1.2.1 (November 21, 2026)

### Russian: Nesertes's regression lines after 1.2

Nesertes's follow-up (November 19, 2026): native-speaker regression lines run against 1.2, now in `code/tests/web-russian-tests.mjs`, and a made-up five-day conversation. Finding a name in a line still never merges two dots. English behaves exactly as before.

- **Names in -ий:** a name of five letters or more in -ий (Дмитрий, Василий, Евгений, Анатолий, Георгий) now also takes its noun case forms: Дмитрия, Дмитрию, Дмитрием, о Дмитрии. In 1.2 it took only adjective endings, so none of these was found. Сергей and Юрий are found as before; Дмитриев, Дмитриевич and Анатольевна are not; adjectives in -кий, -хий, -жий, -ший, -чий and -щий (русский, тихий, хороший) keep only their own endings.
- **"Мы с…" in the right form:** a name in -я now gives -ей (Таня, «мы с Таней»; Аня, Мария, Софья, Катя), and -ёй as well for a stressed ending (Илья, «мы с Ильёй» or «мы с Ильей»). A name in -ь gives -ью as well as -ем (Любовь, «мы с Любовью»; Игорь, «мы с Игорем»). In 1.2 these were missed, so «мы с Таней» could become a dot of its own.
- **Every name of the person:** the "us" phrases are built from every name in selfNames, not only the first, so with Борис and Боря both listed, «мы с Борей» is "us" too. A nickname is not worked out from the full name: list it. (The English "us" phrases still come from the first name only, as before.)

### Known limits (kept as tests)

Grammar alone can't decide these. They only affect finding a name in a line, never merging two dots.

- **Two names sharing a form:** «Ани» is a case form of Аня and also a name of its own that never changes; «Мику» is a form of Мика; «Евгения» is a woman's name and a form of Евгений. A line about one is never proof about the other.
- **Ordinary words that are a name's own case form:** «в свете фар» and «без света» (Света), «в поле» (Поля), «от лени» (Лена), «ники» (Ника), «машу» (Маша), «веру» (Вера), «в другом мире» (Мира) and «любовь» (Любовь), like «Я хочу мира» in 1.2. A two-word name is safer: Любовь Петровна is not found in «о большой любви».

### The Quiet Signal addendum

- Nesertes's five-day Tanya & Nora addendum (April 1 to 5, 2026; 42 lines; people, the pet, places and events all made up): the Russian test files, a line-by-line English reference, the test guide and a 15-question key (Q12 to Q15 are negative controls), with his regression lines, in `code/tests/fixtures/quiet-signal-addendum/`. The key is for the evaluator only; never ingest it.
- A test reads the five days with a pretend brain: five active days, none taken for machine output, every form of Дмитрий and Василий found on its days, and Anya and Ani, Sveta, Polya, Lena and Lyubov Petrovna kept as separate dots.

### Paper & Documentation

- The version line, 688 tests, the Timeline and Contributors.

## 1.2 (November 18, 2026)

### Russian: Nesertes's native-speaker review

Nesertes's review of the Russian word lists and name rules (November 14, 2026), with his test sentences in `code/tests/web-russian-tests.mjs`. Finding a name in a line still never merges two dots. English behaves exactly as before.

- **A name's own case forms only:** a name in -а/-я must carry one of its own endings, so Света is never found in «свет», Ника in «ник», Поля in «пол» or Маша in «машем». Names that end in a consonant take only singular endings, so Борис is never found in «Борисов».
- **Names that never change** (ending in и, у, ю, е or э, like Юки and Бенни) are found only as written, so Юки is never found in «Юка».
- **Names whose stem changes:** Лев and Льва, Павел and Павла, Пётр and Петра (a short, fixed list). This fixes the known limit in 1.1.
- **ё and е** are read as each other when finding a name (Алёна and Алена, Ильёй and Ильей), never when deciding two dots are one.
- **"No feeling"** is only a whole answer («нет», «ничего», «без чувств»); «нет радости» and «Нет, я всё ещё расстроен» keep their feeling.
- **"Unchanged":** «тоже» (too) and «так же» (in the same way) no longer count; «всё по-прежнему» and «осталось прежним» do.
- **Other, new and character words:** the missing case forms of другой, иной, второй, чужой, новый, персонаж, аватар, бот and шаблон. «другом» (with a friend) and «другими словами» (in other words) are left out on purpose.
- **"Me and…":** «мы с Борисом», «мы с Микой», «мы со Львом».
- Known limit: «Я хочу мира» still finds a Мира, because «мира» ("of peace") is the same word letter for letter.

### Dates

- **Two-digit years:** 7.2.26 and 07.02.26 are February 7, 2026 (day first, as in Russian); 31.2.26 is not a date.

### Moment and stretch

- **moment:** a single turning point, milestone or standout event, including one inside a single pivotal conversation or one continuous event crossing midnight; never routine small talk.
- **stretch:** a period of more than one day with a unifying tone or ongoing effort of its own; unrelated routine days don't become a dot.
- **Tie-breaker:** an experience over several days is a stretch; a moment dot beside it only when the source gives that sub-event its own name.
- Dots already in a web keep their kinds; the new wording guides each night from now on.

### Ranking by active days & recall visits

For ranking only. The active-day cooling idea comes from Mnemos (Riley Coyote). Nothing is forgotten, and "then", "now", the links and the log never change; the same made-up night gives the same web as 1.1.

- **Opening a link counts:** a link the companion opens by its mark counts as touched that day.
- **Active days:** a link's weight halves over 365 active days since it was last touched, not 365 calendar days. Active days come from the Shelf's file names (listed, never read while the companion looks), the days the night found conversation on (kept, sealed, in `Mind/web-active-days.sealed`), the web's own dates and the companion's visits. Days the computer was off don't age a memory. Dates inside pasted older text don't count (as in 287).

### Paper & Documentation

- Items from November 13: the Anchor section simplified to what runs today (hand-edited page with size checks on read); "thinking fully" dropped from dreams; "(Her own request.)" dropped; the 3D picture, "a web from day one" and the rest of the future plans dropped (so "Still to come" is gone).
- The dates: the design began in conversation, September 2 and 17 to 20, 2026; the House was set up October 2 to 13; the web was built from October 14. New Timeline rows.
- A Contributors section (Nesertes), and Related work, with Mnemos cited and contrasted.
- How a link is ranked, under For builders.

## 1.1 (November 12, 2026)

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
