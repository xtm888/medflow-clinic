/**
 * VisualDevelopmentStep
 *
 * Pediatric visual development milestone assessment component.
 * Tracks age-appropriate visual milestones and flags delays.
 */

import { useState, useMemo } from 'react';
import {
  Eye,
  Baby,
  Check,
  X,
  AlertTriangle,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

// Visual development milestones with expected age ranges (in months)
const VISUAL_MILESTONES = {
  fixation: {
    id: 'fixation',
    label: 'Fixation',
    description: 'Peut fixer un objet ou une lumière',
    expectedAge: { min: 0, max: 1 },
    category: 'basic'
  },
  blinkToLight: {
    id: 'blinkToLight',
    label: 'Réflexe de clignement',
    description: 'Cligne des yeux en réponse à une lumière vive',
    expectedAge: { min: 0, max: 1 },
    category: 'basic'
  },
  pupilResponse: {
    id: 'pupilResponse',
    label: 'Réflexe pupillaire',
    description: 'Constriction pupillaire à la lumière',
    expectedAge: { min: 0, max: 1 },
    category: 'basic'
  },
  fixAndFollow: {
    id: 'fixAndFollow',
    label: 'Fixation et poursuite',
    description: 'Fixe et suit un objet sur 90°',
    expectedAge: { min: 1, max: 3 },
    category: 'tracking'
  },
  socialSmile: {
    id: 'socialSmile',
    label: 'Sourire social',
    description: 'Sourit en réponse à un visage',
    expectedAge: { min: 1, max: 2 },
    category: 'social'
  },
  followsVertically: {
    id: 'followsVertically',
    label: 'Poursuite verticale',
    description: 'Suit des objets verticalement',
    expectedAge: { min: 2, max: 4 },
    category: 'tracking'
  },
  followsFullRange: {
    id: 'followsFullRange',
    label: 'Poursuite complète',
    description: 'Suit sur 180° horizontalement',
    expectedAge: { min: 3, max: 4 },
    category: 'tracking'
  },
  recognizesFaces: {
    id: 'recognizesFaces',
    label: 'Reconnaissance faciale',
    description: 'Reconnaît les visages familiers',
    expectedAge: { min: 2, max: 4 },
    category: 'social'
  },
  reachesForObjects: {
    id: 'reachesForObjects',
    label: 'Atteinte d\'objets',
    description: 'Tend la main vers les objets vus',
    expectedAge: { min: 3, max: 5 },
    category: 'coordination'
  },
  handEyeCoordination: {
    id: 'handEyeCoordination',
    label: 'Coordination œil-main',
    description: 'Coordination visuo-motrice développée',
    expectedAge: { min: 4, max: 6 },
    category: 'coordination'
  },
  convergence: {
    id: 'convergence',
    label: 'Convergence',
    description: 'Convergence stable sur objets proches',
    expectedAge: { min: 3, max: 6 },
    category: 'binocular'
  },
  alignmentStable: {
    id: 'alignmentStable',
    label: 'Alignement stable',
    description: 'Pas de strabisme manifeste',
    expectedAge: { min: 4, max: 6 },
    category: 'binocular'
  },
  colorRecognition: {
    id: 'colorRecognition',
    label: 'Reconnaissance des couleurs',
    description: 'Reconnaît et nomme les couleurs de base',
    expectedAge: { min: 24, max: 36 },
    category: 'cognitive'
  },
  depthPerception: {
    id: 'depthPerception',
    label: 'Perception de profondeur',
    description: 'Stéréopsie fonctionnelle',
    expectedAge: { min: 3, max: 6 },
    category: 'binocular'
  },
  visualAttention: {
    id: 'visualAttention',
    label: 'Attention visuelle',
    description: 'Maintient attention visuelle > 30 secondes',
    expectedAge: { min: 6, max: 12 },
    category: 'cognitive'
  }
};

// Milestone categories
const CATEGORIES = {
  basic: { label: 'Réflexes de base', icon: Eye, color: 'blue' },
  tracking: { label: 'Poursuite oculaire', icon: Eye, color: 'green' },
  social: { label: 'Vision sociale', icon: Baby, color: 'purple' },
  coordination: { label: 'Coordination visuo-motrice', icon: Eye, color: 'orange' },
  binocular: { label: 'Vision binoculaire', icon: Eye, color: 'teal' },
  cognitive: { label: 'Développement cognitif', icon: Eye, color: 'indigo' }
};

// Status options
const STATUS_OPTIONS = {
  present: { label: 'Présent', icon: Check, color: 'green' },
  absent: { label: 'Absent', icon: X, color: 'red' },
  delayed: { label: 'Retardé', icon: Clock, color: 'yellow' },
  uncertain: { label: 'Incertain', icon: HelpCircle, color: 'gray' },
  notTested: { label: 'Non testé', icon: null, color: 'gray' }
};

export default function VisualDevelopmentStep({
  data = {},
  onChange,
  patientAge, // Age in months
  readOnly = false
}) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(['basic', 'tracking']));

  // Get milestones appropriate for patient age
  const relevantMilestones = useMemo(() => {
    const ageInMonths = patientAge || 0;
    return Object.values(VISUAL_MILESTONES).filter(m => {
      // Show milestones expected by this age + 6 months buffer for delayed ones
      return m.expectedAge.min <= ageInMonths + 6;
    });
  }, [patientAge]);

  // Group milestones by category
  const groupedMilestones = useMemo(() => {
    const groups = {};
    relevantMilestones.forEach(milestone => {
      if (!groups[milestone.category]) {
        groups[milestone.category] = [];
      }
      groups[milestone.category].push(milestone);
    });
    return groups;
  }, [relevantMilestones]);

  // Calculate milestone status relative to age
  const getMilestoneStatus = (milestone) => {
    const ageInMonths = patientAge || 0;
    const status = data.milestones?.[milestone.id]?.status;

    if (!status || status === 'notTested') {
      // Check if milestone should have been achieved
      if (ageInMonths > milestone.expectedAge.max + 3) {
        return 'overdue';
      }
      return 'pending';
    }

    if (status === 'absent' && ageInMonths > milestone.expectedAge.max) {
      return 'delayed';
    }

    return status;
  };

  // Count concerns
  const concernCount = useMemo(() => {
    return relevantMilestones.filter(m => {
      const status = getMilestoneStatus(m);
      return status === 'absent' || status === 'delayed' || status === 'overdue';
    }).length;
  }, [relevantMilestones, data.milestones, patientAge]);

  // Handle milestone status change
  const handleStatusChange = (milestoneId, status) => {
    if (readOnly) return;

    onChange({
      ...data,
      milestones: {
        ...data.milestones,
        [milestoneId]: {
          ...data.milestones?.[milestoneId],
          status,
          assessedAt: new Date().toISOString()
        }
      }
    });
  };

  // Handle milestone note change
  const handleNoteChange = (milestoneId, note) => {
    if (readOnly) return;

    onChange({
      ...data,
      milestones: {
        ...data.milestones,
        [milestoneId]: {
          ...data.milestones?.[milestoneId],
          note
        }
      }
    });
  };

  // Handle age achieved change
  const handleAgeAchieved = (milestoneId, ageInMonths) => {
    if (readOnly) return;

    onChange({
      ...data,
      milestones: {
        ...data.milestones,
        [milestoneId]: {
          ...data.milestones?.[milestoneId],
          ageAchieved: ageInMonths
        }
      }
    });
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Format age display
  const formatAge = (months) => {
    if (months < 1) return 'Naissance';
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} an${years > 1 ? 's' : ''}`;
    return `${years} an${years > 1 ? 's' : ''} ${remainingMonths} mois`;
  };

  // Get status indicator color
  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-50 border-green-200';
      case 'absent': return 'text-red-600 bg-red-50 border-red-200';
      case 'delayed': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200';
      case 'uncertain': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Baby className="h-5 w-5 text-blue-500" />
            Développement Visuel
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Âge du patient: {formatAge(patientAge || 0)}
          </p>
        </div>

        {concernCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              {concernCount} préoccupation{concernCount > 1 ? 's' : ''} identifiée{concernCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Age Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Guide d'évaluation</p>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>• Les jalons sont présentés selon l'âge attendu d'acquisition</li>
              <li>• Un retard est signalé si le jalon n'est pas atteint à l'âge maximum attendu</li>
              <li>• Documenter l'âge exact d'acquisition aide au suivi</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Milestone Categories */}
      <div className="space-y-4">
        {Object.entries(groupedMilestones).map(([categoryKey, milestones]) => {
          const category = CATEGORIES[categoryKey];
          const isExpanded = expandedCategories.has(categoryKey);
          const CategoryIcon = category.icon;

          // Category stats
          const categoryStats = {
            total: milestones.length,
            present: milestones.filter(m => getMilestoneStatus(m) === 'present').length,
            concerns: milestones.filter(m => ['absent', 'delayed', 'overdue'].includes(getMilestoneStatus(m))).length
          };

          return (
            <div key={categoryKey} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(categoryKey)}
                className={`w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors ${
                  categoryStats.concerns > 0 ? 'border-l-4 border-l-yellow-400' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon className={`h-5 w-5 text-${category.color}-500`} />
                  <span className="font-medium text-gray-900">{category.label}</span>
                  <span className="text-sm text-gray-500">
                    ({categoryStats.present}/{categoryStats.total})
                  </span>
                  {categoryStats.concerns > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      {categoryStats.concerns} retard{categoryStats.concerns > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {/* Milestones */}
              {isExpanded && (
                <div className="divide-y">
                  {milestones.map(milestone => {
                    const milestoneData = data.milestones?.[milestone.id] || {};
                    const currentStatus = getMilestoneStatus(milestone);
                    const isOverdue = currentStatus === 'overdue';

                    return (
                      <div
                        key={milestone.id}
                        className={`p-4 ${isOverdue ? 'bg-red-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Milestone Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {milestone.label}
                              </span>
                              {isOverdue && !milestoneData.status && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  En retard
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {milestone.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Âge attendu: {formatAge(milestone.expectedAge.min)} - {formatAge(milestone.expectedAge.max)}
                            </p>
                          </div>

                          {/* Status Buttons */}
                          <div className="flex items-center gap-2">
                            {Object.entries(STATUS_OPTIONS).slice(0, 4).map(([statusKey, statusConfig]) => {
                              const isSelected = milestoneData.status === statusKey;
                              const StatusIcon = statusConfig.icon;

                              return (
                                <button
                                  key={statusKey}
                                  onClick={() => handleStatusChange(milestone.id, statusKey)}
                                  disabled={readOnly}
                                  className={`p-2 rounded-lg border transition-all ${
                                    isSelected
                                      ? getStatusColor(statusKey)
                                      : 'border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600'
                                  } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                                  title={statusConfig.label}
                                >
                                  {StatusIcon && <StatusIcon className="h-4 w-4" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Additional Fields when status is set */}
                        {milestoneData.status && milestoneData.status !== 'notTested' && (
                          <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-3">
                            {/* Age Achieved (for present status) */}
                            {milestoneData.status === 'present' && (
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">
                                  Âge d'acquisition:
                                </label>
                                <select
                                  value={milestoneData.ageAchieved || ''}
                                  onChange={(e) => handleAgeAchieved(milestone.id, e.target.value ? parseInt(e.target.value) : null)}
                                  disabled={readOnly}
                                  className="text-sm border rounded px-2 py-1 bg-white"
                                >
                                  <option value="">Non spécifié</option>
                                  {Array.from({ length: 48 }, (_, i) => i + 1).map(month => (
                                    <option key={month} value={month}>
                                      {formatAge(month)}
                                    </option>
                                  ))}
                                </select>
                                {milestoneData.ageAchieved && milestoneData.ageAchieved > milestone.expectedAge.max && (
                                  <span className="text-xs text-yellow-600 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Acquis tardivement
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Notes */}
                            <div>
                              <textarea
                                value={milestoneData.note || ''}
                                onChange={(e) => handleNoteChange(milestone.id, e.target.value)}
                                placeholder="Notes additionnelles..."
                                disabled={readOnly}
                                rows={2}
                                className="w-full text-sm border rounded-lg px-3 py-2 resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Résumé du développement visuel</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Present */}
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Présents</span>
            </div>
            <p className="text-2xl font-bold text-green-700 mt-1">
              {relevantMilestones.filter(m => data.milestones?.[m.id]?.status === 'present').length}
            </p>
          </div>

          {/* Delayed/Absent */}
          <div className="bg-white rounded-lg p-3 border border-red-200">
            <div className="flex items-center gap-2 text-red-600">
              <X className="h-4 w-4" />
              <span className="text-sm font-medium">Absents/Retardés</span>
            </div>
            <p className="text-2xl font-bold text-red-700 mt-1">
              {relevantMilestones.filter(m => ['absent', 'delayed'].includes(data.milestones?.[m.id]?.status)).length}
            </p>
          </div>

          {/* Overdue */}
          <div className="bg-white rounded-lg p-3 border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">En retard</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700 mt-1">
              {relevantMilestones.filter(m => getMilestoneStatus(m) === 'overdue').length}
            </p>
          </div>

          {/* Not Tested */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600">
              <HelpCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Non testés</span>
            </div>
            <p className="text-2xl font-bold text-gray-700 mt-1">
              {relevantMilestones.filter(m => !data.milestones?.[m.id]?.status || data.milestones?.[m.id]?.status === 'notTested').length}
            </p>
          </div>
        </div>

        {/* General Notes */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes générales sur le développement
          </label>
          <textarea
            value={data.generalNotes || ''}
            onChange={(e) => onChange({ ...data, generalNotes: e.target.value })}
            placeholder="Observations générales, préoccupations parentales, contexte familial..."
            disabled={readOnly}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
