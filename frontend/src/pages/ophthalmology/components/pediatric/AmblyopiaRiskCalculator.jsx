/**
 * AmblyopiaRiskCalculator
 *
 * Comprehensive amblyopia risk assessment tool for pediatric patients.
 * Evaluates risk factors, calculates risk level, and provides recommendations.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Eye,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Shield,
  FileText,
  Glasses,
  Ban
} from 'lucide-react';

// Risk factors with weights and descriptions
const RISK_FACTORS = {
  // Refractive Risk Factors
  refractive: {
    label: 'Facteurs réfractifs',
    factors: {
      anisometropia: {
        id: 'anisometropia',
        label: 'Anisométropie',
        description: 'Différence de réfraction entre les deux yeux',
        weight: 3,
        options: [
          { value: 'none', label: 'Aucune (<1.0 D)', risk: 0 },
          { value: 'mild', label: 'Légère (1.0-2.0 D)', risk: 1 },
          { value: 'moderate', label: 'Modérée (2.0-3.0 D)', risk: 2 },
          { value: 'severe', label: 'Sévère (>3.0 D)', risk: 3 }
        ]
      },
      highHyperopia: {
        id: 'highHyperopia',
        label: 'Hypermétropie élevée',
        description: 'Hypermétropie > +3.50 D',
        weight: 2,
        options: [
          { value: 'none', label: 'Non (< +3.50 D)', risk: 0 },
          { value: 'mild', label: 'Modérée (+3.50 à +5.00 D)', risk: 1 },
          { value: 'high', label: 'Élevée (> +5.00 D)', risk: 2 }
        ]
      },
      highMyopia: {
        id: 'highMyopia',
        label: 'Myopie élevée',
        description: 'Myopie > -6.00 D',
        weight: 2,
        options: [
          { value: 'none', label: 'Non (> -6.00 D)', risk: 0 },
          { value: 'high', label: 'Oui (< -6.00 D)', risk: 2 }
        ]
      },
      astigmatism: {
        id: 'astigmatism',
        label: 'Astigmatisme significatif',
        description: 'Astigmatisme > 1.50 D',
        weight: 2,
        options: [
          { value: 'none', label: 'Non (< 1.50 D)', risk: 0 },
          { value: 'mild', label: 'Modéré (1.50-2.50 D)', risk: 1 },
          { value: 'high', label: 'Élevé (> 2.50 D)', risk: 2 }
        ]
      }
    }
  },

  // Strabismus Risk Factors
  strabismus: {
    label: 'Facteurs de strabisme',
    factors: {
      strabismusPresent: {
        id: 'strabismusPresent',
        label: 'Strabisme présent',
        description: 'Déviation oculaire manifeste',
        weight: 3,
        options: [
          { value: 'none', label: 'Absent', risk: 0 },
          { value: 'intermittent', label: 'Intermittent', risk: 2 },
          { value: 'constant', label: 'Constant', risk: 3 }
        ]
      },
      strabismusType: {
        id: 'strabismusType',
        label: 'Type de strabisme',
        description: 'Classification du strabisme',
        weight: 2,
        options: [
          { value: 'none', label: 'Aucun', risk: 0 },
          { value: 'esotropia', label: 'Ésotropie', risk: 2 },
          { value: 'exotropia', label: 'Exotropie', risk: 1 },
          { value: 'hypertropia', label: 'Hypertropie', risk: 2 }
        ],
        dependsOn: 'strabismusPresent',
        showIf: (deps) => deps.strabismusPresent && deps.strabismusPresent !== 'none'
      },
      deviationAngle: {
        id: 'deviationAngle',
        label: 'Angle de déviation',
        description: 'Magnitude de la déviation',
        weight: 2,
        options: [
          { value: 'none', label: 'Aucune', risk: 0 },
          { value: 'small', label: 'Petite (< 10∆)', risk: 1 },
          { value: 'moderate', label: 'Modérée (10-30∆)', risk: 2 },
          { value: 'large', label: 'Grande (> 30∆)', risk: 3 }
        ],
        dependsOn: 'strabismusPresent',
        showIf: (deps) => deps.strabismusPresent && deps.strabismusPresent !== 'none'
      }
    }
  },

  // Deprivation Risk Factors
  deprivation: {
    label: 'Facteurs de privation',
    factors: {
      ptosis: {
        id: 'ptosis',
        label: 'Ptosis',
        description: 'Chute de la paupière supérieure',
        weight: 3,
        options: [
          { value: 'none', label: 'Absent', risk: 0 },
          { value: 'mild', label: 'Léger (ne couvre pas pupille)', risk: 1 },
          { value: 'moderate', label: 'Modéré (couvre partiellement)', risk: 2 },
          { value: 'severe', label: 'Sévère (couvre pupille)', risk: 3 }
        ]
      },
      cataract: {
        id: 'cataract',
        label: 'Cataracte congénitale',
        description: 'Opacité du cristallin',
        weight: 4,
        options: [
          { value: 'none', label: 'Absente', risk: 0 },
          { value: 'partial', label: 'Partielle', risk: 2 },
          { value: 'total', label: 'Totale', risk: 4 }
        ]
      },
      cornealOpacity: {
        id: 'cornealOpacity',
        label: 'Opacité cornéenne',
        description: 'Cicatrice ou opacité cornéenne',
        weight: 3,
        options: [
          { value: 'none', label: 'Absente', risk: 0 },
          { value: 'peripheral', label: 'Périphérique', risk: 1 },
          { value: 'central', label: 'Centrale', risk: 3 }
        ]
      },
      mediaOpacity: {
        id: 'mediaOpacity',
        label: 'Autre opacité des milieux',
        description: 'Hémorragie vitréenne, etc.',
        weight: 3,
        options: [
          { value: 'none', label: 'Absente', risk: 0 },
          { value: 'present', label: 'Présente', risk: 3 }
        ]
      }
    }
  },

  // Historical Risk Factors
  historical: {
    label: 'Antécédents',
    factors: {
      familyHistory: {
        id: 'familyHistory',
        label: 'Antécédents familiaux d\'amblyopie',
        description: 'Parent ou fratrie avec amblyopie',
        weight: 2,
        options: [
          { value: 'none', label: 'Aucun', risk: 0 },
          { value: 'sibling', label: 'Fratrie', risk: 1 },
          { value: 'parent', label: 'Parent', risk: 2 },
          { value: 'both', label: 'Fratrie et parent', risk: 2 }
        ]
      },
      prematureHistory: {
        id: 'prematureHistory',
        label: 'Prématurité',
        description: 'Naissance avant 37 semaines',
        weight: 2,
        options: [
          { value: 'none', label: 'Non', risk: 0 },
          { value: 'mild', label: '32-37 semaines', risk: 1 },
          { value: 'severe', label: '< 32 semaines', risk: 2 }
        ]
      },
      lowBirthWeight: {
        id: 'lowBirthWeight',
        label: 'Petit poids de naissance',
        description: 'Poids < 2500g',
        weight: 1,
        options: [
          { value: 'none', label: 'Non (≥ 2500g)', risk: 0 },
          { value: 'low', label: '1500-2500g', risk: 1 },
          { value: 'veryLow', label: '< 1500g', risk: 2 }
        ]
      },
      developmentalDelay: {
        id: 'developmentalDelay',
        label: 'Retard de développement',
        description: 'Retard neurologique ou développemental',
        weight: 2,
        options: [
          { value: 'none', label: 'Non', risk: 0 },
          { value: 'suspected', label: 'Suspecté', risk: 1 },
          { value: 'confirmed', label: 'Confirmé', risk: 2 }
        ]
      }
    }
  }
};

// Risk level thresholds and recommendations
const RISK_LEVELS = {
  low: {
    threshold: 3,
    label: 'Faible',
    color: 'green',
    recommendations: [
      'Dépistage visuel annuel',
      'Surveillance du développement visuel',
      'Éducation parentale sur les signes d\'alerte'
    ]
  },
  moderate: {
    threshold: 7,
    label: 'Modéré',
    color: 'yellow',
    recommendations: [
      'Suivi ophtalmologique tous les 6 mois',
      'Cycloplégie complète recommandée',
      'Évaluation de la vision binoculaire',
      'Considérer correction optique précoce'
    ]
  },
  high: {
    threshold: 12,
    label: 'Élevé',
    color: 'orange',
    recommendations: [
      'Suivi ophtalmologique tous les 3-4 mois',
      'Correction optique complète',
      'Considérer traitement d\'occlusion',
      'Bilan orthoptique complet',
      'Évaluation pour intervention chirurgicale si indiquée'
    ]
  },
  veryHigh: {
    threshold: Infinity,
    label: 'Très élevé',
    color: 'red',
    recommendations: [
      'Prise en charge urgente',
      'Référence au spécialiste pédiatrique',
      'Traitement agressif de la cause',
      'Occlusion intensive si appropriée',
      'Suivi rapproché (toutes les 4-6 semaines)',
      'Considérer traitement de pénalisation'
    ]
  }
};

// Treatment options
const TREATMENT_OPTIONS = {
  glasses: { label: 'Lunettes', icon: Glasses },
  patching: { label: 'Occlusion', icon: Ban },
  atropine: { label: 'Pénalisation atropine', icon: Eye },
  surgery: { label: 'Chirurgie', icon: Eye },
  monitoring: { label: 'Surveillance', icon: Clock }
};

export default function AmblyopiaRiskCalculator({
  data = {},
  onChange,
  patientAge, // Age in months
  visualAcuityData = {},
  refractionData = {},
  strabismusData = {},
  readOnly = false
}) {
  const [expandedSections, setExpandedSections] = useState(new Set(['refractive', 'strabismus']));

  // Calculate total risk score
  const riskCalculation = useMemo(() => {
    let totalScore = 0;
    let maxPossibleScore = 0;
    const factorDetails = [];

    Object.entries(RISK_FACTORS).forEach(([categoryKey, category]) => {
      Object.entries(category.factors).forEach(([factorKey, factor]) => {
        // Check if factor should be shown
        if (factor.showIf && !factor.showIf(data.factors || {})) {
          return;
        }

        const selectedValue = data.factors?.[factorKey];
        const selectedOption = factor.options.find(o => o.value === selectedValue);

        // Calculate max for this factor
        const maxRisk = Math.max(...factor.options.map(o => o.risk));
        maxPossibleScore += maxRisk * factor.weight;

        if (selectedOption && selectedOption.risk > 0) {
          const score = selectedOption.risk * factor.weight;
          totalScore += score;
          factorDetails.push({
            factor: factor.label,
            value: selectedOption.label,
            score,
            weight: factor.weight
          });
        }
      });
    });

    // Determine risk level
    let riskLevel = 'low';
    for (const [level, config] of Object.entries(RISK_LEVELS)) {
      if (totalScore < config.threshold) {
        riskLevel = level;
        break;
      }
    }

    return {
      totalScore,
      maxPossibleScore,
      percentage: maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0,
      riskLevel,
      riskConfig: RISK_LEVELS[riskLevel],
      factorDetails
    };
  }, [data.factors]);

  // Handle factor change
  const handleFactorChange = (factorId, value) => {
    if (readOnly) return;

    onChange({
      ...data,
      factors: {
        ...data.factors,
        [factorId]: value
      },
      lastAssessedAt: new Date().toISOString()
    });
  };

  // Handle treatment change
  const handleTreatmentChange = (treatmentId, checked) => {
    if (readOnly) return;

    const currentTreatments = data.treatments || [];
    const newTreatments = checked
      ? [...currentTreatments, treatmentId]
      : currentTreatments.filter(t => t !== treatmentId);

    onChange({
      ...data,
      treatments: newTreatments
    });
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Get risk level color classes
  const getRiskColorClasses = (level) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'veryHigh': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format age
  const formatAge = (months) => {
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years} an${years > 1 ? 's' : ''} ${rem} mois` : `${years} an${years > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Évaluation du Risque d'Amblyopie
          </h3>
          {patientAge && (
            <p className="text-sm text-gray-500 mt-1">
              Âge du patient: {formatAge(patientAge)}
            </p>
          )}
        </div>
      </div>

      {/* Risk Score Display */}
      <div className={`rounded-lg border-2 p-4 ${getRiskColorClasses(riskCalculation.riskLevel)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-lg font-semibold">
                Niveau de risque: {riskCalculation.riskConfig.label}
              </span>
            </div>
            <p className="text-sm mt-1 opacity-80">
              Score: {riskCalculation.totalScore} / {riskCalculation.maxPossibleScore} ({riskCalculation.percentage}%)
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{riskCalculation.totalScore}</div>
            <div className="text-sm opacity-80">points</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              riskCalculation.riskLevel === 'low' ? 'bg-green-500' :
              riskCalculation.riskLevel === 'moderate' ? 'bg-yellow-500' :
              riskCalculation.riskLevel === 'high' ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${riskCalculation.percentage}%` }}
          />
        </div>
      </div>

      {/* Risk Factors Assessment */}
      <div className="space-y-4">
        {Object.entries(RISK_FACTORS).map(([categoryKey, category]) => {
          const isExpanded = expandedSections.has(categoryKey);

          // Count risk factors in this category
          const categoryFactors = Object.values(category.factors);
          const identifiedRisks = categoryFactors.filter(f => {
            const val = data.factors?.[f.id];
            const opt = f.options.find(o => o.value === val);
            return opt && opt.risk > 0;
          }).length;

          return (
            <div key={categoryKey} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleSection(categoryKey)}
                className={`w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors ${
                  identifiedRisks > 0 ? 'border-l-4 border-l-yellow-400' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-900">{category.label}</span>
                  {identifiedRisks > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      {identifiedRisks} facteur{identifiedRisks > 1 ? 's' : ''} identifié{identifiedRisks > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {/* Factors */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {Object.entries(category.factors).map(([factorKey, factor]) => {
                    // Check visibility condition
                    if (factor.showIf && !factor.showIf(data.factors || {})) {
                      return null;
                    }

                    const selectedValue = data.factors?.[factorKey];
                    const selectedOption = factor.options.find(o => o.value === selectedValue);
                    const hasRisk = selectedOption && selectedOption.risk > 0;

                    return (
                      <div
                        key={factorKey}
                        className={`p-3 rounded-lg ${hasRisk ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{factor.label}</span>
                              {hasRisk && (
                                <span className="text-xs text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                                  +{selectedOption.risk * factor.weight} pts
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{factor.description}</p>
                          </div>

                          {/* Options */}
                          <div className="flex flex-wrap gap-2 justify-end">
                            {factor.options.map(option => (
                              <button
                                key={option.value}
                                onClick={() => handleFactorChange(factorKey, option.value)}
                                disabled={readOnly}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                  selectedValue === option.value
                                    ? option.risk > 0
                                      ? 'bg-yellow-500 text-white border-yellow-500'
                                      : 'bg-green-500 text-white border-green-500'
                                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
                                } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Identified Risk Factors Summary */}
      {riskCalculation.factorDetails.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" />
            Facteurs de risque identifiés
          </h4>
          <div className="space-y-2">
            {riskCalculation.factorDetails.map((detail, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-yellow-700">
                  {detail.factor}: <span className="font-medium">{detail.value}</span>
                </span>
                <span className="text-yellow-800 font-medium">+{detail.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 flex items-center gap-2 mb-3">
          <Info className="h-5 w-5" />
          Recommandations
        </h4>
        <ul className="space-y-2">
          {riskCalculation.riskConfig.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-blue-700">
              <Check className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* Treatment Plan */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-gray-500" />
          Plan de traitement
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(TREATMENT_OPTIONS).map(([treatmentId, treatment]) => {
            const isSelected = data.treatments?.includes(treatmentId);
            const TreatmentIcon = treatment.icon;

            return (
              <button
                key={treatmentId}
                onClick={() => handleTreatmentChange(treatmentId, !isSelected)}
                disabled={readOnly}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <TreatmentIcon className={`h-5 w-5 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">{treatment.label}</span>
                {isSelected && <Check className="h-4 w-4 ml-auto text-blue-500" />}
              </button>
            );
          })}
        </div>

        {/* Treatment Notes */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes sur le plan de traitement
          </label>
          <textarea
            value={data.treatmentNotes || ''}
            onChange={(e) => onChange({ ...data, treatmentNotes: e.target.value })}
            placeholder="Détails du protocole d'occlusion, prescription optique, calendrier de suivi..."
            disabled={readOnly}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 resize-none"
          />
        </div>
      </div>

      {/* Follow-up Schedule */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-gray-500" />
          Calendrier de suivi recommandé
        </h4>

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-700">Prochain rendez-vous:</label>
          <select
            value={data.followUpInterval || ''}
            onChange={(e) => onChange({ ...data, followUpInterval: e.target.value })}
            disabled={readOnly}
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Sélectionner...</option>
            <option value="4_weeks">4 semaines</option>
            <option value="6_weeks">6 semaines</option>
            <option value="2_months">2 mois</option>
            <option value="3_months">3 mois</option>
            <option value="4_months">4 mois</option>
            <option value="6_months">6 mois</option>
            <option value="1_year">1 an</option>
          </select>

          {riskCalculation.riskLevel === 'veryHigh' && (
            <span className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Suivi rapproché recommandé
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
