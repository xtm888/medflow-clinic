import { useState } from 'react';
import { DollarSign, Download, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { CollapsibleSectionGroup } from '../../components/CollapsibleSection';

// Import sections
import {
  FinancialOverviewSection,
  FinancialServiceSection,
  FinancialAgingSection,
  CommissionSection,
  CompanyBalanceSection,
  OpticalShopSection
} from './sections';

/**
 * Financial - Consolidated financial dashboard with collapsible sections
 */
export default function Financial() {
  const { user } = useAuth();
  const [revenueByService, setRevenueByService] = useState([]);

  // Role-based permissions
  const canExportReports = ['admin', 'accountant', 'manager'].includes(user?.role);

  // Handle data sharing between overview and service sections
  const handleOverviewDataLoaded = (data) => {
    setRevenueByService(data.revenueByService || []);
  };

  const handleExportReport = () => {
    const today = format(new Date(), 'dd-MM-yyyy');
    let csvContent = "data:text/csv;charset=utf-8,";

    // Header
    csvContent += "Rapport Financier - " + today + "\n\n";

    // Revenue by service
    if (revenueByService.length > 0) {
      csvContent += "REVENUS PAR SERVICE\n";
      csvContent += "Service,Nombre d'actes,Revenu total,Revenu moyen,% du total\n";

      const total = revenueByService.reduce((sum, s) => sum + (s.amount || 0), 0);

      revenueByService.forEach(service => {
        const percent = total > 0 ? ((service.amount || 0) / total) * 100 : 0;
        const average = service.count > 0 ? (service.amount || 0) / service.count : 0;
        csvContent += `${service.service},${service.count || 0},${(service.amount || 0).toFixed(2)},${average.toFixed(2)},${percent.toFixed(1)}%\n`;
      });
    }

    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_financier_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            Tableau de Bord Financier
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Suivi des revenus, facturation et analyses financières
          </p>
        </div>
        {canExportReports && (
          <button
            onClick={handleExportReport}
            className="btn btn-primary flex items-center gap-2"
          >
            <Download className="h-5 w-5" />
            <span>Exporter rapport</span>
          </button>
        )}
      </div>

      {/* Collapsible Sections */}
      <CollapsibleSectionGroup>
        {/* Revenue Overview with trends */}
        <FinancialOverviewSection
          onDataLoaded={handleOverviewDataLoaded}
        />

        {/* Revenue by Service breakdown */}
        <FinancialServiceSection
          revenueByService={revenueByService}
        />

        {/* Optical Shop Revenue & Optician Performance */}
        <OpticalShopSection />

        {/* A/R Aging Report */}
        <FinancialAgingSection />

        {/* Company/Convention Balances */}
        <CompanyBalanceSection />

        {/* Referrer Commissions */}
        <CommissionSection />
      </CollapsibleSectionGroup>
    </div>
  );
}
