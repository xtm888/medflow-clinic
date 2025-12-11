import { Users, Eye, Clock, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * RecentPatientsWidget - Shows recently seen patients
 *
 * Displays recent patient visits with quick access to medical records
 * Most relevant for doctors, nurses, and ophthalmologists
 */
const RecentPatientsWidget = ({ userRole, patients = [] }) => {
  // Ensure patients is always an array
  const patientsList = Array.isArray(patients) ? patients : [];

  // Check if widget is relevant for user role
  const isRelevantForRole = () => {
    return ['doctor', 'ophthalmologist', 'nurse', 'admin'].includes(userRole);
  };

  // Don't render for irrelevant roles
  if (!isRelevantForRole()) {
    return null;
  }

  // Format date/time for display
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // If today, show time only
    if (date.toDateString() === today.toDateString()) {
      return `Aujourd'hui ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // If yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Hier ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Otherwise, show date
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get patient initials
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Get visit type badge color
  const getVisitTypeBadge = (visitType) => {
    switch (visitType?.toLowerCase()) {
      case 'consultation':
        return 'bg-blue-100 text-blue-800';
      case 'urgence':
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'suivi':
      case 'follow-up':
        return 'bg-green-100 text-green-800';
      case 'examen':
      case 'examination':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-50 p-2 rounded-lg">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Patients récents</h3>
        </div>
        {patientsList.length > 0 && (
          <Link
            to="/patients"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Voir tout
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {patientsList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun patient récent</p>
          </div>
        ) : (
          <>
            {patientsList.slice(0, 6).map((patient, index) => (
              <Link
                key={patient.id || index}
                to={`/patients/${patient.id || patient.patientId}`}
                className="block"
              >
                <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3 flex-1">
                    {/* Patient Avatar */}
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-medium text-sm">
                        {getInitials(patient.firstName, patient.lastName)}
                      </span>
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {patient.firstName} {patient.lastName}
                        </p>
                        {patient.age && (
                          <span className="text-xs text-gray-500">
                            {patient.age} ans
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-1">
                        {patient.visitType && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getVisitTypeBadge(patient.visitType)}`}>
                            {patient.visitType}
                          </span>
                        )}
                        {patient.visitDate && (
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDateTime(patient.visitDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0">
                      <Eye className="h-5 w-5 text-gray-400 hover:text-blue-600" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Quick Stats */}
      {patientsList.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Aujourd'hui: <span className="font-semibold text-gray-900">
                {patientsList.filter(p => {
                  const visitDate = new Date(p.visitDate);
                  const today = new Date();
                  return visitDate.toDateString() === today.toDateString();
                }).length}
              </span></span>
            </div>
            <div className="text-gray-600">
              Total: <span className="font-semibold text-gray-900">{patientsList.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentPatientsWidget;
