/**
 * ContactSection Component
 *
 * Contact information form section (phone, email, address).
 */

import { Phone, MapPin } from 'lucide-react';
import { COUNTRY_OPTIONS } from '../../constants';

export default function ContactSection({ formData, errors, handleChange }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Phone className="h-5 w-5 text-blue-600" />
        Coordonnees
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telephone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            className={`input ${errors.phoneNumber ? 'border-red-500' : ''}`}
            placeholder="+243 XXX XXX XXX"
          />
          {errors.phoneNumber && (
            <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telephone alternatif
          </label>
          <input
            type="tel"
            value={formData.alternativePhone}
            onChange={(e) => handleChange('alternativePhone', e.target.value)}
            className="input"
            placeholder="+243 XXX XXX XXX"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="input"
            placeholder="patient@email.com"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Adresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
            <input
              type="text"
              value={formData.address.street}
              onChange={(e) => handleChange('address.street', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input
              type="text"
              value={formData.address.city}
              onChange={(e) => handleChange('address.city', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
            <input
              type="text"
              value={formData.address.postalCode}
              onChange={(e) => handleChange('address.postalCode', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <input
              type="text"
              value={formData.address.state}
              onChange={(e) => handleChange('address.state', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
            <select
              value={formData.address.country}
              onChange={(e) => handleChange('address.country', e.target.value)}
              className="input"
            >
              {COUNTRY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
