import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Heart, Plus, X } from 'lucide-react';
import { formatTime } from '../types/neplaylist';
function TrackRow({ track, index, active, isNext, isPlaying, onSelect, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: track.id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20 : undefined,
    };
    return (<div ref={setNodeRef} style={style} className="relative">
      {active && (<motion.div layoutId="active-track-studio-frame" className="pointer-events-none absolute inset-0 rounded-[14px]" style={{ border: '1.5px solid var(--studio-blue)' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}>
          {[
                'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
                'right-0 top-0 translate-x-1/2 -translate-y-1/2',
                'left-0 bottom-0 -translate-x-1/2 translate-y-1/2',
                'right-0 bottom-0 translate-x-1/2 translate-y-1/2',
            ].map((position) => (<span key={position} className={`pointer-events-none absolute ${position} h-[5px] w-[5px] rounded-[1px] bg-white`} style={{ border: '1.5px solid var(--studio-blue)' }}/>))}
        </motion.div>)}

      <div className={`group relative flex min-h-[52px] items-center gap-2 rounded-[14px] px-2 py-1.5 transition-colors sm:min-h-[48px] ${active ? 'bg-white shadow-[0_4px_14px_-6px_rgba(20,20,19,0.16)]' : 'hover:bg-white/60'}`}>
        <button type="button" className="grid h-9 w-5 shrink-0 cursor-grab place-items-center text-[#C6C3BC] transition-colors hover:text-[#8C8A84] active:cursor-grabbing" style={{ touchAction: 'none' }} aria-label={`Reorder ${track.title}`} {...attributes} {...listeners}>
          <GripVertical size={14}/>
        </button>

        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className="telemetry w-6 shrink-0 text-[11px] text-[#8C8A84]">
            {String(index + 1).padStart(2, '0')}
          </span>

          <span className="relative h-[38px] w-[38px] shrink-0 overflow-hidden rounded-[10px] bg-[#EFECE6]">
            {track.thumbUrl ? (<img src={track.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false}/>) : null}
            {active && (<span className="absolute inset-0 grid place-items-center bg-black/35">
                <span className={`h-2 w-2 rounded-full ${isPlaying ? 'animate-pulse-dot' : ''}`} style={{ background: 'var(--accent-on-light)' }}/>
              </span>)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-[#141413]">{track.title}</span>
              {isNext && (<span className="telemetry shrink-0 rounded-full px-1.5 py-[1px] text-[8px] uppercase tracking-[0.1em] text-white" style={{ background: 'var(--accent-on-light)' }}>
                  Up Next
                </span>)}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[#8C8A84]">
              <span className="truncate">{track.artist}</span>
              <span className="text-[#C6C3BC]">•</span>
              <span className="telemetry shrink-0">{track.year || '—'}</span>
              <span className="text-[#C6C3BC]">•</span>
              <span className="telemetry shrink-0">{track.codecLabel.split(' • ')[0]}</span>
              {track.needsRelink && (<span className="shrink-0 rounded-full border border-amber-400/60 bg-amber-50 px-1.5 py-[1px] text-[9px] font-semibold text-[#8a5a12]">
                  Re-link
                </span>)}
            </span>
          </span>

          <span className="telemetry shrink-0 text-[11px] text-[#8C8A84]">
            {track.duration > 0 ? formatTime(track.duration) : '--:--'}
          </span>
        </button>

        <button type="button" onClick={onDelete} aria-label="Remove song" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#C6C3BC] transition-colors hover:bg-[#F3F2EE] hover:text-[#141413] sm:h-8 sm:w-8">
          <X size={13}/>
        </button>
      </div>
    </div>);
}
export function TrackListPanel({ tracks, allTracksInAlbum, activeTrackId, isPlaying, albumTitle, albumArtist, shuffle, nextTrackId, onSelectTrack, onDeleteTrack, onReorder, onAddFiles, favorite, onToggleFavorite, }) {
    const idRef = useRef([]);
    const [collapsed, setCollapsed] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    idRef.current = tracks.map((track) => track.id);
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const ids = idRef.current;
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1)
            return;
        const reordered = arrayMove(ids, oldIndex, newIndex);
        const albumIds = new Set(allTracksInAlbum.map((track) => track.id));
        const orderedForAlbum = reordered.filter((id) => albumIds.has(id));
        onReorder(orderedForAlbum);
    };
    return (<section className="glass-card relative flex min-h-0 flex-col overflow-hidden rounded-[24px]">
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="telemetry flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#2563EB]">
          <span aria-hidden="true">❖</span>
          Vinyl Pressing • Queue
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={onToggleFavorite} aria-pressed={favorite} aria-label="Favorite album" className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${favorite ? 'text-[#E04F3E]' : 'text-[#C6C3BC] hover:text-[#8C8A84]'}`}>
            <Heart size={14} fill={favorite ? 'currentColor' : 'none'}/>
          </button>
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand playlist panel' : 'Minimize playlist panel'} title={collapsed ? 'Expand playlist' : 'Minimize playlist'} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#C6C3BC] transition-colors hover:bg-[#EFECE6] hover:text-[#575653]">
            {collapsed ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 px-4 pb-1">
        <h2 className={`font-display tracking-[-0.02em] text-[#141413] ${collapsed ? 'text-[30px] leading-[1]' : 'text-[52px] leading-[0.92] lg:text-[62px]'}`}>
          Album <span className="italic">tracks</span>
        </h2>
        <div className="pb-2 text-right">
          <p className="max-w-[130px] truncate text-[11px] font-semibold text-[#575653]">{albumTitle}</p>
          <p className="max-w-[130px] truncate text-[10px] text-[#8C8A84]">{albumArtist}</p>
        </div>
      </div>

      {!collapsed && (<>
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        <div className="flex items-center gap-0.5 rounded-full bg-[#EFECE6] p-0.5">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#141413] shadow-[0_1px_4px_rgba(20,20,19,0.1)]">
            All tracks
            <span className="telemetry ml-1 text-[9px] opacity-60">{tracks.length}</span>
          </span>
        </div>

        {shuffle && (<span className="telemetry rounded-full bg-[#141413] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-white">
            Shuffle
          </span>)}
      </div>

      <div className="ne-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-[124px] sm:pb-[140px]" style={{ maxHeight: 'calc(100dvh - 300px)' }}>
        {tracks.length === 0 ? (<div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-[#575653]">No tracks yet</p>
            <p className="max-w-[220px] text-[11px] leading-[1.5] text-[#8C8A84]">
              Add FLAC or MP3 files to build your first pressing.
            </p>
            <button type="button" onClick={onAddFiles} className="mt-1 flex items-center gap-1.5 rounded-full bg-[#141413] px-4 py-2 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95">
              <Plus size={14} strokeWidth={2.6}/>
              Add songs
            </button>
          </div>) : (<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={idRef.current} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-0.5">
                <AnimatePresence initial={false}>
                  {tracks.map((track, index) => (<TrackRow key={track.id} track={track} index={index} active={track.id === activeTrackId} isNext={shuffle && track.id === nextTrackId} isPlaying={isPlaying} onSelect={() => onSelectTrack(track.id)} onDelete={() => onDeleteTrack(track.id)}/>))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>)}
      </div>
        </>)}

      {!collapsed && (<div className="pointer-events-none absolute bottom-3 right-3">
          <div className="telemetry rounded-full border border-[rgba(20,20,19,0.08)] bg-white/90 px-2 py-1 text-[9px] text-[#8C8A84] backdrop-blur-md">
            {tracks.length} TRACK{tracks.length === 1 ? '' : 'S'}
          </div>
        </div>)}
    </section>);
}
