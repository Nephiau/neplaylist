import { parseBlob } from 'music-metadata';
import { clamp, makeCoverDataUrl } from '../types/neplaylist';
import { normalizeTitle, parseLrc, toPlainLyrics } from './lrcParser';
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.aiff', '.aif'];
export const LRC_EXTENSION = '.lrc';
const MAX_CONCURRENCY = 3;
const THUMB_SIZE = 600;
const objectUrlRegistry = new Set();
export function trackUrl(url) {
    if (url && url.startsWith('blob:'))
        objectUrlRegistry.add(url);
    return url;
}
export function revokeTrackArt(track) {
    for (const url of [track.thumbUrl, track.fullArtUrl]) {
        if (url && url.startsWith('blob:') && objectUrlRegistry.has(url)) {
            URL.revokeObjectURL(url);
            objectUrlRegistry.delete(url);
        }
    }
}
export function revokeAllArt() {
    for (const url of objectUrlRegistry)
        URL.revokeObjectURL(url);
    objectUrlRegistry.clear();
}
export function isAudioFile(file) {
    const name = file.name.toLowerCase();
    if (AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext)))
        return true;
    return file.type.startsWith('audio/');
}
export function isLrcFile(file) {
    return file.name.toLowerCase().endsWith(LRC_EXTENSION);
}
function splitFileName(fileName) {
    const stem = fileName.replace(/\.[a-z0-9]{2,5}$/i, '');
    const cleaned = stem.replace(/^\s*\d{1,3}\s*[-._)\]]\s*/, '').trim();
    const parts = cleaned.split(/\s+-\s+/);
    if (parts.length >= 2) {
        return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: '', title: cleaned || stem };
}
export function buildCodecLabel(meta, file) {
    const format = meta.format;
    const codecRaw = (format.codec || '').toLowerCase();
    const ext = file.name.toLowerCase().split('.').pop() || '';
    let codec = 'AUDIO';
    if (codecRaw.includes('flac') || ext === 'flac')
        codec = 'FLAC';
    else if (codecRaw.includes('mp4') || codecRaw.includes('aac') || ext === 'm4a')
        codec = 'AAC';
    else if (codecRaw.includes('mpeg') || ext === 'mp3')
        codec = 'MP3';
    else if (codecRaw.includes('vorbis') || ext === 'ogg')
        codec = 'OGG';
    else if (codecRaw.includes('opus') || ext === 'opus')
        codec = 'OPUS';
    else if (codecRaw.includes('pcm') || ext === 'wav')
        codec = 'WAV';
    else if (ext)
        codec = ext.toUpperCase();
    const parts = [codec];
    if (format.bitsPerSample)
        parts.push(`${format.bitsPerSample}-BIT`);
    if (format.sampleRate) {
        const khz = format.sampleRate / 1000;
        parts.push(`${Number.isInteger(khz) ? khz : khz.toFixed(1)}kHz`);
    }
    if (format.numberOfChannels === 1)
        parts.push('MONO');
    else if (format.numberOfChannels === 2)
        parts.push('STEREO');
    if (codec === 'MP3' && format.bitrate && !format.bitsPerSample) {
        parts.push(`${Math.round(format.bitrate / 1000)} kbps`);
    }
    return parts.join(' • ');
}
export function parseReplayGainDb(raw) {
    if (raw === null || raw === undefined)
        return null;
    let text;
    if (typeof raw === 'number')
        text = String(raw);
    else if (Array.isArray(raw))
        text = String(raw[0] ?? '');
    else
        text = String(raw);
    const match = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (!match)
        return null;
    const value = Number.parseFloat(match[0]);
    if (!Number.isFinite(value))
        return null;
    return clamp(value, -18, 12);
}
function reuseIfBounded(src) {
    if (!src || !src.data || !src.format)
        return null;
    try {
        const buffer = new Uint8Array(src.data);
        const blob = new Blob([buffer], { type: src.format });
        return trackUrl(URL.createObjectURL(blob));
    }
    catch {
        return null;
    }
}
/* Re-derive durable cover bytes from a cached audio file. Used to repair
   libraries persisted before artwork was snapshotted to IndexedDB. */
