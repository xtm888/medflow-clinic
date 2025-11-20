import { Calendar, Clock, Plus, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/apiConfig';
import appointmentService from '../../services/appointmentService';
import authService from '../../services/authService';
import { toast } from 'react-toastify';
import AppointmentBookingForm from '../../components/AppointmentBookingForm';

export default function PatientAppointments() {
  
  const [currentPatient, setCurrentPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Fetch current user and appointments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get current user
        const userResult = await authService.getCurrentUser();
        if (userResult.success) {
          setCurrentPatient(userResult.user);

          // Fetch patient appointments
          const aptResponse = await appointmentService.getAppointments({
            patient: userResult.user._id
          }).catch(() => ({ data: [] }));

          setAppointments(aptResponse.data || []);
        }
      } catch (err) {
        toast.error('Failed to load patient data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const upcoming = appointments.filter(apt => new Date(apt.date) >= new Date());
  const past = appointments.filter(apt => new Date(apt.date) < new Date());

  const getStatusBadge = (status) => {
    const badges = {
      'CONFIRMED': 'badge badge-success',
      'PENDING': 'badge badge-warning',
      'COMPLETED': 'badge bg-blue-100 text-blue-800',
      'CANCELLED': 'badge badge-danger',
      'confirmed': 'badge badge-success',
      'pending': 'badge badge-warning',
      'completed': 'badge bg-blue-100 text-blue-800',
      'cancelled': 'badge badge-danger'
    };
    return badges[status] || 'badge';
  };

  // Handle appointment booking
  const handleBookingSubmit = async (formData) => {
    if (!currentPatient) {
      toast.error('Patient information not loaded');
      throw new Error('Patient information not loaded');
    }

    try {
      // Combine date and time
      const appointmentDateTime = new Date(`${formData.preferredDate}T${formData.preferredTime}`);

      const appointmentData = {
        patient: currentPatient._id,
        date: appointmentDateTime,
        time: formData.preferredTime,
        type: formData.service || 'consultation',
        status: 'pending', // Will need confirmation from staff
        reason: formData.reason,
        notes: formData.service ? `Service requested: ${formData.service}` : ''
      };

      await appointmentService.createAppointment(appointmentData);

      toast.success('Appointment request submitted successfully!');

      // Refresh appointments list
      const aptResponse = await appointmentService.getAppointments({
        patient: currentPatient._id
      });
      setAppointments(aptResponse.data || []);

    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to book appointment');
      throw err; // Re-throw so the component can handle it
    }
  };

  // Handle cancel appointment
  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler ce rendez-vous?')) {
      return;
    }

    try {
      await appointmentService.cancelAppointment(appointmentId, {
        reason: 'Cancelled by patient',
        cancelledBy: currentPatient._id
      });

      toast.success('Appointment cancelled successfully');

      // Refresh appointments
      const aptResponse = await appointmentService.getAppointments({
        patient: currentPatient._id
      });
      setAppointments(aptResponse.data || []);

    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel appointment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Rendez-vous</h1>
          <p className="mt-1 text-sm text-gray-500">
            Consultez et gérez vos rendez-vous médicaux
          </p>
        </div>
        <button
          onClick={() => setShowBookingModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau rendez-vous</span>
        </button>
      </div>

      {/* Upcoming Appointments */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Rendez-vous à venir</h2>
        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <div key={apt.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <p className="font-bold text-gray-900">
                        {format(new Date(apt.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                      </p>
                      <span className={getStatusBadge(apt.status)}>
                        {apt.status === 'CONFIRMED' ? 'Confirmé' : 'En attente'}
                      </span>
                    </div>
                    <div className="ml-8 space-y-1 text-sm text-gray-600">
                      <p><Clock className="h-4 w-4 inline mr-2" />{apt.time} - Durée: {apt.duration} minutes</p>
                      <p>Salle: {apt.room}</p>
                      {apt.notes && <p className="text-gray-500">Note: {apt.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 ml-4">
                    {apt.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleCancelAppointment(apt._id)}
                        className="btn btn-danger text-sm px-3 py-1"
                        disabled={loading}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Aucun rendez-vous à venir</p>
          </div>
        )}
      </div>

      {/* Past Appointments */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Historique</h2>
        {past.length > 0 ? (
          <div className="space-y-3">
            {past.map((apt) => (
              <div key={apt.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {format(new Date(apt.date), 'dd MMMM yyyy', { locale: fr })} à {apt.time}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Salle: {apt.room}</p>
                  </div>
                  <span className={getStatusBadge(apt.status)}>
                    {apt.status === 'COMPLETED' ? 'Terminé' : apt.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-4 text-gray-500">Aucun historique</p>
        )}
      </div>

      {/* Booking Modal */}
      <AppointmentBookingForm
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSubmit={handleBookingSubmit}
        mode="patient"
        patientId={currentPatient?._id}
      />
    </div>
  );
}
