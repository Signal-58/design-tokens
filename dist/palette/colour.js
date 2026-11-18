const mul = (m, v) => [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const OKLAB_TO_LMS = [
    [1, 0.3963377773761749, 0.2158037573099136],
    [1, -0.1055613458156586, -0.0638541728258133],
    [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_XYZ = [
    [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
    [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
    [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const XYZ_TO_LINEAR = {
    srgb: [
        [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
        [-0.9692436362808796, 1.8759675015077202, 0.0415550574071756],
        [0.0556300796969936, -0.2039769588889765, 1.0569715142428786],
    ],
    p3: [
        [2.4934969119414254, -0.9313836179191239, -0.4027107844507168],
        [-0.8294889695615747, 1.7626640603183463, 0.0236246858419436],
        [0.0358458302437845, -0.0761723892680418, 0.9568845240076872],
    ],
};
/** OKLCH to CIE XYZ (D65). */
export function oklchToXyz({ l, c, h }) {
    const rad = (h * Math.PI) / 180;
    const lms = mul(OKLAB_TO_LMS, [l, c * Math.cos(rad), c * Math.sin(rad)]);
    return mul(LMS_TO_XYZ, [lms[0] ** 3, lms[1] ** 3, lms[2] ** 3]);
}
/** Linear-light RGB in a gamut. Values outside 0 to 1 are out of that gamut. */
export function oklchToLinear(colour, gamut) {
    return mul(XYZ_TO_LINEAR[gamut], oklchToXyz(colour));
}
/** sRGB and Display P3 share the same transfer curve. */
const encode = (x) => {
    const s = Math.sign(x);
    const a = Math.abs(x);
    return s * (a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055);
};
/** Gamma-encoded RGB, 0 to 1, clamped. Use after fitting so the clamp doesn't shift the hue. */
export function oklchToRgb(colour, gamut) {
    const [r, g, b] = oklchToLinear(colour, gamut).map((x) => Math.min(1, Math.max(0, encode(x))));
    return { r, g, b };
}
/** Rounding in the source values (white at L 1 is 0.9999 blue in P3) is within this. */
const GAMUT_EPSILON = 0.0005;
export function inGamut(colour, gamut) {
    return oklchToLinear(colour, gamut).every((x) => x >= -GAMUT_EPSILON && x <= 1 + GAMUT_EPSILON);
}
/**
 * The colour with its chroma reduced just enough to fit the gamut, keeping lightness and hue,
 * rounded to 4 decimal places. Colours already inside are returned unchanged.
 */
export function fitToGamut(colour, gamut) {
    if (inGamut(colour, gamut))
        return colour;
    let lo = 0;
    let hi = colour.c;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut({ ...colour, c: mid }, gamut))
            lo = mid;
        else
            hi = mid;
    }
    return { ...colour, c: Math.floor(lo * 10000) / 10000 };
}
/** Relative luminance (CIE Y), the basis of WCAG 2 contrast. */
export const luminance = (colour) => Math.max(0, oklchToXyz(colour)[1]);
/** WCAG 2 contrast ratio between two opaque colours, 1 to 21. */
export function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
/** Difference in OKLab, ×100 so 2 is a just-noticeable difference. */
export function deltaE(a, b) {
    const lab = ({ l, c, h }) => [
        l,
        c * Math.cos((h * Math.PI) / 180),
        c * Math.sin((h * Math.PI) / 180),
    ];
    const [x, y] = [lab(a), lab(b)];
    return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
/** `oklch(L C H)` or `oklch(L C H / A%)`, numbers trimmed. */
export function formatOklch({ l, c, h, alpha = 1 }) {
    const n = (x, dp) => String(Number(x.toFixed(dp)));
    const a = alpha < 1 ? ` / ${n(alpha * 100, 2)}%` : '';
    return `oklch(${n(l, 4)} ${n(c, 4)} ${n(h, 2)}${a})`;
}
// ─── APCA ────────────────────────────────────────────────────────────────────
/**
 * Screen luminance for APCA (APCA-W3 0.0.98G): the colour's Display P3 channels, as a P3 screen
 * shows them, with APCA's simple 2.4 exponent and P3 coefficients.
 */
export function apcaLuminance(colour) {
    const { r, g, b } = oklchToRgb(colour, 'p3');
    return 0.228982959480578 * r ** 2.4 + 0.691749262585238 * g ** 2.4 + 0.0792677779341829 * b ** 2.4;
}
/**
 * APCA lightness contrast (Lc) of text on a background, APCA-W3 0.0.98G. Positive for dark text on a
 * light background, negative for light text on a dark one; compare the size (Lc 75 is the
 * minimum for body text, 60 for other text, 45 for large text, 15 for non-text). Unlike WCAG 2 it
 * isn't symmetric, so contrast on black is measured, not derived from contrast on white.
 */
export function apcaContrast(text, background) {
    const clampBlack = (y) => (y < 0.022 ? y + (0.022 - y) ** 1.414 : y);
    const yt = clampBlack(apcaLuminance(text));
    const yb = clampBlack(apcaLuminance(background));
    if (Math.abs(yb - yt) < 0.0005)
        return 0;
    if (yb > yt) {
        const sapc = (yb ** 0.56 - yt ** 0.57) * 1.14;
        return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
    }
    const sapc = (yb ** 0.65 - yt ** 0.62) * 1.14;
    return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}
// ─── Reading colours ────────────────────────────────────────────────────────
const LINEAR_SRGB_TO_XYZ = [
    [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
    [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
    [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
const XYZ_TO_LMS = [
    [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
    [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
    [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB = [
    [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
    [1.9779985324311684, -2.42859224204858, 0.450593709617411],
    [0.0259040424655478, 0.7827717124575296, -0.808675754880964],
];
const decode = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
/** CIE XYZ (D65) to OKLCH. Hue is 0 for greys. */
export function xyzToOklch(xyz) {
    const lms = mul(XYZ_TO_LMS, xyz).map(Math.cbrt);
    const [l, a, b] = mul(LMS_TO_OKLAB, lms);
    const c = Math.hypot(a, b);
    const h = c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return { l, c, h };
}
/**
 * A colour from a hex code (`#F3A512`, `#fa1`, read as sRGB, the CSS default) or `oklch(L C H)`
 * (L as 0.78 or 78%), rounded to 4 decimal places (hue to 2). Anything else throws, rather than
 * quietly becoming black.
 */
export function parseColour(input) {
    const value = input.trim();
    const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
        const rgb = [0, 2, 4].map((i) => decode(parseInt(digits.slice(i, i + 2), 16) / 255));
        const { l, c, h } = xyzToOklch(mul(LINEAR_SRGB_TO_XYZ, rgb));
        const r4 = (x) => Math.round(x * 10000) / 10000;
        return { l: r4(l), c: r4(c), h: Math.round(h * 100) / 100 };
    }
    const ok = value.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
    if (ok) {
        return { l: Number(ok[1]) / (ok[2] ? 100 : 1), c: Number(ok[3]), h: Number(ok[4]) };
    }
    throw new Error(`Can't read the colour "${input}": use a hex code or oklch(L C H)`);
}
