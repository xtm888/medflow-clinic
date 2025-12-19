/**
 * PersonalInfoSection Component
 *
 * Personal information form section (name, DOB, gender, ID, etc.).
 */

import { useRef } from 'react';
import { User, Camera } from 'lucide-react';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '../../constants';

export default function PersonalInfoSection({
  formData,
  errors,
  photoPreview,
  handleChange,
  onPhotoChange
}) {
  const photoInputRef = useRef(null);

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <User className="h-5 w-5 text-blue-600" />
        Informations personnelles
      </h2>

      {/* Photo */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
            {photoPreview ? (
              <img src={photoPreview} alt="Patient" className="w-full h-full object-cover" />
            ) : (
              `${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || ''}`
            )}
          </div>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 p-2 bg-white rounded-full shadow border hover:bg-gray-50"
          >
            <Camera className="h-4 w-4 text-gray-600" />
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={onPhotoChange}
            className="hidden"
          />
        </div>
        <div>
          <p className="text-sm text-gray-600">Photo du patient</p>
          <p className="text-xs text-gray-400">JPG, PNG. Max 5MB</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prenom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className={`input ${errors.firstName ? 'border-red-500' : ''}`}
          />
          {errors.firstName && (
            <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className={`input ${errors.lastName ? 'border-red-500' : ''}`}
          />
          {errors.lastName && (
            <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date de naissance <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
            className={`input ${errors.dateOfBirth ? 'border-red-500' : ''}`}
          />
          {errors.dateOfBirth && (
            <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sexe <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
            className={`input ${errors.gender ? 'border-red-500' : ''}`}
          >
            {GENDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.gender && (
            <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CNI / Passeport
          </label>
          <input
            type="text"
            value={formData.nationalId}
            onChange={(e) => handleChange('nationalId', e.target.value)}
            className="input"
            placeholder="Numero d'identite"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Situation matrimoniale
          </label>
          <select
            value={formData.maritalStatus}
            onChange={(e) => handleChange('maritalStatus', e.target.value)}
            className="input"
          >
            {MARITAL_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Profession
          </label>
          <input
            type="text"
            value={formData.occupation}
            onChange={(e) => handleChange('occupation', e.target.value)}
            className="input"
            placeholder="Ex: Ingenieur, Enseignant..."
          />
        </div>
      </div>

      {/* VIP Status */}
      <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
        <input
          type="checkbox"
          id="vip"
          checked={formData.vip}
          onChange={(e) => handleChange('vip', e.target.checked)}
          className="h-5 w-5 rounded text-purple-600"
        />
        <label htmlFor="vip" className="text-sm font-medium text-purple-900">
          Patient VIP (priorite dans la file d'attente)
        </label>
      </div>
    </div>
  );
}
