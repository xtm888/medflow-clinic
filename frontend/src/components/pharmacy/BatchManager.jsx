import { useState, useEffect } from 'react';
import { X, Plus, Package, AlertTriangle, Calendar, Check, Trash2 } from 'lucide-react';
import pharmacyInventoryService from '../../services/pharmacyInventoryService';

const BatchManager = ({ isOpen, onClose, medication, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newBatch, setNewBatch] = useState({
    lotNumber: '',
    quantity: '',
    expirationDate: '',
    manufactureDate: '',
    supplier: { name: '', contact: '', reference: '' },
    cost: { unitCost: '', totalCost: '' },
    notes: ''
  });

  useEffect(() => {
    if (isOpen && medication?._id) {
      fetchBatches();
    }
  }, [isOpen, medication]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await pharmacyInventoryService.getBatches(medication._id);
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setBatches(data);
    } catch (err) {
      setError('Erreur lors du chargement des lots');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await pharmacyInventoryService.addBatch(medication._id, {
        lotNumber: newBatch.lotNumber,
        quantity: parseInt(newBatch.quantity),
        expirationDate: newBatch.expirationDate,
        manufactureDate: newBatch.manufactureDate || undefined,
        supplier: newBatch.supplier.name ? newBatch.supplier : undefined,
        cost: newBatch.cost.unitCost ? {
          unitCost: parseFloat(newBatch.cost.unitCost),
          totalCost: parseFloat(newBatch.cost.unitCost) * parseInt(newBatch.quantity)
        } : undefined,
        notes: newBatch.notes || undefined
      });

      setSuccess('Lot ajouté avec succès');
      setShowAddForm(false);
      setNewBatch({
        lotNumber: '',
        quantity: '',
        expirationDate: '',
        manufactureDate: '',
        supplier: { name: '', contact: '', reference: '' },
        cost: { unitCost: '', totalCost: '' },
        notes: ''
      });
      fetchBatches();
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout du lot');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkExpired = async (lotNumber) => {
    if (!confirm(`Marquer le lot ${lotNumber} comme expiré ?`)) return;

    try {
      setLoading(true);
      await pharmacyInventoryService.markBatchExpired(medication._id, lotNumber);
      setSuccess(`Lot ${lotNumber} marqué comme expiré`);
      fetchBatches();
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du lot');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'badge-success',
      'expired': 'badge-danger',
      'recalled': 'badge-danger',
      'quarantined': 'badge-warning',
      'depleted': 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Actif',
      'expired': 'Expiré',
      'recalled': 'Rappelé',
      'quarantined': 'Quarantaine',
      'depleted': 'Épuisé'
    };
    return labels[status] || status;
  };

  const getDaysToExpiry = (date) => {
    const now = new Date();
    const expiry = new Date(date);
    const diff = expiry - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2 text-primary-600" />
              Gestion des lots
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {medication?.medication?.brandName || medication?.medication?.genericName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
              <button onClick={() => setError('')} className="ml-auto text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800">{success}</p>
              <button onClick={() => setSuccess('')} className="ml-auto text-green-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Add Batch Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary mb-4 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Ajouter un lot</span>
            </button>
          )}

          {/* Add Batch Form */}
          {showAddForm && (
            <form onSubmit={handleAddBatch} className="mb-6 bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4">Nouveau lot</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de lot *
                  </label>
                  <input
                    type="text"
                    value={newBatch.lotNumber}
                    onChange={(e) => setNewBatch({ ...newBatch, lotNumber: e.target.value })}
                    className="input"
                    required
                    placeholder="LOT123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    value={newBatch.quantity}
                    onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
                    className="input"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date d'expiration *
                  </label>
                  <input
                    type="date"
                    value={newBatch.expirationDate}
                    onChange={(e) => setNewBatch({ ...newBatch, expirationDate: e.target.value })}
                    className="input"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fabrication
                  </label>
                  <input
                    type="date"
                    value={newBatch.manufactureDate}
                    onChange={(e) => setNewBatch({ ...newBatch, manufactureDate: e.target.value })}
                    className="input"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fournisseur
                  </label>
                  <input
                    type="text"
                    value={newBatch.supplier.name}
                    onChange={(e) => setNewBatch({
                      ...newBatch,
                      supplier: { ...newBatch.supplier, name: e.target.value }
                    })}
                    className="input"
                    placeholder="Nom du fournisseur"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coût unitaire (CFA)
                  </label>
                  <input
                    type="number"
                    value={newBatch.cost.unitCost}
                    onChange={(e) => setNewBatch({
                      ...newBatch,
                      cost: { ...newBatch.cost, unitCost: e.target.value }
                    })}
                    className="input"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newBatch.notes}
                    onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                    className="input"
                    rows="2"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Ajout...' : 'Ajouter le lot'}
                </button>
              </div>
            </form>
          )}

          {/* Batches List */}
          <div className="space-y-3">
            {loading && !batches.length ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun lot enregistré
              </div>
            ) : (
              batches.map((batch) => {
                const daysToExpiry = getDaysToExpiry(batch.expirationDate);
                const isExpiringSoon = daysToExpiry <= 30 && daysToExpiry > 0;
                const isExpired = daysToExpiry <= 0;

                return (
                  <div
                    key={batch.lotNumber}
                    className={`border rounded-lg p-4 ${
                      isExpired ? 'bg-red-50 border-red-200' :
                      isExpiringSoon ? 'bg-orange-50 border-orange-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-medium text-gray-900">
                            {batch.lotNumber}
                          </span>
                          <span className={`badge ${getStatusColor(batch.status)}`}>
                            {getStatusLabel(batch.status)}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Quantité:</span>
                            <span className="ml-1 font-medium">{batch.quantity}</span>
                            {batch.reserved > 0 && (
                              <span className="text-orange-600 ml-1">
                                ({batch.reserved} réservés)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                            <span className={`${
                              isExpired ? 'text-red-600 font-semibold' :
                              isExpiringSoon ? 'text-orange-600 font-semibold' :
                              'text-gray-600'
                            }`}>
                              {new Date(batch.expirationDate).toLocaleDateString('fr-FR')}
                            </span>
                            {!isExpired && (
                              <span className="text-gray-500 ml-1">
                                ({daysToExpiry}j)
                              </span>
                            )}
                          </div>

                          {batch.supplier?.name && (
                            <div>
                              <span className="text-gray-500">Fournisseur:</span>
                              <span className="ml-1">{batch.supplier.name}</span>
                            </div>
                          )}

                          {batch.cost?.unitCost && (
                            <div>
                              <span className="text-gray-500">Coût:</span>
                              <span className="ml-1">{batch.cost.unitCost.toLocaleString()} CFA</span>
                            </div>
                          )}
                        </div>

                        {batch.notes && (
                          <p className="mt-2 text-sm text-gray-500">{batch.notes}</p>
                        )}
                      </div>

                      {batch.status === 'active' && (
                        <button
                          onClick={() => handleMarkExpired(batch.lotNumber)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Marquer comme expiré"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchManager;
