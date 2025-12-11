import React, { useState } from 'react';
import { X, Save, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import opticalLensInventoryService from '../../services/opticalLensInventoryService';

const StockReceiver = ({ lens, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    lotNumber: '',
    quantity: '',
    supplier: {
      name: '',
      invoiceNumber: ''
    },
    unitCost: lens.pricing?.costPrice || '',
    expirationDate: ''
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
        supplier: formData.supplier.name ? {
          name: formData.supplier.name,
          invoiceNumber: formData.supplier.invoiceNumber
        } : undefined,
        unitCost: parseFloat(formData.unitCost) || lens.pricing?.costPrice || 0,
        expirationDate: formData.expirationDate || undefined
      };

      await opticalLensInventoryService.addStock(lens._id, data);
      onSave();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout du stock');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total cost
  const totalCost = (parseFloat(formData.unitCost) || 0) * (parseInt(formData.quantity) || 0);

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
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Recevoir du Stock</h2>
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

          {/* Supplier */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Fournisseur</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                name="supplier.name"
                value={formData.supplier.name}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Nom du fournisseur"
              />
              <input
                type="text"
                name="supplier.invoiceNumber"
                value={formData.supplier.invoiceNumber}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="N° facture"
              />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cout unitaire</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                name="unitCost"
                value={formData.unitCost}
                onChange={handleChange}
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-center text-gray-600">
                {lens.pricing?.currency || 'CDF'}
              </div>
            </div>
            {totalCost > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Cout total: {new Intl.NumberFormat('fr-CD').format(totalCost)} {lens.pricing?.currency || 'CDF'}
              </p>
            )}
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date d'expiration (optionnel)</label>
            <input
              type="date"
              name="expirationDate"
              value={formData.expirationDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Pour les verres avec traitements speciaux ayant une date de peremption
            </p>
          </div>

          {/* Current Stock Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Stock actuel: <strong>{lens.inventory?.currentStock || 0}</strong> paires
            </p>
            <p className="text-sm text-gray-600">
              Apres reception: <strong>{(lens.inventory?.currentStock || 0) + (parseInt(formData.quantity) || 0)}</strong> paires
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
