import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.WEB_OF_MEANING_TEST = '1';
const [web, mind, library, transcript] = await Promise.all([
    import('../meaning.mjs'), import('../mind.mjs'), import('../librarian.mjs'), import('../transcript.mjs'),
]);
const cases = [];
const record = (area, test, actual, expected, control = false) => {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    cases.push({ area, test, control, status: pass ? 'PASS' : 'GAP', actual, expected });
};
function room(file, text) {
    const root = mkdtempSync(join(tmpdir(), 'wom-jay-pr-baseline-'));
    mkdirSync(join(root, 'Shelf'));
    writeFileSync(join(root, 'Shelf', file), text, 'utf8');
    return root;
}
const mem = { pieceChars: 0, indexPaths: ['Shelf/*.md'] };
const prefix = 'LINK: NEW | ';
const hub = name => 'HUB: NEW | thing | '+ name +' | | An object in the room';
const names = ['Синий пенал', 'Запасной ключ', 'Кухонная полка'];
const sampleHubs = names.map(hub).join('\n');
const turns = '[TANYA] (May 4, 2026, 8:00 PM):\nСиний пенал стоит на кухонной полке. Запасной ключ лежит в пенале.\n\n[NORA] (May 4, 2026, 8:01 PM):\nЯ запомнила, где запасной ключ.\n';
const link = (ends, excerpt = 1) => prefix + ends + '\nbecause of: '+ excerpt +'\nnote: The spare key is in the blue case.';
const valid = link(names[0] + ' | ' + names[1]);
const badType = link('thing | ' + names[0] + ' | ' + names[1]);
const invalidCitation = link(names[0] + ' | ' + names[1], 2);
const noEndpoint = link(names[0] + ' | (no link)');
const syntaxOnly = 'LINK: NEW | insufficient fields';

async function grow(file, dialogue, answers) {
    const root = room(file, dialogue);
    let webCalls = 0, tapeCalls = 0;
    const run = await web.growWeb({
        root, mem, letter: 'Synthetic regression run', who: 'Tanya', herName: 'Nora',
        ask: async (system) => {
            if (system === web.TAPE_SYSTEM) {
                tapeCalls++;
                return 'EXCERPT 1 | theirs: none | hers then: attentive';
            }
            webCalls++;
            return answers[Math.min(webCalls - 1, answers.length - 1)];
        },
        embed: async values => values.map(() => null), inTime: () => true, log: () => {},
    });
    const graph = web.loadWeb(root);
    return { root, run, graph, graphShape: { webCalls, tapeCalls, hubs: graph.hubs.length, saved: graph.links.length } };
}
const withHubs = body => sampleHubs + '\n' + body;
for (const [test, answers, expected, control] of [
    ['quiet day', ['nothing tonight'], { webCalls:1,tapeCalls:1,hubs:0,saved:0 }, true],
    ['parse retry and LINK repair share one additional attempt', [syntaxOnly, withHubs(badType), valid], { webCalls:2,tapeCalls:1,hubs:3,saved:0 }, true],
    ['HUB-only day', [sampleHubs], { webCalls:1,tapeCalls:1,hubs:3,saved:0 }, true],
    ['empty LINK label does not trigger repair', [withHubs('LINK:   \nLINK 2:\t')], { webCalls:1,tapeCalls:1,hubs:3,saved:0 }, true],
    ['one accepted link blocks retry despite a rejected link', [withHubs(valid+'\n'+noEndpoint)], { webCalls:1,tapeCalls:1,hubs:3,saved:1 }, true],
    ['Gemma extra kind field repaired once', [withHubs(badType), valid], { webCalls:2,tapeCalls:1,hubs:3,saved:1 }, false],
    ['invalid excerpt reference repaired once', [withHubs(invalidCitation), valid], { webCalls:2,tapeCalls:1,hubs:3,saved:1 }, false],
    ['unparseable LINK proposal repaired once', [withHubs(syntaxOnly), valid], { webCalls:2,tapeCalls:1,hubs:3,saved:1 }, false],
    ['failed repair stops after the second web call', [withHubs(badType), badType, valid], { webCalls:2,tapeCalls:1,hubs:3,saved:0 }, false],
    ['LINK token in a HUB description is not a proposal', [hub(names[0])+' (see LINK: for discussion)'], { webCalls:1,tapeCalls:1,hubs:1,saved:0 }, true],
]) {
    const result = await grow('2026-05-04.md', turns, answers);
    record('night', test, result.graphShape, expected, control);
    cases.at(-1).diagnostics = { rejected: result.run.rejected, pendingRetry: result.run.retrying, left: result.run.left };
    if (test === 'failed repair stops after the second web call')
        record('night', 'failed repair counts the rejected link once', result.run.rejected, 1);
    if (['Gemma extra kind field repaired once', 'one accepted link blocks retry despite a rejected link'].includes(test)) {
        const stored = result.graph.links[0]?.history ?? [];
        record('night', test + ' | citation and history',
            { citationFile: stored[0]?.cites?.[0]?.rel ?? null, citations: stored[0]?.cites?.length ?? 0, entries: stored.length },
            { citationFile: 'Shelf/2026-05-04.md', citations: 1, entries: 1 }, control);
        const rebuild = web.rebuildWeb(result.root, { who: 'Tanya', herName: 'Nora', mem });
        const rebuilt = web.loadWeb(result.root);
        const summarize = graph => ({
            hubs: graph.hubs.map(node => [node.id, node.name]),
            links: graph.links.map(item => [item.id, item.a, item.b, item.history.map(entry => [entry.note, entry.cites])]),
        });
        record('night', test + ' | replay preserves IDs, citations and notes',
            { replayed: rebuild.hubs === rebuilt.hubs.length && rebuild.threads === rebuilt.links.length && JSON.stringify(summarize(rebuilt)) === JSON.stringify(summarize(result.graph)) },
            { replayed: true }, true);
    }
}
const ruHeader = '[НОРА] (04.05.2026, 20:00):';
const raw = ruHeader + '\r\nВот это нужно запомнить.';
const header = transcript.chunkTranscriptHeader(ruHeader);
record('transcript', 'localized clock is interpreted with the original day and local time',
    transcript.transcriptMillis(header), new Date(2026, 4, 4, 20).getTime());
