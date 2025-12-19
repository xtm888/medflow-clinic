/**
 * NotificationsSection Component
 *
 * Notification preferences settings.
 */

import { Loader2 } from 'lucide-react';
import { NOTIFICATION_PREFS } from '../constants';

export default function NotificationsSection({
  notifications,
  onNotificationsChange,
  onSave,
  saving
}) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Préférences de notification</h2>
      <div className="space-y-4">
        {NOTIFICATION_PREFS.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{pref.label}</p>
              <p className="text-sm text-gray-600">{pref.description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notifications[pref.key] || false}
                onChange={(e) => onNotificationsChange({
                  ...notifications,
                  [pref.key]: e.target.checked
                })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        ))}

        <div className="flex justify-end pt-4 border-t">
          <button onClick={onSave} disabled={saving} className="btn btn-primary">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sauvegarde...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
