import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardCheck, Eye, Glasses, User, CheckCircle, XCircle,
  AlertTriangle, ChevronRight, ArrowLeft, Clock, FileText,
  Ruler, Package, DollarSign
} from 'lucide-react';
import { toast } from 'react-toastify';
import opticalShopService from '../../services/opticalShopService';

// Verification Queue List
const VerificationQueue = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async (page = 1) => {
    try {
      setLoading(true);
      const response = await opticalShopService.getVerificationQueue({ page, limit: 20 });
      if (response.success) {
        setOrders(response.data);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error loading queue:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

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
          <div className="p-3 bg-orange-100 rounded-xl">
            <ClipboardCheck className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verification Technique</h1>
            <p className="text-gray-500">{pagination.total} commande(s) en attente</p>
          </div>
        </div>
      </div>

      {/* Queue List */}
      {orders.length > 0 ? (
        <div className="bg-white rounded-xl border shadow-sm divide-y">
          {orders.map((order) => (
            <div
              key={order._id}
              className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => navigate(`/optical-shop/verification/${order._id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    order.urgency === 'urgent' ? 'bg-red-100' :
                    order.urgency === 'rush' ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    <Glasses className={`w-5 h-5 ${
                      order.urgency === 'urgent' ? 'text-red-600' :
                      order.urgency === 'rush' ? 'text-orange-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {order.orderNumber} | Par: {order.opticalShop?.optician?.firstName} {order.opticalShop?.optician?.lastName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {formatDate(order.opticalShop?.verification?.submittedAt || order.createdAt)}
                    </p>
                    {order.urgency && order.urgency !== 'normal' && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {order.urgency === 'urgent' ? 'URGENT' : 'Express'}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Quick Preview */}
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>OD: {order.rightLens?.sphere || '-'} / OS: {order.leftLens?.sphere || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Glasses className="w-4 h-4" />
                  <span>{order.frame?.brand || 'Monture'} {order.frame?.model || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  <span>PD: {order.measurements?.pd || '-'} mm</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune commande en attente
          </h2>
          <p className="text-gray-500">
            Toutes les commandes ont ete verifiees
          </p>
        </div>
      )}
    </div>
  );
};

// Verification Detail
const VerificationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [originalPrescription, setOriginalPrescription] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [checklist, setChecklist] = useState({
    prescriptionCorrect: { checked: false, notes: '' },
    measurementsCorrect: { checked: false, notes: '' },
    frameCompatible: { checked: false, notes: '' },
    lensTypeAppropriate: { checked: false, notes: '' },
    coatingsValid: { checked: false, notes: '' },
    pricingCorrect: { checked: false, notes: '' }
  });

  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const response = await opticalShopService.getOrderForVerification(id);
      if (response.success) {
        setOrder(response.data.order);
        setOriginalPrescription(response.data.originalPrescription);
      }
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Erreur lors du chargement');
      navigate('/optical-shop/verification');
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = (key) => {
    setChecklist(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked }
    }));
  };

  const updateChecklistNotes = (key, notes) => {
    setChecklist(prev => ({
      ...prev,
      [key]: { ...prev[key], notes }
    }));
  };

  const allChecked = Object.values(checklist).every(item => item.checked);

  const handleApprove = async () => {
    if (!allChecked) {
      toast.error('Veuillez verifier tous les points de controle');
      return;
    }

    try {
      setSubmitting(true);
      const response = await opticalShopService.approveVerification(id, {
        checklist,
        notes: ''
      });
      if (response.success) {
        toast.success('Commande approuvee');
        navigate('/optical-shop/verification');
      }
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Erreur lors de l\'approbation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez indiquer la raison du rejet');
      return;
    }

    try {
      setSubmitting(true);
      const response = await opticalShopService.rejectVerification(id, {
        reason: rejectionReason,
        checklist
      });
      if (response.success) {
        toast.success('Commande rejetee - L\'opticien sera notifie');
        navigate('/optical-shop/verification');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Erreur lors du rejet');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/optical-shop/verification')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Verification - {order.orderNumber}
            </h1>
            <p className="text-gray-500">
              Par {order.opticalShop?.opticianName}
            </p>
          </div>
        </div>
        {order.urgency && order.urgency !== 'normal' && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            order.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {order.urgency === 'urgent' ? 'URGENT' : 'Express'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gray-100 rounded-full">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {order.patient?.firstName} {order.patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  Dossier: {order.patient?.fileNumber} | Tel: {order.patient?.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Prescription Comparison */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Prescription
            </h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Order Values */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-700 mb-3">Valeurs Commande</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left"></th>
                      <th>Sph</th>
                      <th>Cyl</th>
                      <th>Axe</th>
                      <th>Add</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-medium">OD</td>
                      <td className="text-center">{order.rightLens?.sphere || '-'}</td>
                      <td className="text-center">{order.rightLens?.cylinder || '-'}</td>
                      <td className="text-center">{order.rightLens?.axis || '-'}</td>
                      <td className="text-center">{order.rightLens?.add || '-'}</td>
                    </tr>
                    <tr>
                      <td className="font-medium">OS</td>
                      <td className="text-center">{order.leftLens?.sphere || '-'}</td>
                      <td className="text-center">{order.leftLens?.cylinder || '-'}</td>
                      <td className="text-center">{order.leftLens?.axis || '-'}</td>
                      <td className="text-center">{order.leftLens?.add || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Original Prescription (if available) */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-700 mb-3">Prescription Originale</h3>
                {originalPrescription ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left"></th>
                        <th>Sph</th>
                        <th>Cyl</th>
                        <th>Axe</th>
                        <th>Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-medium">OD</td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OD?.sphere ||
                           originalPrescription.glasses?.rightEye?.sphere || '-'}
                        </td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OD?.cylinder ||
                           originalPrescription.glasses?.rightEye?.cylinder || '-'}
                        </td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OD?.axis ||
                           originalPrescription.glasses?.rightEye?.axis || '-'}
                        </td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OD?.add ||
                           originalPrescription.glasses?.rightEye?.add || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="font-medium">OS</td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OS?.sphere ||
                           originalPrescription.glasses?.leftEye?.sphere || '-'}
                        </td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OS?.cylinder ||
                           originalPrescription.glasses?.leftEye?.cylinder || '-'}
                        </td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OS?.axis ||
                           originalPrescription.glasses?.leftEye?.axis || '-'}
                        </td>
                        <td className="text-center">
                          {originalPrescription.refraction?.subjective?.OS?.add ||
                           originalPrescription.glasses?.leftEye?.add || '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">Prescription originale non disponible</p>
                )}
              </div>
            </div>

            {/* Measurements */}
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-medium text-gray-700 mb-2">Mesures</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">PD Total:</span>
                  <span className="ml-2 font-medium">{order.measurements?.pd || '-'} mm</span>
                </div>
                <div>
                  <span className="text-gray-500">PD OD:</span>
                  <span className="ml-2 font-medium">{order.measurements?.pdRight || '-'} mm</span>
                </div>
                <div>
                  <span className="text-gray-500">PD OS:</span>
                  <span className="ml-2 font-medium">{order.measurements?.pdLeft || '-'} mm</span>
                </div>
                <div>
                  <span className="text-gray-500">Hauteur:</span>
                  <span className="ml-2 font-medium">{order.measurements?.segmentHeight || '-'} mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Frame & Lenses */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Glasses className="w-5 h-5" />
              Monture & Verres
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-700 mb-2">Monture</h3>
                <p className="font-medium text-gray-900">
                  {order.frame?.brand} {order.frame?.model}
                </p>
                <p className="text-sm text-gray-500">
                  {order.frame?.color} | {order.frame?.size}
                </p>
                <p className="text-purple-600 font-medium mt-2">
                  {formatCurrency(order.frame?.price)}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-700 mb-2">Verres</h3>
                <p className="font-medium text-gray-900">
                  {order.lensType?.design === 'progressive' ? 'Progressif' :
                   order.lensType?.design === 'bifocal' ? 'Bifocal' : 'Unifocal'}
                </p>
                <p className="text-sm text-gray-500">
                  Materiau: {order.lensType?.material || 'CR-39'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {order.lensOptions?.antiReflective?.selected && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Anti-Reflet</span>
                  )}
                  {order.lensOptions?.photochromic?.selected && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Photochromique</span>
                  )}
                  {order.lensOptions?.blueLight?.selected && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Lumiere Bleue</span>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total</span>
                <span className="text-xl font-bold text-purple-600">
                  {formatCurrency(order.pricing?.finalTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Checklist */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Points de Controle
            </h2>

            <div className="space-y-4">
              {[
                { key: 'prescriptionCorrect', label: 'Prescription correcte', desc: 'Les valeurs correspondent a l\'ordonnance' },
                { key: 'measurementsCorrect', label: 'Mesures correctes', desc: 'PD et hauteur sont corrects' },
                { key: 'frameCompatible', label: 'Monture compatible', desc: 'La monture convient aux verres' },
                { key: 'lensTypeAppropriate', label: 'Type de verre adapte', desc: 'Materiau et design appropries' },
                { key: 'coatingsValid', label: 'Traitements valides', desc: 'Options et traitements corrects' },
                { key: 'pricingCorrect', label: 'Tarification correcte', desc: 'Prix et remises corrects' }
              ].map((item) => (
                <div key={item.key} className="border rounded-lg p-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleChecklistItem(item.key)}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      checklist[item.key].checked
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300'
                    }`}>
                      {checklist[item.key].checked && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Notes (optionnel)..."
                    value={checklist[item.key].notes}
                    onChange={(e) => updateChecklistNotes(item.key, e.target.value)}
                    className="mt-2 w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Progression</span>
                <span className="font-medium">
                  {Object.values(checklist).filter(c => c.checked).length} / 6
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 rounded-full h-2 transition-all"
                  style={{
                    width: `${(Object.values(checklist).filter(c => c.checked).length / 6) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Rejection Reason */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-3">Raison du rejet (si applicable)</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Expliquez pourquoi cette commande est rejetee..."
              rows="3"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleApprove}
              disabled={!allChecked || submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              {submitting ? 'Traitement...' : 'Approuver la Commande'}
            </button>

            <button
              onClick={handleReject}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
              {submitting ? 'Traitement...' : 'Rejeter la Commande'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component that routes between queue and detail
const TechnicianVerification = () => {
  const { id } = useParams();
  return id ? <VerificationDetail /> : <VerificationQueue />;
};

export default TechnicianVerification;
