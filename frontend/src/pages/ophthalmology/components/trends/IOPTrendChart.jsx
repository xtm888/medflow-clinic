/**
 * IOPTrendChart
 *
 * Line chart for visualizing Intraocular Pressure (IOP) trends over time.
 * Shows OD and OS values with normal range reference.
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
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Normal IOP range
const NORMAL_MIN = 10;
const NORMAL_MAX = 21;
const CRITICAL_THRESHOLD = 30;

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

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
            {entry.value !== null ? `${entry.value} mmHg` : 'N/A'}
          </span>
          {entry.value > NORMAL_MAX && (
            <AlertTriangle className="h-3 w-3 text-orange-500" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function IOPTrendChart({
  data = [],
  height = 300,
  showNormalRange = true,
  showStats = true,
  compact = false
}) {
  // Process data for chart
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: new Date(point.date).getTime(),
      OD: point.OD,
      OS: point.OS
    }));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    const odValues = data.filter(d => d.OD !== null).map(d => d.OD);
    const osValues = data.filter(d => d.OS !== null).map(d => d.OS);

    const calcStats = (values) => {
      if (values.length === 0) return null;
      const latest = values[values.length - 1];
      const first = values[0];
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const trend = values.length >= 2 ? latest - first : 0;

      return { latest, avg: avg.toFixed(1), max, min, trend };
    };

    return {
      OD: calcStats(odValues),
      OS: calcStats(osValues)
    };
  }, [data]);

  // Trend indicator
  const TrendIndicator = ({ trend }) => {
    if (trend > 2) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < -2) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">
        Aucune donnée de PIO disponible
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Pression Intraoculaire (PIO)
        </h3>
        {showStats && stats.OD && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-600">OD:</span>
              <span className={`font-medium ${stats.OD.latest > NORMAL_MAX ? 'text-red-600' : 'text-gray-900'}`}>
                {stats.OD.latest} mmHg
              </span>
              <TrendIndicator trend={stats.OD.trend} />
            </div>
            {stats.OS && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600">OS:</span>
                <span className={`font-medium ${stats.OS.latest > NORMAL_MAX ? 'text-red-600' : 'text-gray-900'}`}>
                  {stats.OS.latest} mmHg
                </span>
                <TrendIndicator trend={stats.OS.trend} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className={`px-4 py-4`} style={{ height: compact ? 200 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
              domain={[0, Math.max(35, ...chartData.map(d => Math.max(d.OD || 0, d.OS || 0)))]}
              ticks={[0, 10, 21, 30]}
              fontSize={12}
              stroke="#9ca3af"
              label={{ value: 'mmHg', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            />

            {/* Normal range background */}
            {showNormalRange && (
              <ReferenceArea
                y1={NORMAL_MIN}
                y2={NORMAL_MAX}
                fill="#10b981"
                fillOpacity={0.1}
                strokeOpacity={0}
              />
            )}

            {/* Reference lines */}
            <ReferenceLine
              y={NORMAL_MAX}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              label={{ value: 'Limite', position: 'right', fontSize: 10, fill: '#f59e0b' }}
            />
            <ReferenceLine
              y={CRITICAL_THRESHOLD}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: 'Critique', position: 'right', fontSize: 10, fill: '#ef4444' }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-sm text-gray-600">{value === 'OD' ? 'Œil Droit (OD)' : 'Œil Gauche (OS)'}</span>}
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
      {showStats && !compact && (
        <div className="px-4 py-3 bg-gray-50 border-t grid grid-cols-2 gap-4 text-sm">
          {['OD', 'OS'].map(eye => stats[eye] && (
            <div key={eye} className="flex items-center justify-between">
              <span className="text-gray-500">{eye}:</span>
              <div className="flex items-center gap-4">
                <span>Min: <strong>{stats[eye].min}</strong></span>
                <span>Max: <strong className={stats[eye].max > NORMAL_MAX ? 'text-red-600' : ''}>{stats[eye].max}</strong></span>
                <span>Moy: <strong>{stats[eye].avg}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
