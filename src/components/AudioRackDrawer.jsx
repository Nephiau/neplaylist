import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, HardDrive, Lock, RotateCcw, Trash2, Unlock, X } from 'lucide-react';
import { BLOB_BUDGET_BYTES, EQ_FREQUENCIES, EQ_PRESET_LABELS, clamp, } from '../types/neplaylist';
import { estimateCacheUsage } from '../utils/storage';
import { HeadphoneGlyph, SpeakerGlyph } from './vinylGraphics';
const PRESET_ORDER = ['flat', 'warm', 'vocal', 'sub'];
export function AudioRackDrawer({ open, onClose, eqPreset, eqBands, onEqPresetChange, onEqBandChange, replayGainEnabled, preampBoostDb, onToggleReplayGain, onTogglePreamp, platterLocked, onTogglePlatterLock, pitchPercent, onPitchChange, output, onClearLibrary, }) {
    const [usage, setUsage] = useState({ bytes: 0, trackCount: 0 });
    const [confirmClear, setConfirmClear] = useState(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const refreshRef = useRef(output.refresh);
    refreshRef.current = output.refresh;
    useEffect(() => {
        if (!open) {
            setConfirmClear(false);
            return;
        }
        void estimateCacheUsage().then(setUsage);
        void refreshRef.current();
        const onKey = (event) => {
            if (event.key === 'Escape')
                onCloseRef.current();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);
    const usedMb = usage.bytes / (1024 * 1024);
    const budgetPct = clamp((usage.bytes / BLOB_BUDGET_BYTES) * 100, 0, 100);
    return createPortal(<AnimatePresence>
      {open && (<motion.div className="fixed inset-0 z-[65] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <button type="button" aria-label="Close audio rack" onClick={onClose} className="absolute inset-0 bg-[#141413]/20 backdrop-blur-[2px]"/>

          <motion.aside role="dialog" aria-label="Audio rack" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="relative flex h-full w-full max-w-[400px] flex-col overflow-hidden border-l border-[rgba(20,20,19,0.08)] bg-white">
            <div className="flex items-center justify-between border-b border-[rgba(20,20,19,0.07)] px-5 py-4">
              <div>
                <p className="telemetry text-[9px] uppercase tracking-[0.18em] text-[#2563EB]">
                  ❖ Studio Rack
                </p>
                <h2 className="font-display text-[30px] leading-none tracking-[-0.02em] text-[#141413]">
                  Audio <span className="italic">rack</span>
                </h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(20,20,19,0.08)] text-[#575653] transition-colors hover:bg-[#F3F2EE]">
                <X size={15}/>
              </button>
            </div>

            <div className="ne-scroll flex-1 overflow-y-auto px-5 pb-24 pt-4">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#575653]">
                    10-Band Equalizer
                  </h3>
                  <span className="telemetry text-[9px] text-[#8C8A84]">±12 dB</span>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {PRESET_ORDER.map((preset) => {
                const active = eqPreset === preset;
                return (<button key={preset} type="button" onClick={() => onEqPresetChange(preset)} className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${active
                        ? 'bg-[#141413] text-white'
                        : 'bg-[#EFECE6] text-[#575653] hover:bg-[#E6E2DA]'}`}>
                        {EQ_PRESET_LABELS[preset]}
                      </button>);
            })}
                </div>

                <div className="flex items-end justify-between gap-1 rounded-[16px] border border-[rgba(20,20,19,0.07)] bg-[#FBFAF8] px-2 py-3">
                  {EQ_FREQUENCIES.map((freq, index) => (<div key={freq} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="telemetry text-[8px] text-[#8C8A84]">
                        {(eqBands[index] ?? 0) > 0 ? '+' : ''}
                        {(eqBands[index] ?? 0).toFixed(1)}
                      </span>
                      <input type="range" min={-12} max={12} step={0.5} value={eqBands[index] ?? 0} onChange={(event) => onEqBandChange(index, Number.parseFloat(event.target.value))} aria-label={`${freq} hertz band`} className="h-24 w-1 cursor-pointer appearance-none rounded-full bg-[#E2DFD9] accent-[#141413]" style={{ writingMode: 'vertical-lr', direction: 'rtl' }}/>
                      <span className="telemetry text-[8px] text-[#575653]">
                        {freq >= 1000 ? `${freq / 1000}k` : freq}
                      </span>
                    </div>))}
                </div>

                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[#8C8A84]">Preset applied: {EQ_PRESET_LABELS[eqPreset]}</span>
                  <button type="button" onClick={() => onEqPresetChange('flat')} className="flex items-center gap-1 text-[10px] font-medium text-[#575653] hover:text-[#141413]">
                    <RotateCcw size={10}/> Flatten
                  </button>
                </div>
              </section>

              <section className="mt-5">
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#575653]">
                  Loudness
                </h3>
                <div className="flex flex-col gap-1.5">
                  <ToggleRow label="ReplayGain" hint="NaN-safe track gain normalization" active={replayGainEnabled} onToggle={onToggleReplayGain}/>
                  <ToggleRow label="+6 dB Pre-Amp Make-Up" hint="Extra headroom into the safety limiter" active={preampBoostDb === 6} onToggle={onTogglePreamp}/>
                </div>
              </section>

              <section className="mt-5">
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#575653]">
                  Platter
                </h3>
                <button type="button" onClick={onTogglePlatterLock} className="flex w-full items-center justify-between rounded-[12px] border border-[rgba(20,20,19,0.07)] bg-[#FBFAF8] px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    {platterLocked ? <Lock size={13}/> : <Unlock size={13}/>}
                    <span className="flex flex-col items-start">
                      <span className="text-[12px] font-semibold text-[#141413]">Platter Lock</span>
                      <span className="text-[10px] text-[#8C8A84]">
                        Prevent accidental scratch scrubbing
                      </span>
                    </span>
                  </span>
                  <span className="h-5 w-9 rounded-full p-0.5 transition-colors" style={{ background: platterLocked ? 'var(--accent-on-light)' : '#D6D3CD' }}>
                    <span className="block h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: platterLocked ? 'translateX(16px)' : 'translateX(0)' }}/>
                  </span>
                </button>
              </section>

              <section className="mt-5">
                <h3 className="mb-2 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.1em] text-[#575653]">
                  Quartz Pitch
                  <span className="telemetry text-[9px] font-normal tracking-[0.04em] text-[#8C8A84]">
                    ±8%
                  </span>
                </h3>
                <div className="rounded-[12px] border border-[rgba(20,20,19,0.07)] bg-[#FBFAF8] px-3 py-3">
                  <div className="flex items-center gap-2">
                    <input type="range" min={-8} max={8} step={0.1} value={pitchPercent} onChange={(event) => onPitchChange(Number.parseFloat(event.target.value))} onDoubleClick={() => onPitchChange(0)} aria-label="Quartz pitch fader" className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[#D6D3CD] accent-[#141413]"/>
                    <span className="telemetry w-12 shrink-0 text-right text-[11px] font-semibold text-[#141413]">
                      {pitchPercent >= 0 ? '+' : ''}
                      {pitchPercent.toFixed(1)}%
                    </span>
                    <button type="button" onClick={() => onPitchChange(0)} aria-label="Reset pitch" title="Reset pitch" className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#C6C3BC] transition-colors hover:bg-white hover:text-[#575653]">
                      <RotateCcw size={11}/>
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-[1.4] text-[#8C8A84]">
                    Double-click the fader to snap back to 0.0%.
                  </p>
                </div>
              </section>

              <section className="mt-5">
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#575653]">
                  Output Hardware
                </h3>
                <div className="rounded-[12px] border border-[rgba(20,20,19,0.07)] bg-[#FBFAF8] p-2">
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <span className="text-[#141413]">
                      {output.supportsSinkId ? <SpeakerGlyph size={13}/> : <HeadphoneGlyph size={13}/>}
                    </span>
                    <span className="text-[12px] font-semibold text-[#141413]">
                      {output.activeLabel}
                    </span>
                    {output.supportsEnumeration && (<span className="telemetry ml-auto text-[9px] text-[#8C8A84]">
                        {output.devices.length} {output.devices.length === 1 ? 'device' : 'devices'}
                      </span>)}
                  </div>
                  {output.devices.length > 0 && (<div className="flex flex-col gap-0.5">
                      {output.devices.slice(0, 6).map((device) => (<button key={device.deviceId || device.label} type="button" onClick={() => void output.selectDevice(device.deviceId)} className="flex items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-[11px] text-[#575653] transition-colors hover:bg-white">
                          <span className="truncate">{device.label}</span>
                          {device.deviceId === output.activeDeviceId && (<Check size={12} style={{ color: 'var(--accent-on-light)' }}/>)}
                        </button>))}
                    </div>)}
                  {output.devices.length === 0 && (<p className="px-1 pb-1 text-[10px] leading-[1.4] text-[#8C8A84]">
                      {output.supportsEnumeration
                            ? 'No separate outputs detected — using the system default route.'
                            : 'Device enumeration requires a secure context (HTTPS or localhost).'}
                    </p>)}
                  {output.labelsHidden && output.canPromptPermission && (<button type="button" onClick={() => void output.grantAccess()} disabled={output.granting} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#141413] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-60">
                      {output.granting ? 'Checking access…' : 'Allow output device access'}
                    </button>)}
                  {output.gearProfiles.length > 0 && (<>
                      <p className="telemetry px-1 pb-1 pt-2 text-[9px] uppercase tracking-[0.14em] text-[#8C8A84]">
                        Saved Gear
                      </p>
                      <div className="flex flex-wrap gap-1 px-0.5 pb-1">
                        {output.gearProfiles.map((profile) => (<button key={profile.id} type="button" onClick={() => void output.selectDevice(profile.deviceId)} title={`Switch to ${profile.name}`} className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${profile.deviceId === output.activeDeviceId
                                ? 'bg-[#141413] text-white'
                                : 'bg-[#EFECE6] text-[#575653] hover:bg-[#E6E2DA]'}`}>
                            {profile.name}
                          </button>))}
                      </div>
                    </>)}
                  {!output.supportsSinkId && (<p className="px-1 pt-1 text-[10px] leading-[1.4] text-[#8C8A84]">
                      This browser cannot retarget audio output.
                    </p>)}
                  {output.activeDeviceId && output.supportsSinkId && (<button type="button" onClick={() => output.registerGearProfile(output.activeLabel, output.activeDeviceId)} className="mt-0.5 w-full rounded-full px-2 py-1.5 text-[10px] font-semibold text-[#575653] transition-colors hover:bg-white">
                      Save this output as gear
                    </button>)}
                </div>
              </section>

              <section className="mt-5">
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#575653]">
                  Library Cache
                </h3>
                <div className="rounded-[12px] border border-[rgba(20,20,19,0.07)] bg-[#FBFAF8] p-3">
                  <div className="flex items-center gap-2">
                    <HardDrive size={13} className="text-[#575653]"/>
                    <span className="text-[12px] font-semibold text-[#141413]">
                      {usedMb.toFixed(1)} MB cached
                    </span>
                    <span className="telemetry ml-auto text-[9px] text-[#8C8A84]">
                      {usage.trackCount} files
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E2DFD9]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${budgetPct}%`, background: 'var(--accent-on-light)' }}/>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#8C8A84]">
                    {BLOB_BUDGET_BYTES / (1024 * 1024 * 1024)} GB budget • IndexedDB
                  </p>
                </div>
              </section>

              <section className="mt-5">
                <button type="button" onClick={() => {
                if (!confirmClear) {
                    setConfirmClear(true);
                    return;
                }
                onClearLibrary();
                setConfirmClear(false);
            }} className={`flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-[11px] font-semibold transition-colors ${confirmClear
                ? 'border-[#E04F3E] bg-[#E04F3E] text-white'
                : 'border-[rgba(20,20,19,0.12)] text-[#575653] hover:border-[#E04F3E]/40 hover:text-[#E04F3E]'}`}>
                  <Trash2 size={12}/>
                  {confirmClear ? 'Tap again to confirm' : 'Clear Library'}
                </button>
              </section>
            </div>
          </motion.aside>
        </motion.div>)}
    </AnimatePresence>, document.body);
}
function ToggleRow({ label, hint, active, onToggle, }) {
    return (<button type="button" onClick={onToggle} aria-pressed={active} className="flex w-full items-center justify-between rounded-[12px] border border-[rgba(20,20,19,0.07)] bg-[#FBFAF8] px-3 py-2.5 text-left">
      <span className="flex flex-col items-start">
        <span className="text-[12px] font-semibold text-[#141413]">{label}</span>
        <span className="text-[10px] text-[#8C8A84]">{hint}</span>
      </span>
      <span className="h-5 w-9 rounded-full p-0.5 transition-colors" style={{ background: active ? 'var(--accent-on-light)' : '#D6D3CD' }}>
        <span className="block h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: active ? 'translateX(16px)' : 'translateX(0)' }}/>
      </span>
    </button>);
}
