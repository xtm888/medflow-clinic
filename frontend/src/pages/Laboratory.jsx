import { useState, useEffect } from 'react';
import { FlaskConical, Search, Plus, Check, Clock, AlertCircle, Filter, User, Calendar, Printer, Eye } from 'lucide-react';
import laboratoryService from '../services/laboratoryService';
import patientService from '../services/patientService';
import { toast } from 'react-toastify';
import { normalizeToArray, safeString } from '../utils/apiHelpers';

export default function Laboratory() {
  
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [patients, setPatients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  // UI State
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('templates'); // 'templates', 'pending', 'completed'
  const [submitting, setSubmitting] = useState(false);

  // Order form state
  const [orderForm, setOrderForm] = useState({
    patient: '',
    selectedTests: [],
    priority: 'routine',
    clinicalIndication: '',
    notes: '',
    fasting: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [templatesRes, patientsRes, pendingRes, completedRes] = await Promise.all([
        laboratoryService.getTemplates(),
        patientService.getPatients(),
        laboratoryService.getPending(),
        laboratoryService.getCompleted({ limit: 20 })
      ]);

      const templatesData = normalizeToArray(templatesRes);
      setTemplates(templatesData);
      setPatients(normalizeToArray(patientsRes));
      setPendingOrders(normalizeToArray(pendingRes));
      setCompletedOrders(normalizeToArray(completedRes));

      // Extract unique categories
      const uniqueCategories = [...new Set(templatesData.map(t => t.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (err) {
      toast.error('Erreur lors du chargement des donnees');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter templates by category and search
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Toggle test selection
  const handleToggleTest = (template) => {
    setOrderForm(prev => {
      const isSelected = prev.selectedTests.some(t => (t._id || t.id) === (template._id || template.id));
      if (isSelected) {
        return {
          ...prev,
          selectedTests: prev.selectedTests.filter(t => (t._id || t.id) !== (template._id || template.id))
        };
      } else {
        return {
          ...prev,
          selectedTests: [...prev.selectedTests, template]
        };
      }
    });
  };

  // Check if test is selected
  const isTestSelected = (template) => {
    return orderForm.selectedTests.some(t => (t._id || t.id) === (template._id || template.id));
  };

  // Create lab order
  const handleCreateOrder = async (e) => {
    e.preventDefault();

    if (!orderForm.patient) {
      toast.error('Veuillez selectionner un patient');
      return;
    }

    if (orderForm.selectedTests.length === 0) {
      toast.error('Veuillez selectionner au moins un test');
      return;
    }

    try {
      setSubmitting(true);

      const orderData = {
        patient: orderForm.patient,
        tests: orderForm.selectedTests.map(t => ({
          templateId: t._id || t.id,
          name: t.name,
          code: t.code,
          category: t.category
        })),
        priority: orderForm.priority,
        clinicalIndication: orderForm.clinicalIndication,
        notes: orderForm.notes,
        fasting: orderForm.fasting,
        status: 'pending'
      };

      await laboratoryService.createOrder(orderData);

      toast.success('Demande d\'examen creee avec succes!');
      setShowNewOrder(false);

      // Reset form
      setOrderForm({
        patient: '',
        selectedTests: [],
        priority: 'routine',
        clinicalIndication: '',
        notes: '',
        fasting: false
      });

      // Refresh data
      fetchData();

    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la creation de la demande');
      console.error('Error creating order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Update order status
  const handleUpdateStatus = async (orderId, status) => {
    try {
      await laboratoryService.updateOrderStatus(orderId, status);
      toast.success(`Statut mis a jour: ${status}`);
      fetchData();
    } catch (err) {
      toast.error('Erreur lors de la mise a jour du statut');
      console.error('Error updating status:', err);
    }
  };

  // Get patient name
  const getPatientName = (patientId) => {
    if (!patientId) return 'Patient inconnu';
    if (typeof patientId === 'object') {
      return `${patientId.firstName || ''} ${patientId.lastName || ''}`.trim() || 'Patient inconnu';
    }
    const patient = patients.find(p => (p._id || p.id) === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Patient inconnu';
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du laboratoire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-purple-600" />
            Laboratoire
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des demandes d'examens de laboratoire
          </p>
        </div>
        <button
          onClick={() => setShowNewOrder(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle demande</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Catalogues disponibles</p>
              <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
            </div>
            <FlaskConical className="h-10 w-10 text-purple-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</p>
            </div>
            <Clock className="h-10 w-10 text-yellow-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Terminees</p>
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
            </div>
            <Check className="h-10 w-10 text-green-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Categories</p>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
            </div>
            <Filter className="h-10 w-10 text-gray-200" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Catalogue ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            En attente ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'completed'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Terminees ({completedOrders.length})
          </button>
        </nav>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow">
          {/* Search and Filter */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Rechercher un examen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Toutes les categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTemplates.map(template => (
                <div
                  key={template._id || template.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      {template.nameEn && (
                        <p className="text-xs text-gray-500">{template.nameEn}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {template.code && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {template.code}
                          </span>
                        )}
                        {template.category && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {template.category}
                          </span>
                        )}
                      </div>
                      {template.components && template.components.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          {template.components.length} composant(s)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucun examen trouve</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Orders Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg shadow">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucune demande en attente</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingOrders.map(order => (
                <div key={order._id || order.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-gray-400" />
                        <h4 className="font-medium text-gray-900">
                          {getPatientName(order.patient)}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          order.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {order.priority === 'urgent' ? 'Urgent' : 'Routine'}
                        </span>
                      </div>
                      <div className="ml-8">
                        <p className="text-sm text-gray-600">
                          {order.tests?.map(t => t.name).join(', ') || 'Tests non specifies'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {formatDate(order.createdAt)}
                        </p>
                        {order.clinicalIndication && (
                          <p className="text-xs text-gray-500 mt-1">
                            Indication: {order.clinicalIndication}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleUpdateStatus(order._id || order.id, 'in-progress')}
                        className="btn btn-sm btn-secondary"
                      >
                        Demarrer
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order._id || order.id, 'completed')}
                        className="btn btn-sm btn-success"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed Orders Tab */}
      {activeTab === 'completed' && (
        <div className="bg-white rounded-lg shadow">
          {completedOrders.length === 0 ? (
            <div className="text-center py-12">
              <Check className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucun examen termine</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {completedOrders.map(order => (
                <div key={order._id || order.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-gray-400" />
                        <h4 className="font-medium text-gray-900">
                          {getPatientName(order.patient)}
                        </h4>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                          Termine
                        </span>
                      </div>
                      <div className="ml-8">
                        <p className="text-sm text-gray-600">
                          {order.tests?.map(t => t.name).join(', ') || 'Tests non specifies'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Complete: {formatDate(order.completedAt || order.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="btn btn-sm btn-secondary">
                        <Eye className="h-4 w-4 mr-1" />
                        Resultats
                      </button>
                      <button className="btn btn-sm btn-secondary">
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Nouvelle Demande d'Examen</h2>
              <button
                onClick={() => setShowNewOrder(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-6">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                <select
                  className="input"
                  value={orderForm.patient}
                  onChange={(e) => setOrderForm({ ...orderForm, patient: e.target.value })}
                  required
                >
                  <option value="">Selectionner un patient</option>
                  {patients.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorite</label>
                  <select
                    className="input"
                    value={orderForm.priority}
                    onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderForm.fasting}
                      onChange={(e) => setOrderForm({ ...orderForm, fasting: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Patient a jeun requis</span>
                  </label>
                </div>
              </div>

              {/* Clinical Indication */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indication clinique</label>
                <input
                  type="text"
                  className="input"
                  value={orderForm.clinicalIndication}
                  onChange={(e) => setOrderForm({ ...orderForm, clinicalIndication: e.target.value })}
                  placeholder="Ex: Bilan preoperatoire, Suivi diabete..."
                />
              </div>

              {/* Selected Tests */}
              {orderForm.selectedTests.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tests selectionnes ({orderForm.selectedTests.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {orderForm.selectedTests.map(test => (
                      <span
                        key={test._id || test.id}
                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {test.name}
                        <button
                          type="button"
                          onClick={() => handleToggleTest(test)}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selectionner les examens
                </label>
                <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div className="divide-y divide-gray-100">
                    {filteredTemplates.slice(0, 20).map(template => (
                      <button
                        key={template._id || template.id}
                        type="button"
                        onClick={() => handleToggleTest(template)}
                        className={`w-full text-left px-4 py-2 hover:bg-purple-50 flex items-center justify-between ${
                          isTestSelected(template) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{template.name}</p>
                          <p className="text-xs text-gray-500">{template.category}</p>
                        </div>
                        {isTestSelected(template) && (
                          <Check className="h-5 w-5 text-purple-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="input"
                  rows="2"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Notes supplementaires..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewOrder(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || orderForm.selectedTests.length === 0}
                >
                  {submitting ? 'Creation en cours...' : 'Creer la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
