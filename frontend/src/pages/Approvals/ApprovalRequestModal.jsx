import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  User,
  Building2,
  Loader2,
  AlertCircle,
  Plus
} from 'lucide-react';
import approvalService from '../../services/approvalService';
import companyService from '../../services/companyService';
import patientService from '../../services/patientService';

export default function ApprovalRequestModal({ onClose, onCreated, prefilledPatient, prefilledCompany }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: select patient, 2: fill details

  // Search states
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    patient: prefilledPatient || null,
    company: prefilledCompany || null,
    actCode: '',
    actName: '',
    actCategory: '',
    quantityRequested: 1,
    estimatedCost: '',
    currency: 'CDF',
    medicalJustification: ''
  });

  // Companies list (for patient's convention company)
  const [availableCompanies, setAvailableCompanies] = useState([]);

  // Search patients
  useEffect(() => {
    const searchPatients = async () => {
      if (patientSearch.length < 2) {
        setPatientResults([]);
        return;
      }
      setSearchingPatients(true);
      try {
        const result = await patientService.searchPatients(patientSearch);
        // Handle various API response formats defensively
        const patients = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
          ? result
          : [];
        setPatientResults(patients);
      } catch (err) {
        console.error('Error searching patients:', err);
        setPatientResults([]);
      } finally {
        setSearchingPatients(false);
      }
    };

    const timer = setTimeout(searchPatients, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Load companies when patient selected
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const result = await companyService.getCompanies({ status: 'active', limit: 100 });
        // Handle various API response formats defensively
        const companies = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
          ? result.data
          : [];
        setAvailableCompanies(companies);

        // If patient has convention company, auto-select it
        if (formData.patient?.convention?.company) {
          const patientCompany = companies.find(
            c => c._id === formData.patient.convention.company ||
                 c._id === formData.patient.convention.company._id
          );
          if (patientCompany) {
            setFormData(prev => ({ ...prev, company: patientCompany }));
          }
        }
      } catch (err) {
        console.error('Error loading companies:', err);
      }
    };

    if (formData.patient) {
      loadCompanies();
    }
  }, [formData.patient]);

  const handleSelectPatient = (patient) => {
    setFormData(prev => ({ ...prev, patient }));
    setPatientSearch('');
    setPatientResults([]);
    setStep(2);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompanyChange = (e) => {
    const companyId = e.target.value;
    const company = availableCompanies.find(c => c._id === companyId);
    setFormData(prev => ({
      ...prev,
      company,
      currency: company?.defaultCoverage?.currency || 'CDF'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patient || !formData.company || !formData.actCode) {
      setError('Patient, entreprise et code acte sont requis');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await approvalService.createApproval({
        patient: formData.patient._id,
        company: formData.company._id,
        actCode: formData.actCode,
        actName: formData.actName,
        actCategory: formData.actCategory,
        quantityRequested: parseInt(formData.quantityRequested) || 1,
        estimatedCost: parseFloat(formData.estimatedCost) || undefined,
        currency: formData.currency,
        medicalJustification: formData.medicalJustification
      });

      onCreated();
    } catch (err) {
      console.error('Error creating approval:', err);
      setError(err.response?.data?.message || 'Erreur lors de la création de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-yellow-500 to-yellow-600">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Nouvelle demande d'approbation
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Step 1: Select Patient */}
            {step === 1 && !formData.patient && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Rechercher un patient *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Nom, prénom ou ID patient..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                  {searchingPatients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
                  )}
                </div>

                {/* Search Results */}
                {patientResults.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {patientResults.map(patient => (
                      <button
                        key={patient._id}
                        type="button"
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{patient.patientId}</p>
                        </div>
                        {patient.convention?.company && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Convention
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Fill Details */}
            {(step === 2 || formData.patient) && (
              <>
                {/* Selected Patient */}
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {formData.patient?.firstName} {formData.patient?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{formData.patient?.patientId}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFormData(prev => ({ ...prev, patient: null, company: null })); setStep(1); }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Changer
                  </button>
                </div>

                {/* Company Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Entreprise / Assurance *
                  </label>
                  <select
                    value={formData.company?._id || ''}
                    onChange={handleCompanyChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Sélectionner une entreprise</option>
                    {availableCompanies.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Act Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code acte *
                    </label>
                    <input
                      type="text"
                      name="actCode"
                      value={formData.actCode}
                      onChange={handleChange}
                      required
                      placeholder="Ex: IRM, SCAN"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantité
                    </label>
                    <input
                      type="number"
                      name="quantityRequested"
                      value={formData.quantityRequested}
                      onChange={handleChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                </div>

                {/* Act Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de l'acte
                  </label>
                  <input
                    type="text"
                    name="actName"
                    value={formData.actName}
                    onChange={handleChange}
                    placeholder="Description de l'acte médical"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                {/* Estimated Cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coût estimé
                    </label>
                    <input
                      type="number"
                      name="estimatedCost"
                      value={formData.estimatedCost}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Devise
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="CDF">CDF</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                {/* Medical Justification */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Justification médicale
                  </label>
                  <textarea
                    name="medicalJustification"
                    value={formData.medicalJustification}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Motif médical de la demande d'approbation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Annuler
            </button>
            {formData.patient && (
              <button
                type="submit"
                disabled={loading || !formData.company || !formData.actCode}
                className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Créer la demande
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
