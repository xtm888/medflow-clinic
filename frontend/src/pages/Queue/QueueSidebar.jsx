import React from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, AlertCircle, ArrowUp, Eye, FileText, FlaskConical, Ban, Calendar, DollarSign } from 'lucide-react';
import { PatientPhotoAvatar } from '../../components/biometric';
import PermissionGate from '../../components/PermissionGate';

const QueueSidebar = React.memo(({
  inProgressPatients,
  alertCounts,
  rejectedLabOrders,
  loadingRejectedLabs,
  onViewInfo,
  onStartVisit,
  onComplete,
  onRescheduleLabOrder,
  loading
}) => {
  return (
    <div className="space-y-4">
      {/* In Progress */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">En consultation</h2>
        {inProgressPatients.length === 0 ? (
          <div className="card bg-gray-50 text-center py-8">
            <p className="text-gray-500">Aucune consultation en cours</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inProgressPatients.map((patient) => (
              <div key={patient.appointmentId} className="card bg-green-50 border-green-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <PatientPhotoAvatar
                      patient={patient.patient}
                      size="md"
                      showVerificationStatus={true}
                    />
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <h3 className="font-semibold text-green-900">
                          {patient.patient?.firstName || 'N/A'} {patient.patient?.lastName || ''}
                        </h3>
                      </div>
                      <p className="text-sm text-green-700">ID: {patient.patient?.patientId || 'N/A'}</p>
                      {patient.roomNumber && (
                        <p className="text-sm text-green-600 mt-1">Salle {patient.roomNumber}</p>
                      )}
                      {patient.provider && (
                        <p className="text-xs text-green-600 mt-1">
                          Dr. {patient.provider.firstName} {patient.provider.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => onViewInfo(patient.patient)}
                      className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center border-purple-300 text-purple-700 hover:bg-purple-50 touch-manipulation"
                      title="Voir infos patient"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onStartVisit(patient)}
                      className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center space-x-1 touch-manipulation"
                      disabled={loading}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Ouvrir</span>
                    </button>
                    <button
                      onClick={() => onComplete(patient)}
                      className="btn btn-success text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center touch-manipulation"
                      disabled={loading}
                    >
                      <CheckCircle className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Terminer</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Alertes</h2>
        <div className="space-y-3">
          {alertCounts.longWaitCount > 0 && (
            <div className="card bg-red-50 border-red-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Attente prolongée</p>
                  <p className="text-sm text-red-700 mt-1">
                    {alertCounts.longWaitCount} patient(s) attendent depuis plus de 30 minutes
                  </p>
                </div>
              </div>
            </div>
          )}

          {alertCounts.priorityCount > 0 && (
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <ArrowUp className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">Haute priorité</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {alertCounts.priorityCount} patient(s) avec priorité élevée
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rejected Lab Orders */}
      <PermissionGate permission="check_in_patients">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-red-500" />
              Laboratoire - Rejets
            </h2>
            {rejectedLabOrders.length > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                {rejectedLabOrders.length}
              </span>
            )}
          </div>
          {loadingRejectedLabs ? (
            <div className="card bg-gray-50 text-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">Chargement...</p>
            </div>
          ) : rejectedLabOrders.length === 0 ? (
            <div className="card bg-gray-50 text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Aucun patient rejeté</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rejectedLabOrders.map((order) => (
                <div key={order._id} className="card bg-red-50 border-red-200 border-l-4 border-l-red-500">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Ban className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-red-900 truncate">
                          {order.patient?.firstName} {order.patient?.lastName}
                        </h3>
                        <p className="text-sm text-red-700">
                          {order.tests?.map(t => t.name || t.testName).slice(0, 2).join(', ')}
                          {order.tests?.length > 2 && ` +${order.tests.length - 2}`}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Raison: {order.rejectionHistory?.[order.rejectionHistory.length - 1]?.reasonLabel || 'Non spécifiée'}
                        </p>
                        {order.rejectionHistory?.[order.rejectionHistory.length - 1]?.penaltyInvoice && (
                          <div className="flex items-center gap-1 mt-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full w-fit">
                            <DollarSign className="h-3 w-3" />
                            Pénalité: {(order.rejectionHistory[order.rejectionHistory.length - 1].penaltyAmount || 0).toLocaleString()} FCFA
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRescheduleLabOrder(order)}
                      className="btn btn-primary text-xs px-3 py-2 flex items-center gap-1"
                    >
                      <Calendar className="h-4 w-4" />
                      Reprogrammer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PermissionGate>
    </div>
  );
});

QueueSidebar.displayName = 'QueueSidebar';

QueueSidebar.propTypes = {
  inProgressPatients: PropTypes.arrayOf(PropTypes.object).isRequired,
  alertCounts: PropTypes.shape({
    longWaitCount: PropTypes.number.isRequired,
    priorityCount: PropTypes.number.isRequired
  }).isRequired,
  rejectedLabOrders: PropTypes.arrayOf(PropTypes.object).isRequired,
  loadingRejectedLabs: PropTypes.bool.isRequired,
  onViewInfo: PropTypes.func.isRequired,
  onStartVisit: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  onRescheduleLabOrder: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

export default QueueSidebar;
