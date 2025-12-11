import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Plus, Edit2, Trash2, Search, X, Save,
  Filter, ChevronLeft, ChevronRight, Calendar, RefreshCw,
  CheckCircle, XCircle, Tag, Building2, Copy, AlertTriangle,
  FileText, ArrowRight
} from 'lucide-react';
import feeScheduleService from '../../services/feeScheduleService';
import { getClinicsForDropdown } from '../../services/clinicService';
import { toast } from 'react-toastify';

// Category options matching backend enum
const CATEGORIES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'procedure', label: 'Procédure' },
  { value: 'medication', label: 'Médicament' },
  { value: 'imaging', label: 'Imagerie' },
  { value: 'laboratory', label: 'Laboratoire' },
  { value: 'therapy', label: 'Thérapie' },
  { value: 'device', label: 'Dispositif' },
  { value: 'surgery', label: 'Chirurgie' },
  { value: 'examination', label: 'Examen' },
  { value: 'optical', label: 'Optique' },
  { value: 'other', label: 'Autre' }
];

const CURRENCIES = [
  { value: 'CDF', label: 'CDF (Franc Congolais)' },
  { value: 'USD', label: 'USD (Dollar US)' }
];

const ITEMS_PER_PAGE = 50;

/**
 * TarifManagement - Manage fee schedules / service prices
 * Supports multi-clinic pricing with templates
 */
