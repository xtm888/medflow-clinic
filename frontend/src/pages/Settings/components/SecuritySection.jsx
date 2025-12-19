/**
 * SecuritySection Component
 *
 * Password change form.
 */

import { Loader2 } from 'lucide-react';

export default function SecuritySection({
  passwordData,
  onPasswordDataChange,
  onSave,
  saving
}) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Changer le mot de passe</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
          <input
            type="password"
            className="input"
            value={passwordData.currentPassword}
            onChange={(e) => onPasswordDataChange({
              ...passwordData,
              currentPassword: e.target.value
            })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
          <input
            type="password"
            className="input"
            value={passwordData.newPassword}
            onChange={(e) => onPasswordDataChange({
              ...passwordData,
              newPassword: e.target.value
            })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
          <input
            type="password"
            className="input"
            value={passwordData.confirmPassword}
            onChange={(e) => onPasswordDataChange({
              ...passwordData,
              confirmPassword: e.target.value
            })}
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onSave}
            disabled={saving || !passwordData.currentPassword || !passwordData.newPassword}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Modification...
              </>
            ) : (
              'Changer le mot de passe'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
