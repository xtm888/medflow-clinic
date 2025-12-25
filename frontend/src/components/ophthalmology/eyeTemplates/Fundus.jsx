/**
 * Fundus SVG Template
 * Posterior view of the eye showing optic disc, macula, vessels
 * Used for documenting: DR, AMD, glaucoma, retinal detachment
 */

export default function Fundus({ width = 400, height = 400 }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: 'white' }}
    >
      {/* Title */}
      <text x="200" y="25" textAnchor="middle" fontSize="14" fill="#666" fontWeight="500">
        Fond d'Oeil
      </text>

      {/* Retina background (orange-red) */}
      <circle
        cx="200"
        cy="200"
        r="170"
        fill="#CD5C5C"
        stroke="#8B0000"
        strokeWidth="2"
      />

      {/* Optic Disc (nasal side - right side for OD, left for OS) */}
      <ellipse
        cx="280"
        cy="200"
        rx="35"
        ry="40"
        fill="#FFE4B5"
        stroke="#DEB887"
        strokeWidth="2"
      />
      {/* Cup */}
      <ellipse
        cx="280"
        cy="200"
        rx="15"
        ry="18"
        fill="#FFF8DC"
        stroke="#DDD"
        strokeWidth="1"
      />
      <text x="280" y="255" textAnchor="middle" fontSize="9" fill="#666">
        Papille
      </text>

      {/* Macula (temporal to disc) */}
      <circle
        cx="140"
        cy="200"
        r="25"
        fill="none"
        stroke="#8B0000"
        strokeWidth="1"
        strokeDasharray="3,3"
      />
      {/* Fovea */}
      <circle
        cx="140"
        cy="200"
        r="8"
        fill="#8B0000"
      />
      <text x="140" y="240" textAnchor="middle" fontSize="9" fill="#666">
        Macula
      </text>

      {/* Major blood vessels from optic disc */}
      {/* Superior temporal artery */}
      <path
        d="M 280 165 Q 230 130, 120 100"
        fill="none"
        stroke="#DC143C"
        strokeWidth="3"
      />
      {/* Superior temporal vein */}
      <path
        d="M 280 165 Q 220 140, 100 120"
        fill="none"
        stroke="#8B0000"
        strokeWidth="4"
      />

      {/* Inferior temporal artery */}
      <path
        d="M 280 235 Q 230 270, 120 300"
        fill="none"
        stroke="#DC143C"
        strokeWidth="3"
      />
      {/* Inferior temporal vein */}
      <path
        d="M 280 235 Q 220 260, 100 280"
        fill="none"
        stroke="#8B0000"
        strokeWidth="4"
      />

      {/* Superior nasal vessels */}
      <path
        d="M 295 170 Q 330 140, 350 100"
        fill="none"
        stroke="#DC143C"
        strokeWidth="2"
      />
      <path
        d="M 300 175 Q 340 150, 360 120"
        fill="none"
        stroke="#8B0000"
        strokeWidth="3"
      />

      {/* Inferior nasal vessels */}
      <path
        d="M 295 230 Q 330 260, 350 300"
        fill="none"
        stroke="#DC143C"
        strokeWidth="2"
      />
      <path
        d="M 300 225 Q 340 250, 360 280"
        fill="none"
        stroke="#8B0000"
        strokeWidth="3"
      />

      {/* Arcade markers */}
      <text x="150" y="90" fontSize="9" fill="#fff" opacity="0.7">Arcade sup.</text>
      <text x="150" y="320" fontSize="9" fill="#fff" opacity="0.7">Arcade inf.</text>

      {/* Clock reference */}
      {[12, 3, 6, 9].map((hour) => {
        const angle = ((hour - 3) * 30 * Math.PI) / 180;
        const x = 200 + 180 * Math.cos(angle);
        const y = 200 + 180 * Math.sin(angle);
        return (
          <text
            key={hour}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fill="#666"
          >
            {hour}h
          </text>
        );
      })}

      {/* Legend */}
      <g transform="translate(20, 360)">
        <line x1="0" y1="0" x2="20" y2="0" stroke="#DC143C" strokeWidth="3" />
        <text x="25" y="4" fontSize="9" fill="#666">Artère</text>
        <line x1="70" y1="0" x2="90" y2="0" stroke="#8B0000" strokeWidth="4" />
        <text x="95" y="4" fontSize="9" fill="#666">Veine</text>
      </g>

      {/* OD/OS indicator */}
      <text x="30" y="380" fontSize="14" fill="#666" fontWeight="bold">
        OD / OS
      </text>
    </svg>
  );
}
