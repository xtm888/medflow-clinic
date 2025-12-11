import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, AlertOctagon, Info, Check, X, Shield, Pill, Heart, Activity, ChevronDown, ChevronUp } from 'lucide-react';

// Drug interaction database (simplified - in production, use a real drug interaction API)
const DRUG_INTERACTIONS = {
  'warfarin': {
    'aspirin': { severity: 'high', message: 'Risque accru de saignement' },
    'ibuprofen': { severity: 'high', message: 'Risque accru de saignement gastro-intestinal' },
    'paracetamol': { severity: 'low', message: 'Peut augmenter l\'effet anticoagulant à fortes doses' }
  },
  'metformin': {
    'contrast_dye': { severity: 'high', message: 'Risque d\'acidose lactique' },
    'alcohol': { severity: 'moderate', message: 'Risque d\'hypoglycémie' }
  },
  'simvastatin': {
    'amiodarone': { severity: 'high', message: 'Risque de rhabdomyolyse' },
    'clarithromycin': { severity: 'high', message: 'Risque de myopathie' },
    'grapefruit': { severity: 'moderate', message: 'Augmentation des effets secondaires' }
  },
  'lisinopril': {
    'potassium': { severity: 'moderate', message: 'Risque d\'hyperkaliémie' },
    'spironolactone': { severity: 'moderate', message: 'Risque d\'hyperkaliémie' }
  },
  'digoxin': {
    'amiodarone': { severity: 'high', message: 'Toxicité digitalique accrue' },
    'verapamil': { severity: 'high', message: 'Bradycardie et toxicité' }
  },
  'timolol': {
    'verapamil': { severity: 'high', message: 'Risque de bradycardie sévère' },
    'diltiazem': { severity: 'moderate', message: 'Risque de bradycardie' }
  },
  'latanoprost': {
    'bimatoprost': { severity: 'moderate', message: 'Duplication de classe thérapeutique' }
  },
  'prednisolone': {
    'ibuprofen': { severity: 'moderate', message: 'Risque accru d\'ulcère gastrique' },
    'aspirin': { severity: 'moderate', message: 'Risque accru de saignement GI' }
  }
};

