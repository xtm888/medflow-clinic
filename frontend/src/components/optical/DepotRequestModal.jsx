import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Minus, Truck, AlertCircle, Search } from 'lucide-react';
import api from '../../services/apiConfig';

const DepotRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const [depotFrames, setDepotFrames] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDepotFrames();
      setSelectedItems([]);
      setError(null);
    }
  }, [isOpen]);

  const fetchDepotFrames = async (searchTerm = '') => {
    setLoading(true);
    try {
      const response = await api.get('/optical-shop/depot-inventory', {
        params: { search: searchTerm, limit: 100 }
      });
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setDepotFrames(data);
    } catch (err) {
      setError('Failed to load depot inventory');
      console.error('Depot fetch error:', err);
      setDepotFrames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    // Debounce search
    clearTimeout(window.depotSearchTimeout);
    window.depotSearchTimeout = setTimeout(() => {
      fetchDepotFrames(value);
    }, 300);
  };

  const addItem = (frame) => {
    const existing = selectedItems.find(i => i.sku === frame.sku);
    if (existing) {
      setSelectedItems(prev => prev.map(i =>
        i.sku === frame.sku ? { ...i, quantity: Math.min(i.quantity + 1, i.available) } : i
      ));
    } else {
      setSelectedItems(prev => [...prev, {
        sku: frame.sku,
        name: `${frame.brand} ${frame.model}`,
        color: frame.color,
        quantity: 1,
        available: frame.inventory?.currentStock || 0,
        price: frame.pricing?.sellingPrice || 0
      }]);
    }
  };

  const updateQuantity = (sku, delta) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.sku === sku) {
        const newQty = Math.max(1, Math.min(i.available, i.quantity + delta));
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const removeItem = (sku) => {
    setSelectedItems(prev => prev.filter(i => i.sku !== sku));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.post('/optical-shop/request-from-depot', {
        items: selectedItems.map(i => ({ sku: i.sku, quantity: i.quantity })),
        priority,
        reason: 'replenishment',
        notes
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = selectedItems.reduce((sum, i) => sum + i.quantity, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Request Frames from Depot</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Depot inventory */}
          <div className="w-1/2 p-4 border-r overflow-y-auto">
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={handleSearch}
                  placeholder="Search frames..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <h3 className="font-medium mb-2 text-sm text-gray-600">
              Depot Inventory ({depotFrames.length} items)
            </h3>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : depotFrames.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No frames available in depot
              </div>
            ) : (
              <div className="space-y-2">
                {depotFrames.map(frame => (
                  <div
                    key={frame._id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => addItem(frame)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {frame.brand} {frame.model}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{frame.color}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-green-600">
                          Stock: {frame.inventory?.currentStock || 0}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); addItem(frame); }}
                      className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 ml-2"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected items */}
          <div className="w-1/2 p-4 overflow-y-auto flex flex-col">
            <h3 className="font-medium mb-2 text-sm text-gray-600">
              Your Request ({totalItems} items)
            </h3>

            {selectedItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto mb-2" />
                  <p>Click frames to add to request</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mb-4 flex-1">
                {selectedItems.map(item => (
                  <div key={item.sku} className="flex items-center justify-between p-2 border rounded bg-blue-50">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.color}</div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => updateQuantity(item.sku, -1)}
                        className="p-1 bg-white border rounded hover:bg-gray-100"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.sku, 1)}
                        className="p-1 bg-white border rounded hover:bg-gray-100"
                        disabled={item.quantity >= item.available}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeItem(item.sku)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded ml-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Priority and notes */}
            <div className="space-y-3 pt-3 border-t">
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                >
                  <option value="low">Low - Can wait</option>
                  <option value="normal">Normal - Standard processing</option>
                  <option value="high">High - Needed soon</option>
                  <option value="urgent">Urgent - Customer waiting</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                  rows={2}
                  placeholder="Any special instructions..."
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 p-2 bg-red-50 text-red-600 rounded flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedItems.length > 0 && (
              <span>{selectedItems.length} frame types, {totalItems} total units</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedItems.length === 0 || submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Submitting...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepotRequestModal;
