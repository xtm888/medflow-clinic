/**
 * MergeDuplicatesModal Component
 *
 * Modal for detecting and merging duplicate patients.
 */

import { X, GitMerge } from 'lucide-react';

export default function MergeDuplicatesModal({
  duplicates,
  selectedForMerge,
  setSelectedForMerge,
  handleMergePatients,
  onClose
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Fusionner les doublons ({duplicates.length} detectes)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Selectionnez le patient principal (dont les donnees seront conservees) et le patient secondaire (qui sera fusionne puis desactive).
          </p>

          <div className="space-y-3">
            {duplicates.map((dup, idx) => (
              <DuplicateCard
                key={idx}
                duplicate={dup}
                selectedForMerge={selectedForMerge}
                setSelectedForMerge={setSelectedForMerge}
              />
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button
              onClick={handleMergePatients}
              disabled={!selectedForMerge.primary || !selectedForMerge.secondary}
              className="btn btn-primary"
            >
              Fusionner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DuplicateCard({ duplicate, selectedForMerge, setSelectedForMerge }) {
  const confidenceClass = duplicate.confidence >= 90
    ? 'bg-red-100 text-red-700'
    : duplicate.confidence >= 70
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-700';

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-1 text-xs rounded ${confidenceClass}`}>
          {duplicate.confidence}% de confiance - {duplicate.message}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-medium">{duplicate.patient.firstName} {duplicate.patient.lastName}</p>
          <p className="text-sm text-gray-500">{duplicate.patient.patientId}</p>
          <p className="text-sm text-gray-500">{duplicate.patient.phoneNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedForMerge(prev => ({ ...prev, primary: duplicate.patient._id }))}
            className={`btn btn-sm ${selectedForMerge.primary === duplicate.patient._id ? 'btn-primary' : 'btn-secondary'}`}
          >
            Principal
          </button>
          <button
            onClick={() => setSelectedForMerge(prev => ({ ...prev, secondary: duplicate.patient._id }))}
            className={`btn btn-sm ${selectedForMerge.secondary === duplicate.patient._id ? 'btn-danger' : 'btn-secondary'}`}
          >
            Secondaire
          </button>
        </div>
      </div>
    </div>
  );
}
