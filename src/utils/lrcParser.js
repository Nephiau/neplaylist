const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;
export function parseLrc(text) {
    if (!text || !text.trim())
        return [];
    let offsetMs = 0;
    const offsetMatch = OFFSET_TAG.exec(text);
    if (offsetMatch) {
        const parsed = Number.parseInt(offsetMatch[1], 10);
        if (Number.isFinite(parsed))
            offsetMs = parsed;
    }
    const lines = [];
    const rawLines = text.split(/\r?\n/);
    for (const raw of rawLines) {
        const trimmed = raw.trim();
        if (!trimmed)
            continue;
        TIMESTAMP.lastIndex = 0;
        const stamps = [];
        let match = TIMESTAMP.exec(trimmed);
        if (!match)
            continue;
        while (match) {
            const minutes = Number.parseInt(match[1], 10);
            const seconds = Number.parseInt(match[2], 10);
            const fractionRaw = match[3] ?? '0';
            const fraction = Number.parseInt(fractionRaw.padEnd(3, '0').slice(0, 3), 10) / 1000;
            const time = minutes * 60 + seconds + fraction;
            if (Number.isFinite(time))
                stamps.push(Math.max(0, time + offsetMs / 1000));
            match = TIMESTAMP.exec(trimmed);
        }
        const lyricText = trimmed.replace(TIMESTAMP, '').trim();
        for (const time of stamps) {
            lines.push({ timeSec: time, text: lyricText });
        }
    }
    lines.sort((a, b) => (a.timeSec ?? 0) - (b.timeSec ?? 0));
    return lines;
}
export function toPlainLyrics(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ timeSec: null, text: line }));
}
export function normalizeTitle(value) {
    return value
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/^\s*\d{1,3}\s*[-._)\]]\s*/, '')
        .replace(/\((?:feat|ft|with)[^)]*\)/gi, '')
        .replace(/\[[^\]]*\]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function stemOf(fileName) {
    return fileName.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
}
export function parseLrcEntries(entries) {
    return entries.map((entry) => ({
        stem: stemOf(entry.fileName).toLowerCase(),
        normalized: normalizeTitle(entry.fileName),
        lines: parseLrc(entry.text),
    }));
}
export function matchLyricsForTrack(title, entries) {
    if (!entries.length)
        return null;
    const targetStem = title.trim().toLowerCase();
    const targetNorm = normalizeTitle(title);
    const exact = entries.find((entry) => entry.stem === targetStem && entry.lines.length > 0);
    if (exact)
        return exact.lines;
    const normalized = entries.find((entry) => entry.normalized === targetNorm && entry.lines.length > 0);
    if (normalized)
        return normalized.lines;
    if (targetNorm.length >= 4) {
        const fuzzy = entries.find((entry) => entry.lines.length > 0 &&
            (entry.normalized.includes(targetNorm) || targetNorm.includes(entry.normalized)));
        if (fuzzy)
            return fuzzy.lines;
    }
    return null;
}
