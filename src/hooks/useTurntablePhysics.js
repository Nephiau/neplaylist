import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../types/neplaylist';
const MOVE_THRESHOLD_PX = 8;
const INERTIA_TAU_SEC = 0.11;
const OUTER_GROOVE_R = 0.92;
const INNER_GROOVE_R = 0.38;
export function useTurntablePhysics(options) {
    const { isPlaying, motorPowered, omegaDegPerSec, platterLocked } = options;
    const discRef = useRef(null);
    const angleRef = useRef(0);
    const velocityRef = useRef(0);
    const dragRef = useRef(null);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const spinning = isPlaying && motorPowered && !platterLocked;
    const spinningRef = useRef(spinning);
    spinningRef.current = spinning;
    const omegaRef = useRef(omegaDegPerSec);
    omegaRef.current = omegaDegPerSec;
    useEffect(() => {
        let raf = 0;
        let last = performance.now();
        const step = (now) => {
            const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
            last = now;
            const dragging = dragRef.current;
            const target = spinningRef.current && !dragging ? omegaRef.current : 0;
            const alpha = 1 - Math.exp(-dt / INERTIA_TAU_SEC);
            velocityRef.current += (target - velocityRef.current) * alpha;
            if (Math.abs(velocityRef.current) < 0.01 && target === 0)
                velocityRef.current = 0;
            if (!dragging) {
                angleRef.current = (angleRef.current + velocityRef.current * dt) % 360;
            }
            const disc = discRef.current;
            if (disc) {
                disc.style.transform = `rotate(${angleRef.current}deg)`;
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, []);
    const rectFor = useCallback((element) => {
        return element.getBoundingClientRect();
    }, []);
    const onPointerDown = useCallback((event) => {
        const element = event.currentTarget;
        const rect = rectFor(element);
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        dragRef.current = {
            pointerId: event.pointerId,
            centerX,
            centerY,
            radius: Math.max(1, Math.min(rect.width, rect.height) / 2),
            startX: event.clientX,
            startY: event.clientY,
            lastAngle: angle,
            moved: false,
            engaged: false,
        };
        try {
            element.setPointerCapture(event.pointerId);
        }
        catch {
            /* pointer capture is best-effort */
        }
        event.preventDefault();
    }, [rectFor]);
    const onPointerMove = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        const travelX = event.clientX - drag.startX;
        const travelY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(travelX, travelY) > MOVE_THRESHOLD_PX) {
            drag.moved = true;
        }
        if (!drag.moved)
            return;
        if (optionsRef.current.platterLocked)
            return;
        const dx = event.clientX - drag.centerX;
        const dy = event.clientY - drag.centerY;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        let delta = angle - drag.lastAngle;
        if (delta > 180)
            delta -= 360;
        if (delta < -180)
            delta += 360;
        drag.lastAngle = angle;
        if (!drag.engaged) {
            drag.engaged = true;
            setIsScrubbing(true);
        }
        angleRef.current = (angleRef.current + delta) % 360;
        const omega = Math.max(30, Math.abs(omegaRef.current) || 30);
        const deltaSeconds = delta / omega;
        optionsRef.current.onScrubDelta?.(deltaSeconds);
    }, []);
    const finish = useCallback((event, cancelled) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catch {
            /* ignore */
        }
        const wasEngaged = drag.engaged;
        dragRef.current = null;
        setIsScrubbing(false);
        if (cancelled || wasEngaged)
            return;
        const dx = event.clientX - drag.centerX;
        const dy = event.clientY - drag.centerY;
        const distance = Math.hypot(dx, dy);
        const radiusFraction = clamp(distance / drag.radius, 0, 1.2);
        const travel = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (travel > MOVE_THRESHOLD_PX)
            return;
        const progress = clamp((OUTER_GROOVE_R - radiusFraction) / (OUTER_GROOVE_R - INNER_GROOVE_R), 0, 1);
        const duration = optionsRef.current.duration;
        const targetSeconds = clamp(progress * (duration > 0 ? duration : 0), 0, duration || 0);
        optionsRef.current.onStylusThump?.();
        optionsRef.current.onNeedleDrop?.(targetSeconds);
    }, []);
    const onPointerUp = useCallback((event) => finish(event, false), [finish]);
    const onPointerCancel = useCallback((event) => finish(event, true), [finish]);
    useEffect(() => {
        if (platterLocked && isScrubbing) {
            setIsScrubbing(false);
        }
    }, [platterLocked, isScrubbing]);
    return {
        discRef,
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    };
}
