/**
 * EmergencyModal
 *
 * Blocking modal for EMERGENCY-level clinical alerts.
 * Requires acknowledgment before the user can proceed.
 */

import { useState } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  X,
  Phone,
  Clock,
  User
} from 'lucide-react';

export default function EmergencyModal({
  alerts = [],
  onAcknowledge,
  onAcknowledgeAll,
  onEscalate,
  currentUser
}) {
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [acknowledgmentReason, setAcknowledgmentReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  // Only show for unacknowledged emergency alerts
  const activeEmergencies = alerts.filter(
    a => a.severity === 'EMERGENCY' && a.status === 'active'
  );

  if (activeEmergencies.length === 0) return null;

  const handleAcknowledge = async (alertId) => {
    setAcknowledgingId(alertId);
    try {
      await onAcknowledge(alertId, acknowledgmentReason);
      setAcknowledgmentReason('');
      setShowReasonInput(false);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleAcknowledgeAll = async () => {
    if (onAcknowledgeAll) {
      const alertIds = activeEmergencies.map(a => a._id);
      await onAcknowledgeAll(alertIds, acknowledgmentReason);
      setAcknowledgmentReason('');
      setShowReasonInput(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header - Red Alert Banner */}
        <div className="bg-red-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <AlertOctagon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                ALERTE URGENTE
              </h2>
              <p className="text-red-100 text-sm">
                {activeEmergencies.length} alerte{activeEmergencies.length > 1 ? 's' : ''} nécessitant une attention immédiate
              </p>
            </div>
          </div>
        </div>

        {/* Alert Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="p-6 space-y-4">
            {activeEmergencies.map((alert, idx) => (
              <div
                key={alert._id || idx}
                className="border-2 border-red-200 rounded-lg bg-red-50 p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                    <ShieldAlert className="h-6 w-6 text-red-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-red-900 text-lg">
                        {alert.title}
                      </h3>
                      {alert.eye && (
                        <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-medium">
                          {alert.eye}
                        </span>
                      )}
                    </div>

                    <p className="text-red-800 mt-2">
                      {alert.message}
                    </p>

                    {/* Trigger Details */}
                    {alert.triggerValue && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-red-700">
                        <Clock className="h-4 w-4" />
                        <span>Valeur déclenchante: <strong>{alert.triggerValue}</strong></span>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {alert.recommendedActions?.length > 0 && (
                      <div className="mt-4 bg-white rounded-lg p-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Actions recommandées:
                        </p>
                        <ul className="space-y-2">
                          {alert.recommendedActions.map((action, actionIdx) => (
                            <li
                              key={actionIdx}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="flex-shrink-0 w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">
                                {action.priority}
                              </span>
                              <span className={action.completed ? 'line-through text-gray-400' : 'text-gray-700'}>
                                {action.action}
                              </span>
                              {action.completed && (
                                <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Individual Acknowledge */}
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => handleAcknowledge(alert._id)}
                        disabled={acknowledgingId === alert._id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {acknowledgingId === alert._id ? (
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Accusé de réception
                      </button>

                      {onEscalate && (
                        <button
                          onClick={() => onEscalate(alert._id)}
                          className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                        >
                          <Phone className="h-4 w-4" />
                          Escalader
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          {/* Optional reason input */}
          {showReasonInput ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison de l'accusé de réception (optionnel)
              </label>
              <textarea
                value={acknowledgmentReason}
                onChange={(e) => setAcknowledgmentReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={2}
                placeholder="Ex: Patient transféré aux urgences, traitement initié..."
              />
            </div>
          ) : (
            <button
              onClick={() => setShowReasonInput(true)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-3"
            >
              + Ajouter une raison
            </button>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <User className="h-4 w-4" />
              Connecté en tant que: <strong>{currentUser?.firstName} {currentUser?.lastName}</strong>
            </div>

            {activeEmergencies.length > 1 && onAcknowledgeAll && (
              <button
                onClick={handleAcknowledgeAll}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                <CheckCircle2 className="h-5 w-5" />
                Accuser réception de toutes ({activeEmergencies.length})
              </button>
            )}
          </div>
        </div>

        {/* Warning message */}
        <div className="bg-red-100 px-6 py-3 border-t border-red-200">
          <p className="text-sm text-red-800 text-center">
            <strong>⚠️ Attention:</strong> Vous devez accuser réception de ces alertes avant de continuer la consultation.
          </p>
        </div>
      </div>
    </div>
  );
}
