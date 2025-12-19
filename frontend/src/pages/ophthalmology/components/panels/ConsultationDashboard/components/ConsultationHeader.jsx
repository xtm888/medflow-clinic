/**
 * ConsultationHeader Component
 *
 * Sticky header with patient info, template selector, and action buttons.
 * Now includes PatientAlertsBanner for safety alerts during consultation.
 * Includes StudioVision mode toggle for switching between UI modes.
 */

import { User, Clock, Save, CheckCircle } from 'lucide-react';
import TemplateSelector from '../../../../../../components/consultation/TemplateSelector';
import PatientAlertsBanner from '../../../../../../components/alerts/PatientAlertsBanner';
import { GlobalModeToggle } from '../../../../../../components/StudioVisionModeToggle';
import { calculateAge, formatTime } from '../constants';

export default function ConsultationHeader({
  patient,
  saving,
  lastSaved,
  hasChanges,
  appliedTemplateId,
  onApplyTemplate,
  onSave,
  onCancel,
  onComplete
}) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
      {/* Patient Alerts Banner - Shows critical alerts at top of consultation */}
      {patient?._id && (
        <PatientAlertsBanner
          patientId={patient._id}
          compact={true}
          className="border-b border-gray-100"
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Patient Info */}
          <div className="flex items-center gap-4">
            {patient?.photoUrl ? (
              <img
                src={patient.photoUrl}
                alt={`${patient?.firstName} ${patient?.lastName}`}
                className="h-12 w-12 rounded-full object-cover border-2 border-blue-200"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {patient?.firstName} {patient?.lastName}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{patient?.age || calculateAge(patient?.dateOfBirth)} ans</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>{patient?.gender === 'male' ? 'H' : 'F'}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>{patient?.mrn || patient?.patientId}</span>
              </div>
            </div>

            {/* Template Selector */}
            <TemplateSelector
              onApply={onApplyTemplate}
              selectedTemplateId={appliedTemplateId}
            />
          </div>

          {/* StudioVision Mode Toggle */}
          <GlobalModeToggle className="ml-4" />

          {/* Status & Actions */}
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Sauvegardé {formatTime(lastSaved)}
              </span>
            )}
            {saving && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <Save className="h-3 w-3 animate-pulse" />
                Sauvegarde...
              </span>
            )}
            <button
              onClick={() => onSave()}
              disabled={saving || !hasChanges}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4 inline mr-1" />
              Sauvegarder
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              onClick={onComplete}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
            >
              <CheckCircle className="h-4 w-4" />
              Terminer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
