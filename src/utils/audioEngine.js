import { analyze } from 'web-audio-beat-detector';
import { EQ_FREQUENCIES, clamp, effectiveBpm, } from '../types/neplaylist';
const LIMITER_THRESHOLD_DB = -1;
const EQ_Q = 1.4;
const MIN_RATE = 0.65;
const MAX_RATE = 1.08;
const RAMP_MS = 350;
const STYLUS_THUMP_MS = 45;
const REFERENCE_BPM = 116;
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.audio = null;
        this.mediaSource = null;
        this.replayGainNode = null;
        this.eqNodes = [];
        this.limiterNode = null;
        this.analyserNode = null;
        this.listeners = new Map();
        this.rateTarget = 1;
        this.rateRaf = null;
        this.clipMonitor = null;
        this.clipActive = false;
        this.clipResetAt = 0;
        this.timePoll = null;
        this.wantsPlayback = false;
        this.endedEmitted = false;
    }
    getContext() {
        return this.ctx;
    }
    getSafetyLimiterNode() {
        return this.limiterNode;
    }
    getAnalyserNode() {
        return this.analyserNode;
    }
    getAudioElement() {
        return this.audio;
    }
    on(event, listener) {
        if (!this.listeners.has(event))
            this.listeners.set(event, new Set());
        this.listeners.get(event).add(listener);
        return () => {
            this.listeners.get(event)?.delete(listener);
        };
    }
    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set)
            return;
        for (const listener of set) {
            try {
                listener(payload);
            }
            catch {
                /* listener errors must never break the audio graph */
            }
        }
    }
    ensureContext() {
        if (this.ctx)
            return this.ctx;
        const Ctor = window.AudioContext ??
            window.webkitAudioContext;
        const ctx = new Ctor();
        this.ctx = ctx;
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        try {
            const media = this.audio;
            media.preservesPitch = false;
        }
        catch {
            /* older Safari exposes only webkitPreservesPitch */
        }
        try {
            const media = this.audio;
            media.webkitPreservesPitch = false;
        }
        catch {
            /* ignore */
        }
        this.replayGainNode = ctx.createGain();
        this.replayGainNode.gain.value = 1;
        this.eqNodes = EQ_FREQUENCIES.map((freq) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = EQ_Q;
            filter.gain.value = 0;
            return filter;
        });
        this.limiterNode = ctx.createDynamicsCompressor();
        this.limiterNode.threshold.value = LIMITER_THRESHOLD_DB;
        this.limiterNode.knee.value = 6;
        this.limiterNode.ratio.value = 12;
        this.limiterNode.attack.value = 0.003;
        this.limiterNode.release.value = 0.15;
        this.analyserNode = ctx.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.7;
        this.mediaSource = ctx.createMediaElementSource(this.audio);
        this.mediaSource.connect(this.replayGainNode);
        let cursor = this.replayGainNode;
        for (const filter of this.eqNodes) {
            cursor.connect(filter);
            cursor = filter;
        }
        cursor.connect(this.limiterNode);
        this.limiterNode.connect(this.analyserNode);
        this.analyserNode.connect(ctx.destination);
        this.audio.addEventListener('loadedmetadata', () => {
            const element = this.audio;
            if (!element)
                return;
            if (Number.isFinite(element.duration) && element.duration > 0) {
                this.emit('loadedmetadata', element.duration);
            }
        });
        this.audio.addEventListener('ended', () => this.handleEnded());
        this.audio.addEventListener('play', () => this.emit('playstate', true));
        this.audio.addEventListener('pause', () => {
            if (!this.wantsPlayback)
                this.emit('playstate', false);
        });
        ctx.onstatechange = () => {
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                if (this.wantsPlayback)
                    void ctx.resume().catch(() => undefined);
            }
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' &&
                this.wantsPlayback &&
                (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
                void ctx.resume().catch(() => undefined);
            }
        });
        return ctx;
    }
    startTimePolling() {
        if (this.timePoll !== null)
            return;
        this.timePoll = window.setInterval(() => {
            const time = this.getCurrentTime();
            const duration = this.getDuration();
            this.emit('time', { currentTime: time, duration });
            if (this.wantsPlayback && duration > 0 && time >= duration - 0.06) {
                this.handleEnded();
            }
        }, 200);
    }
    handleEnded() {
        if (this.endedEmitted)
            return;
        this.endedEmitted = true;
        this.wantsPlayback = false;
        this.audio?.pause();
        this.emit('ended');
        this.emit('playstate', false);
    }
    resetEndedFlag() {
        this.endedEmitted = false;
    }
    async load(source) {
        const ctx = this.ensureContext();
        if (ctx.state === 'suspended')
            await ctx.resume().catch(() => undefined);
        this.resetEndedFlag();
        const element = this.audio;
        if (!element)
            return;
        if (source.url) {
            element.src = source.url;
            element.load();
        }
        else {
            element.removeAttribute('src');
            element.load();
        }
        this.startTimePolling();
    }
    async play() {
        const ctx = this.ensureContext();
        if (ctx.state !== 'running')
            await ctx.resume().catch(() => undefined);
        this.resetEndedFlag();
        this.wantsPlayback = true;
        this.startClipMonitor();
        this.startTimePolling();
        const element = this.audio;
        if (!element || !element.src) {
            this.emit('playstate', false);
            return;
        }
        try {
            await element.play();
            this.emit('playstate', true);
        }
        catch (error) {
            const name = error?.name;
            if (name === 'AbortError')
                return;
            this.wantsPlayback = false;
            this.emit('playstate', false);
        }
    }
    pause() {
        this.wantsPlayback = false;
        this.audio?.pause();
        this.emit('playstate', false);
    }
    isPlaying() {
        const element = this.audio;
        return Boolean(element && !element.paused && !element.ended && this.wantsPlayback);
    }
    seek(seconds) {
        const duration = this.getDuration();
        const target = clamp(seconds, 0, duration > 0 ? duration : seconds);
        this.resetEndedFlag();
        const element = this.audio;
        if (!element)
            return;
        if (Number.isFinite(target))
            element.currentTime = target;
        this.emit('time', { currentTime: target, duration });
    }
    getCurrentTime() {
        const element = this.audio;
        if (!element)
            return 0;
        return Number.isFinite(element.currentTime) ? element.currentTime : 0;
    }
    getDuration() {
        const element = this.audio;
        if (!element)
            return 0;
        return Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0;
    }
    setReplayGain(db, enabled, preampDb) {
        const node = this.replayGainNode;
        if (!node)
            return;
        if (!enabled || db === null || !Number.isFinite(db)) {
            node.gain.value = 1;
            return;
        }
        const clamped = clamp(db, -18, 12);
        const gain = 10 ** ((clamped + preampDb) / 20);
        node.gain.value = Number.isFinite(gain) && gain > 0 ? clamp(gain, 0.05, 6) : 1;
    }
    setEqBand(index, db) {
        const filter = this.eqNodes[index];
        if (!filter)
            return;
        filter.gain.value = clamp(Number.isFinite(db) ? db : 0, -12, 12);
    }
    setEqBands(bands) {
        bands.forEach((db, index) => this.setEqBand(index, db));
    }
    applyRateImmediate(rate) {
        const element = this.audio;
        if (element) {
            element.playbackRate = clamp(rate, MIN_RATE, MAX_RATE);
        }
    }
    setPlaybackRate(rate, animate = true) {
        const target = clamp(Number.isFinite(rate) ? rate : 1, MIN_RATE, MAX_RATE);
        this.rateTarget = target;
        if (this.rateRaf !== null) {
            cancelAnimationFrame(this.rateRaf);
            this.rateRaf = null;
        }
        const element = this.audio;
        const from = element ? element.playbackRate : this.rateTarget;
        if (!animate || Math.abs(target - from) < 0.001) {
            this.applyRateImmediate(target);
            return;
        }
        const start = performance.now();
        const step = () => {
            const progress = clamp((performance.now() - start) / RAMP_MS, 0, 1);
            const eased = 1 - (1 - progress) ** 3;
            const value = from + (target - from) * eased;
            this.applyRateImmediate(value);
            if (progress < 1) {
                this.rateRaf = requestAnimationFrame(step);
            }
            else {
                this.rateRaf = null;
                this.applyRateImmediate(target);
            }
        };
        this.rateRaf = requestAnimationFrame(step);
    }
    /* A clean damped sine stylus thump â€” no noise buffers, ever. */
    playStylusThump() {
        const ctx = this.ctx;
        const bus = this.replayGainNode;
        if (!ctx || !bus)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + STYLUS_THUMP_MS / 1000);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(0.075, now + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, now + STYLUS_THUMP_MS / 1000);
        osc.connect(env);
        env.connect(bus);
        osc.start(now);
        osc.stop(now + STYLUS_THUMP_MS / 1000 + 0.02);
        osc.onended = () => {
            try {
                osc.disconnect();
                env.disconnect();
            }
            catch {
                /* ignore */
            }
        };
    }
    startClipMonitor() {
        if (this.clipMonitor !== null)
            return;
        this.clipMonitor = window.setInterval(() => {
            const analyser = this.analyserNode;
            if (!analyser)
                return;
            const buffer = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(buffer);
            let clipped = false;
            for (let i = 0; i < buffer.length; i += 1) {
                if (buffer[i] === 0 || buffer[i] === 255) {
                    clipped = true;
                    break;
                }
            }
            const now = performance.now();
            if (clipped) {
                this.clipResetAt = now + 400;
                if (!this.clipActive) {
                    this.clipActive = true;
                    this.emit('clip', true);
                }
            }
            else if (this.clipActive && now > this.clipResetAt) {
                this.clipActive = false;
                this.emit('clip', false);
            }
        }, 90);
    }
    async analyzeBpm(file, embeddedBpm) {
        if (embeddedBpm > 0 && Number.isFinite(embeddedBpm))
            return embeddedBpm;
        try {
            const sliceBytes = Math.min(file.size, 8 * 1024 * 1024);
            const slice = file.slice(0, sliceBytes);
            const arrayBuffer = await slice.arrayBuffer();
            const OfflineCtor = window.OfflineAudioContext ??
                window
                    .webkitOfflineAudioContext;
            const offline = new OfflineCtor(1, 1, 44100);
            let audioBuffer = null;
            try {
                audioBuffer = await offline.decodeAudioData(arrayBuffer);
            }
            catch {
                return null;
            }
            if (!audioBuffer || !(audioBuffer.duration >= 2)) {
                audioBuffer = null;
                return null;
            }
            const offset = Math.min(15, audioBuffer.duration * 0.2);
            const duration = Math.min(15, Math.max(1, audioBuffer.duration - offset));
            try {
                const bpm = await analyze(audioBuffer, offset, duration, { minTempo: 60, maxTempo: 165 });
                if (!Number.isFinite(bpm) || bpm <= 0)
                    return null;
                return Math.round(clamp(bpm, 60, 165) * 10) / 10;
            }
            finally {
                /* release the decoded PCM as soon as the analysis resolves */
                audioBuffer = null;
            }
        }
        catch {
            return null;
        }
    }
    /* The platter always tracks the song tempo: a reference tempo maps to
       33⅓ RPM, scaled linearly and bent by the quartz pitch fader. */
    platterOmega(bpm, pitchPercent) {
        const pitchRatio = 1 + clamp(pitchPercent, -8, 8) / 100;
        const tempo = effectiveBpm(bpm);
        return (tempo / REFERENCE_BPM) * 200 * pitchRatio;
    }
}
export const audioEngine = new AudioEngine();
