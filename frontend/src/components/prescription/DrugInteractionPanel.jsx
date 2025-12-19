/**
 * DrugInteractionPanel - Real-time drug interaction checking
 *
 * StudioVision Parity: Live safety monitoring during prescription
 *
 * Features:
 * - Real-time interaction checking as medications are added
 * - Color-coded severity (minor, moderate, major)
 * - Patient allergy checking
 * - Therapeutic duplication warnings
 * - Override with documentation option
 *
 * Usage:
 * <DrugInteractionPanel
 *   medications={currentPrescriptionMedications}
 *   patientId={patient._id}
 *   patientAllergies={patient.medicalHistory.allergies}
 * />
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  X,
  Loader2
} from 'lucide-react';
import drugSafetyService from '../../services/drugSafetyService';

// Severity configuration
const SEVERITY_CONFIG = {
  major: {
    color: 'red',
    Icon: AlertCircle,
    label: 'MAJEURE',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-500',
    textClass: 'text-red-600',
    badgeClass: 'bg-red-600 text-white'
  },
  moderate: {
    color: 'orange',
    Icon: AlertTriangle,
    label: 'MODÉRÉE',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-600',
    badgeClass: 'bg-orange-600 text-white'
  },
  minor: {
    color: 'yellow',
    Icon: Info,
    label: 'MINEURE',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-500',
    textClass: 'text-yellow-700',
    badgeClass: 'bg-yellow-500 text-white'
  },
  none: {
    color: 'green',
    Icon: CheckCircle,
    label: 'AUCUNE',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-500',
    textClass: 'text-green-600',
    badgeClass: 'bg-green-600 text-white'
  }
};

export default function DrugInteractionPanel({
  medications = [],
  patientId,
  patientAllergies = [],
  existingMedications = [],
  onInteractionOverride,
  collapsed = false,
  autoCheck = true,
  checkDelay = 500
}) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [loading, setLoading] = useState(false);
  const [interactions, setInteractions] = useState([]);
  const [allergyAlerts, setAllergyAlerts] = useState([]);
  const [duplications, setDuplications] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overridingInteraction, setOverridingInteraction] = useState(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Show notification helper
  const showNotification = (title, message, type = 'info') => {
    setNotification({ title, message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Check for allergy matches locally
  const checkAllergies = useCallback(() => {
    if (!patientAllergies.length || !medications.length) {
      setAllergyAlerts([]);
      return;
    }

    const alerts = [];
    const allergenNames = patientAllergies.map(a =>
      (a.allergen || a.name || '').toLowerCase()
    );

    medications.forEach(med => {
      const medName = (med.name || med.drugName || '').toLowerCase();
      const genericName = (med.genericName || '').toLowerCase();

      allergenNames.forEach((allergen, idx) => {
        if (allergen && (medName.includes(allergen) || genericName.includes(allergen))) {
          alerts.push({
            medication: med.name || med.drugName,
            allergen: patientAllergies[idx].allergen || patientAllergies[idx].name,
            severity: patientAllergies[idx].severity || 'severe',
            reaction: patientAllergies[idx].reaction
          });
        }
      });
    });

    setAllergyAlerts(alerts);
  }, [medications, patientAllergies]);

  // Perform full safety check
  const performSafetyCheck = useCallback(async () => {
    if (!medications.length) {
      setInteractions([]);
      setDuplications([]);
      return;
    }

    setLoading(true);
    try {
      const result = await drugSafetyService.performSafetyCheck(patientId, medications);

      if (result?.data) {
        setInteractions(result.data.interactions || []);
        setDuplications(result.data.duplications || []);
      }

      setLastChecked(new Date());
    } catch (error) {
      console.error('Safety check failed:', error);
    } finally {
      setLoading(false);
    }
  }, [medications, patientId]);

  // Auto-check when medications change
  useEffect(() => {
    checkAllergies();

    if (!autoCheck || medications.length === 0) return;

    const timeoutId = setTimeout(() => {
      performSafetyCheck();
    }, checkDelay);

    return () => clearTimeout(timeoutId);
  }, [medications, autoCheck, checkDelay, checkAllergies, performSafetyCheck]);

  // Handle override
  const handleOverride = useCallback((interaction) => {
    setOverridingInteraction(interaction);
    setOverrideReason('');
    setIsOverrideOpen(true);
  }, []);

  const confirmOverride = useCallback(() => {
    if (!overrideReason.trim()) {
      showNotification('Justification requise', 'Veuillez fournir une justification pour cette dérogation', 'warning');
      return;
    }

    if (onInteractionOverride) {
      onInteractionOverride(overridingInteraction, overrideReason);
    }

    showNotification('Dérogation enregistrée', 'L\'interaction a été prise en compte avec votre justification', 'info');

    setIsOverrideOpen(false);
    setOverridingInteraction(null);
    setOverrideReason('');
  }, [overrideReason, overridingInteraction, onInteractionOverride]);

  // Calculate overall severity
  const overallSeverity = useMemo(() => {
    if (allergyAlerts.length > 0) return 'major';
    if (interactions.some(i => i.severity === 'major')) return 'major';
    if (interactions.some(i => i.severity === 'moderate')) return 'moderate';
    if (interactions.some(i => i.severity === 'minor') || duplications.length > 0) return 'minor';
    return 'none';
  }, [allergyAlerts, interactions, duplications]);

  const severityConfig = SEVERITY_CONFIG[overallSeverity];
  const SeverityIcon = severityConfig.Icon;
  const totalAlerts = allergyAlerts.length + interactions.length + duplications.length;

  return (
    <div className={`border rounded-lg overflow-hidden bg-white shadow-sm ${totalAlerts > 0 ? severityConfig.borderClass : 'border-gray-200'}`}>
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'warning' ? 'bg-yellow-500' :
          notification.type === 'info' ? 'bg-blue-500' : 'bg-gray-500'
        } text-white`}>
          <p className="font-medium">{notification.title}</p>
          <p className="text-sm opacity-90">{notification.message}</p>
        </div>
      )}

      {/* Header */}
      <div
        className={`p-3 flex items-center justify-between cursor-pointer ${totalAlerts > 0 ? severityConfig.bgClass : 'bg-gray-50'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <SeverityIcon className={`w-5 h-5 ${severityConfig.textClass}`} />
          <span className="font-semibold">INTERACTIONS MÉDICAMENTEUSES</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          {!loading && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${totalAlerts > 0 ? severityConfig.badgeClass : 'bg-green-600 text-white'}`}>
              {totalAlerts === 0 ? 'Aucune' : `${totalAlerts} alerte${totalAlerts > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-xs text-gray-500">
              Vérifié à {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button className="p-1 hover:bg-black/10 rounded">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3">
          {/* No medications message */}
          {medications.length === 0 && (
            <p className="text-gray-500 text-center py-4">
              Ajoutez des médicaments pour vérifier les interactions
            </p>
          )}

          {/* Allergy Alerts - Always show first */}
          {allergyAlerts.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-1 text-sm font-semibold text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>ALERTES ALLERGIES</span>
              </div>
              {allergyAlerts.map((alert, idx) => (
                <div key={idx} className="p-3 bg-red-50 border-l-4 border-red-500 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-red-800">
                        {alert.medication} - Allergie connue
                      </p>
                      <p className="text-xs text-red-700">
                        Allergène: {alert.allergen}
                        {alert.reaction && ` - Réaction: ${alert.reaction}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drug Interactions */}
          {interactions.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-sm font-semibold text-gray-700">
                INTERACTIONS DÉTECTÉES
              </p>
              {interactions.map((interaction, idx) => {
                const config = SEVERITY_CONFIG[interaction.severity] || SEVERITY_CONFIG.minor;
                const InteractionIcon = config.Icon;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-md border-l-4 ${config.bgClass} ${config.borderClass}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <InteractionIcon className={`w-4 h-4 ${config.textClass}`} />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.badgeClass}`}>
                          {config.label}
                        </span>
                      </div>
                      {interaction.severity !== 'major' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOverride(interaction);
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
                          title="Dérogation médicale"
                        >
                          Ignorer
                        </button>
                      )}
                    </div>
                    <p className="font-medium text-sm">
                      {interaction.drug1} + {interaction.drug2}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {interaction.description || interaction.message}
                    </p>
                    {interaction.recommendation && (
                      <p className={`text-xs mt-1 italic ${config.textClass}`}>
                        Recommandation: {interaction.recommendation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Therapeutic Duplications */}
          {duplications.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                DUPLICATIONS THÉRAPEUTIQUES
              </p>
              {duplications.map((dup, idx) => (
                <div key={idx} className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-yellow-800">
                        Classe: {dup.therapeuticClass}
                      </p>
                      <p className="text-xs text-yellow-700">
                        Médicaments: {dup.medications?.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Clear */}
          {medications.length > 0 && totalAlerts === 0 && !loading && (
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded-md flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800">
                Aucune interaction détectée entre les médicaments prescrits
              </p>
            </div>
          )}

          {/* Manual refresh button */}
          {medications.length > 0 && (
            <div className="flex justify-center mt-3">
              <button
                onClick={performSafetyCheck}
                disabled={loading}
                className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Revérifier les interactions
              </button>
            </div>
          )}
        </div>
      )}

      {/* Override Modal */}
      {isOverrideOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsOverrideOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">Dérogation - Interaction Médicamenteuse</h3>
              <button onClick={() => setIsOverrideOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">
                      {overridingInteraction?.drug1} + {overridingInteraction?.drug2}
                    </p>
                    <p className="text-xs text-gray-600">{overridingInteraction?.description}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Justification médicale *
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette interaction est acceptable dans ce contexte clinique..."
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Annuler
              </button>
              <button
                onClick={confirmOverride}
                disabled={!overrideReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                Confirmer la dérogation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact interaction badge for prescription header
 */
export function InteractionBadge({ medications = [], patientId }) {
  const [severity, setSeverity] = useState('none');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (medications.length < 2) {
      setSeverity('none');
      setCount(0);
      return;
    }

    const checkInteractions = async () => {
      try {
        const result = await drugSafetyService.performSafetyCheck(patientId, medications);
        const interactions = result?.data?.interactions || [];
        setCount(interactions.length);

        if (interactions.some(i => i.severity === 'major')) {
          setSeverity('major');
        } else if (interactions.some(i => i.severity === 'moderate')) {
          setSeverity('moderate');
        } else if (interactions.length > 0) {
          setSeverity('minor');
        } else {
          setSeverity('none');
        }
      } catch (error) {
        console.error('Interaction check failed:', error);
      }
    };

    const timeout = setTimeout(checkInteractions, 300);
    return () => clearTimeout(timeout);
  }, [medications, patientId]);

  if (count === 0) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        OK
      </span>
    );
  }

  const config = SEVERITY_CONFIG[severity];
  const BadgeIcon = config.Icon;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${config.badgeClass}`}>
      <BadgeIcon className="w-3 h-3" />
      {count} interaction{count > 1 ? 's' : ''}
    </span>
  );
}
