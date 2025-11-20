import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Eye, Phone, Mail, AlertCircle, Star, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PatientRegistrationWizard from '../components/PatientRegistrationWizard';
import EmptyState from '../components/EmptyState';
import patientService from '../services/patientService';
import { toast } from 'react-toastify';

export default function Patients() {
  const navigate = useNavigate();
  
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch patients from API
  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await patientService.getPatients({ limit: 100 });
      const patientsData = response.data || response.patients || [];
      setPatients(patientsData);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Erreur lors du chargement des patients');
      toast.error('Erreur lors du chargement des patients');
    } finally {
      setLoading(false);
    }
  };

  // Load patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get gender display
  const getGenderDisplay = (gender) => {
    if (!gender) return 'N/A';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'Homme';
    if (g === 'female' || g === 'f') return 'Femme';
    return gender;
  };

  // Get gender code for display
  const getGenderCode = (gender) => {
    if (!gender) return '';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'M';
    if (g === 'female' || g === 'f') return 'F';
    return '';
  };

  // Filter and sort patients based on search, priority, and sort order
  const filteredPatients = patients
    .filter(patient => {
      // Search filter
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const phone = patient.phoneNumber || patient.phone || '';
      const patientId = patient.patientId || '';
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
        phone.includes(searchTerm) ||
        patientId.toLowerCase().includes(searchTerm.toLowerCase());

      // Priority filter
      let matchesPriority = true;
      if (priorityFilter !== 'all') {
        const patientPriority = patient.priority || patient.patientType || 'normal';
        matchesPriority = patientPriority.toUpperCase() === priorityFilter;
      }

      return matchesSearch && matchesPriority;
    })
    .sort((a, b) => {
      // Sort logic
      switch (sortBy) {
        case 'name':
          const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
          const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);

        case 'lastVisit':
          const dateA = a.lastVisit ? new Date(a.lastVisit) : new Date(0);
          const dateB = b.lastVisit ? new Date(b.lastVisit) : new Date(0);
          return dateB - dateA; // Most recent first

        case 'nextAppointment':
          const apptA = a.nextAppointment ? new Date(a.nextAppointment) : new Date('9999-12-31');
          const apptB = b.nextAppointment ? new Date(b.nextAppointment) : new Date('9999-12-31');
          return apptA - apptB; // Soonest first

        default:
          return 0;
      }
    });

  // Handle wizard submission
  const handleWizardSubmit = async (patientData) => {
    try {
      setLoading(true);
      await patientService.createPatient(patientData);
      toast.success('✓ Patient créé avec succès!');
      setShowWizard(false);
      // Reload patient list
      await fetchPatients();
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error('Erreur lors de la création du patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Patients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les dossiers patients et leurs informations médicales
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau patient</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center space-x-3">
            <select
              className="input"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">Tous les patients</option>
              <option value="VIP">VIP</option>
              <option value="PREGNANT">Femmes enceintes</option>
              <option value="ELDERLY">Personnes âgées</option>
            </select>
            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Trier par nom</option>
              <option value="lastVisit">Dernière visite</option>
              <option value="nextAppointment">Prochain RDV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-600">Chargement des patients...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button
            onClick={fetchPatients}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Patients List */}
      {!loading && !error && (
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priorité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dernière visite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prochain RDV
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-0">
                      {searchTerm || priorityFilter !== 'all' ? (
                        <EmptyState
                          type="filtered"
                          compact={true}
                        />
                      ) : (
                        <EmptyState
                          type="patients"
                          customAction={{
                            label: 'Ajouter un patient',
                            path: '#',
                            onClick: () => setShowWizard(true)
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const age = calculateAge(patient.dateOfBirth);
                    const phone = patient.phoneNumber || patient.phone || 'N/A';
                    const email = patient.email || 'N/A';
                    const bloodType = patient.bloodGroup || patient.bloodType || 'N/A';
                    const priority = patient.priority || patient.patientType || 'normal';
                    const isVip = priority === 'vip' || patient.vip;
                    const lastVisit = patient.lastVisit || patient.lastVisitDate;
                    const nextAppointment = patient.nextAppointment || patient.nextAppointmentDate;
                    const allergies = patient.medicalHistory?.allergies || patient.allergies || [];
                    const insurance = patient.insurance?.provider || patient.insurance || 'N/A';
                    const address = typeof patient.address === 'object'
                      ? `${patient.address.street || ''} ${patient.address.city || ''}`
                      : patient.address || 'N/A';

                    return (
                      <tr key={patient._id || patient.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-700 font-medium">
                                {(patient.firstName || '?')[0]}{(patient.lastName || '?')[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {patient.firstName} {patient.lastName}
                                </div>
                                {isVip && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                              </div>
                              <div className="text-sm text-gray-500">
                                {patient.patientId && <span className="mr-2">{patient.patientId}</span>}
                                {age !== 'N/A' && `${age} ans`} · {getGenderDisplay(patient.gender)} · {bloodType}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center text-sm text-gray-900">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {phone}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            priority === 'vip' ? 'bg-purple-100 text-purple-800' :
                            priority === 'pregnant' ? 'bg-pink-100 text-pink-800' :
                            priority === 'elderly' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {priority === 'vip' ? 'VIP' :
                             priority === 'pregnant' ? 'Enceinte' :
                             priority === 'elderly' ? 'Âgé' :
                             'Normal'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {lastVisit ? new Date(lastVisit).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {nextAppointment ? new Date(nextAppointment).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedPatient({
                                ...patient,
                                age,
                                phone,
                                email,
                                bloodType,
                                priority,
                                insurance,
                                address,
                                allergies,
                                lastVisit,
                                nextAppointment
                              })}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => navigate(`/patients/${patient._id || patient.id}`)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Modifier"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Results count */}
          {filteredPatients.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500">
              {filteredPatients.length} patient{filteredPatients.length > 1 ? 's' : ''} trouvé{filteredPatients.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Patient Details Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </h2>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPatient.patientId && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID Patient</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedPatient.patientId}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Âge</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.age} ans</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Sexe</label>
                    <p className="mt-1 text-sm text-gray-900">{getGenderDisplay(selectedPatient.gender)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Groupe sanguin</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.bloodType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Assurance</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.insurance}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Adresse</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.address}</p>
                  </div>
                </div>
              </div>

              {/* Allergies */}
              {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    Allergies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.allergies.map((allergy, index) => (
                      <span key={index} className="badge badge-danger">
                        {typeof allergy === 'object' ? allergy.allergen || allergy.name : allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique médical</h3>
                <div className="space-y-2">
                  {selectedPatient.lastVisit && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">
                        Dernière visite: {new Date(selectedPatient.lastVisit).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {selectedPatient.nextAppointment && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">
                        Prochain RDV: {new Date(selectedPatient.nextAppointment).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {!selectedPatient.lastVisit && !selectedPatient.nextAppointment && (
                    <p className="text-sm text-gray-500">Aucun historique disponible</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Registration Wizard */}
      {showWizard && (
        <PatientRegistrationWizard
          onClose={() => setShowWizard(false)}
          onSubmit={handleWizardSubmit}
        />
      )}
    </div>
  );
}
