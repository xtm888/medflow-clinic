import { useState, useEffect } from 'react';
import { X, Shield, Clock, CheckCircle, XCircle, AlertTriangle, FileText, Upload, History } from 'lucide-react';
import prescriptionService from '../services/prescriptionService';
import { toast } from 'react-toastify';
import { getPatientName as formatPatientName } from '../utils/formatters';

const PA_STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'yellow', icon: Clock },
  submitted: { label: 'Soumise', color: 'blue', icon: FileText },
  in_review: { label: 'En révision', color: 'purple', icon: Shield },
  approved: { label: 'Approuvée', color: 'green', icon: CheckCircle },
  denied: { label: 'Refusée', color: 'red', icon: XCircle },
  appeal_pending: { label: 'Appel en cours', color: 'orange', icon: AlertTriangle },
  expired: { label: 'Expirée', color: 'gray', icon: Clock }
};

const URGENCY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergent', label: 'Urgence vitale' }
];

export default function PriorAuthorizationModal({ prescription, onClose, onUpdate, isAdmin = false }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paStatus, setPaStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('request'); // request, status, history

  // Form state for new PA request
  const [formData, setFormData] = useState({
    insurance: {
      provider: '',
      policyNumber: '',
      groupNumber: '',
      subscriberId: ''
    },
    clinicalInfo: {
      diagnosis: prescription?.diagnosis || '',
      justification: '',
      previousTherapies: '',
      urgency: 'routine'
    }
  });

  // Admin actions state
  const [adminAction, setAdminAction] = useState({
    authorizationNumber: '',
    validFrom: '',
    validUntil: '',
    approvedQuantity: '',
    denialReason: ''
  });

  useEffect(() => {
    if (prescription?.priorAuthorization?.status) {
      loadPAStatus();
      setActiveTab('status');
    }
  }, [prescription]);

  const loadPAStatus = async () => {
    try {
      setLoading(true);
      const status = await prescriptionService.getPriorAuthorizationStatus(prescription._id || prescription.id);
      setPaStatus(status);
    } catch (error) {
      console.error('Error loading PA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.insurance.provider || !formData.insurance.policyNumber) {
      toast.error('Veuillez remplir les informations d\'assurance');
      return;
    }
    if (!formData.clinicalInfo.justification) {
      toast.error('Veuillez fournir une justification clinique');
      return;
    }

    try {
      setSubmitting(true);
      await prescriptionService.requestPriorAuthorization(
        prescription._id || prescription.id,
        formData
      );
      toast.success('Demande d\'autorisation préalable soumise avec succès');
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error submitting PA request:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!adminAction.authorizationNumber) {
      toast.error('Veuillez entrer le numéro d\'autorisation');
      return;
    }

    try {
      setSubmitting(true);
      await prescriptionService.approvePriorAuthorization(
        prescription._id || prescription.id,
        {
          authorizationNumber: adminAction.authorizationNumber,
          validFrom: adminAction.validFrom || new Date().toISOString(),
          validUntil: adminAction.validUntil,
          approvedQuantity: adminAction.approvedQuantity ? parseInt(adminAction.approvedQuantity) : undefined
        }
      );
      toast.success('Autorisation préalable approuvée');
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error approving PA:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'approbation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!adminAction.denialReason) {
      toast.error('Veuillez fournir une raison de refus');
      return;
    }

    try {
      setSubmitting(true);
      await prescriptionService.denyPriorAuthorization(
        prescription._id || prescription.id,
        adminAction.denialReason
      );
      toast.success('Autorisation préalable refusée');
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error denying PA:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du refus');
    } finally {
      setSubmitting(false);
    }
  };

  const getPatientName = () => {
    const patient = prescription?.patient;
    if (patient && typeof patient === 'object') {
      return formatPatientName(patient) || 'Patient';
    }
    return 'Patient';
  };

  const getMedicationsList = () => {
    if (!prescription?.medications) return [];
    return prescription.medications.map(med => {
      if (med.name) return med.name;
      if (med.drug?.name) return med.drug.name;
      if (med.medication?.name) return med.medication.name;
      if (typeof med.medication === 'string') return med.medication;
      return 'Médicament';
    });
  };

  const pa = prescription?.priorAuthorization || paStatus;
  const StatusIcon = pa?.status ? PA_STATUS_CONFIG[pa.status]?.icon : Shield;
  const statusConfig = pa?.status ? PA_STATUS_CONFIG[pa.status] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">Autorisation Préalable</h2>
                <p className="text-blue-100 text-sm">{getPatientName()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {!pa?.status && (
              <button
                onClick={() => setActiveTab('request')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'request'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Nouvelle demande
              </button>
            )}
            {pa?.status && (
              <>
                <button
                  onClick={() => setActiveTab('status')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'status'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Shield className="h-4 w-4 inline mr-2" />
                  Statut
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <History className="h-4 w-4 inline mr-2" />
                  Historique
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Request Form Tab */}
              {activeTab === 'request' && !pa?.status && (
                <form onSubmit={handleSubmitRequest} className="space-y-6">
                  {/* Prescription Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Médicaments concernés</h3>
                    <div className="flex flex-wrap gap-2">
                      {getMedicationsList().map((med, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {med}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Insurance Information */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Informations d'assurance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Assureur *
                        </label>
                        <input
                          type="text"
                          value={formData.insurance.provider}
                          onChange={(e) => handleInputChange('insurance', 'provider', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Ex: CNPS, Allianz, AXA..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          N° Police *
                        </label>
                        <input
                          type="text"
                          value={formData.insurance.policyNumber}
                          onChange={(e) => handleInputChange('insurance', 'policyNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          N° Groupe
                        </label>
                        <input
                          type="text"
                          value={formData.insurance.groupNumber}
                          onChange={(e) => handleInputChange('insurance', 'groupNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ID Assuré
                        </label>
                        <input
                          type="text"
                          value={formData.insurance.subscriberId}
                          onChange={(e) => handleInputChange('insurance', 'subscriberId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clinical Information */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Informations cliniques</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Diagnostic
                        </label>
                        <input
                          type="text"
                          value={formData.clinicalInfo.diagnosis}
                          onChange={(e) => handleInputChange('clinicalInfo', 'diagnosis', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Diagnostic principal"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Justification clinique *
                        </label>
                        <textarea
                          value={formData.clinicalInfo.justification}
                          onChange={(e) => handleInputChange('clinicalInfo', 'justification', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Expliquez pourquoi ce traitement est nécessaire..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Traitements antérieurs
                        </label>
                        <textarea
                          value={formData.clinicalInfo.previousTherapies}
                          onChange={(e) => handleInputChange('clinicalInfo', 'previousTherapies', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Traitements essayés précédemment..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Urgence
                        </label>
                        <select
                          value={formData.clinicalInfo.urgency}
                          onChange={(e) => handleInputChange('clinicalInfo', 'urgency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {URGENCY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Soumettre la demande
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Status Tab */}
              {activeTab === 'status' && pa?.status && (
                <div className="space-y-6">
                  {/* Status Badge */}
                  <div className={`p-6 rounded-xl bg-${statusConfig?.color || 'gray'}-50 border border-${statusConfig?.color || 'gray'}-200`}>
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-full bg-${statusConfig?.color || 'gray'}-100`}>
                        <StatusIcon className={`h-8 w-8 text-${statusConfig?.color || 'gray'}-600`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Statut actuel</p>
                        <p className={`text-2xl font-bold text-${statusConfig?.color || 'gray'}-700`}>
                          {statusConfig?.label || pa.status}
                        </p>
                        {pa.referenceNumber && (
                          <p className="text-sm text-gray-600 mt-1">
                            Réf: {pa.referenceNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details based on status */}
                  {pa.status === 'approved' && pa.approval && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-medium text-green-900 mb-2">Détails de l'approbation</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {pa.approval.authorizationNumber && (
                          <div>
                            <span className="text-gray-500">N° Autorisation:</span>
                            <p className="font-medium text-green-800">{pa.approval.authorizationNumber}</p>
                          </div>
                        )}
                        {pa.approval.validFrom && (
                          <div>
                            <span className="text-gray-500">Valide du:</span>
                            <p className="font-medium">{new Date(pa.approval.validFrom).toLocaleDateString('fr-FR')}</p>
                          </div>
                        )}
                        {pa.approval.validUntil && (
                          <div>
                            <span className="text-gray-500">Valide jusqu'au:</span>
                            <p className="font-medium">{new Date(pa.approval.validUntil).toLocaleDateString('fr-FR')}</p>
                          </div>
                        )}
                        {pa.approval.approvedQuantity && (
                          <div>
                            <span className="text-gray-500">Quantité approuvée:</span>
                            <p className="font-medium">{pa.approval.approvedQuantity}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {pa.status === 'denied' && pa.denial && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <h4 className="font-medium text-red-900 mb-2">Détails du refus</h4>
                      <p className="text-sm text-red-800 mb-2">{pa.denial.reason}</p>
                      {pa.denial.appealDeadline && (
                        <p className="text-sm text-gray-600">
                          Date limite d'appel: {new Date(pa.denial.appealDeadline).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Insurance Info */}
                  {pa.insurance && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Informations d'assurance</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500">Assureur:</span> {pa.insurance.provider}</div>
                        <div><span className="text-gray-500">N° Police:</span> {pa.insurance.policyNumber}</div>
                        {pa.insurance.groupNumber && (
                          <div><span className="text-gray-500">N° Groupe:</span> {pa.insurance.groupNumber}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admin Actions */}
                  {isAdmin && ['submitted', 'in_review', 'appeal_pending'].includes(pa.status) && (
                    <div className="border-t pt-6">
                      <h4 className="font-medium text-gray-900 mb-4">Actions administrateur</h4>

                      {/* Approve Section */}
                      <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
                        <h5 className="font-medium text-green-900 mb-3">Approuver</h5>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            placeholder="N° Autorisation *"
                            value={adminAction.authorizationNumber}
                            onChange={(e) => setAdminAction(prev => ({ ...prev, authorizationNumber: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Quantité approuvée"
                            value={adminAction.approvedQuantity}
                            onChange={(e) => setAdminAction(prev => ({ ...prev, approvedQuantity: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="date"
                            placeholder="Valide du"
                            value={adminAction.validFrom}
                            onChange={(e) => setAdminAction(prev => ({ ...prev, validFrom: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="date"
                            placeholder="Valide jusqu'au"
                            value={adminAction.validUntil}
                            onChange={(e) => setAdminAction(prev => ({ ...prev, validUntil: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <button
                          onClick={handleApprove}
                          disabled={submitting}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4 inline mr-2" />
                          Approuver l'autorisation
                        </button>
                      </div>

                      {/* Deny Section */}
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <h5 className="font-medium text-red-900 mb-3">Refuser</h5>
                        <textarea
                          placeholder="Raison du refus *"
                          value={adminAction.denialReason}
                          onChange={(e) => setAdminAction(prev => ({ ...prev, denialReason: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
                        />
                        <button
                          onClick={handleDeny}
                          disabled={submitting}
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4 inline mr-2" />
                          Refuser l'autorisation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && pa?.statusHistory && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Historique des statuts</h4>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    {pa.statusHistory.map((entry, idx) => {
                      const config = PA_STATUS_CONFIG[entry.status];
                      const EntryIcon = config?.icon || Clock;
                      return (
                        <div key={idx} className="relative flex items-start mb-4 pl-10">
                          <div className={`absolute left-2 p-1 rounded-full bg-${config?.color || 'gray'}-100`}>
                            <EntryIcon className={`h-4 w-4 text-${config?.color || 'gray'}-600`} />
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <span className={`font-medium text-${config?.color || 'gray'}-700`}>
                                {config?.label || entry.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(entry.changedAt).toLocaleString('fr-FR')}
                              </span>
                            </div>
                            {entry.notes && (
                              <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                            )}
                            {entry.changedBy && (
                              <p className="text-xs text-gray-400 mt-1">
                                Par: {typeof entry.changedBy === 'object' ? entry.changedBy.name : entry.changedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
