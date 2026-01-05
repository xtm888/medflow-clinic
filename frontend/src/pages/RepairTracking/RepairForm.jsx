import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Wrench, Save, X, Search, User, Package, AlertTriangle,
  Phone, Mail, Clock, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-toastify';
import repairService from '../../services/repairService';
import patientService from '../../services/patientService';
import LoadingSpinner from '../../components/LoadingSpinner';

const ITEM_TYPES = [
  { value: 'eyeglasses', label: 'Lunettes de vue' },
  { value: 'frame', label: 'Monture seule' },
  { value: 'sunglasses', label: 'Lunettes de soleil' },
  { value: 'contact_lens_case', label: 'Étui lentilles' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'hearing_aid', label: 'Appareil auditif' },
  { value: 'low_vision_device', label: 'Aide basse vision' },
  { value: 'other', label: 'Autre' }
];

const PROBLEM_CATEGORIES = [
  { value: 'broken_frame', label: 'Monture cassée' },
  { value: 'loose_screw', label: 'Vis desserrée' },
  { value: 'nose_pad', label: 'Plaquette nasale' },
  { value: 'temple_adjustment', label: 'Ajustement branches' },
  { value: 'lens_scratch', label: 'Rayure verre' },
  { value: 'lens_chip', label: 'Éclat verre' },
  { value: 'lens_replacement', label: 'Remplacement verre' },
  { value: 'coating_damage', label: 'Traitement endommagé' },
  { value: 'hinge_repair', label: 'Réparation charnière' },
  { value: 'bridge_repair', label: 'Réparation pont' },
  { value: 'welding', label: 'Soudure' },
  { value: 'cleaning', label: 'Nettoyage' },
  { value: 'equipment_malfunction', label: 'Dysfonctionnement équipement' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'other', label: 'Autre' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse', color: 'text-gray-600' },
  { value: 'normal', label: 'Normale', color: 'text-blue-600' },
  { value: 'high', label: 'Haute', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' }
];

const REPAIR_TYPES = [
  { value: 'in_house', label: 'Interne' },
  { value: 'send_out', label: 'Envoi externe' },
  { value: 'manufacturer', label: 'Fabricant' },
  { value: 'warranty', label: 'Garantie' }
];

export default function RepairForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [formData, setFormData] = useState({
    customer: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    itemType: 'eyeglasses',
    itemDescription: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchasedHere: false,
    problemReported: '',
    problemCategory: '',
    repairType: 'in_house',
    priority: 'normal',
    estimatedCost: '',
    estimatedRepairTime: '',
    coveredUnderWarranty: false,
    notes: ''
  });

  // Load existing repair for edit mode
  useEffect(() => {
    if (isEdit) {
      loadRepair();
    }
  }, [id]);

  const loadRepair = async () => {
    try {
      setLoading(true);
      const response = await repairService.getById(id);
      const repair = response.data || response;

      setFormData({
        customer: repair.customer?._id || repair.customer || '',
        customerName: repair.customerName || `${repair.customer?.firstName || ''} ${repair.customer?.lastName || ''}`.trim(),
        customerPhone: repair.customerPhone || repair.customer?.phone || '',
        customerEmail: repair.customerEmail || repair.customer?.email || '',
        itemType: repair.itemType || 'eyeglasses',
        itemDescription: repair.itemDescription || '',
        brand: repair.brand || '',
        model: repair.model || '',
        serialNumber: repair.serialNumber || '',
        purchasedHere: repair.purchasedHere || false,
        problemReported: repair.problemReported || '',
        problemCategory: repair.problemCategory || '',
        repairType: repair.repairType || 'in_house',
        priority: repair.priority || 'normal',
        estimatedCost: repair.estimatedCost || '',
        estimatedRepairTime: repair.estimatedRepairTime || '',
        coveredUnderWarranty: repair.coveredUnderWarranty || false,
        notes: repair.notes || ''
      });
      setPatientSearch(repair.customerName || '');
    } catch (error) {
      toast.error('Erreur lors du chargement de la réparation');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Patient search
  useEffect(() => {
    const searchPatients = async () => {
      if (patientSearch.length < 2) {
        setPatientResults([]);
        return;
      }

      try {
        setSearchingPatients(true);
        const response = await patientService.searchPatients(patientSearch);
        const patients = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.patients)
          ? response.data.patients
          : Array.isArray(response)
          ? response
          : [];
        setPatientResults(patients.slice(0, 10));
        setShowPatientDropdown(true);
      } catch (error) {
        console.error('Patient search error:', error);
        setPatientResults([]);
      } finally {
        setSearchingPatients(false);
      }
    };

    const debounce = setTimeout(searchPatients, 300);
    return () => clearTimeout(debounce);
  }, [patientSearch]);

  const handlePatientSelect = (patient) => {
    setFormData({
      ...formData,
      customer: patient._id,
      customerName: `${patient.firstName} ${patient.lastName}`,
      customerPhone: patient.phone || patient.phoneNumber || '',
      customerEmail: patient.email || ''
    });
    setPatientSearch(`${patient.firstName} ${patient.lastName}`);
    setShowPatientDropdown(false);
    setPatientResults([]);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.customer) {
      toast.error('Veuillez sélectionner un client');
      return;
    }
    if (!formData.itemDescription) {
      toast.error('Veuillez décrire l\'article');
      return;
    }
    if (!formData.problemReported) {
      toast.error('Veuillez décrire le problème');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        customer: formData.customer,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        itemType: formData.itemType,
        itemDescription: formData.itemDescription,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        purchasedHere: formData.purchasedHere,
        problemReported: formData.problemReported,
        problemCategory: formData.problemCategory || undefined,
        repairType: formData.repairType,
        priority: formData.priority,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
        estimatedRepairTime: formData.estimatedRepairTime ? parseFloat(formData.estimatedRepairTime) : undefined,
        coveredUnderWarranty: formData.coveredUnderWarranty,
        notes: formData.notes || undefined
      };

      if (isEdit) {
        await repairService.update(id, payload);
        toast.success('Réparation mise à jour');
      } else {
        await repairService.create(payload);
        toast.success('Réparation créée avec succès');
      }

      navigate('/repairs');
    } catch (error) {
      toast.error(isEdit ? 'Erreur lors de la mise à jour' : 'Erreur lors de la création');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/repairs')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Modifier la Réparation' : 'Nouvelle Réparation'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEdit ? 'Modifier les informations de la réparation' : 'Enregistrer un nouvel article à réparer'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Client
          </h2>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechercher un patient *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  if (!e.target.value) {
                    setFormData({ ...formData, customer: '', customerName: '', customerPhone: '', customerEmail: '' });
                  }
                }}
                onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                placeholder="Rechercher par nom, téléphone..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {searchingPatients && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
              )}
            </div>

            {/* Patient dropdown */}
            {showPatientDropdown && patientResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                {patientResults.map((patient) => (
                  <button
                    key={patient._id}
                    type="button"
                    onClick={() => handlePatientSelect(patient)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
                      {patient.firstName?.[0]}{patient.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                      <p className="text-sm text-gray-500">{patient.phone || patient.phoneNumber || 'Pas de téléphone'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected customer info */}
          {formData.customer && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-900">{formData.customerName}</p>
              <div className="flex gap-4 mt-1 text-sm text-blue-700">
                {formData.customerPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {formData.customerPhone}
                  </span>
                )}
                {formData.customerEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {formData.customerEmail}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Item Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Article à réparer
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'article *
              </label>
              <select
                name="itemType"
                value={formData.itemType}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marque
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="Ex: Ray-Ban, Oakley..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description de l'article *
              </label>
              <input
                type="text"
                name="itemDescription"
                value={formData.itemDescription}
                onChange={handleChange}
                placeholder="Ex: Monture métal noire, verres progressifs..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modèle
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="Référence modèle"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N° de série
              </label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="Numéro de série si disponible"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="purchasedHere"
                  checked={formData.purchasedHere}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Acheté dans notre boutique</span>
              </label>
            </div>
          </div>
        </div>

        {/* Problem Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Problème signalé
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie du problème
              </label>
              <select
                name="problemCategory"
                value={formData.problemCategory}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Sélectionner --</option>
                {PROBLEM_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorité
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description du problème *
              </label>
              <textarea
                name="problemReported"
                value={formData.problemReported}
                onChange={handleChange}
                rows={3}
                placeholder="Décrivez le problème signalé par le client..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Repair Details Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-green-600" />
            Détails réparation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de réparation
              </label>
              <select
                name="repairType"
                value={formData.repairType}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {REPAIR_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coût estimé ($)
              </label>
              <input
                type="number"
                name="estimatedCost"
                value={formData.estimatedCost}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temps estimé (heures)
              </label>
              <input
                type="number"
                name="estimatedRepairTime"
                value={formData.estimatedRepairTime}
                onChange={handleChange}
                min="0"
                step="0.5"
                placeholder="Ex: 2"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="coveredUnderWarranty"
                  checked={formData.coveredUnderWarranty}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Couvert par garantie</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes additionnelles
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Notes internes sur la réparation..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/repairs')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Mettre à jour' : 'Créer la réparation'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
