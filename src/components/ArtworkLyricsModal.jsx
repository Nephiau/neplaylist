import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Minus, Plus, X } from 'lucide-react';
import { clamp, formatTime, hashString } from '../types/neplaylist';
import { loadImage } from '../utils/colorExtractor';
function drawVectorSleeve(ctx, width, height, seed, accent) {
    const hash = hashString(seed);
    const hue = hash % 360;
    ctx.fillStyle = '#F7F6F2';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(20, 20, 19, 0.085)';
    for (let x = 22; x < width; x += 22) {
        for (let y = 22; y < height; y += 22) {
            ctx.fillRect(x, y, 1.4, 1.4);
        }
    }
    const cx = width / 2;
    const cy = height * 0.42;
    const radius = Math.min(width, height) * 0.24;
    for (let i = 0; i < 9; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1 + i * 0.055), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(20, 20, 19, ${0.16 - i * 0.012})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#141413';
    ctx.fill();
    for (let i = 0; i < 22; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (0.36 + i * 0.028), 0, Math.PI * 2);
        ctx.strokeStyle = i % 4 === 0 ? 'rgba(247, 246, 242, 0.16)' : 'rgba(247, 246, 242, 0.06)';
        ctx.lineWidth = i % 4 === 0 ? 1.1 : 0.6;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.34 * 0.82, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(20,20,19,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0C0F';
    ctx.fill();
    ctx.fillStyle = `hsla(${hue}, 58%, 52%, 0.1)`;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(20,20,19,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(64, 64, 46, 46);
    ctx.strokeRect(width - 110, height - 110, 46, 46);
}
async function exportStudioCard(track, accentHex, accentInkHex) {
    const width = 1080;
    const height = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    ctx.fillStyle = '#F7F6F2';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(20, 20, 19, 0.085)';
    for (let x = 24; x < width; x += 24) {
        for (let y = 24; y < height; y += 24) {
            ctx.fillRect(x, y, 1.6, 1.6);
        }
    }
    const artX = 90;
    const artY = 150;
    const artSize = 900;
    let drewArt = false;
    if (track?.fullArtUrl) {
        const img = await loadImage(track.fullArtUrl);
        if (img && img.complete && img.naturalWidth > 0) {
            try {
                ctx.drawImage(img, artX, artY, artSize, artSize);
                drewArt = true;
            }
            catch {
                drewArt = false;
            }
        }
    }
    if (!drewArt && track?.thumbUrl) {
        const img = await loadImage(track.thumbUrl);
        if (img && img.complete && img.naturalWidth > 0) {
            try {
                ctx.drawImage(img, artX, artY, artSize, artSize);
                drewArt = true;
            }
            catch {
                drewArt = false;
            }
        }
    }
    if (!drewArt) {
        ctx.save();
        ctx.translate(artX, artY);
        ctx.beginPath();
        ctx.rect(0, 0, artSize, artSize);
        ctx.clip();
        const sleeve = document.createElement('canvas');
        sleeve.width = artSize;
        sleeve.height = artSize;
        const sleeveCtx = sleeve.getContext('2d');
        if (sleeveCtx) {
            drawVectorSleeve(sleeveCtx, artSize, artSize, track?.id ?? 'neplaylist', accentHex);
            ctx.drawImage(sleeve, 0, 0);
        }
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(20, 20, 19, 0.09)';
    ctx.lineWidth = 2;
    ctx.strokeRect(artX, artY, artSize, artSize);
    /* Spinning vinyl peek overlapping the sleeve's bottom-left corner. */
    const discCx = artX + 40;
    const discCy = artY + artSize - 20;
    const discR = 120;
    ctx.beginPath();
    ctx.arc(discCx, discCy, discR, 0, Math.PI * 2);
    ctx.fillStyle = '#141413';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(discCx, discCy, discR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 1; i <= 8; i += 1) {
        ctx.beginPath();
        ctx.arc(discCx, discCy, discR * (0.2 + i * 0.09), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(discCx, discCy, discR * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = accentHex;
    ctx.fill();
    const title = track?.title ?? 'No Track Loaded';
    ctx.fillStyle = '#141413';
    ctx.font = '400 62px "Instrument Serif", Georgia, serif';
    ctx.textAlign = 'left';
    let fitted = title;
    while (ctx.measureText(fitted).width > 900 && fitted.length > 8) {
        fitted = `${fitted.slice(0, -2)}…`;
    }
    ctx.fillText(fitted, 90, 1145);
    ctx.fillStyle = '#575653';
    ctx.font = '500 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${track?.artist ?? '—'}  •  ${track?.year ?? '—'}`, 90, 1192);
    const badge = track?.codecLabel ?? 'NO SIGNAL';
    ctx.font = '500 24px "JetBrains Mono", monospace';
    const badgeWidth = ctx.measureText(badge).width + 40;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    const badgeY = 1225;
    const badgeH = 52;
    const r = badgeH / 2;
    ctx.moveTo(90 + r, badgeY);
    ctx.arcTo(90 + badgeWidth, badgeY, 90 + badgeWidth, badgeY + badgeH, r);
    ctx.arcTo(90 + badgeWidth, badgeY + badgeH, 90, badgeY + badgeH, r);
    ctx.arcTo(90, badgeY + badgeH, 90, badgeY, r);
    ctx.arcTo(90, badgeY, 90 + badgeWidth, badgeY, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,19,0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#141413';
    ctx.fillText(badge, 110, badgeY + 35);
    /* Accent swatches. */
    const swatches = [accentHex, accentInkHex, '#141413', '#F7F6F2'];
    swatches.forEach((color, index) => {
        ctx.beginPath();
        ctx.arc(90 + badgeWidth + 60 + index * 54, 1251, 19, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,19,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
    ctx.fillStyle = '#8C8A84';
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('NEPLAYLIST®', width - 90, 1145);
    ctx.fillText('HIGH FIDELITY', width - 90, 1176);
    const blob = await new Promise((resolve) => {
        try {
            canvas.toBlob((result) => resolve(result), 'image/png');
        }
        catch {
            resolve(null);
        }
    });
    if (!blob)
        return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `neplaylist-${(track?.title ?? 'studio').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function ArtworkLyricsModal({ open, onClose, track, currentTime, duration, lyricOffsetSec, onLyricOffsetChange, onSeek, accentHex, accentInkHex, accentOnLightHex, }) {
    const [exporting, setExporting] = useState(false);
    const activeLineRef = useRef(null);
    const lyrics = track?.lyrics ?? [];
    const timedDuration = duration > 0 ? duration : (track?.duration ?? 0);
    const adjustedTime = currentTime + lyricOffsetSec;
    const activeIndex = useMemo(() => {
        if (!lyrics.some((line) => line.timeSec !== null))
            return -1;
        let found = -1;
        lyrics.forEach((line, index) => {
            if (line.timeSec !== null && line.timeSec <= adjustedTime)
                found = index;
        });
        return found;
    }, [lyrics, adjustedTime]);
    useEffect(() => {
        if (!open || !activeLineRef.current)
            return;
        activeLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [open, activeIndex]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    const handleExport = async () => {
        setExporting(true);
        try {
            await exportStudioCard(track, accentHex, accentInkHex);
        }
        finally {
            setExporting(false);
        }
    };
    return createPortal(<AnimatePresence>
      {open && (<motion.div className="fixed inset-0 z-[68] flex items-center justify-center p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <button type="button" aria-label="Close artwork and lyrics" onClick={onClose} className="absolute inset-0 bg-[#141413]/25 backdrop-blur-[3px]"/>

          <motion.div role="dialog" aria-label="Artwork and synced lyrics" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ type: 'spring', stiffness: 280, damping: 30 }} className="relative flex max-h-[92dvh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[24px] border border-[rgba(20,20,19,0.08)] bg-[#FBFAF8] shadow-[0_30px_80px_-20px_rgba(20,20,19,0.35)] md:flex-row">
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#575653] shadow-sm transition-colors hover:bg-white">
              <X size={15}/>
            </button>

            <div className="flex min-h-0 flex-col items-center gap-3 border-b border-[rgba(20,20,19,0.07)] p-5 md:w-[47%] md:border-b-0 md:border-r">
              <div className="relative w-full max-w-[300px]">
                <div className="aspect-square w-full overflow-hidden rounded-[18px] bg-[#EFECE6] shadow-[0_18px_36px_-12px_rgba(20,20,19,0.22)]">
                  {track?.thumbUrl ? (<img src={track?.fullArtUrl ?? track.thumbUrl} alt={`${track?.title ?? 'Album'} artwork`} className="h-full w-full object-cover"/>) : (<div className="grid h-full w-full place-items-center" style={{ background: `linear-gradient(135deg, ${accentHex}22, #EFECE6)` }}>
                      <span className="h-16 w-16 rounded-full" style={{ background: accentHex }}/>
                    </div>)}
                </div>
              </div>

              <div className="w-full max-w-[300px] text-center">
                <h3 className="truncate text-[17px] font-bold tracking-[-0.02em] text-[#141413]">
                  {track?.title ?? 'No Track'}
                </h3>
                <p className="truncate text-[12px] text-[#575653]">
                  {track?.artist ?? '—'} • {track?.album ?? '—'}
                </p>
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <span className="telemetry rounded-full border border-[rgba(20,20,19,0.08)] bg-white px-2 py-0.5 text-[9px] text-[#575653]">
                    {track?.codecLabel ?? 'NO SIGNAL'}
                  </span>
                  <span className="telemetry text-[9px] text-[#8C8A84]">
                    {track?.year ?? '—'}
                  </span>
                </div>

                <button type="button" onClick={() => void handleExport()} disabled={exporting} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#141413] px-3 py-2.5 text-[11px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60">
                  <Download size={12}/>
                  {exporting ? 'Rendering card…' : 'Export Studio Card (PNG)'}
                </button>
                <p className="mt-1 text-[9px] text-[#8C8A84]">1080 × 1350 • alabaster gallery card</p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 px-5 pt-4">
                <div>
                  <p className="telemetry text-[9px] uppercase tracking-[0.18em] text-[#2563EB]">
                    ❖ Synced Lyrics
                  </p>
                  <p className="telemetry mt-0.5 text-[10px] text-[#8C8A84]">
                    {formatTime(Math.max(0, adjustedTime))} / {formatTime(timedDuration)}
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-[rgba(20,20,19,0.08)] bg-white px-1.5 py-1">
                  <span className="telemetry px-1 text-[8px] uppercase tracking-[0.1em] text-[#8C8A84]">
                    Offset
                  </span>
                  <button type="button" onClick={() => onLyricOffsetChange(clamp(lyricOffsetSec - 0.2, -2, 2))} aria-label="Decrease lyric offset" className="grid h-5 w-5 place-items-center rounded-full text-[#575653] hover:bg-[#F3F2EE]">
                    <Minus size={10}/>
                  </button>
                  <span className="telemetry w-9 text-center text-[10px] text-[#141413]">
                    {lyricOffsetSec >= 0 ? '+' : ''}
                    {lyricOffsetSec.toFixed(1)}s
                  </span>
                  <button type="button" onClick={() => onLyricOffsetChange(clamp(lyricOffsetSec + 0.2, -2, 2))} aria-label="Increase lyric offset" className="grid h-5 w-5 place-items-center rounded-full text-[#575653] hover:bg-[#F3F2EE]">
                    <Plus size={10}/>
                  </button>
                </div>
              </div>

              <div className="ne-scroll min-h-[200px] flex-1 overflow-y-auto px-5 py-4">
                {lyrics.length === 0 ? (<p className="py-10 text-center text-[12px] text-[#8C8A84]">
                    No lyrics for this pressing. Drop a matching <code>.lrc</code> file alongside the
                    audio to sync verses.
                  </p>) : (<div className="flex flex-col gap-2.5">
                    {lyrics.map((line, index) => {
                    const active = index === activeIndex;
                    const hasTime = line.timeSec !== null;
                    return (<button key={`${index}-${line.text}`} ref={active ? activeLineRef : undefined} type="button" onClick={() => {
                            if (hasTime)
                                onSeek(line.timeSec);
                        }} disabled={!hasTime} className={`group flex items-start gap-2.5 rounded-lg px-1 py-1 text-left transition-colors ${hasTime ? 'hover:bg-white/70' : 'cursor-default'}`}>
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full transition-colors" style={{
                            background: active ? accentOnLightHex : 'transparent',
                        }}/>
                          <span className={`font-display text-[21px] leading-[1.35] transition-colors ${active
                            ? 'italic text-[#141413]'
                            : 'text-[#9E9C96] group-hover:text-[#575653]'}`}>
                            {line.text || '♪'}
                          </span>
                        </button>);
                })}
                  </div>)}
              </div>
            </div>
          </motion.div>
        </motion.div>)}
    </AnimatePresence>, document.body);
}
