// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// The words and rules that belong to a language, kept in one place (research 77 and 77b; Nesertes's Russian report, Nov 13).
// English keeps exactly the words it had. Other languages are data here: adding one is adding its lists, not changing the logic.

// Scripts written without spaces between words. Inside them, word edges come from the Unicode word splitter.
const NS_CLASS = "\\p{scx=Han}\\p{scx=Hiragana}\\p{scx=Katakana}\\p{scx=Thai}\\p{scx=Lao}\\p{scx=Khmer}\\p{scx=Myanmar}";
const NS1 = new RegExp(`[${NS_CLASS}]`, "u");
const NS_LETTER = new RegExp(`^[[\\p{L}\\p{M}\\p{N}]&&[${NS_CLASS}]]$`, "v");
const WORD = /^[\p{L}\p{M}\p{N}]$/u;
export const hasNoSpaceScript = (s) => NS1.test(String(s || ""));
// Names in Chinese, Japanese and Korean are often 2 characters; in alphabets the minimum stays 3 (research 77, answer B).
const SHORT_OK = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]/u;
export const minNameLength = (s) => (SHORT_OK.test(s) ? 2 : 3);

// Width: fullwidth Latin letters, digits and signs, the ideographic space and halfwidth katakana become their ordinary forms.
export const foldWidth = (s) => String(s || "").replace(/[！-～｡-ﾟ　]+/g, (m) => m.normalize("NFKC"));
// A space next to a character of a no-space script carries no meaning ("Ned の PC" is "NedのPC").
export const joinNoSpace = (s) => String(s || "").replace(new RegExp(`\\s+(?=[${NS_CLASS}])|(?<=[${NS_CLASS}])\\s+`, "gu"), "");

