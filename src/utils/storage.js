import { clear, del, get, keys, set } from 'idb-keyval';
import { BLOB_BUDGET_BYTES, EQ_PRESETS, makeCoverDataUrl } from '../types/neplaylist';
import { matchLyricsForTrack, parseLrcEntries } from './lrcParser';
import { extractThumbBlob, trackUrl } from './metadataParser';
const PREFS_KEY = 'neplaylist.prefs.v1';
const TRACKS_KEY = 'neplaylist.track-meta.v1';
const ORDER_KEY = 'neplaylist.order.v1';
const DIR_HANDLE_KEY = 'neplaylist.dir-handle.v1';
const BLOB_PREFIX = 'neplaylist.blob.';
const ART_PREFIX = 'neplaylist.art.';
const LOCAL_PREFS_LIMIT = 50 * 1024;
export const DEFAULT_PREFS = {
    activeTrackId: null,
    currentTime: 0,
    repeatMode: 'all',
    shuffle: false,
    eqPreset: 'flat',
    eqBands: [...EQ_PRESETS.flat],
    pitchPercent: 0,
    gearProfiles: [],
    outputDeviceId: '',
    motorPowered: true,
    platterLocked: false,
    replayGainEnabled: true,
    preampBoostDb: 0,
    lyricOffsetSec: 0,
};
const EQ_PRESET_NAMES = ['flat', 'warm', 'vocal', 'sub'];
function readPrefsFromLocal() {
    try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_PREFS, ...parsed };
    }
    catch {
        return null;
    }
}
function writePrefsToLocal(prefs) {
    try {
        const serialized = JSON.stringify(prefs);
        if (serialized.length <= LOCAL_PREFS_LIMIT) {
            window.localStorage.setItem(PREFS_KEY, serialized);
            return;
        }
        window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, gearProfiles: [], eqBands: [...EQ_PRESETS.flat] }));
    }
    catch {
        /* Safari Private Browsing can reject writes outright — preferences stay in memory */
    }
}
export function savePrefs(prefs) {
    writePrefsToLocal(prefs);
}
export function loadPrefs() {
    const fromLocal = readPrefsFromLocal();
    if (!fromLocal)
        return { ...DEFAULT_PREFS };
    const eqPreset = EQ_PRESET_NAMES.includes(fromLocal.eqPreset) ? fromLocal.eqPreset : 'flat';
    const eqBands = Array.isArray(fromLocal.eqBands) && fromLocal.eqBands.length === 10
        ? fromLocal.eqBands.map((value) => (Number.isFinite(value) ? value : 0))
        : [...EQ_PRESETS[eqPreset]];
    return {
        ...DEFAULT_PREFS,
        ...fromLocal,
        eqPreset,
        eqBands,
        gearProfiles: Array.isArray(fromLocal.gearProfiles) ? fromLocal.gearProfiles : [],
        currentTime: Number.isFinite(fromLocal.currentTime) ? fromLocal.currentTime : 0,
        pitchPercent: Number.isFinite(fromLocal.pitchPercent) ? fromLocal.pitchPercent : 0,
        lyricOffsetSec: Number.isFinite(fromLocal.lyricOffsetSec) ? fromLocal.lyricOffsetSec : 0,
        preampBoostDb: fromLocal.preampBoostDb === 6 ? 6 : 0,
    };
}
export async function saveGearProfiles(profiles) {
    const prefs = loadPrefs();
    savePrefs({ ...prefs, gearProfiles: profiles });
}
function toPersisted(track, fileName, mimeType) {
    return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: track.year,
        trackNumber: track.trackNumber,
        duration: track.duration,
        bpm: track.bpm,
        codecLabel: track.codecLabel,
        replayGainDb: track.replayGainDb,
        /* Blob URLs die with the document that minted them — persist only
           self-contained data URLs; the raw art bytes are snapshotted separately. */
        thumbUrl: track.thumbUrl && !track.thumbUrl.startsWith('blob:') ? track.thumbUrl : null,
        lyrics: track.lyrics,
        sourceType: track.sourceType,
        fileName,
        mimeType,
    };
}
async function storeBlobsWithinBudget(tracks) {
    const stored = new Set();
    const existingKeys = new Set((await keys()).filter((key) => typeof key === 'string'));
    let used = 0;
    const sorted = [...tracks]
        .filter((track) => track.file)
        .sort((a, b) => (a.file?.size ?? 0) - (b.file?.size ?? 0));
    for (const track of sorted) {
        const file = track.file;
        if (!file)
            continue;
        /* Already cached from a previous save — never rewrite the same bytes. */
        if (existingKeys.has(`${BLOB_PREFIX}${track.id}`)) {
            stored.add(track.id);
            used += file.size;
            continue;
        }
        if (used + file.size > BLOB_BUDGET_BYTES)
            continue;
        try {
            await set(`${BLOB_PREFIX}${track.id}`, { blob: file, name: file.name, type: file.type });
            stored.add(track.id);
            used += file.size;
        }
        catch {
            /* QuotaExceededError — this track will restore as needsRelink */
        }
    }
    return stored;
}
async function storeArtForTrack(track) {
    const url = track.thumbUrl;
    if (!url)
        return;
    /* Only blob-backed art needs a byte snapshot; data URLs are already durable. */
    if (!url.startsWith('blob:'))
        return;
    const key = `${ART_PREFIX}${track.id}`;
    try {
        if (await get(key))
            return;
        const response = await fetch(url);
        const blob = await response.blob();
        if (blob.size > 0)
            await set(key, { blob, type: blob.type });
    }
    catch {
        /* art is cosmetic — never fail the library save over it */
    }
}
async function loadArtForTrack(trackId) {
    try {
        const cached = await get(`${ART_PREFIX}${trackId}`);
        if (!cached?.blob || cached.blob.size === 0)
            return null;
        return trackUrl(URL.createObjectURL(cached.blob));
    }
    catch {
        return null;
    }
}
/* Libraries saved before art snapshots only stored a dead blob: URL. Re-derive
   the cover from the cached audio bytes and cache it for the next boot. */
