import React, { memo } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import DateOfBirthInput from '../DateOfBirthInput';

/**
 * PersonalInfoStep Component
 * Collects patient's personal information (name, DOB, gender)
 */
const PersonalInfoStep = memo(({
  formData,
  errors,
  duplicateCheckStatus,
  onChange,
  onShowDuplicateCheck,
  onRetryDuplicateCheck
}) => {
  return (
    <div className="space-y-6">
      {/* Show captured photo thumbnail with duplicate check status */}
      {formData.capturedPhoto && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden">
              <img src={formData.capturedPhoto} alt="Patient" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm text-gray-600">Photo du patient</span>
          </div>
          {/* Duplicate check status badge */}
          <div>
            {duplicateCheckStatus === 'checking' && (
              <span className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                <Loader2 className="h-4 w-4 animate-spin" />
                Vérification...
              </span>
            )}
            {duplicateCheckStatus === 'complete' && (
              <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                <CheckCircle className="h-4 w-4" />
                Vérifié
              </span>
            )}
            {duplicateCheckStatus === 'duplicates_found' && (
              <button
                onClick={onShowDuplicateCheck}
                className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full hover:bg-amber-200"
              >
                <AlertCircle className="h-4 w-4" />
                Doublons détectés
              </button>
            )}
            {duplicateCheckStatus === 'error' && (
              <button
                onClick={onRetryDuplicateCheck}
                className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full hover:bg-red-200"
              >
                <AlertCircle className="h-4 w-4" />
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* First Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Prénom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => onChange('firstName', e.target.value)}
            className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
              errors.firstName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
            }`}
            placeholder="Jean"
            autoFocus
          />
          {errors.firstName && (
            <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.firstName}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => onChange('lastName', e.target.value)}
            className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
              errors.lastName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
            }`}
            placeholder="Kabila"
          />
          {errors.lastName && (
            <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.lastName}
            </p>
          )}
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Date de naissance <span className="text-red-500">*</span>
        </label>
        <DateOfBirthInput
          value={formData.dateOfBirth}
          onChange={(date) => onChange('dateOfBirth', date)}
          error={errors.dateOfBirth}
        />
        {errors.dateOfBirth && (
          <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.dateOfBirth}
          </p>
        )}
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Sexe <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onChange('gender', 'male')}
            className={`p-6 border-3 rounded-lg font-semibold text-lg transition transform hover:scale-105 ${
              formData.gender === 'male'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">👨</span>
              <span>Homme</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChange('gender', 'female')}
            className={`p-6 border-3 rounded-lg font-semibold text-lg transition transform hover:scale-105 ${
              formData.gender === 'female'
                ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-lg'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">👩</span>
              <span>Femme</span>
            </div>
          </button>
        </div>
        {errors.gender && (
          <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.gender}
          </p>
        )}
      </div>
    </div>
  );
});

PersonalInfoStep.displayName = 'PersonalInfoStep';

export default PersonalInfoStep;
