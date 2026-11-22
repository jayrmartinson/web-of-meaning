// Shared transcript header recognition for the conversation index and memory views.
const PREFIX = /^\\?\u200B?\[([^\]]+)\]\s*\(([^)]*)\):\s*$/;
export const TRANSCRIPT_SPEAKER = String.raw`(?:[A-Za-z][A-Za-z0-9 _-]*|[\p{Script=Cyrillic}][\p{Script=Cyrillic}\p{M}0-9 _-]*)`;
const SPEAKER = new RegExp(`^(?:${TRANSCRIPT_SPEAKER})$`, "u");
const CYRILLIC_START = /^\p{Script=Cyrillic}/u;
const LEGACY_CHUNK = /^\\?\u200B?\[([A-Z][A-Z0-9 _-]*)\]\s*\((.+?)\):\s*$/;
const PLAIN_HEADING = new RegExp(String.raw`^\\?\u200B?\[${TRANSCRIPT_SPEAKER}\]\s*:?$`, "u");
const MACHINE_HEADING = new RegExp(String.raw`^\\?\u200B?\[${TRANSCRIPT_SPEAKER}\]\s*(\([^)]*\))?\s*:?$`, "u");
const ENGLISH_DATE = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/;
const DOT_DATE = /^(\d{2})\.(\d{2})\.(\d{4})(?:, (\d{2}):(\d{2}))?$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

function validDay(year, month, day) {
    if (month < 1 || month > 12 || day < 1)
        return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
}

/** Parse a dated transcript header, retaining its speaker and displayed timestamp. */
export function parseTranscriptHeader(line) {
    const m = String(line).trimEnd().match(PREFIX);
    if (!m)
        return null;
    const [, speaker, stamp] = m;
    if (!SPEAKER.test(speaker))
        return null;
    const dotted = stamp.match(DOT_DATE);
    if (dotted) {
        const [, dd, mm, yyyy, hh, min] = dotted;
        const year = Number(yyyy), month = Number(mm), day = Number(dd);
        if (!validDay(year, month, day) || (hh !== undefined && (Number(hh) > 23 || Number(min) > 59)))
            return null;
        return { speaker, date: `${dd}.${mm}.${yyyy}${hh === undefined ? "" : `, ${hh}:${min}`}`, timestamp: stamp, day: `${yyyy}-${mm}-${dd}`, clock: hh === undefined ? null : `${hh}:${min}`, language: "ru" };
    }
    const d = stamp.match(ENGLISH_DATE);
    const month = d ? MONTHS.indexOf(d[1]) : -1;
    if (month < 0)
        return null;
    const clock = stamp.match(/,\s*(\d{1,2}:\d{2}\s+[AP]M)/)?.[1] || null;
    return { speaker, date: `${d[1]} ${d[2]}, ${d[3]}`, timestamp: stamp, day: `${d[3]}-${pad(month + 1)}-${pad(Number(d[2]))}`, clock, language: "en" };
}

/** Dated headers in a transcript with offsets into the original text. */
export function findTranscriptHeaders(text) {
    const out = [];
    const lines = String(text).split("\n");
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, "");
        let parsed = parseTranscriptHeader(line);
        if (parsed)
            out.push({ ...parsed, index: offset });
        else {
            // Older transcript headers may put the English timestamp on the next
            // nonblank line. Keep the match anchored at the original speaker line.
            const split = line.match(/^(\\?\u200B?\[([A-Za-z][A-Za-z0-9 _-]*)\])\s*$/);
            if (split) {
                for (let j = i + 1; j < lines.length; j++) {
                    const next = lines[j].replace(/\r$/, "");
                    if (!next.trim())
                        continue;
                    const timestamp = next.trim().match(/^\(([^)]+)\):\s*$/);
                    if (timestamp) {
                        const candidate = parseTranscriptHeader(`${split[1]} (${timestamp[1]}):`);
                        if (candidate?.language === "en")
                            parsed = candidate;
                    }
                    break;
                }
                if (parsed)
                    out.push({ ...parsed, index: offset });
            }
        }
        offset += lines[i].length + 1;
    }
    return out;
}

/** Preserve the librarian's historic uppercase English header boundary and add valid Russian headers. */
export function isChunkHeader(line) {
    const t = String(line).trim();
    return LEGACY_CHUNK.test(t) || Boolean(chunkTranscriptHeader(t));
}

export function chunkTranscriptHeader(line) {
    const t = String(line).trim();
    const parsed = parseTranscriptHeader(t);
    if (parsed && (parsed.language === "ru" || CYRILLIC_START.test(parsed.speaker)))
        return parsed;
    const legacy = LEGACY_CHUNK.exec(t);
    return legacy ? { speaker: legacy[1], timestamp: legacy[2] } : null;
}

export function transcriptMillis(header) {
    if (!header)
        return NaN;
    if (header.language === "ru")
        return Date.parse(`${header.day}T${header.clock || "00:00"}`);
    // Invalid dotted dates can delimit a legacy chunk but must not be reinterpreted as US dates.
    return /^\d{2}\.\d{2}\.\d{4}(?:\b|$)/.test(header.timestamp) ? NaN : Date.parse(header.timestamp);
}

/** Speaker-only headings used by machine classification and the dated-moment fallback. */
export function isSpeakerHeading(line) {
    return PLAIN_HEADING.test(String(line).trimEnd());
}

/** Preserve machine.mjs's permissive header test while admitting Cyrillic tags. */
export function isMachineHeader(line) {
    return MACHINE_HEADING.test(String(line).trim());
}
