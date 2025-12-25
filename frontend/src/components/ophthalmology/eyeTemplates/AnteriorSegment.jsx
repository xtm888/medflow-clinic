/**
 * Anterior Segment SVG Template
 * Front view of the eye showing cornea, iris, pupil, limbus
 * Used for documenting: corneal lesions, iris abnormalities, pupil defects
 */

export default function AnteriorSegment({ width = 400, height = 400 }) {
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
        Segment Antérieur
      </text>

      {/* Outer eye outline (sclera visible) */}
      <ellipse
        cx="200"
        cy="200"
        rx="160"
        ry="140"
        fill="none"
        stroke="#ccc"
        strokeWidth="1"
        strokeDasharray="4,4"
      />

      {/* Limbus (cornea-sclera junction) */}
      <circle
        cx="200"
        cy="200"
        r="130"
        fill="none"
        stroke="#999"
        strokeWidth="2"
      />
      <text x="340" y="200" fontSize="10" fill="#999">Limbe</text>

      {/* Cornea (clear, so just outline) */}
      <circle
        cx="200"
        cy="200"
        r="120"
        fill="rgba(240, 248, 255, 0.3)"
        stroke="#666"
        strokeWidth="1"
        strokeDasharray="2,2"
      />
      <text x="200" y="70" textAnchor="middle" fontSize="10" fill="#666">Cornée</text>

      {/* Iris */}
      <circle
        cx="200"
        cy="200"
        r="80"
        fill="none"
        stroke="#8B4513"
        strokeWidth="3"
      />
      {/* Iris texture lines */}
      {[...Array(24)].map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        const x1 = 200 + 45 * Math.cos(angle);
        const y1 = 200 + 45 * Math.sin(angle);
        const x2 = 200 + 78 * Math.cos(angle);
        const y2 = 200 + 78 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#A0522D"
            strokeWidth="1"
            opacity="0.4"
          />
        );
      })}
      <text x="280" y="140" fontSize="10" fill="#8B4513">Iris</text>

      {/* Pupil */}
      <circle
        cx="200"
        cy="200"
        r="40"
        fill="#111"
        stroke="#000"
        strokeWidth="2"
      />
      <text x="200" y="205" textAnchor="middle" fontSize="10" fill="#fff">Pupille</text>

      {/* Clock hours for reference */}
      {[12, 3, 6, 9].map((hour) => {
        const angle = ((hour - 3) * 30 * Math.PI) / 180;
        const x = 200 + 145 * Math.cos(angle);
        const y = 200 + 145 * Math.sin(angle);
        return (
          <text
            key={hour}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fill="#999"
          >
            {hour}h
          </text>
        );
      })}

      {/* Axis markers */}
      <line x1="50" y1="200" x2="70" y2="200" stroke="#ccc" strokeWidth="1" />
      <line x1="330" y1="200" x2="350" y2="200" stroke="#ccc" strokeWidth="1" />
      <line x1="200" y1="50" x2="200" y2="70" stroke="#ccc" strokeWidth="1" />
      <line x1="200" y1="330" x2="200" y2="350" stroke="#ccc" strokeWidth="1" />

      {/* OD/OS indicator placeholder */}
      <text x="30" y="380" fontSize="14" fill="#666" fontWeight="bold">
        OD / OS
      </text>
    </svg>
  );
}
