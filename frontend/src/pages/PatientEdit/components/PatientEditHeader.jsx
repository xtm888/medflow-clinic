/**
 * PatientEditHeader Component
 *
 * Sticky header with navigation back and save buttons.
 */

import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function PatientEditHeader({
  patientName,
  patientId,
  saving,
  onBack,
  onCancel,
  onSave
}) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Modifier le patient
              </h1>
              <p className="text-sm text-gray-500">
                {patientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
