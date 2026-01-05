import { useState, useEffect } from 'react';
import { X, ShoppingCart, AlertTriangle, Check, TrendingDown, Package } from 'lucide-react';
import pharmacyInventoryService from '../../services/pharmacyInventoryService';

const ReorderPanel = ({ isOpen, onClose, onOrderCreated }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orderDialog, setOrderDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [orderData, setOrderData] = useState({
    quantity: '',
    supplier: '',
    expectedDeliveryDate: '',
    orderReference: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const response = await pharmacyInventoryService.getReorderSuggestions();
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setSuggestions(data);
    } catch (err) {
      setError('Erreur lors du chargement des suggestions');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item) => {
    const isSelected = selectedItems.some(s => s.medicationId === item.medicationId);
    if (isSelected) {
      setSelectedItems(selectedItems.filter(s => s.medicationId !== item.medicationId));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === suggestions.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...suggestions]);
    }
  };

  const openOrderDialog = (item) => {
    setCurrentItem(item);
    setOrderData({
      quantity: item.suggestedQuantity?.toString() || '',
      supplier: item.primarySupplier?.name || '',
      expectedDeliveryDate: '',
      orderReference: '',
      notes: ''
    });
    setOrderDialog(true);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await pharmacyInventoryService.createReorder({
        medicationId: currentItem.medicationId,
        quantity: parseInt(orderData.quantity),
        supplier: orderData.supplier || undefined,
        expectedDeliveryDate: orderData.expectedDeliveryDate || undefined,
        orderReference: orderData.orderReference || undefined,
        notes: orderData.notes || undefined
      });

      setSuccess(`Commande créée pour ${currentItem.name}`);
      setOrderDialog(false);
      fetchSuggestions();
      onOrderCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création de la commande');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkOrder = async () => {
    if (selectedItems.length === 0) return;

    setLoading(true);
    setError('');
    let successCount = 0;

    for (const item of selectedItems) {
      try {
        await pharmacyInventoryService.createReorder({
          medicationId: item.medicationId,
          quantity: item.suggestedQuantity,
          supplier: item.primarySupplier?.name
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to order ${item.name}:`, err);
      }
    }

    setSuccess(`${successCount} commandes créées sur ${selectedItems.length}`);
    setSelectedItems([]);
    fetchSuggestions();
    onOrderCreated?.();
    setLoading(false);
  };

  if (!isOpen) return null;

  const totalEstimatedCost = selectedItems.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2 text-primary-600" />
              Suggestions de réapprovisionnement
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {suggestions.length} article(s) à réapprovisionner
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

          {/* Bulk Actions */}
          {suggestions.length > 0 && (
            <div className="mb-4 flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === suggestions.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Sélectionner tout ({suggestions.length})
                  </span>
                </label>
                {selectedItems.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {selectedItems.length} sélectionné(s) - Total: {totalEstimatedCost.toLocaleString()} CFA
                  </span>
                )}
              </div>
              {selectedItems.length > 0 && (
                <button
                  onClick={handleBulkOrder}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  Commander la sélection
                </button>
              )}
            </div>
          )}

          {/* Suggestions List */}
          {loading && suggestions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune suggestion de réapprovisionnement</p>
              <p className="text-sm text-gray-400">Tous les stocks sont à niveau</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((item) => (
                <div
                  key={item.medicationId}
                  className={`border rounded-lg p-4 transition-colors ${
                    item.available === 0 ? 'bg-red-50 border-red-200' :
                    item.onOrder ? 'bg-blue-50 border-blue-200' :
                    'bg-white border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.some(s => s.medicationId === item.medicationId)}
                      onChange={() => handleSelectItem(item)}
                      className="h-4 w-4 text-primary-600 rounded mt-1"
                      disabled={item.onOrder}
                    />

                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        {item.available === 0 && (
                          <span className="badge badge-danger">Rupture</span>
                        )}
                        {item.onOrder && (
                          <span className="badge bg-blue-100 text-blue-800">En commande</span>
                        )}
                      </div>

                      {item.genericName && item.genericName !== item.name && (
                        <p className="text-sm text-gray-500">{item.genericName}</p>
                      )}

                      <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Stock actuel:</span>
                          <span className={`ml-1 font-medium ${
                            item.available === 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {item.currentStock}
                          </span>
                          {item.reserved > 0 && (
                            <span className="text-orange-600 ml-1">
                              ({item.reserved} rés.)
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-gray-500">Seuil:</span>
                          <span className="ml-1 font-medium">{item.reorderPoint}</span>
                        </div>

                        <div>
                          <span className="text-gray-500">Suggéré:</span>
                          <span className="ml-1 font-medium text-primary-600">
                            {item.suggestedQuantity}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500">Coût estimé:</span>
                          <span className="ml-1 font-medium">
                            {item.estimatedCost?.toLocaleString() || 0} CFA
                          </span>
                        </div>

                        {item.primarySupplier?.name && (
                          <div>
                            <span className="text-gray-500">Fournisseur:</span>
                            <span className="ml-1">{item.primarySupplier.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!item.onOrder && (
                      <button
                        onClick={() => openOrderDialog(item)}
                        className="btn btn-sm btn-primary"
                      >
                        Commander
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Fermer
          </button>
        </div>
      </div>

      {/* Order Dialog */}
      {orderDialog && currentItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Créer une commande</h3>
              <button
                onClick={() => setOrderDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{currentItem.name}</p>
                  <p className="text-sm text-gray-500">Stock actuel: {currentItem.currentStock}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité à commander *
                  </label>
                  <input
                    type="number"
                    value={orderData.quantity}
                    onChange={(e) => setOrderData({ ...orderData, quantity: e.target.value })}
                    className="input"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fournisseur
                  </label>
                  <input
                    type="text"
                    value={orderData.supplier}
                    onChange={(e) => setOrderData({ ...orderData, supplier: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de livraison prévue
                  </label>
                  <input
                    type="date"
                    value={orderData.expectedDeliveryDate}
                    onChange={(e) => setOrderData({ ...orderData, expectedDeliveryDate: e.target.value })}
                    className="input"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Référence commande
                  </label>
                  <input
                    type="text"
                    value={orderData.orderReference}
                    onChange={(e) => setOrderData({ ...orderData, orderReference: e.target.value })}
                    className="input"
                    placeholder="PO-2024-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={orderData.notes}
                    onChange={(e) => setOrderData({ ...orderData, notes: e.target.value })}
                    className="input"
                    rows="2"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setOrderDialog(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !orderData.quantity}
                >
                  {loading ? 'Création...' : 'Créer la commande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReorderPanel;
