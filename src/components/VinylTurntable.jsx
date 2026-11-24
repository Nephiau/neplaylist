import { motion } from 'motion/react';
import { formatTime } from '../types/neplaylist';
import { useTurntablePhysics } from '../hooks/useTurntablePhysics';
import { GroovedDisc, StampSeal, Tonearm } from './vinylGraphics';
export function VinylTurntable({ track, isPlaying, motorPowered, platterLocked, omegaDegPerSec, progress, currentTime, duration, onTogglePlay, onNeedleDrop, onScrubDelta, onStylusThump, }) {
    const physics = useTurntablePhysics({
        isPlaying,
        motorPowered,
        omegaDegPerSec,
        platterLocked,
        duration,
        onNeedleDrop,
        onScrubDelta,
        onStylusThump,
    });
    const playing = isPlaying && motorPowered;
    const yearLabel = track?.year ?? null;
    return (<div className="relative flex w-full flex-col items-center gap-3">
      <div className="pointer-events-none absolute -right-2 -top-6 hidden xl:block">
        <StampSeal className="animate-spin-seal"/>
      </div>

      <div className="platter-size relative flex items-center justify-center" style={{ touchAction: 'pan-y' }}>
        {/* Non-rotating circular plinth — the FLIP morph target. */}
        <motion.div id="turntableChassis" layoutId="neplaylist-platter-morph" style={{ borderRadius: 9999 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
          <div className="absolute inset-0" style={{
            border: '1px solid rgba(20, 20, 19, 0.08)',
            borderRadius: 9999,
            boxShadow: '0 28px 60px -15px rgba(20, 20, 19, 0.14)',
        }}/>
          <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
            {Array.from({ length: 72 }, (_, i) => {
            const angle = (i / 72) * Math.PI * 2;
            const outer = 47.6;
            const inner = i % 6 === 0 ? 44.6 : 46;
            return (<line key={i} x1={50 + Math.cos(angle) * inner} y1={50 + Math.sin(angle) * inner} x2={50 + Math.cos(angle) * outer} y2={50 + Math.sin(angle) * outer} stroke={playing ? 'var(--accent-dynamic, #E04F3E)' : 'rgba(20,20,19,0.16)'} strokeWidth={i % 6 === 0 ? 0.7 : 0.4} strokeOpacity={playing ? 0.8 : 0.5} style={{ transition: 'stroke 400ms ease, stroke-opacity 400ms ease' }}/>);
        })}
          </svg>
        </motion.div>

        {/* Rotating record — inner disc rotates independently of the plinth. */}
        <div className="pointer-events-none absolute inset-[7%]">
          <div ref={physics.discRef} className="h-full w-full" style={{ willChange: 'transform' }}>
            <GroovedDisc labelUrl={track?.thumbUrl ?? null} labelYear={yearLabel ?? undefined} className="h-full w-full drop-shadow-[0_14px_26px_rgba(20,20,19,0.22)]"/>
          </div>
        </div>

        {/* Stationary overhead gallery sheen above the grooves. */}
        <div className="pointer-events-none absolute inset-[7%] rounded-full" style={{
            background: 'conic-gradient(from 210deg at 46% 38%, rgba(255,255,255,0.5) 0deg, rgba(255,255,255,0) 62deg, rgba(255,255,255,0.24) 140deg, rgba(255,255,255,0) 240deg, rgba(255,255,255,0.3) 340deg)',
            mixBlendMode: 'screen',
            opacity: 0.55,
        }} aria-hidden="true"/>

        <div className="absolute inset-[7%] cursor-grab rounded-full active:cursor-grabbing" style={{ touchAction: 'pan-y', pointerEvents: 'auto' }} onPointerDown={physics.handlers.onPointerDown} onPointerMove={physics.handlers.onPointerMove} onPointerUp={physics.handlers.onPointerUp} onPointerCancel={physics.handlers.onPointerCancel} role="slider" tabIndex={0} aria-label="Vinyl platter — tap to drop the needle, drag to scratch" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(progress * duration)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onTogglePlay();
            }
        }} onDoubleClick={onTogglePlay}/>

        {/* Tonearm overlay — never intercepts pointer input. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Tonearm progress={progress} playing={playing} className="absolute right-0 top-0 h-[72%] w-[72%]"/>
        </div>

        {platterLocked && (<div className="telemetry pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#141413] px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-white">
            Platter Locked
          </div>)}
      </div>

      <div className="flex w-full max-w-[320px] flex-col items-center gap-0.5 px-2 text-center">
        <p className="w-full truncate text-[14px] font-bold tracking-[-0.02em] text-[#141413]">
          {track?.title ?? 'No track loaded'}
        </p>
        <p className="w-full truncate text-[11px] text-[#8C8A84]">
          {track?.artist ?? 'Add a song to begin'}
        </p>
        <p className="telemetry text-[11px] tabular-nums text-[#575653]">
          {formatTime(currentTime)}
          <span className="text-[#C6C3BC]"> / {duration > 0 ? formatTime(duration) : '--:--'}</span>
        </p>
      </div>
    </div>);
}