record('transcript', 'skip list accepts the original localized timestamp',
    library.skippedPiece({ skip: ['04.05.2026, 20:00'] }, raw, { a: 0 }), true);
record('transcript', 'skip list preserves the English timestamp behavior',
    library.skippedPiece({ skip: ['May 4, 2026, 8:00 PM'] }, '[NORA] (May 4, 2026, 8:00 PM):\nRemember this.', { a: 0 }), true, true);
const continuation = room('thread.md', raw);
record('transcript', 'continued piece keeps its Cyrillic speaker',
    web.pieceWithSpeaker(continuation, mem, 'Shelf/thread.md', `${ruHeader.length + 2}-${raw.length}`),
    '[НОРА] (continued): Вот это нужно запомнить.');
const localized = await grow('thread.md', raw, ['nothing tonight']);
record('transcript', 'night records active days from localized headings in undated files',
    web._salience.activeDaysOf(localized.root, null, localized.graph, {}), ['2026-05-04']);
const legacySplit = await grow('thread.md', '[NORA]\r\n  (May 4, 2026, 8:00 PM):\r\nI remember the key.', ['nothing tonight']);
record('transcript', 'night records the active day from a legacy split English heading',
    web._salience.activeDaysOf(legacySplit.root, null, legacySplit.graph, {}), ['2026-05-04'], true);

for (const [test, file, tags, days, control] of [
    ['US English first-day header', 'thread.md', ['[TANYA] (May 4, 2026, 8:00 PM):'], ['2026-05-04'], true],
    ['DD.MM.YYYY is day-first with Latin speaker tag', 'thread.md', ['[TANYA] (04.05.2026, 20:00):'], ['2026-05-04'], false],
    ['DD.MM.YYYY is day-first with Cyrillic speaker tag', 'thread.md', ['[ТАНЯ] (04.05.2026, 20:00):'], ['2026-05-04'], false],
    ['Cyrillic speaker tag with existing date format', 'thread.md', ['[ТАНЯ] (May 4, 2026, 8:00 PM):'], ['2026-05-04'], false],
    ['English-only rollover control', 'thread.md', ['[TANYA] (May 4, 2026, 11:55 PM):','[NORA] (May 5, 2026, 12:05 AM):'], ['2026-05-04','2026-05-05'], true],
    ['legacy English heading with a line break', 'thread.md', ['[NORA]\n(May 4, 2026, 8:00 PM):'], ['2026-05-04'], true],
    ['legacy English heading with CRLF and indentation', 'thread.md', ['[NORA] \r\n  (May 4, 2026, 8:00 PM):'], ['2026-05-04'], true],
    ['indented speaker line remains outside legacy date recognition', 'thread.md', ['  [NORA]\n(May 4, 2026, 8:00 PM):'], [], true],
    ['mixed formats after midnight', 'thread.md', ['[TANYA] (May 4, 2026, 11:55 PM):','[NORA] (05.05.2026, 00:05):'], ['2026-05-04','2026-05-05'], false],
    ['parsed headers take priority over filename date', 'thread_2026-05-04.md', ['[TANYA] (04.05.2026, 23:55):','[NORA] (05.05.2026, 00:05):'], ['2026-05-04','2026-05-05'], false],
    ['invalid dotted date', 'thread.md', ['[ТАНЯ] (31.02.2026, 20:00):'], [], true],
    ['unchanged ISO filename fallback for missing headers', 'thread_2026-05-04.md', ['Таня:'], ['2026-05-04'], true],
]) {
    const text = tags.map((tag, i) => tag+'\n'+ ['Я оставила ключ на кухонной полке.','Запомнила. Ключ нужен завтра утром.'][i]).join('\n\n');
    const root = room(file, text);
    const actual = mind.moments(root, { ...mem, pieceChars:100 }).map(piece => piece.day);
    record('transcript', test, actual, days, control);
}