async function repairArtForTrack(trackId, file) {
    if (!file)
        return null;
    try {
        const blob = await extractThumbBlob(file);
        if (!blob || blob.size === 0)
            return null;
        await set(`${ART_PREFIX}${trackId}`, { blob, type: blob.type });
        return trackUrl(URL.createObjectURL(blob));
    }
    catch {
        return null;
    }
}
export async function saveLibrary(tracks, lrcEntries) {
    try {
        const persisted = tracks.map((track) => toPersisted(track, track.file?.name ?? track.fileHandle?.name ?? '', track.file?.type ?? ''));
        await set(TRACKS_KEY, persisted);
        await set(ORDER_KEY, tracks.map((track) => track.id));
        /* Only touch the lyric store when the caller actually has entries, so a
           metadata-only save never clobbers sidecar .lrc files. */
        if (lrcEntries)
            await set('neplaylist.lrc.v1', lrcEntries);
        const existingKeys = await keys();
        await storeBlobsWithinBudget(tracks);
        await Promise.all(tracks.map((track) => storeArtForTrack(track)));
        /* Only evict blobs whose track has actually left the library. A track that
           is still present but could not be re-cached this pass (budget pressure,
           or a handle-backed track) keeps whatever bytes are already on disk. */
        const liveIds = new Set(tracks.map((track) => track.id));
        for (const key of existingKeys) {
            if (typeof key !== 'string')
                continue;
            if (key.startsWith(BLOB_PREFIX)) {
                const id = key.slice(BLOB_PREFIX.length);
                if (liveIds.has(id))
                    continue;
            }
            else if (key.startsWith(ART_PREFIX)) {
                const id = key.slice(ART_PREFIX.length);
                if (liveIds.has(id))
                    continue;
            }
            else {
                continue;
            }
            try {
                await del(key);
            }
            catch {
                /* ignore */
            }
        }
    }
    catch {
        /* keep the session usable when IndexedDB is blocked */
    }
}
export async function loadCachedBlob(trackId) {
    try {
        const cached = await get(`${BLOB_PREFIX}${trackId}`);
        return cached?.blob ?? null;
    }
    catch {
        return null;
    }
}
export async function estimateCacheUsage() {
    try {
        const allKeys = await keys();
        let bytes = 0;
        let trackCount = 0;
        for (const key of allKeys) {
            if (typeof key !== 'string')
                continue;
            if (key.startsWith(BLOB_PREFIX)) {
                const cached = await get(key);
                if (cached?.blob) {
                    bytes += cached.blob.size;
                    trackCount += 1;
                }
            }
            else if (key.startsWith(ART_PREFIX)) {
                const cached = await get(key);
                if (cached?.blob)
                    bytes += cached.blob.size;
            }
        }
        return { bytes, trackCount };
    }
    catch {
        return { bytes: 0, trackCount: 0 };
    }
}
/* Ask the browser to keep our IndexedDB instead of treating it as evictable.
   Without this a 1 GB cache can be cleared wholesale under disk pressure. */
