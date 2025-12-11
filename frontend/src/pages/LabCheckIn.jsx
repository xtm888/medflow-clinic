import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import labOrderService, { REJECTION_REASONS } from '../services/labOrderService';
import {
  Search,
  FlaskConical,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Calendar,
  XCircle,
  UserCheck,
  Coffee,
  Ban,
  CalendarX,
  DollarSign,
  Phone,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

/**
 * LabCheckIn - Patient check-in page for laboratory specimen collection
 * Handles patient arrival verification, fasting checks, and rejection with penalty
 */
const LabCheckIn = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scheduled'); // scheduled, checked-in

  // Data
  const [scheduledOrders, setScheduledOrders] = useState([]);
  const [checkedInOrders, setCheckedInOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [stats, setStats] = useState({ scheduled: 0, checkedIn: 0, pending: 0 });

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [checkInModal, setCheckInModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);

  // Check-in form
  const [checkInForm, setCheckInForm] = useState({
    fastingVerified: false,
    fastingHours: '',
    preparationVerified: false,
    notes: ''
  });

  // Rejection form
  const [rejectForm, setRejectForm] = useState({
    reason: '',
    reasonDetails: '',
    penaltyAmount: 0,
    rescheduledTo: '',
    rescheduledNotes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [scheduledRes, checkedInRes, pendingRes] = await Promise.all([
        labOrderService.getScheduledToday().catch(() => ({ data: [] })),
        labOrderService.getCheckedIn().catch(() => ({ data: [] })),
        labOrderService.getPendingLabOrders().catch(() => ({ data: [] }))
      ]);

      const scheduled = scheduledRes.data || [];
      const checkedIn = checkedInRes.data || [];
      const pending = pendingRes.data || [];

      setScheduledOrders(scheduled);
      setCheckedInOrders(checkedIn);
      setPendingOrders(pending);
      setStats({
        scheduled: scheduled.length,
        checkedIn: checkedIn.length,
        pending: pending.length
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCheckIn = (order) => {
    setSelectedOrder(order);
    setCheckInForm({
      fastingVerified: false,
      fastingHours: '',
      preparationVerified: false,
      notes: ''
    });
    setCheckInModal(true);
  };

  const handleCheckIn = async () => {
    if (!selectedOrder) return;

    // Validate fasting if required
    if (selectedOrder.fasting?.required && !checkInForm.fastingVerified) {
      toast.warning('Veuillez confirmer le jeûne du patient');
      return;
    }

    try {
      setSubmitting(true);
      await labOrderService.checkInPatient(selectedOrder._id, checkInForm);
      toast.success(`Patient ${selectedOrder.patient?.firstName} enregistré`);
      setCheckInModal(false);
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReject = (order) => {
    setSelectedOrder(order);
    setRejectForm({
      reason: '',
      reasonDetails: '',
      penaltyAmount: 0,
      rescheduledTo: '',
      rescheduledNotes: ''
    });
    setRejectModal(true);
  };

  const handleReasonChange = (reason) => {
    const reasonObj = REJECTION_REASONS.find(r => r.value === reason);
    setRejectForm(prev => ({
      ...prev,
      reason,
      penaltyAmount: reasonObj?.penaltySuggested || 0
    }));
  };

  const handleReject = async () => {
    if (!selectedOrder || !rejectForm.reason) {
      toast.warning('Veuillez sélectionner une raison');
      return;
    }

    try {
      setSubmitting(true);
      await labOrderService.rejectAndReschedule(selectedOrder._id, rejectForm);
      toast.success('Prélèvement rejeté et reprogrammé');
      setRejectModal(false);
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du rejet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollect = async (order) => {
    try {
      await labOrderService.collectSpecimen(order._id, {
        specimenType: order.tests?.[0]?.specimen || 'blood'
      });
      toast.success('Prélèvement effectué');
      fetchData();
    } catch (error) {
      console.error('Error collecting:', error);
      toast.error('Erreur lors du prélèvement');
    }
  };

  const getDisplayOrders = () => {
    let orders = [];
    if (activeTab === 'scheduled') {
      orders = scheduledOrders;
    } else if (activeTab === 'checked-in') {
      orders = checkedInOrders;
    } else {
      orders = pendingOrders;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      orders = orders.filter(o =>
        o.patient?.firstName?.toLowerCase().includes(search) ||
        o.patient?.lastName?.toLowerCase().includes(search) ||
        o.patient?.patientId?.toLowerCase().includes(search) ||
        o.patient?.phone?.includes(search)
      );
    }

    return orders;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayOrders = getDisplayOrders();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-blue-600" />
            Check-in Laboratoire
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Accueil des patients pour prélèvements - Vérification et enregistrement
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`card cursor-pointer transition-all text-left ${
            activeTab === 'scheduled' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Programmés Aujourd'hui</p>
              <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-400" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('checked-in')}
          className={`card cursor-pointer transition-all text-left ${
            activeTab === 'checked-in' ? 'ring-2 ring-green-500 bg-green-50' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En Attente Prélèvement</p>
              <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
            </div>
            <UserCheck className="h-8 w-8 text-green-400" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`card cursor-pointer transition-all text-left ${
            activeTab === 'pending' ? 'ring-2 ring-yellow-500 bg-yellow-50' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tous En Attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, ID patient ou téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="card p-0">
        {loading && displayOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <p className="mt-4 text-gray-500">Chargement...</p>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun patient {activeTab === 'scheduled' ? 'programmé' : activeTab === 'checked-in' ? 'enregistré' : 'en attente'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {displayOrders.map((order) => (
              <div
                key={order._id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Patient Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-lg text-gray-900">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </span>
                      <span className="text-sm text-gray-500">
                        ID: {order.patient?.patientId}
                      </span>
                      {order.fasting?.required && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                          <Coffee className="h-3 w-3" />
                          Jeûne requis
                        </span>
                      )}
                      {order.priority === 'urgent' && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Urgent
                        </span>
                      )}
                      {order.rejectionHistory?.length > 0 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          {order.rejectionHistory.length} rejet(s) précédent(s)
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                      {order.patient?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {order.patient.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {order.scheduledTime || formatDate(order.scheduledDate || order.createdAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {order.tests?.length || 1} test(s)
                      </div>
                    </div>

                    {/* Check-in info */}
                    {order.checkIn?.arrivedAt && (
                      <div className="mt-2 text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Arrivé à {formatTime(order.checkIn.arrivedAt)}
                        {order.checkIn.fastingVerified && ' - Jeûne vérifié'}
                      </div>
                    )}

                    {/* Expandable tests */}
                    <button
                      onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {expandedOrder === order._id ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Masquer les tests
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Voir les tests ({order.tests?.length || 1})
                        </>
                      )}
                    </button>

                    {expandedOrder === order._id && (
                      <div className="mt-2 bg-gray-50 rounded-lg p-3">
                        {order.tests?.map((test, idx) => (
                          <div key={idx} className="py-1 flex justify-between">
                            <span className="font-medium">{test.testName}</span>
                            <span className="text-sm text-gray-500">{test.category}</span>
                          </div>
                        ))}
                        {order.specialInstructions && (
                          <div className="mt-2 pt-2 border-t text-sm text-gray-600">
                            <strong>Instructions:</strong> {order.specialInstructions}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!order.checkIn?.arrivedAt ? (
                      <>
                        <button
                          onClick={() => handleOpenCheckIn(order)}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                        >
                          <UserCheck className="h-4 w-4" />
                          Check-in
                        </button>
                        <button
                          onClick={() => handleOpenReject(order)}
                          className="btn btn-danger btn-sm flex items-center gap-1"
                        >
                          <Ban className="h-4 w-4" />
                          Rejeter
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCollect(order)}
                          className="btn btn-success btn-sm flex items-center gap-1"
                        >
                          <FlaskConical className="h-4 w-4" />
                          Prélever
                        </button>
                        <button
                          onClick={() => handleOpenReject(order)}
                          className="btn btn-warning btn-sm flex items-center gap-1"
                        >
                          <XCircle className="h-4 w-4" />
                          Annuler
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Check-in Modal */}
      {checkInModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <UserCheck className="h-6 w-6 text-blue-600" />
                Check-in Patient
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="font-semibold text-lg text-gray-900">
                  {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName}
                </p>
                <p className="text-sm text-gray-600">
                  ID: {selectedOrder.patient?.patientId}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedOrder.tests?.length || 1} test(s) à effectuer
                </p>
              </div>

              {/* Fasting Check */}
              {selectedOrder.fasting?.required && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Coffee className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-orange-800">
                      Jeûne Requis ({selectedOrder.fasting.hours || 8}h minimum)
                    </span>
                  </div>

                  <label className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={checkInForm.fastingVerified}
                      onChange={(e) => setCheckInForm(prev => ({
                        ...prev,
                        fastingVerified: e.target.checked
                      }))}
                      className="h-5 w-5 text-green-600 rounded"
                    />
                    <span className="text-gray-700">
                      Je confirme que le patient est à jeun
                    </span>
                  </label>

                  {checkInForm.fastingVerified && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Heures de jeûne
                      </label>
                      <input
                        type="number"
                        value={checkInForm.fastingHours}
                        onChange={(e) => setCheckInForm(prev => ({
                          ...prev,
                          fastingHours: e.target.value
                        }))}
                        placeholder="Ex: 12"
                        className="input w-32"
                        min="0"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Preparation Check */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checkInForm.preparationVerified}
                    onChange={(e) => setCheckInForm(prev => ({
                      ...prev,
                      preparationVerified: e.target.checked
                    }))}
                    className="h-5 w-5 text-green-600 rounded"
                  />
                  <span className="text-gray-700">
                    Préparation vérifiée (instructions suivies)
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={checkInForm.notes}
                  onChange={(e) => setCheckInForm(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  className="input w-full"
                  rows="2"
                  placeholder="Observations particulières..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setCheckInModal(false); setSelectedOrder(null); }}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                onClick={handleCheckIn}
                disabled={submitting || (selectedOrder.fasting?.required && !checkInForm.fastingVerified)}
                className="btn btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Confirmer Check-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Ban className="h-6 w-6 text-red-600" />
                Rejeter et Reprogrammer
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="bg-red-50 rounded-lg p-4">
                <p className="font-semibold text-lg text-gray-900">
                  {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName}
                </p>
                <p className="text-sm text-gray-600">
                  ID: {selectedOrder.patient?.patientId}
                </p>
                {selectedOrder.rejectionHistory?.length > 0 && (
                  <p className="text-sm text-red-600 mt-1 font-medium">
                    Attention: {selectedOrder.rejectionHistory.length} rejet(s) précédent(s)
                  </p>
                )}
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raison du rejet *
                </label>
                <select
                  value={rejectForm.reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Sélectionner une raison...</option>
                  {REJECTION_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Détails supplémentaires
                </label>
                <textarea
                  value={rejectForm.reasonDetails}
                  onChange={(e) => setRejectForm(prev => ({
                    ...prev,
                    reasonDetails: e.target.value
                  }))}
                  className="input w-full"
                  rows="2"
                  placeholder="Ex: Patient a pris son petit-déjeuner à 7h..."
                />
              </div>

              {/* Penalty */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800">
                    Pénalité
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={rejectForm.penaltyAmount}
                    onChange={(e) => setRejectForm(prev => ({
                      ...prev,
                      penaltyAmount: parseInt(e.target.value) || 0
                    }))}
                    className="input w-40"
                    min="0"
                    step="1000"
                  />
                  <span className="text-gray-600">CDF</span>
                </div>
                {rejectForm.penaltyAmount > 0 && (
                  <p className="text-sm text-yellow-700 mt-2">
                    Une facture de pénalité sera créée pour ce patient
                  </p>
                )}
              </div>

              {/* Reschedule */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarX className="h-5 w-5 text-blue-600" />
                  <label className="font-medium text-gray-700">
                    Nouvelle date
                  </label>
                </div>
                <input
                  type="datetime-local"
                  value={rejectForm.rescheduledTo}
                  onChange={(e) => setRejectForm(prev => ({
                    ...prev,
                    rescheduledTo: e.target.value
                  }))}
                  className="input w-full"
                />
                <textarea
                  value={rejectForm.rescheduledNotes}
                  onChange={(e) => setRejectForm(prev => ({
                    ...prev,
                    rescheduledNotes: e.target.value
                  }))}
                  className="input w-full mt-2"
                  rows="2"
                  placeholder="Instructions pour le prochain RDV..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setRejectModal(false); setSelectedOrder(null); }}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectForm.reason}
                className="btn btn-danger flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                Confirmer Rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabCheckIn;
