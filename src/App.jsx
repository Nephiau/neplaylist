import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { createPortal } from 'react-dom';
import { DEFAULT_ACCENTS, EQ_PRESETS, clamp, effectiveBpm, formatTime, } from './types/neplaylist';
import { audioEngine } from './utils/audioEngine';
import { applyAccentsToDocument, extractAccents } from './utils/colorExtractor';
import { matchLyricsForTrack, parseLrcEntries } from './utils/lrcParser';
import { albumArtistOf, clearLibraryPersistence, groupTracksIntoAlbums, hydrateLibrarySafe, loadPrefs, requestPersistentStorage, saveGearProfiles, saveLibrary, savePrefs, saveDirectoryHandle, } from './utils/storage';
import { ingestFiles, isAudioFile, isLrcFile, parseAudioFile, readFilesFromHandles, revokeAllArt, revokeTrackArt, } from './utils/metadataParser';
import { useOutputDevice } from './hooks/useOutputDevice';
import { BootPreloader } from './components/BootPreloader';
import { DotGrid } from './components/DotGrid';
import { WaveLine } from './components/WaveLine';
import { Header } from './components/Header';
import { TrackListPanel } from './components/TrackListPanel';
import { VinylTurntable } from './components/VinylTurntable';
import { AlbumShowcasePanel } from './components/AlbumShowcasePanel';
import { BottomTransportDock } from './components/BottomTransportDock';
import { AudioRackDrawer } from './components/AudioRackDrawer';
import { ArtworkLyricsModal } from './components/ArtworkLyricsModal';
import { FloatingMiniDeck } from './components/FloatingMiniDeck';
import { SearchModal } from './components/SearchModal';
const MIN_BOOT_MS = 450;
const MAX_BOOT_MS = 1500;
/* Beat detection decodes an ~8 MB slice and runs an FFT, so keep the batch
   gentle: two files at a time, entirely off the playback path. */