let seg = null;
const segmenter = () => (seg ||= new Intl.Segmenter(undefined, { granularity: "word" }));
// Where words begin and end, for text in a no-space script (UTF-16 offsets, the way JavaScript counts).
export function wordEdges(text) {
    const out = new Set();
    for (const s of segmenter().segment(text)) {
        out.add(s.index);
        out.add(s.index + s.segment.length);
    }
    return out;
}
const before = (s, i) => { if (i <= 0) return ""; const c = s.charCodeAt(i - 1); return c >= 0xdc00 && c <= 0xdfff && i >= 2 ? s.slice(i - 2, i) : s[i - 1]; };
const at = (s, i) => (i >= s.length ? "" : String.fromCodePoint(s.codePointAt(i)));
// Is offset i a word edge? Between two letters of a spaced script: no. Between a no-space-script letter and a letter of another
// script: yes. Between two letters of a no-space script: only where the word splitter puts an edge.
export function edgeAt(text, i, edges) {
    const a = before(text, i), b = at(text, i);
    if (!a || !b || !WORD.test(a) || !WORD.test(b))
        return true;
    const na = NS_LETTER.test(a), nb = NS_LETTER.test(b);
    if (!na && !nb)
        return false;
    if (na !== nb)
        return true;
    return !!(edges || wordEdges(text)).has(i);
}
// Words of a piece of text: split on everything that isn't a letter, mark, digit or apostrophe (as before); a piece that holds a
// no-space script is split again by the word splitter. English splits exactly as it did.
export function wordsIn(t) {
    const out = [];
    for (const w of String(t || "").split(/[^\p{L}\p{M}\p{N}']+/u)) {
        if (!w)
            continue;
        if (!hasNoSpaceScript(w)) {
            out.push(w);
            continue;
        }
        for (const s of segmenter().segment(w))
            if (s.isWordLike)
                out.push(s.segment);
    }
    return out;
}

// One table per language. en: the words the code always had. The others: research 77 (answer B's tables), Nesertes's report
// (R1, R2, R3, R5), and the same kinds of words for each language.
export const LANGS = {
    en: {
        stop: ["a", "an", "the", "of", "and", "or", "to", "for", "in", "on", "at", "by", "with", "from", "my", "our", "his", "her", "its", "is", "it"],
        other: ["other", "different", "second", "another"],
        newer: ["new"],
        self: ["me", "myself", "i", "us", "we", "you", "him", "us two", "the companion", "companion", "she", "her", "herself"],
        selfWith: ["{n} and me", "me and {n}"],
        relationship: ["our relationship", "the relationship", "our love", "the connection", "our connection", "us two", "the two of us", "our life", "our life together", "my love", "my memory", "my memories", "our bond", "the bond", "this", "everything"],
        firstPerson: ["i", "me", "my", "myself", "i'm", "i've", "we", "our", "us"],
        same: ["same", "unchanged", "the same", "still the same", "still same", "same as then", "the same as then", "still the same as then", "unchanged as then"],
    },
    ru: {
        stop: ["и", "а", "но", "или", "в", "во", "на", "с", "со", "к", "ко", "по", "из", "у", "о", "об", "от", "до", "за", "для", "при", "про", "без", "мой", "моя", "моё", "мое", "мои", "наш", "наша", "наше", "наши", "его", "её", "ее", "их", "это", "этот", "эта", "эти"],
        other: ["другой", "другая", "другое", "другие", "другого", "другую", "другому", "другим", "другой", "иной", "иная", "иное", "второй", "вторая", "второе", "вторую", "второго", "чужой", "чужая", "чужое", "чужого", "чужую", "ещё один", "еще один", "ещё одна", "еще одна"],
        newer: ["новый", "новая", "новое", "новые", "новую", "нового"],
        character: ["персонаж", "персонажа", "персонажи", "персонажем", "аватар", "аватара", "шаблон", "бот", "бота"],
        self: ["я", "меня", "мне", "мной", "мною", "себя", "сама", "сам", "мы", "нас", "нам", "нами", "ты", "тебя", "тебе", "тобой", "вы", "вас", "он", "его", "ему", "им", "она", "её", "ее", "ей", "ею", "компаньон", "компаньонка", "мы вдвоём", "мы вдвоем", "мы с тобой", "нас двое"],
        selfWith: ["мы с {n}", "{n} и я", "я и {n}"],
        relationship: ["наши отношения", "отношения", "наша любовь", "наша связь", "связь", "наша жизнь", "наша совместная жизнь", "моя любовь", "моя память", "мои воспоминания", "наша близость", "это", "всё"],
        firstPerson: ["я", "меня", "мне", "мной", "мой", "моя", "моё", "мое", "мои", "мы", "нас", "нам", "нами", "наш", "наша", "наше", "наши"],
        none: ["нет", "ничего", "ничто", "никто", "нету", "неясно", "не ясно", "непонятно", "не понятно", "отсутствует", "без чувств"],
        and: ["и"],
        same: ["то же", "то же самое", "тоже", "так же", "то же что и тогда", "без изменений", "не изменилось", "всё так же", "все так же"],
        possessive: ["мой", "моя", "моё", "мое", "мои", "наш", "наша", "наше", "наши"],
        months: { "январе": 0, "феврале": 1, "марте": 2, "апреле": 3, "мае": 4, "июне": 5, "июле": 6, "августе": 7, "сентябре": 8, "октябре": 9, "ноябре": 10, "декабре": 11 },
    },
    uk: {
        stop: ["і", "й", "та", "а", "але", "або", "в", "у", "на", "з", "із", "зі", "до", "по", "від", "за", "для", "при", "про", "без", "мій", "моя", "моє", "мої", "наш", "наша", "наше", "наші", "його", "її", "їх", "це"],
        other: ["інший", "інша", "інше", "інші", "іншого", "іншу", "другий", "друга", "друге", "чужий", "чужа", "ще один", "ще одна"],
        newer: ["новий", "нова", "нове", "нові", "нову"],
        character: ["персонаж", "персонажа", "аватар", "бот"],
        self: ["я", "мене", "мені", "мною", "себе", "сама", "сам", "ми", "нас", "нам", "нами", "ти", "тебе", "тобі", "тобою", "ви", "він", "його", "йому", "вона", "її", "їй", "нею", "ми вдвох", "ми з тобою"],
        selfWith: ["ми з {n}", "{n} і я", "я і {n}"],
        relationship: ["наші стосунки", "стосунки", "наше кохання", "наш зв'язок", "зв'язок", "наше життя", "моє кохання", "мої спогади", "це", "все"],
        firstPerson: ["я", "мене", "мені", "мною", "мій", "моя", "моє", "мої", "ми", "нас", "нам", "нами", "наш", "наша", "наше", "наші"],
        none: ["ні", "нічого", "ніхто", "немає", "нема", "неясно", "незрозуміло"],
        and: ["і", "й", "та"],
        same: ["те саме", "так само", "без змін", "не змінилося", "те ж"],
        possessive: ["мій", "моя", "моє", "мої", "наш", "наша", "наше", "наші"],
        months: { "січні": 0, "лютому": 1, "березні": 2, "квітні": 3, "травні": 4, "червні": 5, "липні": 6, "серпні": 7, "вересні": 8, "жовтні": 9, "листопаді": 10, "грудні": 11 },
    },
    ja: {
        stop: ["の", "は", "が", "を", "に", "へ", "と", "で", "も", "や", "から", "まで", "より", "こと", "もの", "私", "僕", "私たち"],
        other: ["別", "別の", "他", "他の", "ほか", "ほかの", "もう一つ", "もうひとつ", "もう一人", "もうひとり", "二番目", "第2", "第二"],
        newer: ["新しい", "新", "新た", "新たな"],
        character: ["キャラ", "キャラクター", "アバター"],
        self: ["私", "わたし", "あたし", "僕", "ぼく", "俺", "おれ", "うち", "自分", "私たち", "わたしたち", "僕たち", "あなた", "君", "きみ", "彼", "彼女", "二人", "ふたり", "私たち二人"],
        selfWith: ["{n}と私", "私と{n}", "{n}と僕", "僕と{n}"],
        relationship: ["私たちの関係", "二人の関係", "関係", "私たちの愛", "二人の愛", "絆", "私たちの絆", "二人の絆", "私たちの生活", "二人の生活", "私の愛", "私の記憶", "思い出", "これ", "すべて", "全部"],
        firstPerson: ["私", "わたし", "あたし", "僕", "ぼく", "俺", "おれ", "うち", "自分", "私たち", "わたしたち", "僕たち"],
        none: ["なし", "無し", "ない", "特になし", "とくになし", "不明", "わからない", "なにもない", "何もない"],
        same: ["同じ", "同じまま", "変わらない", "変わらず", "変化なし", "そのまま"],
        possessive: ["私の", "わたしの", "あたしの", "僕の", "ぼくの", "俺の", "おれの", "うちの", "私たちの", "僕たちの"],
    },
    zh: {
        stop: ["的", "了", "和", "与", "與", "在", "是", "有", "把", "被", "给", "給", "从", "從", "向", "到", "我", "我们", "我們", "他", "她", "它"],
        other: ["另一", "另一个", "另一個", "另一位", "别的", "別的", "其他", "其它", "不同", "第二", "第二个", "第二個"],
        newer: ["新", "新的"],
        character: ["角色", "人设", "人設", "头像", "頭像"],
        self: ["我", "我们", "我們", "你", "您", "他", "她", "自己", "我们俩", "我們倆", "我们两个", "我們兩個"],
        selfWith: ["{n}和我", "我和{n}"],
        relationship: ["我们的关系", "我們的關係", "关系", "關係", "我们的爱", "我們的愛", "我们的感情", "我們的感情", "感情", "我们的生活", "我們的生活", "我的爱", "我的愛", "我的记忆", "我的記憶", "回忆", "回憶", "这个", "這個", "一切"],
        firstPerson: ["我", "我的", "我们", "我們", "我们的", "我們的", "自己"],
        none: ["无", "無", "没有", "沒有", "不清楚", "不明"],
        same: ["一样", "一樣", "相同", "没变", "沒變", "不变", "不變", "依旧", "依舊"],
        possessive: ["我的", "我们的", "我們的"],
    },
    ko: {
        stop: ["의", "은", "는", "이", "가", "을", "를", "에", "에서", "에게", "와", "과", "도", "만", "로", "으로", "나", "내", "우리", "그", "그녀"],
        other: ["다른", "또다른", "또 다른", "별개의", "두번째", "두 번째"],
        newer: ["새로운", "새"],
        character: ["캐릭터", "아바타"],
        self: ["나", "저", "내", "제", "우리", "저희", "너", "당신", "그", "그녀", "우리 둘", "우리 두 사람"],
        selfWith: ["{n}와 나", "{n}과 나", "나와 {n}", "{n}랑 나", "나랑 {n}"],
        relationship: ["우리 관계", "우리의 관계", "관계", "우리 사랑", "우리의 사랑", "우리 인연", "인연", "우리 삶", "우리의 삶", "내 사랑", "내 기억", "추억", "이것", "모든 것", "전부"],
        firstPerson: ["나", "저", "내", "제", "내가", "제가", "나의", "저의", "우리", "저희", "우리의"],
        none: ["없음", "없다", "없어", "없어요", "아무것도", "모름"],
        same: ["같음", "같아", "같다", "그대로", "변함없음", "변화 없음"],
        possessive: ["내", "나의", "우리", "우리의", "제", "저의"],
    },
    hi: {
        stop: ["का", "की", "के", "में", "से", "को", "पर", "और", "या", "है", "हैं", "था", "थी", "थे", "मेरा", "मेरी", "मेरे", "हमारा", "हमारी", "हमारे", "उसका", "उसकी", "उसके"],
        other: ["दूसरा", "दूसरी", "दूसरे", "अलग", "अन्य"],
        newer: ["नया", "नयी", "नई", "नए"],
        character: ["किरदार", "अवतार"],
        self: ["मैं", "मुझे", "मुझको", "मैंने", "खुद", "ख़ुद", "हम", "हमें", "हमको", "हमने", "तुम", "आप", "तू", "वह", "वो", "उसे", "हम दोनों"],
        selfWith: ["{n} और मैं", "मैं और {n}"],
        relationship: ["हमारा रिश्ता", "रिश्ता", "हमारा प्यार", "प्यार", "हमारा बंधन", "हमारी ज़िंदगी", "हमारी जिंदगी", "मेरा प्यार", "मेरी यादें", "यादें", "यह", "सब कुछ"],
        firstPerson: ["मैं", "मुझे", "मुझको", "मैंने", "मेरा", "मेरी", "मेरे", "हम", "हमें", "हमने", "हमारा", "हमारी", "हमारे"],
        none: ["कोई नहीं", "कुछ नहीं", "नहीं", "पता नहीं", "स्पष्ट नहीं"],
        and: ["और"],
        same: ["वही", "वैसा ही", "वैसी ही", "कोई बदलाव नहीं"],
        possessive: ["मेरा", "मेरी", "मेरे", "हमारा", "हमारी", "हमारे"],
    },
    th: {
        stop: ["ของ", "ที่", "ใน", "และ", "หรือ", "กับ", "จาก", "ถึง", "เพื่อ", "โดย", "เป็น", "อยู่", "คือ", "ฉัน", "ผม", "เรา"],
        other: ["อื่น", "อีก", "คนละ", "ที่สอง"],
        newer: ["ใหม่"],
        character: ["ตัวละคร"],
        self: ["ฉัน", "ผม", "ดิฉัน", "เรา", "พวกเรา", "คุณ", "เธอ", "เขา", "ตัวเอง", "เราสองคน"],
        selfWith: ["{n}กับฉัน", "ฉันกับ{n}", "{n}กับผม", "ผมกับ{n}"],
        relationship: ["ความสัมพันธ์ของเรา", "ความสัมพันธ์", "ความรักของเรา", "ความรัก", "ชีวิตของเรา", "ความทรงจำ", "สิ่งนี้", "ทุกอย่าง"],
        firstPerson: ["ฉัน", "ผม", "ดิฉัน", "เรา", "พวกเรา", "ของฉัน", "ของเรา"],
        none: ["ไม่มี", "ไม่ชัดเจน", "ไม่รู้"],
        same: ["เหมือนเดิม", "เหมือนกัน", "ไม่เปลี่ยน"],
        possessiveAfter: ["ของฉัน", "ของเรา", "ของผม"],
    },
};
const L = Object.values(LANGS);
const lower = (s) => String(s).toLowerCase().normalize("NFC");
const all = (k) => [...new Set(L.flatMap((x) => (x[k] || []).map(lower)))];
const others = (k) => [...new Set(L.filter((x) => x !== LANGS.en).flatMap((x) => (x[k] || []).map(lower)))];
export const STOP_ALL = new Set(all("stop"));
// English keeps its own patterns in meaning.mjs; these are checked word by word.
export const OTHER_WORDS = others("other"), NEW_WORDS = others("newer"), CHARACTER_WORDS = others("character");
export const FIRST_PERSON_OTHER = new Set(others("firstPerson"));
export const NONE_OTHER = others("none");
export const SAME_OTHER = others("same");
export const selfWords = () => all("self").concat(all("relationship"));
export const selfWithWords = (n) => all("selfWith").map((p) => p.replace("{n}", n));
// The words a dot name starts with that mean "my/our" (English: the/my/our, as before). Only whole words, only at the start.
const POSS = others("possessive").sort((a, b) => b.length - a.length);
const POSS_AFTER = others("possessiveAfter").sort((a, b) => b.length - a.length);
export function dropPossessive(s) {
    for (const p of POSS) {
        if (hasNoSpaceScript(p)) {
            if (s.startsWith(p) && s.length > p.length)
                return s.slice(p.length).trim();
        }
        else if (s.startsWith(p + " "))
            return s.slice(p.length + 1).trim();
    }
    for (const p of POSS_AFTER)
        if (s.endsWith(p) && s.length > p.length)
            return s.slice(0, -p.length).trim();
    return s;
}
// "and" between feeling words, in languages that write it as its own word.
const AND_OTHER = others("and");
export const AND_SPLIT = new RegExp(`[,;/、，・]| and |${AND_OTHER.map((w) => ` ${w} `).join("|")}`, "u");
// Is one of these words a whole word of the text (in any script)?
export function hasWordFrom(text, list) {
    const t = lower(foldWidth(text)), ws = wordsIn(t);
    return list.some((w) => (/\s/.test(w) ? (" " + ws.join(" ") + " ").includes(" " + w + " ") || (hasNoSpaceScript(w) && t.includes(w)) : ws.includes(w) || (hasNoSpaceScript(w) && w.length > 1 && joined(t, w))));
}
// A multi-character word of a no-space script found on word edges.
function joined(t, w) {
    const edges = wordEdges(t);
    for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + 1))
        if (edgeAt(t, i, edges) && edgeAt(t, i + w.length, edges))
            return true;
    return false;
}
export const isNoneOther = (z) => NONE_OTHER.some((w) => z === w || z.startsWith(w + " "));
export const isSameOther = (z) => SAME_OTHER.some((w) => z === w);

