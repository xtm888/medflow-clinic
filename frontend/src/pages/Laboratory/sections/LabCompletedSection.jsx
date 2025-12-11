import { Check, User, Eye, Download, Info, ArrowUp, ArrowDown, AlertTriangle, Calendar } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import { getPatientName as formatPatientName } from '../../../utils/formatters';

/**
 * LabCompletedSection - Completed orders with results
 */
export default function LabCompletedSection({
  completedOrders,
  patients,
  onViewResults,
  onPrintResults,
  onViewPatient,
  formatDate
}) {
  // Use shared formatter, with fallback to patients array lookup
  const getPatientName = (patientId) => {
    if (!patientId) return 'Patient inconnu';
    if (typeof patientId === 'object') {
      return formatPatientName(patientId);
    }
    const patient = patients.find(p => (p._id || p.id) === patientId);
    return patient ? formatPatientName(patient) : 'Patient inconnu';
  };

  const getAbnormalFlag = (flag) => {
    if (!flag || flag === 'normal') return null;
    if (flag === 'high' || flag === 'critical_high') {
      return <ArrowUp className={`h-4 w-4 ${flag.includes('critical') ? 'text-red-600' : 'text-orange-500'}`} />;
    }
    if (flag === 'low' || flag === 'critical_low') {
      return <ArrowDown className={`h-4 w-4 ${flag.includes('critical') ? 'text-red-600' : 'text-orange-500'}`} />;
    }
    return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  };

  const abnormalCount = completedOrders.filter(o => o.isAbnormal).length;
  const criticalCount = completedOrders.filter(o => o.isCritical).length;

  return (
    <CollapsibleSection
      title="Examens Terminés"
      icon={Check}
      iconColor="text-green-600"
      gradient="from-green-50 to-emerald-50"
      defaultExpanded={false}
      badge={
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
              {criticalCount} critique
            </span>
          )}
          {abnormalCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
              {abnormalCount} anormal
            </span>
          )}
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
            {completedOrders.length} terminés
          </span>
        </div>
      }
    >
      {completedOrders.length === 0 ? (
        <SectionEmptyState
          icon={Check}
          message="Aucun examen terminé"
        />
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {completedOrders.map(order => (
            <div
              key={order._id || order.id}
              className={`p-3 rounded-lg border transition-colors ${
                order.isCritical
                  ? 'border-red-200 bg-red-50'
                  : order.isAbnormal
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <h4 className="font-medium text-gray-900">
                      {getPatientName(order.patient)}
                    </h4>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                      Terminé
                    </span>
                    {order.isCritical && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        {getAbnormalFlag(order.abnormalFlag)}
                        Critique
                      </span>
                    )}
                    {order.isAbnormal && !order.isCritical && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                        {getAbnormalFlag(order.abnormalFlag)}
                        Anormal
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 ml-6">
                    {order.testName || order.tests?.map(t => t.name).join(', ') || 'Tests'}
                  </p>

                  {/* Result preview */}
                  {order.results !== undefined && order.results !== null && (
                    <div className="flex items-center gap-2 mt-1 ml-6">
                      <span className="text-sm font-medium">
                        Résultat: {order.results} {order.unit || ''}
                      </span>
                      {getAbnormalFlag(order.abnormalFlag)}
                      {order.referenceRange && (
                        <span className="text-xs text-gray-500">
                          (Réf: {order.referenceRange})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Component results summary */}
                  {order.componentResults && order.componentResults.length > 0 && (
                    <div className="mt-1 ml-6 text-xs text-gray-500">
                      {order.componentResults.length} composants
                      {order.componentResults.filter(c => c.isAbnormal).length > 0 && (
                        <span className="text-orange-600 ml-1">
                          ({order.componentResults.filter(c => c.isAbnormal).length} anormaux)
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-1 ml-6 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Complété: {formatDate(order.completedAt || order.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={() => {
                      const patient = typeof order.patient === 'object'
                        ? order.patient
                        : patients.find(p => (p._id || p.id) === order.patient);
                      if (patient) onViewPatient?.(patient);
                    }}
                    className="p-1.5 text-purple-600 hover:bg-purple-100 rounded"
                    title="Voir patient"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onViewResults?.(order)}
                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                    title="Voir résultats"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onPrintResults?.(order)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                    title="Télécharger PDF"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
