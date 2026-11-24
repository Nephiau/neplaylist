import { useEffect, useRef } from 'react';
const MAX_AMPLITUDE = 58;
const SAMPLE_STEP = 4;
const IDLE_STROKE = 'rgba(20, 20, 19, 0.10)';
const ANCHOR_ID = 'turntableChassis';
const ANCHOR_REFRESH_MS = 250;
/*
 * A single horizon line across the gallery canvas. It rests as a straight
 * horizontal rule and swells into a travelling wave while a record is
 * spinning, driven by the live analyser energy. The line is anchored to the
 * centre of the record itself, not the raw viewport centre — the stage
 * reserves bottom clearance for the transport dock, so the platter sits a
 * little above middle and a viewport-centred rule would read as misaligned.
 * The ends stay pinned to the baseline so the line meets the edges cleanly.
 */
export function WaveLine({ getAnalyser, isPlaying, accent }) {
    const canvasRef = useRef(null);
    const analyserRef = useRef(getAnalyser);
    analyserRef.current = getAnalyser;
    const playingRef = useRef(isPlaying);
    playingRef.current = isPlaying;
    const accentRef = useRef(accent);
    accentRef.current = accent;
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let width = 0;
        let height = 0;
        let anchorY = 0;
        let anchorAt = 0;
        let raf = 0;
        let lastFrame = performance.now();
        let phase = 0;
        let energy = 0;
        let amplitude = 0;
        let settled = false;
        let freqBuf = null;
        /* Follow the deck through boot morphs, font swaps and resizes rather
           than trusting a one-off measurement taken before layout settles. */
        const resolveAnchor = (now) => {
            if (now - anchorAt < ANCHOR_REFRESH_MS)
                return;
            anchorAt = now;
            const deck = document.getElementById(ANCHOR_ID);
            if (!deck) {
                anchorY = height / 2;
                return;
            }
            const rect = deck.getBoundingClientRect();
            anchorY = rect.height > 0 ? rect.top + rect.height / 2 : height / 2;
        };
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            settled = false;
        };
        /* Mid-band loudness, normalised to 0..1. */
        const readEnergy = () => {
            const analyser = analyserRef.current?.();
            if (!analyser)
                return 0;
            const bins = analyser.frequencyBinCount;
            if (!freqBuf || freqBuf.length !== bins)
                freqBuf = new Uint8Array(bins);
            try {
                analyser.getByteFrequencyData(freqBuf);
            }
            catch {
                return 0;
            }
            const limit = Math.min(bins, 128);
            let total = 0;
            for (let i = 0; i < limit; i += 1)
                total += freqBuf[i];
            return Math.min(1, (total / (limit * 255)) * 1.7);
        };
        const strokeWave = (color, alpha, ampScale, lineWidth, glow) => {
            const centerY = anchorY || height / 2;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (glow) {
                ctx.shadowBlur = glow;
                ctx.shadowColor = color;
            }
            ctx.beginPath();
            for (let x = 0; x <= width; x += SAMPLE_STEP) {
                const t = x / width;
                /* Sine envelope keeps both ends flat against the baseline. */
                const envelope = Math.sin(t * Math.PI);
                const wave = Math.sin(t * Math.PI * 2 + phase) * 0.62 +
                    Math.sin(t * Math.PI * 3.3 - phase * 1.35 + 0.8) * 0.28 +
                    Math.sin(t * Math.PI * 5.7 + phase * 0.7) * 0.12;
                const y = centerY + wave * amplitude * ampScale * envelope;
                if (x === 0)
                    ctx.moveTo(x, y);
                else
                    ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        };
        const paint = () => {
            ctx.clearRect(0, 0, width, height);
            const activity = Math.min(1, amplitude / 12);
            strokeWave(IDLE_STROKE, 1, 1, 1.25, 0);
            if (activity > 0.01) {
                strokeWave(accentRef.current, activity, 1.3, 1.7, 0);
                strokeWave(accentRef.current, activity * 0.45, 1.3, 2.2, 16 * activity);
            }
            ctx.globalAlpha = 1;
        };
        const draw = () => {
            const now = performance.now();
            const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
            lastFrame = now;
            if (width > 0) {
                const previousAnchor = anchorY;
                resolveAnchor(now);
                if (Math.abs(anchorY - previousAnchor) > 0.5)
                    settled = false;
                const target = reduceMotion
                    ? 0
                    : playingRef.current
                        ? Math.max(readEnergy(), 0.08) * MAX_AMPLITUDE
                        : 0;
                energy = target;
                amplitude += (target - amplitude) * (target > amplitude ? 0.16 : 0.05);
                if (amplitude < 0.15)
                    amplitude = 0;
                if (amplitude > 0.15) {
                    phase += dt * (0.9 + energy / MAX_AMPLITUDE * 2.6);
                    settled = false;
                }
                if (amplitude === 0 && settled) {
                    raf = requestAnimationFrame(draw);
                    return;
                }
                paint();
                if (amplitude === 0)
                    settled = true;
            }
            raf = requestAnimationFrame(draw);
        };
        resize();
        window.addEventListener('resize', resize);
        raf = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);
    return (<canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true"/>);
}
