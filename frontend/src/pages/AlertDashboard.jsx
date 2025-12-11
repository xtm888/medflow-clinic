import { useState, useEffect } from 'react';
import { Bell, Filter, Check, CheckCheck, X, Trash2, Calendar, Clock, AlertCircle, Package, Users } from 'lucide-react';
import alertService from '../services/alertService';
import ConfirmationModal from '../components/ConfirmationModal';

const ICON_MAP = {
  calendar: Calendar,
  clock: Clock,
  users: Users,
  'alert-triangle': AlertCircle,
  package: Package
};

const CATEGORY_COLORS = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  important: 'bg-orange-100 text-orange-800 border-orange-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  reminder: 'bg-purple-100 text-purple-800 border-purple-200'
};

const ALERT_TYPES = [
  { value: 'all', label: 'Tous les types' },
  { value: 'appointment_reminder', label: 'Rappel de rendez-vous' },
  { value: 'follow_up_reminder', label: 'Rappel de suivi' },
  { value: 'medication_reminder', label: 'Rappel médicament' },
  { value: 'prescription_expiry', label: 'Expiration ordonnance' },
  { value: 'lab_result_ready', label: 'Résultats labo' },
  { value: 'patient_waiting', label: 'Patient en attente' },
  { value: 'inventory_low', label: 'Stock faible' },
  { value: 'system_notification', label: 'Notification système' },
  { value: 'task_reminder', label: 'Rappel de tâche' },
  { value: 'birthday_reminder', label: 'Anniversaire' },
  { value: 'custom', label: 'Personnalisé' }
];

const CATEGORIES = [
  { value: 'all', label: 'Toutes catégories' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'important', label: 'Important' },
  { value: 'info', label: 'Information' },
  { value: 'reminder', label: 'Rappel' }
];

const STATUSES = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'delivered', label: 'Délivré' },
  { value: 'read', label: 'Lu' },
  { value: 'dismissed', label: 'Ignoré' }
];

function AlertDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAlerts, setSelectedAlerts] = useState([]);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Filters
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    status: 'all'
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchAlerts();
  }, [filters, pagination.page]);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (filters.type !== 'all') params.type = filters.type;
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.status !== 'all') params.status = filters.status;

      const response = await alertService.getAllAlerts(params);

      if (response.success) {
        setAlerts(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.total,
          pages: response.pages
        }));
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Impossible de charger les alertes');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSelectAll = () => {
    if (selectedAlerts.length === alerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(alerts.map(a => a._id));
    }
  };

  const handleSelectAlert = (alertId) => {
    setSelectedAlerts(prev => {
      if (prev.includes(alertId)) {
        return prev.filter(id => id !== alertId);
      } else {
        return [...prev, alertId];
      }
    });
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedAlerts.length === 0) return;

    try {
      await alertService.markMultipleAsRead(selectedAlerts);
      setSelectedAlerts([]);
      fetchAlerts();
    } catch (err) {
      console.error('Error marking alerts as read:', err);
      setError('Erreur lors de la mise à jour des alertes');
    }
  };

  const handleDeleteSelected = () => {
    if (selectedAlerts.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Supprimer les alertes sélectionnées?',
      message: `Êtes-vous sûr de vouloir supprimer ${selectedAlerts.length} alerte(s)? Cette action est irréversible.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(selectedAlerts.map(id => alertService.deleteAlert(id)));
          setSelectedAlerts([]);
          fetchAlerts();
        } catch (err) {
          console.error('Error deleting alerts:', err);
          setError('Erreur lors de la suppression des alertes');
        }
      }
    });
  };

  const handleMarkAsRead = async (alertId) => {
    try {
      await alertService.markAsRead(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Error marking alert as read:', err);
    }
  };

  const handleDismiss = async (alertId) => {
    try {
      await alertService.dismissAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  const handleDelete = (alertId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer cette alerte?',
      message: 'Êtes-vous sûr de vouloir supprimer cette alerte? Cette action est irréversible.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await alertService.deleteAlert(alertId);
          fetchAlerts();
        } catch (err) {
          console.error('Error deleting alert:', err);
        }
      }
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getAlertIcon = (alert) => {
    const IconComponent = ICON_MAP[alert.icon] || Bell;
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications & Alertes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez toutes vos notifications et alertes système
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedAlerts.length > 0 && (
            <>
              <button
                onClick={handleMarkSelectedAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Marquer comme lu ({selectedAlerts.length})
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer ({selectedAlerts.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="font-medium text-gray-900">Filtres</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ALERT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* List Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={alerts.length > 0 && selectedAlerts.length === alerts.length}
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {pagination.total} notification(s) - Page {pagination.page} sur {pagination.pages}
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500">Chargement des alertes...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && alerts.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucune notification</p>
            <p className="text-sm mt-2">Il n'y a pas d'alertes correspondant à vos critères</p>
          </div>
        )}

        {/* Alerts */}
        {!loading && !error && alerts.length > 0 && (
          <div className="divide-y divide-gray-100">
            {alerts.map(alert => (
              <div
                key={alert._id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  !alert.isRead ? 'bg-blue-50' : ''
                } ${selectedAlerts.includes(alert._id) ? 'bg-blue-100' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedAlerts.includes(alert._id)}
                    onChange={() => handleSelectAlert(alert._id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />

                  {/* Icon */}
                  <div className={`flex-shrink-0 p-2 rounded-full ${
                    alert.category === 'urgent' ? 'bg-red-100 text-red-600' :
                    alert.category === 'important' ? 'bg-orange-100 text-orange-600' :
                    alert.category === 'info' ? 'bg-blue-100 text-blue-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {getAlertIcon(alert)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {alert.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {alert.message}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full border ${
                        CATEGORY_COLORS[alert.category] || CATEGORY_COLORS.info
                      }`}>
                        {alert.category === 'urgent' ? 'Urgent' :
                         alert.category === 'important' ? 'Important' :
                         alert.category === 'info' ? 'Info' : 'Rappel'}
                      </span>
                    </div>

                    {alert.relatedPatient && (
                      <p className="text-sm text-gray-500 mb-2">
                        <strong>Patient:</strong> {alert.relatedPatient.firstName} {alert.relatedPatient.lastName}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatTime(alert.createdAt)}</span>
                        {alert.scheduledFor && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Programmé: {new Date(alert.scheduledFor).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {alert.actionRequired && alert.actionUrl && (
                          <a
                            href={alert.actionUrl}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {alert.actionLabel || 'Voir'}
                          </a>
                        )}
                        {!alert.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(alert._id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Marquer comme lu"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {alert.status !== 'dismissed' && (
                          <button
                            onClick={() => handleDismiss(alert._id)}
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Ignorer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(alert._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} sur {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}

export default AlertDashboard;
