export const BLOB_BUDGET_BYTES = 1024 * 1024 * 1024;
export const MAX_BPM_DECODE_BYTES = 35000000;
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    warm: [3.5, 2.5, 1.5, 0.5, 0, -0.5, -1.0, -1.5, -2.5, -3.5],
    vocal: [-1.5, -1.0, 0, 1.0, 2.5, 3.5, 3.0, 1.5, 0.5, 0],
    sub: [6.0, 4.5, 2.5, 0.5, 0, 0, 0, 0.5, 1.0, 1.5],
};
export const EQ_PRESET_LABELS = {
    flat: 'Reference Flat',
    warm: 'Warm Vinyl',
    vocal: 'Vocal Clarity',
    sub: 'Sub-Bass',
};
export const DEFAULT_ACCENTS = {
    accentHex: '#E04F3E',
    accentInkHex: '#FFFFFF',
    accentOnLightHex: '#D43D2C',
};
export function clamp(value, min, max) {
    if (!Number.isFinite(value))
        return min;
    return Math.min(max, Math.max(min, value));
}
export function effectiveBpm(bpm) {
    return Number.isFinite(bpm) && bpm > 0 ? bpm : 110;
}
export function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0)
        return '--:--';
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
export function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    }
    return hash >>> 0;
}
export function makeCoverDataUrl(seed, label, sub) {
    const hash = hashString(seed || 'neplaylist');
    const hueA = hash % 360;
    const hueB = (hueA + 48 + (hash >> 8) % 90) % 360;
    const ringCount = 5 + (hash >> 5) % 4;
    const rings = Array.from({ length: ringCount }, (_, i) => {
        const r = 70 + i * 30;
        const opacity = (0.16 + (i % 3) * 0.09).toFixed(2);
        return `<circle cx="300" cy="248" r="${r}" fill="none" stroke="#141413" stroke-opacity="${opacity}" stroke-width="1"/>`;
    }).join('');
    const safeLabel = label.replace(/[<>&]/g, '');
    const safeSub = sub.replace(/[<>&]/g, '');
    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">',
        '<defs>',
        `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA} 62% 58%)"/><stop offset="1" stop-color="hsl(${hueB} 58% 44%)"/></linearGradient>`,
        '</defs>',
        '<rect width="600" height="600" fill="#F7F6F2"/>',
        '<rect x="0" y="0" width="600" height="600" fill="url(#g)" fill-opacity="0.14"/>',
        rings,
        '<circle cx="300" cy="248" r="150" fill="#141413" fill-opacity="0.9"/>',
        '<circle cx="300" cy="248" r="150" fill="none" stroke="#F7F6F2" stroke-opacity="0.18" stroke-width="1"/>',
        `<circle cx="300" cy="248" r="56" fill="hsl(${hueB} 64% 48%)"/>`,
        '<circle cx="300" cy="248" r="6" fill="#F7F6F2"/>',
        '<rect x="40" y="40" width="34" height="34" fill="none" stroke="#141413" stroke-opacity="0.4"/>',
        '<rect x="526" y="526" width="34" height="34" fill="none" stroke="#141413" stroke-opacity="0.4"/>',
        `<text x="300" y="474" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#141413" letter-spacing="-0.5">${safeLabel}</text>`,
        `<text x="300" y="504" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#575653" letter-spacing="2">${safeSub.toUpperCase()}</text>`,
        '</svg>',
    ].join('');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
