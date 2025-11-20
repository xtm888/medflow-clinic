import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, Calendar, AlertTriangle, X, ChevronLeft, ChevronRight,
  Star, Activity, Eye, Pill, FileText, Clock, MapPin, Briefcase, Heart
} from 'lucide-react';
import { usePatient } from '../contexts/PatientContext';

function PatientContextPanel() {
  const navigate = useNavigate();
  const {
    selectedPatient,
    patientHistory,
    loading,
    isExpanded,
    clearPatient,
    toggleExpanded,
    getPatientAge,
    getPatientDisplayName,
    getPatientInitials
  } = usePatient();

  if (!selectedPatient) return null;

  const age = getPatientAge();
  const displayName = getPatientDisplayName();
  const initials = getPatientInitials();

  const phone = selectedPatient.phoneNumber || selectedPatient.phone || '-';
  const email = selectedPatient.email || '-';
  const profession = selectedPatient.profession || selectedPatient.occupation || '-';
  const bloodType = selectedPatient.bloodGroup || selectedPatient.bloodType || '-';
  const priority = selectedPatient.priority || selectedPatient.patientType || 'normal';
  const isVip = priority === 'vip' || selectedPatient.vip;

  // Get allergies
  const allergies = selectedPatient.medicalHistory?.allergies || selectedPatient.allergies || [];

  // Get last IOP values from history
  const lastIOP = patientHistory?.recentVisits?.[0]?.iop || null;

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get gender display
  const getGenderDisplay = (gender) => {
    if (!gender) return '';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'Homme';
    if (g === 'female' || g === 'f') return 'Femme';
    return gender;
  };

  if (!isExpanded) {
    // Collapsed view - just show avatar and expand button
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={toggleExpanded}
          className="p-2 hover:bg-gray-100 rounded-full mb-4"
          title="Afficher le panneau patient"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>

        <div
          className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center cursor-pointer"
          onClick={toggleExpanded}
          title={displayName}
        >
          <span className="text-primary-700 text-xs font-medium">{initials}</span>
        </div>

        {isVip && (
          <Star className="h-4 w-4 text-yellow-500 fill-current mt-2" />
        )}

        {allergies.length > 0 && (
          <AlertTriangle className="h-4 w-4 text-red-500 mt-2" title="Allergies" />
        )}
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 text-lg font-medium">{initials}</span>
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <h3 className="text-sm font-semibold text-gray-900">{displayName}</h3>
                {isVip && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
              </div>
              <p className="text-xs text-gray-500">
                {age ? `${age} ans` : ''} {age && selectedPatient.gender ? '·' : ''} {getGenderDisplay(selectedPatient.gender)}
              </p>
              {selectedPatient.patientId && (
                <p className="text-xs text-gray-400">{selectedPatient.patientId}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleExpanded}
              className="p-1 hover:bg-gray-200 rounded"
              title="Réduire"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>
            <button
              onClick={clearPatient}
              className="p-1 hover:bg-gray-200 rounded"
              title="Fermer"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick Info */}
        <div className="p-4 space-y-2 border-b border-gray-100">
          {selectedPatient.dateOfBirth && (
            <div className="flex items-center text-xs text-gray-600">
              <Calendar className="h-3 w-3 mr-2 text-gray-400" />
              {formatDate(selectedPatient.dateOfBirth)}
            </div>
          )}
          <div className="flex items-center text-xs text-gray-600">
            <Phone className="h-3 w-3 mr-2 text-gray-400" />
            {phone}
          </div>
          {email !== '-' && (
            <div className="flex items-center text-xs text-gray-600 truncate">
              <Mail className="h-3 w-3 mr-2 text-gray-400 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </div>
          )}
          {profession !== '-' && (
            <div className="flex items-center text-xs text-gray-600">
              <Briefcase className="h-3 w-3 mr-2 text-gray-400" />
              {profession}
            </div>
          )}
        </div>

        {/* Priority & Blood Type */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center space-x-2">
          {priority !== 'normal' && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              priority === 'vip' ? 'bg-purple-100 text-purple-800' :
              priority === 'pregnant' ? 'bg-pink-100 text-pink-800' :
              priority === 'elderly' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {priority === 'vip' ? 'VIP' :
               priority === 'pregnant' ? 'Enceinte' :
               priority === 'elderly' ? 'Personne âgée' :
               priority}
            </span>
          )}
          {bloodType !== '-' && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700">
              <Heart className="h-3 w-3 inline mr-1" />
              {bloodType}
            </span>
          )}
        </div>

        {/* Allergies Alert */}
        {allergies.length > 0 && (
          <div className="p-3 bg-red-50 border-b border-red-100">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-800">Allergies</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {allergies.map((allergy, index) => (
                    <span key={index} className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      {typeof allergy === 'object' ? allergy.allergen || allergy.name : allergy}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Last IOP */}
        {lastIOP && (
          <div className="p-3 bg-purple-50 border-b border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="h-4 w-4 text-purple-500 mr-2" />
                <span className="text-xs font-medium text-purple-800">Dernière PIO</span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-purple-700">OD: {lastIOP.od || '-'}</span>
                <span className="mx-1 text-purple-400">|</span>
                <span className="text-purple-700">OG: {lastIOP.og || '-'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent History */}
        {patientHistory?.recentVisits?.length > 0 && (
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Visites récentes
            </p>
            <div className="space-y-2">
              {patientHistory.recentVisits.slice(0, 3).map((visit, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 text-gray-400 mr-1" />
                    <span className="text-gray-600">{formatDate(visit.date || visit.createdAt)}</span>
                  </div>
                  <span className="text-gray-500 truncate ml-2">
                    {visit.type || visit.chiefComplaint?.description || 'Consultation'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Medications */}
        {patientHistory?.recentPrescriptions?.length > 0 && (
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Traitements en cours
            </p>
            <div className="space-y-1">
              {patientHistory.recentPrescriptions.slice(0, 3).map((rx, index) => (
                <div key={index} className="flex items-center text-xs text-gray-600">
                  <Pill className="h-3 w-3 text-gray-400 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    {rx.medications?.[0]?.drug?.name || rx.drug?.name || 'Prescription'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
        <button
          onClick={() => navigate(`/patients/${selectedPatient._id || selectedPatient.id}`)}
          className="w-full text-xs px-3 py-2 bg-white border border-gray-200 rounded text-gray-700 hover:bg-gray-50 flex items-center justify-center"
        >
          <FileText className="h-3 w-3 mr-1" />
          Voir dossier complet
        </button>
        <button
          onClick={() => navigate(`/patients/${selectedPatient._id || selectedPatient.id}/summary`)}
          className="w-full text-xs px-3 py-2 bg-primary-600 rounded text-white hover:bg-primary-700 flex items-center justify-center"
        >
          <Eye className="h-3 w-3 mr-1" />
          Résumé clinique
        </button>
      </div>
    </div>
  );
}

export default PatientContextPanel;