// Common allergen-drug mappings
const ALLERGEN_DRUG_MAPPING = {
  'penicillin': ['amoxicillin', 'ampicillin', 'penicillin', 'piperacillin'],
  'sulfa': ['sulfamethoxazole', 'sulfasalazine', 'sulfadiazine'],
  'aspirin': ['aspirin', 'acetylsalicylic'],
  'nsaid': ['ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'meloxicam'],
  'latex': [], // Not drug-related but important to flag
  'iodine': ['contrast_dye', 'amiodarone', 'povidone-iodine'],
  'codeine': ['codeine', 'morphine', 'hydrocodone', 'oxycodone']
};

// Dosage guidelines (simplified)
const DOSAGE_LIMITS = {
  'paracetamol': { maxDaily: 4000, unit: 'mg', warning: 'Risque hépatotoxique au-dessus de 4g/jour' },
  'ibuprofen': { maxDaily: 2400, unit: 'mg', warning: 'Risque gastro-intestinal et rénal à doses élevées' },
  'metformin': { maxDaily: 2550, unit: 'mg', warning: 'Risque d\'acidose lactique' },
  'timolol': { maxDaily: 1, unit: 'goutte 2x/jour/oeil', warning: 'Risque de bradycardie systémique' }
};

export default function PrescriptionSafetyModal({
  isOpen,
  onClose,
  onConfirm,
  prescription,
  patient
}) {
  const [loading, setLoading] = useState(false);
  const [safetyChecks, setSafetyChecks] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    interactions: true,
    allergies: true,
    dosage: true,
    duplicates: true
  });
  const [acknowledged, setAcknowledged] = useState({});
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && prescription) {
      performSafetyChecks();
    }
  }, [isOpen, prescription]);

  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      modalRef.current?.focus();
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const performSafetyChecks = () => {
    const medications = prescription?.medications || [];
    const patientAllergies = patient?.allergies || [];
    const patientMedications = patient?.currentMedications || [];

    const checks = {
      interactions: [],
      allergies: [],
      dosage: [],
      duplicates: []
    };

    // Extract medication names for comparison
    const medNames = medications.map(med => {
      const name = med.name || med.medication?.name || med.drug?.name || '';
      return name.toLowerCase();
    });

    // 1. Check drug-drug interactions within prescription
    for (let i = 0; i < medNames.length; i++) {
      for (let j = i + 1; j < medNames.length; j++) {
        const drug1 = medNames[i];
        const drug2 = medNames[j];

        // Check both directions
        const interaction = checkInteraction(drug1, drug2);
        if (interaction) {
          checks.interactions.push({
            drug1: medications[i].name || medications[i].medication?.name || 'Médicament 1',
            drug2: medications[j].name || medications[j].medication?.name || 'Médicament 2',
            severity: interaction.severity,
            message: interaction.message
          });
        }
      }

      // Check against patient's current medications
      patientMedications.forEach(currentMed => {
        const currentMedName = (currentMed.name || currentMed).toLowerCase();
        const interaction = checkInteraction(medNames[i], currentMedName);
        if (interaction) {
          checks.interactions.push({
            drug1: medications[i].name || medications[i].medication?.name || 'Nouveau médicament',
            drug2: currentMed.name || currentMed,
            severity: interaction.severity,
            message: interaction.message,
            isCurrentMed: true
          });
        }
      });
    }

    // 2. Check for allergy warnings
    patientAllergies.forEach(allergy => {
      const allergyLower = (allergy.allergen || allergy).toLowerCase();

      medications.forEach(med => {
        const medName = (med.name || med.medication?.name || med.drug?.name || '').toLowerCase();

        // Direct match
        if (medName.includes(allergyLower) || allergyLower.includes(medName)) {
          checks.allergies.push({
            medication: med.name || med.medication?.name || 'Médicament',
            allergen: allergy.allergen || allergy,
            severity: 'high',
            reaction: allergy.reaction || 'Réaction allergique connue'
          });
        }

        // Cross-reactivity check
        Object.entries(ALLERGEN_DRUG_MAPPING).forEach(([allergenKey, drugs]) => {
          if (allergyLower.includes(allergenKey)) {
            drugs.forEach(drug => {
              if (medName.includes(drug)) {
                checks.allergies.push({
                  medication: med.name || med.medication?.name || 'Médicament',
                  allergen: allergy.allergen || allergy,
                  severity: 'high',
                  reaction: `Réactivité croisée possible avec ${allergenKey}`,
                  crossReactivity: true
                });
              }
            });
          }
        });
      });
    });

    // 3. Check dosage limits
    medications.forEach(med => {
      const medName = (med.name || med.medication?.name || med.drug?.name || '').toLowerCase();
      const dosage = med.dosage || '';

      Object.entries(DOSAGE_LIMITS).forEach(([drug, limit]) => {
        if (medName.includes(drug)) {
          // Try to extract dosage number
          const match = dosage.match(/(\d+)\s*(mg|g|ml)/i);
          if (match) {
            const amount = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            const normalizedAmount = unit === 'g' ? amount * 1000 : amount;

            // Estimate daily dose (simplified)
            const frequency = med.frequency || '';
            let multiplier = 1;
            if (frequency.includes('2x') || frequency.includes('bid') || frequency.includes('deux fois')) {
              multiplier = 2;
            } else if (frequency.includes('3x') || frequency.includes('tid') || frequency.includes('trois fois')) {
              multiplier = 3;
            } else if (frequency.includes('4x') || frequency.includes('qid') || frequency.includes('quatre fois')) {
              multiplier = 4;
            }

            const estimatedDaily = normalizedAmount * multiplier;
            if (estimatedDaily > limit.maxDaily * 0.8) { // Warn at 80% of max
              checks.dosage.push({
                medication: med.name || med.medication?.name || 'Médicament',
                currentDose: `~${estimatedDaily}${limit.unit.split(' ')[0]}/jour`,
                maxDose: `${limit.maxDaily}${limit.unit}`,
                severity: estimatedDaily > limit.maxDaily ? 'high' : 'moderate',
                warning: limit.warning
              });
            }
          }
        }
      });
    });

    // 4. Check for therapeutic duplicates
    const drugClasses = {};
    medications.forEach(med => {
      const medName = (med.name || med.medication?.name || med.drug?.name || '').toLowerCase();

      // Simplified drug class detection
      if (medName.includes('pril') || medName.includes('sartan')) {
        drugClasses['RAAS'] = drugClasses['RAAS'] || [];
        drugClasses['RAAS'].push(med.name || med.medication?.name || 'Médicament');
      }
      if (medName.includes('statin')) {
        drugClasses['Statines'] = drugClasses['Statines'] || [];
        drugClasses['Statines'].push(med.name || med.medication?.name || 'Médicament');
      }
      if (medName.includes('prazole') || medName.includes('tidine')) {
        drugClasses['Anti-acides'] = drugClasses['Anti-acides'] || [];
        drugClasses['Anti-acides'].push(med.name || med.medication?.name || 'Médicament');
      }
      if (medName.includes('prost') && medName.includes('lat') || medName.includes('travoprost') || medName.includes('bimatoprost')) {
        drugClasses['Prostaglandines'] = drugClasses['Prostaglandines'] || [];
        drugClasses['Prostaglandines'].push(med.name || med.medication?.name || 'Médicament');
      }
    });

    Object.entries(drugClasses).forEach(([className, drugs]) => {
      if (drugs.length > 1) {
        checks.duplicates.push({
          className,
          medications: drugs,
          severity: 'moderate',
          message: `${drugs.length} médicaments de la même classe thérapeutique`
        });
      }
    });

    setSafetyChecks(checks);
  };

  const checkInteraction = (drug1, drug2) => {
    // Check direct interaction
    if (DRUG_INTERACTIONS[drug1]?.[drug2]) {
      return DRUG_INTERACTIONS[drug1][drug2];
    }
    if (DRUG_INTERACTIONS[drug2]?.[drug1]) {
      return DRUG_INTERACTIONS[drug2][drug1];
    }

    // Check partial matches
    for (const [key, interactions] of Object.entries(DRUG_INTERACTIONS)) {
      if (drug1.includes(key) || key.includes(drug1)) {
        for (const [interactingDrug, data] of Object.entries(interactions)) {
          if (drug2.includes(interactingDrug) || interactingDrug.includes(drug2)) {
            return data;
          }
        }
      }
    }

    return null;
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <AlertOctagon className="h-5 w-5 text-red-500" />;
      case 'moderate':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'moderate':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleAcknowledge = (category, index) => {
    setAcknowledged(prev => ({
      ...prev,
      [`${category}-${index}`]: !prev[`${category}-${index}`]
    }));
  };

  const getTotalWarnings = () => {
    if (!safetyChecks) return { high: 0, moderate: 0, low: 0, total: 0 };

    let high = 0, moderate = 0, low = 0;

    Object.values(safetyChecks).flat().forEach(check => {
      if (check.severity === 'high') high++;
      else if (check.severity === 'moderate') moderate++;
      else low++;
    });

    return { high, moderate, low, total: high + moderate + low };
  };

  const allHighSeverityAcknowledged = () => {
    if (!safetyChecks) return true;

    let allAcknowledged = true;

    Object.entries(safetyChecks).forEach(([category, checks]) => {
      checks.forEach((check, index) => {
        if (check.severity === 'high' && !acknowledged[`${category}-${index}`]) {
          allAcknowledged = false;
        }
      });
    });

    return allAcknowledged;
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const warnings = getTotalWarnings();
  const hasWarnings = warnings.total > 0;
  const canProceed = allHighSeverityAcknowledged();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${hasWarnings ? (warnings.high > 0 ? 'bg-red-50' : 'bg-orange-50') : 'bg-green-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${hasWarnings ? (warnings.high > 0 ? 'bg-red-100' : 'bg-orange-100') : 'bg-green-100'}`}>
                <Shield className={`h-6 w-6 ${hasWarnings ? (warnings.high > 0 ? 'text-red-600' : 'text-orange-600') : 'text-green-600'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Vérification de Sécurité</h2>
                <p className="text-sm text-gray-600">
                  {hasWarnings
                    ? `${warnings.total} avertissement(s) détecté(s)`
                    : 'Aucun problème de sécurité détecté'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Warning summary badges */}
          {hasWarnings && (
            <div className="flex items-center space-x-2 mt-3">
              {warnings.high > 0 && (
                <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs font-semibold">
                  {warnings.high} critique(s)
                </span>
              )}
              {warnings.moderate > 0 && (
                <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded-full text-xs font-semibold">
                  {warnings.moderate} modéré(s)
                </span>
              )}
              {warnings.low > 0 && (
                <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                  {warnings.low} informatif(s)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!safetyChecks ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyse en cours...</span>
            </div>
          ) : !hasWarnings ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Prescription Sécuritaire</h3>
              <p className="text-gray-600">
                Aucune interaction médicamenteuse, allergie ou problème de dosage détecté.
              </p>
            </div>
          ) : (
            <>
              {/* Drug Interactions */}
              {safetyChecks.interactions.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('interactions')}
                    className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Activity className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-gray-900">Interactions Médicamenteuses</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {safetyChecks.interactions.length}
                      </span>
                    </div>
                    {expandedSections.interactions ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  {expandedSections.interactions && (
                    <div className="p-4 space-y-3">
                      {safetyChecks.interactions.map((interaction, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getSeverityBadge(interaction.severity)} ${
                            acknowledged[`interactions-${idx}`] ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-2">
                              {getSeverityIcon(interaction.severity)}
                              <div>
                                <p className="font-medium">
                                  {interaction.drug1} ↔ {interaction.drug2}
                                  {interaction.isCurrentMed && (
                                    <span className="ml-2 text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                                      méd. actuel
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm mt-1">{interaction.message}</p>
                              </div>
                            </div>
                            {interaction.severity === 'high' && (
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={acknowledged[`interactions-${idx}`] || false}
                                  onChange={() => handleAcknowledge('interactions', idx)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs">Lu</span>
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Allergies */}
              {safetyChecks.allergies.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('allergies')}
                    className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Heart className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-gray-900">Alertes Allergies</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                        {safetyChecks.allergies.length}
                      </span>
                    </div>
                    {expandedSections.allergies ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  {expandedSections.allergies && (
                    <div className="p-4 space-y-3">
                      {safetyChecks.allergies.map((allergy, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getSeverityBadge(allergy.severity)} ${
                            acknowledged[`allergies-${idx}`] ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-2">
                              {getSeverityIcon(allergy.severity)}
                              <div>
                                <p className="font-medium">
                                  {allergy.medication} - Allergie: {allergy.allergen}
                                  {allergy.crossReactivity && (
                                    <span className="ml-2 text-xs bg-yellow-200 px-1.5 py-0.5 rounded">
                                      réactivité croisée
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm mt-1">{allergy.reaction}</p>
                              </div>
                            </div>
                            {allergy.severity === 'high' && (
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={acknowledged[`allergies-${idx}`] || false}
                                  onChange={() => handleAcknowledge('allergies', idx)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs">Lu</span>
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dosage Warnings */}
              {safetyChecks.dosage.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('dosage')}
                    className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Pill className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold text-gray-900">Alertes Dosage</span>
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                        {safetyChecks.dosage.length}
                      </span>
                    </div>
                    {expandedSections.dosage ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  {expandedSections.dosage && (
                    <div className="p-4 space-y-3">
                      {safetyChecks.dosage.map((dosageCheck, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getSeverityBadge(dosageCheck.severity)} ${
                            acknowledged[`dosage-${idx}`] ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-2">
                              {getSeverityIcon(dosageCheck.severity)}
                              <div>
                                <p className="font-medium">{dosageCheck.medication}</p>
                                <p className="text-sm mt-1">
                                  Dose estimée: {dosageCheck.currentDose} (Max: {dosageCheck.maxDose})
                                </p>
                                <p className="text-sm text-gray-600">{dosageCheck.warning}</p>
                              </div>
                            </div>
                            {dosageCheck.severity === 'high' && (
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={acknowledged[`dosage-${idx}`] || false}
                                  onChange={() => handleAcknowledge('dosage', idx)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs">Lu</span>
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Therapeutic Duplicates */}
              {safetyChecks.duplicates.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('duplicates')}
                    className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-semibold text-gray-900">Duplications Thérapeutiques</span>
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                        {safetyChecks.duplicates.length}
                      </span>
                    </div>
                    {expandedSections.duplicates ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  {expandedSections.duplicates && (
                    <div className="p-4 space-y-3">
                      {safetyChecks.duplicates.map((duplicate, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getSeverityBadge(duplicate.severity)}`}
                        >
                          <div className="flex items-start space-x-2">
                            {getSeverityIcon(duplicate.severity)}
                            <div>
                              <p className="font-medium">Classe: {duplicate.className}</p>
                              <p className="text-sm mt-1">
                                Médicaments: {duplicate.medications.join(', ')}
                              </p>
                              <p className="text-sm text-gray-600">{duplicate.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          {warnings.high > 0 && !canProceed && (
            <p className="text-sm text-red-600 mb-3 flex items-center">
              <AlertOctagon className="h-4 w-4 mr-2" />
              Veuillez confirmer la lecture de tous les avertissements critiques avant de continuer
            </p>
          )}
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || (warnings.high > 0 && !canProceed)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                hasWarnings
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } ${(loading || (warnings.high > 0 && !canProceed)) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Traitement...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{hasWarnings ? 'Dispenser malgré les avertissements' : 'Confirmer la dispensation'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
