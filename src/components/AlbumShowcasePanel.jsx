import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Heart, Music4, Plus, Trash2 } from 'lucide-react';
import { clamp } from '../types/neplaylist';
function artistHandle(artist) {
    const primary = artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0]?.trim() || artist;
    return primary.replace(/\s+/g, '');
}
function losslessLine(track) {
    if (!track)
        return 'NO SIGNAL';
    return track.codecLabel;
}
export function AlbumShowcasePanel({ albums, activeAlbumKey, onSelectAlbum, onDeleteAlbum, track, clipActive, onOpenArtwork, onOpenLyrics, onAddFiles, favorite, onToggleFavorite, }) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const activeIndex = Math.max(0, albums.findIndex((album) => album.key === activeAlbumKey));
    const activeAlbum = albums[activeIndex];
    const total = albums.length;
    useEffect(() => {
        if (!confirmingDelete)
            return;
        const timer = window.setTimeout(() => setConfirmingDelete(false), 3200);
        return () => window.clearTimeout(timer);
    }, [confirmingDelete]);
    /* Arming the next album must never inherit the previous album's delete state. */
    useEffect(() => {
        setConfirmingDelete(false);
    }, [activeAlbumKey]);
    return (<section className="relative flex min-w-0 flex-col items-center">
      {/* Fanned album sleeve deck */}
      <div className="ne-scroll no-scrollbar w-full overflow-x-auto overflow-y-hidden">
        {albums.length === 0 ? (<div className="flex min-h-[188px] flex-col items-center justify-center gap-2 px-4 pb-4 pt-9 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-[20px] border border-dashed border-[rgba(20,20,19,0.18)] bg-white/60 text-[#8C8A84]">
              <Music4 size={22}/>
            </span>
            <p className="text-[13px] font-semibold text-[#575653]">Your shelf is empty</p>
            <p className="max-w-[240px] text-[11px] leading-[1.5] text-[#8C8A84]">
              Add local FLAC or MP3 files to press your first record.
            </p>
            <button type="button" onClick={onAddFiles} className="mt-1 flex items-center gap-1.5 rounded-full bg-[#141413] px-4 py-2 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95">
              <Plus size={14} strokeWidth={2.6}/>
              Add songs
            </button>
          </div>) : (<div className="flex min-h-[188px] items-center justify-center gap-0 px-4 pb-4 pt-9">
          {albums.map((album, index) => {
                const active = album.key === activeAlbumKey;
                const offset = index - activeIndex;
                const rotate = clamp(offset * 3, -6, 6);
                const lift = active ? -6 : Math.abs(offset) * 2;
                return (<motion.button key={album.key} type="button" onClick={() => onSelectAlbum(album.key)} whileHover={{ y: -8, rotate: 0 }} animate={{ rotate, y: lift, scale: active ? 1 : 0.94 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }} className="relative -ml-6 first:ml-0 shrink-0 rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-4" style={{
                        zIndex: active ? 30 : 10 - Math.abs(offset),
                        border: '2px solid #FFFFFF',
                        boxShadow: '0 18px 36px -10px rgba(20, 20, 19, 0.16)',
                    }} aria-label={`Open album ${album.title}`} aria-pressed={active}>
                <span className="block overflow-hidden rounded-[18px] bg-[#EFECE6]" style={{ width: active ? 150 : 138, height: active ? 150 : 138 }}>
                  {album.tracks[0]?.thumbUrl ? (<img src={album.tracks[0].thumbUrl} alt="" className="h-full w-full object-cover" draggable={false}/>) : (<span className="grid h-full w-full place-items-center text-[#8C8A84]">
                      <Music4 size={24}/>
                    </span>)}
                </span>

                {active && (<span className="pointer-events-none absolute -right-1 -top-4 z-40 flex flex-col items-end">
                    <span className="whitespace-nowrap rounded-full px-3 py-[5px] text-[11px] font-semibold shadow-[0_6px_16px_-6px_rgba(20,20,19,0.3)]" style={{
                            background: 'var(--accent-dynamic)',
                            color: 'var(--accent-dynamic-ink)',
                        }}>
                      @{artistHandle(albumArtistOf(album))}
                    </span>
                    <span className="mr-2 h-0 w-0" style={{
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '6px solid var(--accent-dynamic)',
                        }}/>
                  </span>)}
              </motion.button>);
            })}
        </div>)}
      </div>

      {albums.length > 0 && (<div className="flex w-full max-w-[320px] flex-col items-center gap-1.5 px-2">
        <div className="flex w-full items-center justify-center gap-2">
          <h3 className="truncate text-center text-[20px] font-bold tracking-[-0.03em] text-[#141413] lg:text-[23px]">
            {activeAlbum?.title ?? 'No Album'}
          </h3>
          <button type="button" onClick={onToggleFavorite} aria-pressed={favorite} aria-label="Favorite album" className={`shrink-0 transition-colors ${favorite ? 'text-[#E04F3E]' : 'text-[#C6C3BC] hover:text-[#8C8A84]'}`}>
            <Heart size={14} fill={favorite ? 'currentColor' : 'none'}/>
          </button>
          {activeAlbum && (<button type="button" onClick={() => {
                    if (!confirmingDelete) {
                        setConfirmingDelete(true);
                        return;
                    }
                    setConfirmingDelete(false);
                    onDeleteAlbum(activeAlbum.key);
                }} aria-label={confirmingDelete ? `Confirm delete ${activeAlbum.title}` : `Delete ${activeAlbum.title}`} title={confirmingDelete ? 'Click again to delete album' : 'Delete album'} className={`shrink-0 rounded-full transition-colors ${confirmingDelete
                    ? 'bg-[#E04F3E] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white'
                    : 'text-[#C6C3BC] hover:text-[#E04F3E]'}`}>
              {confirmingDelete ? 'Confirm' : <Trash2 size={13}/>}
            </button>)}
          <span className="telemetry shrink-0 text-[10px] text-[#8C8A84]">
            {activeIndex + 1} / {Math.max(1, total)}
          </span>
        </div>

        <p className="truncate text-center text-[12px] text-[#575653]">
          {activeAlbum?.artist ?? 'Unknown Artist'} • {activeAlbum?.year ?? '—'}
        </p>

        <div className="flex items-center gap-2">
          <span className="telemetry rounded-full border border-[rgba(20,20,19,0.08)] bg-white px-2 py-1 text-[9px] uppercase tracking-[0.06em] text-[#575653]">
            {losslessLine(track)}
          </span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full transition-colors duration-300" style={{
                background: clipActive ? '#F59E0B' : 'rgba(20,20,19,0.12)',
                boxShadow: clipActive ? '0 0 6px rgba(245,158,11,0.8)' : 'none',
            }} title={clipActive ? 'Peak clipping' : 'No clipping'}/>
        </div>

        <p className="line-clamp-2 text-center text-[12px] leading-[1.5] text-[#575653]">
          {track
                ? `${track.title} — released ${track.year || '—'}. ${track.codecLabel}.`
                : 'Drop in a folder of FLAC or MP3 files to begin the listening session.'}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={onOpenArtwork} className="flex items-center gap-1.5 rounded-full bg-[#141413] px-4 py-2.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95">
            See Artwork
            <ChevronRight size={13}/>
          </button>
          <button type="button" onClick={onOpenLyrics} className="flex items-center gap-1.5 rounded-full border border-[rgba(20,20,19,0.1)] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#141413] transition-colors hover:bg-[#F9F8F5]">
            <Music4 size={13}/>
            Synced Lyrics
          </button>
        </div>
      </div>)}

    </section>);
}
function albumArtistOf(album) {
    const artists = new Set(album.tracks.map((entry) => entry.artist.trim() || 'Unknown Artist'));
    return artists.size > 1 ? 'Various Artists' : ([...artists][0] ?? 'Unknown Artist');
}
