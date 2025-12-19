/**
 * VisitDetail - Read-only view of a completed/historical visit
 * Shows all data recorded during the visit without editing capabilities
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  User,
  Stethoscope,
  Eye,
  FileText,
  Pill,
  FlaskConical,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  Printer,
  Edit,
  FileDown,
  Loader2
} from 'lucide-react';
import visitService from '../../services/visitService';
import { useAuth } from '../../contexts/AuthContext';

export default function VisitDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadVisit();
  }, [id]);

  const handleGenerateFiche = async () => {
    try {
      setGeneratingPDF(true);
      await visitService.generateFicheOphtalmologiePDF(id);
    } catch (err) {
      console.error('Error generating fiche PDF:', err);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const loadVisit = async () => {
    try {
      setLoading(true);
      const response = await visitService.getVisit(id);
      const data = response?.data || response;
      setVisit(data);
    } catch (err) {
      console.error('Error loading visit:', err);
      setError('Erreur lors du chargement de la visite');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'in-progress': { label: 'En cours', color: 'bg-blue-100 text-blue-800', icon: Clock },
      'completed': { label: 'Termine', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'cancelled': { label: 'Annule', color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };
    const config = statusConfig[status] || statusConfig['in-progress'];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800">{error || 'Visite non trouvee'}</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-red-600 hover:text-red-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const patient = visit.patient || {};
  const provider = visit.provider || visit.createdBy || {};

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {visit.visitType === 'consultation' ? 'Consultation' : visit.visitType || 'Visite'}
            </h1>
            <p className="text-gray-500 flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {formatDate(visit.visitDate || visit.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(visit.status)}
            {visit.status !== 'completed' && (user?.role === 'admin' || user?.role === 'doctor') && (
              <button
                onClick={() => navigate(`/visits/${visit._id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                Continuer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Patient & Provider Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Patient</p>
              <p className="font-semibold text-gray-900">
                {patient.firstName} {patient.lastName}
              </p>
              {patient.patientId && (
                <p className="text-xs text-gray-400">ID: {patient.patientId}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Praticien</p>
              <p className="font-semibold text-gray-900">
                {provider.firstName} {provider.lastName}
              </p>
              {provider.role && (
                <p className="text-xs text-gray-400 capitalize">{provider.role}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chief Complaint / Reason */}
      {(visit.chiefComplaint || visit.reason) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-orange-600" />
            Motif de consultation
          </h3>
          {/* Handle chiefComplaint as object or string */}
          {typeof visit.chiefComplaint === 'object' ? (
            <div className="space-y-2">
              {visit.chiefComplaint.complaint && (
                <p className="text-gray-700 font-medium">{visit.chiefComplaint.complaint}</p>
              )}
              {visit.chiefComplaint.duration && (
                <p className="text-sm text-gray-600">Durée: {visit.chiefComplaint.duration}</p>
              )}
              {visit.chiefComplaint.severity && (
                <p className="text-sm text-gray-600">Sévérité: {visit.chiefComplaint.severity}</p>
              )}
              {visit.chiefComplaint.associatedSymptoms && visit.chiefComplaint.associatedSymptoms.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Symptômes associés:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {visit.chiefComplaint.associatedSymptoms.map((symptom, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {visit.chiefComplaint.notes && (
                <p className="text-sm text-gray-600 mt-2">{visit.chiefComplaint.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">
              {visit.chiefComplaint || visit.reason}
            </p>
          )}
          {visit.duration && typeof visit.chiefComplaint !== 'object' && (
            <p className="text-sm text-gray-500 mt-2">Durée: {visit.duration}</p>
          )}
        </div>
      )}

      {/* Vital Signs */}
      {visit.vitalSigns && Object.keys(visit.vitalSigns).some(k => visit.vitalSigns[k]) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-red-600" />
            Signes vitaux
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visit.vitalSigns.bloodPressure && (
              <div>
                <p className="text-sm text-gray-500">Tension arterielle</p>
                <p className="font-semibold">{visit.vitalSigns.bloodPressure} mmHg</p>
              </div>
            )}
            {visit.vitalSigns.heartRate && (
              <div>
                <p className="text-sm text-gray-500">Frequence cardiaque</p>
                <p className="font-semibold">{visit.vitalSigns.heartRate} bpm</p>
              </div>
            )}
            {visit.vitalSigns.temperature && (
              <div>
                <p className="text-sm text-gray-500">Temperature</p>
                <p className="font-semibold">{visit.vitalSigns.temperature} C</p>
              </div>
            )}
            {visit.vitalSigns.weight && (
              <div>
                <p className="text-sm text-gray-500">Poids</p>
                <p className="font-semibold">{visit.vitalSigns.weight} kg</p>
              </div>
            )}
            {visit.vitalSigns.height && (
              <div>
                <p className="text-sm text-gray-500">Taille</p>
                <p className="font-semibold">{visit.vitalSigns.height} cm</p>
              </div>
            )}
            {visit.vitalSigns.oxygenSaturation && (
              <div>
                <p className="text-sm text-gray-500">SpO2</p>
                <p className="font-semibold">{visit.vitalSigns.oxygenSaturation}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Acuity (Ophthalmology) */}
      {visit.visualAcuity && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-purple-600" />
            Acuite visuelle
          </h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Right Eye */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Oeil droit (OD)</h4>
              <div className="space-y-1 text-sm">
                {visit.visualAcuity.rightEye?.uncorrected && (
                  <p>Sans correction: <span className="font-semibold">{visit.visualAcuity.rightEye.uncorrected}</span></p>
                )}
                {visit.visualAcuity.rightEye?.corrected && (
                  <p>Avec correction: <span className="font-semibold">{visit.visualAcuity.rightEye.corrected}</span></p>
                )}
              </div>
            </div>
            {/* Left Eye */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Oeil gauche (OG)</h4>
              <div className="space-y-1 text-sm">
                {visit.visualAcuity.leftEye?.uncorrected && (
                  <p>Sans correction: <span className="font-semibold">{visit.visualAcuity.leftEye.uncorrected}</span></p>
                )}
                {visit.visualAcuity.leftEye?.corrected && (
                  <p>Avec correction: <span className="font-semibold">{visit.visualAcuity.leftEye.corrected}</span></p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refraction */}
      {visit.refraction && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-indigo-600" />
            Refraction
          </h3>
          <div className="grid grid-cols-2 gap-6">
            {['rightEye', 'leftEye'].map((eye) => (
              visit.refraction[eye] && (
                <div key={eye}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {eye === 'rightEye' ? 'Oeil droit (OD)' : 'Oeil gauche (OG)'}
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {visit.refraction[eye].sphere !== undefined && (
                      <div>
                        <p className="text-gray-500">Sphere</p>
                        <p className="font-semibold">{visit.refraction[eye].sphere > 0 ? '+' : ''}{visit.refraction[eye].sphere}</p>
                      </div>
                    )}
                    {visit.refraction[eye].cylinder !== undefined && (
                      <div>
                        <p className="text-gray-500">Cylindre</p>
                        <p className="font-semibold">{visit.refraction[eye].cylinder > 0 ? '+' : ''}{visit.refraction[eye].cylinder}</p>
                      </div>
                    )}
                    {visit.refraction[eye].axis !== undefined && (
                      <div>
                        <p className="text-gray-500">Axe</p>
                        <p className="font-semibold">{visit.refraction[eye].axis}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Diagnosis */}
      {visit.diagnosis && visit.diagnosis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-teal-600" />
            Diagnostic
          </h3>
          <ul className="space-y-2">
            {visit.diagnosis.map((diag, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 mt-2 flex-shrink-0"></span>
                <div>
                  <p className="font-medium text-gray-900">
                    {typeof diag === 'string' ? diag : (diag.name || diag.description || diag.code || 'Diagnostic')}
                  </p>
                  {diag.icdCode && <p className="text-sm text-gray-500">Code: {diag.icdCode}</p>}
                  {diag.code && !diag.icdCode && <p className="text-sm text-gray-500">Code: {diag.code}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {visit.notes && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-gray-600" />
            Notes
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">
            {typeof visit.notes === 'string' ? visit.notes : JSON.stringify(visit.notes, null, 2)}
          </p>
        </div>
      )}

      {/* Prescriptions */}
      {visit.prescriptions && visit.prescriptions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-pink-600" />
            Ordonnances ({visit.prescriptions.length})
          </h3>
          <div className="space-y-4">
            {visit.prescriptions.map((rx, idx) => (
              <div key={rx._id || idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Prescription header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {rx.prescriptionId || `Ordonnance #${idx + 1}`}
                    </p>
                    {rx.prescriber && (
                      <p className="text-xs text-gray-500">
                        Par {rx.prescriber.firstName} {rx.prescriber.lastName}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    rx.status === 'dispensed' ? 'bg-green-100 text-green-700' :
                    rx.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rx.status === 'dispensed' ? 'Dispensée' :
                     rx.status === 'active' ? 'Active' : rx.status}
                  </span>
                </div>

                {/* Medications list */}
                {rx.medications && rx.medications.length > 0 ? (
                  <div className="space-y-2">
                    {rx.medications.map((med, medIdx) => {
                      // Format helpers for object fields
                      const formatField = (val) => {
                        if (!val) return null;
                        if (typeof val === 'string') return val;
                        if (typeof val === 'number') return String(val);
                        if (typeof val === 'object') {
                          const parts = [];
                          if (val.amount || val.value) parts.push(val.amount || val.value);
                          if (val.unit) parts.push(val.unit);
                          if (val.label) parts.push(val.label);
                          return parts.length > 0 ? parts.join(' ') : null;
                        }
                        return null;
                      };

                      return (
                        <div key={medIdx} className="pl-3 border-l-2 border-pink-200">
                          <p className="font-medium text-gray-800">
                            {med.drug?.name || med.name || med.medicationName || 'Médicament'}
                          </p>
                          <div className="text-sm text-gray-600 grid grid-cols-2 gap-1">
                            {formatField(med.dosage) && <span>Dose: {formatField(med.dosage)}</span>}
                            {formatField(med.frequency) && <span>Fréquence: {formatField(med.frequency)}</span>}
                            {formatField(med.duration) && <span>Durée: {formatField(med.duration)}</span>}
                            {med.quantity && <span>Qté: {med.quantity} {med.unit || ''}</span>}
                            {med.route && <span>Voie: {med.route}</span>}
                          </div>
                          {med.instructions && (
                            <p className="text-xs text-gray-500 italic mt-1">{med.instructions}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {typeof rx === 'string' ? rx : (rx.medication?.name || rx.medicationName || rx.name || 'Prescription')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lab Orders */}
      {visit.labOrders && visit.labOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <FlaskConical className="w-5 h-5 text-cyan-600" />
            Examens de laboratoire ({visit.labOrders.length})
          </h3>
          <div className="space-y-3">
            {visit.labOrders.map((lab, idx) => (
              <div key={lab._id || idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {lab.orderId || `Commande #${idx + 1}`}
                    </p>
                    {lab.orderedBy && (
                      <p className="text-xs text-gray-500">
                        Par {lab.orderedBy.firstName} {lab.orderedBy.lastName}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    lab.status === 'completed' ? 'bg-green-100 text-green-700' :
                    lab.status === 'received' ? 'bg-blue-100 text-blue-700' :
                    lab.status === 'collected' ? 'bg-purple-100 text-purple-700' :
                    lab.status === 'pending' || lab.status === 'ordered' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {lab.status === 'completed' ? 'Terminé' :
                     lab.status === 'received' ? 'Reçu' :
                     lab.status === 'collected' ? 'Prélevé' :
                     lab.status === 'pending' || lab.status === 'ordered' ? 'En attente' :
                     lab.status || 'En attente'}
                  </span>
                </div>

                {/* Tests list */}
                {lab.tests && lab.tests.length > 0 ? (
                  <div className="space-y-1">
                    {lab.tests.map((test, testIdx) => (
                      <div key={testIdx} className="pl-3 border-l-2 border-cyan-200 py-1">
                        <p className="font-medium text-gray-800">{test.testName || test.name}</p>
                        {test.result && (
                          <p className={`text-sm ${test.isAbnormal ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            Résultat: {test.result} {test.unit || ''}
                            {test.isAbnormal && ' ⚠️'}
                          </p>
                        )}
                        {test.referenceRange && (
                          <p className="text-xs text-gray-500">Réf: {test.referenceRange}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {typeof lab === 'string' ? lab : (lab.testName || lab.name || lab.category || 'Examen')}
                  </p>
                )}

                {lab.notes && (
                  <p className="text-xs text-gray-500 mt-2 italic">{lab.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ophthalmology Exams */}
      {visit.ophthalmologyExams && visit.ophthalmologyExams.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-purple-600" />
            Examens ophtalmologiques ({visit.ophthalmologyExams.length})
          </h3>
          <div className="space-y-3">
            {visit.ophthalmologyExams.map((exam, idx) => (
              <div key={exam._id || idx} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {exam.examType || 'Examen complet'}
                    </p>
                    {exam.examiner && (
                      <p className="text-xs text-gray-500">
                        Par {exam.examiner.firstName} {exam.examiner.lastName}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    exam.status === 'completed' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {exam.status === 'completed' ? 'Terminé' : 'En cours'}
                  </span>
                </div>

                {/* Visual Acuity from exam */}
                {exam.visualAcuity && (
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">OD (Droit)</p>
                      <p className="text-sm">SC: {exam.visualAcuity.rightEye?.uncorrected || 'N/A'}</p>
                      <p className="text-sm">AC: {exam.visualAcuity.rightEye?.corrected || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 font-medium">OG (Gauche)</p>
                      <p className="text-sm">SC: {exam.visualAcuity.leftEye?.uncorrected || 'N/A'}</p>
                      <p className="text-sm">AC: {exam.visualAcuity.leftEye?.corrected || 'N/A'}</p>
                    </div>
                  </div>
                )}

                {/* Diagnoses from exam */}
                {exam.assessment?.diagnoses && exam.assessment.diagnoses.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-purple-600 font-medium mb-1">Diagnostics:</p>
                    <div className="flex flex-wrap gap-1">
                      {exam.assessment.diagnoses.map((diag, dIdx) => (
                        <span key={dIdx} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {typeof diag === 'string' ? diag : (diag.diagnosis || diag.name || diag.code)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-gray-900"
        >
          Retour
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateFiche}
            disabled={generatingPDF}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {generatingPDF ? 'Génération...' : 'Fiche Ophta'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}
