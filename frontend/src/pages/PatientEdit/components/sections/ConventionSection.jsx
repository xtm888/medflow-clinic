/**
 * ConventionSection Component
 *
 * Convention/Insurance form section with company search.
 */

import { Building2, Search, Loader2, X, CheckCircle } from 'lucide-react';
import { BENEFICIARY_TYPE_OPTIONS, CONVENTION_STATUS_OPTIONS } from '../../constants';

export default function ConventionSection({
  formData,
  // Company search
  companySearch,
  setCompanySearch,
  companyResults,
  searchingCompanies,
  showCompanyDropdown,
  selectedCompany,
  // Handlers
  handleSelectCompany,
  handleClearCompany,
  handleConventionChange
}) {
  const onSelectCompany = (company) => {
    handleSelectCompany(company);
    setCompanySearch(company.name);
  };

  const onClearCompany = () => {
    handleClearCompany();
    setCompanySearch('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-green-600" />
        Convention / Assurance
      </h2>

      {/* Convention Toggle */}
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-green-900">Patient conventionné</h3>
            <p className="text-sm text-green-700">Affilié à une entreprise ou assurance conventionnée</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.convention.hasConvention}
              onChange={(e) => {
                if (!e.target.checked) {
                  onClearCompany();
                } else {
                  handleConventionChange('hasConvention', true);
                }
              }}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        {formData.convention.hasConvention && (
          <div className="space-y-4 pt-4 border-t border-green-200">
            {/* Company Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Entreprise / Assurance *
              </label>
              <div className="relative">
                {selectedCompany ? (
                  <div className="flex items-center justify-between px-4 py-3 bg-green-100 border-2 border-green-300 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">{selectedCompany.name}</span>
                      {selectedCompany.companyId && (
                        <span className="text-sm text-green-600">({selectedCompany.companyId})</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onClearCompany}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="input pl-10"
                      placeholder="Rechercher une entreprise..."
                    />
                    {searchingCompanies && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-spin text-green-500" />
                    )}
                    {showCompanyDropdown && companyResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {companyResults.map((company) => (
                          <button
                            key={company._id}
                            type="button"
                            onClick={() => onSelectCompany(company)}
                            className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-2 border-b last:border-b-0"
                          >
                            <Building2 className="h-4 w-4 text-green-500" />
                            <div>
                              <span className="font-medium">{company.name}</span>
                              {company.companyId && (
                                <span className="text-sm text-gray-500 ml-2">({company.companyId})</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Employee ID & Job Title */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Matricule</label>
                <input
                  type="text"
                  value={formData.convention.employeeId}
                  onChange={(e) => handleConventionChange('employeeId', e.target.value)}
                  className="input"
                  placeholder="Ex: EMP001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fonction</label>
                <input
                  type="text"
                  value={formData.convention.jobTitle}
                  onChange={(e) => handleConventionChange('jobTitle', e.target.value)}
                  className="input"
                  placeholder="Ex: Directeur"
                />
              </div>
            </div>

            {/* Beneficiary Type & Department */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de bénéficiaire</label>
                <select
                  value={formData.convention.beneficiaryType}
                  onChange={(e) => handleConventionChange('beneficiaryType', e.target.value)}
                  className="input"
                >
                  {BENEFICIARY_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                <input
                  type="text"
                  value={formData.convention.department}
                  onChange={(e) => handleConventionChange('department', e.target.value)}
                  className="input"
                  placeholder="Ex: Direction"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut convention</label>
              <select
                value={formData.convention.status}
                onChange={(e) => handleConventionChange('status', e.target.value)}
                className="input w-48"
              >
                {CONVENTION_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.convention.notes}
                onChange={(e) => handleConventionChange('notes', e.target.value)}
                className="input"
                rows="2"
                placeholder="Notes sur la convention..."
              />
            </div>

            {/* Coverage Info */}
            {selectedCompany?.defaultCoverage && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Couverture par défaut</h4>
                <p className="text-sm text-yellow-700">
                  {selectedCompany.defaultCoverage.percentage}% pris en charge par l'entreprise
                </p>
              </div>
            )}
          </div>
        )}

        {!formData.convention.hasConvention && (
          <p className="text-sm text-gray-500 italic">
            Activez si le patient est affilié à une entreprise conventionnée.
          </p>
        )}
      </div>
    </div>
  );
}
