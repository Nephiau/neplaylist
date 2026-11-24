import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Power, } from 'lucide-react';
import { clamp, formatTime } from '../types/neplaylist';
export function BottomTransportDock({ isPlaying, currentTime, duration, motorPowered, shuffle, repeatMode, accentOnLightHex, engineReady, getLimiterNode, getAudioContext, onTogglePlay, onPrevious, onNext, onSeek, onToggleShuffle, onCycleRepeat, onToggleMotor, }) {
    const containerRef = useRef(null);
    const analyzerRef = useRef(null);
    const [analyzerFailed, setAnalyzerFailed] = useState(false);
    const [scrub, setScrub] = useState({
        visible: false,
        x: 0,
        y: 0,
        time: 0,
    });
    const scrubbingRef = useRef(false);
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const progress = safeDuration > 0 ? clamp(currentTime / safeDuration, 0, 1) : 0;
    const accentRef = useRef(accentOnLightHex);
    accentRef.current = accentOnLightHex;
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const getLimiterRef = useRef(getLimiterNode);
    getLimiterRef.current = getLimiterNode;
    const getContextRef = useRef(getAudioContext);
    getContextRef.current = getAudioContext;
    useEffect(() => {
        const container = containerRef.current;
        const ctx = getContextRef.current();
        const limiter = getLimiterRef.current();
        if (!container || !ctx || !limiter)
            return;
        /* Clear prior canvases so StrictMode double-mounts never stack analyzers. */
        container.innerHTML = '';
        const analyzer = new AudioMotionAnalyzer(container, {
            audioCtx: ctx,
            source: limiter,
            connectSpeakers: false,
            overlay: true,
            showBgColor: false,
            showScaleX: false,
            showScaleY: false,
            showPeaks: false,
            mode: 6,
            barSpace: 0.35,
            smoothing: 0.72,
        });
        /* The gradient must exist before it is selected, so register first. */
        analyzer.registerGradient('neplaylist-daylight', {
            bgColor: 'transparent',
            colorStops: [accentRef.current],
        });
        analyzer.gradient = 'neplaylist-daylight';
        analyzerRef.current = analyzer;
        return () => {
            try {
                analyzer.destroy();
            }
            catch {
                /* analyzer may already be torn down */
            }
            analyzerRef.current = null;
            if (container)
                container.innerHTML = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engineReady]);
    /* Health-check the analyzer graph, not the audio content. Silence, a quiet
       intro, or a paused deck all produce empty bars — judging that would latch
       the CSS fallback over a perfectly good analyzer. Only an unattached or
       stopped analyzer is a real failure, and it can recover. */
    useEffect(() => {
        const timer = window.setInterval(() => {
            const analyzer = analyzerRef.current;
            if (!analyzer)
                return;
            let healthy = true;
            try {
                healthy = analyzer.isOn && analyzer.connectedSources.length > 0;
            }
            catch {
                healthy = false;
            }
            setAnalyzerFailed((prev) => (prev === !healthy ? prev : !healthy));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [engineReady]);
    useEffect(() => {
        const analyzer = analyzerRef.current;
        if (!analyzer)
            return;
        try {
            analyzer.registerGradient('neplaylist-daylight', {
                bgColor: 'transparent',
                colorStops: [accentOnLightHex],
            });
            analyzer.gradient = 'neplaylist-daylight';
        }
        catch {
            setAnalyzerFailed(true);
        }
    }, [accentOnLightHex]);
    const timeFromX = useCallback((clientX, rect) => {
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        return ratio * safeDuration;
    }, [safeDuration]);
    const handleScrub = useCallback((event) => {
        if (safeDuration <= 0)
            return;
        const rect = event.currentTarget.getBoundingClientRect();
        const time = timeFromX(event.clientX, rect);
        setScrub({ visible: true, x: event.clientX, y: rect.top, time });
        return time;
    }, [safeDuration, timeFromX]);
    const onPointerDown = (event) => {
        if (safeDuration <= 0)
            return;
        scrubbingRef.current = true;
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        catch {
            /* best effort */
        }
        handleScrub(event);
        event.preventDefault();
    };
    const onPointerMove = (event) => {
        if (!scrubbingRef.current)
            return;
        handleScrub(event);
    };
    const onPointerUp = (event) => {
        if (!scrubbingRef.current)
            return;
        scrubbingRef.current = false;
        setScrub((state) => ({ ...state, visible: false }));
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(timeFromX(event.clientX, rect));
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catch {
            /* best effort */
        }
    };
    const waveformBars = useMemo(() => Array.from({ length: 56 }, (_, i) => i), []);
    const repeatLabel = repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Always repeat' : 'Repeat one';
    return (<div className="fixed left-1/2 z-50 -translate-x-1/2" style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))', width: 'min(940px, calc(100vw - 24px))' }}>
      <div className="flex items-center gap-2 rounded-[22px] px-2.5 py-2.5 sm:gap-3 sm:px-3" style={{
            background: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(22px) saturate(150%)',
            WebkitBackdropFilter: 'blur(22px) saturate(150%)',
            border: '1px solid rgba(20, 20, 19, 0.09)',
            boxShadow: '0 20px 44px -10px rgba(20, 20, 19, 0.12)',
            minHeight: 62,
        }}>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button type="button" onClick={onPrevious} aria-label="Back to before" className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#F3F2EE] text-[#141413] transition-colors hover:bg-[#EAE7E1]">
            <SkipBack size={14} fill="currentColor"/>
          </button>

          <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="grid h-10 w-10 place-items-center rounded-full bg-[#141413] text-white shadow-[0_6px_16px_rgba(20,20,19,0.22)] transition-transform hover:scale-[1.04] active:scale-95">
            {isPlaying ? (<Pause size={15} fill="currentColor"/>) : (<Play size={15} fill="currentColor" className="ml-0.5"/>)}
          </button>

          <button type="button" onClick={onNext} aria-label="Skip" className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#F3F2EE] text-[#141413] transition-colors hover:bg-[#EAE7E1]">
            <SkipForward size={14} fill="currentColor"/>
          </button>

          <div className="mx-0.5 hidden h-6 w-px bg-[rgba(20,20,19,0.08)] sm:block"/>

          <button type="button" onClick={onToggleShuffle} aria-pressed={shuffle} aria-label="Shuffle" className="hidden h-8 w-8 place-items-center rounded-full transition-colors hover:bg-[#F5F4F0] sm:grid" style={{ color: shuffle ? 'var(--accent-on-light)' : '#8C8A84' }}>
            <Shuffle size={13}/>
          </button>

          <button type="button" onClick={onCycleRepeat} aria-label={repeatLabel} title={repeatLabel} className="relative hidden h-8 w-8 place-items-center rounded-full transition-colors hover:bg-[#F5F4F0] sm:grid" style={{ color: repeatMode === 'off' ? '#8C8A84' : 'var(--accent-on-light)' }}>
            {repeatMode === 'one' ? <Repeat1 size={13}/> : <Repeat size={13}/>}
            {repeatMode !== 'off' && (<span className="telemetry absolute -right-0.5 -top-0.5 grid h-3 w-3 place-items-center rounded-full text-[7px] font-bold text-white" style={{ background: 'var(--accent-on-light)' }}>
                {repeatMode === 'one' ? '1' : '∞'}
              </span>)}
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="telemetry hidden shrink-0 text-[10px] text-[#575653] sm:block">
            {formatTime(currentTime)}
          </span>

          <div className="relative min-w-0 flex-1 cursor-pointer select-none" style={{ minHeight: 36, touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(safeDuration)} aria-valuenow={Math.round(currentTime)} tabIndex={0}>
            <div ref={containerRef} className="absolute inset-0 h-full w-full" style={{
            opacity: analyzerFailed ? 0 : 1,
            transition: 'opacity 300ms ease',
            pointerEvents: 'none',
        }}/>

            {(analyzerFailed || !getLimiterNode()) && (<div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="flex h-6 w-full items-end gap-[2px]">
                  {waveformBars.map((bar) => {
                const played = bar / waveformBars.length <= progress;
                const height = 22 + Math.abs(Math.sin(bar * 1.7)) * 62;
                return (<span key={bar} className="flex-1 rounded-full" style={{
                        height: `${height}%`,
                        background: played ? accentOnLightHex : '#D6D3CD',
                        animation: isPlaying ? `barPulse ${1.1 + (bar % 4) * 0.16}s ease-in-out infinite` : undefined,
                        animationDelay: `${(bar % 7) * 0.07}s`,
                        transformOrigin: 'bottom',
                    }}/>);
            })}
                </div>
              </div>)}

            <div className="pointer-events-none absolute top-0 h-full w-[2px] rounded-full" style={{
            left: `${progress * 100}%`,
            background: accentOnLightHex,
            opacity: safeDuration > 0 ? 1 : 0,
        }} aria-hidden="true"/>
          </div>

          <span className="telemetry shrink-0 text-[10px] text-[#8C8A84]">
            {safeDuration > 0 ? formatTime(safeDuration) : '--:--'}
          </span>
        </div>

        <div className="hidden h-6 w-px shrink-0 bg-[rgba(20,20,19,0.08)] sm:block"/>

        <button type="button" onClick={onToggleMotor} aria-pressed={motorPowered} aria-label={motorPowered ? 'Motor on' : 'Motor off'} className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors" style={{
            borderColor: motorPowered ? 'var(--accent-on-light)' : 'rgba(20,20,19,0.12)',
            color: motorPowered ? 'var(--accent-on-light)' : '#8C8A84',
        }}>
          <Power size={13}/>
          {motorPowered && (<span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 3px rgba(0,0,0,0.03), 0 0 10px var(--accent-on-light)' }}/>)}
        </button>
      </div>

      {createPortal(<div className="telemetry pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-full rounded-full bg-[#141413] px-2.5 py-1 text-[10px] font-medium text-white shadow-lg" style={{
                left: scrub.x,
                top: scrub.y - 10,
                opacity: scrub.visible ? 1 : 0,
                transition: 'opacity 120ms ease',
            }} aria-hidden={!scrub.visible}>
          {formatTime(scrub.time)}
        </div>, document.body)}
    </div>);
}
