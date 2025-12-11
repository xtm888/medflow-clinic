import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import opticalLensInventoryService from '../../services/opticalLensInventoryService';

const StockAdjuster = ({ lens, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    type: 'adjusted',
    quantity: '',
    reason: ''
  });

  const [loading, setLoading] = useState(false);

  // Adjustment types
  const adjustmentTypes = [
    { value: 'adjusted', label: 'Ajustement (inventaire)', color: 'text-blue-600' },
    { value: 'damaged', label: 'Endommage', color: 'text-red-600' },
    { value: 'returned', label: 'Retour fournisseur', color: 'text-orange-600' },
    { value: 'transferred', label: 'Transfert', color: 'text-purple-600' },
    { value: 'correction', label: 'Correction', color: 'text-gray-600' }
  ];

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

    // For subtractions (damaged, transferred, returned), check if we have enough stock
    if (['damaged', 'transferred', 'returned'].includes(formData.type)) {
      const available = lens.inventory?.currentStock - (lens.inventory?.reserved || 0);
      if (Math.abs(quantity) > available) {
        toast.error(`Stock disponible insuffisant (${available} paires)`);
        return;
      }
    }

    try {
      setLoading(true);

      const data = {
        type: formData.type,
        quantity: formData.type === 'adjusted' || formData.type === 'correction'
          ? quantity
          : -Math.abs(quantity), // Negative for damage/transfer/return
        reason: formData.reason
      };

      await opticalLensInventoryService.adjustStock(lens._id, data);
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
    const current = lens.inventory?.currentStock || 0;
    const quantity = parseInt(formData.quantity) || 0;

    if (formData.type === 'adjusted' || formData.type === 'correction') {
      return current + quantity;
    } else {
      return current - Math.abs(quantity);
    }
  };

  const newStock = calculateNewStock();

  // Get material label
  const getMaterialLabel = (material) => {
    const materials = {
      'cr39': 'CR-39 (1.50)',
      'cr39-1.56': 'CR-39 (1.56)',
      'polycarbonate': 'Polycarbonate',
      'trivex': 'Trivex',
      'hi-index-1.60': 'Hi-Index 1.60',
      'hi-index-1.67': 'Hi-Index 1.67',
      'hi-index-1.74': 'Hi-Index 1.74'
    };
    return materials[material] || material;
  };

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
                {lens.brand} {lens.productLine} - {getMaterialLabel(lens.material)}
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
              {formData.type === 'adjusted' || formData.type === 'correction'
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
              placeholder={formData.type === 'adjusted' || formData.type === 'correction' ? 'Ex: -2 ou +5' : 'Ex: 2'}
            />
          </div>

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
                <p className="text-lg font-bold">{lens.inventory?.currentStock || 0}</p>
              </div>
              <div className="text-2xl text-gray-400">→</div>
              <div>
                <p className="text-sm text-gray-600">Nouveau stock:</p>
                <p className={`text-lg font-bold ${newStock < 0 ? 'text-red-600' : newStock <= lens.inventory?.minimumStock ? 'text-yellow-600' : 'text-green-600'}`}>
                  {newStock}
                </p>
              </div>
            </div>
            {lens.inventory?.reserved > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Note: {lens.inventory.reserved} paires sont reservees
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
