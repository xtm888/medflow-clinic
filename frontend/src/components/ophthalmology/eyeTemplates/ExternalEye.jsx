/**
 * External Eye SVG Template
 * Front view showing eyelids, conjunctiva, lacrimal system
 * Used for documenting: lid lesions, ptosis, conjunctivitis, chalazion
 */

export default function ExternalEye({ width = 400, height = 400 }) {
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
        Oeil Externe
      </text>

      {/* Eyebrow */}
      <path
        d="M 80 100 Q 200 60, 320 100"
        fill="none"
        stroke="#4a3728"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <text x="340" y="85" fontSize="9" fill="#666">Sourcil</text>

      {/* Upper eyelid */}
      <path
        d="M 60 200 Q 200 120, 340 200"
        fill="#FFDAB9"
        stroke="#DEB887"
        strokeWidth="2"
      />
      {/* Upper lid crease */}
      <path
        d="M 80 170 Q 200 130, 320 170"
        fill="none"
        stroke="#CD853F"
        strokeWidth="1"
        strokeDasharray="4,4"
      />
      <text x="200" y="145" textAnchor="middle" fontSize="9" fill="#666">
        Paupière supérieure
      </text>

      {/* Lower eyelid */}
      <path
        d="M 60 200 Q 200 280, 340 200"
        fill="#FFDAB9"
        stroke="#DEB887"
        strokeWidth="2"
      />
      <text x="200" y="270" textAnchor="middle" fontSize="9" fill="#666">
        Paupière inférieure
      </text>

      {/* Palpebral fissure (eye opening) */}
      <ellipse
        cx="200"
        cy="200"
        rx="130"
        ry="60"
        fill="#fff"
        stroke="#CD853F"
        strokeWidth="2"
      />

      {/* Conjunctiva (visible sclera) */}
      <ellipse
        cx="200"
        cy="200"
        rx="125"
        ry="55"
        fill="#FFFAF0"
        stroke="none"
      />

      {/* Iris */}
      <circle
        cx="200"
        cy="200"
        r="45"
        fill="#6B8E23"
        stroke="#556B2F"
        strokeWidth="2"
      />

      {/* Pupil */}
      <circle
        cx="200"
        cy="200"
        r="18"
        fill="#111"
      />

      {/* Light reflection */}
      <circle
        cx="190"
        cy="192"
        r="5"
        fill="#fff"
        opacity="0.7"
      />

      {/* Caruncle (inner corner) */}
      <ellipse
        cx="70"
        cy="200"
        rx="12"
        ry="18"
        fill="#FFB6C1"
        stroke="#CD5C5C"
        strokeWidth="1"
      />
      <text x="70" y="230" textAnchor="middle" fontSize="8" fill="#666">
        Caroncule
      </text>

      {/* Lacrimal punctum */}
      <circle cx="85" cy="190" r="2" fill="#8B0000" />
      <circle cx="85" cy="210" r="2" fill="#8B0000" />
      <text x="50" y="250" fontSize="8" fill="#666">Points lacrymaux</text>

      {/* Lateral canthus */}
      <text x="320" y="230" fontSize="8" fill="#666">Canthus ext.</text>

      {/* Medial canthus */}
      <text x="40" y="180" fontSize="8" fill="#666">Canthus int.</text>

      {/* Upper lid margin */}
      <path
        d="M 75 195 Q 200 155, 325 195"
        fill="none"
        stroke="#8B4513"
        strokeWidth="1"
      />

      {/* Lower lid margin */}
      <path
        d="M 75 205 Q 200 245, 325 205"
        fill="none"
        stroke="#8B4513"
        strokeWidth="1"
      />

      {/* Eyelashes indication (upper) */}
      {[...Array(12)].map((_, i) => {
        const t = (i + 1) / 13;
        const x = 75 + t * 250;
        const y = 195 - 40 * Math.sin(Math.PI * t);
        return (
          <line
            key={`upper-${i}`}
            x1={x}
            y1={y}
            x2={x}
            y2={y - 8}
            stroke="#333"
            strokeWidth="1"
          />
        );
      })}

      {/* Eyelashes indication (lower) */}
      {[...Array(8)].map((_, i) => {
        const t = (i + 1) / 9;
        const x = 100 + t * 200;
        const y = 205 + 40 * Math.sin(Math.PI * t);
        return (
          <line
            key={`lower-${i}`}
            x1={x}
            y1={y}
            x2={x}
            y2={y + 5}
            stroke="#333"
            strokeWidth="1"
          />
        );
      })}

      {/* Measurement guides */}
      <line x1="60" y1="200" x2="40" y2="200" stroke="#ccc" strokeWidth="1" />
      <line x1="340" y1="200" x2="360" y2="200" stroke="#ccc" strokeWidth="1" />
      <text x="370" y="204" fontSize="9" fill="#999">Fente</text>

      {/* OD/OS indicator */}
      <text x="30" y="380" fontSize="14" fill="#666" fontWeight="bold">
        OD / OS
      </text>
    </svg>
  );
}
