/**
 * CupDiscTrendChart
 *
 * Line chart for visualizing Cup/Disc ratio trends over time.
 * Important for glaucoma monitoring.
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
import { AlertTriangle, TrendingUp, Minus, Eye } from 'lucide-react';

// Thresholds
const SUSPECT_THRESHOLD = 0.5;
const WARNING_THRESHOLD = 0.7;
const ASYMMETRY_THRESHOLD = 0.2;

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const odVal = payload.find(p => p.dataKey === 'OD')?.value;
  const osVal = payload.find(p => p.dataKey === 'OS')?.value;
  const asymmetry = odVal !== null && osVal !== null ? Math.abs(odVal - osVal) : null;

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
          <span className={`font-medium ${entry.value > WARNING_THRESHOLD ? 'text-red-600' : entry.value > SUSPECT_THRESHOLD ? 'text-orange-600' : 'text-gray-900'}`}>
            {entry.value !== null ? entry.value.toFixed(2) : 'N/A'}
          </span>
          {entry.value > WARNING_THRESHOLD && (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          )}
        </div>
      ))}
      {asymmetry !== null && asymmetry > ASYMMETRY_THRESHOLD && (
        <div className="mt-2 pt-2 border-t text-orange-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          <span>Asymétrie: {asymmetry.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

export default function CupDiscTrendChart({
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
    const calcStats = (key) => {
      const values = chartData.filter(d => d[key] !== null && d[key] !== undefined);
      if (values.length === 0) return null;

      const numValues = values.map(v => v[key]);
      const latest = numValues[numValues.length - 1];
      const first = numValues[0];
      const max = Math.max(...numValues);
      const change = values.length >= 2 ? latest - first : 0;

      return {
        latest,
        first,
        max,
        change,
        isProgressing: change > 0.05,
        isElevated: latest > WARNING_THRESHOLD,
        isSuspect: latest > SUSPECT_THRESHOLD && latest <= WARNING_THRESHOLD
      };
    };

    const od = calcStats('OD');
    const os = calcStats('OS');

    // Calculate asymmetry
    const asymmetry = od && os ? Math.abs(od.latest - os.latest) : null;

    return {
      OD: od,
      OS: os,
      asymmetry,
      hasAsymmetry: asymmetry !== null && asymmetry > ASYMMETRY_THRESHOLD
    };
  }, [chartData]);

  // Status indicator
  const StatusBadge = ({ stat }) => {
    if (!stat) return null;

    if (stat.isElevated) {
      return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Élevé</span>;
    }
    if (stat.isSuspect) {
      return <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">Suspect</span>;
    }
    return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Normal</span>;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">
        <Eye className="h-5 w-5 mr-2" />
        Aucune donnée de rapport C/D disponible
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">
            Rapport Cup/Disc
          </h3>
          <p className="text-xs text-gray-500">
            Surveillance glaucome - Valeurs &gt; 0.7 à surveiller
          </p>
        </div>
        {showStats && (
          <div className="flex items-center gap-4">
            {['OD', 'OS'].map(eye => stats[eye] && (
              <div key={eye} className="flex items-center gap-2 text-sm">
                <span className={`w-3 h-3 rounded-full ${eye === 'OD' ? 'bg-blue-500' : 'bg-green-500'}`} />
                <span className="text-gray-600">{eye}:</span>
                <span className={`font-medium ${stats[eye].isElevated ? 'text-red-600' : ''}`}>
                  {stats[eye].latest?.toFixed(2)}
                </span>
                <StatusBadge stat={stats[eye]} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asymmetry Warning */}
      {stats.hasAsymmetry && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2 text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          <span>Asymétrie significative détectée: {stats.asymmetry.toFixed(2)} (&gt; {ASYMMETRY_THRESHOLD})</span>
        </div>
      )}

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
              domain={[0, 1]}
              ticks={[0, 0.3, 0.5, 0.7, 0.9, 1.0]}
              fontSize={12}
              stroke="#9ca3af"
            />

            {/* Normal range background */}
            {showNormalRange && (
              <ReferenceArea
                y1={0}
                y2={SUSPECT_THRESHOLD}
                fill="#10b981"
                fillOpacity={0.1}
                strokeOpacity={0}
              />
            )}

            {/* Suspect zone */}
            {showNormalRange && (
              <ReferenceArea
                y1={SUSPECT_THRESHOLD}
                y2={WARNING_THRESHOLD}
                fill="#f59e0b"
                fillOpacity={0.1}
                strokeOpacity={0}
              />
            )}

            {/* Reference lines */}
            <ReferenceLine
              y={SUSPECT_THRESHOLD}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              label={{ value: 'Suspect', position: 'right', fontSize: 10, fill: '#f59e0b' }}
            />
            <ReferenceLine
              y={WARNING_THRESHOLD}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: 'Élevé', position: 'right', fontSize: 10, fill: '#ef4444' }}
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
      {showStats && !compact && (
        <div className="px-4 py-3 bg-gray-50 border-t text-sm">
          <div className="grid grid-cols-3 gap-4">
            {['OD', 'OS'].map(eye => stats[eye] && (
              <div key={eye}>
                <span className="font-medium text-gray-700">{eye}:</span>
                <div className="text-gray-600 mt-1">
                  {stats[eye].change !== 0 && (
                    <span className={stats[eye].isProgressing ? 'text-red-600' : ''}>
                      Δ {stats[eye].change > 0 ? '+' : ''}{stats[eye].change.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div>
              <span className="font-medium text-gray-700">Asymétrie:</span>
              <div className={`mt-1 ${stats.hasAsymmetry ? 'text-orange-600' : 'text-gray-600'}`}>
                {stats.asymmetry?.toFixed(2) || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
