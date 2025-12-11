import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, User, Eye, ChevronRight, DoorOpen } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import surgeryService from '../../../services/surgeryService';
import ConfirmationModal from '../../../components/ConfirmationModal';

/**
 * SurgeryQueueSection - Patients awaiting scheduling
 */
export default function SurgeryQueueSection({ count, onRefresh }) {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(60);
  const [orRooms, setOrRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const loadData = async () => {
    if (loaded) return;
    try {
      setLoading(true);
      const response = await surgeryService.getAwaitingScheduling();
      setCases(response.data || []);
      setLoaded(true);
    } catch (err) {
      console.error('Error loading surgery queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadORRooms = async () => {
    try {
      setLoadingRooms(true);
      const response = await surgeryService.getORRooms();
      setOrRooms(response.data || []);
    } catch (err) {
      console.error('Error loading OR rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleOpenScheduleModal = (surgeryCase) => {
    setSelectedCase(surgeryCase);
    setScheduleDate('');
    setSelectedRoom('');
    setEstimatedDuration(surgeryCase.surgeryType?.duration || 60);
    setScheduleModal(true);
    loadORRooms();
  };

  const handleCloseScheduleModal = () => {
    setScheduleModal(false);
    setSelectedCase(null);
    setScheduleDate('');
    setSelectedRoom('');
  };

  const handleSchedule = async () => {
    if (!selectedCase || !scheduleDate) return;
    try {
      await surgeryService.scheduleCase(
        selectedCase._id,
        scheduleDate,
        selectedRoom || null,
        estimatedDuration
      );
      handleCloseScheduleModal();
      setLoaded(false);
      loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Error scheduling surgery:', err);
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

  const getDaysWaiting = (paymentDate) => {
    if (!paymentDate) return 0;
    const now = new Date();
    const payment = new Date(paymentDate);
    return Math.floor((now - payment) / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <CollapsibleSection
        title="File d'attente"
        icon={Clock}
        iconColor="text-yellow-600"
        gradient="from-yellow-50 to-amber-50"
        badge={
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            {count}
          </span>
        }
        defaultExpanded={count > 0}
        loading={loading}
        onExpand={loadData}
        actions={
          <SectionActionButton
            icon={Calendar}
            variant="ghost"
            onClick={() => navigate('/surgery/agenda')}
          >
            Voir l'agenda
          </SectionActionButton>
        }
      >
        {cases.length === 0 ? (
          <SectionEmptyState
            icon={Clock}
            message="Aucun patient en attente de programmation"
          />
        ) : (
          <div className="space-y-3">
            {cases.map((surgeryCase) => (
              <div
                key={surgeryCase._id}
                className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
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
                      <p className="text-xs text-gray-500">
                        {surgeryCase.surgeryType?.category}
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

                    {/* Days Waiting */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      getDaysWaiting(surgeryCase.paymentDate) > 30
                        ? 'bg-red-100 text-red-700'
                        : getDaysWaiting(surgeryCase.paymentDate) > 14
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {getDaysWaiting(surgeryCase.paymentDate)}j d'attente
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenScheduleModal(surgeryCase)}
                      className="btn btn-sm btn-primary"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Programmer
                    </button>
                    <button
                      onClick={() => navigate(`/surgery/${surgeryCase._id}`)}
                      className="p-2 hover:bg-gray-200 rounded-full"
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

      {/* Schedule Modal */}
      <ConfirmationModal
        isOpen={scheduleModal}
        onClose={handleCloseScheduleModal}
        onConfirm={handleSchedule}
        title="Programmer la chirurgie"
        message={
          <div className="space-y-4">
            <p>
              Programmer la chirurgie pour{' '}
              <strong>
                {selectedCase?.patient?.firstName} {selectedCase?.patient?.lastName}
              </strong>
            </p>
            <p className="text-sm text-gray-500">
              {selectedCase?.surgeryType?.name} {selectedCase?.eye && selectedCase.eye !== 'N/A' ? `- ${selectedCase.eye}` : ''}
            </p>

            {/* Date/Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date et heure
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* OR Room Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DoorOpen className="h-4 w-4 inline mr-1" />
                Salle d'opération
              </label>
              {loadingRooms ? (
                <p className="text-sm text-gray-500">Chargement des salles...</p>
              ) : orRooms.length > 0 ? (
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">-- Sélectionner une salle --</option>
                  {orRooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.name} ({room.roomNumber})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 italic">Aucune salle d'opération configurée</p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée estimée (minutes)
              </label>
              <select
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 heure</option>
                <option value={90}>1h30</option>
                <option value={120}>2 heures</option>
                <option value={180}>3 heures</option>
              </select>
            </div>
          </div>
        }
        confirmText="Programmer"
        confirmButtonClass="bg-purple-600 hover:bg-purple-700 text-white"
        disabled={!scheduleDate}
      />
    </>
  );
}
