import { useState } from 'react';
import { Calendar, Clock, User, FileText, X } from 'lucide-react';
import PatientSelector from './PatientSelector';

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
  patientId = null
}) {
  const [formData, setFormData] = useState({
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

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
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
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-primary-600" />
            {mode === 'patient' ? 'Request Appointment' : 'New Appointment'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
                  Provider *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => handleChange('provider', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select Provider</option>
                  <option value="dr-smith">Dr. Smith</option>
                  <option value="dr-jones">Dr. Jones</option>
                </select>
              </div>
            )}

            {/* Department (Staff mode) */}
            {mode === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  className="input"
                >
                  <option value="">Select Department</option>
                  <option value="general">General Medicine</option>
                  <option value="ophthalmology">Ophthalmology</option>
                  <option value="pediatrics">Pediatrics</option>
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
                <option value="">Select {mode === 'patient' ? 'Service' : 'Type'}</option>
                <option value="consultation">Consultation</option>
                <option value="follow-up">Follow-up</option>
                <option value="emergency">Emergency</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                {mode === 'patient' ? 'Preferred Date' : 'Date'} *
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
                {mode === 'patient' ? 'Preferred Time' : 'Time'} *
              </label>
              <input
                type="time"
                value={mode === 'patient' ? formData.preferredTime : formData.time}
                onChange={(e) => handleChange(mode === 'patient' ? 'preferredTime' : 'time', e.target.value)}
                className="input"
                required
              />
            </div>

            {/* Duration (Staff mode only) */}
            {mode === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                  className="input"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                </select>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Reason for Visit *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              className="input"
              rows="3"
              placeholder="Brief description of the reason for this appointment..."
              required
            />
          </div>

          {/* Notes (Staff mode only) */}
          {mode === 'staff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="input"
                rows="3"
                placeholder="Internal notes (not visible to patient)..."
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
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Booking...' : (mode === 'patient' ? 'Request Appointment' : 'Book Appointment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
