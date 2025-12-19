/**
 * ClinicSection Component
 *
 * Clinic information settings (admin only).
 */

import { Loader2 } from 'lucide-react';

export default function ClinicSection({ clinic, onClinicChange, onSave, saving }) {
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations de la clinique</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la clinique</label>
          <input
            type="text"
            className="input"
            value={clinic.name || ''}
            onChange={(e) => onClinicChange({ ...clinic, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
          <input
            type="text"
            className="input"
            value={clinic.address || ''}
            onChange={(e) => onClinicChange({ ...clinic, address: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              className="input"
              value={clinic.phone || ''}
              onChange={(e) => onClinicChange({ ...clinic, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="input"
              value={clinic.email || ''}
              onChange={(e) => onClinicChange({ ...clinic, email: e.target.value })}
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
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
