/**
 * InlineStepAlert
 *
 * Displays INFO-level alerts inline within workflow steps.
 * Non-intrusive, informational alerts that don't block workflow.
 */

import { Info, Clock, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

const SEVERITY_STYLES = {
  INFO: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'text-blue-500',
    button: 'bg-blue-100 hover:bg-blue-200 text-blue-700'
  },
  WARNING: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: 'text-yellow-500',
    button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
  }
};

export default function InlineStepAlert({
  alerts = [],
  onAcknowledge,
  onAction,
  showActions = true,
  compact = false
}) {
  if (!alerts || alerts.length === 0) return null;

  // Filter to only INFO and WARNING alerts
  const inlineAlerts = alerts.filter(a => a.severity === 'INFO' || a.severity === 'WARNING');

  if (inlineAlerts.length === 0) return null;

  if (compact) {
    return (
      <div className="space-y-1">
        {inlineAlerts.map((alert, idx) => {
          const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;

          return (
            <div
              key={alert._id || idx}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${styles.container}`}
            >
              <Info className={`h-4 w-4 flex-shrink-0 ${styles.icon}`} />
              <span className="truncate">{alert.title}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inlineAlerts.map((alert, idx) => {
        const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;

        return (
          <div
            key={alert._id || idx}
            className={`rounded-lg border p-4 ${styles.container}`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
                {alert.severity === 'WARNING' ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Info className="h-5 w-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{alert.title}</h4>
                  {alert.eye && (
                    <span className="text-xs px-2 py-0.5 rounded bg-white/50">
                      {alert.eye}
                    </span>
                  )}
                </div>

                <p className="text-sm mt-1 opacity-90">{alert.message}</p>

                {/* Trigger info */}
                {alert.triggerValue && (
                  <div className="flex items-center gap-2 mt-2 text-xs opacity-75">
                    <Clock className="h-3 w-3" />
                    <span>Déclenché par: {alert.triggerValue}</span>
                  </div>
                )}

                {/* Recommended Actions */}
                {showActions && alert.recommendedActions?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium opacity-75">Actions recommandées:</p>
                    <ul className="space-y-1">
                      {alert.recommendedActions.slice(0, 3).map((action, actionIdx) => (
                        <li
                          key={actionIdx}
                          className="flex items-center gap-2 text-sm"
                        >
                          {action.completed ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span className={action.completed ? 'line-through opacity-60' : ''}>
                            {action.action}
                          </span>
                          {!action.completed && onAction && (
                            <button
                              onClick={() => onAction(alert._id, actionIdx)}
                              className="text-xs underline hover:no-underline ml-auto"
                            >
                              Fait
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Acknowledge button */}
                {alert.status === 'active' && onAcknowledge && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => onAcknowledge(alert._id)}
                      className={`px-3 py-1 text-xs rounded ${styles.button}`}
                    >
                      J'ai compris
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
