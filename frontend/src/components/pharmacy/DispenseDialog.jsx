import { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, Check } from 'lucide-react';
import pharmacyInventoryService from '../../services/pharmacyInventoryService';

const DispenseDialog = ({
  isOpen,
  onClose,
  medication = null,
  prescriptionId = null,
  medicationIndex = null,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [batches, setBatches] = useState([]);
  const [formData, setFormData] = useState({
    quantity: 1,
    lotNumber: '',
    patientId: '',
    notes: '',
    pharmacyNotes: ''
  });

  useEffect(() => {
    if (isOpen && medication?._id) {
      fetchBatches();
    }
  }, [isOpen, medication]);

  const fetchBatches = async () => {
    try {
      const response = await pharmacyInventoryService.getBatches(medication._id);
      const activeBatches = (response.data || [])
        .filter(b => b.status === 'active' && b.quantity > 0)
        .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
      setBatches(activeBatches);

      // Auto-select first batch (FEFO)
      if (activeBatches.length > 0) {
        setFormData(prev => ({ ...prev, lotNumber: activeBatches[0].lotNumber }));
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (prescriptionId) {
        // Dispense from prescription
        await pharmacyInventoryService.dispensePrescription(
          prescriptionId,
          medicationIndex,
          formData.pharmacyNotes
        );
      } else if (medication?._id) {
        // Dispense directly from inventory
        await pharmacyInventoryService.dispense(medication._id, {
          quantity: parseInt(formData.quantity),
          lotNumber: formData.lotNumber || undefined,
          patientId: formData.patientId || undefined,
          notes: formData.notes
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la délivrance');
    } finally {
      setLoading(false);
    }
  };

  const selectedBatch = batches.find(b => b.lotNumber === formData.lotNumber);
  const maxQuantity = selectedBatch?.quantity || medication?.inventory?.currentStock || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-primary-600" />
            Délivrer un médicament
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Délivrance réussie</h3>
            <p className="text-sm text-gray-500">Le médicament a été délivré avec succès.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Medication Info */}
              {medication && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">
                    {medication.medication?.brandName || medication.medication?.genericName}
                  </h3>
                  <p className="text-sm text-gray-500">{medication.medication?.genericName}</p>
                  <div className="mt-2 flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">
                      Stock: <strong>{medication.inventory?.currentStock || 0}</strong>
                    </span>
                    <span className="text-gray-600">
                      Réservé: <strong>{medication.inventory?.reserved || 0}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Batch Selection - Only for direct dispense */}
              {!prescriptionId && batches.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot (FEFO - Premier Expiré, Premier Sorti)
                  </label>
                  <select
                    value={formData.lotNumber}
                    onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                    className="input"
                  >
                    {batches.map(batch => (
                      <option key={batch.lotNumber} value={batch.lotNumber}>
                        {batch.lotNumber} - Qty: {batch.quantity} - Exp: {new Date(batch.expirationDate).toLocaleDateString('fr-FR')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity - Only for direct dispense */}
              {!prescriptionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité à délivrer
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="input"
                    min="1"
                    max={maxQuantity}
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum disponible: {maxQuantity}
                  </p>
                </div>
              )}

              {/* Patient ID - Optional for direct dispense */}
              {!prescriptionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Patient (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="input"
                    placeholder="ID du patient"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes pharmacie
                </label>
                <textarea
                  value={prescriptionId ? formData.pharmacyNotes : formData.notes}
                  onChange={(e) => setFormData({
                    ...formData,
                    [prescriptionId ? 'pharmacyNotes' : 'notes']: e.target.value
                  })}
                  className="input"
                  rows="3"
                  placeholder="Instructions, observations..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || (!prescriptionId && formData.quantity < 1)}
              >
                {loading ? 'Délivrance...' : 'Confirmer la délivrance'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default DispenseDialog;
