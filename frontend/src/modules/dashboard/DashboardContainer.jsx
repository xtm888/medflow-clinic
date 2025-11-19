import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * DashboardContainer - Role-based dashboard orchestrator
 *
 * Features:
 * - Automatic widget selection by role
 * - Customizable grid layout
 * - Refresh functionality
 * - Loading states
 */
export default function DashboardContainer({
  // Widget components mapping
  widgets = {},
  // Layout configuration per role
  roleLayouts = {},
  // Default layout if role not found
  defaultLayout = [],
  // Custom layout override
  customLayout = null,
  // Refresh interval in ms (0 = disabled)
  refreshInterval = 0,
  // Additional props to pass to widgets
  widgetProps = {},
  className = ''
}) {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  // Determine layout based on role
  const layout = useMemo(() => {
    if (customLayout) return customLayout;

    const userRole = user?.role || 'guest';
    return roleLayouts[userRole] || defaultLayout;
  }, [customLayout, roleLayouts, defaultLayout, user?.role]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
    setLastRefresh(new Date());

    // Small delay for visual feedback
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        setRefreshKey(prev => prev + 1);
        setLastRefresh(new Date());
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Format last refresh time
  const formatLastRefresh = () => {
    return lastRefresh.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-sm text-gray-500">
            Dernière mise à jour: {formatLastRefresh()}
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </button>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {layout.map((item, index) => {
          const WidgetComponent = widgets[item.widget];

          if (!WidgetComponent) {
            console.warn(`Widget not found: ${item.widget}`);
            return null;
          }

          // Determine column span
          const colSpanClass = {
            1: 'col-span-1',
            2: 'md:col-span-2',
            3: 'lg:col-span-3'
          }[item.colSpan || 1];

          return (
            <div
              key={`${item.widget}-${index}`}
              className={colSpanClass}
            >
              <WidgetComponent
                key={refreshKey}
                {...widgetProps}
                {...item.props}
              />
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {layout.length === 0 && (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg border">
          <div className="text-center text-gray-500">
            <p className="font-medium">Aucun widget configuré</p>
            <p className="text-sm">Contactez l'administrateur pour configurer votre tableau de bord</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Pre-built role layouts
export const defaultRoleLayouts = {
  admin: [
    { widget: 'StatsOverview', colSpan: 3 },
    { widget: 'TodayAppointments', colSpan: 2 },
    { widget: 'QueueStatus', colSpan: 1 },
    { widget: 'RecentPatients', colSpan: 1 },
    { widget: 'AlertsWidget', colSpan: 1 },
    { widget: 'RevenueWidget', colSpan: 1 }
  ],
  doctor: [
    { widget: 'DoctorStats', colSpan: 3 },
    { widget: 'MyAppointments', colSpan: 2 },
    { widget: 'QueueStatus', colSpan: 1 },
    { widget: 'RecentPatients', colSpan: 2 },
    { widget: 'PendingPrescriptions', colSpan: 1 }
  ],
  nurse: [
    { widget: 'NurseStats', colSpan: 3 },
    { widget: 'QueueStatus', colSpan: 1 },
    { widget: 'TodayAppointments', colSpan: 2 },
    { widget: 'VitalsToRecord', colSpan: 2 },
    { widget: 'AlertsWidget', colSpan: 1 }
  ],
  receptionist: [
    { widget: 'ReceptionStats', colSpan: 3 },
    { widget: 'TodayAppointments', colSpan: 2 },
    { widget: 'QueueStatus', colSpan: 1 },
    { widget: 'WalkInPatients', colSpan: 2 },
    { widget: 'PhoneCallsWidget', colSpan: 1 }
  ],
  optician: [
    { widget: 'OpticianStats', colSpan: 3 },
    { widget: 'PendingPrescriptions', colSpan: 2 },
    { widget: 'QueueStatus', colSpan: 1 },
    { widget: 'CompletedOrders', colSpan: 2 },
    { widget: 'InventoryAlerts', colSpan: 1 }
  ]
};
