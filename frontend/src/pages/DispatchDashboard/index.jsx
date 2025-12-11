import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Send,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  User,
  Building2,
  FileText,
  Eye
} from 'lucide-react';
import fulfillmentDispatchService from '../../services/fulfillmentDispatchService';
import externalFacilityService from '../../services/externalFacilityService';

const sourceTypeIcons = {
  'invoice_item': '🧾',
  'prescription': '💊',
  'lab_order': '🔬',
  'imaging_order': '📸',
  'surgery_referral': '🏥',
  'glasses_order': '👓',
  'therapy_referral': '🏃',
  'specialist_referral': '🩺'
};

export default function DispatchDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchDashboard = async () => {
    try {
      const response = await fulfillmentDispatchService.getDashboard();
      if (response.success) {
        setDashboard(response.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchDispatches = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: 20,
        status: selectedStatus || undefined,
        sourceType: selectedType || undefined
      };
      const response = await fulfillmentDispatchService.getAll(params);
      if (response.success) {
        setDispatches(response.data.dispatches);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching dispatches:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, selectedStatus, selectedType]);

  useEffect(() => {
    fetchDashboard();
    fetchDispatches();
  }, [fetchDispatches]);

  const handleStatusUpdate = async (dispatchId, newStatus) => {
    try {
      await fulfillmentDispatchService.updateStatus(dispatchId, newStatus);
      fetchDashboard();
      fetchDispatches();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleMarkDispatched = async (dispatch) => {
    const method = prompt('Méthode d\'envoi (email, print, phone, manual):', 'manual');
    if (!method) return;

    try {
      await fulfillmentDispatchService.markDispatched(dispatch._id, { method });
      fetchDashboard();
      fetchDispatches();
    } catch (error) {
      console.error('Error marking dispatched:', error);
    }
  };

  const handleConfirmCompletion = async (dispatch) => {
    const notes = prompt('Notes de complétion:');

    try {
      await fulfillmentDispatchService.confirmCompletion(dispatch._id, { notes });
      fetchDashboard();
      fetchDispatches();
    } catch (error) {
      console.error('Error confirming completion:', error);
    }
  };

  const getStatusBadge = (status) => {
    const info = fulfillmentDispatchService.getStatusInfo(status);
    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses[info.color] || colorClasses.gray}`}>
        {info.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const info = fulfillmentDispatchService.getPriorityInfo(priority);
    const colorClasses = {
      gray: 'border-gray-300 text-gray-600',
      yellow: 'border-yellow-400 text-yellow-700 bg-yellow-50',
      red: 'border-red-400 text-red-700 bg-red-50',
      orange: 'border-orange-400 text-orange-700 bg-orange-50'
    };
    return (
      <span className={`px-2 py-0.5 text-xs border rounded ${colorClasses[info.color] || colorClasses.gray}`}>
        {info.label}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord des Dispatches</h1>
          <p className="text-gray-600">Suivez les services envoyés vers les prestataires externes</p>
        </div>
        <button
          onClick={() => { fetchDashboard(); fetchDispatches(); }}
          className="flex items-center px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Actualiser
        </button>
      </div>

      {/* Summary Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div
            className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md ${selectedStatus === 'pending' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'pending' ? '' : 'pending')}
          >
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-gray-400" />
              <span className="text-3xl font-bold text-gray-900">{dashboard.summary.pending}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">En attente</p>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md ${selectedStatus === 'dispatched' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'dispatched' ? '' : 'dispatched')}
          >
            <div className="flex items-center justify-between">
              <Send className="h-8 w-8 text-blue-400" />
              <span className="text-3xl font-bold text-blue-600">{dashboard.summary.dispatched}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Envoyés</p>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md ${selectedStatus === 'in_progress' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'in_progress' ? '' : 'in_progress')}
          >
            <div className="flex items-center justify-between">
              <RefreshCw className="h-8 w-8 text-yellow-400" />
              <span className="text-3xl font-bold text-yellow-600">{dashboard.summary.inProgress}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">En cours</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <span className="text-3xl font-bold text-red-600">{dashboard.summary.overdue}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">En retard</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-8 w-8 text-green-400" />
              <span className="text-3xl font-bold text-green-600">{dashboard.summary.completedToday}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Terminés aujourd'hui</p>
          </div>
        </div>
      )}

      {/* By Type Stats */}
      {dashboard?.byType && Object.keys(dashboard.byType).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Par type de service</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(dashboard.byType).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setSelectedType(selectedType === type ? '' : type)}
                className={`flex items-center px-3 py-2 rounded-lg border transition-colors ${
                  selectedType === type
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg mr-2">{sourceTypeIcons[type] || '📋'}</span>
                <span className="text-sm">{fulfillmentDispatchService.getSourceTypeLabel(type)}</span>
                <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs font-medium">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            {fulfillmentDispatchService.statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les types</option>
          {fulfillmentDispatchService.sourceTypes.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {(selectedStatus || selectedType) && (
          <button
            onClick={() => { setSelectedStatus(''); setSelectedType(''); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Dispatches List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : dispatches.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="h-16 w-16 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun dispatch trouvé</h3>
          <p className="mt-2 text-gray-500">
            {selectedStatus || selectedType
              ? 'Aucun résultat pour les filtres sélectionnés'
              : 'Les dispatches apparaîtront ici quand vous en créerez'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prestataire</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dispatches.map((dispatch) => (
                <tr key={dispatch._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xl" title={fulfillmentDispatchService.getSourceTypeLabel(dispatch.sourceType)}>
                      {sourceTypeIcons[dispatch.sourceType] || '📋'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {dispatch.patient?.firstName} {dispatch.patient?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{dispatch.patient?.fileNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{dispatch.serviceDetails?.name}</p>
                    {dispatch.serviceDetails?.code && (
                      <p className="text-xs text-gray-500">{dispatch.serviceDetails.code}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {dispatch.externalFacility ? (
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <p className="text-gray-900">{dispatch.externalFacility.name}</p>
                          <p className="text-xs text-gray-500">
                            {externalFacilityService.getTypeLabel(dispatch.externalFacility.type)}
                          </p>
                        </div>
                      </div>
                    ) : dispatch.manualFacility?.name ? (
                      <p className="text-gray-900">{dispatch.manualFacility.name}</p>
                    ) : (
                      <span className="text-gray-400">Non assigné</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(dispatch.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getPriorityBadge(dispatch.priority)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(dispatch.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => { setSelectedDispatch(dispatch); setShowDetailModal(true); }}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Voir détails"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      {dispatch.status === 'pending' && (
                        <button
                          onClick={() => handleMarkDispatched(dispatch)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Envoyer
                        </button>
                      )}
                      {['dispatched', 'acknowledged', 'in_progress'].includes(dispatch.status) && (
                        <button
                          onClick={() => handleConfirmCompletion(dispatch)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Terminé
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setPagination(p => ({ ...p, current: Math.max(1, p.current - 1) }))}
              disabled={pagination.current === 1}
              className="px-3 py-2 rounded border disabled:opacity-50"
            >
              Précédent
            </button>
            <span className="text-gray-600">
              Page {pagination.current} sur {pagination.pages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, current: Math.min(p.pages, p.current + 1) }))}
              disabled={pagination.current === pagination.pages}
              className="px-3 py-2 rounded border disabled:opacity-50"
            >
              Suivant
            </button>
          </nav>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDispatch && (
        <DispatchDetailModal
          dispatch={selectedDispatch}
          onClose={() => setShowDetailModal(false)}
          onStatusUpdate={(status) => {
            handleStatusUpdate(selectedDispatch._id, status);
            setShowDetailModal(false);
          }}
        />
      )}
    </div>
  );
}

function DispatchDetailModal({ dispatch, onClose, onStatusUpdate }) {
  const getStatusBadge = (status) => {
    const info = fulfillmentDispatchService.getStatusInfo(status);
    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colorClasses[info.color] || colorClasses.gray}`}>
        {info.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{sourceTypeIcons[dispatch.sourceType] || '📋'}</span>
                <h2 className="text-xl font-bold">
                  {fulfillmentDispatchService.getSourceTypeLabel(dispatch.sourceType)}
                </h2>
              </div>
              <p className="text-gray-500 mt-1">{dispatch.serviceDetails?.name}</p>
            </div>
            {getStatusBadge(dispatch.status)}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Patient Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Patient</h3>
              <p className="font-medium">{dispatch.patient?.firstName} {dispatch.patient?.lastName}</p>
              <p className="text-sm text-gray-600">{dispatch.patient?.fileNumber}</p>
              {dispatch.patient?.phone && (
                <p className="text-sm text-gray-600">{dispatch.patient.phone}</p>
              )}
            </div>

            {/* Facility Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Prestataire externe</h3>
              {dispatch.externalFacility ? (
                <>
                  <p className="font-medium">{dispatch.externalFacility.name}</p>
                  <p className="text-sm text-gray-600">
                    {externalFacilityService.getTypeLabel(dispatch.externalFacility.type)}
                  </p>
                  {dispatch.externalFacility.contact?.phone && (
                    <p className="text-sm text-gray-600">{dispatch.externalFacility.contact.phone}</p>
                  )}
                </>
              ) : dispatch.manualFacility?.name ? (
                <>
                  <p className="font-medium">{dispatch.manualFacility.name}</p>
                  {dispatch.manualFacility.phone && (
                    <p className="text-sm text-gray-600">{dispatch.manualFacility.phone}</p>
                  )}
                </>
              ) : (
                <p className="text-gray-400">Non assigné</p>
              )}
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Détails du service</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Code:</span>
                <span className="ml-2 font-medium">{dispatch.serviceDetails?.code || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Quantité:</span>
                <span className="ml-2 font-medium">{dispatch.serviceDetails?.quantity || 1}</span>
              </div>
              {dispatch.serviceDetails?.instructions && (
                <div className="col-span-2">
                  <span className="text-gray-500">Instructions:</span>
                  <p className="mt-1">{dispatch.serviceDetails.instructions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status History */}
          {dispatch.statusHistory && dispatch.statusHistory.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Historique des statuts</h3>
              <div className="space-y-2">
                {dispatch.statusHistory.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="flex items-center text-sm">
                    <span className="w-24 text-gray-500">
                      {new Date(entry.timestamp).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    <span className="font-medium">{fulfillmentDispatchService.getStatusInfo(entry.status).label}</span>
                    {entry.notes && <span className="ml-2 text-gray-500">- {entry.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <div className="flex space-x-2">
              {dispatch.status === 'pending' && (
                <button
                  onClick={() => onStatusUpdate('dispatched')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Marquer comme envoyé
                </button>
              )}
              {dispatch.status === 'dispatched' && (
                <button
                  onClick={() => onStatusUpdate('acknowledged')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Marquer comme confirmé
                </button>
              )}
              {['dispatched', 'acknowledged', 'in_progress'].includes(dispatch.status) && (
                <button
                  onClick={() => onStatusUpdate('completed')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Marquer comme terminé
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
