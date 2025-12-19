/**
 * ProfileSection Component
 *
 * User profile settings form.
 */

import { Loader2 } from 'lucide-react';

export default function ProfileSection({
  profile,
  onProfileChange,
  onSave,
  onUploadPhoto,
  saving
}) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations du profil</h2>
      <div className="space-y-4">
        {/* Avatar */}
        <div className="flex items-center space-x-4">
          <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
            {profile.firstName?.charAt(0) || 'U'}{profile.lastName?.charAt(0) || ''}
          </div>
          <div>
            <input
              type="file"
              id="profile-photo"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) onUploadPhoto(file);
              }}
            />
            <button
              onClick={() => document.getElementById('profile-photo').click()}
              className="btn btn-secondary text-sm"
            >
              Changer la photo
            </button>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG. Max 2MB</p>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input
              type="text"
              className="input"
              value={profile.firstName}
              onChange={(e) => onProfileChange({ ...profile, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              className="input"
              value={profile.lastName}
              onChange={(e) => onProfileChange({ ...profile, lastName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="input"
              value={profile.email}
              onChange={(e) => onProfileChange({ ...profile, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              className="input"
              value={profile.phoneNumber}
              onChange={(e) => onProfileChange({ ...profile, phoneNumber: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
            <input
              type="text"
              className="input"
              value={profile.specialization}
              onChange={(e) => onProfileChange({ ...profile, specialization: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button onClick={onSave} disabled={saving} className="btn btn-primary">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sauvegarde...
              </>
            ) : (
              'Enregistrer les modifications'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
