import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DollarSign, Receipt, BarChart3, Building2, ShieldCheck, Briefcase, Loader2
} from 'lucide-react';

// Lazy load tab content - these are existing page components
const InvoicingContent = lazy(() => import('../Invoicing'));
const FinancialContent = lazy(() => import('../Financial'));
const CompaniesContent = lazy(() => import('../Companies'));
const ApprovalsContent = lazy(() => import('../Approvals'));
const ServicesContent = lazy(() => import('../Services'));

/**
 * FinanceHub - Unified financial operations page
 * Consolidates:
 * - Facturation: Invoice creation and payment processing
 * - Rapports: Financial analytics and reports
 * - Conventions: Company/insurance management
 * - Approbations: Prior authorization workflow
 * - Services: Fee schedule and service catalog
 */
export default function FinanceHub() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state from URL
  const activeTab = searchParams.get('tab') || 'invoicing';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: 'invoicing', label: 'Facturation', icon: Receipt },
    { id: 'reports', label: 'Rapports', icon: BarChart3 },
    { id: 'conventions', label: 'Conventions', icon: Building2 },
    { id: 'approvals', label: 'Approbations', icon: ShieldCheck },
    { id: 'services', label: 'Services', icon: Briefcase }
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            Finances
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion financière - Facturation, rapports et conventions
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
                    ? 'border-green-500 text-green-600'
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
              <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          </div>
        }
      >
        {activeTab === 'invoicing' && <InvoicingContent />}
        {activeTab === 'reports' && <FinancialContent />}
        {activeTab === 'conventions' && <CompaniesContent />}
        {activeTab === 'approvals' && <ApprovalsContent />}
        {activeTab === 'services' && <ServicesContent />}
      </Suspense>
    </div>
  );
}
