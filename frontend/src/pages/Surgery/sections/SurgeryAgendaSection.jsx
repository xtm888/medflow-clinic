import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, User, Eye, Clock, UserCheck, Play, ChevronRight,
  ChevronLeft
} from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import surgeryService from '../../../services/surgeryService';

/**
 * SurgeryAgendaSection - Today's surgery schedule
 */
export default function SurgeryAgendaSection({ count, onRefresh }) {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await surgeryService.getAgenda(selectedDate);
      // Handle various API response formats defensively
      const casesData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.cases)
        ? response.data.cases
        : Array.isArray(response?.data?.items)
        ? response.data.items
        : Array.isArray(response)
        ? response
        : [];
      setCases(casesData);
      setLoaded(true);
    } catch (err) {
      console.error('Error loading surgery agenda:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loaded) {
      loadData();
    }
  }, [selectedDate]);

  const formatTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Programmée' },
      checked_in: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Check-in' },
      in_surgery: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En cours' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Terminée' }
    };
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <CollapsibleSection
      title="Agenda opératoire"
      icon={Calendar}
      iconColor="text-blue-600"
      gradient="from-blue-50 to-indigo-50"
      badge={
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          {cases.length}
        </span>
      }
      defaultExpanded={true}
      loading={loading}
      onExpand={loadData}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousDay}
            className="p-1 hover:bg-white/50 rounded"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className={`px-2 py-1 text-xs font-medium rounded ${
              isToday ? 'bg-blue-600 text-white' : 'bg-white/50 text-gray-600 hover:bg-white'
            }`}
          >
            Aujourd'hui
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded bg-white"
          />
          <button
            onClick={goToNextDay}
            className="p-1 hover:bg-white/50 rounded"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      }
    >
      {cases.length === 0 ? (
        <SectionEmptyState
          icon={Calendar}
          message={`Aucune chirurgie programmée pour le ${new Date(selectedDate).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}`}
        />
      ) : (
        <div className="space-y-3">
          {cases.map((surgeryCase, index) => (
            <div
              key={surgeryCase._id}
              className={`rounded-lg p-4 transition ${
                surgeryCase.status === 'in_surgery'
                  ? 'bg-purple-50 border border-purple-200'
                  : surgeryCase.status === 'checked_in'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : surgeryCase.status === 'completed'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Time */}
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-gray-900">
                      {formatTime(surgeryCase.scheduledDate)}
                    </p>
                    <p className="text-xs text-gray-500">#{index + 1}</p>
                  </div>

                  <div className="h-12 w-px bg-gray-300" />

                  {/* Patient Info */}
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {surgeryCase.patient?.firstName} {surgeryCase.patient?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {surgeryCase.patient?.medicalRecordNumber}
                      </p>
                    </div>
                  </div>

                  {/* Surgery Type */}
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-gray-700">
                      {surgeryCase.surgeryType?.name || 'Type non défini'}
                    </p>
                  </div>

                  {/* Eye */}
                  {surgeryCase.eye && surgeryCase.eye !== 'N/A' && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600">
                        {surgeryCase.eye}
                      </span>
                    </div>
                  )}

                  {/* Surgeon */}
                  {surgeryCase.surgeon && (
                    <div className="hidden lg:flex items-center gap-1 text-sm text-gray-600">
                      <UserCheck className="h-4 w-4" />
                      Dr. {surgeryCase.surgeon.lastName}
                    </div>
                  )}

                  {/* Status */}
                  {getStatusBadge(surgeryCase.status)}
                </div>

                <div className="flex items-center gap-2">
                  {surgeryCase.status === 'scheduled' && (
                    <button
                      onClick={() => navigate(`/surgery/${surgeryCase._id}/checkin`)}
                      className="btn btn-sm btn-secondary"
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Check-in
                    </button>
                  )}
                  {surgeryCase.status === 'checked_in' && (
                    <button
                      onClick={() => navigate(`/surgery/${surgeryCase._id}/checkin`)}
                      className="btn btn-sm btn-primary"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Démarrer
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/surgery/${surgeryCase._id}`)}
                    className="p-2 hover:bg-white/50 rounded-full"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
