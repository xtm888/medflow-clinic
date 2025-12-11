import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Package, Clock, CheckCircle, ArrowLeft, Search,
  Phone, Building, FileText, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Edit2, Save, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import opticalShopService from '../../services/opticalShopService';

const ExternalOrders = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editData, setEditData] = useState({});

  const tabs = [
    { id: 'pending', label: 'A Commander', count: 0 },
    { id: 'ordered', label: 'Commandees', count: 0 },
    { id: 'shipped', label: 'Expediees', count: 0 },
    { id: 'received', label: 'Recues', count: 0 }
  ];

  useEffect(() => {
    loadOrders();
  }, [activeTab]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await opticalShopService.getExternalOrderQueue(activeTab);
      if (response.success) {
        setOrders(response.data);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (order) => {
    setEditingOrder(order._id);
    setEditData({
      supplier: order.lensAvailability?.externalOrder?.supplier || '',
      orderNumber: order.lensAvailability?.externalOrder?.orderNumber || '',
      notes: ''
    });
  };

  const cancelEditing = () => {
    setEditingOrder(null);
    setEditData({});
  };

  const saveOrderDetails = async (orderId) => {
    try {
      const response = await opticalShopService.updateExternalOrder(orderId, {
        supplier: editData.supplier,
        orderNumber: editData.orderNumber,
        status: 'ordered',
        notes: editData.notes
      });

      if (response.success) {
        toast.success('Commande mise a jour');
        setEditingOrder(null);
        loadOrders();
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Erreur lors de la mise a jour');
    }
  };

  const updateStatus = async (orderId, status, notes = '') => {
    try {
      const response = await opticalShopService.updateExternalOrder(orderId, {
        status,
        notes
      });

      if (response.success) {
        toast.success(`Statut mis a jour: ${status}`);
        loadOrders();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise a jour');
    }
  };

  const markAsReceived = async (orderId) => {
    try {
      const response = await opticalShopService.receiveExternalOrder(orderId, {
        receivedItems: ['all'],
        notes: 'Tous les articles recus'
      });

      if (response.success) {
        toast.success('Articles marques comme recus');
        loadOrders();
      }
    } catch (error) {
      console.error('Error marking as received:', error);
      toast.error('Erreur lors de la reception');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'ordered': return 'bg-blue-100 text-blue-700';
      case 'confirmed': return 'bg-indigo-100 text-indigo-700';
      case 'shipped': return 'bg-purple-100 text-purple-700';
      case 'received': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'A commander';
      case 'ordered': return 'Commandee';
      case 'confirmed': return 'Confirmee';
      case 'shipped': return 'Expediee';
      case 'received': return 'Recue';
      case 'cancelled': return 'Annulee';
      default: return status;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/optical-shop')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Truck className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commandes Externes</h1>
            <p className="text-gray-500">Gestion des commandes fournisseurs</p>
          </div>
        </div>
        <button
          onClick={loadOrders}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border shadow-sm mb-6">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Order Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Package className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Commande: {order.orderNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      getStatusColor(order.lensAvailability?.externalOrder?.status)
                    }`}>
                      {getStatusLabel(order.lensAvailability?.externalOrder?.status)}
                    </span>
                    {expandedOrder === order._id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Quick Info */}
                <div className="mt-3 flex items-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(order.createdAt)}
                  </div>
                  {order.lensAvailability?.externalOrder?.supplier && (
                    <div className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {order.lensAvailability.externalOrder.supplier}
                    </div>
                  )}
                  {order.urgency && order.urgency !== 'normal' && (
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      order.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {order.urgency === 'urgent' ? 'URGENT' : 'Express'}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedOrder === order._id && (
                <div className="border-t p-4 bg-gray-50">
                  {/* Items to Order */}
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Articles a commander</h3>
                    <div className="space-y-2">
                      {order.lensAvailability?.externalOrder?.items?.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div>
                            <p className="font-medium text-gray-900">{item.description}</p>
                            <p className="text-sm text-gray-500">
                              Type: {item.itemType} | Qte: {item.quantity || 1}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.status === 'received' ? 'bg-green-100 text-green-700' :
                            item.status === 'ordered' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.status === 'received' ? 'Recu' :
                             item.status === 'ordered' ? 'Commande' : 'En attente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Details Form (when editing) */}
                  {editingOrder === order._id ? (
                    <div className="bg-white rounded-lg border p-4 mb-4">
                      <h3 className="font-medium text-gray-900 mb-3">Details de la commande</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Fournisseur</label>
                          <input
                            type="text"
                            value={editData.supplier}
                            onChange={(e) => setEditData(prev => ({ ...prev, supplier: e.target.value }))}
                            placeholder="Nom du fournisseur"
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">N de commande</label>
                          <input
                            type="text"
                            value={editData.orderNumber}
                            onChange={(e) => setEditData(prev => ({ ...prev, orderNumber: e.target.value }))}
                            placeholder="Numero de commande fournisseur"
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">Notes</label>
                          <textarea
                            value={editData.notes}
                            onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Notes additionnelles..."
                            rows="2"
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => saveOrderDetails(order._id)}
                          className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                        >
                          <Save className="w-4 h-4" />
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    order.lensAvailability?.externalOrder?.supplier && (
                      <div className="bg-white rounded-lg border p-4 mb-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Fournisseur:</span>
                            <span className="ml-2 font-medium">{order.lensAvailability.externalOrder.supplier}</span>
                          </div>
                          {order.lensAvailability.externalOrder.orderNumber && (
                            <div>
                              <span className="text-gray-500">N Commande:</span>
                              <span className="ml-2 font-medium">{order.lensAvailability.externalOrder.orderNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  {/* Status History */}
                  {order.lensAvailability?.externalOrder?.statusHistory?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">Historique</h3>
                      <div className="space-y-2">
                        {order.lensAvailability.externalOrder.statusHistory.slice(-5).map((entry, index) => (
                          <div key={index} className="flex items-center gap-3 text-sm">
                            <span className={`w-2 h-2 rounded-full ${
                              entry.status === 'received' ? 'bg-green-500' :
                              entry.status === 'shipped' ? 'bg-purple-500' :
                              entry.status === 'ordered' ? 'bg-blue-500' :
                              'bg-gray-400'
                            }`} />
                            <span className="text-gray-500">{formatDate(entry.at)}</span>
                            <span className="font-medium">{getStatusLabel(entry.status)}</span>
                            {entry.notes && <span className="text-gray-500">- {entry.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    {order.lensAvailability?.externalOrder?.status === 'pending' && (
                      <>
                        <button
                          onClick={() => startEditing(order)}
                          className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          <Edit2 className="w-4 h-4" />
                          Enregistrer commande
                        </button>
                      </>
                    )}

                    {order.lensAvailability?.externalOrder?.status === 'ordered' && (
                      <button
                        onClick={() => updateStatus(order._id, 'shipped')}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                      >
                        <Truck className="w-4 h-4" />
                        Marquer expediee
                      </button>
                    )}

                    {['ordered', 'shipped'].includes(order.lensAvailability?.externalOrder?.status) && (
                      <button
                        onClick={() => markAsReceived(order._id)}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marquer recue
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/glasses-orders/${order._id}`)}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <FileText className="w-4 h-4" />
                      Voir commande
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune commande
          </h2>
          <p className="text-gray-500">
            {activeTab === 'pending' && 'Aucune commande externe en attente'}
            {activeTab === 'ordered' && 'Aucune commande en cours'}
            {activeTab === 'shipped' && 'Aucune commande en livraison'}
            {activeTab === 'received' && 'Aucune commande recue recemment'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExternalOrders;
