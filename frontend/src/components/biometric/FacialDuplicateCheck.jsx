/**
 * FacialDuplicateCheck Component
 *
 * Checks for duplicate patients using facial recognition.
 * Displays potential matches and allows staff to review/select.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  User,
  Check,
  X,
  Phone,
  Calendar,
  Loader2,
  Shield,
  UserX,
  UserCheck,
  ChevronRight,
  Eye,
  Plus,
  ExternalLink
} from 'lucide-react';
import api from '../../services/apiConfig';

export default function FacialDuplicateCheck({
  capturedImage,
  onNoDuplicates,
  onSelectExisting,
  onProceedAnyway,
  onCancel,
  onViewProfile,      // NEW: Navigate to patient profile
  onAddToQueue,       // NEW: Add existing patient to queue
  className = '',
  // New prop: pre-fetched results from async check (skip API call if provided)
  preloadedResults = null,
  isAdmin = false     // NEW: Allow admin to override definite duplicates
}) {
  // State
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(preloadedResults);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showConfirmNew, setShowConfirmNew] = useState(false);

  // Check for duplicates when image is provided (skip if preloaded)
  useEffect(() => {
    if (preloadedResults) {
      // Results already available from async check
      setResults(preloadedResults);
      setChecking(false);
      return;
    }
    if (capturedImage && !results) {
      checkForDuplicates();
    }
  }, [capturedImage, preloadedResults]);

  const checkForDuplicates = async () => {
    if (!capturedImage) return;

    setChecking(true);
    setError(null);
    setResults(null);

    try {
      const response = await api.post('/face-recognition/check-duplicates', {
        image: capturedImage
      });

      setResults(response.data);

      // If no duplicates found, callback immediately
      if (!response.data.hasPossibleDuplicates && onNoDuplicates) {
        onNoDuplicates(response.data.newEncoding);
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
      setError(err.response?.data?.error || 'Erreur lors de la vérification');
    } finally {
      setChecking(false);
    }
  };

  // Handle selecting an existing patient
  const handleSelectExisting = (patient) => {
    setSelectedPatient(patient);
  };

  const confirmSelectExisting = () => {
    if (selectedPatient && onSelectExisting) {
      onSelectExisting(selectedPatient);
    }
  };

  // Handle proceeding with new patient
  const handleProceedNew = () => {
    if (results?.hasDefiniteDuplicates) {
      setShowConfirmNew(true);
    } else if (onProceedAnyway) {
      onProceedAnyway(results?.newEncoding);
    }
  };

  const confirmProceedNew = () => {
    if (onProceedAnyway) {
      onProceedAnyway(results?.newEncoding);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Check if any match exceeds 50% similarity (block threshold for non-admin)
  const hasHighSimilarity = () => {
    if (!results?.potentialDuplicates) return false;
    return results.potentialDuplicates.some(match => match.confidence >= 0.5);
  };

  // Get match level badge
  const getMatchBadge = (level, confidence, isDefiniteMatch) => {
    // For definite duplicates - no percentage, just block
    if (isDefiniteMatch) {
      return (
        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
          DOUBLON CONFIRMÉ
        </span>
      );
    }

    // For possible matches - show confidence level
    switch (level) {
      case 'high':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
            Correspondance forte ({Math.round(confidence * 100)}%)
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
            Correspondance moyenne ({Math.round(confidence * 100)}%)
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
            Correspondance faible ({Math.round(confidence * 100)}%)
          </span>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (checking) {
    return (
      <div className={`bg-white rounded-lg border p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Vérification en cours...
          </h3>
          <p className="text-gray-500">
            Recherche de patients similaires dans la base de données
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Erreur de vérification
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={checkForDuplicates}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Réessayer
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Service unavailable - allow proceeding with warning
  if (results && results.serviceUnavailable) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Service non disponible
          </h3>
          <p className="text-gray-500 mb-4">
            Le service de reconnaissance faciale n'est pas disponible actuellement.
            La vérification des doublons par photo sera ignorée.
          </p>
          <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg mb-6">
            Veuillez vérifier manuellement que ce patient n'existe pas déjà dans le système.
          </p>
          <button
            onClick={() => onNoDuplicates?.(null)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <Check className="h-4 w-4" />
            Continuer sans vérification faciale
          </button>
        </div>
      </div>
    );
  }

  // No duplicates found
  if (results && !results.hasPossibleDuplicates) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun doublon détecté
          </h3>
          <p className="text-gray-500 mb-4">
            Ce patient n'existe pas encore dans la base de données.
            Vous pouvez procéder à l'enregistrement.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {results.totalCompared} patients vérifiés
          </p>
          <button
            onClick={() => onNoDuplicates?.(results.newEncoding)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 mx-auto"
          >
            <Check className="h-4 w-4" />
            Continuer l'enregistrement
          </button>
        </div>
      </div>
    );
  }

  // Confirmation modal for proceeding despite duplicates
  if (showConfirmNew) {
    return (
      <div className={`bg-white rounded-lg border ${className}`}>
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Confirmer la création
              </h3>
              <p className="text-gray-500 mt-1">
                Des patients similaires ont été détectés. Êtes-vous sûr de vouloir
                créer un nouveau dossier ?
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Attention :</strong> La création de doublons peut entraîner
              des erreurs médicales et des problèmes de facturation. Veuillez
              vérifier attentivement avant de continuer.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirmNew(false)}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={confirmProceedNew}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Créer quand même
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Selected patient confirmation - with direct action buttons
  if (selectedPatient) {
    return (
      <div className={`bg-white rounded-lg border ${className}`}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 rounded-full">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Patient trouvé
            </h3>
          </div>

          <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              {selectedPatient.photoUrl ? (
                <img
                  src={selectedPatient.photoUrl}
                  alt={selectedPatient.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-10 w-10 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 text-lg">
                {selectedPatient.name}
              </h4>
              {selectedPatient.patientId && (
                <p className="text-sm text-blue-600 font-medium">
                  ID: {selectedPatient.patientId}
                </p>
              )}
              <div className="text-sm text-gray-600 space-y-1 mt-1">
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(selectedPatient.dateOfBirth)}
                </p>
                {selectedPatient.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {selectedPatient.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="text-gray-600 mb-6">
            Ce patient existe déjà dans le système. Choisissez une action:
          </p>

          {/* Action Buttons - Clear choices */}
          <div className="space-y-3">
            {/* View Profile - Primary action */}
            {onViewProfile && (
              <button
                onClick={() => onViewProfile(selectedPatient._id || selectedPatient.patientId)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Eye className="h-5 w-5" />
                Voir le Profil Patient
                <ExternalLink className="h-4 w-4 ml-1" />
              </button>
            )}

            {/* Add to Queue - Secondary action */}
            {onAddToQueue && (
              <button
                onClick={() => onAddToQueue(selectedPatient)}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Ajouter à la File d'Attente
              </button>
            )}

            {/* Fallback if no specific actions - use generic select */}
            {!onViewProfile && !onAddToQueue && (
              <button
                onClick={confirmSelectExisting}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Eye className="h-5 w-5" />
                Utiliser ce patient
              </button>
            )}
          </div>

          {/* Back button */}
          <button
            onClick={() => setSelectedPatient(null)}
            className="w-full mt-3 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  // Duplicates found - show list
  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className={`p-4 border-b ${results?.hasDefiniteDuplicates ? 'bg-red-50' : 'bg-yellow-50'}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-6 w-6 flex-shrink-0 mt-0.5 ${results?.hasDefiniteDuplicates ? 'text-red-600' : 'text-yellow-600'}`} />
          <div>
            <h3 className={`font-medium ${results?.hasDefiniteDuplicates ? 'text-red-800' : 'text-yellow-800'}`}>
              {results?.hasDefiniteDuplicates
                ? 'Patient déjà enregistré - Doublon détecté !'
                : 'Patients similaires détectés'}
            </h3>
            <p className={`text-sm mt-1 ${results?.hasDefiniteDuplicates ? 'text-red-700' : 'text-yellow-700'}`}>
              {results?.hasDefiniteDuplicates
                ? 'Ce patient existe déjà dans le système. Sélectionnez le patient existant.'
                : `${results?.duplicateCount} correspondance${results?.duplicateCount > 1 ? 's' : ''} trouvée${results?.duplicateCount > 1 ? 's' : ''} sur ${results?.totalCompared} patients`}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison View */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-4">
          {/* Captured photo */}
          <div className="flex-shrink-0 text-center">
            <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-blue-500">
              <img
                src={capturedImage}
                alt="Nouvelle photo"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Nouvelle photo</p>
          </div>

          <ChevronRight className="h-6 w-6 text-gray-400" />

          {/* Best match photo */}
          {results?.bestMatch && (
            <div className="flex-shrink-0 text-center">
              <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-yellow-500 bg-gray-100">
                {results.bestMatch.photoUrl ? (
                  <img
                    src={results.bestMatch.photoUrl}
                    alt={results.bestMatch.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-10 w-10 text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Meilleure correspondance</p>
            </div>
          )}
        </div>
      </div>

      {/* Potential Duplicates List */}
      <div className="max-h-[300px] overflow-y-auto">
        {results?.potentialDuplicates?.map((patient, index) => (
          <div
            key={patient.patientId}
            className={`p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors ${
              patient.isDefiniteMatch ? 'bg-red-50' : ''
            }`}
            onClick={() => handleSelectExisting(patient)}
          >
            <div className="flex items-center gap-4">
              {/* Photo */}
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {patient.photoUrl ? (
                  <img
                    src={patient.photoUrl}
                    alt={patient.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 truncate">
                    {patient.name}
                  </h4>
                  {getMatchBadge(patient.matchLevel, patient.confidence, patient.isDefiniteMatch)}
                </div>
                <div className="text-sm text-gray-500 space-y-0.5">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Né(e) le {formatDate(patient.dateOfBirth)}
                  </p>
                  {patient.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      {patient.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t">
        {hasHighSimilarity() && !isAdmin ? (
          // High similarity (≥50%) - BLOCK new patient creation (non-admin only)
          <div className="text-center">
            <div className="bg-red-100 border border-red-200 rounded-lg p-4 mb-3">
              <p className="text-sm text-red-800 font-medium">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Création bloquée - Ressemblance trop élevée (≥50%)
              </p>
              <p className="text-xs text-red-700 mt-1">
                Ce patient ressemble fortement à un patient existant. Sélectionnez le patient existant ci-dessus pour continuer.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        ) : (
          // Possible duplicates - allow proceeding with warning
          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Annuler
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleProceedNew}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2"
              >
                <UserX className="h-4 w-4" />
                Créer nouveau patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
