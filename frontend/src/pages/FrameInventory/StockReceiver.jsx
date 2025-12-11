import React, { useState } from 'react';
import { X, Save, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import frameInventoryService from '../../services/frameInventoryService';

const StockReceiver = ({ frame, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    lotNumber: '',
    quantity: '',
    purchaseOrderNumber: '',
    supplier: {
      name: '',
      contact: '',
      reference: ''
    },
    cost: {
      unitCost: frame.pricing?.costPrice || '',
      currency: 'CDF'
    },
    warrantyExpiry: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  // Generate lot number
  const generateLotNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    setFormData(prev => ({
      ...prev,
      lotNumber: `LOT-${year}${month}${day}-${random}`
    }));
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.lotNumber || !formData.quantity) {
      toast.error('Veuillez entrer le numero de lot et la quantite');
      return;
    }

    if (parseInt(formData.quantity) <= 0) {
      toast.error('La quantite doit etre positive');
      return;
    }

    try {
      setLoading(true);

      const data = {
        lotNumber: formData.lotNumber,
        quantity: parseInt(formData.quantity),
        purchaseOrderNumber: formData.purchaseOrderNumber || undefined,
        supplier: formData.supplier.name ? {
          name: formData.supplier.name,
          contact: formData.supplier.contact,
          reference: formData.supplier.reference
        } : undefined,
        cost: {
          unitCost: parseFloat(formData.cost.unitCost) || 0,
          totalCost: (parseFloat(formData.cost.unitCost) || 0) * parseInt(formData.quantity),
          currency: formData.cost.currency
        },
        warrantyExpiry: formData.warrantyExpiry || undefined,
        notes: formData.notes || undefined
      };

      await frameInventoryService.addStock(frame._id, data);
      onSave();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout du stock');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total cost
  const totalCost = (parseFloat(formData.cost.unitCost) || 0) * (parseInt(formData.quantity) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Recevoir du Stock</h2>
              <p className="text-sm text-gray-500">{frame.brand} {frame.model} - {frame.color}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Lot and Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Numero de lot *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="lotNumber"
                  value={formData.lotNumber}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="LOT-XXXXXX"
                />
                <button
                  type="button"
                  onClick={generateLotNumber}
                  className="px-3 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Gen.
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Quantite *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="1"
              />
            </div>
          </div>

          {/* Purchase Order */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">N° Bon de commande</label>
            <input
              type="text"
              name="purchaseOrderNumber"
              value={formData.purchaseOrderNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="BC-XXXXX"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Fournisseur</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                name="supplier.name"
                value={formData.supplier.name}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Nom"
              />
              <input
                type="text"
                name="supplier.contact"
                value={formData.supplier.contact}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Contact"
              />
              <input
                type="text"
                name="supplier.reference"
                value={formData.supplier.reference}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Reference"
              />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cout unitaire</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                name="cost.unitCost"
                value={formData.cost.unitCost}
                onChange={handleChange}
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
              <select
                name="cost.currency"
                value={formData.cost.currency}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="CDF">CDF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            {totalCost > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Cout total: {new Intl.NumberFormat('fr-CD').format(totalCost)} {formData.cost.currency}
              </p>
            )}
          </div>

          {/* Warranty */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date d'expiration garantie</label>
            <input
              type="date"
              name="warrantyExpiry"
              value={formData.warrantyExpiry}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Notes additionnelles..."
            />
          </div>

          {/* Current Stock Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Stock actuel: <strong>{frame.inventory?.currentStock || 0}</strong> unites
            </p>
            <p className="text-sm text-gray-600">
              Apres reception: <strong>{(frame.inventory?.currentStock || 0) + (parseInt(formData.quantity) || 0)}</strong> unites
            </p>
          </div>

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
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Sauvegarde...' : 'Recevoir Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockReceiver;
