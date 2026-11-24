import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { clamp, formatTime } from '../types/neplaylist';
import { GroovedDisc } from './vinylGraphics';
function cloneStylesInto(target) {
    const nodes = document.querySelectorAll('link[rel="stylesheet"], style');
    for (const node of Array.from(nodes)) {
        try {
            const clone = node.cloneNode(true);
            const href = node.href;
            if (href && target.querySelector(`link[href="${href}"]`))
                continue;
            target.head.appendChild(clone);
        }
        catch {
            /* a single blocked stylesheet must not abort the PiP window */
        }
    }
}
function MiniDeckBody({ track, isPlaying, currentTime, duration, accentHex, accentOnLightHex, onTogglePlay, onPrevious, onNext, onSeek, onClose, showClose, }) {
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const progress = safeDuration > 0 ? clamp(currentTime / safeDuration, 0, 1) : 0;
    return (<div className="flex h-full w-full items-center gap-3 rounded-[16px] border px-3 py-2.5" style={{
            background: 'rgba(255, 255, 255, 0.94)',
            borderColor: 'rgba(20, 20, 19, 0.09)',
            boxShadow: '0 18px 40px -12px rgba(20, 20, 19, 0.24)',
            backdropFilter: 'blur(18px)',
        }}>
      <div className="relative h-[74px] w-[74px] shrink-0">
        <div className={isPlaying ? 'animate-spin-vinyl h-full w-full' : 'h-full w-full'}>
          <GroovedDisc labelUrl={track?.thumbUrl ?? null} className="h-full w-full"/>
        </div>
        <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${accentHex}33` }}/>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold tracking-[-0.02em] text-[#141413]">
          {track?.title ?? 'No track'}
        </p>
        <p className="truncate text-[10px] text-[#8C8A84]">{track?.artist ?? '—'}</p>

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="telemetry text-[9px] text-[#575653]">{formatTime(currentTime)}</span>
          <div className="relative h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-[#E2DFD9]" role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(safeDuration)} aria-valuenow={Math.round(currentTime)} onPointerDown={(event) => {
            if (safeDuration <= 0)
                return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            onSeek(ratio * safeDuration);
        }}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress * 100}%`, background: accentOnLightHex }}/>
          </div>
          <span className="telemetry text-[9px] text-[#8C8A84]">
            {safeDuration > 0 ? formatTime(safeDuration) : '--:--'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onPrevious} aria-label="Previous track" className="grid h-7 w-7 place-items-center rounded-full text-[#575653] hover:bg-[#F3F2EE]">
          <SkipBack size={12} fill="currentColor"/>
        </button>
        <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="grid h-8 w-8 place-items-center rounded-full bg-[#141413] text-white">
          {isPlaying ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
        </button>
        <button type="button" onClick={onNext} aria-label="Next track" className="grid h-7 w-7 place-items-center rounded-full text-[#575653] hover:bg-[#F3F2EE]">
          <SkipForward size={12} fill="currentColor"/>
        </button>
        {showClose && (<button type="button" onClick={onClose} aria-label="Close mini deck" className="grid h-7 w-7 place-items-center rounded-full text-[#8C8A84] hover:bg-[#F3F2EE]">
            <X size={12}/>
          </button>)}
      </div>
    </div>);
}
export function FloatingMiniDeck(props) {
    const { open, onClose, accentHex, accentInkHex, accentOnLightHex } = props;
    const [pipWindow, setPipWindow] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState({ x: 24, y: 0 });
    const dragRef = useRef(null);
    useEffect(() => {
        if (!pos.y) {
            setPos((state) => ({ ...state, y: Math.max(24, window.innerHeight - 190) }));
        }
    }, [pos.y]);
    useEffect(() => {
        if (!open) {
            if (pipWindow && !pipWindow.closed)
                pipWindow.close();
            setPipWindow(null);
        }
    }, [open, pipWindow]);
    useEffect(() => {
        if (!pipWindow)
            return;
        const root = pipWindow.document.documentElement;
        root.style.setProperty('--accent-dynamic', accentHex);
        root.style.setProperty('--accent-dynamic-ink', accentInkHex);
        root.style.setProperty('--accent-on-light', accentOnLightHex);
    }, [pipWindow, accentHex, accentInkHex, accentOnLightHex]);
    useEffect(() => {
        if (!pipWindow)
            return;
        const handler = () => {
            setPipWindow(null);
            onClose();
        };
        pipWindow.addEventListener('pagehide', handler);
        return () => pipWindow.removeEventListener('pagehide', handler);
    }, [pipWindow, onClose]);
    useEffect(() => {
        if (!dragging)
            return;
        const onMove = (event) => {
            const drag = dragRef.current;
            if (!drag)
                return;
            const nextX = clamp(drag.originX + (event.clientX - drag.startX), 8, window.innerWidth - 320);
            const nextY = clamp(drag.originY + (event.clientY - drag.startY), 8, window.innerHeight - 120);
            setPos({ x: nextX, y: nextY });
        };
        const onUp = () => setDragging(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [dragging]);
    const supportsPip = typeof window !== 'undefined' &&
        window.isSecureContext &&
        typeof window.documentPictureInPicture?.requestWindow === 'function';
    useEffect(() => {
        if (!open || !supportsPip || pipWindow)
            return;
        let cancelled = false;
        const requestPip = async () => {
            try {
                const win = await window.documentPictureInPicture.requestWindow({
                    width: 320,
                    height: 140,
                });
                if (cancelled) {
                    win.close();
                    return;
                }
                cloneStylesInto(win.document);
                try {
                    win.document.body.style.margin = '0';
                    win.document.body.style.background = '#F7F6F2';
                    win.document.body.style.padding = '6px';
                    const viewport = win.document.createElement('meta');
                    viewport.name = 'viewport';
                    viewport.content = 'width=device-width, initial-scale=1';
                    win.document.head.appendChild(viewport);
                }
                catch {
                    /* styling the PiP document is best-effort */
                }
                setPipWindow(win);
            }
            catch {
                setPipWindow(null);
            }
        };
        void requestPip();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, supportsPip]);
    if (!open)
        return null;
    if (pipWindow && !pipWindow.closed) {
        return createPortal(<MiniDeckBody {...props} showClose={false}/>, pipWindow.document.body);
    }
    return createPortal(<motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="fixed z-[75] w-[300px]" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label="Mini turntable">
      <div onPointerDown={(event) => {
            dragRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                originX: pos.x,
                originY: pos.y,
            };
            setDragging(true);
        }} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
        <MiniDeckBody {...props} showClose/>
      </div>
    </motion.div>, document.body);
}
