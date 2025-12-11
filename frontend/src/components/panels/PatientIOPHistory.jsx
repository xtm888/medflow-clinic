import { useState, useEffect, useMemo } from 'react';
import {
  Eye, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Calendar, Activity, Glasses, Target, ChevronRight
} from 'lucide-react';
import { Panel, SectionCard, StatBox, AlertBadge } from './PanelBase';
import patientService from '../../services/patientService';

/**
 * Patient IOP & Refraction History Panel
 * Ophthalmology-specific trend visualization
 */
export default function PatientIOPHistory({
  patient,
  patientId,
  variant = 'sidebar',
  onClose,
  onNavigateToExams,
  months = 12 // How many months of history to show
}) {
  const [loading, setLoading] = useState(false);
  const [examHistory, setExamHistory] = useState([]);
  const [refractionHistory, setRefractionHistory] = useState([]);

  useEffect(() => {
    const id = patientId || patient?._id || patient?.id;
    if (id) {
      fetchHistory(id);
    }
  }, [patientId, patient]);

  const fetchHistory = async (id) => {
    setLoading(true);
    try {
      // Fetch patient visits/exams
      const visitsRes = await patientService.getPatientVisits?.(id).catch(() => ({ data: [] }));
      const visits = visitsRes?.data || visitsRes || [];

      // Extract IOP measurements
      const iopData = visits
        .filter(v => v.vitalSigns?.iop?.od || v.vitalSigns?.iop?.og || v.examination?.iop)
        .map(v => ({
          date: new Date(v.date || v.createdAt),
          od: v.vitalSigns?.iop?.od || v.examination?.iop?.od,
          og: v.vitalSigns?.iop?.og || v.examination?.iop?.og,
          method: v.vitalSigns?.iop?.method || 'NCT',
          visitId: v._id
        }))
        .filter(v => v.date > new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000))
        .sort((a, b) => a.date - b.date);

      setExamHistory(iopData);

      // Extract refraction data
      const refractionData = visits
        .filter(v => v.examination?.refraction || v.objectiveRefraction || v.subjectiveRefraction)
        .map(v => {
          const ref = v.examination?.refraction || v.objectiveRefraction || v.subjectiveRefraction;
          return {
            date: new Date(v.date || v.createdAt),
            od: {
              sphere: ref?.od?.sphere || ref?.rightEye?.sphere,
              cylinder: ref?.od?.cylinder || ref?.rightEye?.cylinder,
              axis: ref?.od?.axis || ref?.rightEye?.axis,
              va: ref?.od?.va || ref?.rightEye?.visualAcuity
            },
            og: {
              sphere: ref?.og?.sphere || ref?.leftEye?.sphere,
              cylinder: ref?.og?.cylinder || ref?.leftEye?.cylinder,
              axis: ref?.og?.axis || ref?.leftEye?.axis,
              va: ref?.og?.va || ref?.leftEye?.visualAcuity
            },
            visitId: v._id
          };
        })
        .filter(v => v.date > new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000))
        .sort((a, b) => a.date - b.date);

      setRefractionHistory(refractionData);

    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate IOP statistics
  const iopStats = useMemo(() => {
    if (examHistory.length === 0) return null;

    const odValues = examHistory.map(e => e.od).filter(Boolean);
    const ogValues = examHistory.map(e => e.og).filter(Boolean);

    const latest = examHistory[examHistory.length - 1];
    const previous = examHistory.length > 1 ? examHistory[examHistory.length - 2] : null;

    const calcStats = (values) => ({
      current: values[values.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      trend: values.length > 1
        ? values[values.length - 1] - values[values.length - 2]
        : 0
    });

    return {
      od: odValues.length > 0 ? calcStats(odValues) : null,
      og: ogValues.length > 0 ? calcStats(ogValues) : null,
      latest,
      previous,
      totalMeasurements: examHistory.length
    };
  }, [examHistory]);

  // Determine if IOP is concerning
  const isIOPConcerning = (value) => value > 21;
  const isIOPCritical = (value) => value > 25;

  // Get trend indicator
  const getTrendIcon = (trend) => {
    if (trend > 2) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < -2) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <Panel title="Historique PIO" icon={Eye} variant={variant} onClose={onClose}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </Panel>
    );
  }

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';

  return (
    <Panel
      title="Historique Ophtalmologique"
      icon={Eye}
      variant={variant}
      onClose={onClose}
    >
      {/* Current IOP Values with Alert */}
      {iopStats?.latest && (
        <SectionCard
          title="PIO Actuelle"
          icon={Activity}
          alert={isIOPConcerning(iopStats.latest.od) || isIOPConcerning(iopStats.latest.og)}
          alertType={isIOPCritical(iopStats.latest.od) || isIOPCritical(iopStats.latest.og) ? 'danger' : 'warning'}
        >
          <div className="grid grid-cols-2 gap-3">
            {/* OD */}
            <div className={`p-3 rounded-lg text-center ${
              isIOPCritical(iopStats.latest.od) ? 'bg-red-100 border border-red-300' :
              isIOPConcerning(iopStats.latest.od) ? 'bg-yellow-100 border border-yellow-300' :
              'bg-green-50 border border-green-200'
            }`}>
              <div className="text-xs text-gray-500 mb-1">OD (Droit)</div>
              <div className="flex items-center justify-center gap-1">
                <span className={`text-2xl font-bold ${
                  isIOPCritical(iopStats.latest.od) ? 'text-red-700' :
                  isIOPConcerning(iopStats.latest.od) ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {iopStats.latest.od || '-'}
                </span>
                {iopStats.od?.trend !== 0 && getTrendIcon(iopStats.od.trend)}
              </div>
              <div className="text-xs text-gray-500">mmHg</div>
              {iopStats.previous && iopStats.previous.od && (
                <div className="text-xs text-gray-400 mt-1">
                  Prev: {iopStats.previous.od}
                </div>
              )}
            </div>

            {/* OG */}
            <div className={`p-3 rounded-lg text-center ${
              isIOPCritical(iopStats.latest.og) ? 'bg-red-100 border border-red-300' :
              isIOPConcerning(iopStats.latest.og) ? 'bg-yellow-100 border border-yellow-300' :
              'bg-green-50 border border-green-200'
            }`}>
              <div className="text-xs text-gray-500 mb-1">OG (Gauche)</div>
              <div className="flex items-center justify-center gap-1">
                <span className={`text-2xl font-bold ${
                  isIOPCritical(iopStats.latest.og) ? 'text-red-700' :
                  isIOPConcerning(iopStats.latest.og) ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {iopStats.latest.og || '-'}
                </span>
                {iopStats.og?.trend !== 0 && getTrendIcon(iopStats.og.trend)}
              </div>
              <div className="text-xs text-gray-500">mmHg</div>
              {iopStats.previous && iopStats.previous.og && (
                <div className="text-xs text-gray-400 mt-1">
                  Prev: {iopStats.previous.og}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-400 text-center mt-2">
            Mesure du {iopStats.latest.date.toLocaleDateString('fr-FR')}
            {iopStats.latest.method && ` (${iopStats.latest.method})`}
          </div>
        </SectionCard>
      )}

      {/* IOP Trend Chart */}
      {examHistory.length > 1 && (
        <SectionCard title="Tendance PIO" icon={TrendingUp}>
          <IOPTrendChart data={examHistory} />

          {/* Statistics */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="text-xs text-gray-500">Moy OD</div>
              <div className="font-semibold text-sm">{iopStats.od?.avg?.toFixed(1) || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Moy OG</div>
              <div className="font-semibold text-sm">{iopStats.og?.avg?.toFixed(1) || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Max OD</div>
              <div className="font-semibold text-sm">{iopStats.od?.max || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Max OG</div>
              <div className="font-semibold text-sm">{iopStats.og?.max || '-'}</div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Refraction History */}
      {refractionHistory.length > 0 && (
        <SectionCard title="Historique Refraction" icon={Glasses}>
          <div className="space-y-2">
            {refractionHistory.slice(-3).reverse().map((ref, idx) => (
              <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">
                  {ref.date.toLocaleDateString('fr-FR')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">OD:</span>
                    <span className="ml-1 font-mono">
                      {formatRefraction(ref.od)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">OG:</span>
                    <span className="ml-1 font-mono">
                      {formatRefraction(ref.og)}
                    </span>
                  </div>
                </div>
                {(ref.od?.va || ref.og?.va) && (
                  <div className="grid grid-cols-2 gap-2 text-xs mt-1 pt-1 border-t border-gray-200">
                    <div>
                      <span className="text-gray-500">AV OD:</span>
                      <span className="ml-1 font-medium">{ref.od?.va || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">AV OG:</span>
                      <span className="ml-1 font-medium">{ref.og?.va || '-'}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {refractionHistory.length > 3 && onNavigateToExams && (
            <button
              onClick={() => onNavigateToExams(patient?._id)}
              className="mt-2 w-full text-xs text-purple-600 hover:text-purple-800 flex items-center justify-center gap-1"
            >
              Voir tout l'historique ({refractionHistory.length}) <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </SectionCard>
      )}

      {/* Reference Ranges */}
      <SectionCard title="Valeurs de reference" icon={Target} compact>
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>PIO normale:</span>
            <span className="font-medium text-green-600">10-21 mmHg</span>
          </div>
          <div className="flex justify-between">
            <span>PIO suspecte:</span>
            <span className="font-medium text-yellow-600">21-25 mmHg</span>
          </div>
          <div className="flex justify-between">
            <span>PIO elevee:</span>
            <span className="font-medium text-red-600">&gt;25 mmHg</span>
          </div>
        </div>
      </SectionCard>

      {/* Empty State */}
      {examHistory.length === 0 && refractionHistory.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          <Eye className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          Aucun historique ophtalmologique disponible
        </div>
      )}
    </Panel>
  );
}

/**
 * IOP Trend Chart Component
 */
function IOPTrendChart({ data, height = 120 }) {
  if (!data || data.length < 2) return null;

  const padding = { top: 10, right: 10, bottom: 25, left: 30 };
  const chartWidth = 280;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Get all values for scale
  const allValues = data.flatMap(d => [d.od, d.og]).filter(Boolean);
  const minVal = Math.min(...allValues, 10);
  const maxVal = Math.max(...allValues, 25);
  const yRange = maxVal - minVal || 10;

  // Scale functions
  const xScale = (idx) => padding.left + (idx / (data.length - 1)) * innerWidth;
  const yScale = (val) => padding.top + innerHeight - ((val - minVal) / yRange) * innerHeight;

  // Generate paths
  const generatePath = (eye) => {
    const points = data
      .map((d, idx) => d[eye] ? `${xScale(idx)},${yScale(d[eye])}` : null)
      .filter(Boolean);
    return points.length > 1 ? `M${points.join(' L')}` : '';
  };

  const odPath = generatePath('od');
  const ogPath = generatePath('og');

  // Reference line at 21 mmHg
  const refLineY = yScale(21);

  return (
    <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
      {/* Reference line */}
      <line
        x1={padding.left}
        y1={refLineY}
        x2={chartWidth - padding.right}
        y2={refLineY}
        stroke="#fbbf24"
        strokeWidth="1"
        strokeDasharray="4,4"
      />
      <text x={chartWidth - padding.right + 2} y={refLineY + 3} fontSize="8" fill="#fbbf24">21</text>

      {/* Y-axis labels */}
      {[minVal, (minVal + maxVal) / 2, maxVal].map((val, idx) => (
        <text
          key={idx}
          x={padding.left - 5}
          y={yScale(val) + 3}
          fontSize="9"
          fill="#9ca3af"
          textAnchor="end"
        >
          {Math.round(val)}
        </text>
      ))}

      {/* X-axis labels (dates) */}
      {data.filter((_, idx) => idx === 0 || idx === data.length - 1).map((d, idx) => (
        <text
          key={idx}
          x={idx === 0 ? padding.left : chartWidth - padding.right}
          y={chartHeight - 5}
          fontSize="8"
          fill="#9ca3af"
          textAnchor={idx === 0 ? 'start' : 'end'}
        >
          {d.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
        </text>
      ))}

      {/* OD Line (solid) */}
      {odPath && (
        <path d={odPath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
      )}

      {/* OG Line (dashed) */}
      {ogPath && (
        <path d={ogPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="4,2" strokeLinecap="round" />
      )}

      {/* Data points */}
      {data.map((d, idx) => (
        <g key={idx}>
          {d.od && (
            <circle
              cx={xScale(idx)}
              cy={yScale(d.od)}
              r={3}
              fill={d.od > 21 ? '#ef4444' : '#8b5cf6'}
            />
          )}
          {d.og && (
            <circle
              cx={xScale(idx)}
              cy={yScale(d.og)}
              r={3}
              fill={d.og > 21 ? '#ef4444' : '#06b6d4'}
            />
          )}
        </g>
      ))}

      {/* Legend */}
      <g transform={`translate(${padding.left}, ${chartHeight - 12})`}>
        <line x1="0" y1="0" x2="15" y2="0" stroke="#8b5cf6" strokeWidth="2" />
        <text x="18" y="3" fontSize="8" fill="#6b7280">OD</text>
        <line x1="40" y1="0" x2="55" y2="0" stroke="#06b6d4" strokeWidth="2" strokeDasharray="4,2" />
        <text x="58" y="3" fontSize="8" fill="#6b7280">OG</text>
      </g>
    </svg>
  );
}

/**
 * Format refraction string
 */
function formatRefraction(eye) {
  if (!eye || (!eye.sphere && !eye.cylinder)) return '-';

  const sphere = eye.sphere ? (eye.sphere > 0 ? `+${eye.sphere}` : eye.sphere) : '0';
  const cylinder = eye.cylinder ? (eye.cylinder > 0 ? `+${eye.cylinder}` : eye.cylinder) : '';
  const axis = eye.axis && eye.cylinder ? `x${eye.axis}` : '';

  return `${sphere}${cylinder ? ` ${cylinder}` : ''}${axis ? ` ${axis}°` : ''}`.trim();
}
