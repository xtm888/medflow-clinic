/**
 * Cross Section SVG Template
 * Horizontal cross-section of the eye
 * Used for documenting: cataract, vitreous opacities, retinal detachment, IOL position
 */

export default function CrossSection({ width = 400, height = 400 }) {
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
        Coupe Transversale
      </text>

      {/* Sclera (outer wall) */}
      <ellipse
        cx="200"
        cy="200"
        rx="170"
        ry="150"
        fill="#FFFAF0"
        stroke="#DEB887"
        strokeWidth="8"
      />
      <text x="360" y="200" fontSize="9" fill="#666">Sclère</text>

      {/* Choroid (middle layer) */}
      <ellipse
        cx="200"
        cy="200"
        rx="158"
        ry="138"
        fill="none"
        stroke="#8B4513"
        strokeWidth="3"
      />
      <text x="340" y="150" fontSize="8" fill="#8B4513">Choroïde</text>

      {/* Retina (inner layer) */}
      <ellipse
        cx="200"
        cy="200"
        rx="152"
        ry="132"
        fill="none"
        stroke="#CD5C5C"
        strokeWidth="2"
      />
      <text x="330" y="120" fontSize="8" fill="#CD5C5C">Rétine</text>

      {/* Vitreous body */}
      <ellipse
        cx="220"
        cy="200"
        rx="120"
        ry="110"
        fill="rgba(200, 230, 255, 0.3)"
        stroke="none"
      />
      <text x="250" y="200" fontSize="10" fill="#4682B4">Vitré</text>

      {/* Cornea */}
      <path
        d="M 45 150 Q 20 200, 45 250"
        fill="none"
        stroke="#4682B4"
        strokeWidth="4"
      />
      <text x="15" y="280" fontSize="9" fill="#4682B4">Cornée</text>

      {/* Anterior chamber */}
      <path
        d="M 45 155 Q 70 200, 45 245"
        fill="rgba(200, 230, 255, 0.5)"
        stroke="none"
      />
      <text x="50" y="180" fontSize="8" fill="#666">CA</text>

      {/* Iris */}
      <line x1="65" y1="160" x2="65" y2="185" stroke="#8B4513" strokeWidth="3" />
      <line x1="65" y1="215" x2="65" y2="240" stroke="#8B4513" strokeWidth="3" />
      <text x="75" y="155" fontSize="8" fill="#8B4513">Iris</text>

      {/* Pupil opening */}
      <line x1="65" y1="185" x2="65" y2="215" stroke="none" strokeWidth="0" />

      {/* Lens */}
      <ellipse
        cx="95"
        cy="200"
        rx="25"
        ry="40"
        fill="rgba(255, 255, 224, 0.8)"
        stroke="#DAA520"
        strokeWidth="2"
      />
      <text x="85" y="255" fontSize="9" fill="#DAA520">Cristallin</text>

      {/* Ciliary body */}
      <path
        d="M 65 155 Q 85 140, 110 145"
        fill="none"
        stroke="#A0522D"
        strokeWidth="3"
      />
      <path
        d="M 65 245 Q 85 260, 110 255"
        fill="none"
        stroke="#A0522D"
        strokeWidth="3"
      />
      <text x="90" y="135" fontSize="8" fill="#A0522D">Corps ciliaire</text>

      {/* Zonules */}
      <line x1="110" y1="150" x2="95" y2="165" stroke="#DDD" strokeWidth="1" />
      <line x1="112" y1="155" x2="100" y2="168" stroke="#DDD" strokeWidth="1" />
      <line x1="110" y1="250" x2="95" y2="235" stroke="#DDD" strokeWidth="1" />
      <line x1="112" y1="245" x2="100" y2="232" stroke="#DDD" strokeWidth="1" />
      <text x="115" y="170" fontSize="7" fill="#999">Zonules</text>

      {/* Optic nerve */}
      <ellipse
        cx="365"
        cy="200"
        rx="15"
        ry="25"
        fill="#FFE4B5"
        stroke="#DEB887"
        strokeWidth="2"
      />
      <line x1="370" y1="200" x2="395" y2="200" stroke="#DEB887" strokeWidth="8" />
      <text x="350" y="245" fontSize="8" fill="#666">Nerf optique</text>

      {/* Macula/Fovea region */}
      <circle
        cx="340"
        cy="200"
        r="8"
        fill="#8B0000"
        opacity="0.5"
      />
      <text x="325" y="185" fontSize="8" fill="#8B0000">Fovéa</text>

      {/* Ora serrata markers */}
      <circle cx="130" cy="90" r="3" fill="#CD5C5C" />
      <circle cx="130" cy="310" r="3" fill="#CD5C5C" />
      <text x="135" y="85" fontSize="7" fill="#CD5C5C">Ora serrata</text>

      {/* Axis line */}
      <line
        x1="20"
        y1="200"
        x2="380"
        y2="200"
        stroke="#ccc"
        strokeWidth="1"
        strokeDasharray="5,5"
      />
      <text x="190" y="215" fontSize="8" fill="#999">Axe optique</text>

      {/* Measurements */}
      {/* Axial length indicator */}
      <line x1="30" y1="340" x2="370" y2="340" stroke="#666" strokeWidth="1" />
      <line x1="30" y1="335" x2="30" y2="345" stroke="#666" strokeWidth="1" />
      <line x1="370" y1="335" x2="370" y2="345" stroke="#666" strokeWidth="1" />
      <text x="200" y="355" textAnchor="middle" fontSize="9" fill="#666">
        Longueur axiale (~24mm)
      </text>

      {/* OD/OS indicator */}
      <text x="30" y="380" fontSize="14" fill="#666" fontWeight="bold">
        OD / OS
      </text>
    </svg>
  );
}
