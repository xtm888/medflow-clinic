import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Eye, Activity, AlertTriangle, FileText, Pill, Calendar, Clock,
  ChevronDown, ChevronRight, ArrowLeft, Printer, Image, Plus
} from 'lucide-react';
import patientService from '../services/patientService';
import ophthalmologyService from '../services/ophthalmologyService';
import prescriptionService from '../services/prescriptionService';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PatientSummary() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { toasts, error: showError, removeToast } = useToast();

  const [patient, setPatient] = useState(null);
  const [exams, setExams] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expanded state for each section
  const [expanded, setExpanded] = useState({
    refraction: true,
    tonometry: true,
    pathology: true,
    exams: true,
    treatment: true
  });

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);

      const [patientRes, examsRes, prescriptionsRes, visitsRes] = await Promise.all([
        patientService.getPatient(patientId),
        ophthalmologyService.getPatientExams(patientId, { limit: 20 }).catch(() => ({ data: [] })),
        prescriptionService.getPrescriptions({ patient: patientId, limit: 20 }).catch(() => ({ data: [] })),
        patientService.getPatientVisits(patientId, { limit: 20 }).catch(() => ({ data: [] }))
      ]);

      setPatient(patientRes.data || patientRes);
      setExams(examsRes.data || examsRes || []);
      setPrescriptions(prescriptionsRes.data || prescriptionsRes || []);
      setVisits(visitsRes.data || visitsRes || []);
    } catch (err) {
      console.error('Error loading patient data:', err);
      showError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatRefraction = (data) => {
    if (!data) return '-';
    const sphere = data.sphere ? (data.sphere > 0 ? `+${data.sphere}` : data.sphere) : '0';
    const cylinder = data.cylinder ? ` (${data.cylinder > 0 ? '+' : ''}${data.cylinder} à ${data.axis || 0}°)` : '';
    const va = data.va ? ` =${data.va}` : '';
    const add = data.addition ? `: Add ${data.addition}` : '';
    return `${sphere}${cylinder}${va}${add}`;
  };

  // Calculate patient age
  const getPatientAge = () => {
    if (!patient?.dateOfBirth) return '';
    const today = new Date();
    const birthDate = new Date(patient.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} ans`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Patient non trouvé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Résumé Clinique
            </h1>
            <p className="text-sm text-gray-500">
              {patient.firstName} {patient.lastName} - {getPatientAge()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            onClick={() => navigate(`/visits/new/${patientId}`)}
            className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle consultation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Réfraction Section - Beige */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('refraction')}
              className="w-full px-4 py-3 flex items-center justify-between bg-amber-100 hover:bg-amber-150"
            >
              <div className="flex items-center">
                <Eye className="h-5 w-5 text-amber-700 mr-2" />
                <span className="font-medium text-amber-900">Réfraction</span>
                <span className="ml-2 text-xs text-amber-600">({exams.length} examens)</span>
              </div>
              {expanded.refraction ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expanded.refraction && (
              <div className="p-4 space-y-3">
                {exams.length === 0 ? (
                  <p className="text-sm text-amber-700">Aucune réfraction enregistrée</p>
                ) : (
                  exams.map((exam, index) => (
                    <div key={exam._id || index} className="border-b border-amber-200 pb-3 last:border-0 last:pb-0">
                      <p className="text-xs text-amber-600 mb-1">
                        {formatDate(exam.date || exam.createdAt)}
                      </p>
                      <div className="text-sm text-amber-900">
                        <p><strong>OD</strong> = {formatRefraction(exam.finalPrescription?.OD || exam.subjectiveRefraction?.OD)}</p>
                        <p><strong>OG</strong> = {formatRefraction(exam.finalPrescription?.OS || exam.subjectiveRefraction?.OS)}</p>
                        {exam.finalPrescription?.binocularVA && (
                          <p className="text-xs text-amber-600 mt-1">AB={exam.finalPrescription.binocularVA}</p>
                        )}
                      </div>
                      {exam.prescriptionType && (
                        <p className="text-xs text-amber-700 mt-1 italic">
                          {exam.prescriptionType === 'glasses' ? 'Verres prescrits' :
                           exam.prescriptionType === 'contacts' ? 'Lentilles prescrites' :
                           exam.prescriptionType}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Tonométrie Section - Purple */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('tonometry')}
              className="w-full px-4 py-3 flex items-center justify-between bg-purple-100 hover:bg-purple-150"
            >
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-purple-700 mr-2" />
                <span className="font-medium text-purple-900">Tonométrie</span>
              </div>
              {expanded.tonometry ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expanded.tonometry && (
              <div className="p-4 space-y-3">
                {exams.filter(e => e.iop || e.tonometry).length === 0 ? (
                  <p className="text-sm text-purple-700">Aucune mesure de PIO enregistrée</p>
                ) : (
                  exams
                    .filter(e => e.iop || e.tonometry)
                    .map((exam, index) => {
                      const iop = exam.iop || exam.tonometry || {};
                      return (
                        <div key={exam._id || index} className="flex items-center justify-between border-b border-purple-200 pb-2 last:border-0 last:pb-0">
                          <span className="text-xs text-purple-600">{formatDate(exam.date || exam.createdAt)}</span>
                          <div className="text-sm font-mono">
                            <span className="text-purple-900">TOD = {iop.od || iop.OD || '-'} mmHg</span>
                            <span className="mx-2 text-purple-400">|</span>
                            <span className="text-purple-900">TOG = {iop.og || iop.OS || '-'} mmHg</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          {/* Pathologie Section - Orange */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('pathology')}
              className="w-full px-4 py-3 flex items-center justify-between bg-orange-100 hover:bg-orange-150"
            >
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-700 mr-2" />
                <span className="font-medium text-orange-900">Pathologie</span>
              </div>
              {expanded.pathology ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expanded.pathology && (
              <div className="p-4 space-y-3">
                {/* Diagnoses from visits */}
                {visits.filter(v => v.diagnoses?.length > 0 || v.pathology).length === 0 ? (
                  <p className="text-sm text-orange-700">Aucune pathologie documentée</p>
                ) : (
                  visits
                    .filter(v => v.diagnoses?.length > 0 || v.pathology)
                    .map((visit, index) => (
                      <div key={visit._id || index} className="border-b border-orange-200 pb-3 last:border-0 last:pb-0">
                        <p className="text-xs text-orange-600 mb-1">{formatDate(visit.date || visit.createdAt)}</p>
                        {visit.diagnoses?.map((dx, i) => (
                          <p key={i} className="text-sm text-orange-900">
                            → {typeof dx === 'object' ? dx.description || dx.name : dx}
                            {dx.icdCode && <span className="text-xs text-orange-600 ml-1">({dx.icdCode})</span>}
                          </p>
                        ))}
                        {visit.pathology && typeof visit.pathology === 'string' && (
                          <p className="text-sm text-orange-900">{visit.pathology}</p>
                        )}
                      </div>
                    ))
                )}

                {/* Allergies */}
                {patient.medicalHistory?.allergies?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-orange-200">
                    <p className="text-xs font-medium text-orange-800 mb-1">Allergies:</p>
                    <div className="flex flex-wrap gap-1">
                      {patient.medicalHistory.allergies.map((allergy, i) => (
                        <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                          {typeof allergy === 'object' ? allergy.allergen || allergy.name : allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Examens Section - Blue */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('exams')}
              className="w-full px-4 py-3 flex items-center justify-between bg-blue-100 hover:bg-blue-150"
            >
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-blue-700 mr-2" />
                <span className="font-medium text-blue-900">Examens et Procédures</span>
              </div>
              {expanded.exams ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expanded.exams && (
              <div className="p-4 space-y-2">
                {visits.filter(v => v.clinicalActs?.length > 0).length === 0 ? (
                  <p className="text-sm text-blue-700">Aucun examen complémentaire</p>
                ) : (
                  visits
                    .filter(v => v.clinicalActs?.length > 0)
                    .flatMap(v => v.clinicalActs.map(act => ({ ...act, visitDate: v.date || v.createdAt })))
                    .map((act, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-blue-900">
                          → {typeof act === 'object' ? act.name || act.procedure : act}
                        </span>
                        <span className="text-xs text-blue-600">{formatDate(act.visitDate)}</span>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Traitement Section - Green */}
          <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('treatment')}
              className="w-full px-4 py-3 flex items-center justify-between bg-green-100 hover:bg-green-150"
            >
              <div className="flex items-center">
                <Pill className="h-5 w-5 text-green-700 mr-2" />
                <span className="font-medium text-green-900">Traitements</span>
                <span className="ml-2 text-xs text-green-600">({prescriptions.length})</span>
              </div>
              {expanded.treatment ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expanded.treatment && (
              <div className="p-4 space-y-3">
                {prescriptions.length === 0 ? (
                  <p className="text-sm text-green-700">Aucun traitement prescrit</p>
                ) : (
                  prescriptions.map((rx, index) => (
                    <div key={rx._id || index} className="border-b border-green-200 pb-3 last:border-0 last:pb-0">
                      <p className="text-xs text-green-600 mb-1">{formatDate(rx.date || rx.createdAt)}</p>
                      {rx.medications?.map((med, i) => (
                        <div key={i} className="text-sm text-green-900">
                          <span className="font-medium">
                            {typeof med.drug === 'object' ? med.drug.name : med.drug || med.name}
                          </span>
                          {med.dosage && (
                            <span className="text-green-700 ml-1">
                              - {med.dosage.amount} {med.dosage.unit} {med.dosage.frequency}
                              {med.dosage.duration && ` pendant ${med.dosage.duration}`}
                            </span>
                          )}
                        </div>
                      ))}
                      {rx.status && (
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                          rx.status === 'dispensed' ? 'bg-green-200 text-green-800' :
                          rx.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-gray-200 text-gray-800'
                        }`}>
                          {rx.status === 'dispensed' ? 'Délivré' :
                           rx.status === 'pending' ? 'En attente' :
                           rx.status}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-4">
          {/* Visit History */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                Historique des visites
              </h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {visits.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Aucune visite</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visits.map((visit, index) => (
                      <tr
                        key={visit._id || index}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/visits/${visit._id || visit.id}`)}
                      >
                        <td className="px-3 py-2 text-gray-900">{formatDate(visit.date || visit.createdAt)}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {visit.type || visit.chiefComplaint?.description || 'Consultation'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Images */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 flex items-center">
                <Image className="h-4 w-4 mr-2 text-gray-500" />
                Images importées
              </h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500">Aucune image</p>
              {/* TODO: Load and display device images */}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
            <button
              onClick={() => navigate(`/patients/${patientId}`)}
              className="w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
            >
              Voir dossier complet
            </button>
            <button
              onClick={() => navigate(`/ophthalmology/refraction?patient=${patientId}`)}
              className="w-full px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
            >
              Nouvel examen réfraction
            </button>
            <button
              onClick={() => navigate(`/prescriptions?patient=${patientId}`)}
              className="w-full px-3 py-2 text-sm bg-green-100 hover:bg-green-200 rounded text-green-700"
            >
              Nouvelle ordonnance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
