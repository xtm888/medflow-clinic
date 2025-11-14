import { FileText } from 'lucide-react';

export default function PatientResults() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mes Résultats</h1>
        <p className="mt-1 text-sm text-gray-500">Consultez vos résultats d'examens et analyses</p>
      </div>

      <div className="card text-center py-12">
        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">Aucun résultat disponible</p>
        <p className="text-gray-500">
          Vos résultats d'examens apparaîtront ici une fois qu'ils seront validés par votre médecin.
        </p>
      </div>
    </div>
  );
}
