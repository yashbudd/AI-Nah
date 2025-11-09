'use client';

export default function TrailMixLogo({ size = 40 }: { size?: number }) {
  return (
    <div className="trailmix-logo" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TrailMix logo"
      >
        <defs>
          <clipPath id="map-clip">
            <rect x="15" y="25" width="170" height="150" rx="22" ry="22" />
          </clipPath>
        </defs>
        <rect
          x="15"
          y="25"
          width="170"
          height="150"
          rx="22"
          ry="22"
          fill="#1D3B1F"
        />
        <g clipPath="url(#map-clip)">
          <rect x="20" y="30" width="160" height="140" fill="#66B0A6" />
          <path
            d="M20 120 C 70 110, 90 140, 120 140 C 150 140, 180 120, 180 120 L 180 170 L 20 170 Z"
            fill="#4B9B55"
          />
          <path
            d="M30 150 Q 70 120 100 140 Q 130 160 160 120"
            fill="none"
            stroke="#0C210E"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="28 18"
          />
          <circle cx="38" cy="156" r="12" fill="#0C210E" />
        </g>
        <path
          d="M148 20 C 130 20 116 34 116 52 C 116 65 137 102 148 120 C 159 102 180 65 180 52 C 180 34 166 20 148 20 Z"
          fill="#4B9B55"
          stroke="#0C210E"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <circle cx="148" cy="52" r="16" fill="#0C210E" />
        <rect
          x="15"
          y="25"
          width="170"
          height="150"
          rx="22"
          ry="22"
          stroke="#0C210E"
          strokeWidth="12"
          fill="none"
        />
      </svg>
    </div>
  );
}

