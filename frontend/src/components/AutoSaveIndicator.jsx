import { Check, Save, AlertCircle, Loader } from 'lucide-react';
import { formatLastSaved } from '../hooks/useAutoSave';

export default function AutoSaveIndicator({ saveStatus, lastSaved, error }) {
  if (saveStatus === 'idle' && !lastSaved) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      {saveStatus === 'saving' && (
        <>
          <Loader className="h-4 w-4 text-blue-600 animate-spin" />
          <span className="text-blue-600">Sauvegarde en cours...</span>
        </>
      )}

      {saveStatus === 'saved' && (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-600">
            {lastSaved ? formatLastSaved(lastSaved) : 'Sauvegardé'}
          </span>
        </>
      )}

      {saveStatus === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-red-600">
            {error || 'Erreur de sauvegarde'}
          </span>
        </>
      )}

      {saveStatus === 'idle' && lastSaved && (
        <>
          <Save className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">
            {formatLastSaved(lastSaved)}
          </span>
        </>
      )}
    </div>
  );
}
