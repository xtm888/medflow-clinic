import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Eye, Calendar, Stethoscope, Pill, FileText,
  Image, CheckSquare, Square, Loader2, Play, AlertTriangle,
  ClipboardList, Activity, Clock, UserCheck, ChevronDown, ChevronUp, Package
} from 'lucide-react';
import surgeryService from '../../services/surgeryService';
import { useAuth } from '../../contexts/AuthContext';
import CollapsibleSection from '../../components/CollapsibleSection';
import ConfirmationModal from '../../components/ConfirmationModal';
import ConsumablesTracker from './components/ConsumablesTracker';
import OfflineWarningBanner from '../../components/OfflineWarningBanner';

/**
 * SurgeryCheckIn - Surgeon's check-in view with full clinical background
 */
export default function SurgeryCheckIn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [surgeryCase, setSurgeryCase] = useState(null);
  const [clinicalData, setClinicalData] = useState(null);
  const [error, setError] = useState(null);

  // Surgeon selection for check-in
  const [selectedSurgeon, setSelectedSurgeon] = useState('');
  const [surgeons, setSurgeons] = useState([]);

  // Pre-op checklist state
  const [checklist, setChecklist] = useState({
    identityVerified: false,
    siteMarked: false,
    allergiesReviewed: false,
    fastingConfirmed: false,
    eyeDropsAdministered: false,
    pupilDilated: false,
    vitalsSigned: false
  });

  // Modals
  const [startSurgeryModal, setStartSurgeryModal] = useState(false);
  const [checkInModal, setCheckInModal] = useState(false);

  useEffect(() => {
    fetchData();
    fetchSurgeons();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await surgeryService.getClinicalBackground(id);
      setSurgeryCase(response.data.surgeryCase);
      setClinicalData(response.data.clinicalData);

      // Initialize checklist from existing data
      if (response.data.surgeryCase.preOpChecklist) {
        setChecklist(prev => ({
          ...prev,
          ...response.data.surgeryCase.preOpChecklist
        }));
      }
    } catch (err) {
      console.error('Error fetching surgery data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchSurgeons = async () => {
    // In a real app, this would fetch from users API
    // For now, we'll use the current user if they're a surgeon
    if (user?.role === 'ophthalmologist' || user?.role === 'admin') {
      setSurgeons([{ _id: user._id, firstName: user.firstName, lastName: user.lastName }]);
      setSelectedSurgeon(user._id);
    }
  };

  const handleChecklistChange = async (field) => {
    const newChecklist = { ...checklist, [field]: !checklist[field] };
    setChecklist(newChecklist);

    try {
      await surgeryService.updatePreOpChecklist(id, newChecklist);
    } catch (err) {
      console.error('Error updating checklist:', err);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedSurgeon) return;
    try {
      await surgeryService.checkInPatient(id, selectedSurgeon);
      setCheckInModal(false);
      fetchData();
    } catch (err) {
      console.error('Error checking in patient:', err);
    }
  };

  const handleStartSurgery = async () => {
    try {
      await surgeryService.startSurgery(id);
      setStartSurgeryModal(false);
      fetchData();
    } catch (err) {
      console.error('Error starting surgery:', err);
    }
  };

  const allChecklistComplete = Object.values(checklist).every(v => v);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !surgeryCase) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">{error || 'Cas non trouvé'}</p>
        <button
          onClick={() => navigate('/surgery')}
          className="mt-4 btn btn-secondary"
        >
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  const patient = surgeryCase.patient;

  return (
    <div className="space-y-6 pb-20">
      {/* Offline Warning - Surgery requires online for critical operations */}
      <OfflineWarningBanner
        message="Les opérations critiques de chirurgie (check-in, début, complétion) nécessitent une connexion internet."
        isCritical={true}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/surgery')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Check-in Chirurgie
            </h1>
            <p className="text-sm text-gray-500">
              {surgeryCase.surgeryType?.name} - {surgeryCase.eye !== 'N/A' ? surgeryCase.eye : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {surgeryCase.status === 'scheduled' && (
            <button
              onClick={() => setCheckInModal(true)}
              className="btn btn-primary"
            >
              <UserCheck className="h-5 w-5 mr-2" />
              Check-in Patient
            </button>
          )}
          {surgeryCase.status === 'checked_in' && (
            <button
              onClick={() => setStartSurgeryModal(true)}
              className="btn bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!allChecklistComplete}
            >
              <Play className="h-5 w-5 mr-2" />
              Démarrer Chirurgie
            </button>
          )}
          {surgeryCase.status === 'in_surgery' && (
            <button
              onClick={() => navigate(`/surgery/${id}/report`)}
              className="btn btn-primary"
            >
              <ClipboardList className="h-5 w-5 mr-2" />
              Rédiger Rapport
            </button>
          )}
        </div>
      </div>

      {/* Patient Header Card */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-6">
          <div className="bg-purple-100 rounded-full p-4">
            <User className="h-10 w-10 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {patient.firstName} {patient.lastName}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span>{patient.medicalRecordNumber}</span>
              <span>|</span>
              <span>
                {patient.dateOfBirth &&
                  new Date().getFullYear() -
                    new Date(patient.dateOfBirth).getFullYear()}{' '}
                ans
              </span>
              {patient.phone && (
                <>
                  <span>|</span>
                  <span>{patient.phone}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              surgeryCase.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
              surgeryCase.status === 'checked_in' ? 'bg-yellow-100 text-yellow-700' :
              surgeryCase.status === 'in_surgery' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {surgeryCase.status === 'scheduled' && 'Programmée'}
              {surgeryCase.status === 'checked_in' && 'Check-in effectué'}
              {surgeryCase.status === 'in_surgery' && 'En cours'}
            </div>
            {surgeryCase.surgeon && (
              <p className="text-sm text-gray-500 mt-2">
                Dr. {surgeryCase.surgeon.lastName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status specific actions */}
      {surgeryCase.status === 'checked_in' && !allChecklistComplete && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="h-5 w-5" />
            <p>Veuillez compléter la checklist pré-opératoire avant de démarrer la chirurgie</p>
          </div>
        </div>
      )}

      {/* Consumables Tracker - Show when surgery is in progress */}
      {surgeryCase.status === 'in_surgery' && (
        <ConsumablesTracker
          surgeryCase={surgeryCase}
          onUpdate={fetchData}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Clinical Data */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Consultations */}
          <CollapsibleSection
            title="Consultations récentes"
            icon={Stethoscope}
            iconColor="text-blue-600"
            gradient="from-blue-50 to-indigo-50"
            defaultExpanded={true}
          >
            {clinicalData?.recentConsultations?.length > 0 ? (
              <div className="space-y-3">
                {clinicalData.recentConsultations.map((consultation, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {consultation.type || 'Consultation'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {consultation.provider?.firstName} {consultation.provider?.lastName}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(consultation.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {consultation.chiefComplaint && (
                      <p className="text-sm text-gray-600 mt-2">
                        {consultation.chiefComplaint}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucune consultation récente</p>
            )}
          </CollapsibleSection>

          {/* Ophthalmology Exams */}
          <CollapsibleSection
            title="Examens ophtalmologiques"
            icon={Eye}
            iconColor="text-green-600"
            gradient="from-green-50 to-emerald-50"
            defaultExpanded={true}
          >
            {clinicalData?.ophthalmologyExams?.length > 0 ? (
              <div className="space-y-3">
                {clinicalData.ophthalmologyExams.map((exam, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {new Date(exam.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500">OD</p>
                        <p className="text-sm">AV: {exam.visualAcuity?.od?.uncorrected || '-'}</p>
                        {exam.intraocularPressure?.od && (
                          <p className="text-sm">PIO: {exam.intraocularPressure.od} mmHg</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">OS</p>
                        <p className="text-sm">AV: {exam.visualAcuity?.os?.uncorrected || '-'}</p>
                        {exam.intraocularPressure?.os && (
                          <p className="text-sm">PIO: {exam.intraocularPressure.os} mmHg</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucun examen récent</p>
            )}
          </CollapsibleSection>

          {/* Active Prescriptions */}
          <CollapsibleSection
            title="Prescriptions actives"
            icon={Pill}
            iconColor="text-orange-600"
            gradient="from-orange-50 to-amber-50"
            defaultExpanded={true}
          >
            {clinicalData?.activePrescriptions?.length > 0 ? (
              <div className="space-y-2">
                {clinicalData.activePrescriptions.map((rx, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{rx.medicationName}</p>
                        <p className="text-sm text-gray-600">
                          {rx.dosage} - {rx.frequency}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        rx.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucune prescription active</p>
            )}
          </CollapsibleSection>

          {/* Documents & Images */}
          <CollapsibleSection
            title="Documents et imagerie"
            icon={Image}
            iconColor="text-purple-600"
            gradient="from-purple-50 to-pink-50"
            defaultExpanded={true}
          >
            {clinicalData?.documents?.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {clinicalData.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => window.open(doc.url, '_blank')}
                  >
                    {doc.type?.includes('image') || ['oct', 'fundus', 'photo'].includes(doc.type) ? (
                      <div className="aspect-square bg-gray-200 rounded overflow-hidden">
                        <img
                          src={doc.url || doc.thumbnailUrl}
                          alt={doc.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-200 rounded flex items-center justify-center">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {doc.filename || doc.type}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucun document</p>
            )}
          </CollapsibleSection>

          {/* Previous Surgeries */}
          {clinicalData?.previousSurgeries?.length > 0 && (
            <CollapsibleSection
              title="Chirurgies précédentes"
              icon={Activity}
              iconColor="text-red-600"
              gradient="from-red-50 to-rose-50"
              defaultExpanded={false}
            >
              <div className="space-y-3">
                {clinicalData.previousSurgeries.map((surgery, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {surgery.surgeryType?.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {surgery.eye} - {surgery.status}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {surgery.surgeryEndTime &&
                          new Date(surgery.surgeryEndTime).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Right Column - Checklist & Info */}
        <div className="space-y-4">
          {/* Surgery Info */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Informations chirurgie
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Type de chirurgie</p>
                <p className="font-medium">{surgeryCase.surgeryType?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Oeil</p>
                <p className="font-medium">{surgeryCase.eye || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date programmée</p>
                <p className="font-medium">
                  {surgeryCase.scheduledDate &&
                    new Date(surgeryCase.scheduledDate).toLocaleString('fr-FR')}
                </p>
              </div>
              {surgeryCase.surgeon && (
                <div>
                  <p className="text-xs text-gray-500">Chirurgien</p>
                  <p className="font-medium">
                    Dr. {surgeryCase.surgeon.firstName} {surgeryCase.surgeon.lastName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Pre-op Checklist */}
          {(surgeryCase.status === 'checked_in' || surgeryCase.status === 'in_surgery') && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-600" />
                Checklist pré-opératoire
              </h3>
              <div className="space-y-2">
                {[
                  { key: 'identityVerified', label: 'Identité vérifiée' },
                  { key: 'siteMarked', label: 'Site opératoire marqué' },
                  { key: 'allergiesReviewed', label: 'Allergies vérifiées' },
                  { key: 'fastingConfirmed', label: 'Jeûne confirmé' },
                  { key: 'eyeDropsAdministered', label: 'Collyres administrés' },
                  { key: 'pupilDilated', label: 'Pupille dilatée' },
                  { key: 'vitalsSigned', label: 'Constantes signées' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleChecklistChange(item.key)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${
                      checklist[item.key]
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    disabled={surgeryCase.status === 'in_surgery'}
                  >
                    {checklist[item.key] ? (
                      <CheckSquare className="h-5 w-5 text-green-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
              {allChecklistComplete && (
                <div className="mt-3 p-2 bg-green-100 text-green-700 text-sm rounded-lg text-center">
                  Checklist complète
                </div>
              )}
            </div>
          )}

          {/* Patient Allergies */}
          {patient.allergies?.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Allergies
              </h3>
              <ul className="space-y-1">
                {patient.allergies.map((allergy, idx) => (
                  <li key={idx} className="text-sm text-red-600">
                    {allergy}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Check-in Modal */}
      <ConfirmationModal
        isOpen={checkInModal}
        onClose={() => setCheckInModal(false)}
        onConfirm={handleCheckIn}
        title="Check-in du patient"
        message={
          <div className="space-y-4">
            <p>
              Confirmer le check-in de{' '}
              <strong>{patient.firstName} {patient.lastName}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chirurgien assigné
              </label>
              <select
                value={selectedSurgeon}
                onChange={(e) => setSelectedSurgeon(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sélectionner un chirurgien</option>
                {surgeons.map(s => (
                  <option key={s._id} value={s._id}>
                    Dr. {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
        confirmText="Confirmer Check-in"
        confirmButtonClass="bg-purple-600 hover:bg-purple-700 text-white"
        disabled={!selectedSurgeon}
      />

      {/* Start Surgery Modal */}
      <ConfirmationModal
        isOpen={startSurgeryModal}
        onClose={() => setStartSurgeryModal(false)}
        onConfirm={handleStartSurgery}
        title="Démarrer la chirurgie"
        message={
          <div className="space-y-4">
            <p>
              Confirmer le démarrage de la chirurgie pour{' '}
              <strong>{patient.firstName} {patient.lastName}</strong>
            </p>
            <p className="text-sm text-gray-600">
              {surgeryCase.surgeryType?.name} - {surgeryCase.eye}
            </p>
            {!allChecklistComplete && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
                Attention: La checklist pré-opératoire n'est pas complète
              </div>
            )}
          </div>
        }
        confirmText="Démarrer"
        confirmButtonClass="bg-purple-600 hover:bg-purple-700 text-white"
      />
    </div>
  );
}
