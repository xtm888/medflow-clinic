import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Clock, CheckCircle, ChevronDown, ChevronUp, Eye, Beaker
} from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import patientService from '../../../services/patientService';
import api from '../../../services/apiConfig';

/**
 * LabSection - Lab orders and results summary with detailed values
 */
export default function LabSection({ patientId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [labResults, setLabResults] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedResults, setExpandedResults] = useState({});

  const loadData = async () => {
    if ((Array.isArray(labResults) && labResults.length > 0) ||
        (Array.isArray(labOrders) && labOrders.length > 0)) return;

    setLoading(true);
    try {
      // Fetch both lab results and lab orders in parallel
      const [resultsRes, ordersRes] = await Promise.all([
        patientService.getPatientLabResults(patientId).catch(() => ({ data: [] })),
        api.get(`/lab-orders/patient/${patientId}`).catch(() => ({ data: { data: [] } }))
      ]);

      // Handle nested data structure for results
      const resultsData = resultsRes.data?.data || resultsRes.data || resultsRes || [];
      setLabResults(Array.isArray(resultsData) ? resultsData : []);

      // Handle nested data structure for orders
      const ordersData = ordersRes.data?.data || ordersRes.data || [];
      setLabOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error('Error loading lab data:', err);
      setLabResults([]);
      setLabOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const toggleResultExpanded = (resultId) => {
    setExpandedResults(prev => ({ ...prev, [resultId]: !prev[resultId] }));
  };

  // Separate recent results and pending orders
  const recentResults = Array.isArray(labResults) ? labResults.slice(0, 10) : [];
  const pendingOrders = Array.isArray(labOrders) ? labOrders.filter(o => o.status !== 'completed') : [];
  const completedOrders = Array.isArray(labOrders) ? labOrders.filter(o => o.status === 'completed').slice(0, 5) : [];
  const hasData = recentResults.length > 0 || pendingOrders.length > 0 || completedOrders.length > 0;

  // Count abnormal results
  const abnormalCount = recentResults.reduce((count, result) => {
    const abnormals = result.results?.filter(r => r.flag && r.flag !== 'normal') || [];
    return count + abnormals.length;
  }, 0);

  return (
    <CollapsibleSection
      title="Laboratoire"
      icon={FlaskConical}
      iconColor="text-emerald-600"
      gradient="from-emerald-50 to-green-50"
      defaultExpanded={false}
      onExpand={loadData}
      loading={loading}
      badge={
        hasData && (
          <div className="flex items-center gap-2">
            {pendingOrders.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {pendingOrders.length} en attente
              </span>
            )}
            {abnormalCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {abnormalCount} anormal{abnormalCount > 1 ? 's' : ''}
              </span>
            )}
            {recentResults.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                {recentResults.length} résultats
              </span>
            )}
          </div>
        )
      }
      actions={
        <SectionActionButton
          icon={Plus}
          onClick={() => navigate(`/laboratory?patientId=${patientId}&action=new`)}
          variant="primary"
        >
          Demande
        </SectionActionButton>
      }
    >
      {!hasData ? (
        <SectionEmptyState
          icon={FlaskConical}
          message="Aucun résultat de laboratoire"
          action={
            <SectionActionButton
              icon={Plus}
              onClick={() => navigate(`/laboratory?patientId=${patientId}&action=new`)}
            >
              Demander un examen
            </SectionActionButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* CRITICAL ALERTS BANNER */}
          {(() => {
            // Collect all critical and abnormal values across all results
            const criticalValues = [];
            const abnormalValues = [];

            recentResults.forEach(result => {
              (result.results || []).forEach(r => {
                if (r.flag && (r.flag.includes('critical') || r.flag === 'panic')) {
                  criticalValues.push({
                    testName: result.test?.testName || result.testName || result.name,
                    parameter: r.parameter,
                    value: r.numericValue !== undefined ? r.numericValue : r.value,
                    unit: r.unit,
                    flag: r.flag,
                    date: result.performedAt || result.date
                  });
                } else if (r.flag && r.flag !== 'normal') {
                  abnormalValues.push({
                    testName: result.test?.testName || result.testName || result.name,
                    parameter: r.parameter,
                    value: r.numericValue !== undefined ? r.numericValue : r.value,
                    unit: r.unit,
                    flag: r.flag,
                    date: result.performedAt || result.date
                  });
                }
              });
            });

            if (criticalValues.length === 0 && abnormalValues.length === 0) return null;

            return (
              <div className="space-y-2">
                {/* Critical Values Alert */}
                {criticalValues.length > 0 && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
                      <div className="flex-1">
                        <h4 className="font-bold text-red-800 text-sm">
                          VALEURS CRITIQUES ({criticalValues.length})
                        </h4>
                        <ul className="mt-1 space-y-1">
                          {criticalValues.slice(0, 5).map((cv, idx) => (
                            <li key={idx} className="text-sm text-red-700 flex items-center gap-2">
                              <span className="font-medium">{cv.parameter || cv.testName}:</span>
                              <span className="font-bold">{cv.value} {cv.unit}</span>
                              <span className={`px-1.5 py-0.5 text-xs rounded ${
                                cv.flag === 'critical_high' ? 'bg-red-600 text-white' : 'bg-red-600 text-white'
                              }`}>
                                {cv.flag === 'critical_high' ? '↑ CRITIQUE' : '↓ CRITIQUE'}
                              </span>
                            </li>
                          ))}
                          {criticalValues.length > 5 && (
                            <li className="text-xs text-red-600">
                              +{criticalValues.length - 5} autres valeurs critiques
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Abnormal Values Alert */}
                {abnormalValues.length > 0 && (
                  <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r-lg">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-orange-800 text-sm">
                          Valeurs anormales ({abnormalValues.length})
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {abnormalValues.slice(0, 6).map((av, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
                                av.flag === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {av.flag === 'high' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {av.parameter || av.testName}: {av.value}
                            </span>
                          ))}
                          {abnormalValues.length > 6 && (
                            <span className="text-xs text-orange-600 self-center">
                              +{abnormalValues.length - 6} autres
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Examens en attente ({pendingOrders.length})
              </h4>
              <div className="space-y-2">
                {pendingOrders.map((order) => (
                  <LabOrderCard
                    key={order._id || order.id}
                    order={order}
                    formatDate={formatDate}
                    formatDateTime={formatDateTime}
                    expanded={expandedOrders[order._id || order.id]}
                    onToggle={() => toggleOrderExpanded(order._id || order.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Results with Details */}
          {recentResults.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Résultats récents ({recentResults.length})
              </h4>
              <div className="space-y-3">
                {recentResults.map((result) => (
                  <LabResultDetailCard
                    key={result._id || result.id}
                    result={result}
                    formatDate={formatDate}
                    formatDateTime={formatDateTime}
                    expanded={expandedResults[result._id || result.id]}
                    onToggle={() => toggleResultExpanded(result._id || result.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {(labResults.length > 10 || labOrders.length > 5) && (
            <button
              onClick={() => navigate(`/laboratory?patientId=${patientId}`)}
              className="w-full text-center text-sm text-emerald-600 hover:text-emerald-700 py-2 flex items-center justify-center gap-1"
            >
              <Eye className="h-4 w-4" />
              Voir tous les examens →
            </button>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// Lab order card component with expanded details
function LabOrderCard({ order, formatDate, formatDateTime, expanded, onToggle }) {
  const statusConfig = {
    ordered: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Commandé' },
    collected: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Prélevé' },
    received: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Reçu' },
    'in-progress': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En cours' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Terminé' }
  };

  const priorityConfig = {
    stat: { bg: 'bg-red-100', text: 'text-red-700', label: 'STAT' },
    urgent: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Urgent' },
    routine: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Routine' }
  };

  const status = statusConfig[order.status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: order.status };
  const priority = priorityConfig[order.priority] || priorityConfig.routine;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <div
        className="p-3 cursor-pointer hover:bg-yellow-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-gray-900">{order.orderId}</span>
            {order.priority && order.priority !== 'routine' && (
              <span className={`px-1.5 py-0.5 text-xs rounded ${priority.bg} ${priority.text}`}>
                {priority.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {/* Test summary */}
        <div className="text-sm text-gray-600">
          {order.tests?.length === 1 ? (
            <span>• {order.tests[0].testName || order.tests[0].name}</span>
          ) : (
            <span>{order.tests?.length || 0} tests demandés</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">{formatDate(order.orderDate || order.createdAt)}</p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-yellow-200 bg-white p-3 space-y-3">
          {/* All tests */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Tests demandés:</p>
            <div className="space-y-1">
              {order.tests?.map((test, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">• {test.testName || test.name}</span>
                  {test.category && (
                    <span className="text-xs text-gray-400">{test.category}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Clinical indication */}
          {order.clinicalIndication && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Indication clinique:</p>
              <p className="text-sm text-gray-700">{order.clinicalIndication}</p>
            </div>
          )}

          {/* Fasting requirement */}
          {order.fasting?.required && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-orange-600">⚠️ À jeun requis</span>
              {order.fasting.hours && <span className="text-gray-500">({order.fasting.hours}h)</span>}
            </div>
          )}

          {/* Specimen info if collected */}
          {order.specimen?.collectedAt && (
            <div className="bg-blue-50 p-2 rounded text-sm">
              <p className="text-xs font-medium text-blue-600 mb-1">Prélèvement</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <span>Collecté: {formatDateTime(order.specimen.collectedAt)}</span>
                {order.specimen.barcode && <span>Code: {order.specimen.barcode}</span>}
              </div>
            </div>
          )}

          {/* Ordered by */}
          {order.orderedBy && (
            <p className="text-xs text-gray-400">
              Prescrit par: Dr. {order.orderedBy.lastName || order.orderedBy.name || 'N/A'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Lab result detail card with all measured values
function LabResultDetailCard({ result, formatDate, formatDateTime, expanded, onToggle }) {
  // Get test info
  const testName = result.test?.testName || result.testName || result.name || 'Test';
  const testCode = result.test?.testCode || result.testCode || result.code;

  // Get results array (may be nested or flat)
  const resultsArray = result.results || [];

  // Count abnormal values
  const abnormalValues = resultsArray.filter(r => r.flag && r.flag !== 'normal');
  const hasAbnormal = abnormalValues.length > 0;
  const hasCritical = resultsArray.some(r => r.flag && (r.flag.includes('critical') || r.flag === 'panic'));

  // Status config
  const statusConfig = {
    preliminary: { label: 'Préliminaire', color: 'text-yellow-600' },
    partial: { label: 'Partiel', color: 'text-orange-600' },
    final: { label: 'Final', color: 'text-green-600' },
    corrected: { label: 'Corrigé', color: 'text-blue-600' },
    amended: { label: 'Amendé', color: 'text-purple-600' }
  };

  const resultStatus = statusConfig[result.status] || { label: result.status, color: 'text-gray-600' };

  return (
    <div className={`rounded-lg border overflow-hidden ${
      hasCritical ? 'bg-red-50 border-red-300' :
      hasAbnormal ? 'bg-orange-50 border-orange-200' :
      'bg-white border-gray-200'
    }`}>
      {/* Header - always visible */}
      <div
        className={`p-3 cursor-pointer hover:bg-opacity-80 transition-colors ${
          hasCritical ? 'hover:bg-red-100' : hasAbnormal ? 'hover:bg-orange-100' : 'hover:bg-gray-50'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FlaskConical className={`h-4 w-4 ${hasCritical ? 'text-red-600' : hasAbnormal ? 'text-orange-600' : 'text-emerald-600'}`} />
            <span className="font-medium text-gray-900">{testName}</span>
            {testCode && <span className="text-xs text-gray-400">({testCode})</span>}
          </div>
          <div className="flex items-center gap-2">
            {hasCritical && (
              <span className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> CRITIQUE
              </span>
            )}
            {hasAbnormal && !hasCritical && (
              <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                {abnormalValues.length} anormal{abnormalValues.length > 1 ? 's' : ''}
              </span>
            )}
            <span className={`text-xs ${resultStatus.color}`}>{resultStatus.label}</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {/* Preview of first 2 values */}
        {resultsArray.length > 0 && !expanded && (
          <div className="flex flex-wrap gap-3 mt-2">
            {resultsArray.slice(0, 3).map((r, idx) => (
              <ResultValueBadge key={idx} result={r} compact />
            ))}
            {resultsArray.length > 3 && (
              <span className="text-xs text-gray-400 self-center">+{resultsArray.length - 3} autres</span>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1">{formatDate(result.performedAt || result.date || result.createdAt)}</p>
      </div>

      {/* Expanded details - all values */}
      {expanded && (
        <div className="border-t border-gray-200 bg-white">
          {/* All result values */}
          <div className="p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Valeurs mesurées:</p>
            <div className="space-y-2">
              {resultsArray.length > 0 ? (
                resultsArray.map((r, idx) => (
                  <ResultValueRow key={idx} result={r} />
                ))
              ) : (
                // Fallback for flat result structure
                <ResultValueRow result={{
                  parameter: testName,
                  value: result.value,
                  numericValue: result.value,
                  unit: result.unit,
                  referenceRange: result.referenceRange,
                  flag: result.isAbnormal ? 'abnormal' : 'normal'
                }} />
              )}
            </div>
          </div>

          {/* Interpretation */}
          {result.overallInterpretation && (
            <div className="px-3 pb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Interprétation:</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{result.overallInterpretation}</p>
            </div>
          )}

          {/* Comments */}
          {result.comments && (
            <div className="px-3 pb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Commentaires:</p>
              <p className="text-sm text-gray-600">{result.comments}</p>
            </div>
          )}

          {/* Performed/Verified by */}
          <div className="px-3 pb-3 flex flex-wrap gap-4 text-xs text-gray-400">
            {result.performedBy && (
              <span>Réalisé par: {result.performedBy.firstName} {result.performedBy.lastName}</span>
            )}
            {result.verifiedBy && (
              <span>Vérifié par: {result.verifiedBy.firstName} {result.verifiedBy.lastName}</span>
            )}
            {result.performedAt && (
              <span>{formatDateTime(result.performedAt)}</span>
            )}
          </div>

          {/* Analyzer/Reagent lot info if available */}
          {(result.analyzerInfo || result.reagentLotInfo) && (
            <div className="px-3 pb-3 text-xs text-gray-400 bg-gray-50 border-t">
              <div className="py-2 flex flex-wrap gap-4">
                {result.analyzerInfo && (
                  <span>Analyseur: {result.analyzerInfo.name || result.analyzerInfo.code}</span>
                )}
                {result.reagentLotInfo && (
                  <span>Lot: {result.reagentLotInfo.lotNumber}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual result value row
function ResultValueRow({ result }) {
  const flagConfig = {
    'normal': { bg: 'bg-green-100', text: 'text-green-700', label: 'Normal' },
    'low': { bg: 'bg-blue-100', text: 'text-blue-700', label: '↓ Bas', icon: TrendingDown },
    'high': { bg: 'bg-orange-100', text: 'text-orange-700', label: '↑ Haut', icon: TrendingUp },
    'critical-low': { bg: 'bg-red-600', text: 'text-white', label: '⚠ Critique Bas' },
    'critical-high': { bg: 'bg-red-600', text: 'text-white', label: '⚠ Critique Haut' },
    'abnormal': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Anormal' },
    'panic': { bg: 'bg-red-600', text: 'text-white', label: '⚠ PANIQUE' }
  };

  const flag = flagConfig[result.flag] || flagConfig.normal;
  const isAbnormal = result.flag && result.flag !== 'normal';
  const isCritical = result.flag && (result.flag.includes('critical') || result.flag === 'panic');

  // Get reference range text
  const refRange = result.referenceRange?.text ||
    (result.referenceRange?.low !== undefined && result.referenceRange?.high !== undefined
      ? `${result.referenceRange.low} - ${result.referenceRange.high}`
      : null);

  return (
    <div className={`flex items-center justify-between p-2 rounded ${
      isCritical ? 'bg-red-100' : isAbnormal ? 'bg-orange-50' : 'bg-gray-50'
    }`}>
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-700">{result.parameter}</span>
      </div>
      <div className="flex items-center gap-3">
        {/* Value and unit */}
        <div className="text-right">
          <span className={`text-lg font-bold ${
            isCritical ? 'text-red-600' : isAbnormal ? 'text-orange-600' : 'text-gray-900'
          }`}>
            {result.numericValue !== undefined ? result.numericValue : result.value}
          </span>
          {result.unit && <span className="text-sm text-gray-500 ml-1">{result.unit}</span>}
        </div>

        {/* Reference range */}
        {refRange && (
          <div className="text-xs text-gray-400 min-w-[80px] text-right">
            Réf: {refRange}
          </div>
        )}

        {/* Flag badge */}
        <span className={`px-2 py-0.5 text-xs rounded ${flag.bg} ${flag.text} min-w-[60px] text-center`}>
          {flag.label}
        </span>

        {/* Delta/trend */}
        {result.delta?.trend && (
          <span className="ml-1">
            {result.delta.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-red-500" />}
            {result.delta.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-green-500" />}
            {result.delta.trend === 'stable' && <Minus className="h-4 w-4 text-gray-400" />}
          </span>
        )}
      </div>
    </div>
  );
}

// Compact result value badge for preview
function ResultValueBadge({ result, compact }) {
  const isAbnormal = result.flag && result.flag !== 'normal';
  const isCritical = result.flag && (result.flag.includes('critical') || result.flag === 'panic');

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
      isCritical ? 'bg-red-100 text-red-700' :
      isAbnormal ? 'bg-orange-100 text-orange-700' :
      'bg-gray-100 text-gray-700'
    }`}>
      <span className="font-medium">{result.parameter || 'Valeur'}:</span>
      <span className="font-bold">
        {result.numericValue !== undefined ? result.numericValue : result.value}
      </span>
      {result.unit && <span className="text-xs opacity-75">{result.unit}</span>}
      {isAbnormal && <AlertTriangle className="h-3 w-3" />}
    </div>
  );
}
