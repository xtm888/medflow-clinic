import { useState } from 'react';
import { Clock, User, Calendar, FlaskConical, Info, AlertCircle, Beaker, CheckCircle, XCircle } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import { getPatientName as formatPatientName } from '../../../utils/formatters';

/**
 * LabPendingSection - Pending lab orders with actions
 */
export default function LabPendingSection({
  pendingOrders,
  patients,
  onUpdateStatus,
  onReject,
  onOpenResultEntry,
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

  // Helper to get test names from different formats
  const getTestNames = (order) => {
    if (!order.tests || order.tests.length === 0) return 'Tests non spécifiés';
    return order.tests.map(t => t.testName || t.name || t.code).filter(Boolean).join(', ');
  };

  // Get status display
  const getStatusDisplay = (status) => {
    const statusMap = {
      'ordered': { label: 'Commandé', bg: 'bg-yellow-100', text: 'text-yellow-700' },
      'collected': { label: 'Prélevé', bg: 'bg-blue-100', text: 'text-blue-700' },
      'received': { label: 'Reçu', bg: 'bg-indigo-100', text: 'text-indigo-700' },
      'in-progress': { label: 'En cours', bg: 'bg-purple-100', text: 'text-purple-700' }
    };
    return statusMap[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  };

  const urgentCount = pendingOrders.filter(o => o.priority === 'urgent' || o.priority === 'stat').length;

  return (
    <CollapsibleSection
      title="Demandes en Attente"
      icon={Clock}
      iconColor="text-yellow-600"
      gradient="from-yellow-50 to-amber-50"
      defaultExpanded={true}
      badge={
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {urgentCount} urgent
            </span>
          )}
          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
            {pendingOrders.length} en attente
          </span>
        </div>
      }
    >
      {pendingOrders.length === 0 ? (
        <SectionEmptyState
          icon={Clock}
          message="Aucune demande en attente"
        />
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {/* Urgent orders first */}
          {pendingOrders
            .sort((a, b) => {
              if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
              if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
              return new Date(b.createdAt) - new Date(a.createdAt);
            })
            .map(order => {
              const status = getStatusDisplay(order.status);
              const isUrgent = order.priority === 'urgent' || order.priority === 'stat';

              return (
                <div
                  key={order._id || order.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isUrgent
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <h4 className="font-medium text-gray-900 truncate">
                          {getPatientName(order.patient)}
                        </h4>
                        {/* Order ID if available */}
                        {order.orderId && (
                          <span className="text-xs text-gray-400 font-mono">
                            {order.orderId}
                          </span>
                        )}
                        {/* Priority badge */}
                        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                          isUrgent
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isUrgent ? (order.priority === 'stat' ? 'STAT' : 'Urgent') : 'Routine'}
                        </span>
                        {/* Status badge */}
                        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                      {/* Tests list */}
                      <div className="ml-6 space-y-1">
                        {order.tests?.slice(0, 3).map((test, idx) => (
                          <p key={idx} className="text-sm text-gray-600">
                            • {test.testName || test.name || test.code}
                            {test.category && <span className="text-xs text-gray-400 ml-2">({test.category})</span>}
                          </p>
                        ))}
                        {order.tests?.length > 3 && (
                          <p className="text-xs text-gray-400">+{order.tests.length - 3} autres tests</p>
                        )}
                      </div>
                      {/* Meta info */}
                      <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.orderDate || order.createdAt || order.visitDate)}
                        </span>
                        {order.clinicalIndication && (
                          <span className="truncate max-w-[200px]">• {order.clinicalIndication}</span>
                        )}
                        {order.fasting?.required && (
                          <span className="text-orange-600">• À jeun</span>
                        )}
                        {order.specimen?.collectedAt && (
                          <span className="text-blue-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Prélevé
                          </span>
                        )}
                      </div>
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
                      {/* Reject button - available for ordered/collected status */}
                      {(order.status === 'ordered' || order.status === 'collected') && (
                        <button
                          onClick={() => onReject?.(order)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
                          title="Rejeter cette demande"
                        >
                          <XCircle className="h-3 w-3" />
                          Rejeter
                        </button>
                      )}
                      {order.status === 'ordered' && (
                        <button
                          onClick={() => onUpdateStatus?.(order._id || order.id, 'collected', order.source)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Prélever
                        </button>
                      )}
                      {(order.status === 'collected' || order.status === 'received') && (
                        <button
                          onClick={() => onUpdateStatus?.(order._id || order.id, 'in-progress', order.source)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Démarrer
                        </button>
                      )}
                      <button
                        onClick={() => onOpenResultEntry?.(order)}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                      >
                        <FlaskConical className="h-3 w-3" />
                        Résultats
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </CollapsibleSection>
  );
}
