import { useCallback, useEffect, useRef, useState } from 'react';
const BOILERPLATE_PREFIXES = [
    /^default\s*[-–—]\s*/i,
    /^communications\s*[-–—]\s*/i,
    /^default\s+/i,
];
const BOILERPLATE_SUFFIXES = [/\s*\((?:bluetooth|usb|hdmi|displayport|realtek|default)\)\s*$/i];
export function cleanDeviceLabel(raw) {
    if (!raw)
        return '';
    let label = raw.trim();
    for (const pattern of BOILERPLATE_PREFIXES)
        label = label.replace(pattern, '');
    for (const pattern of BOILERPLATE_SUFFIXES)
        label = label.replace(pattern, '');
    label = label.replace(/\s*[-–—]\s*$/, '').trim();
    const parenthesized = label.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parenthesized) {
        const inner = parenthesized[2].trim();
        if (/^(realtek|intel|nvidia|amd|default|primary)/i.test(inner))
            return inner;
        return inner || parenthesized[1].trim();
    }
    return label || raw.trim();
}
export function useOutputDevice(options) {
    const { audioElement, audioContext, engineReady = true, savedDeviceId, onDeviceIdChange, gearProfiles, onGearProfilesChange, } = options;
    const [devices, setDevices] = useState([]);
    const [activeDeviceId, setActiveDeviceId] = useState(savedDeviceId || '');
    const [fallbackNotice, setFallbackNotice] = useState(false);
    const [granting, setGranting] = useState(false);
    const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    const supportsEnumeration = Boolean(isSecure && mediaDevices?.enumerateDevices);
    const canPromptPermission = Boolean(isSecure && mediaDevices?.selectAudioOutput);
    /* Playback is routed through the Web Audio graph, so the audio element's
       own sink is bypassed. Moving the sound only works when the AudioContext
       itself can retarget — element-level setSinkId would be a silent no-op. */
    const supportsSinkId = Boolean(isSecure &&
        typeof AudioContext !== 'undefined' &&
        'setSinkId' in AudioContext.prototype);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const onDeviceIdChangeRef = useRef(onDeviceIdChange);
    onDeviceIdChangeRef.current = onDeviceIdChange;
    const applySink = useCallback(async (deviceId) => {
        const ctx = optionsRef.current.audioContext;
        const element = optionsRef.current.audioElement;
        const id = deviceId || '';
        if (ctx && typeof ctx.setSinkId === 'function') {
            try {
                await ctx.setSinkId(id);
            }
            catch {
                return false;
            }
            return true;
        }
        if (!ctx && element && typeof element.setSinkId === 'function') {
            try {
                await element.setSinkId(id);
                return true;
            }
            catch {
                return false;
            }
        }
        return false;
    }, []);
    const refresh = useCallback(async () => {
        if (!supportsEnumeration || !mediaDevices) {
            setDevices((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        try {
            const list = await mediaDevices.enumerateDevices();
            const outputs = list
                .filter((device) => device.kind === 'audiooutput')
                .map((device, index) => ({
                deviceId: device.deviceId,
                hasLabel: Boolean(device.label && device.label.trim()),
                label: cleanDeviceLabel(device.label) ||
                    (device.deviceId === 'default' ? 'System Default Output' : `Output ${index + 1}`),
            }));
            setDevices((prev) => {
                if (prev.length === outputs.length) {
                    const same = prev.every((device, index) => device.deviceId === outputs[index]?.deviceId &&
                        device.label === outputs[index]?.label &&
                        device.hasLabel === outputs[index]?.hasLabel);
                    if (same)
                        return prev;
                }
                return outputs;
            });
            const current = optionsRef.current.savedDeviceId;
            if (current && current !== 'default' && !outputs.some((device) => device.deviceId === current)) {
                setFallbackNotice(true);
                setActiveDeviceId('');
                onDeviceIdChangeRef.current('');
                void applySink('');
            }
        }
        catch {
            setDevices((prev) => (prev.length === 0 ? prev : []));
        }
    }, [supportsEnumeration, mediaDevices, applySink]);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    useEffect(() => {
        if (!supportsEnumeration || !mediaDevices?.addEventListener)
            return;
        const handler = () => {
            void refresh();
        };
        mediaDevices.addEventListener('devicechange', handler);
        return () => mediaDevices.removeEventListener('devicechange', handler);
    }, [supportsEnumeration, mediaDevices, refresh]);
    /* Re-apply the saved sink once the AudioContext actually exists. */
    useEffect(() => {
        if (!engineReady || !supportsSinkId)
            return;
        void applySink(savedDeviceId);
    }, [engineReady, savedDeviceId, supportsSinkId, applySink]);
    const selectDevice = useCallback(async (deviceId) => {
        const id = deviceId || '';
        if (!supportsSinkId) {
            setFallbackNotice(true);
            return false;
        }
        const success = await applySink(id);
        if (!success) {
            setFallbackNotice(true);
            setActiveDeviceId('');
            onDeviceIdChangeRef.current('');
            return false;
        }
        setFallbackNotice(false);
        setActiveDeviceId(id);
        onDeviceIdChangeRef.current(id);
        return true;
    }, [applySink, supportsSinkId]);
    /* Output device names are withheld until the page holds media permission.
       selectAudioOutput() is the spec-blessed gesture that both grants access
       and authorises a non-default sink. */
    const grantAccess = useCallback(async () => {
        if (!canPromptPermission || !mediaDevices?.selectAudioOutput)
            return null;
        setGranting(true);
        try {
            const device = await mediaDevices.selectAudioOutput();
            await refresh();
            if (device?.deviceId && supportsSinkId) {
                const success = await applySink(device.deviceId);
                if (success) {
                    setFallbackNotice(false);
                    setActiveDeviceId(device.deviceId);
                    onDeviceIdChangeRef.current(device.deviceId);
                }
            }
            return device ?? null;
        }
        catch {
            return null;
        }
        finally {
            setGranting(false);
        }
    }, [canPromptPermission, mediaDevices, refresh, applySink, supportsSinkId]);
    const gearProfilesRef = useRef(gearProfiles);
    gearProfilesRef.current = gearProfiles;
    const onGearProfilesChangeRef = useRef(onGearProfilesChange);
    onGearProfilesChangeRef.current = onGearProfilesChange;
    const registerGearProfile = useCallback((label, deviceId) => {
        const name = cleanDeviceLabel(label);
        if (!name)
            return;
        const current = gearProfilesRef.current;
        const existing = current.find((profile) => profile.name === name);
        if (existing) {
            onGearProfilesChangeRef.current(current.map((profile) => profile.id === existing.id ? { ...profile, deviceId } : profile));
            return;
        }
        onGearProfilesChangeRef.current([
            ...current,
            {
                id: `gear_${Date.now().toString(36)}`,
                name,
                deviceId,
                createdAt: Date.now(),
            },
        ]);
    }, []);
    const activeOption = devices.find((device) => device.deviceId === activeDeviceId);
    const activeLabel = activeOption?.label || (activeDeviceId ? 'Selected Output' : 'System Default Output');
    const labelsHidden = devices.length > 0 && devices.every((device) => !device.hasLabel);
    return {
        devices,
        activeDeviceId,
        activeLabel,
        supportsEnumeration,
        supportsSinkId,
        canPromptPermission,
        labelsHidden,
        granting,
        grantAccess,
        isSecure,
        fallbackNotice,
        refresh,
        selectDevice,
        registerGearProfile,
        gearProfiles,
    };
}
