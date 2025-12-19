/**
 * PreferencesSection Component
 *
 * Patient preferences form section.
 */

import { Building2 } from 'lucide-react';
import { LANGUAGE_OPTIONS, COMMUNICATION_OPTIONS } from '../../constants';

export default function PreferencesSection({ formData, handleChange }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-purple-600" />
        Preferences
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Langue preferee</label>
          <select
            value={formData.preferences.language}
            onChange={(e) => handleChange('preferences.language', e.target.value)}
            className="input"
          >
            {LANGUAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mode de communication</label>
          <select
            value={formData.preferences.communicationMethod}
            onChange={(e) => handleChange('preferences.communicationMethod', e.target.value)}
            className="input"
          >
            {COMMUNICATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacie preferee</label>
          <input
            type="text"
            value={formData.preferredPharmacy}
            onChange={(e) => handleChange('preferredPharmacy', e.target.value)}
            className="input"
            placeholder="Nom de la pharmacie"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          id="reminders"
          checked={formData.preferences.appointmentReminders}
          onChange={(e) => handleChange('preferences.appointmentReminders', e.target.checked)}
          className="h-5 w-5 rounded text-blue-600"
        />
        <label htmlFor="reminders" className="text-sm font-medium text-gray-900">
          Recevoir des rappels de rendez-vous
        </label>
      </div>
    </div>
  );
}
