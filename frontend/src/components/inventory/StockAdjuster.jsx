import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Shared StockAdjuster Component
 * Consolidates duplicate stock adjustment logic from Frame, OpticalLens, ContactLens, Reagent inventories
 *
 * @param {Object} item - The inventory item (frame, lens, etc.)
 * @param {Function} service - The inventory service with adjustStock method
 * @param {Function} onClose - Close handler
 * @param {Function} onSave - Save success handler
 * @param {Object} config - Configuration for display and fields
 */
const StockAdjuster = ({
  item,
  service,
  onClose,
  onSave,
  config = {}
}) => {
  const {
    itemTitle = item?.name || item?.brand || 'Article',
    itemSubtitle = '',
    unitLabel = 'unites',
    currentStock = item?.inventory?.currentStock || item?.inventory?.available || 0,
    reservedStock = item?.inventory?.reserved || 0,
    minimumStock = item?.inventory?.minimumStock || item?.inventory?.reorderPoint || 0,
    batches = item?.batches || [],
    adjustmentTypes = [
      { value: 'adjusted', label: 'Ajustement (inventaire)', color: 'text-blue-600' },
      { value: 'damaged', label: 'Endommage', color: 'text-red-600' },
      { value: 'returned', label: 'Retour fournisseur', color: 'text-orange-600' },
      { value: 'transferred', label: 'Transfert', color: 'text-purple-600' },
      { value: 'expired', label: 'Expire', color: 'text-gray-600' }
    ]
  } = config;

  const [formData, setFormData] = useState({
    type: 'adjusted',
    quantity: '',
    reason: '',
    lotNumber: ''
  });

  const [loading, setLoading] = useState(false);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantity || !formData.reason) {
      toast.error('Veuillez entrer la quantite et la raison');
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (quantity === 0) {
      toast.error('La quantite ne peut pas etre zero');
      return;
    }

    // For subtractions, check if we have enough stock
    if (['damaged', 'transferred', 'returned', 'expired'].includes(formData.type)) {
      const available = currentStock - reservedStock;
      if (Math.abs(quantity) > available) {
        toast.error(`Stock disponible insuffisant (${available} ${unitLabel})`);
        return;
      }
    }

    try {
      setLoading(true);

      const data = {
        type: formData.type,
        quantity: formData.type === 'adjusted' ? quantity : Math.abs(quantity),
        reason: formData.reason,
        lotNumber: formData.lotNumber || undefined
      };

      await service.adjustStock(item._id || item.id, data);
      toast.success('Stock ajuste avec succes');
      onSave();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajustement');
    } finally {
      setLoading(false);
    }
  };

  // Calculate new stock
  const calculateNewStock = () => {
    const quantity = parseInt(formData.quantity) || 0;

    if (formData.type === 'adjusted') {
      // Adjusted can be positive or negative
      return currentStock + quantity;
    } else {
      // Damaged, returned, transferred, expired always reduce
      return currentStock - Math.abs(quantity);
    }
  };

  const newStock = calculateNewStock();
  const activeBatches = batches.filter(b => b.status === 'active' && b.quantity > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ajuster le Stock</h2>
              <p className="text-sm text-gray-500">
                {itemTitle}{itemSubtitle ? ` - ${itemSubtitle}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Adjustment Type */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Type d'ajustement *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {adjustmentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.type === 'adjusted'
                ? 'Entrez une valeur positive pour ajouter, negative pour soustraire'
                : 'La quantite sera soustraite du stock'}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Quantite *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={formData.type === 'adjusted' ? 'Ex: -2 ou +5' : 'Ex: 2'}
            />
          </div>

          {/* Lot Number (optional, for damaged/expired items) */}
          {['damaged', 'expired'].includes(formData.type) && activeBatches.length > 0 && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Numero de lot (optionnel)</label>
              <select
                name="lotNumber"
                value={formData.lotNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selectionner un lot</option>
                {activeBatches.map(batch => (
                  <option key={batch.lotNumber} value={batch.lotNumber}>
                    {batch.lotNumber} ({batch.quantity} {unitLabel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Raison *</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Expliquez la raison de cet ajustement..."
            />
          </div>

          {/* Stock Preview */}
          <div className={`rounded-lg p-3 ${newStock < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Stock actuel:</p>
                <p className="text-lg font-bold">{currentStock}</p>
              </div>
              <div className="text-2xl text-gray-400">→</div>
              <div>
                <p className="text-sm text-gray-600">Nouveau stock:</p>
                <p className={`text-lg font-bold ${
                  newStock < 0
                    ? 'text-red-600'
                    : newStock <= minimumStock
                      ? 'text-yellow-600'
                      : 'text-green-600'
                }`}>
                  {newStock}
                </p>
              </div>
            </div>
            {reservedStock > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Note: {reservedStock} {unitLabel} sont reservees
              </p>
            )}
          </div>

          {/* Warning for negative stock */}
          {newStock < 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">
                Attention: Le stock resultant serait negatif. Cette operation n'est pas permise.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || newStock < 0}
              className="flex items-center gap-2 px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Sauvegarde...' : 'Ajuster Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjuster;
