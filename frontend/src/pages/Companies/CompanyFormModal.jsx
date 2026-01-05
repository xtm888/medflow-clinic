import { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Save,
  Loader2,
  Phone,
  Mail,
  MapPin,
  User,
  Percent,
  DollarSign,
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
  Shield,
  Link2
} from 'lucide-react';
import companyService from '../../services/companyService';

const COMPANY_TYPES = [
  { value: 'insurance', label: 'Assurance' },
  { value: 'employer', label: 'Employeur' },
  { value: 'ngo', label: 'ONG' },
  { value: 'government', label: 'Gouvernement' },
  { value: 'other', label: 'Autre' }
];

const CURRENCIES = [
  { value: 'CDF', label: 'Franc Congolais (CDF)' },
  { value: 'USD', label: 'Dollar US (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' }
];

const SERVICE_CATEGORIES = [
  'consultation',
  'laboratory',
  'imaging',
  'pharmacy',
  'surgery',
  'hospitalization',
  'ophthalmology',
  'orthoptic',
  'ivt'
];

const DEFAULT_FORM_DATA = {
  name: '',
  type: 'employer',
  taxId: '',
  isParentConvention: false,
  parentConvention: '',
  conventionCode: '',
  contact: {
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      country: 'RDC'
    },
    contactPerson: ''
  },
  defaultCoverage: {
    percentage: 80,
    maxPerVisit: 0,
    maxAnnual: 0,
    currency: 'CDF',
    copayAmount: 0
  },
  coveredCategories: [],
  actsRequiringApproval: [],
  contractStart: '',
  contractEnd: '',
  notes: ''
};

