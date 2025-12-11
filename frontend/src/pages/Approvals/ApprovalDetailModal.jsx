import { useState } from 'react';
import {
  X,
  ShieldCheck,
  User,
  Building2,
  Calendar,
  FileText,
  Check,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  DollarSign,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import approvalService from '../../services/approvalService';

const formatCurrency = (amount, currency = 'CDF') => {
  if (amount == null) return '-';
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'dd MMMM yyyy', { locale: fr });
};

const formatDateTime = (date) => {
  if (!date) return '-';
  return format(new Date(date), "dd MMM yyyy 'à' HH:mm", { locale: fr });
};

export default function ApprovalDetailModal({ approval, onClose, onUpdated, canApprove }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Approve form state
  const [approveData, setApproveData] = useState({
    quantityApproved: approval.quantityRequested || 1,
    approvedAmount: approval.estimatedCost || 0,
    validFrom: format(new Date(), 'yyyy-MM-dd'),
    validUntil: '',
    externalReference: '',
    notes: ''
  });

  // Reject form state
  const [rejectData, setRejectData] = useState({
    reason: '',
    notes: ''
  });

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await approvalService.approveRequest(approval._id, {
        quantityApproved: parseInt(approveData.quantityApproved),
        approvedAmount: parseFloat(approveData.approvedAmount) || undefined,
        validFrom: approveData.validFrom || undefined,
        validUntil: approveData.validUntil || undefined,
        externalReference: approveData.externalReference || undefined,
        notes: approveData.notes || undefined
      });
      onUpdated();
    } catch (err) {
      console.error('Error approving:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'approbation');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectData.reason.trim()) {
      setError('Le motif du refus est requis');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await approvalService.rejectRequest(approval._id, rejectData);
      onUpdated();
    } catch (err) {
      console.error('Error rejecting:', err);
      setError(err.response?.data?.message || 'Erreur lors du refus');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Annuler cette demande d\'approbation?')) return;
    setLoading(true);
    setError(null);
    try {
      await approvalService.cancelApproval(approval._id, 'Annulé par utilisateur');
      onUpdated();
    } catch (err) {
      console.error('Error cancelling:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'annulation');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'En attente' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Approuvé' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Rejeté' },
      used: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Check, label: 'Utilisé' },
      expired: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock, label: 'Expiré' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: X, label: 'Annulé' }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.bg} ${c.text}`}>
        <Icon className="h-4 w-4" />
        {c.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-yellow-500 to-yellow-600">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Détail de la demande
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Status and ID */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">N° Demande</p>
                <p className="text-lg font-semibold text-gray-900">{approval.approvalId}</p>
              </div>
              {getStatusBadge(approval.status)}
            </div>

            {/* Patient Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Patient</p>
                  <p className="font-medium text-gray-900">
                    {approval.patient?.firstName} {approval.patient?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{approval.patient?.patientId}</p>
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entreprise</p>
                  <p className="font-medium text-gray-900">{approval.company?.name}</p>
                  <p className="text-sm text-gray-500">{approval.company?.companyId}</p>
                </div>
              </div>
            </div>

            {/* Act Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Code acte</p>
                <p className="font-medium text-gray-900">{approval.actCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nom de l'acte</p>
                <p className="font-medium text-gray-900">{approval.actName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Quantité demandée</p>
                <p className="font-medium text-gray-900">{approval.quantityRequested}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Montant estimé</p>
                <p className="font-medium text-gray-900">
                  {formatCurrency(approval.estimatedCost, approval.currency)}
                </p>
              </div>
            </div>

            {/* Medical Justification */}
            {approval.medicalJustification && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900">Justification médicale</h4>
                {typeof approval.medicalJustification === 'string' ? (
                  // Legacy string format
                  <p className="text-gray-700">{approval.medicalJustification}</p>
                ) : (
                  // Object format with diagnosis, clinicalNotes, urgency
                  <>
                    {approval.medicalJustification.diagnosis && (
                      <div>
                        <p className="text-sm text-gray-500">Diagnostic</p>
                        <p className="text-gray-900">{approval.medicalJustification.diagnosis}</p>
                      </div>
                    )}
                    {approval.medicalJustification.clinicalNotes && (
                      <div>
                        <p className="text-sm text-gray-500">Notes cliniques</p>
                        <p className="text-gray-700">{approval.medicalJustification.clinicalNotes}</p>
                      </div>
                    )}
                    {approval.medicalJustification.urgency && (
                      <div>
                        <p className="text-sm text-gray-500">Urgence</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          approval.medicalJustification.urgency === 'emergency' ? 'bg-red-100 text-red-800' :
                          approval.medicalJustification.urgency === 'urgent' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {approval.medicalJustification.urgency === 'emergency' ? 'Urgence' :
                           approval.medicalJustification.urgency === 'urgent' ? 'Urgent' : 'Routine'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Approval Details (if approved) */}
            {approval.status === 'approved' && (
              <div className="bg-green-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-green-800">Détails de l'approbation</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Quantité approuvée</p>
                    <p className="font-medium">{approval.quantityApproved}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Montant approuvé</p>
                    <p className="font-medium">{formatCurrency(approval.approvedAmount, approval.currency)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Valide du</p>
                    <p className="font-medium">{formatDate(approval.validFrom)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Valide jusqu'au</p>
                    <p className="font-medium">{formatDate(approval.validUntil)}</p>
                  </div>
                  {approval.externalReference && (
                    <div className="col-span-2">
                      <p className="text-gray-500">Référence externe</p>
                      <p className="font-medium">{approval.externalReference}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rejection Details (if rejected) */}
            {approval.status === 'rejected' && approval.rejectionReason && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Motif du refus</h4>
                <p className="text-red-700">{approval.rejectionReason}</p>
              </div>
            )}

            {/* Usage History */}
            {approval.usageHistory?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Historique d'utilisation</h4>
                <div className="space-y-2">
                  {approval.usageHistory.map((usage, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Quantité: {usage.quantity}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(usage.usedAt)}</p>
                      </div>
                      {usage.invoiceId && (
                        <span className="text-xs text-blue-600">
                          Facture: {usage.invoiceId.invoiceId || usage.invoiceId}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Historique</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-500">Demandé le</span>
                  <span className="font-medium">{formatDateTime(approval.requestedAt)}</span>
                  {approval.requestedBy && (
                    <span className="text-gray-500">
                      par {approval.requestedBy.firstName} {approval.requestedBy.lastName}
                    </span>
                  )}
                </div>
                {approval.respondedAt && (
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      approval.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-gray-500">
                      {approval.status === 'approved' ? 'Approuvé' : 'Rejeté'} le
                    </span>
                    <span className="font-medium">{formatDateTime(approval.respondedAt)}</span>
                    {approval.respondedBy && (
                      <span className="text-gray-500">par {approval.respondedBy}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Approve Form */}
            {showApproveForm && approval.status === 'pending' && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium text-green-700">Approuver la demande</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantité approuvée
                    </label>
                    <input
                      type="number"
                      value={approveData.quantityApproved}
                      onChange={(e) => setApproveData(prev => ({ ...prev, quantityApproved: e.target.value }))}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Montant approuvé
                    </label>
                    <input
                      type="number"
                      value={approveData.approvedAmount}
                      onChange={(e) => setApproveData(prev => ({ ...prev, approvedAmount: e.target.value }))}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valide à partir du
                    </label>
                    <input
                      type="date"
                      value={approveData.validFrom}
                      onChange={(e) => setApproveData(prev => ({ ...prev, validFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valide jusqu'au
                    </label>
                    <input
                      type="date"
                      value={approveData.validUntil}
                      onChange={(e) => setApproveData(prev => ({ ...prev, validUntil: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Référence externe
                    </label>
                    <input
                      type="text"
                      value={approveData.externalReference}
                      onChange={(e) => setApproveData(prev => ({ ...prev, externalReference: e.target.value }))}
                      placeholder="N° accord assurance..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={approveData.notes}
                      onChange={(e) => setApproveData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowApproveForm(false)}
                    className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirmer l'approbation
                  </button>
                </div>
              </div>
            )}

            {/* Reject Form */}
            {showRejectForm && approval.status === 'pending' && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium text-red-700">Rejeter la demande</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif du refus *
                  </label>
                  <textarea
                    value={rejectData.reason}
                    onChange={(e) => setRejectData(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                    required
                    placeholder="Veuillez indiquer le motif du refus..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={loading || !rejectData.reason.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Confirmer le refus
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
          <div>
            {approval.status === 'pending' && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler la demande
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Fermer
            </button>
            {canApprove && approval.status === 'pending' && !showApproveForm && !showRejectForm && (
              <>
                <button
                  onClick={() => { setShowRejectForm(true); setShowApproveForm(false); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <XCircle className="h-5 w-5" />
                  Rejeter
                </button>
                <button
                  onClick={() => { setShowApproveForm(true); setShowRejectForm(false); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Approuver
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
