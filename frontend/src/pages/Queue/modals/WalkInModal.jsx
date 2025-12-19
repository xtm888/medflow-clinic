/**
 * WalkInModal - Modal for adding walk-in patients without appointments
 */
import { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import {
  X, User, Phone, FileText, Crown, Baby,
  UserCheck, AlertTriangle, UserPlus, Search
} from 'lucide-react';
import { PatientSelector } from '../../../modules/patient';

// Priority configuration
const PRIORITIES = [
  { value: 'normal', label: 'Normal', color: 'bg-gray-100 text-gray-700', icon: User },
  { value: 'elderly', label: 'Personne Âgée', color: 'bg-blue-100 text-blue-700', icon: UserCheck },
  { value: 'pregnant', label: 'Femme Enceinte', color: 'bg-pink-100 text-pink-700', icon: Baby },
  { value: 'vip', label: 'VIP', color: 'bg-purple-100 text-purple-700', icon: Crown },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle }
];

// Common visit reasons
const VISIT_REASONS = [
  { value: 'consultation', label: 'Consultation générale' },
  { value: 'follow-up', label: 'Suivi' },
  { value: 'emergency', label: 'Urgence' },
  { value: 'lab', label: 'Laboratoire' },
  { value: 'imaging', label: 'Imagerie' },
  { value: 'prescription', label: 'Renouvellement ordonnance' },
  { value: 'other', label: 'Autre' }
];

function WalkInModal({
  isOpen,
  onClose,
  onSubmit
}) {
  const [mode, setMode] = useState('existing'); // 'existing' or 'new'
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    reason: '',
    customReason: '',
    priority: 'normal'
  });
  const [submitting, setSubmitting] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('existing');
      setSelectedPatient(null);
      setFormData({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        reason: '',
        customReason: '',
        priority: 'normal'
      });
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    if (mode === 'existing' && !selectedPatient) {
      return;
    }
    if (mode === 'new' && (!formData.firstName || !formData.lastName || !formData.phoneNumber)) {
      return;
    }
    if (!formData.reason) {
      return;
    }

    setSubmitting(true);
    try {
      const reason = formData.reason === 'other' ? formData.customReason : formData.reason;

      if (mode === 'existing' && selectedPatient) {
        await onSubmit({
          walkIn: true,
          patientId: selectedPatient._id || selectedPatient.id,
          patientInfo: {
            firstName: selectedPatient.firstName,
            lastName: selectedPatient.lastName,
            phoneNumber: selectedPatient.phoneNumber || selectedPatient.phone
          },
          reason,
          priority: formData.priority
        });
      } else {
        await onSubmit({
          walkIn: true,
          patientInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber
          },
          reason,
          priority: formData.priority
        });
      }
      onClose();
    } catch (error) {
      console.error('Walk-in error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Patient Sans Rendez-vous</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'existing'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Search className="h-4 w-4 inline mr-2" />
              Patient Existant
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'new'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserPlus className="h-4 w-4 inline mr-2" />
              Nouveau Patient
            </button>
          </div>

          {/* Existing Patient Mode */}
          {mode === 'existing' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher un patient
              </label>
              <PatientSelector
                value={selectedPatient}
                onChange={setSelectedPatient}
                placeholder="Rechercher par nom, ID, téléphone..."
              />
              {selectedPatient && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">
                    Patient sélectionné:
                  </p>
                  <p className="text-blue-900 font-semibold">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  {selectedPatient.patientId && (
                    <p className="text-xs text-blue-600">ID: {selectedPatient.patientId}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* New Patient Mode */}
          {mode === 'new' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Prénom"
                    required={mode === 'new'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nom"
                    required={mode === 'new'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+242 06 XXX XXXX"
                    required={mode === 'new'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reason for Visit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motif de visite *
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <select
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                required
              >
                <option value="">Sélectionner un motif...</option>
                {VISIT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            {formData.reason === 'other' && (
              <input
                type="text"
                value={formData.customReason}
                onChange={(e) => handleInputChange('customReason', e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Précisez le motif..."
                required
              />
            )}
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priorité
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const Icon = p.icon;
                const isSelected = formData.priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleInputChange('priority', p.value)}
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
              disabled={submitting || (mode === 'existing' && !selectedPatient) || !formData.reason}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Ajout...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Ajouter à la file
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

WalkInModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired
};

export default memo(WalkInModal);
