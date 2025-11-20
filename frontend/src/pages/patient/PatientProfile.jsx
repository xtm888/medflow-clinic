import { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Droplet, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../services/apiConfig';
import authService from '../../services/authService';

export default function PatientProfile() {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPatientProfile();
  }, []);

  const fetchPatientProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user first
      const userResult = await authService.getCurrentUser();
      if (userResult.success && userResult.user) {
        // If user has a patient profile linked
        if (userResult.user.patientId) {
          const response = await api.get(`/patients/${userResult.user.patientId}`);
          setPatient(response.data?.data || response.data);
        } else {
          // Use user data directly
          setPatient({
            firstName: userResult.user.firstName || userResult.user.name?.split(' ')[0] || '',
            lastName: userResult.user.lastName || userResult.user.name?.split(' ').slice(1).join(' ') || '',
            email: userResult.user.email || '',
            phone: userResult.user.phone || userResult.user.phoneNumber || '',
            dateOfBirth: userResult.user.dateOfBirth || '',
            gender: userResult.user.gender || '',
            bloodType: userResult.user.bloodType || '',
            address: userResult.user.address || '',
            allergies: userResult.user.allergies || []
          });
        }
      } else {
        setError('Unable to load user profile');
      }
    } catch (err) {
      console.error('Error fetching patient profile:', err);
      setError('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement du profil...</span>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon Profil</h1>
          <p className="mt-1 text-sm text-gray-500">Consultez et gérez vos informations personnelles</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700">{error || 'Patient non trouvé'}</p>
          <button onClick={fetchPatientProfile} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mon Profil</h1>
        <p className="mt-1 text-sm text-gray-500">Consultez et gérez vos informations personnelles</p>
      </div>

      {/* Profile Info */}
      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-blue-600 text-white text-2xl font-bold">
            {(patient.firstName?.[0] || 'P')}{(patient.lastName?.[0] || '')}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-gray-600">{patient.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date de naissance</p>
                <p className="font-medium">
                  {patient.dateOfBirth
                    ? new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')
                    : 'Non renseigné'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Sexe</p>
                <p className="font-medium">
                  {patient.gender === 'M' || patient.gender === 'male' ? 'Masculin' :
                   patient.gender === 'F' || patient.gender === 'female' ? 'Féminin' :
                   'Non renseigné'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Droplet className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Groupe sanguin</p>
                <p className="font-medium">{patient.bloodType || 'Non renseigné'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium">{patient.phone || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{patient.email || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Adresse</p>
                <p className="font-medium">{patient.address || 'Non renseigné'}</p>
              </div>
            </div>
          </div>
        </div>

        {patient.allergies && patient.allergies.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-bold text-gray-900">Allergies</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((allergy, idx) => (
                <span key={idx} className="badge badge-danger">
                  {typeof allergy === 'string' ? allergy : allergy.name || allergy}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button className="btn btn-primary">
            Modifier mes informations
          </button>
        </div>
      </div>

      {/* Medical History */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Historique médical</h3>
        <p className="text-gray-500">
          Votre historique médical détaillé sera disponible prochainement.
        </p>
      </div>
    </div>
  );
}
