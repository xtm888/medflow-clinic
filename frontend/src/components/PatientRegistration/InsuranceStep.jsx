import React, { memo } from 'react';
import { Building2, CheckCircle, X, Search, Loader2, AlertCircle } from 'lucide-react';

/**
 * InsuranceStep Component
 * Collects patient's insurance/company convention information
 */
const InsuranceStep = memo(({
  formData,
  errors,
  companySearch,
  companyResults,
  searchingCompanies,
  showCompanyDropdown,
  selectedCompany,
  onCompanySearchChange,
  onSelectCompany,
  onClearCompany,
  onConventionChange
}) => {
  const handleToggleConvention = (checked) => {
    if (!checked) {
      onClearCompany();
    } else {
      onConventionChange(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Convention Toggle */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-blue-900">Convention / Entreprise</h3>
              <p className="text-sm text-blue-700">Patient affilié à une entreprise ou assurance</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.convention.hasConvention}
              onChange={(e) => handleToggleConvention(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {formData.convention.hasConvention && (
          <div className="space-y-4 pt-4 border-t border-blue-200">
            {/* Company Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Entreprise / Assurance *
              </label>
              <div className="relative">
                {selectedCompany ? (
                  <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-2 border-green-300 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">{selectedCompany.name}</span>
                      <span className="text-sm text-green-600">({selectedCompany.companyId})</span>
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
                      onChange={(e) => onCompanySearchChange(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${errors.company ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Rechercher une entreprise..."
                    />
                    {searchingCompanies && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="animate-spin h-5 w-5 text-blue-500" />
                      </div>
                    )}
                    {showCompanyDropdown && companyResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {companyResults.map((company) => (
                          <button
                            key={company._id}
                            type="button"
                            onClick={() => onSelectCompany(company)}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-2 border-b last:border-b-0"
                          >
                            <Building2 className="h-4 w-4 text-blue-500" />
                            <div>
                              <span className="font-medium">{company.name}</span>
                              <span className="text-sm text-gray-500 ml-2">({company.companyId})</span>
                              {company.type && (
                                <span className="text-xs text-gray-400 ml-2 capitalize">{company.type}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {errors.company && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.company}
                </p>
              )}
            </div>

            {/* Employee ID & Job Title */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  N° Matricule employé
                </label>
                <input
                  type="text"
                  value={formData.convention.employeeId}
                  onChange={(e) => onConventionChange(true, 'employeeId', e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Ex: EMP001"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fonction
                </label>
                <input
                  type="text"
                  value={formData.convention.jobTitle}
                  onChange={(e) => onConventionChange(true, 'jobTitle', e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Ex: Directeur Commercial"
                />
              </div>
            </div>

            {/* Beneficiary Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Type de bénéficiaire
              </label>
              <select
                value={formData.convention.beneficiaryType}
                onChange={(e) => onConventionChange(true, 'beneficiaryType', e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="employee">Employé(e)</option>
                <option value="spouse">Conjoint(e)</option>
                <option value="child">Enfant</option>
                <option value="dependent">Autre personne à charge</option>
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Département / Service
              </label>
              <input
                type="text"
                value={formData.convention.department}
                onChange={(e) => onConventionChange(true, 'department', e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Ex: Direction Générale"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (optionnel)
              </label>
              <textarea
                value={formData.convention.notes}
                onChange={(e) => onConventionChange(true, 'notes', e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                rows="2"
                placeholder="Notes sur la convention..."
              />
            </div>

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
            Activez cette option si le patient est affilié à une entreprise ou une assurance conventionnée.
          </p>
        )}
      </div>
    </div>
  );
});

InsuranceStep.displayName = 'InsuranceStep';

export default InsuranceStep;
