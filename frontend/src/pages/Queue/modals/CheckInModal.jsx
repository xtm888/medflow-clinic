/**
 * CheckInModal - Modal for checking in patients with appointments
 */
import { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import {
  X, Search, User, Clock, MapPin, Crown, Baby,
  UserCheck, Calendar, CheckCircle, AlertTriangle
} from 'lucide-react';

// Priority configuration
const PRIORITIES = [
  { value: 'normal', label: 'Normal', color: 'bg-gray-100 text-gray-700', icon: User },
  { value: 'elderly', label: 'Personne Âgée', color: 'bg-blue-100 text-blue-700', icon: UserCheck, minAge: 60 },
  { value: 'pregnant', label: 'Femme Enceinte', color: 'bg-pink-100 text-pink-700', icon: Baby },
  { value: 'vip', label: 'VIP', color: 'bg-purple-100 text-purple-700', icon: Crown },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  { value: 'emergency', label: 'Urgence', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
];

function CheckInModal({
  isOpen,
  onClose,
  onSubmit,
  appointments = [],
  rooms = [],
  loadingAppointments = false,
  loadingRooms = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [priority, setPriority] = useState('normal');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedAppointment(null);
      setPriority('normal');
      setSelectedRoom('');
    }
  }, [isOpen]);

  // Auto-suggest priority based on age
  useEffect(() => {
    if (selectedAppointment?.patient) {
      const patient = selectedAppointment.patient;
      const age = patient.age || calculateAge(patient.dateOfBirth);
      if (age >= 60) {
        setPriority('elderly');
      } else {
        setPriority('normal');
      }
    }
  }, [selectedAppointment]);

  const calculateAge = (dob) => {
    if (!dob) return 0;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Filter appointments by search
  const filteredAppointments = appointments.filter(apt => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const patient = apt.patient || {};
    return (
      patient.firstName?.toLowerCase().includes(query) ||
      patient.lastName?.toLowerCase().includes(query) ||
      patient.patientId?.toLowerCase().includes(query) ||
      patient.phone?.includes(query)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setSubmitting(true);
    try {
      await onSubmit({
        appointmentId: selectedAppointment._id,
        priority,
        room: selectedRoom || undefined
      });
      onClose();
    } catch (error) {
      console.error('Check-in error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Enregistrer un Patient</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un rendez-vous
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, ID patient, téléphone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Appointments List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rendez-vous du jour ({filteredAppointments.length})
            </label>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {loadingAppointments ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2" />
                  Chargement...
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'Aucun résultat' : 'Aucun rendez-vous aujourd\'hui'}
                </div>
              ) : (
                filteredAppointments.map((apt) => {
                  const patient = apt.patient || {};
                  const isSelected = selectedAppointment?._id === apt._id;
                  return (
                    <button
                      key={apt._id}
                      type="button"
                      onClick={() => setSelectedAppointment(apt)}
                      className={`w-full px-4 py-3 text-left border-b last:border-b-0 transition-colors ${
                        isSelected
                          ? 'bg-green-50 border-green-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-green-200' : 'bg-gray-200'
                          }`}>
                            <User className={`h-5 w-5 ${isSelected ? 'text-green-700' : 'text-gray-600'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {apt.appointmentType || apt.reason || 'Consultation'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">
                            <Clock className="h-4 w-4 inline mr-1" />
                            {apt.time || new Date(apt.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {patient.patientId && (
                            <p className="text-xs text-gray-400">{patient.patientId}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Patient Info */}
          {selectedAppointment && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium mb-1">Patient sélectionné:</p>
              <p className="text-green-900 font-semibold">
                {selectedAppointment.patient?.firstName} {selectedAppointment.patient?.lastName}
              </p>
            </div>
          )}

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priorité
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const Icon = p.icon;
                const isSelected = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `${p.color} border-current font-medium`
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salle (optionnel)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none"
                disabled={loadingRooms}
              >
                <option value="">Sélectionner une salle...</option>
                {rooms.map((room) => (
                  <option key={room._id || room.roomNumber} value={room.roomNumber}>
                    {room.name || `Salle ${room.roomNumber}`}
                    {room.department && ` - ${room.department}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!selectedAppointment || submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CheckInModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  appointments: PropTypes.array,
  rooms: PropTypes.array,
  loadingAppointments: PropTypes.bool,
  loadingRooms: PropTypes.bool
};

export default memo(CheckInModal);
