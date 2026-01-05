import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Eye, Glasses, Syringe, Scissors, LayoutDashboard, Loader2
} from 'lucide-react';

// Lazy load tab content - these are existing page components
const OphthalmologyDashboardContent = lazy(() => import('../ophthalmology/OphthalmologyDashboard'));
const OrthopticExamsContent = lazy(() => import('../OrthopticExams'));
const IVTDashboardContent = lazy(() => import('../IVTDashboard'));
const SurgeryDashboardContent = lazy(() => import('../Surgery'));

/**
 * OphthalmologyHub - Unified ophthalmology operations page
 * Consolidates:
 * - Dashboard: Main ophthalmology dashboard with patient flow
 * - Orthoptie: Orthoptic exams and strabismus management
 * - IVT: Intravitreal injection tracking and protocols
 * - Chirurgie: Surgery scheduling and OR management
 */
export default function OphthalmologyHub() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state from URL
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'orthoptic', label: 'Orthoptie', icon: Glasses },
    { id: 'ivt', label: 'Injections IVT', icon: Syringe },
    { id: 'surgery', label: 'Chirurgie', icon: Scissors }
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Eye className="h-8 w-8 text-blue-600" />
            Ophtalmologie
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Centre de soins oculaires - Consultations, examens et interventions
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
                    ? 'border-blue-500 text-blue-600'
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
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          </div>
        }
      >
        {activeTab === 'dashboard' && <OphthalmologyDashboardContent />}
        {activeTab === 'orthoptic' && <OrthopticExamsContent />}
        {activeTab === 'ivt' && <IVTDashboardContent />}
        {activeTab === 'surgery' && <SurgeryDashboardContent />}
      </Suspense>
    </div>
  );
}
