/**
 * RoomModal - Modal for selecting room when calling a patient
 */
import { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import {
  X, MapPin, User, Volume2, VolumeX, Phone, AlertTriangle
} from 'lucide-react';

function RoomModal({
  isOpen,
  onClose,
  onConfirm,
  patient,
  rooms = [],
  loadingRooms = false,
  enableAudio = true,
  onToggleAudio
}) {
  const [selectedRoom, setSelectedRoom] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRoom('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!selectedRoom) return;

    setConfirming(true);
    try {
      await onConfirm(selectedRoom);
      onClose();
    } catch (error) {
      console.error('Room selection error:', error);
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) return null;

  const patientInfo = patient?.patient || patient;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Appeler le Patient</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Info */}
          {patientInfo && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                  <User className="h-6 w-6 text-purple-700" />
                </div>
                <div>
                  <p className="font-semibold text-purple-900">
                    {patientInfo.firstName} {patientInfo.lastName}
                  </p>
                  {patientInfo.patientId && (
                    <p className="text-sm text-purple-600">ID: {patientInfo.patientId}</p>
                  )}
                  {patient?.priority && patient.priority !== 'normal' && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      patient.priority === 'urgent' || patient.priority === 'emergency'
                        ? 'bg-red-100 text-red-700'
                        : patient.priority === 'vip'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {patient.priority.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Room Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner une salle *
            </label>
            {loadingRooms ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Aucune salle disponible</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {rooms.map((room) => {
                  const isSelected = selectedRoom === (room.roomNumber || room._id);
                  return (
                    <button
                      key={room._id || room.roomNumber}
                      type="button"
                      onClick={() => setSelectedRoom(room.roomNumber || room._id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className={`h-4 w-4 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                          {room.name || `Salle ${room.roomNumber}`}
                        </span>
                      </div>
                      {room.department && (
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                          {room.department}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audio Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              {enableAudio ? (
                <Volume2 className="h-5 w-5 text-blue-600" />
              ) : (
                <VolumeX className="h-5 w-5 text-gray-400" />
              )}
              <span className="text-sm text-gray-700">Annonce vocale</span>
            </div>
            <button
              type="button"
              onClick={onToggleAudio}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableAudio ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enableAudio ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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
              onClick={handleConfirm}
              disabled={!selectedRoom || confirming}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {confirming ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Appel...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4" />
                  Appeler
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

RoomModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  patient: PropTypes.object,
  rooms: PropTypes.array,
  loadingRooms: PropTypes.bool,
  enableAudio: PropTypes.bool,
  onToggleAudio: PropTypes.func
};

export default memo(RoomModal);