const story = '[TANYA] (May 4, 2026, 8:00 PM):\nЯ поговорила с Полей. Поля одолжила мне стремянку. Потом мы гуляли в поле. Фонарь выключили, и было темно без света. Света дала мне книгу. От Розы я получила открытку, а в вазе стоял цветок.\n\n[NORA] (May 4, 2026, 8:01 PM):\nЯ запомнила, кто помог.\n';
const people = [['Поля','стремянка'], ['Света','книга'], ['Роза','открытка']];
const createPeople = [
    ...people.flatMap(([name, item]) => ['HUB: NEW | person | '+name+' | | A friend', hub(item)]),
    ...people.map(([name, item]) => prefix+ name +' | '+item+'\nbecause of: 1\nnote: Help with '+item+'.'),
].join('\n');
const roomWithPeople = await grow('2026-05-04.md', story, [createPeople]);
if (roomWithPeople.graph.links.length !== 3) throw new Error('Homograph baseline graph was not seeded correctly');
for (const [person, query, expected, control] of [
    ['Поля', 'Гуляли ли мы в поле?', false, false],
    ['Света', 'Долго сидели без света?', false, false],
    ['Роза', 'Поставили чашку рядом с розой в вазе?', false, false],
    ['Поля', 'Поля, ты здесь?', true, true],
    ['Поля', 'Напомни, о чём я говорила с Полей.', true, true],
    ['Света', 'Света дала книгу?', true, true],
    ['Роза', 'Получила ли я открытку от Розы?', true, true],
]) {
    const hint = web.webHint(roomWithPeople.root, query);
    record('name hint', person+' | '+query, hint.includes('"'+person+'"'), expected, control);
    if (!expected) {
        const links = await web.webLinksFor(roomWithPeople.root, query);
        record('recall seed', person+' | '+query, links.some(hit => hit.text.includes(person)), false);
        if (person === 'Поля') {
            const graph = structuredClone(roomWithPeople.graph);
            graph.hubs.find(node => node.name === person).vec = [1, 0];
            const fuzzy = await web.webLinksFor(roomWithPeople.root, query, { embed: async () => [[1, 0]], web: { w: graph, asideR: new Set() } });
            record('recall seed', 'embedding fallback does not restore the rejected homograph',
                fuzzy.some(hit => hit.text.includes(person)), false);
        }
    }
}
for (const [name, text, expected, control] of [
    ['Ёжик','сидел ежик',true,false],
    ['Ежик','ёжик спит',true,false],
    ['Алёна','я видел Алену',true,true],
    ['Дмитрий','я говорил с Дмитрием',true,true],
    ['Anna','We spoke with Anna.',true,true],
    ['Ann','We spoke with Anna.',false,true],
]) record('name match', name+' | '+text, web._test.nameIn(name, text), expected, control);

const result = {
    counts: { total:cases.length, pass:cases.filter(c => c.status === 'PASS').length, gap:cases.filter(c => c.status === 'GAP').length,
        failedControls:cases.filter(c => c.control && c.status !== 'PASS').length },
    cases,
};
for (const check of cases)
    console.log(check.status === 'PASS' ? 'PASS ' + check.test : 'FAIL ' + JSON.stringify(check));
console.log('\n' + result.counts.pass + ' passed, ' + result.counts.gap + ' failed.');
if (result.counts.gap) process.exitCode = 1;