export async function requestPersistentStorage() {
    try {
        const manager = navigator.storage;
        if (!manager?.persist)
            return false;
        if (await manager.persisted?.())
            return true;
        return await manager.persist();
    }
    catch {
        return false;
    }
}
export async function saveDirectoryHandle(handle) {
    try {
        if (handle)
            await set(DIR_HANDLE_KEY, handle);
        else
            await del(DIR_HANDLE_KEY);
    }
    catch {
        /* structured-clone of handles fails in unsupported browsers */
    }
}
export async function loadDirectoryHandle() {
    try {
        const handle = await get(DIR_HANDLE_KEY);
        return handle ?? null;
    }
    catch {
        return null;
    }
}
export async function clearLibraryPersistence() {
    try {
        const allKeys = await keys();
        for (const key of allKeys) {
            if (typeof key === 'string' && (key.startsWith(BLOB_PREFIX) || key.startsWith('neplaylist.'))) {
                await del(key);
            }
        }
        await clear();
    }
    catch {
        /* ignore */
    }
}
function regroupAlbumKey(track) {
    const album = track.album.trim() || 'Single Pressings';
    return album.toLowerCase();
}
function albumDisplayArtist(tracks) {
    const artists = new Set(tracks.map((track) => track.artist.trim() || 'Unknown Artist'));
    return artists.size > 1 ? 'Various Artists' : [...artists][0];
}
export function groupTracksIntoAlbums(tracks) {
    const grouped = {};
    for (const track of tracks) {
        const key = regroupAlbumKey(track);
        if (!grouped[key])
            grouped[key] = [];
        grouped[key].push(track);
    }
    for (const key of Object.keys(grouped)) {
        const list = grouped[key];
        list.sort((a, b) => {
            if (a.trackNumber && b.trackNumber && a.trackNumber !== b.trackNumber) {
                return a.trackNumber - b.trackNumber;
            }
            if (a.trackNumber && !b.trackNumber)
                return -1;
            if (!a.trackNumber && b.trackNumber)
                return 1;
            return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        });
    }
    return grouped;
}
export function albumArtistOf(tracks) {
    return albumDisplayArtist(tracks);
}
export async function hydrateLibrarySafe(onStatus) {
    try {
        onStatus?.('READING INDEXEDDB...');
        const persisted = await get(TRACKS_KEY);
        const handle = await loadDirectoryHandle();
        if (!persisted || persisted.length === 0) {
            return { albums: {}, orderedIds: [], handle, lrcEntries: [] };
        }
        const lrcRaw = await get('neplaylist.lrc.v1');
        const lrcSets = parseLrcEntries(Array.isArray(lrcRaw) ? lrcRaw : []);
        const restored = [];
        for (const record of persisted) {
            if (!record || !record.id)
                continue;
            const blob = await loadCachedBlob(record.id);
            let file;
            if (blob) {
                file = new File([blob], record.fileName || `${record.title}.audio`, {
                    type: record.mimeType || blob.type,
                });
            }
            const sidecarLyrics = matchLyricsForTrack(record.title, lrcSets);
            const lyrics = record.lyrics && record.lyrics.length > 0
                ? record.lyrics
                : sidecarLyrics && sidecarLyrics.length > 0
                    ? sidecarLyrics
                    : [];
            const storedArt = record.thumbUrl && !record.thumbUrl.startsWith('blob:') ? record.thumbUrl : null;
            const thumbUrl = storedArt ??
                (await loadArtForTrack(record.id)) ??
                (await repairArtForTrack(record.id, file)) ??
                makeCoverDataUrl(record.id, record.title, record.album);
            const needsRelink = !file;
            restored.push({
                id: record.id,
                title: record.title,
                artist: record.artist,
                album: record.album,
                year: record.year,
                trackNumber: record.trackNumber,
                duration: record.duration,
                bpm: record.bpm,
                codecLabel: record.codecLabel,
                replayGainDb: record.replayGainDb,
                thumbUrl,
                fullArtUrl: null,
                lyrics,
                sourceType: record.sourceType,
                needsRelink,
                file,
            });
        }
        if (restored.length === 0) {
            return {
                albums: {},
                orderedIds: [],
                handle,
                lrcEntries: Array.isArray(lrcRaw) ? lrcRaw : [],
            };
        }
        const allTracks = restored;
        const storedOrder = await get(ORDER_KEY);
        const seen = new Set();
        const orderedIds = [];
        if (Array.isArray(storedOrder)) {
            for (const id of storedOrder) {
                if (allTracks.some((track) => track.id === id) && !seen.has(id)) {
                    orderedIds.push(id);
                    seen.add(id);
                }
            }
        }
        for (const track of allTracks) {
            if (!seen.has(track.id))
                orderedIds.push(track.id);
        }
        return {
            albums: groupTracksIntoAlbums(allTracks),
            orderedIds,
            handle,
            lrcEntries: Array.isArray(lrcRaw) ? lrcRaw : [],
        };
    }
    catch {
        return {
            albums: {},
            orderedIds: [],
            handle: null,
            lrcEntries: [],
        };
    }
}
