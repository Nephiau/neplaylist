export function GroovedDisc({ size, labelUrl = null, labelYear, className = '', style, }) {
    return (<svg viewBox="0 0 200 200" width={size} height={size} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id="ne-vinyl-body" cx="50%" cy="44%" r="62%">
          <stop offset="0%" stopColor="#22242A"/>
          <stop offset="52%" stopColor="#14151A"/>
          <stop offset="100%" stopColor="#0B0C0F"/>
        </radialGradient>
        <linearGradient id="ne-vinyl-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14"/>
          <stop offset="34%" stopColor="#FFFFFF" stopOpacity="0.02"/>
          <stop offset="62%" stopColor="#FFFFFF" stopOpacity="0.09"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
        </linearGradient>
        <clipPath id="ne-vinyl-label-clip">
          <circle cx="100" cy="100" r="34"/>
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="99" fill="url(#ne-vinyl-body)"/>
      <circle cx="100" cy="100" r="99" fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="1"/>

      {Array.from({ length: 26 }, (_, i) => {
            const r = 38 + i * 2.28;
            return (<circle key={i} cx="100" cy="100" r={r} fill="none" stroke="#FFFFFF" strokeOpacity={i % 3 === 0 ? 0.1 : 0.045} strokeWidth={i % 5 === 0 ? 0.7 : 0.4}/>);
        })}

      <circle cx="100" cy="100" r="99" fill="url(#ne-vinyl-sheen)"/>

      <circle cx="100" cy="100" r="34.6" fill="#F7F6F2"/>
      {labelUrl ? (<>
          <image href={labelUrl} x="66" y="66" width="68" height="68" clipPath="url(#ne-vinyl-label-clip)" preserveAspectRatio="xMidYMid slice"/>
          <circle cx="100" cy="100" r="34" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="0.9"/>
        </>) : (<>
          <circle cx="100" cy="100" r="34" fill="var(--accent-dynamic, #E04F3E)"/>
          <circle cx="100" cy="100" r="27" fill="none" stroke="#F7F6F2" strokeOpacity="0.35" strokeWidth="0.6"/>
          <text x="100" y="97" textAnchor="middle" fontSize="6.4" fontFamily="'JetBrains Mono', monospace" fill="var(--accent-dynamic-ink, #FFFFFF)" letterSpacing="0.7">
            NE
          </text>
          <text x="100" y="106" textAnchor="middle" fontSize="4.6" fontFamily="'JetBrains Mono', monospace" fill="var(--accent-dynamic-ink, #FFFFFF)" opacity="0.85" letterSpacing="0.5">
            {labelYear || '33⅓ RPM'}
          </text>
        </>)}

      <circle cx="100" cy="100" r="2.2" fill="#0B0C0F"/>
      <circle cx="100" cy="100" r="1.1" fill="#C9C7C1"/>
    </svg>);
}
export function Tonearm({ progress, playing, size, className = '' }) {
    const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const angle = playing ? 2 + clamped * 12 : -18;
    return (<svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-hidden="true" style={{
            transformOrigin: '78% 8%',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 620ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
      <defs>
        <linearGradient id="ne-chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#B9BCC1"/>
          <stop offset="26%" stopColor="#F2F3F5"/>
          <stop offset="52%" stopColor="#C6C9CE"/>
          <stop offset="74%" stopColor="#EFF0F2"/>
          <stop offset="100%" stopColor="#9EA2A8"/>
        </linearGradient>
        <linearGradient id="ne-chrome-dark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6E7177"/>
          <stop offset="50%" stopColor="#A9ADB3"/>
          <stop offset="100%" stopColor="#5C5F65"/>
        </linearGradient>
      </defs>

      <circle cx="156" cy="16" r="9.5" fill="url(#ne-chrome-dark)"/>
      <circle cx="156" cy="16" r="4.4" fill="#2A2C31"/>
      <circle cx="156" cy="16" r="1.8" fill="#C9C7C1"/>

      <rect x="148" y="20" width="16" height="7" rx="1.6" fill="url(#ne-chrome-dark)"/>

      <path d="M156 24 C 152 52, 138 78, 118 100 C 106 113, 96 122, 88 132" fill="none" stroke="url(#ne-chrome)" strokeWidth="4.6" strokeLinecap="round"/>
      <path d="M156 24 C 152 52, 138 78, 118 100 C 106 113, 96 122, 88 132" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.1" strokeLinecap="round"/>

      <rect x="83" y="130" width="11" height="15" rx="1.6" fill="#16171B"/>
      <rect x="85" y="143" width="7.4" height="4" rx="1" fill="#3A3D42"/>

      <path d="M84 146 l 9 0 l -2.6 6.4 l -4 0 z" fill="#2B2E33"/>
      <circle cx="88.6" cy="153.6" r="1.5" fill="var(--accent-dynamic, #E04F3E)"/>

      <rect x="154" y="2" width="4" height="9" rx="1.4" fill="url(#ne-chrome-dark)"/>
    </svg>);
}
export function StampSeal({ size = 76, className = '' }) {
    const id = 'ne-stamp-path';
    return (<svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" style={{ opacity: 0.55 }}>
      <defs>
        <path id={id} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" fill="none"/>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#141413" strokeWidth="0.6" strokeOpacity="0.55"/>
      <circle cx="50" cy="50" r="31" fill="none" stroke="#141413" strokeWidth="0.5" strokeOpacity="0.4"/>
      <text fontSize="6.6" fontFamily="'JetBrains Mono', monospace" fill="#141413" letterSpacing="1.5">
        <textPath href={`#${id}`} startOffset="0%">
          ANALOG LISTENING ROOM • HIGH FIDELITY •
        </textPath>
      </text>
      <circle cx="50" cy="50" r="2.4" fill="#141413" fillOpacity="0.5"/>
    </svg>);
}
export function HeadphoneGlyph({ size = 14 }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="2.6" y="13" width="4" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="17.4" y="13" width="4" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.5"/>
    </svg>);
}
export function SpeakerGlyph({ size = 14 }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.4" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="15.4" r="3.4" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="7.6" r="1.7" stroke="currentColor" strokeWidth="1.3"/>
    </svg>);
}
export function VinylEmblem({ size = 18 }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.4" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="12" cy="12" r="5.8" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5"/>
      <circle cx="12" cy="12" r="3.1" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="12" cy="12" r="0.9" fill="#141413"/>
    </svg>);
}
