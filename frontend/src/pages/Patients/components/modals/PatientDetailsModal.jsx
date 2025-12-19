/**
 * PatientDetailsModal Component
 *
 * Modal showing detailed patient information.
 */

import { X } from 'lucide-react';
import { getGenderDisplay } from '../../constants';

export default function PatientDetailsModal({ patient, onClose }) {
  if (!patient) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {patient.firstName} {patient.lastName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patient.patientId && (
                <div>
                  <label className="text-sm font-medium text-gray-500">ID Patient</label>
                  <p className="mt-1 text-sm text-gray-900">{patient.patientId}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Age</label>
                <p className="mt-1 text-sm text-gray-900">{patient.age} ans</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Sexe</label>
                <p className="mt-1 text-sm text-gray-900">{getGenderDisplay(patient.gender)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Groupe sanguin</label>
                <p className="mt-1 text-sm text-gray-900">{patient.bloodType}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
