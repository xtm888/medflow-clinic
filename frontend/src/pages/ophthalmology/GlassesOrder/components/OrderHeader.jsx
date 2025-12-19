/**
 * OrderHeader Component
 *
 * Header with patient info and navigation.
 */

import { Glasses, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function OrderHeader({ patient, exam, onBack }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Glasses className="h-6 w-6 mr-2 text-primary-600" />
            Commander Lunettes/Lentilles
          </h1>
          <p className="text-sm text-gray-500">
            Patient: {patient?.firstName} {patient?.lastName} |
            Examen du {exam?.examDate ? format(new Date(exam.examDate), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
