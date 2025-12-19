import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scissors, Calendar, Users, FileText, Clock, AlertTriangle,
  Loader2, Play, ArrowLeft, Eye, CheckCircle, Edit3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import surgeryService from '../../services/surgeryService';

/**
 * SurgeonView - Dedicated dashboard for surgeons
 *
 * Shows:
 * - Today's scheduled surgeries
 * - Checked-in patients ready for surgery
 * - Draft reports needing completion
 */
export default function SurgeonView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [schedule, setSchedule] = useState([]);
  const [checkedIn, setCheckedIn] = useState([]);
  const [draftReports, setDraftReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [scheduleRes, checkedInRes, draftsRes] = await Promise.all([
        surgeryService.getSurgeonSchedule(selectedDate),
        surgeryService.getSurgeonCheckedInPatients(),
        surgeryService.getSurgeonDraftReports()
      ]);

      // Handle nested response structure from offlineWrapper
      const extractData = (res) => {
        if (!res) return [];
        // Try res.data.data first (offlineWrapper double-nesting)
        if (res.data?.data && Array.isArray(res.data.data)) return res.data.data;
        // Try res.data
        if (res.data && Array.isArray(res.data)) return res.data;
        // Try res directly
        if (Array.isArray(res)) return res;
        return [];
      };

      setSchedule(extractData(scheduleRes));
      setCheckedIn(extractData(checkedInRes));
      setDraftReports(extractData(draftsRes));
    } catch (err) {
      console.error('Error fetching surgeon data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPatientName = (patient) => {
    if (!patient) return 'Patient inconnu';
    return `${patient.lastName || ''} ${patient.firstName || ''}`.trim() || 'Patient inconnu';
  };

  const getStatusBadge = (status) => {
    const styles = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'checked_in': 'bg-yellow-100 text-yellow-800',
      'in_surgery': 'bg-red-100 text-red-800',
      'completed': 'bg-green-100 text-green-800'
    };
    const labels = {
      'scheduled': 'Programmé',
      'checked_in': 'Check-in',
      'in_surgery': 'En cours',
      'completed': 'Terminé'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement de votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/surgery')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Scissors className="h-8 w-8 text-purple-600" />
              Vue Chirurgien
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Bienvenue, Dr. {user?.lastName || user?.firstName || 'Chirurgien'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Programmées aujourd'hui</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{schedule.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Patients check-in</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{checkedIn.length}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Users className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Rapports en attente</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{draftReports.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Checked-in Patients - Priority Section */}
      {checkedIn.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-yellow-800 flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            Patients en attente de chirurgie ({checkedIn.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checkedIn.map((surgery) => (
              <div
                key={surgery._id}
                className="bg-white rounded-lg shadow-sm border border-yellow-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/surgery/${surgery._id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {formatPatientName(surgery.patient)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {surgery.surgeryType?.name || 'Chirurgie'}
                    </p>
                    {surgery.eye && surgery.eye !== 'N/A' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Oeil: {surgery.eye}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(surgery.status)}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {surgery.status === 'checked_in' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/surgery/${surgery._id}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <Play className="h-4 w-4" />
                      Commencer
                    </button>
                  )}
                  {surgery.status === 'in_surgery' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/surgery/${surgery._id}/report`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      Rapport
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Planning du {new Date(selectedDate).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </h2>
        </div>

        {schedule.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Aucune chirurgie programmée pour cette date</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {schedule.map((surgery) => (
              <div
                key={surgery._id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/surgery/${surgery._id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-bold text-gray-900">
                        {formatTime(surgery.scheduledDate)}
                      </p>
                      <p className="text-xs text-gray-500">
                        ~{surgery.estimatedDuration || 60} min
                      </p>
                    </div>
                    <div className="border-l border-gray-200 pl-4">
                      <p className="font-semibold text-gray-900">
                        {formatPatientName(surgery.patient)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {surgery.surgeryType?.name || 'Chirurgie'}
                        {surgery.eye && surgery.eye !== 'N/A' && ` - ${surgery.eye}`}
                      </p>
                      {surgery.operatingRoom && (
                        <p className="text-xs text-gray-500 mt-1">
                          Salle: {surgery.operatingRoom.name || surgery.operatingRoom.roomNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(surgery.status)}
                    <Eye className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Draft Reports */}
      {draftReports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-orange-600" />
              Rapports en brouillon ({draftReports.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {draftReports.map((report) => (
              <div
                key={report._id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/surgery/${report.surgeryCase?._id || report.surgeryCase}/report`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {formatPatientName(report.patient)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {report.surgeryType?.name || 'Chirurgie'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Commencé le {new Date(report.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                      Brouillon
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/surgery/${report.surgeryCase?._id || report.surgeryCase}/report`);
                      }}
                      className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {schedule.length === 0 && checkedIn.length === 0 && draftReports.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Tout est en ordre !
          </h3>
          <p className="text-gray-500">
            Aucune chirurgie programmée, aucun patient en attente, aucun rapport en cours.
          </p>
        </div>
      )}
    </div>
  );
}