export default function TarifManagement() {
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [useScheduledChange, setUseScheduledChange] = useState(false);

  // Multi-clinic state
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState('templates'); // 'templates' or clinic ID
  const [clinicStatus, setClinicStatus] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState('templates');
  const [copyTarget, setCopyTarget] = useState('');
  const [copyOverwrite, setCopyOverwrite] = useState(false);
  const [copying, setCopying] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'consultation',
    displayCategory: '',
    department: '',
    price: '',
    currency: 'CDF',
    unit: 'unit',
    taxable: true,
    taxRate: 0,
    insuranceClaimable: true,
    effectiveFrom: '',
    effectiveTo: '',
    notes: ''
  });

  // Load clinics on mount
  useEffect(() => {
    loadClinics();
  }, []);

  // Load fee schedules when clinic or inactive filter changes
  useEffect(() => {
    loadFeeSchedules();
  }, [showInactive, selectedClinic]);

  // Load clinic pricing status
  useEffect(() => {
    if (clinics.length > 0) {
      loadClinicStatus();
    }
  }, [clinics]);

  const loadClinics = async () => {
    try {
      const result = await getClinicsForDropdown();
      setClinics(result || []);
    } catch (error) {
      console.error('Error loading clinics:', error);
    }
  };

  const loadClinicStatus = async () => {
    try {
      const result = await feeScheduleService.getClinicPricingStatus();
      setClinicStatus(result.data || null);
    } catch (error) {
      console.error('Error loading clinic status:', error);
    }
  };

  const loadFeeSchedules = async () => {
    setLoading(true);
    try {
      let result;
      if (selectedClinic === 'templates') {
        // Load template fee schedules (isTemplate: true, no clinic)
        result = await feeScheduleService.getTemplates({
          active: showInactive ? undefined : true
        });
      } else {
        // Load clinic-specific fee schedules
        result = await feeScheduleService.getForClinic(selectedClinic, {
          active: showInactive ? undefined : true
        });
      }
      setFeeSchedules(result.data || []);
    } catch (error) {
      console.error('Error loading fee schedules:', error);
      toast.error('Erreur lors du chargement des tarifs');
    } finally {
      setLoading(false);
    }
  };

  // Filter and paginate
  const filteredItems = useMemo(() => {
    let items = feeSchedules;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item =>
        item.code?.toLowerCase().includes(searchLower) ||
        item.name?.toLowerCase().includes(searchLower) ||
        item.displayCategory?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (categoryFilter) {
      items = items.filter(item => item.category === categoryFilter);
    }

    return items;
  }, [feeSchedules, search, categoryFilter]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('Le code est requis');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    if (!formData.price || formData.price < 0) {
      toast.error('Le prix doit être un nombre positif');
      return;
    }

    setSaving(true);
    try {
      const dataToSend = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        price: Number(formData.price),
        taxRate: Number(formData.taxRate) || 0
      };

      // Add clinic or mark as template
      if (selectedClinic === 'templates') {
        dataToSend.isTemplate = true;
        dataToSend.clinic = null;
      } else {
        dataToSend.isTemplate = false;
        dataToSend.clinic = selectedClinic;
      }

      // Remove empty date fields
      if (!dataToSend.effectiveFrom) delete dataToSend.effectiveFrom;
      if (!dataToSend.effectiveTo) delete dataToSend.effectiveTo;

      if (editingItem) {
        await feeScheduleService.updateFeeSchedule(editingItem._id, dataToSend);
        toast.success('Tarif mis à jour');
      } else {
        await feeScheduleService.createFeeSchedule(dataToSend);
        toast.success('Tarif créé');
      }
      loadFeeSchedules();
      loadClinicStatus();
      resetForm();
    } catch (error) {
      console.error('Error saving fee schedule:', error);
      const message = error.response?.data?.error || 'Erreur lors de l\'enregistrement';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToClinic = async () => {
    if (!copyTarget) {
      toast.error('Veuillez sélectionner une clinique cible');
      return;
    }

    setCopying(true);
    try {
      const sourceId = copySource === 'templates' ? null : copySource;
      const result = await feeScheduleService.copyToClinic(sourceId, copyTarget, copyOverwrite);

      const { created, skipped, updated } = result.data || {};
      let message = `Copie terminée: ${created || 0} créé(s)`;
      if (updated) message += `, ${updated} mis à jour`;
      if (skipped) message += `, ${skipped} ignoré(s)`;

      toast.success(message);
      setShowCopyModal(false);
      loadClinicStatus();

      // If we're viewing the target clinic, reload
      if (selectedClinic === copyTarget) {
        loadFeeSchedules();
      }
    } catch (error) {
      console.error('Error copying fee schedules:', error);
      const message = error.response?.data?.error || 'Erreur lors de la copie';
      toast.error(message);
    } finally {
      setCopying(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      category: item.category || 'consultation',
      displayCategory: item.displayCategory || '',
      department: item.department || '',
      price: item.price || '',
      currency: item.currency || 'CDF',
      unit: item.unit || 'unit',
      taxable: item.taxable !== false,
      taxRate: item.taxRate || 0,
      insuranceClaimable: item.insuranceClaimable !== false,
      effectiveFrom: item.effectiveFrom ? item.effectiveFrom.split('T')[0] : '',
      effectiveTo: item.effectiveTo ? item.effectiveTo.split('T')[0] : '',
      notes: item.notes || ''
    });
    setEditingItem(item);
    setUseScheduledChange(false);
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Désactiver le tarif "${item.name}" ?`)) return;

    try {
      await feeScheduleService.deleteFeeSchedule(item._id);
      toast.success('Tarif désactivé');
      loadFeeSchedules();
    } catch (error) {
      console.error('Error deleting fee schedule:', error);
      toast.error('Erreur lors de la désactivation');
    }
  };

  const handleReactivate = async (item) => {
    try {
      await feeScheduleService.reactivateFeeSchedule(item._id);
      toast.success('Tarif réactivé');
      loadFeeSchedules();
    } catch (error) {
      console.error('Error reactivating fee schedule:', error);
      toast.error('Erreur lors de la réactivation');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: 'consultation',
      displayCategory: '',
      department: '',
      price: '',
      currency: 'CDF',
      unit: 'unit',
      taxable: true,
      taxRate: 0,
      insuranceClaimable: true,
      effectiveFrom: '',
      effectiveTo: '',
      notes: ''
    });
    setEditingItem(null);
    setUseScheduledChange(false);
    setShowForm(false);
  };

  const formatPrice = (price, currency = 'CDF') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price) + ' ' + currency;
  };

  const getCategoryLabel = (category) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getClinicName = (clinicId) => {
    if (clinicId === 'templates') return 'Modèles centraux';
    const clinic = clinics.find(c => c._id === clinicId);
    return clinic?.name || clinicId;
  };

  const getClinicPricingInfo = (clinicId) => {
    if (!clinicStatus || clinicId === 'templates') return null;
    return clinicStatus.find(s => s.clinicId === clinicId);
  };

  const selectedClinicInfo = getClinicPricingInfo(selectedClinic);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Gestion des tarifs
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gérez les prix des services, actes médicaux et produits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCopySource('templates');
              setCopyTarget('');
              setCopyOverwrite(false);
              setShowCopyModal(true);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copier vers clinique
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouveau tarif
          </button>
        </div>
      </div>

      {/* Clinic Selector */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-700">Afficher les tarifs:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedClinic('templates')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedClinic === 'templates'
                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              <FileText className="h-4 w-4" />
              Modèles centraux
            </button>

            {clinics.map(clinic => {
              const info = getClinicPricingInfo(clinic._id);
              const isIncomplete = info && info.percentComplete < 100;
              return (
                <button
                  key={clinic._id}
                  onClick={() => setSelectedClinic(clinic._id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    selectedClinic === clinic._id
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {clinic.name}
                  {isIncomplete && (
                    <span className="w-2 h-2 bg-orange-500 rounded-full" title={`${info.percentComplete}% configuré`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinic status warning */}
        {selectedClinicInfo && selectedClinicInfo.percentComplete < 100 && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800">
                Configuration incomplète ({selectedClinicInfo.percentComplete}%)
              </p>
              <p className="text-orange-700 mt-1">
                {selectedClinicInfo.configured} tarifs sur {selectedClinicInfo.total} configurés.
                {selectedClinicInfo.missing > 0 && ` Il manque ${selectedClinicInfo.missing} tarif(s).`}
              </p>
              <button
                onClick={() => {
                  setCopySource('templates');
                  setCopyTarget(selectedClinic);
                  setCopyOverwrite(false);
                  setShowCopyModal(true);
                }}
                className="mt-2 text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
              >
                <Copy className="h-4 w-4" />
                Copier les tarifs manquants depuis les modèles
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par code ou nom..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 appearance-none bg-white"
          >
            <option value="">Toutes catégories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Afficher inactifs
        </label>

        <div className="text-sm text-gray-500">
          {filteredItems.length} tarif{filteredItems.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Modifier le tarif' : 'Nouveau tarif'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 uppercase"
                    placeholder="CONSULT_GENERAL"
                    required
                    disabled={!!editingItem}
                  />
                  {editingItem && (
                    <p className="mt-1 text-xs text-gray-500">Le code ne peut pas être modifié</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du service *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Consultation générale"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie d'affichage
                  </label>
                  <input
                    type="text"
                    value={formData.displayCategory}
                    onChange={(e) => setFormData({...formData, displayCategory: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Consultations"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Département
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ophtalmologie"
                  />
                </div>
              </div>

              {/* Price Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Tarification
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prix *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="25000"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Devise
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.value} value={curr.value}>{curr.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taux de taxe (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({...formData, taxRate: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.taxable}
                      onChange={(e) => setFormData({...formData, taxable: e.target.checked})}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Taxable</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.insuranceClaimable}
                      onChange={(e) => setFormData({...formData, insuranceClaimable: e.target.checked})}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Remboursable (assurance)</span>
                  </label>
                </div>
              </div>

              {/* Scheduled Change Option (only for editing) */}
              {editingItem && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={useScheduledChange}
                      onChange={(e) => setUseScheduledChange(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-blue-900 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Changement de prix programmé
                    </span>
                  </label>

                  {useScheduledChange && (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date d'effet
                        </label>
                        <input
                          type="date"
                          value={formData.effectiveFrom}
                          onChange={(e) => setFormData({...formData, effectiveFrom: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date de fin (optionnel)
                        </label>
                        <input
                          type="date"
                          value={formData.effectiveTo}
                          onChange={(e) => setFormData({...formData, effectiveTo: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-blue-700 mt-2">
                    {useScheduledChange
                      ? 'Le nouveau prix entrera en vigueur à la date spécifiée'
                      : 'Cochez pour programmer un changement de prix à une date future'}
                  </p>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="2"
                  placeholder="Description du service..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes internes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows="2"
                  placeholder="Notes visibles uniquement par l'administration..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Enregistrement...' : (editingItem ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy to Clinic Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Copy className="h-5 w-5 text-blue-600" />
                Copier les tarifs vers une clinique
              </h3>
              <button
                onClick={() => setShowCopyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source des tarifs
                </label>
                <select
                  value={copySource}
                  onChange={(e) => setCopySource(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="templates">Modèles centraux</option>
                  {clinics.map(clinic => (
                    <option key={clinic._id} value={clinic._id}>{clinic.name}</option>
                  ))}
                </select>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-gray-400" />
              </div>

              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clinique cible *
                </label>
                <select
                  value={copyTarget}
                  onChange={(e) => setCopyTarget(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {clinics
                    .filter(c => c._id !== copySource)
                    .map(clinic => (
                      <option key={clinic._id} value={clinic._id}>{clinic.name}</option>
                    ))}
                </select>
              </div>

              {/* Overwrite option */}
              <label className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={copyOverwrite}
                  onChange={(e) => setCopyOverwrite(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <div>
                  <span className="font-medium text-yellow-800">Écraser les tarifs existants</span>
                  <p className="text-xs text-yellow-700 mt-1">
                    Si coché, les prix existants dans la clinique cible seront mis à jour.
                    Sinon, seuls les tarifs manquants seront créés.
                  </p>
                </div>
              </label>

              {/* Info */}
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <p>
                  Cette action copiera tous les tarifs de <strong>{getClinicName(copySource)}</strong> vers
                  la clinique sélectionnée.
                </p>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowCopyModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCopyToClinic}
                disabled={copying || !copyTarget}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                {copying ? 'Copie en cours...' : 'Copier les tarifs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-2" />
          Chargement des tarifs...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <DollarSign className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">Aucun tarif trouvé</p>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="mt-4 text-green-600 hover:text-green-700"
          >
            + Ajouter un tarif
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedItems.map((item) => (
                  <tr
                    key={item._id}
                    className={`hover:bg-gray-50 ${!item.active ? 'bg-gray-100 opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {item.code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      {item.displayCategory && (
                        <div className="text-xs text-gray-500">{item.displayCategory}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                        <Tag className="h-3 w-3" />
                        {getCategoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-700">
                        {formatPrice(item.price, item.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {item.active ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs">Actif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs">Inactif</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {item.active ? (
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Désactiver"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(item)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                            title="Réactiver"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">
                Affichage {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} sur {filteredItems.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
