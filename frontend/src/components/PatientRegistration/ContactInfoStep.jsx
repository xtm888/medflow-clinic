import React, { memo } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * ContactInfoStep Component
 * Collects patient's contact information (phone, email, address)
 */
const ContactInfoStep = memo(({
  formData,
  errors,
  onChange
}) => {
  return (
    <div className="space-y-6">
      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Téléphone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => onChange('phoneNumber', e.target.value)}
          className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
            errors.phoneNumber ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
          }`}
          placeholder="+243 81 234 5678"
          autoFocus
        />
        {errors.phoneNumber && (
          <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.phoneNumber}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Email (optionnel)
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => onChange('email', e.target.value)}
          className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
            errors.email ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
          }`}
          placeholder="patient@email.com"
        />
        {errors.email && (
          <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.email}
          </p>
        )}
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Adresse (optionnel)
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => onChange('address', e.target.value)}
          className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
          placeholder="123 Avenue Kasa-Vubu"
        />
      </div>

      {/* City & Country */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Ville
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => onChange('city', e.target.value)}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
            placeholder="Kinshasa"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Pays
          </label>
          <select
            value={formData.country}
            onChange={(e) => onChange('country', e.target.value)}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="RDC">RDC</option>
            <option value="Congo-Brazzaville">Congo-Brazzaville</option>
            <option value="Rwanda">Rwanda</option>
            <option value="Burundi">Burundi</option>
            <option value="Uganda">Uganda</option>
            <option value="Other">Autre</option>
          </select>
        </div>
      </div>
    </div>
  );
});

ContactInfoStep.displayName = 'ContactInfoStep';

export default ContactInfoStep;