const BPM_ANALYSIS_CONCURRENCY = 2;
function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function isFormTarget(target) {
    const el = target;
    if (!el)
        return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select')
        return true;
    return el.isContentEditable === true || el.getAttribute?.('contenteditable') === 'true';
}
export default function App() {
    const [isBooting, setIsBooting] = useState(true);
    const [bootStatus, setBootStatus] = useState('CALIBRATING ANALOG DECK...');
    const [albums, setAlbums] = useState({});
    const [activeAlbumKey, setActiveAlbumKey] = useState('');
    const [activeTrackId, setActiveTrackId] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [motorPowered, setMotorPowered] = useState(true);
    const [platterLocked, setPlatterLocked] = useState(false);
    const [pitchPercent, setPitchPercent] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState('all');
    const [replayGainEnabled, setReplayGainEnabled] = useState(true);
    const [preampBoostDb, setPreampBoostDb] = useState(0);
    const [lyricOffsetSec, setLyricOffsetSec] = useState(0);
    const [eqPreset, setEqPreset] = useState('flat');
    const [eqBands, setEqBands] = useState([...EQ_PRESETS.flat]);
    const [accents, setAccents] = useState(DEFAULT_ACCENTS);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [clipActive, setClipActive] = useState(false);
    const [favorites, setFavorites] = useState({});
    const [outputDeviceId, setOutputDeviceId] = useState('');
    const [gearProfiles, setGearProfiles] = useState([]);
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [folderHandle, setFolderHandle] = useState(null);
    const [undoToast, setUndoToast] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [rackOpen, setRackOpen] = useState(false);
    const [artworkOpen, setArtworkOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [miniDeckOpen, setMiniDeckOpen] = useState(false);
    const [ingestStatus, setIngestStatus] = useState(null);
    const [engineReady, setEngineReady] = useState(false);
    const generationRef = useRef(0);
    const hydratedRef = useRef(false);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const relinkInputRef = useRef(null);
    const relinkTargetRef = useRef(null);
    const lrcRef = useRef([]);
    const lrcRawRef = useRef([]);
    const albumsRef = useRef({});
    const activeAudioUrlRef = useRef(null);
    const resumeTimeRef = useRef(0);
    const resumeConsumedRef = useRef(false);
    const prefsRef = useRef(null);
    const trackTimeRef = useRef(0);
    const previousTrackRef = useRef(null);
    const endHandledRef = useRef(false);
    const bpmQueueRef = useRef([]);
    const bpmAttemptedRef = useRef(new Set());
    const bpmInFlightRef = useRef(0);
    const allTracks = useMemo(() => {
        const seen = new Set();
        const list = [];
        for (const albumTracks of Object.values(albums)) {
            for (const track of albumTracks) {
                if (seen.has(track.id))
                    continue;
                seen.add(track.id);
                list.push(track);
            }
        }
        return list;
    }, [albums]);
    const activeAlbumTracks = useMemo(() => albums[activeAlbumKey] ?? [], [albums, activeAlbumKey]);
    albumsRef.current = albums;
    const activeTrack = useMemo(() => allTracks.find((track) => track.id === activeTrackId) ?? null, [allTracks, activeTrackId]);
    const tracksForPanel = activeAlbumTracks;
    const albumGroups = useMemo(() => {
        return Object.entries(albums).map(([key, tracks]) => ({
            key,
            title: tracks[0]?.album ?? 'Single Pressings',
            artist: albumArtistOf(tracks),
            year: tracks[0]?.year ?? '—',
            tracks,
        }));
    }, [albums]);
    const nextTrackId = useMemo(() => {
        if (!shuffle)
            return null;
        if (allTracks.length < 2)
            return null;
        const index = allTracks.findIndex((track) => track.id === activeTrackId);
        if (index === -1)
            return allTracks[0]?.id ?? null;
        return allTracks[(index + 1) % allTracks.length]?.id ?? null;
    }, [shuffle, allTracks, activeTrackId]);
    const omegaDegPerSec = useMemo(() => audioEngine.platterOmega(effectiveBpm(activeTrack?.bpm ?? 0), pitchPercent), [activeTrack, pitchPercent]);
    const progress = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;
    /* ---------- Output device ---------- */
    const output = useOutputDevice({
        audioElement: engineReady ? audioEngine.getAudioElement() : null,
        audioContext: engineReady ? audioEngine.getContext() : null,
        engineReady,
        savedDeviceId: outputDeviceId,
        onDeviceIdChange: (deviceId) => setOutputDeviceId(deviceId),
        gearProfiles,
        onGearProfilesChange: (profiles) => {
            setGearProfiles(profiles);
            void saveGearProfiles(profiles);
        },
    });
    /* ---------- Persistence ---------- */
    const persistPrefs = useCallback(() => {
        const prefs = {
            activeTrackId,
            currentTime: trackTimeRef.current,
            repeatMode,
            shuffle,
            eqPreset,
            eqBands,
            pitchPercent,
            gearProfiles,
            outputDeviceId,
            motorPowered,
            platterLocked,
            replayGainEnabled,
            preampBoostDb,
            lyricOffsetSec,
        };
        prefsRef.current = prefs;
        savePrefs(prefs);
    }, [
        activeTrackId,
        repeatMode,
        shuffle,
        eqPreset,
        eqBands,
        pitchPercent,
        gearProfiles,
        outputDeviceId,
        motorPowered,
        platterLocked,
        replayGainEnabled,
        preampBoostDb,
        lyricOffsetSec,
    ]);
    useEffect(() => {
        if (!hydratedRef.current)
            return;
        persistPrefs();
    }, [persistPrefs]);
    /* Mirror the live library into IndexedDB whenever it structurally changes. */
    const librarySnapshotRef = useRef('');
    useEffect(() => {
        if (!hydratedRef.current)
            return;
        const flat = Object.values(albums).flat();
        const signature = flat.map((track) => `${track.id}:${track.bpm}:${track.duration}`).join('|');
        if (signature === librarySnapshotRef.current)
            return;
        librarySnapshotRef.current = signature;
        void saveLibrary(flat);
    }, [albums]);
    /* ---------- Background BPM analysis queue ---------- */
    /* Untagged tracks are stored with `bpm: 0` and every readout falls back to
       110. Rather than waiting for the user to play each track (and depend on
       an AudioContext resume), analyse the whole library here. `analyzeBpm`
       uses its own OfflineAudioContext, so this needs no gesture and is fully
       decoupled from playback. */
    const pumpBpmQueue = useCallback(() => {
        const pump = () => {
            while (bpmInFlightRef.current < BPM_ANALYSIS_CONCURRENCY && bpmQueueRef.current.length > 0) {
                const id = bpmQueueRef.current.shift();
                const track = Object.values(albumsRef.current).flat().find((entry) => entry.id === id);
                if (!track || track.bpm > 0)
                    continue;
                bpmInFlightRef.current += 1;
                void (async () => {
                    try {
                        let file = track.file ?? null;
                        if (!file && track.fileHandle) {
                            try {
                                file = await track.fileHandle.getFile();
                            }
                            catch {
                                file = null;
                            }
                        }
                        if (!file)
                            return;
                        const analyzed = await audioEngine.analyzeBpm(file, track.bpm);
                        if (analyzed === null)
                            return;
                        setAlbums((prev) => {
                            let changed = false;
                            const next = {};
                            for (const [key, list] of Object.entries(prev)) {
                                next[key] = list.map((entry) => {
                                    if (entry.id === id && entry.bpm <= 0) {
                                        changed = true;
                                        return { ...entry, bpm: analyzed };
                                    }
                                    return entry;
                                });
                            }
                            return changed ? next : prev;
                        });
                    }
                    finally {
                        bpmInFlightRef.current -= 1;
                        pump();
                    }
                })();
            }
        };
        pump();
    }, []);
    const queueMissingBpm = useCallback(() => {
        const flat = Object.values(albumsRef.current).flat();
        for (const track of flat) {
            if (track.bpm > 0) {
                bpmAttemptedRef.current.add(track.id);
                continue;
            }
            if (bpmAttemptedRef.current.has(track.id))
                continue;
            /* No bytes yet (e.g. a restored `needsRelink` track) — leave it
               unmarked so it is picked up once a file is re-attached. */
            if (!track.file && !track.fileHandle)
                continue;
            bpmAttemptedRef.current.add(track.id);
            bpmQueueRef.current.push(track.id);
        }
        pumpBpmQueue();
    }, [pumpBpmQueue]);
    useEffect(() => {
        if (isBooting)
            return;
        queueMissingBpm();
    }, [albums, isBooting, queueMissingBpm]);
    /* ---------- Boot ---------- */
    useEffect(() => {
        let cancelled = false;
        const startedAt = performance.now();
        const boot = async () => {
            /* Fire early: a 1 GB cache needs protected storage or the browser may
               evict it wholesale. Failure is non-fatal, so never await it here. */
            void requestPersistentStorage();
            const prefs = loadPrefs();
            prefsRef.current = prefs;
            setShuffle(prefs.shuffle);
            setRepeatMode(prefs.repeatMode);
            setPitchPercent(prefs.pitchPercent);
            setEqPreset(prefs.eqPreset);
            setEqBands(prefs.eqBands);
            setMotorPowered(prefs.motorPowered);
            setPlatterLocked(prefs.platterLocked);
            setReplayGainEnabled(prefs.replayGainEnabled);
            setPreampBoostDb(prefs.preampBoostDb);
            setLyricOffsetSec(prefs.lyricOffsetSec);
            setOutputDeviceId(prefs.outputDeviceId);
            setGearProfiles(prefs.gearProfiles);
            resumeTimeRef.current = prefs.currentTime;
            setBootStatus('READING INDEXEDDB...');
            const work = (async () => {
                const restored = await hydrateLibrarySafe((message) => {
                    if (!cancelled)
                        setBootStatus(message);
                });
                if (cancelled)
                    return;
                if (restored) {
                    setAlbums(restored.albums);
                    setFolderHandle(restored.handle);
                    lrcRawRef.current = restored.lrcEntries;
                    lrcRef.current = parseLrcEntries(restored.lrcEntries);
                    if (restored.handle) {
                        try {
                            const permission = await restored.handle.queryPermission?.({ mode: 'read' });
                            setNeedsReconnect(permission !== 'granted');
                        }
                        catch {
                            setNeedsReconnect(true);
                        }
                    }
                    const firstAlbumKey = Object.keys(restored.albums)[0] ?? '';
                    const preferred = prefs.activeTrackId &&
                        restored.orderedIds.includes(prefs.activeTrackId) &&
                        Object.values(restored.albums).some((tracks) => tracks.some((track) => track.id === prefs.activeTrackId))
                        ? prefs.activeTrackId
                        : (restored.orderedIds[0] ?? '');
                    const albumKey = Object.keys(restored.albums).find((key) => restored.albums[key].some((track) => track.id === preferred)) ?? firstAlbumKey;
                    setActiveAlbumKey(albumKey);
                    setActiveTrackId(preferred);
                }
            })();
            await Promise.race([
                Promise.all([document.fonts.ready.then(() => undefined).catch(() => undefined), work]),
                sleep(MAX_BOOT_MS),
            ]);
            const elapsed = performance.now() - startedAt;
            if (elapsed < MIN_BOOT_MS)
                await sleep(MIN_BOOT_MS - elapsed);
            if (cancelled)
                return;
            hydratedRef.current = true;
            setIsBooting(false);
        };
        void boot();
        return () => {
            cancelled = true;
        };
    }, []);
    /* ---------- Track switching ---------- */
    const loadTrack = useCallback(async (track, options) => {
        if (!track)
            return;
        const gen = ++generationRef.current;
        endHandledRef.current = false;
        /* Mark this track as intentionally loaded so the sync effect below
           never kicks off a second, competing load for the same track. */
        previousTrackRef.current = track.id;
        setActiveTrackId(track.id);
        setDuration(track.duration > 0 ? track.duration : 0);
        setCurrentTime(0);
        trackTimeRef.current = 0;
        try {
            if (track.file || track.fileHandle) {
                let blob = track.file ?? null;
                if (!blob && track.fileHandle) {
                    try {
                        blob = await track.fileHandle.getFile();
                    }
                    catch {
                        blob = null;
                    }
                }
                if (gen !== generationRef.current)
                    return;
                if (!blob) {
                    setToastMessage('That file is no longer readable. Re-link it to keep spinning.');
                    return;
                }
                const url = URL.createObjectURL(blob);
                /* Keep the previous URL alive until the next track loads — revoking
                   it on a timer breaks range re-fetches when seeking a long file. */
                if (activeAudioUrlRef.current)
                    URL.revokeObjectURL(activeAudioUrlRef.current);
                activeAudioUrlRef.current = url;
                await audioEngine.load({ url });
            }
            else {
                setToastMessage('Re-link this track to resume playback.');
                return;
            }
            if (gen !== generationRef.current)
                return;
            /* The AudioContext graph now exists — let the output hook bind to it. */
            setEngineReady(true);
            const seekTo = options?.seekTo ?? 0;
            if (seekTo > 0) {
                audioEngine.seek(seekTo);
                setCurrentTime(seekTo);
            }
            audioEngine.setReplayGain(track.replayGainDb, replayGainEnabled, preampBoostDb);
            audioEngine.setEqBands(eqBands);
            if (options?.autoplay)
                await audioEngine.play();
            if (gen !== generationRef.current)
                return;
            /* Accent extraction — guarded by the generation id. */
            const tokens = await extractAccents(track.thumbUrl, track.id);
            if (gen !== generationRef.current)
                return;
            setAccents(tokens);
        }
        catch {
            if (gen === generationRef.current) {
                setToastMessage('Playback failed for this pressing.');
            }
        }
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replayGainEnabled, preampBoostDb, eqBands]);
    /* Load the active track whenever it was changed without an explicit load
       (boot restore, album switch, delete fallback). Keyed on `isBooting` too,
       because the first render that selects the restored track happens while
       `hydratedRef` is still false. */
    useEffect(() => {
        if (isBooting || !hydratedRef.current || !activeTrack)
            return;
        if (previousTrackRef.current === activeTrack.id)
            return;
        const seekTo = resumeConsumedRef.current ? 0 : resumeTimeRef.current;
        resumeConsumedRef.current = true;
        void loadTrack(activeTrack, { autoplay: false, seekTo });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTrack?.id, isBooting]);
    /* ---------- Engine listeners ---------- */
    useEffect(() => {
        const unsubTime = audioEngine.on('time', (payload) => {
            const data = payload;
            if (!Number.isFinite(data.currentTime))
                return;
            setCurrentTime(data.currentTime);
            trackTimeRef.current = data.currentTime;
            if (data.duration > 0)
                setDuration((prev) => (prev > 0 ? prev : data.duration));
        });
        const unsubMeta = audioEngine.on('loadedmetadata', (payload) => {
            const value = Number(payload);
            if (!Number.isFinite(value) || value <= 0)
                return;
            setDuration(value);
            setAlbums((prev) => {
                const next = {};
                for (const [key, list] of Object.entries(prev)) {
                    next[key] = list.map((entry) => entry.id === activeTrackId && (!entry.duration || entry.duration <= 0)
                        ? { ...entry, duration: value }
                        : entry);
                }
                return next;
            });
        });
        const unsubPlay = audioEngine.on('playstate', (payload) => {
            setIsPlaying(Boolean(payload));
        });
        const unsubClip = audioEngine.on('clip', (payload) => {
            setClipActive(Boolean(payload));
        });
        return () => {
            unsubTime();
            unsubMeta();
            unsubPlay();
            unsubClip();
        };
    }, [activeTrackId]);
    /* ---------- Transport ---------- */
    const handleNext = useCallback((direction, auto = false) => {
        if (allTracks.length === 0)
            return;
        const currentIndex = allTracks.findIndex((track) => track.id === activeTrackId);
        if (shuffle && direction === 1) {
            const pool = allTracks.filter((track) => track.id !== activeTrackId);
            if (pool.length === 0)
                return;
            const picked = pool[Math.floor(Math.random() * pool.length)];
            void loadTrack(picked, { autoplay: true });
            return;
        }
        let nextIndex;
        if (currentIndex === -1)
            nextIndex = 0;
        else
            nextIndex = currentIndex + direction;
        if (nextIndex >= allTracks.length) {
            if (repeatMode === 'all' || auto)
                nextIndex = 0;
            else
                return;
        }
        if (nextIndex < 0)
            nextIndex = allTracks.length - 1;
        const next = allTracks[nextIndex];
        if (next)
            void loadTrack(next, { autoplay: isPlaying || auto });
    }, [allTracks, activeTrackId, shuffle, repeatMode, loadTrack, isPlaying]);
    useEffect(() => {
        const unsub = audioEngine.on('ended', () => {
            if (endHandledRef.current)
                return;
            endHandledRef.current = true;
            if (repeatMode === 'one' && activeTrack) {
                audioEngine.seek(0);
                void audioEngine.play();
                endHandledRef.current = false;
                return;
            }
            handleNext(1, true);
        });
        return unsub;
    }, [repeatMode, activeTrack, handleNext]);
    /* ---------- Transport ---------- */
    const togglePlay = useCallback(async () => {
        if (!activeTrack)
            return;
        if (audioEngine.isPlaying()) {
            audioEngine.pause();
            setIsPlaying(false);
            return;
        }
        audioEngine.setReplayGain(activeTrack.replayGainDb, replayGainEnabled, preampBoostDb);
        await audioEngine.play();
        setIsPlaying(audioEngine.isPlaying());
        persistPrefs();
    }, [activeTrack, replayGainEnabled, preampBoostDb, persistPrefs]);
    const handleBackToBefore = useCallback(() => {
        if (audioEngine.getCurrentTime() > 3) {
            audioEngine.seek(0);
            setCurrentTime(0);
            trackTimeRef.current = 0;
            return;
        }
        handleNext(-1);
    }, [handleNext]);
    const handleSeek = useCallback((seconds) => {
        audioEngine.seek(seconds);
        setCurrentTime(seconds);
        trackTimeRef.current = seconds;
    }, []);
    const handleScrubDelta = useCallback((delta) => {
        const target = clamp(audioEngine.getCurrentTime() + delta, 0, audioEngine.getDuration());
        audioEngine.seek(target);
        setCurrentTime(target);
        trackTimeRef.current = target;
    }, []);
    /* ---------- EQ / pitch / drive ---------- */
    const handleEqPresetChange = useCallback((preset) => {
        setEqPreset(preset);
        const bands = [...EQ_PRESETS[preset]];
        setEqBands(bands);
        audioEngine.setEqBands(bands);
    }, []);
    const handleEqBandChange = useCallback((index, value) => {
        setEqBands((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
        audioEngine.setEqBand(index, value);
    }, []);
    useEffect(() => {
        const rate = 1 + clamp(pitchPercent, -8, 8) / 100;
        audioEngine.setPlaybackRate(rate, hydratedRef.current);
    }, [pitchPercent]);
    const handlePitchChange = useCallback((value) => {
        setPitchPercent(clamp(Number.isFinite(value) ? value : 0, -8, 8));
    }, []);
    /* ---------- Accents ---------- */
    useEffect(() => {
        applyAccentsToDocument(accents);
    }, [accents]);
    useEffect(() => {
        audioEngine.setReplayGain(activeTrack?.replayGainDb ?? null, replayGainEnabled, preampBoostDb);
    }, [activeTrack, replayGainEnabled, preampBoostDb]);
    /* ---------- Album / side / disc navigation ---------- */
    const selectAlbum = useCallback((key) => {
        setActiveAlbumKey(key);
        const tracks = albums[key] ?? [];
        if (tracks.length === 0)
            return;
        if (!tracks.some((track) => track.id === activeTrackId)) {
            const first = tracks[0];
            if (first)
                void loadTrack(first, { autoplay: false });
        }
    }, [albums, activeTrackId, loadTrack]);
    const selectTrack = useCallback((id) => {
        const target = allTracks.find((track) => track.id === id);
        if (!target)
            return;
        if (target.needsRelink) {
            relinkTargetRef.current = id;
            relinkInputRef.current?.click();
            return;
        }
        const albumKey = Object.keys(albums).find((key) => albums[key].some((track) => track.id === id));
        if (albumKey && albumKey !== activeAlbumKey)
            setActiveAlbumKey(albumKey);
        void loadTrack(target, { autoplay: true });
    }, [allTracks, albums, activeAlbumKey, loadTrack]);
    /* ---------- Deletion with undo ---------- */
    const handleDeleteTrack = useCallback((id) => {
        const target = allTracks.find((track) => track.id === id);
        if (!target)
            return;
        const previousActive = activeTrackId;
        const snapshot = albums;
        setAlbums((prev) => {
            const next = {};
            for (const [key, list] of Object.entries(prev)) {
                const filtered = list.filter((track) => track.id !== id);
                if (filtered.length > 0)
                    next[key] = filtered;
            }
            return next;
        });
        const remaining = allTracks.filter((track) => track.id !== id);
        if (remaining.length === 0) {
            setAlbums({});
            setActiveAlbumKey('');
            setActiveTrackId('');
            setDuration(0);
            setCurrentTime(0);
            previousTrackRef.current = null;
            audioEngine.pause();
            setIsPlaying(false);
        }
        else if (id === previousActive) {
            const fallback = remaining[0];
            const key = Object.keys(snapshot).find((k) => snapshot[k].some((track) => track.id === fallback?.id));
            if (key)
                setActiveAlbumKey(key);
            if (fallback) {
                previousTrackRef.current = null;
                void loadTrack(fallback, { autoplay: false });
            }
        }
        revokeTrackArt(target);
        setUndoToast({
            id: Date.now(),
            message: `Removed “${target.title}”`,
            actionLabel: 'Undo',
            onAction: () => {
                setAlbums(snapshot);
                const albumKey = Object.keys(snapshot).find((k) => snapshot[k].some((track) => track.id === target.id));
                if (albumKey) {
                    setActiveAlbumKey(albumKey);
                    setActiveTrackId(target.id);
                    previousTrackRef.current = null;
                    void loadTrack(target, { autoplay: false });
                }
                setUndoToast(null);
            },
        });
    }, [allTracks, activeTrackId, albums, loadTrack]);
    const handleDeleteAlbum = useCallback((albumKey) => {
        const doomed = albums[albumKey];
        if (!doomed || doomed.length === 0)
            return;
        const snapshot = albums;
        const snapshotTrackId = activeTrackId;
        const albumTitle = doomed[0].album || 'Untitled album';
        const removingActiveAlbum = albumKey === activeAlbumKey;
        const next = {};
        for (const [key, list] of Object.entries(albums)) {
            if (key !== albumKey)
                next[key] = list;
        }
        setAlbums(next);
        if (removingActiveAlbum) {
            const fallbackKey = Object.keys(next)[0];
            const fallback = fallbackKey ? next[fallbackKey][0] : undefined;
            if (fallback) {
                setActiveAlbumKey(fallbackKey);
                setActiveTrackId(fallback.id);
                previousTrackRef.current = null;
                void loadTrack(fallback, { autoplay: false });
            }
            else {
                setActiveAlbumKey('');
                setActiveTrackId('');
                setDuration(0);
                setCurrentTime(0);
                previousTrackRef.current = null;
                audioEngine.pause();
                setIsPlaying(false);
            }
        }
        doomed.forEach(revokeTrackArt);
        setUndoToast({
            id: Date.now(),
            message: `Removed “${albumTitle}” (${doomed.length} track${doomed.length === 1 ? '' : 's'})`,
            actionLabel: 'Undo',
            onAction: () => {
                setAlbums(snapshot);
                setUndoToast(null);
                if (!removingActiveAlbum)
                    return;
                const restored = snapshot[albumKey]?.find((entry) => entry.id === snapshotTrackId);
                setActiveAlbumKey(albumKey);
                if (restored) {
                    setActiveTrackId(restored.id);
                    previousTrackRef.current = null;
                    void loadTrack(restored, { autoplay: false });
                }
            },
        });
    }, [albums, activeAlbumKey, activeTrackId, loadTrack]);
    useEffect(() => {
        if (!undoToast)
            return;
        const timer = window.setTimeout(() => setUndoToast(null), 4000);
        return () => window.clearTimeout(timer);
    }, [undoToast]);
    useEffect(() => {
        if (!toastMessage)
            return;
        const timer = window.setTimeout(() => setToastMessage(null), 3600);
        return () => window.clearTimeout(timer);
    }, [toastMessage]);
    const handleReorder = useCallback((orderedAlbumIds) => {
        setAlbums((prev) => {
            const entries = Object.entries(prev);
            const next = {};
            for (const [key, list] of entries) {
                const byId = new Map(list.map((track) => [track.id, track]));
                const reordered = [];
                for (const id of orderedAlbumIds) {
                    const track = byId.get(id);
                    if (track) {
                        reordered.push(track);
                        byId.delete(id);
                    }
                }
                for (const leftover of byId.values())
                    reordered.push(leftover);
                next[key] = reordered;
            }
            return next;
        });
    }, []);
    const cycleRepeat = useCallback(() => {
        setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
    }, []);
    /* ---------- File ingestion ---------- */
    const applyIngest = useCallback((incoming, lrcEntries) => {
        const mergedLrc = [...lrcRef.current];
        for (const parsed of parseLrcEntries(lrcEntries)) {
            const existingIndex = mergedLrc.findIndex((entry) => entry.stem === parsed.stem);
            if (existingIndex >= 0)
                mergedLrc[existingIndex] = parsed;
            else
                mergedLrc.push(parsed);
        }
        lrcRef.current = mergedLrc;
        /* Keep the raw sidecar text so later saves re-persist every lyric file,
           not just the ones from this batch. */
        const rawMerged = [...lrcRawRef.current];
        for (const entry of lrcEntries) {
            const index = rawMerged.findIndex((item) => item.fileName === entry.fileName);
            if (index >= 0)
                rawMerged[index] = entry;
            else
                rawMerged.push(entry);
        }
        lrcRawRef.current = rawMerged;
        const withLyrics = incoming.map((track) => {
            if (track.lyrics.length > 0)
                return track;
            const matched = matchLyricsForTrack(track.title, mergedLrc);
            return matched ? { ...track, lyrics: matched } : track;
        });
        /* Persist against the merged library, never just the incoming batch —
           a partial save would evict the blobs of every earlier upload. */
        const previous = Object.values(albumsRef.current).flat();
        const merged = new Map(previous.map((track) => [track.id, track]));
        for (const track of withLyrics)
            merged.set(track.id, track);
        const mergedAlbums = groupTracksIntoAlbums([...merged.values()]);
        setAlbums(mergedAlbums);
        if (withLyrics.length > 0) {
            const first = withLyrics[0];
            const key = Object.keys(groupTracksIntoAlbums(withLyrics))[0];
            if (!activeTrackId) {
                if (key)
                    setActiveAlbumKey(key);
                setActiveTrackId(first.id);
                previousTrackRef.current = null;
            }
        }
        void saveLibrary(Object.values(mergedAlbums).flat(), lrcRawRef.current);
    }, [activeTrackId]);
    const processFiles = useCallback(async (files, fromHandles) => {
        const audioCount = files.filter(isAudioFile).length;
        const lrcCount = files.filter(isLrcFile).length;
        if (audioCount === 0 && lrcCount === 0) {
            setToastMessage('No supported audio or .lrc files found.');
            return;
        }
        setIngestStatus(`Reading 0 / ${audioCount}`);
        const result = fromHandles
            ? await readFilesFromHandles(fromHandles, (progress) => {
                setIngestStatus(`Reading ${progress.processed} / ${progress.total}`);
            })
            : await ingestFiles(files, (progress) => {
                setIngestStatus(`Reading ${progress.processed} / ${progress.total}`);
            });
        setIngestStatus(null);
        applyIngest(result.tracks, result.lrcEntries);
        if (result.skipped.length > 0) {
            setToastMessage(`${result.skipped.length} file(s) could not be read.`);
        }
    }, [applyIngest]);
    const handleFileInput = useCallback(async (event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (files.length === 0)
            return;
        await processFiles(files, null);
    }, [processFiles]);
    const handleFolderInput = useCallback(async (event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (files.length === 0)
            return;
        await processFiles(files, null);
    }, [processFiles]);
    const openFolderPicker = useCallback(async () => {
        if (window.isSecureContext && typeof window.showDirectoryPicker === 'function') {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'read' });
                setFolderHandle(handle);
                setNeedsReconnect(false);
                await saveDirectoryHandle(handle);
                const handles = [];
                const values = handle.values?.();
                if (values) {
                    for await (const entry of values) {
                        if (entry.kind === 'file')
                            handles.push(entry);
                    }
                }
                if (handles.length > 0) {
                    await processFiles([], handles);
                }
                else {
                    setToastMessage('No files found in that folder.');
                }
                return;
            }
            catch {
                /* user cancelled or the picker is unavailable */
            }
        }
        folderInputRef.current?.click();
    }, [processFiles]);
    const reconnectFolder = useCallback(async () => {
        if (!folderHandle) {
            setNeedsReconnect(false);
            return;
        }
        try {
            const permission = await folderHandle.requestPermission?.({ mode: 'read' });
            if (permission === 'granted') {
                setNeedsReconnect(false);
                const handles = [];
                const values = folderHandle.values?.();
                if (values) {
                    for await (const entry of values) {
                        if (entry.kind === 'file')
                            handles.push(entry);
                    }
                }
                if (handles.length > 0)
                    await processFiles([], handles);
            }
            else {
                setNeedsReconnect(true);
            }
        }
        catch {
            setNeedsReconnect(true);
        }
    }, [folderHandle, processFiles]);
    const handleRelinkFile = useCallback(async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        const targetId = relinkTargetRef.current;
        relinkTargetRef.current = null;
        if (!file || !targetId)
            return;
        try {
            const parsed = await parseAudioFile(file);
            setAlbums((prev) => {
                const next = {};
                for (const [key, list] of Object.entries(prev)) {
                    next[key] = list.map((track) => track.id === targetId
                        ? { ...track, file, needsRelink: false, sourceType: 'blob', duration: track.duration || parsed.duration }
                        : track);
                }
                return next;
            });
            const target = allTracks.find((track) => track.id === targetId);
            if (target)
                void loadTrack({ ...target, file, needsRelink: false }, { autoplay: true });
        }
        catch {
            setToastMessage('Could not read that file. Try another copy.');
        }
    }, [allTracks, loadTrack]);
    const handleClearLibrary = useCallback(async () => {
        revokeAllArt();
        await clearLibraryPersistence();
        lrcRef.current = [];
        lrcRawRef.current = [];
        setAlbums({});
        setActiveAlbumKey('');
        setActiveTrackId('');
        setDuration(0);
        setCurrentTime(0);
        previousTrackRef.current = null;
        setRackOpen(false);
        audioEngine.pause();
        setIsPlaying(false);
        setToastMessage('Library cleared.');
    }, []);
    /* ---------- Keyboard + media session ---------- */
    useEffect(() => {
        const onKeyDown = (event) => {
            if (isFormTarget(event.target) || event.isComposing)
                return;
            const meta = event.metaKey || event.ctrlKey;
            if (meta && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen(true);
                return;
            }
            if (event.key === '/') {
                event.preventDefault();
                setSearchOpen(true);
                return;
            }
            if (event.key === 'Escape') {
                setSearchOpen(false);
                setArtworkOpen(false);
                setRackOpen(false);
                return;
            }
            if (meta)
                return;
            switch (event.key) {
                case ' ':
                    event.preventDefault();
                    void togglePlay();
                    break;
                case 'l':
                case 'L':
                    event.preventDefault();
                    setArtworkOpen((open) => !open);
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    if (event.altKey)
                        handleNext(-1);
                    else
                        handleSeek(audioEngine.getCurrentTime() - (event.shiftKey ? 1 : 5));
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    if (event.altKey)
                        handleNext(1);
                    else
                        handleSeek(audioEngine.getCurrentTime() + (event.shiftKey ? 1 : 5));
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [togglePlay, handleNext, handleSeek]);
    useEffect(() => {
        if (!('mediaSession' in navigator))
            return;
        if (activeTrack) {
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: activeTrack.title,
                    artist: activeTrack.artist,
                    album: activeTrack.album,
                    artwork: activeTrack.thumbUrl
                        ? [{ src: activeTrack.thumbUrl, sizes: '600x600', type: 'image/webp' }]
                        : [],
                });
            }
            catch {
                /* MediaMetadata may be unavailable in some embedded webviews */
            }
        }
        const handlers = [
            ['play', () => void audioEngine.play()],
            ['pause', () => audioEngine.pause()],
            ['previoustrack', () => handleNext(-1)],
            ['nexttrack', () => handleNext(1)],
            [
                'seekto',
                (details) => {
                    if (typeof details.seekTime === 'number')
                        handleSeek(details.seekTime);
                },
            ],
        ];
        for (const [action, handler] of handlers) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            }
            catch {
                /* unsupported action */
            }
        }
        return () => {
            for (const [action] of handlers) {
                try {
                    navigator.mediaSession.setActionHandler(action, null);
                }
                catch {
                    /* ignore */
                }
            }
        };
    }, [activeTrack, handleNext, handleSeek]);
    useEffect(() => {
        const handler = (event) => {
            if (audioEngine.isPlaying()) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);
    /* ---------- Derived view props ---------- */
    const showFolderAction = Boolean(typeof window !== 'undefined' &&
        (typeof window.showDirectoryPicker === 'function' ||
            /Windows|Macintosh|Linux/.test(navigator.userAgent)));
    const activeAlbum = albumGroups.find((album) => album.key === activeAlbumKey);
    return (<MotionConfig reducedMotion="user">
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden lg:h-[100dvh] lg:min-h-[620px]">
        <DotGrid getAnalyser={() => audioEngine.getAnalyserNode()}/>
        <WaveLine getAnalyser={() => audioEngine.getAnalyserNode()} isPlaying={isPlaying} accent={accents.accentOnLightHex}/>
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" aria-hidden="true">
          <path d="M 320 320 C 460 300, 520 380, 620 400" fill="none" stroke="rgba(20, 20, 19, 0.08)" strokeWidth="1"/>
          <path d="M 1180 360 C 1040 340, 980 400, 880 420" fill="none" stroke="rgba(20, 20, 19, 0.08)" strokeWidth="1"/>
        </svg>

        <Header albums={albumGroups} activeAlbumKey={activeAlbumKey} onSelectAlbum={selectAlbum} onUploadFiles={() => fileInputRef.current?.click()} onUploadFolder={openFolderPicker} onReconnectFolder={reconnectFolder} needsReconnect={needsReconnect} onOpenSearch={() => setSearchOpen(true)} onOpenRack={() => setRackOpen(true)} onOpenMiniDeck={() => setMiniDeckOpen(true)} onOpenLyrics={() => setArtworkOpen(true)} showFolderAction={showFolderAction}/>

        {ingestStatus && (<div className="mx-auto mb-1 flex items-center gap-2 rounded-full border border-[rgba(20,20,19,0.08)] bg-white/90 px-3 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full" style={{ background: 'var(--accent-on-light)' }}/>
            <span className="telemetry text-[10px] uppercase tracking-[0.12em] text-[#575653]">
              {ingestStatus}
            </span>
          </div>)}

        <main className="dock-clearance relative z-10 flex flex-1 flex-col gap-4 px-4 pb-4 sm:px-6 md:grid md:grid-cols-12 md:gap-5 md:overflow-hidden lg:gap-6 lg:px-8 lg:pb-24">
          <div className="order-3 min-w-0 md:order-1 md:col-span-5 md:min-h-0 lg:col-span-4">
            <TrackListPanel tracks={tracksForPanel} allTracksInAlbum={activeAlbumTracks} activeTrackId={activeTrackId} isPlaying={isPlaying} albumTitle={activeAlbum?.title ?? 'No Album'} albumArtist={activeAlbum?.artist ?? 'Unknown Artist'} shuffle={shuffle} nextTrackId={nextTrackId} onSelectTrack={selectTrack} onDeleteTrack={handleDeleteTrack} onReorder={handleReorder} onAddFiles={() => fileInputRef.current?.click()} favorite={Boolean(favorites[activeAlbumKey])} onToggleFavorite={() => setFavorites((prev) => ({ ...prev, [activeAlbumKey]: !prev[activeAlbumKey] }))}/>
          </div>

          <div className="order-1 flex flex-col items-center justify-center md:order-2 md:col-span-7 lg:col-span-4">
            <VinylTurntable track={activeTrack} isPlaying={isPlaying} motorPowered={motorPowered} platterLocked={platterLocked} omegaDegPerSec={omegaDegPerSec} progress={progress} currentTime={currentTime} duration={duration} onTogglePlay={() => void togglePlay()} onNeedleDrop={handleSeek} onScrubDelta={handleScrubDelta} onStylusThump={() => audioEngine.playStylusThump()}/>
          </div>

          <div className="order-2 flex min-w-0 flex-col items-center justify-center md:order-3 md:col-span-12 md:min-h-0 lg:order-3 lg:col-span-4">
            <AlbumShowcasePanel albums={albumGroups} activeAlbumKey={activeAlbumKey} onSelectAlbum={selectAlbum} onDeleteAlbum={handleDeleteAlbum} track={activeTrack} clipActive={clipActive} onOpenArtwork={() => setArtworkOpen(true)} onOpenLyrics={() => setArtworkOpen(true)} onAddFiles={() => fileInputRef.current?.click()} favorite={Boolean(favorites[activeAlbumKey])} onToggleFavorite={() => setFavorites((prev) => ({ ...prev, [activeAlbumKey]: !prev[activeAlbumKey] }))}/>
          </div>
        </main>

        <BottomTransportDock isPlaying={isPlaying} currentTime={currentTime} duration={duration} motorPowered={motorPowered} shuffle={shuffle} repeatMode={repeatMode} accentOnLightHex={accents.accentOnLightHex} engineReady={engineReady} getLimiterNode={() => audioEngine.getSafetyLimiterNode()} getAudioContext={() => audioEngine.getContext()} onTogglePlay={() => void togglePlay()} onPrevious={handleBackToBefore} onNext={() => handleNext(1)} onSeek={handleSeek} onToggleShuffle={() => setShuffle((value) => !value)} onCycleRepeat={cycleRepeat} onToggleMotor={() => setMotorPowered((value) => !value)}/>

        <AudioRackDrawer open={rackOpen} onClose={() => setRackOpen(false)} eqPreset={eqPreset} eqBands={eqBands} onEqPresetChange={handleEqPresetChange} onEqBandChange={handleEqBandChange} replayGainEnabled={replayGainEnabled} preampBoostDb={preampBoostDb} onToggleReplayGain={() => setReplayGainEnabled((value) => !value)} onTogglePreamp={() => setPreampBoostDb((value) => (value === 6 ? 0 : 6))} platterLocked={platterLocked} onTogglePlatterLock={() => setPlatterLocked((value) => !value)} pitchPercent={pitchPercent} onPitchChange={handlePitchChange} output={output} onClearLibrary={() => void handleClearLibrary()}/>

        <ArtworkLyricsModal open={artworkOpen} onClose={() => setArtworkOpen(false)} track={activeTrack} currentTime={currentTime} duration={duration} lyricOffsetSec={lyricOffsetSec} onLyricOffsetChange={setLyricOffsetSec} onSeek={handleSeek} accentHex={accents.accentHex} accentInkHex={accents.accentInkHex} accentOnLightHex={accents.accentOnLightHex}/>

        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} tracks={allTracks} onSelectTrack={selectTrack}/>

        <FloatingMiniDeck open={miniDeckOpen} onClose={() => setMiniDeckOpen(false)} track={activeTrack} isPlaying={isPlaying} currentTime={currentTime} duration={duration} accentHex={accents.accentHex} accentInkHex={accents.accentInkHex} accentOnLightHex={accents.accentOnLightHex} onTogglePlay={() => void togglePlay()} onPrevious={handleBackToBefore} onNext={() => handleNext(1)} onSeek={handleSeek}/>

        <input ref={fileInputRef} type="file" accept=".mp3,.flac,.lrc,audio/mpeg,audio/flac,audio/*" multiple className="hidden" onChange={handleFileInput}/>
        <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolderInput} {...{ webkitdirectory: '', directory: '' }}/>
        <input ref={relinkInputRef} type="file" accept=".mp3,.flac,audio/*" className="hidden" onChange={handleRelinkFile}/>

        <AnimatePresence>
          {isBooting && <BootPreloader status={bootStatus} exiting={!isBooting}/>}
        </AnimatePresence>

        {createPortal(<>
            {undoToast && (<div key={undoToast.id} className="animate-toast-in fixed bottom-[100px] left-1/2 z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#141413] px-4 py-2.5 shadow-[0_18px_40px_-12px_rgba(20,20,19,0.4)]" role="status">
                <span className="text-[12px] text-white">{undoToast.message}</span>
                {undoToast.actionLabel && (<button type="button" onClick={() => undoToast.onAction?.()} className="rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--accent-dynamic)' }}>
                    {undoToast.actionLabel}
                  </button>)}
              </div>)}

            {toastMessage && (<div className="animate-toast-in fixed bottom-[100px] left-1/2 z-[85] -translate-x-1/2 rounded-full bg-[#141413] px-4 py-2.5 text-[12px] text-white shadow-[0_18px_40px_-12px_rgba(20,20,19,0.4)]" role="status">
                {toastMessage}
              </div>)}
          </>, document.body)}

        <div className="pointer-events-none fixed bottom-[86px] left-4 z-[40] hidden xl:block">
          <span className="telemetry text-[9px] uppercase tracking-[0.16em] text-[#B6B3AC]">
            {formatTime(currentTime)} • {activeTrack?.artist ?? 'No track loaded'}
          </span>
        </div>
      </div>
    </MotionConfig>);
}
