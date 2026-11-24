import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { effectiveBpm, formatTime } from '../types/neplaylist';
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'flac', label: 'Lossless FLAC' },
    { key: 'chill', label: 'Chill' },
    { key: 'upbeat', label: 'Upbeat' },
];
function matchesFilter(track, filter) {
    const bpm = effectiveBpm(track.bpm);
    switch (filter) {
        case 'flac':
            return track.codecLabel.toUpperCase().includes('FLAC');
        case 'chill':
            return bpm < 95;
        case 'upbeat':
            return bpm > 120;
        default:
            return true;
    }
}
export function SearchModal({ open, onClose, tracks, onSelectTrack }) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const inputRef = useRef(null);
    useEffect(() => {
        if (open) {
            setQuery('');
            setFilter('all');
            const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
            return () => window.clearTimeout(timer);
        }
    }, [open]);
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
    const results = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return tracks
            .filter((track) => matchesFilter(track, filter))
            .filter((track) => {
            if (!needle)
                return true;
            return (track.title.toLowerCase().includes(needle) ||
                track.artist.toLowerCase().includes(needle) ||
                track.album.toLowerCase().includes(needle));
        })
            .slice(0, 40);
    }, [tracks, query, filter]);
    return createPortal(<AnimatePresence>
      {open && (<motion.div className="fixed inset-0 z-[69] flex items-start justify-center px-3 pt-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-[#141413]/20 backdrop-blur-[3px]"/>

          <motion.div role="dialog" aria-label="Search library" initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="relative w-full max-w-[560px] overflow-hidden rounded-[22px] border border-[rgba(20,20,19,0.09)] bg-white shadow-[0_30px_70px_-20px_rgba(20,20,19,0.35)]">
            <div className="flex items-center gap-2.5 border-b border-[rgba(20,20,19,0.07)] px-4 py-3">
              <Search size={16} className="shrink-0 text-[#8C8A84]"/>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tracks, artists, albums…" aria-label="Search query" className="min-w-0 flex-1 bg-transparent text-[14px] text-[#141413] outline-none placeholder:text-[#B6B3AC]"/>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#8C8A84] hover:bg-[#F3F2EE]">
                <X size={14}/>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-[rgba(20,20,19,0.07)] px-4 py-2.5">
              {FILTERS.map((chip) => {
                const active = filter === chip.key;
                return (<button key={chip.key} type="button" onClick={() => setFilter(chip.key)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${active
                        ? 'bg-[#141413] text-white'
                        : 'bg-[#EFECE6] text-[#575653] hover:bg-[#E6E2DA]'}`}>
                    {chip.label}
                  </button>);
            })}
            </div>

            <div className="ne-scroll max-h-[50dvh] overflow-y-auto p-1.5">
              {results.length === 0 ? (<p className="px-3 py-8 text-center text-[12px] text-[#8C8A84]">
                  No tracks match “{query}”.
                </p>) : (results.map((track) => (<button key={track.id} type="button" onClick={() => {
                    onSelectTrack(track.id);
                    onClose();
                }} className="flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-[#F7F6F2]">
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[#EFECE6]">
                      {track.thumbUrl ? (<img src={track.thumbUrl} alt="" className="h-full w-full object-cover"/>) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[#141413]">
                        {track.title}
                      </span>
                      <span className="block truncate text-[11px] text-[#8C8A84]">
                        {track.artist} • {track.album}
                      </span>
                    </span>
                    <span className="telemetry shrink-0 text-[10px] text-[#8C8A84]">
                      {track.year || '—'}
                    </span>
                    <span className="telemetry w-10 shrink-0 text-right text-[10px] text-[#8C8A84]">
                      {track.duration > 0 ? formatTime(track.duration) : '--:--'}
                    </span>
                  </button>)))}
            </div>
          </motion.div>
        </motion.div>)}
    </AnimatePresence>, document.body);
}
