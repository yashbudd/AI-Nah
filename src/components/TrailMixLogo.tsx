'use client';

export default function TrailMixLogo({ size = 40 }: { size?: number }) {
  return (
    <div className="trailmix-logo" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Octagonal background - using rounded rect with clip path for octagon effect */}
        <defs>
          <clipPath id="octagon-clip">
            <path d="M15 20 L20 15 L80 15 L85 20 L85 80 L80 85 L20 85 L15 80 Z" />
          </clipPath>
        </defs>
        <rect
          x="15"
          y="15"
          width="70"
          height="70"
          rx="8"
          ry="8"
          fill="#F5F5DC"
          stroke="#001f03"
          strokeWidth="2.5"
        />
        
        {/* Light blue sky/water area */}
        <rect
          x="25"
          y="28"
          width="50"
          height="18"
          fill="#87CEEB"
          stroke="#001f03"
          strokeWidth="1.5"
        />
        
        {/* Green land area */}
        <rect
          x="25"
          y="46"
          width="50"
          height="26"
          fill="#4CAF50"
          stroke="#001f03"
          strokeWidth="1.5"
        />
        
        {/* Dashed trail path */}
        <line
          x1="32"
          y1="59"
          x2="68"
          y2="59"
          stroke="#001f03"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        
        {/* Starting point circle */}
        <circle cx="32" cy="59" r="3.5" fill="#001f03" />
        
        {/* Location pin at end - triangle + circle */}
        <g transform="translate(68, 59)">
          {/* Pin triangle */}
          <path
            d="M 0 -9 L -5 0 L 5 0 Z"
            fill="#4CAF50"
            stroke="#001f03"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Pin center circle */}
          <circle cx="0" cy="-5" r="2.5" fill="#001f03" />
        </g>
      </svg>
    </div>
  );
}

