import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, User, Phone, Mail, MessageSquare, Home, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BookingConfirmation() {
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);

  useEffect(() => {
    // Get booking data from session storage
    const data = sessionStorage.getItem('lastBooking');
    if (data) {
      setBookingData(JSON.parse(data));
    } else {
      // If no booking data, redirect to booking page
      navigate('/book');
    }
  }, [navigate]);

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Demande envoyée avec succès!
          </h1>
          <p className="text-lg text-gray-600">
            Votre demande de rendez-vous a bien été reçue.
          </p>
        </div>

        {/* Confirmation Details */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Récapitulatif de votre demande</h2>

          <div className="space-y-4">
            <div className="flex items-start space-x-3 pb-4 border-b">
              <User className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Nom complet</p>
                <p className="font-semibold text-gray-900">
                  {bookingData.firstName} {bookingData.lastName}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 pb-4 border-b">
              <Phone className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Téléphone (WhatsApp)</p>
                <p className="font-semibold text-gray-900">{bookingData.phone}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 pb-4 border-b">
              <Mail className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-semibold text-gray-900">{bookingData.email}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 pb-4 border-b">
              <Calendar className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Date souhaitée</p>
                <p className="font-semibold text-gray-900">
                  {format(new Date(bookingData.preferredDate), 'EEEE dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 pb-4 border-b">
              <Clock className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Heure souhaitée</p>
                <p className="font-semibold text-gray-900">{bookingData.preferredTime}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Type de consultation</p>
                <p className="font-semibold text-gray-900">{bookingData.serviceName}</p>
              </div>
            </div>

            {bookingData.notes && (
              <div className="flex items-start space-x-3 pt-4 border-t">
                <MessageSquare className="h-5 w-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Vos notes</p>
                  <p className="text-gray-700">{bookingData.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center">
            <MessageSquare className="h-5 w-5 text-blue-600 mr-2" />
            Prochaines étapes
          </h3>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2 flex-shrink-0">1</span>
              <span>Vous allez recevoir une <strong>confirmation WhatsApp</strong> dans quelques minutes</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2 flex-shrink-0">2</span>
              <span>Un <strong>email de confirmation</strong> vous sera envoyé avec tous les détails</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2 flex-shrink-0">3</span>
              <span>Notre secrétariat vous contactera <strong>sous 24h</strong> pour confirmer la disponibilité</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full mr-2 flex-shrink-0">4</span>
              <span>Vous recevrez un <strong>rappel</strong> 24h avant votre rendez-vous</span>
            </li>
          </ol>
        </div>

        {/* Important Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <strong>⚠️ Important:</strong> Cette demande n'est pas encore confirmée. Attendez la confirmation
            de notre secrétariat avant de vous présenter à la clinique.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/book')}
            className="btn btn-secondary flex items-center justify-center space-x-2 flex-1"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Nouvelle demande</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary flex items-center justify-center space-x-2 flex-1"
          >
            <Home className="h-5 w-5" />
            <span>Retour à l'accueil</span>
          </button>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Questions? Contactez-nous:
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
            MedFlow Clinic - Avenue du Commerce, Gombe, Kinshasa, RDC
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Développé par <span className="font-semibold text-blue-600">Aymane Moumni</span>
          </p>
        </div>
      </div>
    </div>
  );
}
