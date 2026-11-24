import { getPaletteSync } from 'colorthief';
import { DEFAULT_ACCENTS, clamp, hashString } from '../types/neplaylist';
const ACHROMATIC_SATURATION = 42;
const MIN_VIBRANT_LIGHTNESS = 14;
const MAX_VIBRANT_LIGHTNESS = 90;
export function rgbToHsl(r, g, b) {
    const rn = clamp(r, 0, 255) / 255;
    const gn = clamp(g, 0, 255) / 255;
    const bn = clamp(b, 0, 255) / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn)
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn)
            h = ((bn - rn) / d + 2) / 6;
        else
            h = ((rn - gn) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
export function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = clamp(s, 0, 100) / 100;
    const light = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = light - c / 2;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (hue < 60) {
        rp = c;
        gp = x;
    }
    else if (hue < 120) {
        rp = x;
        gp = c;
    }
    else if (hue < 180) {
        gp = c;
        bp = x;
    }
    else if (hue < 240) {
        gp = x;
        bp = c;
    }
    else if (hue < 300) {
        rp = x;
        bp = c;
    }
    else {
        rp = c;
        bp = x;
    }
    const toHex = (value) => Math.round(clamp((value + m) * 255, 0, 255))
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}
export function hexToRgb(hex) {
    const normalized = hex.trim().replace(/^#/, '');
    if (normalized.length === 3) {
        const r = Number.parseInt(normalized[0] + normalized[0], 16);
        const g = Number.parseInt(normalized[1] + normalized[1], 16);
        const b = Number.parseInt(normalized[2] + normalized[2], 16);
        return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
    }
    if (normalized.length === 6) {
        const r = Number.parseInt(normalized.slice(0, 2), 16);
        const g = Number.parseInt(normalized.slice(2, 4), 16);
        const b = Number.parseInt(normalized.slice(4, 6), 16);
        return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
    }
    return null;
}
function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return 0;
    const channel = (value) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}
export function contrastInk(hex) {
    return relativeLuminance(hex) > 0.42 ? '#141413' : '#FFFFFF';
}
function normalizeSwatch(swatch) {
    if (!swatch)
        return null;
    const candidate = swatch;
    if (typeof candidate.hsl === 'function') {
        try {
            const value = candidate.hsl();
            if (Array.isArray(value) && value.length >= 3) {
                return { h: value[0], s: value[1], l: value[2] };
            }
            if (value && typeof value === 'object' && 'h' in value) {
                return { h: Number(value.h ?? 0), s: Number(value.s ?? 0), l: Number(value.l ?? 0) };
            }
        }
        catch {
            /* fall through to other strategies */
        }
    }
    if (typeof candidate.hex === 'function') {
        try {
            const rgb = hexToRgb(candidate.hex());
            if (rgb)
                return rgbToHsl(rgb.r, rgb.g, rgb.b);
        }
        catch {
            /* fall through */
        }
    }
    if (Array.isArray(swatch) && swatch.length >= 3) {
        const [r, g, b] = swatch;
        if ([r, g, b].every((v) => Number.isFinite(v)))
            return rgbToHsl(r, g, b);
    }
    return null;
}
function isVibrant(color) {
    return (color.s >= ACHROMATIC_SATURATION &&
        color.l > MIN_VIBRANT_LIGHTNESS &&
        color.l < MAX_VIBRANT_LIGHTNESS);
}
function samplePixelsFromImage(img) {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx)
        return [];
    ctx.drawImage(img, 0, 0, size, size);
    let data;
    try {
        data = ctx.getImageData(0, 0, size, size).data;
    }
    catch {
        return [];
    }
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 128)
            continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
        const existing = buckets.get(key);
        if (existing) {
            existing.r += r;
            existing.g += g;
            existing.b += b;
            existing.count += 1;
        }
        else {
            buckets.set(key, { r, g, b, count: 1 });
        }
    }
    return [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 16)
        .map((bucket) => rgbToHsl(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count))
        .filter(isVibrant);
}
export async function loadImage(url) {
    if (!url)
        return null;
    const img = new Image();
    if (!url.startsWith('data:'))
        img.crossOrigin = 'anonymous';
    img.src = url;
    try {
        if (typeof img.decode === 'function')
            await img.decode();
    }
    catch {
        /* decode() rejects on some browsers for SVG/data URIs; fall through to load state */
    }
    if (!img.complete || img.naturalWidth === 0) {
        const loaded = await new Promise((resolve) => {
            const timeout = window.setTimeout(() => resolve(false), 4000);
            img.addEventListener('load', () => {
                window.clearTimeout(timeout);
                resolve(true);
            }, { once: true });
            img.addEventListener('error', () => {
                window.clearTimeout(timeout);
                resolve(false);
            }, { once: true });
        });
        if (!loaded)
            return null;
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
}
function selectVibrant(colors, seed) {
    const vibrant = colors.filter(isVibrant);
    if (!vibrant.length)
        return null;
    const scored = vibrant
        .map((color) => ({
        color,
        score: color.s * 1.6 + (100 - Math.abs(color.l - 48) * 1.5),
    }))
        .sort((a, b) => b.score - a.score);
    if (scored.length === 1)
        return scored[0].color;
    const seedValue = hashString(seed);
    const pick = seedValue % Math.min(3, scored.length);
    return scored[pick].color;
}
export function calibrateAccents(base) {
    if (!base)
        return { ...DEFAULT_ACCENTS };
    const fillLightness = clamp(base.l, 42, 56);
    const fillSaturation = Math.max(65, clamp(base.s, 0, 100));
    const accentHex = hslToHex(base.h, fillSaturation, fillLightness);
    const accentInkHex = contrastInk(accentHex);
    const onLightSaturation = Math.max(65, Math.min(100, base.s + 6));
    const onLightLightness = clamp(Math.min(base.l, 42), 24, 42);
    const accentOnLightHex = hslToHex(base.h, onLightSaturation, onLightLightness);
    return { accentHex, accentInkHex, accentOnLightHex };
}
export function fallbackAccentsFromSeed(seed) {
    const hash = hashString(seed || 'neplaylist');
    const hue = hash % 360;
    return calibrateAccents({ h: hue, s: 68, l: 50 });
}
export async function extractAccents(thumbUrl, seed) {
    if (!thumbUrl)
        return fallbackAccentsFromSeed(seed);
    const img = await loadImage(thumbUrl);
    if (!img)
        return fallbackAccentsFromSeed(seed);
    let palette = [];
    try {
        const raw = getPaletteSync(img, { colorCount: 6 });
        if (Array.isArray(raw) && raw.length > 0) {
            palette = raw.map((swatch) => normalizeSwatch(swatch));
        }
    }
    catch {
        palette = [];
    }
    let colors = palette.filter((color) => color !== null && isVibrant(color));
    if (!colors.length) {
        try {
            colors = samplePixelsFromImage(img);
        }
        catch {
            colors = [];
        }
    }
    const selected = selectVibrant(colors, seed);
    return calibrateAccents(selected);
}
export function applyAccentsToDocument(tokens, target) {
    const el = target ?? document.documentElement;
    el.style.setProperty('--accent-dynamic', tokens.accentHex);
    el.style.setProperty('--accent-dynamic-ink', tokens.accentInkHex);
    el.style.setProperty('--accent-on-light', tokens.accentOnLightHex);
}
