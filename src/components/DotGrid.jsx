import { useEffect, useRef } from 'react';
const SPACING = 22;
const DOT_RADIUS = 1.15;
const DOT_ALPHA = 0.34;
/* Lattice points land on integer coordinates, which is the corner shared by
   four device pixels — a sub-pixel dot smears into a 25%-coverage haze. Nudging
   to the pixel centre keeps each dot crisp and visibly dark. */
const GRID_INSET = 0.5;
const POINTER_RADIUS = 250;
const POINTER_PUSH = 20;
/* Rings of displacement radiating from the centre, driven by live audio. */
const WAVE_LENGTH = 118;
const WAVE_MAX_PUSH = 15;
const WAVE_BASE_SPEED = 2.1;
const WAVE_ENERGY_SPEED = 8.5;
const LERP = 0.16;
/*
 * The gallery micro-dot grid, painted on canvas. Dots displace away from the
 * pointer and ride concentric rings that expand with the playing track's
 * energy, so the field breathes with the music. Everything settles back to a
 * flat lattice when the audio stops and the cursor leaves.
 */
export function DotGrid({ getAnalyser }) {
    const canvasRef = useRef(null);
    const analyserRef = useRef(getAnalyser);
    analyserRef.current = getAnalyser;
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
        let cols = 0;
        let rows = 0;
        let offsets = new Float32Array(0);
        const pointer = { x: -9999, y: -9999 };
        let pointerActive = false;
        let raf = 0;
        let dirty = true;
        let idleFrames = 0;
        let lastFrame = performance.now();
        let energy = 0;
        let wavePhase = 0;
        let freqBuf = null;
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cols = Math.ceil(width / SPACING) + 1;
            rows = Math.ceil(height / SPACING) + 1;
            offsets = new Float32Array(cols * rows * 2);
            dirty = true;
            idleFrames = 0;
        };
        /* Bass-weighted loudness of the live signal, normalised to 0..1. */
        const readEnergy = () => {
            const analyser = analyserRef.current?.();
            if (!analyser || reduceMotion)
                return 0;
            const binCount = analyser.frequencyBinCount;
            if (!freqBuf || freqBuf.length !== binCount)
                freqBuf = new Uint8Array(binCount);
            try {
                analyser.getByteFrequencyData(freqBuf);
            }
            catch {
                return 0;
            }
            const bassBins = Math.min(10, binCount);
            let bass = 0;
            for (let i = 0; i < bassBins; i += 1)
                bass += freqBuf[i];
            bass /= bassBins * 255;
            let total = 0;
            let samples = 0;
            for (let i = 0; i < binCount; i += 4) {
                total += freqBuf[i];
                samples += 1;
            }
            total /= samples * 255 || 1;
            return Math.min(1, bass * 0.65 + total * 0.35);
        };
        const draw = () => {
            const now = performance.now();
            const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
            lastFrame = now;
            const nextEnergy = readEnergy();
            /* Fast attack, slow release, so the wave punches on transients but
               decays smoothly instead of flickering on quiet gaps. */
            energy += (nextEnergy - energy) * (nextEnergy > energy ? 0.3 : 0.05);
            if (energy > 0.004) {
                wavePhase += dt * (WAVE_BASE_SPEED + energy * WAVE_ENERGY_SPEED);
                dirty = true;
            }
            if (!dirty) {
                raf = requestAnimationFrame(draw);
                return;
            }
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = `rgba(20, 20, 19, ${DOT_ALPHA})`;
            const centreX = width / 2;
            const centreY = height / 2;
            const waveAmp = energy * WAVE_MAX_PUSH;
            let moving = false;
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    const index = (row * cols + col) * 2;
                    const baseX = col * SPACING + GRID_INSET;
                    const baseY = row * SPACING + GRID_INSET;
                    let targetX = 0;
                    let targetY = 0;
                    if (pointerActive && !reduceMotion) {
                        const dx = baseX - pointer.x;
                        const dy = baseY - pointer.y;
                        const distance = Math.hypot(dx, dy);
                        if (distance < POINTER_RADIUS && distance > 0.001) {
                            /* Quadratic falloff keeps the distortion local and smooth. */
                            const falloff = 1 - distance / POINTER_RADIUS;
                            const push = falloff * falloff * POINTER_PUSH;
                            targetX = (dx / distance) * push;
                            targetY = (dy / distance) * push;
                        }
                    }
                    if (waveAmp > 0.15) {
                        const cdx = baseX - centreX;
                        const cdy = baseY - centreY;
                        const distance = Math.hypot(cdx, cdy);
                        if (distance > 0.001) {
                            const wave = Math.sin((distance / WAVE_LENGTH) * Math.PI * 2 - wavePhase) * waveAmp;
                            targetX += (cdx / distance) * wave;
                            targetY += (cdy / distance) * wave;
                        }
                    }
                    const nextX = offsets[index] + (targetX - offsets[index]) * LERP;
                    const nextY = offsets[index + 1] + (targetY - offsets[index + 1]) * LERP;
                    const settledX = Math.abs(targetX - nextX) < 0.05;
                    const settledY = Math.abs(targetY - nextY) < 0.05;
                    const restingX = settledX && Math.abs(nextX) < 0.05;
                    const restingY = settledY && Math.abs(nextY) < 0.05;
                    offsets[index] = restingX ? 0 : nextX;
                    offsets[index + 1] = restingY ? 0 : nextY;
                    if (!(restingX && restingY))
                        moving = true;
                    ctx.beginPath();
                    ctx.arc(baseX + offsets[index], baseY + offsets[index + 1], DOT_RADIUS, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            /* Two consecutive still frames mean the field has fully settled. */
            idleFrames = moving || pointerActive || energy > 0.004 ? 0 : idleFrames + 1;
            if (idleFrames > 2)
                dirty = false;
            raf = requestAnimationFrame(draw);
        };
        const onPointerMove = (event) => {
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointerActive = true;
            dirty = true;
            idleFrames = 0;
        };
        const onPointerLeave = () => {
            pointerActive = false;
            pointer.x = -9999;
            pointer.y = -9999;
            dirty = true;
            idleFrames = 0;
        };
        resize();
        raf = requestAnimationFrame(draw);
        window.addEventListener('resize', resize);
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('pointerleave', onPointerLeave);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            window.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerleave', onPointerLeave);
        };
    }, []);
    return (<canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true"/>);
}