export async function extractThumbBlob(file) {
    let meta = null;
    try {
        meta = await parseBlob(file, { skipPostHeaders: true });
    }
    catch {
        return null;
    }
    const picture = meta?.common?.picture?.[0];
    if (!picture?.data || !picture.format)
        return null;
    const fullUrl = reuseIfBounded(picture);
    if (!fullUrl)
        return null;
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = fullUrl;
        if (typeof img.decode === 'function')
            await img.decode().catch(() => undefined);
        if (!img.complete || img.naturalWidth === 0)
            return null;
        const scale = Math.min(1, THUMB_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        return await new Promise((resolve) => {
            try {
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.86);
            }
            catch {
                resolve(null);
            }
        });
    }
    catch {
        return null;
    }
    finally {
        URL.revokeObjectURL(fullUrl);
    }
}
async function downscaleToThumb(blobUrl) {
    try {
        const img = new Image();
        if (!blobUrl.startsWith('data:'))
            img.crossOrigin = 'anonymous';
        img.src = blobUrl;
        if (typeof img.decode === 'function') {
            await img.decode().catch(() => undefined);
        }
        if (!img.complete || img.naturalWidth === 0)
            return null;
        const scale = Math.min(1, THUMB_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const thumbBlob = await new Promise((resolve) => {
            try {
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.86);
            }
            catch {
                resolve(null);
            }
        });
        if (!thumbBlob)
            return null;
        return trackUrl(URL.createObjectURL(thumbBlob));
    }
    catch {
        return null;
    }
}
function extractLyrics(meta) {
    const common = meta.common;
    const embedded = common.lyrics;
    if (Array.isArray(embedded) && embedded.length > 0) {
        for (const entry of embedded) {
            const text = typeof entry === 'string'
                ? entry
                : entry && typeof entry === 'object' && 'text' in entry
                    ? String(entry.text ?? '')
                    : '';
            if (text.trim()) {
                const parsed = parseLrc(text);
                return parsed.length ? parsed : toPlainLyrics(text);
            }
        }
    }
    const comments = common.comment;
    if (comments && comments.length) {
        for (const entry of comments) {
            const text = Array.isArray(entry) ? entry.join(' ') : String(entry);
            if (/\[\d{1,3}:\d{1,2}/.test(text)) {
                const parsed = parseLrc(text);
                if (parsed.length)
                    return parsed;
            }
        }
    }
    return [];
}
export function contentSignature(input) {
    const normTitle = normalizeTitle(input.title).replace(/\s+/g, '_') || 'untitled';
    const normAlbum = normalizeTitle(input.album).replace(/\s+/g, '_') || 'single';
    return `${normTitle}_${normAlbum}_${Math.round(input.duration || 0)}_${input.fileSize}`;
}
export async function parseAudioFile(file) {
    let meta = null;
    try {
        meta = await parseBlob(file, { skipPostHeaders: true });
    }
    catch {
        meta = null;
    }
    const common = meta?.common;
    const fallback = splitFileName(file.name);
    const title = (common?.title || fallback.title || file.name).trim();
    const artist = (common?.artist || common?.artists?.join(', ') || fallback.artist || 'Unknown Artist').trim();
    const album = (common?.album || 'Single Pressings').trim();
    const year = common?.year ? String(common.year) : '—';
    const trackNumber = typeof common?.track?.no === 'number' && Number.isFinite(common.track.no) ? common.track.no : 0;
    const rawDuration = meta?.format.duration;
    const duration = Number.isFinite(rawDuration) && (rawDuration ?? 0) > 0 ? Number(rawDuration) : 0;
    const embeddedBpm = common?.bpm;
    const bpm = Number.isFinite(embeddedBpm) && (embeddedBpm ?? 0) > 0 ? Number(embeddedBpm) : 0;
    const replayGainRaw = common?.replaygain_track_gain ?? null;
    let fullArtUrl = null;
    let thumbUrl = null;
    const picture = common?.picture?.[0];
    if (picture) {
        fullArtUrl = reuseIfBounded(picture);
        if (fullArtUrl) {
            thumbUrl = await downscaleToThumb(fullArtUrl);
        }
    }
    if (!thumbUrl) {
        thumbUrl = makeCoverDataUrl(`${title}-${album}-${artist}`, title, album === 'Single Pressings' ? artist : album);
    }
    const id = contentSignature({ title, album, duration, fileSize: file.size });
    return {
        id,
        title,
        artist,
        album,
        year,
        trackNumber,
        duration,
        bpm,
        codecLabel: meta ? buildCodecLabel(meta, file) : `AUDIO • ${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        replayGainDb: parseReplayGainDb(replayGainRaw),
        thumbUrl,
        fullArtUrl,
        lyrics: meta ? extractLyrics(meta) : [],
        sourceType: 'blob',
        file,
    };
}
export async function readLrcFile(file) {
    const text = await file.text();
    return { fileName: file.name, text };
}
export async function ingestFiles(files, onProgress) {
    const audioFiles = files.filter(isAudioFile);
    const lrcFiles = files.filter(isLrcFile);
    const lrcEntries = [];
    for (const file of lrcFiles) {
        try {
            lrcEntries.push(await readLrcFile(file));
        }
        catch {
            /* unreadable sidecar lyric files are skipped */
        }
    }
    const tracks = new Array(audioFiles.length);
    const skipped = [];
    let processed = 0;
    let cursor = 0;
    onProgress?.({ total: audioFiles.length, processed: 0, current: audioFiles[0]?.name ?? '' });
    const worker = async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= audioFiles.length)
                return;
            const file = audioFiles[index];
            try {
                tracks[index] = await parseAudioFile(file);
            }
            catch {
                skipped.push(file.name);
            }
            processed += 1;
            onProgress?.({
                total: audioFiles.length,
                processed,
                current: audioFiles[Math.min(cursor, audioFiles.length - 1)]?.name ?? '',
            });
        }
    };
    const workerCount = Math.min(MAX_CONCURRENCY, Math.max(1, audioFiles.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return {
        tracks: tracks.filter((track) => Boolean(track)),
        lrcEntries,
        skipped,
    };
}
export async function readFilesFromHandles(handles, onProgress) {
    const files = [];
    for (const handle of handles) {
        try {
            files.push(await handle.getFile());
        }
        catch {
            /* handle may have been revoked between scans */
        }
    }
    const result = await ingestFiles(files, onProgress);
    const bySize = new Map();
    for (const handle of handles) {
        try {
            const file = await handle.getFile();
            bySize.set(file.size, handle);
        }
        catch {
            /* ignore */
        }
    }
    const linked = result.tracks.map((track) => {
        if (!track.file)
            return track;
        const handle = bySize.get(track.file.size);
        if (!handle)
            return track;
        return { ...track, fileHandle: handle, sourceType: 'fs-handle' };
    });
    return { ...result, tracks: linked };
}
