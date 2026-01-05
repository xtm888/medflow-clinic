import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Wrench, ArrowLeft, User, Package, AlertTriangle, Phone, Mail,
  Clock, CheckCircle, Edit, RefreshCw, Calendar, DollarSign,
  FileText, Camera, Truck
} from 'lucide-react';
import { toast } from 'react-toastify';
import repairService from '../../services/repairService';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_CONFIG = {
  received: { label: 'Reçu', color: 'bg-blue-100 text-blue-800', icon: Package },
  inspecting: { label: 'Inspection', color: 'bg-purple-100 text-purple-800', icon: Wrench },
  waiting_approval: { label: 'Attente approbation', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  waiting_parts: { label: 'Attente pièces', color: 'bg-orange-100 text-orange-800', icon: Truck },
  in_repair: { label: 'En réparation', color: 'bg-orange-100 text-orange-800', icon: Wrench },
  quality_check: { label: 'Contrôle qualité', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  ready_pickup: { label: 'Prêt', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed: { label: 'Terminé', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  unrepairable: { label: 'Irréparable', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
};

const PRIORITY_CONFIG = {
  low: { label: 'Basse', color: 'text-gray-600 bg-gray-100' },
  normal: { label: 'Normale', color: 'text-blue-600 bg-blue-100' },
  high: { label: 'Haute', color: 'text-orange-600 bg-orange-100' },
  urgent: { label: 'Urgente', color: 'text-red-600 bg-red-100' }
};

// Status workflow - defines valid next statuses
const STATUS_WORKFLOW = {
  received: ['inspecting', 'cancelled'],
  inspecting: ['waiting_approval', 'in_repair', 'unrepairable', 'cancelled'],
  waiting_approval: ['approved', 'cancelled'],
  approved: ['waiting_parts', 'in_repair'],
  waiting_parts: ['in_repair'],
  in_repair: ['quality_check', 'waiting_parts'],
  quality_check: ['ready_pickup', 'in_repair'],
  ready_pickup: ['completed'],
  completed: [],
  cancelled: [],
  unrepairable: []
};

export default function RepairDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadRepair();
  }, [id]);

  const loadRepair = async () => {
    try {
      setLoading(true);
      const response = await repairService.getById(id);
      setRepair(response.data || response);
    } catch (error) {
      toast.error('Erreur lors du chargement de la réparation');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      await repairService.updateStatus(id, newStatus);
      toast.success('Statut mis à jour');
      loadRepair();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du statut');
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Réparation non trouvée</p>
          <button
            onClick={() => navigate('/repairs')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[repair.status] || STATUS_CONFIG.received;
  const priorityConfig = PRIORITY_CONFIG[repair.priority] || PRIORITY_CONFIG.normal;
  const StatusIcon = statusConfig.icon;
  const nextStatuses = STATUS_WORKFLOW[repair.status] || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/repairs')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {repair.repairNumber}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
              </span>
            </h1>
            <p className="text-gray-500 mt-1">
              Créée le {formatDate(repair.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRepair}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Actualiser"
          >
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
          {!['completed', 'cancelled', 'unrepairable'].includes(repair.status) && (
            <button
              onClick={() => navigate(`/repairs/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Quick Status Actions */}
      {nextStatuses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Actions rapides</h3>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => {
              const config = STATUS_CONFIG[status];
              return (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  disabled={updating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${config.color} hover:opacity-80 disabled:opacity-50`}
                >
                  {updating ? 'Mise à jour...' : `Passer à: ${config.label}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Client
            </h2>
            <div className="space-y-2">
              <p className="font-medium text-lg">
                {repair.customerName ||
                  (repair.customer?.firstName && `${repair.customer.firstName} ${repair.customer.lastName}`) ||
                  'Client inconnu'}
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {(repair.customerPhone || repair.customer?.phone) && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {repair.customerPhone || repair.customer?.phone}
                  </span>
                )}
                {(repair.customerEmail || repair.customer?.email) && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {repair.customerEmail || repair.customer?.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Item Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Article
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium capitalize">{repair.itemType?.replace('_', ' ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Marque</p>
                <p className="font-medium">{repair.brand || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium">{repair.itemDescription || 'N/A'}</p>
              </div>
              {repair.model && (
                <div>
                  <p className="text-sm text-gray-500">Modèle</p>
                  <p className="font-medium">{repair.model}</p>
                </div>
              )}
              {repair.serialNumber && (
                <div>
                  <p className="text-sm text-gray-500">N° Série</p>
                  <p className="font-medium">{repair.serialNumber}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Acheté ici</p>
                <p className="font-medium">{repair.purchasedHere ? 'Oui' : 'Non'}</p>
              </div>
            </div>
          </div>

          {/* Problem Description */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Problème
            </h2>
            <div className="space-y-4">
              {repair.problemCategory && (
                <div>
                  <p className="text-sm text-gray-500">Catégorie</p>
                  <p className="font-medium capitalize">{repair.problemCategory.replace('_', ' ')}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Description du problème</p>
                <p className="mt-1 text-gray-800 bg-gray-50 p-3 rounded-lg">
                  {repair.problemReported || 'Aucune description'}
                </p>
              </div>
              {repair.problemFoundOnInspection && (
                <div>
                  <p className="text-sm text-gray-500">Constaté à l'inspection</p>
                  <p className="mt-1 text-gray-800 bg-yellow-50 p-3 rounded-lg">
                    {repair.problemFoundOnInspection}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status History */}
          {repair.statusHistory && repair.statusHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                Historique des statuts
              </h2>
              <div className="space-y-3">
                {repair.statusHistory.map((history, idx) => {
                  const config = STATUS_CONFIG[history.status] || STATUS_CONFIG.received;
                  return (
                    <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className={`p-1.5 rounded-full ${config.color}`}>
                        <config.icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{config.label}</p>
                        <p className="text-sm text-gray-500">{formatDate(history.changedAt)}</p>
                        {history.notes && (
                          <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Priority & Type */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informations</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Priorité</p>
                <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${priorityConfig.color}`}>
                  {priorityConfig.label}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type de réparation</p>
                <p className="font-medium capitalize">{repair.repairType?.replace('_', ' ') || 'Interne'}</p>
              </div>
              {repair.coveredUnderWarranty && (
                <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  ✓ Couvert par garantie
                </div>
              )}
            </div>
          </div>

          {/* Costs */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Coûts
            </h3>
            <div className="space-y-3">
              {repair.estimatedCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimé</span>
                  <span>{formatCurrency(repair.estimatedCost)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Pièces</span>
                <span>{formatCurrency(repair.partsCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Main d'œuvre</span>
                <span>{formatCurrency(repair.laborCost)}</span>
              </div>
              {repair.additionalCosts > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Frais additionnels</span>
                  <span>{formatCurrency(repair.additionalCosts)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(repair.finalCost || repair.totalCost)}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Dates
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Réception</span>
                <span>{formatDate(repair.receivedDate)}</span>
              </div>
              {repair.inspectionDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Inspection</span>
                  <span>{formatDate(repair.inspectionDate)}</span>
                </div>
              )}
              {repair.repairStartDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Début réparation</span>
                  <span>{formatDate(repair.repairStartDate)}</span>
                </div>
              )}
              {repair.repairCompletedDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fin réparation</span>
                  <span>{formatDate(repair.repairCompletedDate)}</span>
                </div>
              )}
              {repair.estimatedCompletionDate && (
                <div className="flex justify-between text-blue-600">
                  <span>Estimation</span>
                  <span>{formatDate(repair.estimatedCompletionDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {repair.notes && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Notes
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{repair.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
