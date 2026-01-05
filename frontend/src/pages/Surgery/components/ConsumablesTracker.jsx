import { useState, useEffect } from 'react';
import {
  Package, Plus, Search, Trash2, Save, Loader2,
  AlertCircle, Eye, CheckCircle
} from 'lucide-react';
import surgeryService from '../../../services/surgeryService';
import pharmacyInventoryService from '../../../services/pharmacyInventoryService';

/**
 * ConsumablesTracker - Track consumables, equipment and IOL used during surgery
 */
export default function ConsumablesTracker({ surgeryCase, onUpdate }) {
  const [consumables, setConsumables] = useState(surgeryCase?.consumablesUsed || []);
  const [equipment, setEquipment] = useState(surgeryCase?.equipmentUsed || []);
  const [iolDetails, setIolDetails] = useState(surgeryCase?.iolDetails || {
    model: '',
    power: '',
    lotNumber: '',
    serialNumber: '',
    expiryDate: ''
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Manual entry state
  const [manualEntry, setManualEntry] = useState({
    itemName: '',
    quantity: 1,
    lotNumber: ''
  });

  // Equipment entry state
  const [equipmentEntry, setEquipmentEntry] = useState({
    name: '',
    serialNumber: '',
    notes: ''
  });

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('consumables');

  // Determine if this is cataract surgery (needs IOL tracking)
  const isCataractSurgery = surgeryCase?.surgeryType?.name?.toLowerCase().includes('cataract') ||
    surgeryCase?.surgeryType?.name?.toLowerCase().includes('phaco') ||
    surgeryCase?.surgeryType?.category?.toLowerCase().includes('cataract');

  // Search pharmacy inventory
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true);
        try {
          const results = await pharmacyInventoryService.search(searchQuery, {
            limit: 10,
            category: 'surgical_supply'
          });
          // Safely extract array from various API response formats
          const rawData = results?.data?.data ?? results?.data ?? [];
          setSearchResults(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  const handleAddFromInventory = (item) => {
    const newConsumable = {
      item: item._id,
      itemName: item.medication?.genericName || item.name || 'Item',
      quantity: 1,
      lotNumber: item.inventory?.batches?.[0]?.lotNumber || '',
      expiryDate: item.inventory?.batches?.[0]?.expiryDate || null
    };
    setConsumables([...consumables, newConsumable]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddManual = () => {
    if (!manualEntry.itemName) return;
    const newConsumable = {
      item: null,
      itemName: manualEntry.itemName,
      quantity: manualEntry.quantity || 1,
      lotNumber: manualEntry.lotNumber || ''
    };
    setConsumables([...consumables, newConsumable]);
    setManualEntry({ itemName: '', quantity: 1, lotNumber: '' });
  };

  const handleAddEquipment = () => {
    if (!equipmentEntry.name) return;
    setEquipment([...equipment, { ...equipmentEntry }]);
    setEquipmentEntry({ name: '', serialNumber: '', notes: '' });
  };

  const handleRemoveConsumable = (index) => {
    setConsumables(consumables.filter((_, i) => i !== index));
  };

  const handleRemoveEquipment = (index) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index, quantity) => {
    const updated = [...consumables];
    updated[index].quantity = parseInt(quantity) || 1;
    setConsumables(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await surgeryService.addConsumables(surgeryCase._id, {
        consumables,
        equipment,
        iolDetails: isCataractSurgery && iolDetails.model ? iolDetails : null
      });
      setSaveSuccess(true);
      onUpdate?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving consumables:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Consommables & Matériel</h3>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Enregistrement...' : saveSuccess ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('consumables')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'consumables'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Consommables ({consumables.length})
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'equipment'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Équipement ({equipment.length})
          </button>
          {isCataractSurgery && (
            <button
              onClick={() => setActiveTab('iol')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1 ${
                activeTab === 'iol'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="h-4 w-4" />
              IOL
              {iolDetails.model && <CheckCircle className="h-3 w-3 text-green-500" />}
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Consumables Tab */}
        {activeTab === 'consumables' && (
          <div className="space-y-4">
            {/* Search from inventory */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rechercher dans l'inventaire
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un consommable..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-600" />
                )}
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => handleAddFromInventory(item)}
                      className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.medication?.genericName || item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Stock: {item.inventory?.currentStock || 0}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-purple-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Ou ajouter manuellement
              </p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={manualEntry.itemName}
                  onChange={(e) => setManualEntry({ ...manualEntry, itemName: e.target.value })}
                  placeholder="Nom de l'article"
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={manualEntry.quantity}
                    onChange={(e) => setManualEntry({ ...manualEntry, quantity: parseInt(e.target.value) || 1 })}
                    min="1"
                    className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center"
                  />
                  <button
                    onClick={handleAddManual}
                    disabled={!manualEntry.itemName}
                    className="btn btn-sm btn-secondary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Consumables list */}
            {consumables.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Articles ajoutés</p>
                {consumables.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                      {item.lotNumber && (
                        <p className="text-xs text-gray-500">Lot: {item.lotNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                        min="1"
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                      />
                      <button
                        onClick={() => handleRemoveConsumable(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {consumables.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Aucun consommable ajouté
              </p>
            )}
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            {/* Equipment entry form */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Ajouter un équipement
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={equipmentEntry.name}
                  onChange={(e) => setEquipmentEntry({ ...equipmentEntry, name: e.target.value })}
                  placeholder="Nom de l'équipement"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={equipmentEntry.serialNumber}
                    onChange={(e) => setEquipmentEntry({ ...equipmentEntry, serialNumber: e.target.value })}
                    placeholder="N° série (optionnel)"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleAddEquipment}
                    disabled={!equipmentEntry.name}
                    className="btn btn-secondary flex items-center justify-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Equipment list */}
            {equipment.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Équipements utilisés</p>
                {equipment.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.serialNumber && (
                        <p className="text-xs text-gray-500">N° série: {item.serialNumber}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveEquipment(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {equipment.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Aucun équipement ajouté
              </p>
            )}
          </div>
        )}

        {/* IOL Tab (for cataract surgery) */}
        {activeTab === 'iol' && isCataractSurgery && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <Eye className="h-4 w-4 inline mr-1" />
                Informations sur l'implant intraoculaire (IOL) pour la chirurgie de cataracte
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modèle IOL *
                </label>
                <input
                  type="text"
                  value={iolDetails.model}
                  onChange={(e) => setIolDetails({ ...iolDetails, model: e.target.value })}
                  placeholder="Ex: Alcon AcrySof IQ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Puissance (dioptries) *
                </label>
                <input
                  type="text"
                  value={iolDetails.power}
                  onChange={(e) => setIolDetails({ ...iolDetails, power: e.target.value })}
                  placeholder="Ex: +21.0 D"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° de lot
                </label>
                <input
                  type="text"
                  value={iolDetails.lotNumber}
                  onChange={(e) => setIolDetails({ ...iolDetails, lotNumber: e.target.value })}
                  placeholder="Numéro de lot"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° de série
                </label>
                <input
                  type="text"
                  value={iolDetails.serialNumber}
                  onChange={(e) => setIolDetails({ ...iolDetails, serialNumber: e.target.value })}
                  placeholder="Numéro de série"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date d'expiration
                </label>
                <input
                  type="date"
                  value={iolDetails.expiryDate ? new Date(iolDetails.expiryDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setIolDetails({ ...iolDetails, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {iolDetails.model && iolDetails.power && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">IOL configuré</p>
                    <p className="text-sm">
                      {iolDetails.model} - {iolDetails.power}
                      {iolDetails.lotNumber && ` (Lot: ${iolDetails.lotNumber})`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
