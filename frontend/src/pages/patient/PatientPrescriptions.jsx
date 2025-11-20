import { useState, useEffect } from 'react';
import { Pill, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/apiConfig';
import authService from '../../services/authService';

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);

      // Get current user
      const userResult = await authService.getCurrentUser();
      if (userResult.success && userResult.user) {
        const patientId = userResult.user.patientId || userResult.user._id;

        const response = await api.get('/prescriptions', {
          params: { patient: patientId, limit: 50 }
        });

        setPrescriptions(response.data?.data || response.data || []);
      }
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des ordonnances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mes Ordonnances</h1>
        <p className="mt-1 text-sm text-gray-500">
          Consultez vos ordonnances et médicaments prescrits
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {prescriptions.map((rx) => (
          <div key={rx._id || rx.id} className="card hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Ordonnance #{rx.prescriptionId || rx._id?.slice(-6) || rx.id}
                </h3>
                <p className="text-sm text-gray-600">
                  Date: {format(new Date(rx.date || rx.createdAt), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <span className={`badge ${
                rx.status === 'DISPENSED' || rx.status === 'dispensed' ? 'badge-success' :
                rx.status === 'PENDING' || rx.status === 'pending' ? 'badge-warning' :
                'badge-danger'
              }`}>
                {rx.status === 'DISPENSED' || rx.status === 'dispensed' ? 'Délivrée' :
                 rx.status === 'PENDING' || rx.status === 'pending' ? 'En attente' : 'Annulée'}
              </span>
            </div>

            <div className="space-y-3">
              {rx.medications?.map((med, idx) => (
                <div key={idx} className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-start">
                    <Pill className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {med.name || med.medication || (typeof med.drug === 'object' ? med.drug.name : med.drug) || 'Médicament'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Posologie:</strong> {med.dosage || 'Non spécifié'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Durée:</strong> {med.duration || 'Non spécifié'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Quantité:</strong> {med.quantity || 'Non spécifié'}
                      </p>
                      {med.instructions && (
                        <p className="text-sm text-gray-500 mt-2 italic">
                          {med.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {rx.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  <strong>Notes:</strong> {rx.notes}
                </p>
              </div>
            )}
          </div>
        ))}

        {prescriptions.length === 0 && (
          <div className="card text-center py-12">
            <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune ordonnance</p>
          </div>
        )}
      </div>
    </div>
  );
}
