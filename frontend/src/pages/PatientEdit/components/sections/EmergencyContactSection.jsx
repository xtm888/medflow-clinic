/**
 * EmergencyContactSection Component
 *
 * Emergency contact form section.
 */

import { AlertCircle } from 'lucide-react';
import { RELATIONSHIP_OPTIONS } from '../../constants';

export default function EmergencyContactSection({ formData, handleChange }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-500" />
        Contact d'urgence
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
          <input
            type="text"
            value={formData.emergencyContact.name}
            onChange={(e) => handleChange('emergencyContact.name', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
          <select
            value={formData.emergencyContact.relationship}
            onChange={(e) => handleChange('emergencyContact.relationship', e.target.value)}
            className="input"
          >
            {RELATIONSHIP_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
          <input
            type="tel"
            value={formData.emergencyContact.phone}
            onChange={(e) => handleChange('emergencyContact.phone', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={formData.emergencyContact.email}
            onChange={(e) => handleChange('emergencyContact.email', e.target.value)}
            className="input"
          />
        </div>
      </div>
    </div>
  );
}
