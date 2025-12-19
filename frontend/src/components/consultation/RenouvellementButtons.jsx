/**
 * RenouvellementButtons - Quick action buttons for loading previous data
 *
 * Matches StudioVision XP buttons:
 * - "Nouvelle réfraction pré-remplie" / "Nouvelle réfraction vide"
 * - "Renouvellement de la pathologie précédente"
 * - "Renouvellement prescription précédente"
 *
 * Features:
 * - Load previous exam data
 * - Clear current data
 * - Visual feedback
 */

import { useState } from 'react';
import {
  RefreshCw,
  History,
  Trash2,
  Copy,
  Send,
  Check,
  Loader2,
  ChevronDown
} from 'lucide-react';

// Styles
const buttonStyles = {
  base: 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border transition-all duration-150',
  primary: 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
  success: 'bg-green-600 border-green-600 text-white hover:bg-green-700',
  warning: 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600',
  disabled: 'opacity-50 cursor-not-allowed'
};

/**
 * Refraction Renouvellement Buttons
 * Matches oph2.jpg: "Nouvelle réfraction pré-remplie" and "Nouvelle réfraction vide"
 */
export function RefractionRenouvellementButtons({
  onLoadPrevious,
  onClear,
  onSendToDevice,
  previousAvailable = false,
  loading = false,
  className = ''
}) {
  const [showSuccess, setShowSuccess] = useState(null);

  const handleLoadPrevious = async () => {
    try {
      await onLoadPrevious?.();
      setShowSuccess('load');
      setTimeout(() => setShowSuccess(null), 2000);
    } catch (e) {
      console.error('Failed to load previous refraction:', e);
    }
  };

  const handleClear = () => {
    onClear?.();
    setShowSuccess('clear');
    setTimeout(() => setShowSuccess(null), 2000);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Load Previous Button */}
      <button
        onClick={handleLoadPrevious}
        disabled={loading || !previousAvailable}
        className={`${buttonStyles.base} ${previousAvailable ? buttonStyles.primary : buttonStyles.disabled} ${!previousAvailable ? 'bg-gray-300 border-gray-300' : ''}`}
        title="Charger les données de la dernière réfraction"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showSuccess === 'load' ? (
          <Check className="h-4 w-4" />
        ) : (
          <History className="h-4 w-4" />
        )}
        Nouvelle réfraction pré-remplie
      </button>

      {/* Clear Button */}
      <button
        onClick={handleClear}
        disabled={loading}
        className={`${buttonStyles.base} ${buttonStyles.secondary}`}
        title="Effacer tous les champs"
      >
        {showSuccess === 'clear' ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Nouvelle réfraction vide
      </button>

      {/* Send to Device Button (optional) */}
      {onSendToDevice && (
        <div className="border-l border-gray-300 pl-2 ml-2">
          <span className="text-xs text-gray-500 block mb-1">Envoyer la mesure au réfracteur :</span>
          <div className="flex gap-1">
            <button
              onClick={() => onSendToDevice?.('LM')}
              className={`${buttonStyles.base} ${buttonStyles.secondary} text-xs px-2 py-1`}
              title="Envoyer vers mémoire LM"
            >
              <Send className="h-3 w-3" />
              -{'>'} mem. LM
            </button>
            <button
              onClick={() => onSendToDevice?.('RM')}
              className={`${buttonStyles.base} ${buttonStyles.secondary} text-xs px-2 py-1`}
              title="Envoyer vers mémoire RM"
            >
              <Send className="h-3 w-3" />
              -{'>'} mem. RM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pathology Renouvellement Button
 * Matches oph4.jpg: "Renouvellement de la pathologie précédente"
 */
export function PathologyRenouvellementButton({
  onRenew,
  previousAvailable = false,
  loading = false,
  className = ''
}) {
  const [success, setSuccess] = useState(false);

  const handleRenew = async () => {
    try {
      await onRenew?.();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to renew pathology:', e);
    }
  };

  return (
    <button
      onClick={handleRenew}
      disabled={loading || !previousAvailable}
      className={`${buttonStyles.base} ${previousAvailable ? buttonStyles.warning : buttonStyles.disabled} ${!previousAvailable ? 'bg-gray-300 border-gray-300 text-gray-500' : ''} ${className}`}
      title="Copier le diagnostic de la consultation précédente"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : success ? (
        <Check className="h-4 w-4" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Renouvellement de la pathologie précédente
    </button>
  );
}

/**
 * Prescription Renouvellement Button (wrapper for TreatmentBuilder's built-in renewal)
 */
export function PrescriptionRenouvellementButton({
  onOpenRenewal,
  previousAvailable = false,
  className = ''
}) {
  return (
    <button
      onClick={onOpenRenewal}
      disabled={!previousAvailable}
      className={`${buttonStyles.base} ${previousAvailable ? buttonStyles.success : buttonStyles.disabled} ${!previousAvailable ? 'bg-gray-300 border-gray-300 text-gray-500' : ''} ${className}`}
      title="Recopier une ordonnance précédente"
    >
      <Copy className="h-4 w-4" />
      Renouvellement du traitement précédent
    </button>
  );
}

/**
 * Glasses Prescription Renouvellement
 */
export function GlassesRenouvellementButtons({
  onRenewPrescription,
  previousTypes = [], // ['loin', 'pres1', 'pres2', 'progressifs', 'bifocaux']
  className = ''
}) {
  const [expanded, setExpanded] = useState(false);

  const prescriptionOptions = [
    { id: 'loin', label: 'Verres prescrits de loin' },
    { id: 'pres1', label: 'Verres prescrits de près (1)' },
    { id: 'pres2', label: 'Verres prescrits de près (2)' },
    { id: '2paires', label: 'Verres prescrits 2 paires' },
    { id: 'progressifs', label: 'Verres prescrits en progressifs' },
    { id: 'bifocaux', label: 'Verres prescrits en bifocaux' },
    { id: 'renewal', label: 'Renouvellement prescription précédente' }
  ];

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600 mb-1">Perso.</span>
        <span className="text-xs font-medium text-gray-600">Verres prescrits</span>

        {prescriptionOptions.slice(0, 5).map((option) => (
          <button
            key={option.id}
            onClick={() => onRenewPrescription?.(option.id)}
            disabled={!previousTypes.includes(option.id)}
            className={`text-left text-xs px-2 py-1 rounded transition-colors ${
              previousTypes.includes(option.id)
                ? 'text-blue-600 hover:bg-blue-50 cursor-pointer'
                : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            {option.label}
          </button>
        ))}

        {/* Renewal button - special styling */}
        <button
          onClick={() => onRenewPrescription?.('renewal')}
          disabled={previousTypes.length === 0}
          className={`mt-2 text-left text-xs px-2 py-1.5 rounded border ${
            previousTypes.length > 0
              ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
              : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
        >
          <RefreshCw className="h-3 w-3 inline mr-1" />
          Renouvellement prescription précédente
        </button>
      </div>
    </div>
  );
}

/**
 * Combined Renouvellement Actions Bar
 * Shows all renouvellement options in a horizontal bar
 */
export function RenouvellementActionsBar({
  module, // 'refraction' | 'pathology' | 'treatment' | 'all'
  onLoadPreviousRefraction,
  onClearRefraction,
  onRenewPathology,
  onRenewTreatment,
  previousData = {},
  loading = false,
  className = ''
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Actions rapides:
      </span>

      {(module === 'refraction' || module === 'all') && (
        <RefractionRenouvellementButtons
          onLoadPrevious={onLoadPreviousRefraction}
          onClear={onClearRefraction}
          previousAvailable={!!previousData.refraction}
          loading={loading}
        />
      )}

      {(module === 'pathology' || module === 'all') && (
        <PathologyRenouvellementButton
          onRenew={onRenewPathology}
          previousAvailable={!!previousData.pathology}
          loading={loading}
        />
      )}

      {(module === 'treatment' || module === 'all') && (
        <PrescriptionRenouvellementButton
          onOpenRenewal={onRenewTreatment}
          previousAvailable={!!previousData.treatment}
        />
      )}
    </div>
  );
}

export default RenouvellementActionsBar;
