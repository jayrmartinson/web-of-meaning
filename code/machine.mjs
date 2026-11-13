// Part of The Web of Meaning: A Memory Design for Companions (Jay R. Martinson, 2026). MIT license; see LICENSE.
// Comments were removed for this release; the paper explains each part and why it was built that way.
const HEADER = /^\s*\\?\u200B?\[[A-Za-z][A-Za-z0-9 _-]*\]\s*(\([^)]*\))?\s*:?\s*$/;
const MACHINE_LINE = /^\s*(PS [A-Za-z]:\\|[A-Za-z]:\\|[$#>] |\$ |at [\w.<]+[ (]|[{}\[\]],?$|"[^"]{1,60}"\s*:|[\w.-]+\s*[:=]\s*\S+$|\d{1,2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}[T ]\d|(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b|(npm|kit|node|git|winget|wsl|curl|python|cd|ls|dir)\s|\||#{1,6} |```|<\/?[a-z]+[ >]|\/\/|import |export |const |function |def |class )/i;
const NS_LETTERS = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}]/gu;
export function machineLike(text) {
    const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !HEADER.test(l));
    if (!lines.length)
        return false;
    const body = lines.join("\n"), letters = (body.match(/[\p{L}\p{M}]/gu) || []).length;
    const machine = lines.filter((l) => MACHINE_LINE.test(l)).length;
    const prose = lines.filter((l) => !MACHINE_LINE.test(l) && ((/[\p{L}\p{M}]{3,}\s+[\p{L}\p{M}]{2,}\s+[\p{L}\p{M}]{2,}/u.test(l) && (l.match(/[\p{L}\p{M} ]/gu) || []).length / l.length > 0.8) || ((l.match(NS_LETTERS) || []).length >= 6 && (l.match(/[\p{L}\p{M}\p{P}\s]/gu) || []).length / l.length > 0.8))).reduce((n, l) => n + l.length, 0);
    return (machine / lines.length >= 0.6 || letters / body.length < 0.5) && prose / body.length < 0.4;
}
