/**
 * VisualAcuityTrendChart
 *
 * Line chart for visualizing Visual Acuity trends using LogMAR scale.
 * Lower values = better vision. Shows Snellen equivalent labels.
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Eye } from 'lucide-react';

// LogMAR to Snellen conversion for axis labels
const LOGMAR_LABELS = {
  '-0.1': '20/16',
  '0': '20/20',
  '0.2': '20/32',
  '0.3': '20/40',
  '0.5': '20/63',
  '0.7': '20/100',
  '1.0': '20/200',
  '1.3': '20/400',
  '1.7': 'CF',
  '2.0': 'HM'
};

// Custom tooltip showing both LogMAR and Snellen
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const logmarToSnellen = (logmar) => {
    if (logmar === null || logmar === undefined) return 'N/A';
    const keys = Object.keys(LOGMAR_LABELS).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length; i++) {
      if (logmar <= keys[i]) {
        return LOGMAR_LABELS[keys[i].toString()] || `${logmar.toFixed(2)}`;
      }
    }
    return 'NLP';
  };

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border text-sm">
      <p className="font-medium text-gray-700 mb-2">
        {new Date(label).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })}
      </p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium">
            {entry.value !== null ? logmarToSnellen(entry.value) : 'N/A'}
          </span>
          <span className="text-gray-400 text-xs">
            ({entry.value?.toFixed(2)} LogMAR)
          </span>
        </div>
      ))}
    </div>
  );
}

// Custom Y-axis tick showing Snellen equivalents
function CustomYAxisTick({ x, y, payload }) {
  const snellen = LOGMAR_LABELS[payload.value.toString()];
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#666"
        fontSize={10}
      >
        {snellen || payload.value}
      </text>
    </g>
  );
}

export default function VisualAcuityTrendChart({
  data = [],
  height = 300,
  showStats = true,
  compact = false,
  measurementType = 'corrected'
}) {
  // Process data for chart
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: new Date(point.date).getTime(),
      OD: point.OD?.logMAR,
      OS: point.OS?.logMAR,
      ODSnellen: point.OD?.snellen,
      OSSnellen: point.OS?.snellen
    }));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    const calcStats = (key) => {
      const values = chartData.filter(d => d[key] !== null && d[key] !== undefined);
      if (values.length === 0) return null;

      const logmarValues = values.map(v => v[key]);
      const latest = logmarValues[logmarValues.length - 1];
      const first = logmarValues[0];
      const best = Math.min(...logmarValues);
      const worst = Math.max(...logmarValues);
      // In LogMAR: positive change = worsening, negative = improving
      const change = values.length >= 2 ? latest - first : 0;
      const linesChanged = Math.round(change / 0.1);

      // Get Snellen values
      const latestSnellen = values[values.length - 1][`${key}Snellen`];
      const firstSnellen = values[0][`${key}Snellen`];

      return {
        latest,
        latestSnellen,
        first,
        firstSnellen,
        best,
        worst,
        change,
        linesChanged,
        improving: change < -0.1,
        worsening: change > 0.1
      };
    };

    return {
      OD: calcStats('OD'),
      OS: calcStats('OS')
    };
  }, [chartData]);

  // Trend indicator
  const TrendIndicator = ({ linesChanged }) => {
    if (linesChanged >= 2) return <TrendingDown className="h-4 w-4 text-red-500" title={`${linesChanged} lignes perdues`} />;
    if (linesChanged <= -2) return <TrendingUp className="h-4 w-4 text-green-500" title={`${Math.abs(linesChanged)} lignes gagnées`} />;
    return <Minus className="h-4 w-4 text-gray-400" title="Stable" />;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">
        <Eye className="h-5 w-5 mr-2" />
        Aucune donnée d'acuité visuelle disponible
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">
            Acuité Visuelle
          </h3>
          <p className="text-xs text-gray-500">
            {measurementType === 'corrected' ? 'Avec correction' : 'Sans correction'} - LogMAR (↓ = meilleur)
          </p>
        </div>
        {showStats && (
          <div className="flex items-center gap-4 text-sm">
            {['OD', 'OS'].map(eye => stats[eye] && (
              <div key={eye} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${eye === 'OD' ? 'bg-blue-500' : 'bg-green-500'}`} />
                <span className="text-gray-600">{eye}:</span>
                <span className="font-medium">{stats[eye].latestSnellen}</span>
                <TrendIndicator linesChanged={stats[eye].linesChanged} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className={`px-4 py-4`} style={{ height: compact ? 200 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

            <XAxis
              dataKey="date"
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(ts) => new Date(ts).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
              fontSize={12}
              stroke="#9ca3af"
            />

            <YAxis
              domain={[-0.2, 2.0]}
              ticks={[-0.1, 0, 0.2, 0.3, 0.5, 0.7, 1.0, 1.3, 1.7, 2.0]}
              tick={<CustomYAxisTick />}
              reversed={false}
              width={50}
            />

            {/* 20/20 reference line */}
            <ReferenceLine
              y={0}
              stroke="#10b981"
              strokeDasharray="5 5"
              label={{ value: '20/20', position: 'right', fontSize: 10, fill: '#10b981' }}
            />

            {/* Legal blindness threshold */}
            <ReferenceLine
              y={1.0}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: '20/200', position: 'right', fontSize: 10, fill: '#ef4444' }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-gray-600">
                  {value === 'OD' ? 'Œil Droit (OD)' : 'Œil Gauche (OS)'}
                </span>
              )}
            />

            <Line
              type="monotone"
              dataKey="OD"
              name="OD"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6 }}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="OS"
              name="OS"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4, fill: '#10b981' }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Footer */}
      {showStats && !compact && stats.OD && (
        <div className="px-4 py-3 bg-gray-50 border-t text-sm">
          <div className="grid grid-cols-2 gap-4">
            {['OD', 'OS'].map(eye => stats[eye] && (
              <div key={eye}>
                <span className="font-medium text-gray-700">{eye}:</span>
                <div className="flex items-center gap-3 mt-1 text-gray-600">
                  <span>Actuel: <strong>{stats[eye].latestSnellen}</strong></span>
                  {stats[eye].linesChanged !== 0 && (
                    <span className={stats[eye].worsening ? 'text-red-600' : 'text-green-600'}>
                      {stats[eye].worsening ? '↓' : '↑'} {Math.abs(stats[eye].linesChanged)} lignes
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
