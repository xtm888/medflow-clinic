/**
 * PatientPhotoAvatar Component
 *
 * Displays a patient's profile photo with fallback to initials.
 * Used throughout the app for consistent patient photo display.
 */

import { useState } from 'react';
import { User, Camera, Shield, AlertTriangle } from 'lucide-react';

// Size configurations
const SIZES = {
  xs: { container: 'w-8 h-8', icon: 'h-4 w-4', text: 'text-xs' },
  sm: { container: 'w-10 h-10', icon: 'h-5 w-5', text: 'text-sm' },
  md: { container: 'w-12 h-12', icon: 'h-6 w-6', text: 'text-base' },
  lg: { container: 'w-16 h-16', icon: 'h-8 w-8', text: 'text-lg' },
  xl: { container: 'w-20 h-20', icon: 'h-10 w-10', text: 'text-xl' },
  '2xl': { container: 'w-24 h-24', icon: 'h-12 w-12', text: 'text-2xl' },
  '3xl': { container: 'w-32 h-32', icon: 'h-16 w-16', text: 'text-3xl' }
};

export default function PatientPhotoAvatar({
  patient,
  size = 'md',
  showBiometricBadge = false,
  showVerificationStatus = false,
  onClick,
  className = ''
}) {
  const [imageError, setImageError] = useState(false);

  const sizeConfig = SIZES[size] || SIZES.md;

  // Get initials from patient name
  const getInitials = () => {
    if (!patient) return '?';
    const first = patient.firstName?.[0] || '';
    const last = patient.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  // Get background color based on patient name (consistent color per patient)
  const getBackgroundColor = () => {
    if (!patient?.firstName) return 'bg-gray-400';

    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-cyan-500'
    ];

    const charCode = (patient.firstName.charCodeAt(0) || 0) + (patient.lastName?.charCodeAt(0) || 0);
    return colors[charCode % colors.length];
  };

  // Check if patient has biometric enrollment
  const hasBiometric = patient?.biometric?.faceEncoding?.length > 0;
  const lastVerification = patient?.biometric?.lastVerification;

  const photoUrl = patient?.photoUrl || patient?.photo;
  const showPhoto = photoUrl && !imageError;

  const handleClick = () => {
    if (onClick) {
      onClick(patient);
    }
  };

  return (
    <div
      className={`relative inline-block ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      {/* Main Avatar */}
      <div
        className={`${sizeConfig.container} rounded-full overflow-hidden flex items-center justify-center ${
          showPhoto ? 'bg-gray-200' : getBackgroundColor()
        } ${onClick ? 'hover:ring-2 hover:ring-blue-400 transition-all' : ''}`}
      >
        {showPhoto ? (
          <img
            src={photoUrl}
            alt={`${patient?.firstName || ''} ${patient?.lastName || ''}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className={`font-semibold text-white ${sizeConfig.text}`}>
            {getInitials()}
          </span>
        )}
      </div>

      {/* Biometric Badge */}
      {showBiometricBadge && (
        <div
          className={`absolute -bottom-1 -right-1 rounded-full p-0.5 ${
            hasBiometric ? 'bg-green-500' : 'bg-gray-400'
          }`}
          title={hasBiometric ? 'Biométrie enregistrée' : 'Pas de biométrie'}
        >
          <Shield className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Verification Status Badge */}
      {showVerificationStatus && lastVerification && (
        <div
          className={`absolute -top-1 -right-1 rounded-full p-0.5 ${
            lastVerification.success ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={lastVerification.success ? 'Identité vérifiée' : 'Échec de vérification'}
        >
          {lastVerification.success ? (
            <Shield className="h-3 w-3 text-white" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-white" />
          )}
        </div>
      )}

      {/* No Photo Indicator */}
      {!showPhoto && onClick && (
        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
          <Camera className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
}

/**
 * Patient Photo with Name
 * Combines avatar with patient name display
 */
export function PatientPhotoWithName({
  patient,
  size = 'md',
  showBiometricBadge = false,
  subtitle,
  onClick,
  className = ''
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PatientPhotoAvatar
        patient={patient}
        size={size}
        showBiometricBadge={showBiometricBadge}
        onClick={onClick}
      />
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {patient?.firstName} {patient?.lastName}
        </p>
        {subtitle && (
          <p className="text-sm text-gray-500 truncate">{subtitle}</p>
        )}
        {patient?.patientId && !subtitle && (
          <p className="text-sm text-gray-500">ID: {patient.patientId}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Patient Photo Placeholder for Registration
 */
export function PatientPhotoPlaceholder({
  size = 'xl',
  onClick,
  message = 'Ajouter une photo',
  className = ''
}) {
  const sizeConfig = SIZES[size] || SIZES.xl;

  return (
    <button
      onClick={onClick}
      className={`${sizeConfig.container} rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition-colors ${className}`}
    >
      <Camera className={`${sizeConfig.icon} text-gray-400 mb-1`} />
      <span className="text-xs text-gray-500">{message}</span>
    </button>
  );
}