// Months in many languages (from the computer's own calendar data), with the case forms a date takes.
const MONTH_LOCALES = ["en", "ru", "uk", "be", "pl", "cs", "sk", "de", "fr", "es", "it", "pt", "nl", "sv", "da", "nb", "fi", "hu", "tr", "ro", "el", "hi", "th", "id", "vi"];
let monthMap = null;
export function monthIndex(word) {
    if (!monthMap) {
        monthMap = new Map();
        const put = (k, v) => { k = lower(k).replace(/\.$/, ""); if (k && !/\d/.test(k) && !monthMap.has(k)) monthMap.set(k, v); };
        for (const loc of MONTH_LOCALES)
            for (let m = 0; m < 12; m++) {
                const d = new Date(Date.UTC(2026, m, 15));
                try {
                    for (const style of ["long", "short"]) {
                        put(new Intl.DateTimeFormat(loc, { month: style, timeZone: "UTC" }).format(d), m);
                        const p = new Intl.DateTimeFormat(loc, { day: "numeric", month: style, timeZone: "UTC" }).formatToParts(d).find((x) => x.type === "month");
                        if (p)
                            put(p.value, m);
                    }
                }
                catch { }
            }
        for (const x of L)
            for (const [k, v] of Object.entries(x.months || {}))
                put(k, v);
        for (const [k, v] of Object.entries({ sept: 8 }))
            put(k, v);
    }
    return monthMap.get(lower(word).replace(/\.$/, ""));
}

