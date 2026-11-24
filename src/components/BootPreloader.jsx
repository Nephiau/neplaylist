import { motion } from 'motion/react';
import { GroovedDisc } from './vinylGraphics';
export function BootPreloader({ status, exiting }) {
    return (<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8" style={{
            background: '#F7F6F2',
            pointerEvents: exiting ? 'none' : 'auto',
            opacity: exiting ? 0 : 1,
            transition: 'opacity 280ms ease',
        }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
            backgroundImage: 'radial-gradient(rgba(20, 20, 19, 0.085) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
        }}/>

      <motion.div layoutId="neplaylist-platter-morph" style={{ borderRadius: 9999 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="relative flex items-center justify-center">
        <div className="animate-spin-vinyl">
          <GroovedDisc size={210}/>
        </div>
      </motion.div>

      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-bold tracking-[-0.03em] text-[#141413]">
            NEPlaylist
            <sup className="ml-0.5 text-[9px] font-medium">®</sup>
          </span>
        </div>
        <div className="telemetry rounded-full border border-[rgba(20,20,19,0.08)] bg-white/70 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#575653]">
          {status}
        </div>
      </div>
    </div>);
}
