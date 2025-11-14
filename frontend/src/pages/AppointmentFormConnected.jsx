import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, User, MapPin, FileText, Save, ArrowLeft, Search } from 'lucide-react';
import { useAppointments, usePatients, useAuth, useAppDispatch } from '../hooks/useRedux';
import { fetchAppointmentDetails, createAppointment, updateAppointment } from '../store/slices/appointmentSlice';
import { searchPatients } from '../store/slices/patientSlice';
import { addToast } from '../store/slices/notificationSlice';
import { appointmentService } from '../services';

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
];

const departments = [
  'General', 'Ophthalmology', 'Cardiology', 'Dermatology',
  'Pediatrics', 'Orthopedics', 'Neurology', 'Gynecology'
];

const appointmentTypes = [
  'Consultation', 'Follow-up', 'Emergency', 'Routine Check',
  'Vaccination', 'Surgery', 'Lab Test', 'Imaging'
];

export default function AppointmentFormConnected() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const { currentAppointment, loading } = useAppointments();
  const { searchResults } = usePatients();
  const { user, hasPermission } = useAuth();

  const isEdit = !!id;
  const prefilledPatientId = searchParams.get('patientId');

  const [formData, setFormData] = useState({
    patientId: prefilledPatientId || '',
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    dateTime: '',
    appointmentType: 'Consultation',
    department: 'General',
    doctorId: '',
    doctorName: '',
    reason: '',
    notes: '',
    duration: '30',
    location: '',
    reminderSent: false,
    status: 'pending'
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [doctors, setDoctors] = useState([]);

  // Fetch appointment details if editing
  useEffect(() => {
    if (isEdit && id) {
      dispatch(fetchAppointmentDetails(id));
    }
  }, [isEdit, id, dispatch]);

  // Populate form with appointment data
  useEffect(() => {
    if (isEdit && currentAppointment) {
      const dateTime = new Date(currentAppointment.dateTime);
      const date = dateTime.toISOString().split('T')[0];
      const time = dateTime.toTimeString().slice(0, 5);

      setFormData({
        patientId: currentAppointment.patientId || '',
        patientName: currentAppointment.patientName || '',
        patientPhone: currentAppointment.patientPhone || '',
        patientEmail: currentAppointment.patientEmail || '',
        dateTime: `${date}T${time}`,
        appointmentType: currentAppointment.appointmentType || 'Consultation',
        department: currentAppointment.department || 'General',
        doctorId: currentAppointment.doctorId || '',
        doctorName: currentAppointment.doctorName || '',
        reason: currentAppointment.reason || '',
        notes: currentAppointment.notes || '',
        duration: currentAppointment.duration || '30',
        location: currentAppointment.location || '',
        reminderSent: currentAppointment.reminderSent || false,
        status: currentAppointment.status || 'pending'
      });
      setSelectedDate(date);
    }
  }, [isEdit, currentAppointment]);

  // Fetch patient details if patientId is prefilled
  useEffect(() => {
    if (prefilledPatientId && !isEdit) {
      fetchPatientDetails(prefilledPatientId);
    }
  }, [prefilledPatientId, isEdit]);

  // Fetch available doctors for department
  useEffect(() => {
    if (formData.department) {
      fetchDoctorsForDepartment(formData.department);
    }
  }, [formData.department]);

  // Check slot availability when date changes
  useEffect(() => {
    if (selectedDate && formData.doctorId) {
      checkSlotAvailability();
    }
  }, [selectedDate, formData.doctorId]);

  const fetchPatientDetails = async (patientId) => {
    try {
      const response = await appointmentService.getPatientForAppointment(patientId);
      if (response.success) {
        const patient = response.data;
        setFormData(prev => ({
          ...prev,
          patientId: patient._id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          patientPhone: patient.phone || '',
          patientEmail: patient.email || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
    }
  };

  const fetchDoctorsForDepartment = async (department) => {
    try {
      const response = await appointmentService.getDoctorsByDepartment(department);
      if (response.success) {
        setDoctors(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setDoctors([]);
    }
  };

  const checkSlotAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const response = await appointmentService.getAvailableSlots({
        date: selectedDate,
        doctorId: formData.doctorId,
        department: formData.department
      });

      if (response.success) {
        setAvailableSlots(response.data || timeSlots);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableSlots(timeSlots);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePatientSearch = async (searchTerm) => {
    setPatientSearch(searchTerm);
    if (searchTerm.length >= 3) {
      setSearchingPatient(true);
      try {
        await dispatch(searchPatients(searchTerm));
      } finally {
        setSearchingPatient(false);
      }
    }
  };

  const handlePatientSelect = (patient) => {
    setFormData(prev => ({
      ...prev,
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientPhone: patient.phone || '',
      patientEmail: patient.email || ''
    }));
    setShowPatientSearch(false);
    setPatientSearch('');
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleTimeSelect = (time) => {
    setFormData(prev => ({
      ...prev,
      dateTime: `${selectedDate}T${time}`
    }));
  };

  const handleDoctorChange = (e) => {
    const doctorId = e.target.value;
    const doctor = doctors.find(d => d._id === doctorId);

    setFormData(prev => ({
      ...prev,
      doctorId: doctorId,
      doctorName: doctor ? `${doctor.firstName} ${doctor.lastName}` : ''
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.patientId) {
      newErrors.patientId = 'Please select a patient';
    }

    if (!formData.dateTime) {
      newErrors.dateTime = 'Please select date and time';
    } else {
      const appointmentDate = new Date(formData.dateTime);
      if (appointmentDate < new Date()) {
        newErrors.dateTime = 'Appointment cannot be in the past';
      }
    }

    if (!formData.appointmentType) {
      newErrors.appointmentType = 'Appointment type is required';
    }

    if (!formData.department) {
      newErrors.department = 'Department is required';
    }

    if (!formData.doctorId) {
      newErrors.doctorId = 'Please select a doctor';
    }

    if (!formData.reason) {
      newErrors.reason = 'Reason for appointment is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      dispatch(addToast({
        type: 'error',
        message: 'Please fill in all required fields'
      }));
      return;
    }

    setSubmitting(true);

    try {
      let result;
      if (isEdit) {
        result = await dispatch(updateAppointment({ id, data: formData })).unwrap();
      } else {
        result = await dispatch(createAppointment(formData)).unwrap();
      }

      dispatch(addToast({
        type: 'success',
        message: `Appointment ${isEdit ? 'updated' : 'scheduled'} successfully`
      }));

      navigate(`/appointments/${result._id || result.id}`);
    } catch (error) {
      dispatch(addToast({
        type: 'error',
        message: error.message || `Failed to ${isEdit ? 'update' : 'schedule'} appointment`
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission(['doctor', 'nurse', 'receptionist'])) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">You don't have permission to {isEdit ? 'edit' : 'schedule'} appointments.</p>
        </div>
      </div>
    );
  }

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentDateTime = formData.dateTime ? new Date(formData.dateTime) : null;
  const currentTime = currentDateTime ? currentDateTime.toTimeString().slice(0, 5) : '';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/appointments')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Appointment' : 'Schedule New Appointment'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isEdit ? 'Update appointment details' : 'Fill in the appointment information below'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <div className="card">
          <div className="flex items-center mb-4 pb-3 border-b">
            <User className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
          </div>

          {!formData.patientId || showPatientSearch ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Patient <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => handlePatientSearch(e.target.value)}
                    placeholder="Search by name, ID, phone, or email..."
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {errors.patientId && <p className="mt-1 text-sm text-red-600">{errors.patientId}</p>}
              </div>

              {/* Search Results */}
              {searchingPatient ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {searchResults.map(patient => (
                    <button
                      key={patient._id}
                      type="button"
                      onClick={() => handlePatientSelect(patient)}
                      className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        ID: {patient.patientId || patient._id} • Phone: {patient.phone}
                      </p>
                    </button>
                  ))}
                </div>
              ) : patientSearch.length >= 3 ? (
                <p className="text-gray-500 text-center py-4">No patients found</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">
                  {formData.patientName}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  ID: {formData.patientId}
                </p>
                {formData.patientPhone && (
                  <p className="text-sm text-gray-600">Phone: {formData.patientPhone}</p>
                )}
                {formData.patientEmail && (
                  <p className="text-sm text-gray-600">Email: {formData.patientEmail}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPatientSearch(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  Change Patient
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Appointment Details */}
        <div className="card">
          <div className="flex items-center mb-4 pb-3 border-b">
            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
          </div>

          <div className="space-y-4">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {/* Time Selection */}
            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time <span className="text-red-500">*</span>
                </label>
                {checkingAvailability ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-500 mt-2">Checking availability...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-2">
                    {availableSlots.map(time => {
                      const isSelected = currentTime === time;
                      const isAvailable = !formData.doctorId || availableSlots.includes(time);

                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleTimeSelect(time)}
                          disabled={!isAvailable}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : isAvailable
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.dateTime && <p className="mt-2 text-sm text-red-600">{errors.dateTime}</p>}
              </div>
            )}

            {/* Department and Doctor */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  name="doctorId"
                  value={formData.doctorId}
                  onChange={handleDoctorChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.firstName} {doctor.lastName}
                    </option>
                  ))}
                </select>
                {errors.doctorId && <p className="mt-1 text-sm text-red-600">{errors.doctorId}</p>}
              </div>
            </div>

            {/* Appointment Type and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="appointmentType"
                  value={formData.appointmentType}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {appointmentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.appointmentType && <p className="mt-1 text-sm text-red-600">{errors.appointmentType}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location/Room
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., Room 101, Building A"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Appointment <span className="text-red-500">*</span>
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows="3"
                placeholder="Brief description of the reason for this appointment..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                placeholder="Any additional notes or special instructions..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="reminderSent"
                  checked={formData.reminderSent}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Send reminder to patient</span>
              </label>
            </div>

            {/* Status (only for edit) */}
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no-show">No Show</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/appointments')}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isEdit ? 'Updating...' : 'Scheduling...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'Update Appointment' : 'Schedule Appointment'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}