import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, FileText, Pill, Image, Eye, Calendar, FlaskConical,
  CreditCard, AlertTriangle, Phone, Mail, Edit, Plus, Printer, Clock,
  Activity, Heart, Droplets, History, Users
} from 'lucide-react';
import patientService from '../services/patientService';
import prescriptionService from '../services/prescriptionService';
import { toast } from 'react-toastify';
import { normalizeToArray, safeString } from '../utils/apiHelpers';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import PatientTimeline from '../components/PatientTimeline';
import { ProviderList } from '../components/ProviderBadge';

export default function PatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Tab data
  const [prescriptions, setPrescriptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [imaging, setImaging] = useState([]);
  const [exams, setExams] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [billing, setBilling] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [providers, setProviders] = useState([]);

  // Modals
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);

      // Load patient basic info
      const patientRes = await patientService.getPatient(patientId);
      setPatient(patientRes.data || patientRes);

      // Load related data based on active tab (lazy loading)
      await loadTabData('overview');

    } catch (err) {
      toast.error('Erreur lors du chargement du patient');
      console.error('Error loading patient:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async (tab) => {
    try {
      switch (tab) {
        case 'prescriptions':
          if (prescriptions.length === 0) {
            const rxRes = await prescriptionService.getPatientPrescriptions(patientId);
            setPrescriptions(normalizeToArray(rxRes));
          }
          break;
        case 'timeline':
          if (timeline.length === 0) {
            const timelineRes = await patientService.getPatientTimeline(patientId);
            setTimeline(timelineRes.data || []);
          }
          break;
        case 'providers':
          if (providers.length === 0) {
            const providersRes = await patientService.getPatientProviders(patientId);
            setProviders(providersRes.data || []);
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`Error loading ${tab} data:`, err);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dossier patient...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Patient non trouve</p>
        <button onClick={() => navigate('/patients')} className="btn btn-primary mt-4">
          Retour aux patients
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Resume', icon: User },
    { id: 'timeline', label: 'Chronologie', icon: History },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'imaging', label: 'Imagerie', icon: Image },
    { id: 'exams', label: 'Examens', icon: Eye },
    { id: 'appointments', label: 'RDV', icon: Calendar },
    { id: 'lab', label: 'Labo', icon: FlaskConical },
    { id: 'providers', label: 'Praticiens', icon: Users },
    { id: 'billing', label: 'Facturation', icon: CreditCard }
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Patient Header - Always Visible */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/patients')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>

              <div className="flex items-center gap-4">
                {/* Patient Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                </div>

                {/* Patient Info */}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {patient.firstName} {patient.lastName}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>{calculateAge(patient.dateOfBirth)} ans</span>
                    <span>|</span>
                    <span>{patient.gender === 'male' ? 'Homme' : 'Femme'}</span>
                    {patient.bloodType && (
                      <>
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          <Droplets className="h-3 w-3" />
                          {patient.bloodType}
                        </span>
                      </>
                    )}
                    <span>|</span>
                    <span className="text-blue-600">{patient.patientId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {patient.phoneNumber && (
                <a
                  href={`tel:${patient.phoneNumber}`}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Appeler"
                >
                  <Phone className="h-5 w-5 text-gray-600" />
                </a>
              )}
              {patient.email && (
                <a
                  href={`mailto:${patient.email}`}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Email"
                >
                  <Mail className="h-5 w-5 text-gray-600" />
                </a>
              )}
              <button
                onClick={() => navigate(`/patients/${patientId}/edit`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Modifier"
              >
                <Edit className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Allergy Alert */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span className="text-sm font-medium text-red-800">
                ALLERGIE: {Array.isArray(patient.allergies) ? patient.allergies.join(', ') : patient.allergies}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 border-t border-gray-100">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Informations personnelles
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Date de naissance</dt>
                  <dd className="text-sm text-gray-900">{formatDate(patient.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Telephone</dt>
                  <dd className="text-sm text-gray-900">{patient.phoneNumber || 'Non renseigne'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Email</dt>
                  <dd className="text-sm text-gray-900">{patient.email || 'Non renseigne'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Adresse</dt>
                  <dd className="text-sm text-gray-900">
                    {patient.address
                      ? (typeof patient.address === 'object'
                          ? [patient.address.street, patient.address.city, patient.address.postalCode, patient.address.country].filter(Boolean).join(', ')
                          : patient.address)
                      : 'Non renseignee'}
                  </dd>
                </div>
                {patient.emergencyContact && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">Contact d'urgence</dt>
                    <dd className="text-sm text-gray-900">
                      {typeof patient.emergencyContact === 'object'
                        ? [patient.emergencyContact.name, patient.emergencyContact.relationship, patient.emergencyContact.phone].filter(Boolean).join(' - ')
                        : patient.emergencyContact}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Medical Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Informations medicales
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Groupe sanguin</dt>
                  <dd className="text-sm text-gray-900">{patient.bloodType || 'Non renseigne'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Allergies</dt>
                  <dd className="text-sm text-gray-900">
                    {patient.allergies?.length > 0
                      ? (Array.isArray(patient.allergies) ? patient.allergies.join(', ') : patient.allergies)
                      : 'Aucune allergie connue'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Antecedents</dt>
                  <dd className="text-sm text-gray-900">
                    {patient.medicalHistory?.length > 0
                      ? (Array.isArray(patient.medicalHistory) ? patient.medicalHistory.join(', ') : patient.medicalHistory)
                      : 'Aucun antecedent'}
                  </dd>
                </div>
                {patient.currentMedications?.length > 0 && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">Traitements en cours</dt>
                    <dd className="text-sm text-gray-900">
                      {Array.isArray(patient.currentMedications)
                        ? patient.currentMedications.join(', ')
                        : patient.currentMedications}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Activity Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Activite recente
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Derniere visite</dt>
                  <dd className="text-sm text-gray-900">
                    {patient.lastVisit ? formatDate(patient.lastVisit) : 'Aucune visite'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Prochain RDV</dt>
                  <dd className="text-sm text-gray-900">
                    {patient.nextAppointment ? formatDate(patient.nextAppointment) : 'Aucun RDV'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Prescriptions actives</dt>
                  <dd className="text-sm text-gray-900">{prescriptions.filter(p => p.status === 'pending').length || 0}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Date d'inscription</dt>
                  <dd className="text-sm text-gray-900">{formatDate(patient.createdAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                Chronologie du patient
              </h3>
            </div>
            <PatientTimeline
              events={timeline}
              onEventClick={(event) => {
                // Navigate to event detail based on type
                if (event.type === 'visit') {
                  navigate(`/visits/${event.id}`);
                } else if (event.type === 'prescription') {
                  // Navigate to prescriptions page with filter
                  navigate(`/prescriptions?patientId=${patientId}&highlight=${event.id}`);
                } else if (event.type === 'examination') {
                  // Navigate to ophthalmology exam - load existing exam
                  navigate(`/ophthalmology/refraction?examId=${event.id}`);
                } else if (event.type === 'laboratory') {
                  // Navigate to laboratory page with patient filter
                  navigate(`/laboratory?patientId=${patientId}&highlight=${event.id}`);
                }
              }}
              showFilters={true}
              maxItems={50}
            />
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Praticiens traitants
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Tous les professionnels de sante ayant traite ce patient
            </p>
            <ProviderList
              providers={providers}
              onProviderClick={(provider) => {
                // Could navigate to provider profile or filter timeline
              }}
            />
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Pill className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">Aucune prescription pour ce patient</p>
                <button
                  onClick={() => navigate('/prescriptions')}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle prescription
                </button>
              </div>
            ) : (
              prescriptions.map((rx) => (
                <div key={rx._id || rx.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(rx.createdAt || rx.date)}
                        </span>
                        <span className="text-sm text-gray-500">
                          - {rx.prescriber?.name || 'Dr. Inconnu'}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      rx.status === 'dispensed' ? 'bg-green-100 text-green-700' :
                      rx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {rx.status === 'dispensed' ? 'Dispensee' :
                       rx.status === 'pending' ? 'En attente' : rx.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {Array.isArray(rx.medications) && rx.medications.map((med, idx) => (
                      <div key={idx} className="pl-6 py-2 border-l-2 border-blue-200">
                        <p className="font-medium text-gray-900">
                          {safeString(med.medication, '') || safeString(med.name, '') || 'Medication'}
                        </p>
                        <p className="text-sm text-gray-600">{safeString(med.dosage, 'N/A')}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <button className="btn btn-sm btn-secondary">
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </button>
                    <button className="btn btn-sm btn-secondary">
                      <Printer className="h-3 w-3 mr-1" />
                      Imprimer
                    </button>
                    {rx.status === 'pending' && (
                      <button className="btn btn-sm btn-primary">
                        Renouveler
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Documents du patient</p>
              <button
                onClick={() => setShowDocumentGenerator(true)}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Generer un document
              </button>
            </div>
          </div>
        )}

        {/* Imaging Tab */}
        {activeTab === 'imaging' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <Image className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Imagerie medicale</p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une image
              </button>
            </div>
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === 'exams' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <Eye className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Examens ophtalmologiques</p>
              <div className="flex justify-center gap-2">
                <button className="btn btn-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle refraction
                </button>
                <button className="btn btn-secondary">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle IVT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Rendez-vous</p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Prendre un RDV
              </button>
            </div>
          </div>
        )}

        {/* Lab Tab */}
        {activeTab === 'lab' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <FlaskConical className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Resultats de laboratoire</p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Demander un examen
              </button>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Facturation et paiements</p>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context-Aware Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-end gap-3 z-20">
        {activeTab === 'overview' && (
          <>
            <button
              onClick={() => navigate(`/visits/new/${patientId}`)}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle consultation
            </button>
          </>
        )}
        {activeTab === 'prescriptions' && (
          <>
            <button
              onClick={() => navigate('/prescriptions')}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle ordonnance
            </button>
            <button className="btn btn-secondary">
              <Printer className="h-4 w-4 mr-2" />
              Imprimer historique
            </button>
          </>
        )}
        {activeTab === 'documents' && (
          <>
            <button
              onClick={() => setShowDocumentGenerator(true)}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Generer document
            </button>
          </>
        )}
        {activeTab === 'exams' && (
          <>
            <button className="btn btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nouvel examen
            </button>
            <button className="btn btn-secondary">
              Voir progression
            </button>
          </>
        )}
      </div>

      {/* Document Generator Modal */}
      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patientId}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            toast.success('Document genere avec succes!');
            setShowDocumentGenerator(false);
          }}
        />
      )}
    </div>
  );
}
