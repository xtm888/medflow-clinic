import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';

/**
 * PharmacyAlertsSection - Critical pharmacy alerts
 */
export default function PharmacyAlertsSection({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const errorAlerts = alerts.filter(a => a.type === 'error');
  const warningAlerts = alerts.filter(a => a.type === 'warning');

  return (
    <CollapsibleSection
      title="Alertes Critiques"
      icon={AlertTriangle}
      iconColor="text-red-600"
      gradient="from-red-50 to-orange-50"
      defaultExpanded={true}
      badge={
        <div className="flex items-center gap-2">
          {errorAlerts.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
              {errorAlerts.length} critique
            </span>
          )}
          {warningAlerts.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
              {warningAlerts.length} avertissement
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        {alerts.map((alert, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              alert.type === 'error' ? 'bg-red-50 border-red-200' :
              alert.type === 'warning' ? 'bg-orange-50 border-orange-200' :
              'bg-blue-50 border-blue-200'
            }`}
          >
            {alert.type === 'error' ? (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            ) : alert.type === 'warning' ? (
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${
              alert.type === 'error' ? 'text-red-800' :
              alert.type === 'warning' ? 'text-orange-800' :
              'text-blue-800'
            }`}>
              {alert.message}
            </p>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
