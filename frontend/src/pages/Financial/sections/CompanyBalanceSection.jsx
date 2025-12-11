import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  DollarSign,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import CollapsibleSection from '../../../components/CollapsibleSection';
import companyService from '../../../services/companyService';

const formatCurrency = (amount, currency = 'CDF') => {
  if (amount == null) return '-';
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export default function CompanyBalanceSection() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [expiringContracts, setExpiringContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [outstandingRes, expiringRes] = await Promise.all([
          companyService.getCompaniesWithOutstanding(0),
          companyService.getExpiringContracts(30)
        ]);

        setCompanies(outstandingRes.data || []);
        setExpiringContracts(expiringRes.data || []);
      } catch (err) {
        console.error('Error fetching company data:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate totals
  const totalOutstanding = companies.reduce((sum, c) => sum + (c.balance?.outstanding || 0), 0);

  return (
    <CollapsibleSection
      title="Conventions & Entreprises"
      icon={Building2}
      defaultExpanded={true}
      badge={companies.length > 0 ? `${companies.length} avec solde` : null}
      badgeColor="red"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm font-medium">Total à recouvrer</span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Building2 className="h-5 w-5" />
                <span className="text-sm font-medium">Entreprises avec solde</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {companies.length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-600 mb-1">
                <Calendar className="h-5 w-5" />
                <span className="text-sm font-medium">Contrats expirant (30j)</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">
                {expiringContracts.length}
              </p>
            </div>
          </div>

          {/* Companies with Outstanding */}
          {companies.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Soldes dus par entreprise</h4>
                <button
                  onClick={() => navigate('/companies')}
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Voir tout <ExternalLink className="h-4 w-4" />
                </button>
              </div>
              <div className="bg-white border rounded-lg divide-y">
                {companies.slice(0, 5).map((company) => (
                  <div
                    key={company._id}
                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                    onClick={() => navigate(`/companies/${company._id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{company.name}</p>
                        <p className="text-sm text-gray-500">
                          {company.type === 'insurance' ? 'Assurance' :
                           company.type === 'employer' ? 'Employeur' :
                           company.type === 'ngo' ? 'ONG' : company.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">
                        {formatCurrency(company.balance?.outstanding || 0, company.defaultCoverage?.currency)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Facturé: {formatCurrency(company.balance?.totalBilled || 0, company.defaultCoverage?.currency)}
                      </p>
                    </div>
                  </div>
                ))}
                {companies.length > 5 && (
                  <div className="p-3 text-center">
                    <button
                      onClick={() => navigate('/companies?outstanding=true')}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Voir {companies.length - 5} autres entreprises
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expiring Contracts */}
          {expiringContracts.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Contrats expirant bientôt
              </h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg divide-y divide-yellow-200">
                {expiringContracts.slice(0, 3).map((company) => (
                  <div
                    key={company._id}
                    className="p-4 hover:bg-yellow-100 cursor-pointer flex items-center justify-between"
                    onClick={() => navigate(`/companies/${company._id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{company.name}</p>
                      <p className="text-sm text-yellow-700">
                        Expire le {format(new Date(company.contractEnd), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-yellow-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {companies.length === 0 && expiringContracts.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune entreprise avec solde impayé</p>
              <button
                onClick={() => navigate('/companies')}
                className="mt-4 text-blue-600 hover:underline text-sm"
              >
                Gérer les conventions
              </button>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