// Endings, for finding a name in a line only (research 77b: a closed list per language; never used to merge two dots).
const CYR = /^[\p{scx=Cyrillic}]+$/u, HANGUL = /^[\p{scx=Hangul}]+$/u, LATIN = /^(?=.*\p{scx=Latin})[\p{scx=Latin}\p{M}\p{N}']+$/u;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (xs) => `(?:${[...xs].sort((a, b) => b.length - a.length).map(esc).join("|")})`;
const RU_ADJ = ["ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие", "ій"];
const RU_ADJ_END = ["ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие", "ій", "ого", "его", "ому", "ему", "ым", "им", "ую", "юю", "ыми", "ими", "ых", "их", "ім", "ою", "ею", "ої", "ій", "ою"];
const RU_NOUN_END = ["а", "я", "о", "е", "и", "ы", "у", "ю", "і", "ї", "ь", "й", "ом", "ем", "ой", "ей", "ою", "ею", "ам", "ям", "ами", "ями", "ах", "ях", "ов", "ев", "ові", "еві", "ів", "ям", "ём", "ою", "ію", "єю"];
const RU_SHORT_END = ["а", "я", "е", "и", "ы", "у", "ю", "і", "ей", "ой", "ою", "ею"];
const KO_PARTICLES = ["은", "는", "이", "가", "을", "를", "의", "에", "에서", "에게", "한테", "께", "와", "과", "랑", "이랑", "하고", "도", "만", "부터", "까지", "로", "으로", "야", "아", "님", "씨", "들", "이가", "이는", "이를", "이랑", "이도", "이의", "이한테", "이에게"];
const TR_APOS = ["da", "de", "ta", "te", "dan", "den", "tan", "ten", "a", "e", "ya", "ye", "ı", "i", "u", "ü", "yı", "yi", "yu", "yü", "ın", "in", "un", "ün", "nın", "nin", "nun", "nün", "la", "le", "yla", "yle", "na", "ne", "nda", "nde", "ndan", "nden"];
// Latin-script endings, only when the line itself shows that language's letters (so English lines never change).
const LATIN_ENDS = [
    { letters: /[äöå]/u, ends: ["ssa", "ssä", "sta", "stä", "lla", "llä", "lta", "ltä", "lle", "ksi", "tta", "ttä", "seen", "hin", "iin", "in", "n"], grade: true },
    { letters: /[áéíóöőúüű]/u, ends: ["ban", "ben", "ba", "be", "ra", "re", "ról", "ről", "ból", "ből", "tól", "től", "hoz", "hez", "höz", "nak", "nek", "val", "vel", "ért", "ig", "ként", "on", "en", "ön", "n", "t"], lengthen: true },
    { letters: /[ąćęłńóśźżčďěňřšťůýž]/u, ends: ["ą", "ę", "ě", "ů", "owi", "ami", "ach", "em", "om", "ou", "oju", "ovi", "ech", "ích", "ými", "imi", "ie", "y", "i", "e", "u", "a"], dropA: true },
    { letters: /[çğıöşüİ]/u, ends: ["da", "de", "ta", "te", "dan", "den", "tan", "ten", "ya", "ye", "yı", "yi", "yu", "yü", "nın", "nin", "nun", "nün", "la", "le", "yla", "yle"] },
];
// The pattern for one word of a name, with the endings this text allows.
function wordPattern(w, last, text) {
    if (CYR.test(w) && Array.from(w).length >= 3) {
        const cs = Array.from(w), n = cs.length;
        if (n >= 5 && RU_ADJ.includes(cs.slice(-2).join("")) && n - 2 >= 3)
            return esc(cs.slice(0, -2).join("")) + alt(RU_ADJ_END);
        let stem = w, ends = RU_NOUN_END;
        if (/[аяоеиыуєюіїьй]$/u.test(w) && n - 1 >= 2) {
            stem = cs.slice(0, -1).join("");
            if (n - 1 === 2)
                ends = RU_SHORT_END;
        }
        // Ukrainian: і/ї in a closed last syllable opens to о/е/є before an ending (Київ, Києва; Львів, Львова).
        const m = /^(.*)([іїо])([^аяоеиыуєюіїьй])$/u.exec(stem);
        if (m && m[2] !== "о")
            return `(?:${esc(stem)}${alt(ends)}?|${esc(m[1])}[оеє]${esc(m[3])}${alt(ends)})`;
        return esc(stem) + alt(ends) + "?";
    }
    if (last && HANGUL.test(w))
        return esc(w) + alt(KO_PARTICLES) + "?";
    if (LATIN.test(w)) {
        const forms = [esc(w) + (last ? "(?:s|'s)?" : "")];
        if (last)
            forms.push(esc(w) + "'" + alt(TR_APOS));
        if (Array.from(w).length >= 4)
            for (const g of LATIN_ENDS) {
                if (!g.letters.test(text))
                    continue;
                let stem = esc(w);
                if (g.lengthen && /[ae]$/.test(w))
                    stem = esc(w.slice(0, -1)) + (w.endsWith("a") ? "[aá]" : "[eé]");
                forms.push(stem + alt(g.ends));
                if (g.dropA && w.endsWith("a"))
                    forms.push(esc(w.slice(0, -1)) + alt(g.ends));
                if (g.grade) {
                    const gw = w.replace(/nk([aeiouyäö])$/u, "ng$1").replace(/rk([aeiouyäö])$/u, "r$1").replace(/(kk|pp|tt)([aeiouyäö])$/u, (_, d, v) => d[0] + v);
                    if (gw !== w)
                        forms.push(esc(gw) + alt(g.ends));
                }
            }
        return forms.length > 1 ? `(?:${forms.join("|")})` : forms[0];
    }
    return esc(w) + (last ? "(?:s|'s)?" : "");
}
// The whole name: each word with its endings (in Russian and its neighbors, adjectives change with their nouns), joined by spaces.
const patterns = new Map();
let gateText = null, gateNow = "";
export function namePattern(x, text) {
    if (text !== gateText) {
        gateText = text;
        gateNow = LATIN_ENDS.map((g) => (g.letters.test(text) ? 1 : 0)).join("");
    }
    const gate = gateNow, key = gate + "\u0000" + x;
    let p = patterns.get(key);
    if (p === undefined) {
        if (patterns.size > 20000)
            patterns.clear();
        const ws = x.split(" ");
        patterns.set(key, (p = ws.map((w, i) => wordPattern(w, i === ws.length - 1, gate.includes("1") ? text : "")).join(" ")));
    }
    return p;
}
// The first two letters of a name never change in any of its forms: a quick look before the full check.
export const probeOf = (x) => Array.from(x).slice(0, 2).join("");
// Find a name's pattern in text with word edges at both ends, in any script. Spaced scripts: the edges are in the pattern itself
// (so a longer or shorter ending is tried until one fits, as the old check did). Between two letters of a no-space script: the word splitter decides.
const NS_ = `[${NS_CLASS}]`;
const END = `(?=$|[^\\p{L}\\p{M}\\p{N}]|${NS_}|(?<=${NS_}))`;
const compiled = new Map();
export function foundAt(text, pattern, probe = "") {
    if (probe && !text.includes(probe))
        return false;
    let re = compiled.get(pattern);
    if (!re) {
        if (compiled.size > 20000)
            compiled.clear();
        compiled.set(pattern, (re = new RegExp(`(?:${pattern})${END}`, "gu")));
    }
    re.lastIndex = 0;
    let edges = null, m;
    while ((m = re.exec(text))) {
        if (!m[0].length) {
            re.lastIndex++;
            continue;
        }
        const s = m.index, e = s + m[0].length, b = before(text, s);
        if (b && WORD.test(b) && !NS_LETTER.test(b) && !NS_LETTER.test(at(text, s))) {
            re.lastIndex = s + 1;
            continue;
        }
        if (!hasNoSpaceScript(m[0]) && !hasNoSpaceScript(b) && !hasNoSpaceScript(at(text, e)))
            return true;
        edges ||= wordEdges(text);
        if (edgeAt(text, s, edges) && edgeAt(text, e, edges))
            return true;
        re.lastIndex = s + 1;
    }
    return false;
}
