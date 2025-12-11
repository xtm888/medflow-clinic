/**
 * ClinicalAlertBanner
 *
 * Non-blocking banner for URGENT and WARNING level alerts.
 * Displayed at the top of the workflow but doesn't block interaction.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Eye,
  Clock
} from 'lucide-react';

const SEVERITY_CONFIG = {
  URGENT: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    icon: AlertTriangle,
    label: 'URGENT'
  },
  WARNING: {
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: AlertCircle,
    label: 'ATTENTION'
  }
};

export default function ClinicalAlertBanner({
  alerts = [],
  onAcknowledge,
  onDismiss,
  onViewDetails,
  collapsible = true
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState(new Set());

  // Filter to URGENT and WARNING alerts that haven't been dismissed
  const bannerAlerts = alerts.filter(
    a => (a.severity === 'URGENT' || a.severity === 'WARNING') &&
         a.status === 'active' &&
         !dismissedIds.has(a._id)
  );

  if (bannerAlerts.length === 0) return null;

  // Group by severity
  const urgentAlerts = bannerAlerts.filter(a => a.severity === 'URGENT');
  const warningAlerts = bannerAlerts.filter(a => a.severity === 'WARNING');

  // Determine primary severity for banner color
  const primarySeverity = urgentAlerts.length > 0 ? 'URGENT' : 'WARNING';
  const config = SEVERITY_CONFIG[primarySeverity];
  const Icon = config.icon;

  const handleLocalDismiss = (alertId) => {
    setDismissedIds(prev => new Set([...prev, alertId]));
    if (onDismiss) {
      onDismiss(alertId);
    }
  };

  return (
    <div className={`${config.bgLight} border-b ${config.border}`}>
      {/* Collapsed Banner */}
      <div
        className={`${config.bg} text-white px-4 py-2 flex items-center justify-between cursor-pointer`}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-medium">
            {config.label}: {bannerAlerts.length} alerte{bannerAlerts.length > 1 ? 's' : ''} clinique{bannerAlerts.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {collapsible && (
            <button className="p-1 hover:bg-white/20 rounded">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 max-h-64 overflow-y-auto">
          <div className="space-y-3">
            {/* Urgent Alerts First */}
            {urgentAlerts.length > 0 && (
              <div>
                {urgentAlerts.map((alert, idx) => (
                  <AlertCard
                    key={alert._id || idx}
                    alert={alert}
                    config={SEVERITY_CONFIG.URGENT}
                    onAcknowledge={onAcknowledge}
                    onDismiss={() => handleLocalDismiss(alert._id)}
                    onViewDetails={onViewDetails}
                  />
                ))}
              </div>
            )}

            {/* Warning Alerts */}
            {warningAlerts.length > 0 && (
              <div>
                {warningAlerts.map((alert, idx) => (
                  <AlertCard
                    key={alert._id || idx}
                    alert={alert}
                    config={SEVERITY_CONFIG.WARNING}
                    onAcknowledge={onAcknowledge}
                    onDismiss={() => handleLocalDismiss(alert._id)}
                    onViewDetails={onViewDetails}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          {bannerAlerts.length > 1 && onAcknowledge && (
            <div className="mt-4 flex justify-end border-t pt-3">
              <button
                onClick={() => {
                  bannerAlerts.forEach(a => onAcknowledge(a._id));
                }}
                className={`flex items-center gap-2 px-4 py-2 ${config.bg} text-white rounded-lg hover:opacity-90 text-sm`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Accuser réception de toutes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual Alert Card
function AlertCard({ alert, config, onAcknowledge, onDismiss, onViewDetails }) {
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${config.border} ${config.bgLight} mb-2`}>
      <Icon className={`h-5 w-5 ${config.text} flex-shrink-0 mt-0.5`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className={`font-medium ${config.text}`}>
              {alert.title}
            </h4>
            <p className="text-sm text-gray-600 mt-0.5">
              {alert.message}
            </p>
          </div>

          {alert.eye && (
            <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${config.bgLight} ${config.text} border ${config.border}`}>
              {alert.eye}
            </span>
          )}
        </div>

        {/* Trigger info */}
        {alert.triggerValue && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>Valeur: {alert.triggerValue}</span>
            {alert.triggerThreshold && (
              <span className="text-gray-400">| Seuil: {alert.triggerThreshold}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          {onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert._id)}
              className={`flex items-center gap-1 px-3 py-1 text-xs rounded ${config.bg} text-white hover:opacity-90`}
            >
              <CheckCircle2 className="h-3 w-3" />
              J'ai compris
            </button>
          )}

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(alert)}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <Eye className="h-3 w-3" />
              Détails
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 ml-auto"
              title="Masquer temporairement"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
