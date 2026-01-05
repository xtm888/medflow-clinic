import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Package, FileBarChart, LayoutDashboard, Loader2
} from 'lucide-react';

// Lazy load tab content - these are large components
const CrossClinicDashboardContent = lazy(() => import('../CrossClinicDashboard'));
const CrossClinicInventoryContent = lazy(() => import('../CrossClinicInventory'));
const ConsolidatedReportsContent = lazy(() => import('../ConsolidatedReports'));

/**
 * MultiClinic - Unified multi-clinic operations page
 * Consolidates:
 * - Dashboard: Overview of all connected clinics
 * - Inventory: Cross-clinic inventory management and transfers
 * - Reports: Consolidated financial reports
 */
export default function MultiClinic() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state from URL
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventaire', icon: Package },
    { id: 'reports', label: 'Rapports', icon: FileBarChart }
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-600" />
            Opérations Multi-Cliniques
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion centralisée de toutes les cliniques connectées
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          </div>
        }
      >
        {activeTab === 'dashboard' && <CrossClinicDashboardContent />}
        {activeTab === 'inventory' && <CrossClinicInventoryContent />}
        {activeTab === 'reports' && <ConsolidatedReportsContent />}
      </Suspense>
    </div>
  );
}
