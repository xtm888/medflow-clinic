import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Phone, Mail, MessageSquare, Activity, CheckCircle, Loader2 } from 'lucide-react';
import api from '../services/apiConfig';

export default function PublicBooking() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    serviceId: '',
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      // Use public endpoint that doesn't require authentication
      const response = await api.get('/fee-schedules/public')
        .catch(() => ({ data: { data: [] } }));

      const serviceData = response.data?.data || response.data || [];
      const transformedServices = serviceData.map(s => ({
        id: s._id || s.id,
        name: s.name || s.description || 'Service',
        category: s.category || 'Consultation',
        price: s.price || s.fee || 0,
        duration: s.duration || s.estimatedDuration || 30,
        description: s.description || s.notes || ''
      }));

      setServices(transformedServices);
    } catch (err) {
      console.error('Error fetching services:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  // Mock rate limiting check (would be done on backend with Redis/DB)
  const checkRateLimit = (phone) => {
    // In production: Check if phone number has submitted more than X times in Y minutes
    const lastSubmission = localStorage.getItem(`booking_${phone}`);
    if (lastSubmission) {
      const timeSince = Date.now() - parseInt(lastSubmission);
      const minutesSince = timeSince / 1000 / 60;

      // Rate limit: 1 booking per 5 minutes per phone number
      if (minutesSince < 5) {
        return {
          allowed: false,
          waitMinutes: Math.ceil(5 - minutesSince)
        };
      }
    }
    return { allowed: true };
  };

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Prénom requis';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'Le prénom doit contenir au moins 2 caractères';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nom requis';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Le nom doit contenir au moins 2 caractères';
    }

    // Phone validation (Congo format)
    const phoneRegex = /^\+?243[0-9]{9}$/;
    const cleaned = formData.phone.replace(/\s/g, '');
    if (!formData.phone.trim()) {
      newErrors.phone = 'Téléphone requis';
    } else if (!phoneRegex.test(cleaned)) {
      newErrors.phone = 'Format invalide (ex: +243 81 234 5678)';
    } else {
      // Check valid operator prefix
      const prefix = cleaned.replace('+243', '').substring(0, 2);
      const validPrefixes = ['81', '82', '97', '98', '99', '84', '85', '89', '90', '91'];
      if (!validPrefixes.includes(prefix)) {
        newErrors.phone = 'Numéro invalide. Utilisez Vodacom, Airtel, Orange ou Africell';
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email requis';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Format email invalide';
    }

    if (!formData.serviceId) newErrors.serviceId = 'Veuillez sélectionner un service';
    if (!formData.preferredDate) newErrors.preferredDate = 'Date requise';
    if (!formData.preferredTime) newErrors.preferredTime = 'Heure requise';

    setErrors(newErrors);

    // Focus on first error field
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Rate limiting check
    const rateCheck = checkRateLimit(formData.phone);
    if (!rateCheck.allowed) {
      setRateLimitWarning(true);
      alert(`Trop de demandes. Veuillez réessayer dans ${rateCheck.waitMinutes} minute(s).`);
      return;
    }

    setIsSubmitting(true);

    // Simulate API call to backend
    try {
      // In production, this would call your API:
      // POST /api/bookings/guest
      // The backend would:
      // 1. Validate data
      // 2. Check rate limit (Redis/DB)
      // 3. Create pending appointment
      // 4. Send WhatsApp via Twilio
      // 5. Send Email
      // 6. Return confirmation

      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

      // Mock sending WhatsApp & Email

      // Save to localStorage for rate limiting (in production, done on backend)
      localStorage.setItem(`booking_${formData.phone}`, Date.now().toString());

      // Store booking data for confirmation page
      const selectedService = services.find(s => s.id === formData.serviceId);
      sessionStorage.setItem('lastBooking', JSON.stringify({
        ...formData,
        serviceName: selectedService?.name,
        submittedAt: new Date().toISOString()
      }));

      // Redirect to confirmation
      navigate('/booking/confirmation');

    } catch (error) {
      console.error('Booking error:', error);
      alert('Erreur lors de la réservation. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedService = services.find(s => s.id === formData.serviceId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MedFlow Clinic</h1>
              <p className="text-xs text-gray-500">Réservation en ligne - Kinshasa</p>
              <p className="text-[10px] text-gray-400">by Aymane Moumni</p>
            </div>
          </div>
          <a href="tel:+243812345678" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Phone className="h-4 w-4 inline mr-1" />
            +243 81 234 5678
          </a>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Prenez rendez-vous en ligne
          </h2>
          <p className="text-gray-600">
            Remplissez le formulaire ci-dessous. Nous confirmerons votre rendez-vous par WhatsApp et email.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <MessageSquare className="h-8 w-8 text-green-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Confirmation WhatsApp</h3>
            <p className="text-sm text-gray-600">Recevez une confirmation instantanée</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <Mail className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Confirmation Email</h3>
            <p className="text-sm text-gray-600">Détails complets par email</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <Clock className="h-8 w-8 text-orange-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Réponse rapide</h3>
            <p className="text-sm text-gray-600">Confirmation sous 24h</p>
          </div>
        </div>

        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Vos informations</h3>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prénom *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className={`input pl-10 ${errors.firstName ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  placeholder="Jean"
                  aria-label="Prénom"
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                  autoFocus
                  required
                />
              </div>
              {errors.firstName && <p id="firstName-error" className="text-xs text-red-600 mt-1" role="alert">{errors.firstName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className={`input ${errors.lastName ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                placeholder="Dupont"
                aria-label="Nom de famille"
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                required
              />
              {errors.lastName && <p id="lastName-error" className="text-xs text-red-600 mt-1" role="alert">{errors.lastName}</p>}
            </div>
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone (WhatsApp) *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`input pl-10 ${errors.phone ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  placeholder="+243 81 234 5678"
                  aria-label="Numéro de téléphone WhatsApp"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? 'phone-error' : 'phone-help'}
                  required
                />
              </div>
              {errors.phone && <p id="phone-error" className="text-xs text-red-600 mt-1" role="alert">{errors.phone}</p>}
              <p id="phone-help" className="text-xs text-gray-500 mt-1">Vodacom, Airtel, Orange ou Africell - Confirmation via WhatsApp</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`input pl-10 ${errors.email ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  placeholder="jean.dupont@email.com"
                  aria-label="Adresse email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  required
                />
              </div>
              {errors.email && <p id="email-error" className="text-xs text-red-600 mt-1" role="alert">{errors.email}</p>}
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de consultation *
            </label>
            {loadingServices ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                <span className="ml-2 text-sm text-gray-500">Chargement des services...</span>
              </div>
            ) : (
              <select
                name="serviceId"
                value={formData.serviceId}
                onChange={(e) => setFormData({...formData, serviceId: e.target.value})}
                className={`input ${errors.serviceId ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                aria-label="Type de consultation"
                aria-invalid={!!errors.serviceId}
                aria-describedby={errors.serviceId ? 'serviceId-error' : undefined}
                required
              >
                <option value="">Sélectionnez un service</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.price.toLocaleString('fr-CD')} FC ({service.duration} min)
                  </option>
                ))}
              </select>
            )}
            {errors.serviceId && <p id="serviceId-error" className="text-xs text-red-600 mt-1" role="alert">{errors.serviceId}</p>}

            {selectedService && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>Durée:</strong> {selectedService.duration} minutes •
                  <strong className="ml-2">Tarif:</strong> {selectedService.price.toLocaleString('fr-CD')} FC
                </p>
                {selectedService.description && (
                  <p className="text-xs text-gray-600 mt-1">{selectedService.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date souhaitée *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  name="preferredDate"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({...formData, preferredDate: e.target.value})}
                  className={`input pl-10 ${errors.preferredDate ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                  aria-label="Date souhaitée"
                  aria-invalid={!!errors.preferredDate}
                  aria-describedby={errors.preferredDate ? 'preferredDate-error' : undefined}
                  required
                />
              </div>
              {errors.preferredDate && <p id="preferredDate-error" className="text-xs text-red-600 mt-1" role="alert">{errors.preferredDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure souhaitée *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({...formData, preferredTime: e.target.value})}
                  className={`input pl-10 ${errors.preferredTime ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  aria-label="Heure souhaitée"
                  aria-invalid={!!errors.preferredTime}
                  aria-describedby={errors.preferredTime ? 'preferredTime-error' : 'time-help'}
                  required
                >
                  <option value="">Choisir l'heure</option>
                  <option value="09:00">09:00</option>
                  <option value="09:30">09:30</option>
                  <option value="10:00">10:00</option>
                  <option value="10:30">10:30</option>
                  <option value="11:00">11:00</option>
                  <option value="11:30">11:30</option>
                  <option value="14:00">14:00</option>
                  <option value="14:30">14:30</option>
                  <option value="15:00">15:00</option>
                  <option value="15:30">15:30</option>
                  <option value="16:00">16:00</option>
                  <option value="16:30">16:30</option>
                  <option value="17:00">17:00</option>
                </select>
              </div>
              {errors.preferredTime && <p id="preferredTime-error" className="text-xs text-red-600 mt-1" role="alert">{errors.preferredTime}</p>}
              <p id="time-help" className="text-xs text-gray-500 mt-1">Sous réserve de disponibilité</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes ou questions (optionnel)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="input"
              rows="3"
              placeholder="Décrivez brièvement le motif de consultation ou toute information utile..."
            />
          </div>

          {/* Rate Limit Warning */}
          {rateLimitWarning && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Limite atteinte:</strong> Vous avez déjà soumis une demande récemment.
                Veuillez patienter quelques minutes avant de réessayer.
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Cette demande est une pré-réservation. Notre secrétariat vous contactera
              pour confirmer la disponibilité et finaliser votre rendez-vous.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full btn btn-primary py-4 text-lg flex items-center justify-center space-x-2 ${
              isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Envoi en cours...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-6 w-6" />
                <span>Confirmer la demande</span>
              </>
            )}
          </button>

          <p className="text-xs text-center text-gray-500">
            En soumettant ce formulaire, vous acceptez d'être contacté par WhatsApp et email.
          </p>
        </form>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Besoin d'aide? Contactez-nous:
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm mb-3">
            <a href="tel:+243812345678" className="text-blue-600 hover:text-blue-700 font-medium">
              <Phone className="h-4 w-4 inline mr-1" />
              +243 81 234 5678
            </a>
            <a href="mailto:contact@medflow-cd.com" className="text-blue-600 hover:text-blue-700 font-medium">
              <Mail className="h-4 w-4 inline mr-1" />
              contact@medflow-cd.com
            </a>
          </div>
          <p className="text-xs text-gray-500">
            Avenue du Commerce, n°45, Gombe, Kinshasa, RDC
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Développé par <span className="font-semibold text-blue-600">Aymane Moumni</span>
          </p>
        </div>
      </div>
    </div>
  );
}
