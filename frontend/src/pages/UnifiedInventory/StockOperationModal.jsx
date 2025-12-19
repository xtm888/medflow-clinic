import { useState } from 'react';
import { X, Plus, Minus, Save, Loader2, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { unifiedInventoryService } from '../../services/inventory';

/**
 * StockOperationModal - Modal for stock add/adjust operations
 *
 * Operations:
 * - add: Receive new stock (always positive)
 * - adjust: Manual adjustment (can be positive or negative)
 */

export default function StockOperationModal({ item, operation, inventoryType, onClose, onSave }) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [batchInfo, setBatchInfo] = useState({
    lotNumber: '',
    expirationDate: '',
    supplier: '',
    invoiceNumber: ''
  });
  const [loading, setLoading] = useState(false);

  const isAdd = operation === 'add';

  // Common reasons for adjustments
  const adjustmentReasons = [
    { value: 'damaged', label: 'Endommagé' },
    { value: 'expired', label: 'Expiré' },
    { value: 'lost', label: 'Perdu' },
    { value: 'inventory_count', label: 'Inventaire' },
    { value: 'returned', label: 'Retour client' },
    { value: 'correction', label: 'Correction' },
    { value: 'transfer', label: 'Transfert' },
    { value: 'other', label: 'Autre' }
  ];

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    const qty = parseFloat(quantity);

    if (isNaN(qty) || qty === 0) {
      toast.error('Veuillez entrer une quantité valide');
      return;
    }

    if (isAdd && qty < 0) {
      toast.error('La quantité doit être positive pour une réception');
      return;
    }

    if (!isAdd && !reason) {
      toast.error('Veuillez sélectionner une raison pour l\'ajustement');
      return;
    }

    // Check for negative stock
    const newStock = item.currentStock + (isAdd ? qty : qty);
    if (newStock < 0) {
      toast.error(`Stock insuffisant. Stock actuel: ${item.currentStock}`);
      return;
    }

    try {
      setLoading(true);

      if (isAdd) {
        // Add stock operation
        await unifiedInventoryService.addStock(item._id, {
          quantity: qty,
          batch: batchInfo.lotNumber ? {
            lotNumber: batchInfo.lotNumber,
            expirationDate: batchInfo.expirationDate || undefined,
            supplier: batchInfo.supplier || undefined,
            invoiceNumber: batchInfo.invoiceNumber || undefined
          } : undefined
        });
      } else {
        // Adjust stock operation
        await unifiedInventoryService.adjustStock(item._id, {
          adjustment: qty,
          reason,
          notes: batchInfo.invoiceNumber // Use invoiceNumber field for notes
        });
      }

      onSave();
    } catch (error) {
      console.error('Error performing stock operation:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'opération');
    } finally {
      setLoading(false);
    }
  };

  // Preview new stock
  const previewStock = () => {
    const qty = parseFloat(quantity) || 0;
    return item.currentStock + (isAdd ? qty : qty);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isAdd ? 'bg-green-50' : 'bg-blue-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isAdd ? 'bg-green-100' : 'bg-blue-100'}`}>
              {isAdd ? (
                <Plus className={`h-5 w-5 ${isAdd ? 'text-green-600' : 'text-blue-600'}`} />
              ) : (
                <Package className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isAdd ? 'Réception de stock' : 'Ajustement de stock'}
              </h2>
              <p className="text-sm text-gray-600">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Stock Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Stock actuel</p>
                <p className="text-2xl font-bold text-gray-900">{item.currentStock}</p>
              </div>
              {quantity && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Nouveau stock</p>
                  <p className={`text-2xl font-bold ${
                    previewStock() < (item.reorderPoint || 5) ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {previewStock()}
                  </p>
                </div>
              )}
            </div>
            {previewStock() < 0 && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Le stock ne peut pas être négatif</span>
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité {isAdd ? 'reçue' : 'à ajuster'}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              {!isAdd && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => {
                      const val = parseFloat(prev) || 0;
                      return String(val - 1);
                    })}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => {
                      const val = parseFloat(prev) || 0;
                      return String(val + 1);
                    })}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isAdd ? 'Quantité à ajouter' : 'Entrez +/- quantité'}
                min={isAdd ? 1 : undefined}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  !isAdd ? 'pl-20' : ''
                }`}
                autoFocus
              />
            </div>
            {!isAdd && (
              <p className="mt-1 text-xs text-gray-500">
                Utilisez un nombre négatif pour réduire le stock
              </p>
            )}
          </div>

          {/* Reason (for adjustments only) */}
          {!isAdd && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison de l'ajustement
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner une raison...</option>
                {adjustmentReasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Batch Info (for stock receipt) */}
          {isAdd && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de lot
                </label>
                <input
                  type="text"
                  value={batchInfo.lotNumber}
                  onChange={(e) => setBatchInfo(prev => ({ ...prev, lotNumber: e.target.value }))}
                  placeholder="ex: LOT-2024-001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date d'expiration
                  </label>
                  <input
                    type="date"
                    value={batchInfo.expirationDate}
                    onChange={(e) => setBatchInfo(prev => ({ ...prev, expirationDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    N° Facture
                  </label>
                  <input
                    type="text"
                    value={batchInfo.invoiceNumber}
                    onChange={(e) => setBatchInfo(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    placeholder="ex: FAC-2024-123"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur
                </label>
                <input
                  type="text"
                  value={batchInfo.supplier}
                  onChange={(e) => setBatchInfo(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="Nom du fournisseur"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Notes (for adjustments) */}
          {!isAdd && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={batchInfo.invoiceNumber}
                onChange={(e) => setBatchInfo(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                placeholder="Notes supplémentaires..."
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !quantity || previewStock() < 0 || (!isAdd && !reason)}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
              isAdd ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isAdd ? 'Recevoir le stock' : 'Appliquer l\'ajustement'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
