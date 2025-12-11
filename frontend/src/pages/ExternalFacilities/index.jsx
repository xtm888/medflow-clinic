import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react';
import externalFacilityService from '../../services/externalFacilityService';

const facilityTypeIcons = {
  'pharmacy': '💊',
  'laboratory': '🔬',
  'imaging-center': '📸',
  'surgical-facility': '🏥',
  'optical-shop': '👓',
  'specialist-clinic': '🩺',
  'hospital': '🏨',
  'therapy-center': '🏃',
  'other': '📋'
};

export default function ExternalFacilityManager() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  const fetchFacilities = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: 20,
        search: searchQuery || undefined,
        type: selectedType || undefined
      };
      const response = await externalFacilityService.getAll(params);
      if (response.success) {
        setFacilities(response.data.facilities);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, searchQuery, selectedType]);

  const fetchSummary = async () => {
    try {
      const response = await externalFacilityService.getSummary();
      if (response.success) {
        setSummary(response.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  useEffect(() => {
    fetchFacilities();
    fetchSummary();
  }, [fetchFacilities]);

  const handleDelete = async (id) => {
    if (!confirm('Voulez-vous vraiment désactiver ce prestataire externe?')) return;

    try {
      await externalFacilityService.delete(id);
      fetchFacilities();
      fetchSummary();
    } catch (error) {
      console.error('Error deleting facility:', error);
    }
  };

  const handleEdit = (facility) => {
    setEditingFacility(facility);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingFacility(null);
    setShowModal(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prestataires Externes</h1>
          <p className="text-gray-600">Gérez les pharmacies, laboratoires, centres chirurgicaux et autres partenaires</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Ajouter un prestataire
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {summary.byType.map((item) => (
            <div
              key={item.type}
              className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedType(item.type === selectedType ? '' : item.type)}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{facilityTypeIcons[item.type] || '📋'}</span>
                <span className="text-2xl font-bold text-gray-900">{item.count}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{externalFacilityService.getTypeLabel(item.type)}</p>
              {item.totalReferrals > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {item.completedReferrals}/{item.totalReferrals} orientations
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un prestataire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les types</option>
          {externalFacilityService.facilityTypes.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Facilities List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : facilities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Building2 className="h-16 w-16 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun prestataire trouvé</h3>
          <p className="mt-2 text-gray-500">Commencez par ajouter un prestataire externe</p>
          <button
            onClick={handleAdd}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Ajouter un prestataire
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {facilities.map((facility) => (
            <div key={facility._id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{facilityTypeIcons[facility.type] || '📋'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{facility.name}</h3>
                      <p className="text-sm text-gray-500">{externalFacilityService.getTypeLabel(facility.type)}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${facility.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {facility.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  {facility.contact?.address?.city && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{facility.contact.address.street}, {facility.contact.address.city}</span>
                    </div>
                  )}
                  {facility.contact?.phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{facility.contact.phone}</span>
                    </div>
                  )}
                  {facility.contact?.email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="truncate">{facility.contact.email}</span>
                    </div>
                  )}
                </div>

                {/* Performance Stats */}
                {facility.performance?.totalReferrals > 0 && (
                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <BarChart3 className="h-4 w-4 mr-1" />
                      <span>{facility.performance.totalReferrals} orientations</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                      <span className="text-green-600">{facility.performance.completedReferrals} terminées</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                  <button
                    onClick={() => handleEdit(facility)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Modifier"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(facility._id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Désactiver"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setPagination(p => ({ ...p, current: Math.max(1, p.current - 1) }))}
              disabled={pagination.current === 1}
              className="px-3 py-2 rounded border disabled:opacity-50"
            >
              Précédent
            </button>
            <span className="text-gray-600">
              Page {pagination.current} sur {pagination.pages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, current: Math.min(p.pages, p.current + 1) }))}
              disabled={pagination.current === pagination.pages}
              className="px-3 py-2 rounded border disabled:opacity-50"
            >
              Suivant
            </button>
          </nav>
        </div>
      )}

      {/* Modal for Add/Edit */}
      {showModal && (
        <FacilityModal
          facility={editingFacility}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchFacilities();
            fetchSummary();
          }}
        />
      )}
    </div>
  );
}

function FacilityModal({ facility, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: facility?.name || '',
    type: facility?.type || 'pharmacy',
    subType: facility?.subType || '',
    contact: {
      address: {
        street: facility?.contact?.address?.street || '',
        city: facility?.contact?.address?.city || '',
        state: facility?.contact?.address?.state || '',
        postalCode: facility?.contact?.address?.postalCode || '',
        country: facility?.contact?.address?.country || 'RDC'
      },
      phone: facility?.contact?.phone || '',
      alternatePhone: facility?.contact?.alternatePhone || '',
      email: facility?.contact?.email || '',
      fax: facility?.contact?.fax || ''
    },
    primaryContact: {
      name: facility?.primaryContact?.name || '',
      role: facility?.primaryContact?.role || '',
      phone: facility?.primaryContact?.phone || '',
      email: facility?.primaryContact?.email || ''
    },
    notes: facility?.notes || '',
    isActive: facility?.isActive !== false
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (facility) {
        await externalFacilityService.update(facility._id, formData);
      } else {
        await externalFacilityService.create(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving facility:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {facility ? 'Modifier le prestataire' : 'Nouveau prestataire'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {externalFacilityService.facilityTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sous-type</label>
                <input
                  type="text"
                  value={formData.subType}
                  onChange={(e) => handleChange('subType', e.target.value)}
                  placeholder="Ex: Chirurgie rétine"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Coordonnées</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={formData.contact.address.street}
                    onChange={(e) => handleChange('contact.address.street', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input
                    type="text"
                    value={formData.contact.address.city}
                    onChange={(e) => handleChange('contact.address.city', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                  <input
                    type="text"
                    value={formData.contact.address.state}
                    onChange={(e) => handleChange('contact.address.state', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.contact.phone}
                    onChange={(e) => handleChange('contact.phone', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.contact.email}
                    onChange={(e) => handleChange('contact.email', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Primary Contact */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Contact principal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.primaryContact.name}
                    onChange={(e) => handleChange('primaryContact.name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fonction</label>
                  <input
                    type="text"
                    value={formData.primaryContact.role}
                    onChange={(e) => handleChange('primaryContact.role', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.primaryContact.phone}
                    onChange={(e) => handleChange('primaryContact.phone', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.primaryContact.email}
                    onChange={(e) => handleChange('primaryContact.email', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">Prestataire actif</label>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : (facility ? 'Mettre à jour' : 'Créer')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
