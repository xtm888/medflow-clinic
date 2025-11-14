import { Pill } from 'lucide-react';
import { prescriptions } from '../../data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PatientPrescriptions() {
  const currentPatientId = 1;
  const myPrescriptions = prescriptions.filter(rx => rx.patientId === currentPatientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mes Ordonnances</h1>
        <p className="mt-1 text-sm text-gray-500">
          Consultez vos ordonnances et médicaments prescrits
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {myPrescriptions.map((rx) => (
          <div key={rx.id} className="card hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Ordonnance #{rx.id}</h3>
                <p className="text-sm text-gray-600">
                  Date: {format(new Date(rx.date), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <span className={`badge ${
                rx.status === 'DISPENSED' ? 'badge-success' :
                rx.status === 'PENDING' ? 'badge-warning' :
                'badge-danger'
              }`}>
                {rx.status === 'DISPENSED' ? 'Délivrée' : rx.status === 'PENDING' ? 'En attente' : 'Annulée'}
              </span>
            </div>

            <div className="space-y-3">
              {rx.medications.map((med, idx) => (
                <div key={idx} className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-start">
                    <Pill className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{med.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Posologie:</strong> {med.dosage}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Durée:</strong> {med.duration}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Quantité:</strong> {med.quantity}
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

        {myPrescriptions.length === 0 && (
          <div className="card text-center py-12">
            <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune ordonnance</p>
          </div>
        )}
      </div>
    </div>
  );
}
