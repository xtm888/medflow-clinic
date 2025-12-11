import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/apiConfig';
import ConfirmationModal from '../components/ConfirmationModal';
import FaceVerification from '../components/biometric/FaceVerification';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Printer,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Hospital,
  X
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const IVTDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [injection, setInjection] = useState(null);
  const [treatmentHistory, setTreatmentHistory] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [followUpDialog, setFollowUpDialog] = useState(false);
  const [followUpData, setFollowUpData] = useState({
    date: new Date().toISOString().split('T')[0],
    visualAcuity: '',
    iop: '',
    cmt: '',
    clinicalFindings: '',
    complications: '',
    nextInjectionDate: ''
  });

  // Face verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  useEffect(() => {
    fetchInjection();
    fetchTreatmentHistory();
  }, [id]);

  // Face verification check when injection data loads
  useEffect(() => {
    if (!injection || !injection.patient) return;

    const isDoctorRole = user?.role === 'doctor' || user?.role === 'ophthalmologist' || user?.role === 'admin';

    if (isDoctorRole && injection.patient?.biometric?.faceEncoding) {
      const sessionKey = `faceVerified_${injection.patient._id}`;
      const alreadyVerified = sessionStorage.getItem(sessionKey);

      if (alreadyVerified === 'true') {
        setVerificationPassed(true);
      } else {
        setShowVerification(true);
        setVerificationPassed(false);
      }
    } else {
      // Skip verification if not doctor role or patient has no biometric
      setVerificationPassed(true);
    }
  }, [injection, user]);

  const fetchInjection = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/ivt/${id}`);
      setInjection(response.data);
      setLoading(false);
    } catch (err) {
      setError('Erreur lors du chargement de l\'injection');
      setLoading(false);
    }
  };

  const fetchTreatmentHistory = async () => {
    try {
      if (!injection) return;

      const response = await api.get(`/ivt/patient/${injection.patient._id}/history`, {
        params: { eye: injection.eye }
      });
      setTreatmentHistory(response.data);
    } catch (err) {
      console.error('Error fetching treatment history:', err);
    }
  };

  const handleDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer cette injection?',
      message: 'Êtes-vous sûr de vouloir supprimer cette injection IVT? Cette action est irréversible.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/ivt/${id}`);
          navigate('/ivt');
        } catch (err) {
          setError('Erreur lors de la suppression');
        }
      }
    });
  };

  const handleFollowUpSubmit = async () => {
    try {
      await api.post(`/ivt/${id}/follow-up`, followUpData);
      setFollowUpDialog(false);
      fetchInjection();
      setFollowUpData({
        date: new Date().toISOString().split('T')[0],
        visualAcuity: '',
        iop: '',
        cmt: '',
        clinicalFindings: '',
        complications: '',
        nextInjectionDate: ''
      });
    } catch (err) {
      setError('Erreur lors de l\'enregistrement du suivi');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'badge-success',
      'planned': 'badge-info',
      'cancelled': 'badge-danger',
      'in-progress': 'badge-warning'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'completed': 'Complétée',
      'planned': 'Planifiée',
      'cancelled': 'Annulée',
      'in-progress': 'En cours'
    };
    return labels[status] || status;
  };

  const getIndicationLabel = (indication) => {
    const labels = {
      'wet-amd': 'DMLA humide',
      'dme': 'OMD',
      'brvo': 'OVCR',
      'crvo': 'OVRC',
      'cnv': 'NVC',
      'dmo': 'OM',
      'pdr': 'RDP'
    };
    return labels[indication] || indication;
  };

  // Prepare chart data
  const prepareVAChartData = () => {
    if (!treatmentHistory || treatmentHistory.length === 0) return [];

    return treatmentHistory
      .filter(t => t.preInjection?.visualAcuity?.value)
      .map((t, index) => ({
        date: new Date(t.injectionDate).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        injection: index + 1,
        va: parseFloat(t.preInjection.visualAcuity.value) || 0,
        followUpVA: t.followUp?.visualAcuity ? parseFloat(t.followUp.visualAcuity) : null
      }));
  };

  const prepareCMTChartData = () => {
    if (!treatmentHistory || treatmentHistory.length === 0) return [];

    return treatmentHistory
      .filter(t => t.preInjection?.oct?.cmt)
      .map((t, index) => ({
        date: new Date(t.injectionDate).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        injection: index + 1,
        cmt: parseInt(t.preInjection.oct.cmt) || 0,
        followUpCMT: t.followUp?.cmt ? parseInt(t.followUp.cmt) : null
      }));
  };

  const prepareIOPChartData = () => {
    if (!treatmentHistory || treatmentHistory.length === 0) return [];

    return treatmentHistory
      .filter(t => t.preInjection?.iop || t.procedure?.postInjection?.iop)
      .map((t, index) => ({
        date: new Date(t.injectionDate).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        injection: index + 1,
        preIOP: parseFloat(t.preInjection?.iop) || 0,
        postIOP: parseFloat(t.procedure?.postInjection?.iop) || 0
      }));
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Patient Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-600 flex items-center mb-4">
          <Hospital className="h-5 w-5 mr-2" />
          Informations du patient
        </h3>
        <hr className="mb-4 border-gray-200" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Patient</p>
            <p className="text-base text-gray-900">
              {injection.patient?.firstName} {injection.patient?.lastName}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date de naissance</p>
            <p className="text-base text-gray-900">
              {injection.patient?.dateOfBirth
                ? new Date(injection.patient.dateOfBirth).toLocaleDateString('fr-FR')
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Œil</p>
            <span className="badge badge-info">{injection.eye}</span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Indication</p>
            <p className="text-base text-gray-900">{getIndicationLabel(injection.indication)}</p>
          </div>
        </div>
      </div>

      {/* Injection Details */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-600 mb-4">
          Détails de l'injection
        </h3>
        <hr className="mb-4 border-gray-200" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="text-base text-gray-900">
              {new Date(injection.injectionDate).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Statut</p>
            <span className={`badge ${getStatusColor(injection.status)}`}>
              {getStatusLabel(injection.status)}
            </span>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-500">Médicament</p>
            <p className="text-base text-gray-900">
              {injection.medication?.name} ({injection.medication?.dose})
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Protocole</p>
            <p className="text-base text-gray-900">{injection.series?.protocol || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Injection n°</p>
            <p className="text-base text-gray-900">
              {injection.series?.injectionNumberInSeries} / Série {injection.series?.seriesNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Pre-Injection Assessment */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-600 flex items-center mb-4">
          <Eye className="h-5 w-5 mr-2" />
          Évaluation pré-injection
        </h3>
        <hr className="mb-4 border-gray-200" />
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Acuité visuelle</p>
            <p className="text-lg font-semibold text-gray-900">
              {injection.preInjection?.visualAcuity?.value || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              {injection.preInjection?.visualAcuity?.method}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">PIO</p>
            <p className="text-lg font-semibold text-gray-900">
              {injection.preInjection?.iop ? `${injection.preInjection.iop} mmHg` : 'N/A'}
            </p>
          </div>
          {injection.preInjection?.oct?.performed && (
            <div>
              <p className="text-sm text-gray-500">CMT (OCT)</p>
              <p className="text-lg font-semibold text-gray-900">
                {injection.preInjection.oct.cmt} μm
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Procedure Details */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-600 mb-4">
          Détails de la procédure
        </h3>
        <hr className="mb-4 border-gray-200" />
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Anesthésie</p>
            <p className="text-base text-gray-900">
              {injection.procedure?.anesthesia?.type || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Site d'injection</p>
            <p className="text-base text-gray-900">
              {injection.procedure?.injection?.site || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Distance du limbe</p>
            <p className="text-base text-gray-900">
              {injection.procedure?.injection?.distanceFromLimbus || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">PIO post-injection</p>
            <p className="text-lg font-semibold text-gray-900">
              {injection.procedure?.postInjection?.iop
                ? `${injection.procedure.postInjection.iop} mmHg`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Complications */}
      <div className={`card ${injection.complications?.length > 0 ? 'bg-orange-50' : ''}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center ${
          injection.complications?.length > 0 ? 'text-red-600' : 'text-primary-600'
        }`}>
          <AlertTriangle className="h-5 w-5 mr-2" />
          Complications
        </h3>
        <hr className="mb-4 border-gray-200" />
        {injection.complications && injection.complications.length > 0 ? (
          <div className="space-y-2">
            {injection.complications.map((comp, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-900">
                  {comp.type}
                </p>
                <span className={`badge badge-danger mt-1`}>
                  {comp.severity}
                </span>
                {comp.notes && (
                  <p className="text-xs text-gray-600 mt-2">
                    {comp.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Aucune complication signalée
            </p>
          </div>
        )}
      </div>

      {/* Clinical Findings */}
      {injection.preInjection?.clinicalFindings && (
        <div className="card col-span-full">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">
            Observations cliniques
          </h3>
          <hr className="mb-4 border-gray-200" />
          <p className="text-base text-gray-900">
            {injection.preInjection.clinicalFindings}
          </p>
        </div>
      )}

      {/* Follow-up Information */}
      {injection.followUp && (
        <div className="card col-span-full">
          <h3 className="text-lg font-semibold text-primary-600 flex items-center mb-4">
            <Clock className="h-5 w-5 mr-2" />
            Suivi
          </h3>
          <hr className="mb-4 border-gray-200" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {injection.followUp.nextVisitDate && (
              <div>
                <p className="text-sm text-gray-500">Prochaine visite</p>
                <p className="text-base text-gray-900">
                  {new Date(injection.followUp.nextVisitDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
            {injection.followUp.nextInjectionPlanned && injection.followUp.nextInjectionDate && (
              <div>
                <p className="text-sm text-gray-500">Prochaine injection</p>
                <p className="text-base text-gray-900">
                  {new Date(injection.followUp.nextInjectionDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
            {injection.followUp.instructions && (
              <div className="md:col-span-3">
                <p className="text-sm text-gray-500">Instructions</p>
                <p className="text-base text-gray-900">
                  {injection.followUp.instructions}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderCharts = () => {
    const vaData = prepareVAChartData();
    const cmtData = prepareCMTChartData();
    const iopData = prepareIOPChartData();

    return (
      <div className="space-y-6">
        {/* Visual Acuity Chart */}
        {vaData.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 flex items-center mb-4">
              <BarChart3 className="h-5 w-5 mr-2" />
              Évolution de l'acuité visuelle
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="va"
                  stroke="#1976d2"
                  name="AV pré-injection"
                  strokeWidth={2}
                />
                {vaData.some(d => d.followUpVA !== null) && (
                  <Line
                    type="monotone"
                    dataKey="followUpVA"
                    stroke="#2e7d32"
                    name="AV suivi"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* CMT Chart */}
        {cmtData.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 mb-4">
              Évolution du CMT (OCT)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cmtData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'μm', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cmt"
                  stroke="#ed6c02"
                  name="CMT pré-injection"
                  strokeWidth={2}
                />
                {cmtData.some(d => d.followUpCMT !== null) && (
                  <Line
                    type="monotone"
                    dataKey="followUpCMT"
                    stroke="#2e7d32"
                    name="CMT suivi"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* IOP Chart */}
        {iopData.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-primary-600 mb-4">
              Évolution de la PIO
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={iopData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'mmHg', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="preIOP" fill="#1976d2" name="PIO pré-injection" />
                <Bar dataKey="postIOP" fill="#9c27b0" name="PIO post-injection" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Treatment Summary Stats */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">
            Résumé du traitement
          </h3>
          <hr className="mb-4 border-gray-200" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary-600">
                {treatmentHistory.length}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Total d'injections
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary-600">
                {injection.series?.seriesNumber || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Séries de traitement
              </p>
            </div>
            <div className="text-center">
              <p className={`text-4xl font-bold ${
                treatmentHistory.filter(t => t.complications?.length > 0).length > 0
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}>
                {treatmentHistory.filter(t => t.complications?.length > 0).length}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Complications
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-600">
                {injection.medication?.type === 'anti-VEGF' ? 'Anti-VEGF' : 'Stéroïde'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Type de traitement
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = () => (
    <div className="card p-0">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-primary-600 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Historique des injections - {injection.eye}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médicament</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AV pré</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIO pré</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CMT</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Complications</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {treatmentHistory.map((item) => (
              <tr
                key={item._id}
                className={`cursor-pointer transition-colors ${
                  item._id === injection._id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => navigate(`/ivt/${item._id}`)}
              >
                <td className="px-6 py-4 text-sm text-gray-900">
                  {new Date(item.injectionDate).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{item.medication?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{item.preInjection?.visualAcuity?.value || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {item.preInjection?.iop ? `${item.preInjection.iop} mmHg` : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {item.preInjection?.oct?.cmt ? `${item.preInjection.oct.cmt} μm` : '-'}
                </td>
                <td className="px-6 py-4">
                  {item.complications?.length > 0 ? (
                    <span className="badge badge-danger">{item.complications.length}</span>
                  ) : (
                    <span className="badge badge-success">0</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${getStatusColor(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Show face verification modal
  if (showVerification && injection?.patient) {
    return (
      <FaceVerification
        patient={injection.patient}
        onVerified={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${injection.patient._id}`, 'true');
        }}
        onSkip={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${injection.patient._id}`, 'true');
        }}
        onCancel={() => navigate(-1)}
        allowSkip={user?.role === 'admin'}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !injection) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Injection non trouvée'}
        </div>
      </div>
    );
  }

  // Block content until verification passed
  if (!verificationPassed) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/ivt')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Injection IVT - {injection.eye}
            </h1>
            <p className="text-sm text-gray-500">
              {injection.patient?.firstName} {injection.patient?.lastName} - {' '}
              {new Date(injection.injectionDate).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFollowUpDialog(true)}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Clock className="h-5 w-5" />
            <span>Ajouter suivi</span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Printer className="h-5 w-5" />
            <span>Imprimer</span>
          </button>
          <button
            onClick={() => navigate(`/ivt/edit/${id}`)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Edit className="h-5 w-5" />
            <span>Modifier</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-0">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setTabValue(0)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 0
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vue d'ensemble
            </button>
            <button
              onClick={() => setTabValue(1)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 1
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Graphiques
            </button>
            <button
              onClick={() => setTabValue(2)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 2
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Historique
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {tabValue === 0 && renderOverview()}
      {tabValue === 1 && renderCharts()}
      {tabValue === 2 && renderTimeline()}

      {/* Follow-up Dialog */}
      {followUpDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Enregistrer un suivi</h2>
              <button
                onClick={() => setFollowUpDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date du suivi</label>
                  <input
                    type="date"
                    className="input"
                    value={followUpData.date}
                    onChange={(e) => setFollowUpData({ ...followUpData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acuité visuelle</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: 20/40"
                    value={followUpData.visualAcuity}
                    onChange={(e) => setFollowUpData({ ...followUpData, visualAcuity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIO (mmHg)</label>
                  <input
                    type="number"
                    className="input"
                    value={followUpData.iop}
                    onChange={(e) => setFollowUpData({ ...followUpData, iop: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CMT (μm)</label>
                  <input
                    type="number"
                    className="input"
                    value={followUpData.cmt}
                    onChange={(e) => setFollowUpData({ ...followUpData, cmt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prochaine injection</label>
                  <input
                    type="date"
                    className="input"
                    value={followUpData.nextInjectionDate}
                    onChange={(e) => setFollowUpData({ ...followUpData, nextInjectionDate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observations cliniques</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={followUpData.clinicalFindings}
                    onChange={(e) => setFollowUpData({ ...followUpData, clinicalFindings: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complications</label>
                  <textarea
                    className="input"
                    rows="2"
                    value={followUpData.complications}
                    onChange={(e) => setFollowUpData({ ...followUpData, complications: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setFollowUpDialog(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleFollowUpSubmit}
                className="btn btn-primary"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

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
};

export default IVTDetail;
