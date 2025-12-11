import React, { memo } from 'react';
import { Camera, CheckCircle, Shield, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { WebcamCapture, FacialDuplicateCheck } from '../biometric';

/**
 * BiometricStep Component
 * Handles photo capture and duplicate patient checking
 */
const BiometricStep = memo(({
  formData,
  errors,
  showCamera,
  showDuplicateCheck,
  duplicateCheckStatus,
  duplicateCheckResults,
  isAdmin,
  onPhotoCapture,
  onShowCamera,
  onShowDuplicateCheck,
  onNoDuplicates,
  onSelectExisting,
  onProceedAnyway,
  onViewProfile,
  onAddToQueue,
  onCancelDuplicateCheck,
  onRetakePhoto,
  onBiometricConsentChange
}) => {
  if (showCamera) {
    return (
      <WebcamCapture
        onCapture={onPhotoCapture}
        onCancel={() => onShowCamera(false)}
        instantCapture={true}
        captureDelay={1500}
      />
    );
  }

  if (showDuplicateCheck) {
    return (
      <FacialDuplicateCheck
        capturedImage={formData.capturedPhoto}
        onNoDuplicates={onNoDuplicates}
        onSelectExisting={onSelectExisting}
        onProceedAnyway={onProceedAnyway}
        onViewProfile={onViewProfile}
        onAddToQueue={onAddToQueue}
        onCancel={onCancelDuplicateCheck}
        preloadedResults={duplicateCheckResults}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        {/* Photo Preview or Placeholder */}
        <div className="flex flex-col items-center mb-6">
          {formData.capturedPhoto ? (
            <div className="relative">
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-green-500 shadow-lg">
                <img
                  src={formData.capturedPhoto}
                  alt="Patient"
                  className="w-full h-full object-cover"
                />
              </div>
              {formData.duplicateCheckPassed && (
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => onShowCamera(true)}
              className="w-40 h-40 rounded-full border-4 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-blue-400 cursor-pointer transition-all"
            >
              <Camera className="h-12 w-12 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Capturer photo</span>
            </div>
          )}
        </div>

        {/* Status Message */}
        {formData.duplicateCheckPassed ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Vérification terminée - Aucun doublon détecté</span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <p className="text-blue-700 text-sm">
              La capture d'une photo permet de vérifier automatiquement si ce patient existe déjà dans le système et prévient les doublons.
            </p>
          </div>
        )}

        {/* Photo Error Message */}
        {errors.photo && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{errors.photo}</span>
            </div>
          </div>
        )}

        {/* Mandatory Warning for Non-Admin */}
        {!isAdmin && !formData.duplicateCheckPassed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-amber-700">
              <Lock className="h-5 w-5" />
              <span className="font-medium">La capture de photo et vérification sont obligatoires</span>
            </div>
            <p className="text-amber-600 text-sm mt-1">
              Pour prévenir les fraudes, tous les nouveaux patients doivent être photographiés et vérifiés.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {!formData.capturedPhoto && (
            <button
              onClick={() => onShowCamera(true)}
              className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-lg font-medium"
            >
              <Camera className="h-6 w-6" />
              Prendre une photo
            </button>
          )}

          {formData.capturedPhoto && !formData.duplicateCheckPassed && (
            <button
              onClick={() => onShowDuplicateCheck(true)}
              className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-lg font-medium"
            >
              <Shield className="h-6 w-6" />
              Vérifier les doublons
            </button>
          )}

          {formData.capturedPhoto && (
            <button
              onClick={onRetakePhoto}
              className="text-gray-600 hover:text-gray-900"
            >
              Reprendre la photo
            </button>
          )}
        </div>

        {/* Biometric Consent */}
        {formData.capturedPhoto && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.biometricConsent}
                onChange={(e) => onBiometricConsentChange(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Consentement biométrique</span>
                <p className="text-gray-500 mt-1">
                  J'autorise l'enregistrement de mes données biométriques (photo et empreinte faciale)
                  à des fins d'identification médicale sécurisée.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
});

BiometricStep.displayName = 'BiometricStep';

export default BiometricStep;
