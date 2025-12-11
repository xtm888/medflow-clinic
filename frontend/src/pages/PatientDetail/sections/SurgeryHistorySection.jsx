import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scissors, Calendar, Eye, User, FileText, Clock, ChevronRight,
  CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import surgeryService from '../../../services/surgeryService';

/**
 * SurgeryHistorySection - Shows patient's surgery history in PatientDetail
 */
export default function SurgeryHistorySection({ patientId }) {
  const navigate = useNavigate();
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    if (loaded || !patientId) return;
    try {
      setLoading(true);
      const response = await surgeryService.getPatientSurgeries(patientId);
      setSurgeries(response.data || []);
      setLoaded(true);
    } catch (err) {
      console.error('Error loading patient surgeries:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusInfo = (status) => {
    const statuses = {
      awaiting_scheduling: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      scheduled: { label: 'Programmée', color: 'bg-blue-100 text-blue-700', icon: Calendar },
      checked_in: { label: 'Check-in', color: 'bg-indigo-100 text-indigo-700', icon: User },
      in_surgery: { label: 'En cours', color: 'bg-purple-100 text-purple-700', icon: Scissors },
      completed: { label: 'Terminée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircle }
    };
    return statuses[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
  };

  const completedCount = surgeries.filter(s => s.status === 'completed').length;
  const pendingCount = surgeries.filter(s => !['completed', 'cancelled'].includes(s.status)).length;

  return (
    <CollapsibleSection
      title="Historique chirurgical"
      icon={Scissors}
      iconColor="text-purple-600"
      gradient="from-purple-50 to-pink-50"
      badge={
        surgeries.length > 0 && (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            {surgeries.length}
          </span>
        )
      }
      headerExtra={
        loaded && surgeries.length > 0 && (
          <>
            <span className="text-green-600">{completedCount} terminée(s)</span>
            {pendingCount > 0 && <span className="text-yellow-600">{pendingCount} en cours</span>}
          </>
        )
      }
      defaultExpanded={false}
      loading={loading}
      onExpand={loadData}
    >
      {surgeries.length === 0 ? (
        <SectionEmptyState
          icon={Scissors}
          message="Aucune chirurgie enregistrée pour ce patient"
        />
      ) : (
        <div className="space-y-3">
          {surgeries.map((surgery) => {
            const statusInfo = getStatusInfo(surgery.status);
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={surgery._id}
                className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition cursor-pointer"
                onClick={() => navigate(`/surgery/${surgery._id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={`p-2 rounded-full ${statusInfo.color}`}>
                      <StatusIcon className="h-5 w-5" />
                    </div>

                    {/* Surgery Info */}
                    <div>
                      <p className="font-medium text-gray-900">
                        {surgery.surgeryType?.name || 'Type non défini'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {surgery.eye && surgery.eye !== 'N/A' && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {surgery.eye}
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          {surgery.surgeryEndTime
                            ? formatDate(surgery.surgeryEndTime)
                            : surgery.scheduledDate
                            ? `Prévue: ${formatDate(surgery.scheduledDate)}`
                            : `Créée: ${formatDate(surgery.createdAt)}`}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>

                    {/* Surgeon */}
                    {surgery.surgeon && (
                      <div className="hidden md:flex items-center gap-1 text-sm text-gray-600">
                        <User className="h-4 w-4" />
                        Dr. {surgery.surgeon.lastName}
                      </div>
                    )}

                    {/* Report indicator */}
                    {surgery.surgeryReport && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <FileText className="h-4 w-4" />
                        Rapport
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>

                {/* Complications Warning */}
                {surgery.surgeryReport?.complications?.occurred && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-2">
                    <AlertTriangle className="h-4 w-4" />
                    Complications signalées
                  </div>
                )}

                {/* IOL Info for cataract surgeries */}
                {surgery.iolDetails?.model && (
                  <div className="mt-2 text-sm text-gray-600 bg-purple-50 rounded p-2">
                    IOL: {surgery.iolDetails.model} - {surgery.iolDetails.power}D
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
