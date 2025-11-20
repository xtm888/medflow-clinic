import { Calendar, Clock, Plus, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/apiConfig';
import appointmentService from '../../services/appointmentService';
import authService from '../../services/authService';
import { toast } from 'react-toastify';

export default function PatientAppointments() {
  
  const [currentPatient, setCurrentPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    service: '',
    preferredDate: '',
    preferredTime: '',
    reason: ''
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Fetch current user, appointments, and services
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get current user
        const userResult = await authService.getCurrentUser();
        if (userResult.success) {
          setCurrentPatient(userResult.user);

          // Fetch patient appointments and services in parallel
          const [aptResponse, servicesResponse] = await Promise.all([
            appointmentService.getAppointments({
              patient: userResult.user._id
            }).catch(() => ({ data: [] })),
            api.get('/template-catalog', {
              params: { type: 'procedure', limit: 100 }
            }).catch(() => ({ data: { data: [] } }))
          ]);

          setAppointments(aptResponse.data || []);

          // Transform services
          const serviceData = servicesResponse.data?.data || servicesResponse.data || [];
          const transformedServices = serviceData.map(s => ({
            id: s._id || s.id,
            name: s.name || s.description || 'Service',
            category: s.category || 'Consultation',
            price: s.price || s.fee || 0,
            duration: s.duration || s.estimatedDuration || 30
          }));
          setServices(transformedServices);
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
  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (!currentPatient) {
      toast.error('Patient information not loaded');
      return;
    }

    setBookingLoading(true);

    try {
      // Combine date and time
      const appointmentDateTime = new Date(`${bookingForm.preferredDate}T${bookingForm.preferredTime}`);

      const appointmentData = {
        patient: currentPatient._id,
        date: appointmentDateTime,
        time: bookingForm.preferredTime,
        type: 'consultation',
        status: 'pending', // Will need confirmation from staff
        reason: bookingForm.reason,
        notes: `Service requested: ${bookingForm.service}`
      };

      await appointmentService.createAppointment(appointmentData);

      setBookingSuccess(true);
      toast.success('Appointment request submitted successfully!');

      // Refresh appointments list
      const aptResponse = await appointmentService.getAppointments({
        patient: currentPatient._id
      });
      setAppointments(aptResponse.data || []);

    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
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
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

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
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            {!bookingSuccess ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Prendre un rendez-vous</h2>
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  {/* Patient Info (Read-only) */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Vos informations</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Nom:</span>{' '}
                        <span className="font-medium">
                          {currentPatient?.firstName || 'N/A'} {currentPatient?.lastName || ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Téléphone:</span>{' '}
                        <span className="font-medium">{currentPatient?.phone || currentPatient?.phoneNumber || 'N/A'}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-gray-600">Email:</span>{' '}
                        <span className="font-medium">{currentPatient?.email || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Service Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service médical *
                    </label>
                    <select
                      value={bookingForm.service}
                      onChange={(e) => setBookingForm({...bookingForm, service: e.target.value})}
                      className="input"
                      required
                    >
                      <option value="">Sélectionnez un service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.name}>
                          {service.name} - ${service.price} ({service.duration} min)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date préférée *
                      </label>
                      <input
                        type="date"
                        value={bookingForm.preferredDate}
                        onChange={(e) => setBookingForm({...bookingForm, preferredDate: e.target.value})}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Heure préférée *
                      </label>
                      <select
                        value={bookingForm.preferredTime}
                        onChange={(e) => setBookingForm({...bookingForm, preferredTime: e.target.value})}
                        className="input"
                        required
                      >
                        <option value="">Choisir une heure</option>
                        <option value="08:00">08:00</option>
                        <option value="09:00">09:00</option>
                        <option value="10:00">10:00</option>
                        <option value="11:00">11:00</option>
                        <option value="14:00">14:00</option>
                        <option value="15:00">15:00</option>
                        <option value="16:00">16:00</option>
                        <option value="17:00">17:00</option>
                      </select>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Raison de la visite (optionnel)
                    </label>
                    <textarea
                      value={bookingForm.reason}
                      onChange={(e) => setBookingForm({...bookingForm, reason: e.target.value})}
                      className="input"
                      rows="3"
                      placeholder="Décrivez brièvement la raison de votre visite..."
                    />
                  </div>

                  {/* Info box */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Note:</span> Votre demande sera examinée par notre équipe.
                      Vous recevrez une confirmation par WhatsApp et email dans les plus brefs délais.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowBookingModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1"
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? 'Envoi en cours...' : 'Confirmer le rendez-vous'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Demande envoyée!</h3>
                <p className="text-gray-600 mb-4">
                  Votre demande de rendez-vous a été envoyée avec succès.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm font-medium text-blue-900 mb-2">Récapitulatif</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><span className="font-medium">Service:</span> {bookingForm.service}</p>
                    <p><span className="font-medium">Date:</span> {format(new Date(bookingForm.preferredDate), 'dd MMMM yyyy', { locale: fr })}</p>
                    <p><span className="font-medium">Heure:</span> {bookingForm.preferredTime}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  Vous recevrez une confirmation par WhatsApp au <strong>{currentPatient?.phone || currentPatient?.phoneNumber}</strong> et par email à <strong>{currentPatient?.email}</strong>.
                </p>
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setBookingSuccess(false);
                    setBookingForm({ service: '', preferredDate: '', preferredTime: '', reason: '' });
                  }}
                  className="btn btn-primary"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
