import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../services/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import { safeString } from '../utils/apiHelpers';
import PharmacyInvoiceView from '../components/pharmacy/PharmacyInvoiceView';
import OfflineWarningBanner from '../components/OfflineWarningBanner';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Pill,
  User,
  Calendar,
  FileText,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Receipt
} from 'lucide-react';

const PrescriptionQueue = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    verified: 0,
    dispensed: 0,
    rejected: 0
  });
  const [filters, setFilters] = useState({
    status: 'pending',
    search: '',
    priority: 'all'
  });
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [verifyDialog, setVerifyDialog] = useState(false);
  const [dispenseDialog, setDispenseDialog] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [dispenseData, setDispenseData] = useState({
    quantity: 0,
    lotNumber: '',
    notes: ''
  });
  const [drugInteractions, setDrugInteractions] = useState([]);
  const [expandedPrescription, setExpandedPrescription] = useState(null);
  const [invoiceViewData, setInvoiceViewData] = useState(null); // For pharmacy invoice view

  useEffect(() => {
    fetchPrescriptions();
    fetchStats();
  }, [filters]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const params = {
        pharmacyStatus: filters.status === 'all' ? undefined : filters.status,
        search: filters.search || undefined,
        type: 'drug' // Only drug prescriptions for pharmacy
      };

      const response = await api.get('/prescriptions', { params });
      setPrescriptions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      toast.error('Erreur lors du chargement des ordonnances');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/prescriptions/statistics');
      if (response.data.success) {
        setStats({
          pending: response.data.data.byPharmacyStatus?.pending || 0,
          verified: response.data.data.byPharmacyStatus?.verified || 0,
          dispensed: response.data.data.byPharmacyStatus?.dispensed || 0,
          rejected: response.data.data.byPharmacyStatus?.rejected || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleVerify = async (approved) => {
    if (!selectedPrescription) return;

    try {
      const response = await api.post(`/prescriptions/${selectedPrescription._id}/verify`, {
        approved,
        notes: verificationNotes
      });

      if (response.data.success) {
        toast.success(approved ? 'Ordonnance vérifiée' : 'Ordonnance rejetée');
        setVerifyDialog(false);
        setSelectedPrescription(null);
        setVerificationNotes('');
        fetchPrescriptions();
        fetchStats();
      }
    } catch (error) {
      console.error('Error verifying prescription:', error);
      toast.error('Erreur lors de la vérification');
    }
  };

  const handleDispense = async () => {
    if (!selectedPrescription) return;

    try {
      const response = await api.put(`/prescriptions/${selectedPrescription._id}/dispense`, {
        dispensedQuantity: dispenseData.quantity,
        lotNumber: dispenseData.lotNumber,
        notes: dispenseData.notes
      });

      if (response.data.success) {
        toast.success('Médicament délivré');
        setDispenseDialog(false);

        // UNIFIED BILLING: Show pharmacy invoice view after dispensing
        // if the prescription has an associated visit
        if (selectedPrescription.visit) {
          setInvoiceViewData({
            visitId: selectedPrescription.visit._id || selectedPrescription.visit,
            patientName: `${selectedPrescription.patient?.firstName || ''} ${selectedPrescription.patient?.lastName || ''}`
          });
        }

        setSelectedPrescription(null);
        setDispenseData({ quantity: 0, lotNumber: '', notes: '' });
        fetchPrescriptions();
        fetchStats();
      }
    } catch (error) {
      console.error('Error dispensing:', error);
      toast.error('Erreur lors de la délivrance');
    }
  };

  // Open invoice view manually for any prescription
  const handleViewInvoice = (prescription) => {
    if (prescription.visit) {
      setInvoiceViewData({
        visitId: prescription.visit._id || prescription.visit,
        patientName: `${prescription.patient?.firstName || ''} ${prescription.patient?.lastName || ''}`
      });
    } else {
      toast.warning('Cette ordonnance n\'est pas liée à une visite');
    }
  };

  const checkInteractions = async (prescription) => {
    try {
      const response = await api.post('/prescriptions/check-interactions', {
        medications: prescription.medications?.map(m => m.medication) || [prescription.medication],
        patientId: prescription.patient?._id
      });

      if (response.data.success) {
        setDrugInteractions(response.data.data?.interactions || []);
      }
    } catch (error) {
      console.error('Error checking interactions:', error);
    }
  };

  const openVerifyDialog = (prescription) => {
    setSelectedPrescription(prescription);
    checkInteractions(prescription);
    setVerifyDialog(true);
  };

  const openDispenseDialog = (prescription) => {
    setSelectedPrescription(prescription);
    setDispenseData({
      quantity: prescription.quantity || 1,
      lotNumber: '',
      notes: ''
    });
    setDispenseDialog(true);
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'En attente' },
      verified: { color: 'bg-blue-100 text-blue-800', label: 'Vérifiée' },
      dispensed: { color: 'bg-green-100 text-green-800', label: 'Délivrée' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejetée' },
      'partially-dispensed': { color: 'bg-purple-100 text-purple-800', label: 'Partielle' }
    };

    const statusConfig = config[status] || config.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
    );
  };

  const getPriorityBadge = (prescription) => {
    // Check if urgent based on refills or notes
    const isUrgent = prescription.notes?.toLowerCase().includes('urgent') ||
      prescription.refillsRemaining === 0;

    if (isUrgent) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Urgent
        </span>
      );
    }
    return null;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Pill className="h-8 w-8 mr-3 text-primary-600" />
            File d'attente Pharmacie
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Vérification et délivrance des ordonnances
          </p>
        </div>
        <button
          onClick={() => { fetchPrescriptions(); fetchStats(); }}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <OfflineWarningBanner isCritical={true} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => setFilters(f => ({ ...f, status: 'pending' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>

        <div
          onClick={() => setFilters(f => ({ ...f, status: 'verified' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'verified' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Vérifiées</p>
              <p className="text-2xl font-bold text-blue-600">{stats.verified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div
          onClick={() => setFilters(f => ({ ...f, status: 'dispensed' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'dispensed' ? 'ring-2 ring-green-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Délivrées</p>
              <p className="text-2xl font-bold text-green-600">{stats.dispensed}</p>
            </div>
            <Pill className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div
          onClick={() => setFilters(f => ({ ...f, status: 'rejected' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rejetées</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher patient, médecin, médicament..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="input pl-10"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="input w-48"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="verified">Vérifiées</option>
            <option value="dispensed">Délivrées</option>
            <option value="rejected">Rejetées</option>
          </select>
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="card p-0">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Chargement...</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune ordonnance trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {prescriptions.map((prescription) => (
              <div
                key={prescription._id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">
                        {prescription.prescriptionNumber || `RX-${prescription._id.slice(-6)}`}
                      </span>
                      {getStatusBadge(prescription.pharmacyStatus || 'pending')}
                      {getPriorityBadge(prescription)}
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span>
                          {prescription.patient?.firstName} {prescription.patient?.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="h-4 w-4" />
                        <span>Dr. {prescription.prescribedBy?.lastName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(prescription.createdAt)}</span>
                      </div>
                    </div>

                    {/* Medication details */}
                    <button
                      onClick={() => setExpandedPrescription(
                        expandedPrescription === prescription._id ? null : prescription._id
                      )}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
                    >
                      {expandedPrescription === prescription._id ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Masquer les détails
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Voir les médicaments ({prescription.medications?.length || 1})
                        </>
                      )}
                    </button>

                    {expandedPrescription === prescription._id && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        {prescription.medications?.map((med, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{med.medication || med.name}</p>
                                {/* Route badge */}
                                {med.route && med.route !== 'oral' && (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600">
                                    {med.route === 'ophthalmic' ? 'Collyre' : med.route}
                                  </span>
                                )}
                                {/* Eye badge for ophthalmic */}
                                {med.applicationLocation?.eye && (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">
                                    {med.applicationLocation.eye}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{safeString(med.dosage, 'N/A')} - {safeString(med.frequency, 'N/A')}</p>
                              {/* Tapering indicator */}
                              {med.tapering?.enabled && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                  Décroissance: {med.tapering.totalDurationDays || '?'} jours
                                </p>
                              )}
                            </div>
                            <span className="text-sm text-gray-600">Qté: {med.quantity}</span>
                          </div>
                        )) || (
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium text-gray-900">{prescription.medication}</p>
                              <p className="text-sm text-gray-500">{prescription.dosage} - {prescription.frequency}</p>
                            </div>
                            <span className="text-sm text-gray-600">Qté: {prescription.quantity}</span>
                          </div>
                        )}

                        {prescription.notes && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {prescription.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {(!prescription.pharmacyStatus || prescription.pharmacyStatus === 'pending') && (
                      <button
                        onClick={() => openVerifyDialog(prescription)}
                        className="btn btn-primary btn-sm flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Vérifier
                      </button>
                    )}

                    {prescription.pharmacyStatus === 'verified' && (
                      <button
                        onClick={() => openDispenseDialog(prescription)}
                        className="btn btn-success btn-sm flex items-center gap-1"
                      >
                        <Pill className="h-4 w-4" />
                        Délivrer
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedPrescription(prescription);
                        checkInteractions(prescription);
                      }}
                      className="btn btn-secondary btn-sm"
                      title="Voir détails"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* UNIFIED BILLING: View Invoice Button */}
                    {prescription.visit && (
                      <button
                        onClick={() => handleViewInvoice(prescription)}
                        className="btn btn-outline-primary btn-sm flex items-center gap-1"
                        title="Voir facture"
                      >
                        <Receipt className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verify Dialog */}
      {verifyDialog && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Vérification de l'ordonnance</h2>
              <button
                onClick={() => { setVerifyDialog(false); setSelectedPrescription(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Patient</h3>
                <p className="text-gray-700">
                  {selectedPrescription.patient?.firstName} {selectedPrescription.patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  ID: {selectedPrescription.patient?.patientId}
                </p>
              </div>

              {/* Medications */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Médicaments prescrits</h3>
                <div className="space-y-2">
                  {selectedPrescription.medications?.map((med, idx) => (
                    <div key={idx} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{med.medication || med.name}</p>
                        {/* Route badge */}
                        {med.route && med.route !== 'oral' && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                            {med.route === 'ophthalmic' ? 'Collyre' : med.route}
                          </span>
                        )}
                        {/* Eye badge */}
                        {med.applicationLocation?.eye && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">
                            {med.applicationLocation.eye}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {safeString(med.dosage, 'N/A')} | {safeString(med.frequency, 'N/A')} | Durée: {safeString(med.duration, 'N/A')}
                      </p>
                      <p className="text-sm text-gray-500">Quantité: {med.quantity}</p>
                      {/* Tapering info */}
                      {med.tapering?.enabled && (
                        <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <p className="text-xs font-medium text-amber-700">
                            Décroissance ({med.tapering.totalDurationDays || '?'} jours)
                          </p>
                          {med.tapering.schedule?.slice(0, 3).map((step, i) => (
                            <p key={i} className="text-xs text-amber-600">
                              Étape {step.stepNumber}: {step.frequency} - {step.durationDays}j
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )) || (
                    <div className="border rounded-lg p-3">
                      <p className="font-medium">{selectedPrescription.medication}</p>
                      <p className="text-sm text-gray-600">
                        {selectedPrescription.dosage} | {selectedPrescription.frequency}
                      </p>
                      <p className="text-sm text-gray-500">Quantité: {selectedPrescription.quantity}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drug Interactions Warning */}
              {drugInteractions.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    Interactions médicamenteuses détectées
                  </h3>
                  <ul className="space-y-2">
                    {drugInteractions.map((interaction, idx) => (
                      <li key={idx} className="text-sm text-red-700">
                        <span className="font-medium">{interaction.drug1}</span> +
                        <span className="font-medium"> {interaction.drug2}</span>: {interaction.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes de vérification
                </label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className="input"
                  rows="3"
                  placeholder="Commentaires sur la vérification..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => handleVerify(false)}
                className="btn btn-danger flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Rejeter
              </button>
              <button
                onClick={() => handleVerify(true)}
                className="btn btn-success flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Approuver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Dialog */}
      {dispenseDialog && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Délivrance du médicament</h2>
              <button
                onClick={() => { setDispenseDialog(false); setSelectedPrescription(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium">{selectedPrescription.medication || selectedPrescription.medications?.[0]?.medication}</p>
                <p className="text-sm text-gray-600">
                  Patient: {selectedPrescription.patient?.firstName} {selectedPrescription.patient?.lastName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité à délivrer
                </label>
                <input
                  type="number"
                  value={dispenseData.quantity}
                  onChange={(e) => setDispenseData(d => ({ ...d, quantity: parseInt(e.target.value) || 0 }))}
                  className="input"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de lot
                </label>
                <input
                  type="text"
                  value={dispenseData.lotNumber}
                  onChange={(e) => setDispenseData(d => ({ ...d, lotNumber: e.target.value }))}
                  className="input"
                  placeholder="LOT-123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={dispenseData.notes}
                  onChange={(e) => setDispenseData(d => ({ ...d, notes: e.target.value }))}
                  className="input"
                  rows="2"
                  placeholder="Instructions au patient..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setDispenseDialog(false); setSelectedPrescription(null); }}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleDispense}
                className="btn btn-success flex items-center gap-2"
                disabled={dispenseData.quantity <= 0}
              >
                <Pill className="h-4 w-4" />
                Délivrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED BILLING: Pharmacy Invoice View */}
      <PharmacyInvoiceView
        isOpen={!!invoiceViewData}
        onClose={() => setInvoiceViewData(null)}
        visitId={invoiceViewData?.visitId}
        onItemUpdated={() => {
          fetchPrescriptions();
          fetchStats();
        }}
      />
    </div>
  );
};

export default PrescriptionQueue;
