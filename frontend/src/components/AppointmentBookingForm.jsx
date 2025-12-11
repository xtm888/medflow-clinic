import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, Clock, User, FileText, X, Save, AlertCircle, AlertTriangle } from 'lucide-react';
import PatientSelector from '../modules/patient/PatientSelector';
import appointmentService from '../services/appointmentService';

const AUTOSAVE_KEY = 'medflow_appointment_draft';
const AUTOSAVE_DEBOUNCE = 1000; // 1 second

/**
 * Shared Appointment Booking Form Component
 *
 * Used in:
 * - Appointments.jsx (staff booking)
 * - PatientAppointments.jsx (patient self-booking)
 * - PublicBooking.jsx (public booking)
 *
 * Props:
 * - isOpen: boolean - Modal visibility
 * - onClose: function - Close handler
 * - onSubmit: function(appointmentData) - Submit handler
 * - initialData: object - Pre-populated form data
 * - mode: 'staff' | 'patient' | 'public' - Determines which fields to show
 * - patientId: string - For patient mode (pre-selected patient)
 */
export default function AppointmentBookingForm({
  isOpen,
  onClose,
  onSubmit,
  initialData = {},
  mode = 'staff', // 'staff', 'patient', 'public'
  patientId = null,
  providers = []
}) {
  // Load saved draft from localStorage
  const getSavedDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if less than 24 hours old
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
        // Clear expired draft
        localStorage.removeItem(AUTOSAVE_KEY);
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
    return null;
  }, []);

  const savedDraft = getSavedDraft();

  const [formData, setFormData] = useState(() => ({
    patient: patientId || savedDraft?.patient || initialData.patient || null,
    provider: savedDraft?.provider || initialData.provider || '',
    department: savedDraft?.department || initialData.department || '',
    type: savedDraft?.type || initialData.type || 'consultation',
    service: savedDraft?.service || initialData.service || '',
    date: savedDraft?.date || initialData.date || '',
    time: savedDraft?.time || initialData.time || '',
    duration: savedDraft?.duration || initialData.duration || 30,
    reason: savedDraft?.reason || initialData.reason || '',
    notes: savedDraft?.notes || initialData.notes || '',
    ...(savedDraft || initialData)
  }));

  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(savedDraft ? 'restored' : null);
  const autoSaveTimer = useRef(null);

  // Double-booking prevention state
  const [conflictingAppointments, setConflictingAppointments] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const conflictCheckTimer = useRef(null);
  const conflictAbortController = useRef(null);

  // Autosave function
  const saveDraft = useCallback((data) => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      setAutoSaveStatus('saved');
      // Clear status after 2 seconds
      setTimeout(() => setAutoSaveStatus(null), 2000);
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  }, []);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setAutoSaveStatus(null);
  }, []);

  // Dismiss restored draft and use initial values
  const dismissDraft = useCallback(() => {
    clearDraft();
    setFormData({
      patient: patientId || initialData.patient || null,
      provider: initialData.provider || '',
      department: initialData.department || '',
      type: initialData.type || 'consultation',
      service: initialData.service || '',
      date: initialData.date || '',
      time: initialData.time || '',
      duration: initialData.duration || 30,
      reason: initialData.reason || '',
      notes: initialData.notes || '',
      ...initialData
    });
    setAutoSaveStatus(null);
  }, [clearDraft, patientId, initialData]);

  // Check for conflicting appointments
  const checkForConflicts = useCallback(async (data) => {
    // Need date, time, provider, and duration to check
    if (!data.date || !data.time || !data.provider) {
      setConflictingAppointments([]);
      return;
    }

    // Abort previous request to prevent race conditions
    if (conflictAbortController.current) {
      conflictAbortController.current.abort();
    }
    conflictAbortController.current = new AbortController();

    setCheckingConflicts(true);
    try {
      // Fetch appointments for the selected date and provider
      const appointments = await appointmentService.getAppointments({
        date: data.date,
        provider: data.provider,
        signal: conflictAbortController.current.signal
      });

      const duration = data.duration || 30;
      const [startHour, startMin] = data.time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = startMinutes + duration;

      // Check for overlaps
      const appointmentsList = Array.isArray(appointments) ? appointments : [];
      const conflicts = appointmentsList.filter(apt => {
        // Skip cancelled appointments
        const status = apt.status?.toLowerCase();
        if (['cancelled', 'no_show'].includes(status)) return false;

        const aptTime = apt.startTime || apt.time;
        if (!aptTime) return false;

        const [aptHour, aptMin] = aptTime.split(':').map(Number);
        const aptStartMinutes = aptHour * 60 + aptMin;
        const aptDuration = apt.duration || 30;
        const aptEndMinutes = aptStartMinutes + aptDuration;

        // Check if time ranges overlap
        const hasOverlap = startMinutes < aptEndMinutes && endMinutes > aptStartMinutes;
        return hasOverlap;
      });

      setConflictingAppointments(conflicts);
    } catch (error) {
      console.error('Error checking conflicts:', error);
      setConflictingAppointments([]);
    } finally {
      setCheckingConflicts(false);
    }
  }, []);

  // Debounced conflict check when date/time/provider changes
  useEffect(() => {
    if (conflictCheckTimer.current) {
      clearTimeout(conflictCheckTimer.current);
    }

    conflictCheckTimer.current = setTimeout(() => {
      checkForConflicts(formData);
    }, 500); // 500ms debounce

    return () => {
      if (conflictCheckTimer.current) {
        clearTimeout(conflictCheckTimer.current);
      }
    };
  }, [formData.date, formData.time, formData.provider, formData.duration, checkForConflicts]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Debounced autosave
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      autoSaveTimer.current = setTimeout(() => {
        saveDraft(newData);
      }, AUTOSAVE_DEBOUNCE);

      return newData;
    });
  };

  // Cleanup timers and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      if (conflictAbortController.current) {
        conflictAbortController.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      clearDraft(); // Clear draft on successful submission
      onClose();
    } catch (error) {
      console.error('Error submitting appointment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 mr-2 text-primary-600" />
              {mode === 'patient' ? 'Demander un rendez-vous' : 'Nouveau rendez-vous'}
            </h2>
            {/* Autosave status indicator */}
            {autoSaveStatus === 'saved' && (
              <span className="text-xs text-green-600 flex items-center gap-1 animate-pulse">
                <Save className="h-3 w-3" />
                Brouillon sauvegardé
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Restored draft banner */}
        {autoSaveStatus === 'restored' && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Brouillon restauré depuis votre dernière session</span>
            </div>
            <button
              onClick={dismissDraft}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Effacer
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient Selection (Staff & Public modes only) */}
          {mode !== 'patient' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Patient *
              </label>
              <PatientSelector
                selectedPatient={formData.patient}
                onChange={(patient) => handleChange('patient', patient)}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider (Staff mode only) */}
            {mode === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Praticien *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => handleChange('provider', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Sélectionner un praticien</option>
                  {providers.map(provider => (
                    <option key={provider._id} value={provider._id}>
                      {provider.firstName} {provider.lastName} - {provider.specialization || provider.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department (Staff mode) */}
            {mode === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Département
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  className="input"
                >
                  <option value="">Sélectionner un département</option>
                  <option value="general">Médecine Générale</option>
                  <option value="ophthalmology">Ophtalmologie</option>
                  <option value="pediatrics">Pédiatrie</option>
                </select>
              </div>
            )}

            {/* Appointment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'patient' ? 'Service' : 'Type'} *
              </label>
              <select
                value={mode === 'patient' ? formData.service : formData.type}
                onChange={(e) => handleChange(mode === 'patient' ? 'service' : 'type', e.target.value)}
                className="input"
                required
              >
                <option value="">Sélectionner {mode === 'patient' ? 'un service' : 'un type'}</option>
                <option value="consultation">Consultation</option>
                <option value="follow-up">Suivi</option>
                <option value="emergency">Urgence</option>
                <option value="procedure">Procédure</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                {mode === 'patient' ? 'Date préférée' : 'Date'} *
              </label>
              <input
                type="date"
                value={mode === 'patient' ? formData.preferredDate : formData.date}
                onChange={(e) => handleChange(mode === 'patient' ? 'preferredDate' : 'date', e.target.value)}
                className="input"
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                {mode === 'patient' ? 'Heure préférée' : 'Heure'} *
              </label>
              <input
                type="time"
                value={mode === 'patient' ? formData.preferredTime : formData.time}
                onChange={(e) => handleChange(mode === 'patient' ? 'preferredTime' : 'time', e.target.value)}
                className={`input ${conflictingAppointments.length > 0 ? 'border-orange-500 focus:ring-orange-500' : ''}`}
                required
              />
            </div>

            {/* Duration (Staff mode only) */}
            {mode === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durée (minutes)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                  className="input"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 heure</option>
                  <option value={90}>1h30</option>
                </select>
              </div>
            )}
          </div>

          {/* Double-booking Warning */}
          {checkingConflicts && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
              Vérification des disponibilités...
            </div>
          )}

          {conflictingAppointments.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-800">Conflit de créneau détecté</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Ce praticien a déjà {conflictingAppointments.length} rendez-vous prévu(s) sur ce créneau horaire:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {conflictingAppointments.map((apt, idx) => {
                      const patientName = apt.patient && typeof apt.patient === 'object'
                        ? `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim()
                        : 'Patient';
                      return (
                        <li key={idx} className="text-sm text-orange-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                          {apt.startTime || apt.time} - {patientName} ({apt.type || 'Consultation'})
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-orange-600 mt-2 italic">
                    Vous pouvez continuer, mais le praticien sera peut-être surchargé.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Motif de visite *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              className="input"
              rows="3"
              placeholder="Brève description du motif de ce rendez-vous..."
              required
            />
          </div>

          {/* Notes (Staff mode only) */}
          {mode === 'staff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes supplémentaires
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="input"
                rows="3"
                placeholder="Notes internes (non visibles par le patient)..."
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Réservation...' : (mode === 'patient' ? 'Demander le rendez-vous' : 'Réserver')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
