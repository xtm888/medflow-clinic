import { memo } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Eye, User, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import { PatientPhotoAvatar } from '../../components/biometric';
import PermissionGate from '../../components/PermissionGate';

const AppointmentList = memo(function AppointmentList({
  appointments,
  getPatientName,
  getPatientObject,
  getProviderName,
  getStatusBadge,
  getStatusText,
  onShowPatientPanel,
  onCheckIn,
  onStart,
  onCancel,
  onConfirm,
  onReject,
  actionLoading,
  onShowBookingModal,
  today
}) {
  const navigate = useNavigate();

  if (appointments.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="appointments"
          customAction={{
            label: 'Nouveau rendez-vous',
            onClick: onShowBookingModal
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {appointments.map((apt) => {
        const patientName = getPatientName(apt.patient);
        const patientObj = getPatientObject(apt.patient);
        const aptId = apt._id || apt.id;

        return (
          <div key={aptId} className="card hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <PatientPhotoAvatar
                    patient={patientObj}
                    size="sm"
                  />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {patientName}
                  </h3>
                  <span className={getStatusBadge(apt.status)}>
                    {getStatusText(apt.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Date & Heure</p>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(apt.date), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-gray-700">{apt.time}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-semibold text-gray-900">
                      {apt.type || 'Consultation'}
                    </p>
                    <p className="text-gray-600">{apt.duration || 30} minutes</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Médecin</p>
                    <p className="font-semibold text-gray-900">
                      {getProviderName(apt.doctor) || getProviderName(apt.provider) || 'Non assigné'}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Salle</p>
                    <p className="font-semibold text-gray-900">{apt.room || 'Non assignée'}</p>
                  </div>
                </div>

                {(apt.reason || apt.notes) && (
                  <div className="mt-3 pt-3 border-t">
                    {apt.reason && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Raison: </span>
                        {apt.reason}
                      </p>
                    )}
                    {apt.notes && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Notes: </span>
                        {apt.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-2 ml-4">
                {/* Patient Info Button - Always visible */}
                <button
                  onClick={() => {
                    const patient = getPatientObject(apt.patient);
                    if (patient) {
                      onShowPatientPanel(patient);
                    }
                  }}
                  className="btn btn-outline text-sm px-4 py-2 flex items-center justify-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                  title="Voir infos patient"
                >
                  <User className="h-4 w-4" />
                  Infos
                </button>
                {(apt.status === 'confirmed' || apt.status === 'CONFIRMED' || apt.status === 'scheduled' || apt.status === 'SCHEDULED') && (
                  <>
                    {format(new Date(apt.date), 'yyyy-MM-dd') === today && (
                      <PermissionGate permission="check_in_patients">
                        <button
                          onClick={() => {
                            const patient = getPatientObject(apt.patient);
                            onCheckIn(aptId, patient);
                          }}
                          disabled={actionLoading[aptId]}
                          className="btn btn-success text-sm px-4 py-2 flex items-center justify-center gap-2"
                        >
                          <UserCheck className="h-4 w-4" />
                          {actionLoading[aptId] ? 'Chargement...' : 'Accueil'}
                        </button>
                      </PermissionGate>
                    )}
                    <button
                      onClick={() => {
                        const patient = getPatientObject(apt.patient);
                        onStart(aptId, patient);
                      }}
                      disabled={actionLoading[aptId]}
                      className="btn btn-primary text-sm px-4 py-2"
                    >
                      {actionLoading[aptId] ? 'Chargement...' : 'Commencer'}
                    </button>
                    <button
                      onClick={() => onCancel(aptId)}
                      disabled={actionLoading[aptId]}
                      className="btn btn-secondary text-sm px-4 py-2"
                    >
                      Annuler
                    </button>
                  </>
                )}
                {(apt.status === 'pending' || apt.status === 'PENDING') && (
                  <>
                    <PermissionGate permission="manage_appointments">
                      <button
                        onClick={() => onConfirm(aptId)}
                        disabled={actionLoading[aptId]}
                        className="btn btn-success text-sm px-4 py-2"
                      >
                        {actionLoading[aptId] ? 'Chargement...' : 'Confirmer'}
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="manage_appointments">
                      <button
                        onClick={() => onReject(aptId)}
                        disabled={actionLoading[aptId]}
                        className="btn btn-danger text-sm px-4 py-2"
                      >
                        Refuser
                      </button>
                    </PermissionGate>
                  </>
                )}
                {(apt.status === 'completed' || apt.status === 'COMPLETED') && (
                  <button
                    onClick={() => {
                      const patientId = typeof apt.patient === 'object' && apt.patient !== null ? apt.patient._id : apt.patient;
                      if (patientId) {
                        navigate(`/patients/${patientId}`);
                      }
                    }}
                    className="btn btn-secondary text-sm px-4 py-2 flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Voir détails
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

AppointmentList.propTypes = {
  appointments: PropTypes.array.isRequired,
  getPatientName: PropTypes.func.isRequired,
  getPatientObject: PropTypes.func.isRequired,
  getProviderName: PropTypes.func.isRequired,
  getStatusBadge: PropTypes.func.isRequired,
  getStatusText: PropTypes.func.isRequired,
  onShowPatientPanel: PropTypes.func.isRequired,
  onCheckIn: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  actionLoading: PropTypes.object.isRequired,
  onShowBookingModal: PropTypes.func.isRequired,
  today: PropTypes.string.isRequired
};

export default AppointmentList;