export default function CompanyFormModal({ company, onClose, onSave }) {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newApprovalCode, setNewApprovalCode] = useState('');
  const [parentConventions, setParentConventions] = useState([]);

  const isEditing = !!company;

  // Fetch parent conventions for linking employers to insurance
  useEffect(() => {
    const fetchParentConventions = async () => {
      try {
        const result = await companyService.getCompanies({ type: 'insurance', limit: 100 });
        // Safely extract array from various API response formats
        const rawData = result?.data?.data ?? result?.data ?? result ?? [];
        const companies = Array.isArray(rawData) ? rawData : [];
        // Filter to only parent conventions
        const parents = companies.filter(c => c.isParentConvention || c.type === 'insurance');
        setParentConventions(parents);
      } catch (err) {
        console.error('Error fetching parent conventions:', err);
      }
    };
    fetchParentConventions();
  }, []);

  useEffect(() => {
    if (company) {
      // Handle address - could be string (legacy) or object
      const address = typeof company.contact?.address === 'string'
        ? { street: company.contact.address, city: '', country: 'RDC' }
        : company.contact?.address || { street: '', city: '', country: 'RDC' };

      // Handle contract dates - could be contractStart/End or contract.startDate/endDate
      const startDate = company.contract?.startDate || company.contractStart;
      const endDate = company.contract?.endDate || company.contractEnd;

      // Handle coveredCategories - could be array of strings or objects
      const coveredCats = (company.coveredCategories || []).map(cat =>
        typeof cat === 'string' ? cat : cat.category
      ).filter(Boolean);

      // Handle actsRequiringApproval - could be array of strings or objects
      const approvalActs = (company.actsRequiringApproval || []).map(act =>
        typeof act === 'string' ? act : (act.actCode || act.code || act.name)
      ).filter(Boolean);

      setFormData({
        name: company.name || '',
        type: company.type || 'employer',
        taxId: company.taxId || '',
        isParentConvention: company.isParentConvention || false,
        parentConvention: company.parentConvention?._id || company.parentConvention || '',
        conventionCode: company.conventionCode || '',
        contact: {
          phone: company.contact?.phone || '',
          email: company.contact?.email || '',
          address: address,
          contactPerson: company.contact?.contactPerson || ''
        },
        defaultCoverage: {
          percentage: company.defaultCoverage?.percentage || 80,
          maxPerVisit: company.defaultCoverage?.maxPerVisit || 0,
          maxAnnual: company.defaultCoverage?.maxAnnual || 0,
          currency: company.defaultCoverage?.currency || 'CDF',
          copayAmount: company.defaultCoverage?.copayAmount || 0
        },
        coveredCategories: coveredCats,
        actsRequiringApproval: approvalActs,
        contractStart: startDate ? startDate.split('T')[0] : '',
        contractEnd: endDate ? endDate.split('T')[0] : '',
        notes: company.notes || ''
      });
    }
  }, [company]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }
    if (name.includes('.')) {
      const parts = name.split('.');
      if (parts.length === 3) {
        // Handle deeply nested like contact.address.city
        const [parent, child, grandchild] = parts;
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: {
              ...prev[parent][child],
              [grandchild]: value
            }
          }
        }));
      } else {
        const [parent, child] = parts;
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: numValue
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: numValue }));
    }
  };

  const handleCategoryToggle = (category) => {
    setFormData(prev => ({
      ...prev,
      coveredCategories: prev.coveredCategories.includes(category)
        ? prev.coveredCategories.filter(c => c !== category)
        : [...prev.coveredCategories, category]
    }));
  };

  const handleAddApprovalCode = () => {
    if (!newApprovalCode.trim()) return;
    const code = newApprovalCode.toUpperCase().trim();
    if (!formData.actsRequiringApproval.includes(code)) {
      setFormData(prev => ({
        ...prev,
        actsRequiringApproval: [...prev.actsRequiringApproval, code]
      }));
    }
    setNewApprovalCode('');
  };

  const handleRemoveApprovalCode = (code) => {
    setFormData(prev => ({
      ...prev,
      actsRequiringApproval: prev.actsRequiringApproval.filter(c => c !== code)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        ...formData,
        // Clear parentConvention if it's empty string
        parentConvention: formData.parentConvention || null,
        // Map contract dates to the correct structure
        contract: {
          startDate: formData.contractStart || undefined,
          endDate: formData.contractEnd || undefined,
          status: 'active'
        },
        contractStart: formData.contractStart || undefined,
        contractEnd: formData.contractEnd || undefined
      };

      // Remove parentConvention if this is a parent convention
      if (data.isParentConvention) {
        data.parentConvention = null;
      }

      if (isEditing) {
        await companyService.updateCompany(company._id, data);
      } else {
        await companyService.createCompany(data);
      }

      onSave();
    } catch (err) {
      console.error('Error saving company:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {isEditing ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Informations générales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: SONAS Assurances"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {COMPANY_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    N° Identification Fiscale
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    value={formData.taxId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: A1234567890"
                  />
                </div>
              </div>

              {/* Parent Convention Link (for employers) */}
              {formData.type === 'employer' && parentConventions.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Link2 className="h-4 w-4 inline mr-1" />
                    Lier à une assurance (convention parent)
                  </label>
                  <select
                    name="parentConvention"
                    value={formData.parentConvention}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Aucune (employeur autonome) --</option>
                    {parentConventions.map(parent => (
                      <option key={parent._id} value={parent._id}>
                        {parent.name} {parent.conventionCode ? `(${parent.conventionCode})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Si cet employeur est couvert par une assurance, sélectionnez-la ici
                  </p>
                </div>
              )}

              {/* Is Parent Convention (for insurance companies) */}
              {formData.type === 'insurance' && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isParentConvention"
                      checked={formData.isParentConvention}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      <Shield className="h-4 w-4 inline mr-1" />
                      Convention parent (peut couvrir d'autres employeurs)
                    </span>
                  </label>
                  {formData.isParentConvention && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Code Convention
                      </label>
                      <input
                        type="text"
                        name="conventionCode"
                        value={formData.conventionCode}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: ACTIVA, MSO, GGA"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="h-4 w-4 inline mr-1" />
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    name="contact.phone"
                    value={formData.contact.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+243 XXX XXX XXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="h-4 w-4 inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="contact.email"
                    value={formData.contact.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="contact@entreprise.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="h-4 w-4 inline mr-1" />
                    Personne de contact
                  </label>
                  <input
                    type="text"
                    name="contact.contactPerson"
                    value={formData.contact.contactPerson}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom du responsable"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Adresse
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      name="contact.address.street"
                      value={formData.contact.address?.street || ''}
                      onChange={handleChange}
                      className="md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Rue / Avenue"
                    />
                    <input
                      type="text"
                      name="contact.address.city"
                      value={formData.contact.address?.city || ''}
                      onChange={handleChange}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ville"
                    />
                    <input
                      type="text"
                      name="contact.address.country"
                      value={formData.contact.address?.country || 'RDC'}
                      onChange={handleChange}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Pays"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Coverage Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres de couverture</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Percent className="h-4 w-4 inline mr-1" />
                    Pourcentage de prise en charge
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="defaultCoverage.percentage"
                      value={formData.defaultCoverage.percentage}
                      onChange={handleNumberChange}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Max par visite
                  </label>
                  <input
                    type="number"
                    name="defaultCoverage.maxPerVisit"
                    value={formData.defaultCoverage.maxPerVisit}
                    onChange={handleNumberChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0 = illimité"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Max annuel par employé
                  </label>
                  <input
                    type="number"
                    name="defaultCoverage.maxAnnual"
                    value={formData.defaultCoverage.maxAnnual}
                    onChange={handleNumberChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0 = illimité"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Devise
                  </label>
                  <select
                    name="defaultCoverage.currency"
                    value={formData.defaultCoverage.currency}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CURRENCIES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Copay fixe (ticket modérateur)
                  </label>
                  <input
                    type="number"
                    name="defaultCoverage.copayAmount"
                    value={formData.defaultCoverage.copayAmount}
                    onChange={handleNumberChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Montant fixe à charge du patient"
                  />
                </div>
              </div>
            </div>

            {/* Covered Categories */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Catégories couvertes</h3>
              <p className="text-sm text-gray-500 mb-3">
                Sélectionnez les types de services couverts par cette convention
              </p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryToggle(category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.coveredCategories.includes(category)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Acts Requiring Approval */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actes nécessitant approbation</h3>
              <p className="text-sm text-gray-500 mb-3">
                Codes des actes qui nécessitent une délibération préalable
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newApprovalCode}
                  onChange={(e) => setNewApprovalCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddApprovalCode())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Code acte (ex: IRM, SCAN)"
                />
                <button
                  type="button"
                  onClick={handleAddApprovalCode}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.actsRequiringApproval.map(code => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => handleRemoveApprovalCode(code)}
                      className="p-0.5 hover:bg-yellow-200 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {formData.actsRequiringApproval.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Aucun acte spécifié</p>
                )}
              </div>
            </div>

            {/* Contract Dates */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Durée du contrat</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Date de début
                  </label>
                  <input
                    type="date"
                    name="contractStart"
                    value={formData.contractStart}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Date de fin
                  </label>
                  <input
                    type="date"
                    name="contractEnd"
                    value={formData.contractEnd}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes internes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Notes ou remarques sur cette convention..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {isEditing ? 'Mettre à jour' : 'Créer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
