import { FolderOpen, ListMusic, PictureInPicture2, Plus, RefreshCw, Search, SlidersHorizontal, } from 'lucide-react';
import { VinylEmblem } from './vinylGraphics';
export function Header({ albums, activeAlbumKey, onSelectAlbum, onUploadFiles, onUploadFolder, onReconnectFolder, needsReconnect, onOpenSearch, onOpenRack, onOpenMiniDeck, onOpenLyrics, showFolderAction, }) {
    return (<header className="relative z-30 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#141413] text-white transition-transform hover:scale-[1.04] active:scale-95" aria-label="NEPlaylist home" onClick={() => albums[0] && onSelectAlbum(albums[0].key)}>
          <VinylEmblem size={18}/>
        </button>
        <span className="truncate text-[19px] font-bold tracking-[-0.03em] text-[#141413] sm:text-[21px]">
          NEPlaylist
          <sup className="ml-0.5 text-[9px] font-medium">®</sup>
        </span>
      </div>

      <div className="hidden min-w-0 items-center gap-1 rounded-full border border-[rgba(20,20,19,0.08)] bg-white/75 p-1 backdrop-blur-md md:flex">
        <div className="no-scrollbar flex max-w-[46vw] items-center gap-1 overflow-x-auto">
          {albums.map((album) => {
            const active = album.key === activeAlbumKey;
            return (<button key={album.key} type="button" onClick={() => onSelectAlbum(album.key)} className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${active ? 'text-[#141413]' : 'text-[#8C8A84] hover:text-[#575653]'}`}>
                {active && (<span className="absolute inset-0 rounded-full bg-white shadow-[0_2px_6px_rgba(20,20,19,0.09)]"/>)}
                <span className="relative block max-w-[150px] truncate">{album.title}</span>
              </button>);
        })}
        </div>
        <button type="button" onClick={onOpenLyrics} className="relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#8C8A84] transition-colors hover:text-[#575653]">
          <ListMusic size={13}/>
          Lyrics
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {needsReconnect && (<button type="button" onClick={onReconnectFolder} className="hidden items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50/80 px-3 py-2 text-[12px] font-semibold text-[#8a5a12] backdrop-blur-md transition-colors hover:bg-amber-100/80 sm:flex">
            <RefreshCw size={13}/>
            Reconnect Folder
          </button>)}

        {showFolderAction && (<button type="button" onClick={onUploadFolder} className="hidden items-center gap-1.5 rounded-full border border-[rgba(20,20,19,0.1)] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#141413] transition-colors hover:bg-[#F3F2EE] md:flex">
            <FolderOpen size={13}/>
            Folder
          </button>)}

        <button type="button" onClick={onUploadFiles} className="flex items-center gap-1.5 rounded-full bg-[#141413] px-3.5 py-2 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95">
          <Plus size={14} strokeWidth={2.6}/>
          Files
        </button>

        {needsReconnect && (<button type="button" onClick={onReconnectFolder} aria-label="Reconnect folder" className="grid h-9 w-9 place-items-center rounded-full border border-amber-400/50 bg-amber-50/80 text-[#8a5a12] backdrop-blur-md sm:hidden">
            <RefreshCw size={14}/>
          </button>)}

        <button type="button" onClick={onOpenMiniDeck} aria-label="Open mini turntable" className="hidden h-9 w-9 place-items-center rounded-full border border-[rgba(20,20,19,0.08)] bg-white text-[#141413] transition-colors hover:bg-[#F3F2EE] sm:grid">
          <PictureInPicture2 size={15}/>
        </button>

        <button type="button" onClick={onOpenSearch} aria-label="Search library" className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(20,20,19,0.08)] bg-white text-[#141413] transition-colors hover:bg-[#F3F2EE]">
          <Search size={15}/>
        </button>

        <button type="button" onClick={onOpenRack} aria-label="Open audio rack" className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(20,20,19,0.08)] bg-white text-[#141413] transition-colors hover:bg-[#F3F2EE]">
          <SlidersHorizontal size={15}/>
        </button>
      </div>
    </header>);
}
