import { useState, useEffect } from 'react';
import {
  UserPlus, Plus, Edit2, Trash2, Search, X, Save,
  Phone, Mail, Building2, Percent, DollarSign, Check
} from 'lucide-react';
import referrerService from '../../services/referrerService';
import { toast } from 'react-toastify';

/**
 * ReferrerManagement - Manage referring doctors and their commission rates
 */
export default function ReferrerManagement() {
  const [referrers, setReferrers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingReferrer, setEditingReferrer] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'external',
    phone: '',
    email: '',
    clinic: '',
    address: '',
    specialty: '',
    commissionType: 'percentage',
    defaultCommissionRate: 10,
    fixedAmount: 0,
    notes: ''
  });

  useEffect(() => {
    loadReferrers();
  }, []);

  const loadReferrers = async () => {
    setLoading(true);
    try {
      const result = await referrerService.getReferrers({ isActive: 'all' });
      // Handle various API response formats defensively
      const data = Array.isArray(result?.data?.data)
        ? result.data.data
        : Array.isArray(result?.data)
        ? result.data
        : [];
      setReferrers(data);
    } catch (error) {
      console.error('Error loading referrers:', error);
      toast.error('Erreur lors du chargement des référents');
      setReferrers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setSaving(true);
    try {
      if (editingReferrer) {
        await referrerService.updateReferrer(editingReferrer._id, formData);
        toast.success('Référent mis à jour');
      } else {
        await referrerService.createReferrer(formData);
        toast.success('Référent créé');
      }
      loadReferrers();
      resetForm();
    } catch (error) {
      console.error('Error saving referrer:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (referrer) => {
    setFormData({
      name: referrer.name || '',
      type: referrer.type || 'external',
      phone: referrer.phone || '',
      email: referrer.email || '',
      clinic: referrer.clinic || '',
      address: referrer.address || '',
      specialty: referrer.specialty || '',
      commissionType: referrer.commissionType || 'percentage',
      defaultCommissionRate: referrer.defaultCommissionRate || 10,
      fixedAmount: referrer.fixedAmount || 0,
      notes: referrer.notes || ''
    });
    setEditingReferrer(referrer);
    setShowForm(true);
  };

  const handleDelete = async (referrer) => {
    if (!confirm(`Désactiver "${referrer.name}" ?`)) return;

    try {
      await referrerService.deleteReferrer(referrer._id);
      toast.success('Référent désactivé');
      loadReferrers();
    } catch (error) {
      console.error('Error deleting referrer:', error);
      toast.error('Erreur lors de la désactivation');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'external',
      phone: '',
      email: '',
      clinic: '',
      address: '',
      specialty: '',
      commissionType: 'percentage',
      defaultCommissionRate: 10,
      fixedAmount: 0,
      notes: ''
    });
    setEditingReferrer(null);
    setShowForm(false);
  };

  const filteredReferrers = referrers.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.clinic?.toLowerCase().includes(search.toLowerCase()) ||
    r.specialty?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-blue-600" />
            Médecins référents
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gérez les médecins qui vous réfèrent des patients et leurs commissions
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nouveau référent
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un référent..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingReferrer ? 'Modifier le référent' : 'Nouveau référent'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du médecin *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Dr. Jean Dupont"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="external">Externe</option>
                    <option value="internal">Interne (clinique)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spécialité
                  </label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ophtalmologie, Médecine générale..."
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="inline h-4 w-4 mr-1" /> Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+243 81 234 5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="inline h-4 w-4 mr-1" /> Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="docteur@email.com"
                  />
                </div>

                {formData.type === 'external' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Building2 className="inline h-4 w-4 mr-1" /> Clinique / Hôpital
                      </label>
                      <input
                        type="text"
                        value={formData.clinic}
                        onChange={(e) => setFormData({...formData, clinic: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Hôpital Central"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Adresse
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="123 Avenue..."
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Commission Settings */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Paramètres de commission
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de commission
                    </label>
                    <select
                      value={formData.commissionType}
                      onChange={(e) => setFormData({...formData, commissionType: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="percentage">Pourcentage (%)</option>
                      <option value="fixed">Montant fixe (forfait)</option>
                      <option value="per_act">Par acte</option>
                    </select>
                  </div>

                  {formData.commissionType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Percent className="inline h-4 w-4 mr-1" /> Taux (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.defaultCommissionRate}
                        onChange={(e) => setFormData({...formData, defaultCommissionRate: Number(e.target.value)})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}

                  {formData.commissionType === 'fixed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <DollarSign className="inline h-4 w-4 mr-1" /> Montant fixe (CDF)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.fixedAmount}
                        onChange={(e) => setFormData({...formData, fixedAmount: Number(e.target.value)})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Notes additionnelles..."
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Enregistrement...' : (editingReferrer ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Referrers List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Chargement...
        </div>
      ) : filteredReferrers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">Aucun référent trouvé</p>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            + Ajouter un référent
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReferrers.map((referrer) => (
            <div
              key={referrer._id}
              className={`bg-white border rounded-lg p-4 ${!referrer.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Dr. {referrer.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      referrer.type === 'internal'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {referrer.type === 'internal' ? 'Interne' : 'Externe'}
                    </span>
                    {!referrer.isActive && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        Inactif
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    {referrer.specialty && <span>{referrer.specialty}</span>}
                    {referrer.clinic && <span>• {referrer.clinic}</span>}
                    {referrer.phone && <span>• {referrer.phone}</span>}
                  </div>

                  {/* Commission Info */}
                  <div className="mt-2 flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded flex items-center gap-1">
                      {referrer.commissionType === 'percentage' && (
                        <><Percent className="h-3 w-3" /> {referrer.defaultCommissionRate}%</>
                      )}
                      {referrer.commissionType === 'fixed' && (
                        <><DollarSign className="h-3 w-3" /> {referrer.fixedAmount?.toLocaleString()} CDF</>
                      )}
                      {referrer.commissionType === 'per_act' && (
                        <>Par acte</>
                      )}
                    </span>
                    {referrer.stats?.totalReferrals > 0 && (
                      <span className="text-xs text-gray-500">
                        {referrer.stats.totalReferrals} patients référés
                      </span>
                    )}
                    {referrer.stats?.totalCommissionEarned > 0 && (
                      <span className="text-xs text-green-600">
                        {referrer.stats.totalCommissionEarned.toLocaleString()} CDF gagnés
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(referrer)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Modifier"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {referrer.isActive && (
                    <button
                      onClick={() => handleDelete(referrer)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Désactiver"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
