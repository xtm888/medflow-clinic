/**
 * ContactLensFollowUpTab - Follow-up & Patient Education
 *
 * StudioVision Parity: Tab 4 of Contact Lens Fitting workflow
 *
 * Features:
 * - Fitting status tracking
 * - Recommended follow-up intervals
 * - 8-item patient education checklist
 * - Education notes
 * - Next appointment scheduling
 * - Printable education sheet
 */

import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  BookOpen,
  Printer,
  User,
  AlertTriangle,
  Check,
  Info
} from 'lucide-react';

// Fitting status options
const FITTING_STATUS_OPTIONS = [
  {
    value: 'initial',
    label: 'Premier essayage',
    labelEn: 'Initial Fitting',
    color: 'blue',
    desc: 'Nouveau porteur - suivi rapproché requis'
  },
  {
    value: 'refit',
    label: 'Réadaptation',
    labelEn: 'Refit',
    color: 'orange',
    desc: 'Changement de paramètres ou de type'
  },
  {
    value: 'routine',
    label: 'Renouvellement',
    labelEn: 'Routine',
    color: 'green',
    desc: 'Porteur expérimenté - suivi standard'
  }
];

// Follow-up intervals
const FOLLOW_UP_INTERVALS = {
  initial: {
    firstFollowUp: '1-2 semaines',
    secondFollowUp: '1 mois',
    annualExam: '12 mois'
  },
  refit: {
    firstFollowUp: '1 semaine',
    secondFollowUp: '1 mois',
    annualExam: '12 mois'
  },
  routine: {
    firstFollowUp: '1-2 semaines (optionnel)',
    secondFollowUp: 'Non requis',
    annualExam: '12 mois'
  }
};

// Education checklist items
const EDUCATION_CHECKLIST = [
  {
    key: 'insertionRemovalDemo',
    label: 'Démonstration insertion/retrait',
    labelEn: 'Insertion/Removal Demo',
    icon: '👆',
    critical: true,
    description: 'Le patient peut insérer et retirer les lentilles de façon autonome'
  },
  {
    key: 'cleaningStorageInstructions',
    label: 'Instructions nettoyage/conservation',
    labelEn: 'Cleaning/Storage Instructions',
    icon: '🧴',
    critical: true,
    description: 'Procédure de nettoyage et conservation expliquée'
  },
  {
    key: 'wearingScheduleDiscussed',
    label: 'Horaire de port discuté',
    labelEn: 'Wearing Schedule Discussed',
    icon: '⏰',
    critical: true,
    description: 'Nombre d\'heures de port et progression expliqués'
  },
  {
    key: 'complicationSignsReviewed',
    label: 'Signes de complications revus',
    labelEn: 'Complication Signs Reviewed',
    icon: '⚠️',
    critical: true,
    description: 'Douleur, rougeur, vision floue = consulter immédiatement'
  },
  {
    key: 'emergencyContactProvided',
    label: 'Contact d\'urgence fourni',
    labelEn: 'Emergency Contact Provided',
    icon: '📞',
    critical: true,
    description: 'Numéro de téléphone pour urgences communiqué'
  },
  {
    key: 'replacementScheduleEmphasized',
    label: 'Calendrier de remplacement souligné',
    labelEn: 'Replacement Schedule Emphasized',
    icon: '📅',
    critical: false,
    description: 'Date de remplacement des lentilles clarifiée'
  },
  {
    key: 'writtenInstructionsGiven',
    label: 'Instructions écrites remises',
    labelEn: 'Written Instructions Given',
    icon: '📄',
    critical: false,
    description: 'Document récapitulatif remis au patient'
  },
  {
    key: 'patientDemonstratedSkill',
    label: 'Patient a démontré sa maîtrise',
    labelEn: 'Patient Demonstrated Skill',
    icon: '✅',
    critical: true,
    description: 'Le patient a réussi l\'insertion/retrait seul'
  }
];

// Color classes for fitting status
const STATUS_COLORS = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    badge: 'bg-blue-600 text-white',
    icon: 'text-blue-500'
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    badge: 'bg-orange-600 text-white',
    icon: 'text-orange-500'
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    badge: 'bg-green-600 text-white',
    icon: 'text-green-500'
  }
};

export default function ContactLensFollowUpTab({
  data = {},
  educationProgress = { completed: 0, total: 8, percentage: 0 },
  onUpdate,
  onScheduleAppointment,
  readOnly = false
}) {
  // Update handler
  const handleUpdate = useCallback((field, value) => {
    if (readOnly) return;
    onUpdate(prev => ({
      ...prev,
      [field]: value
    }));
  }, [onUpdate, readOnly]);

  // Handle nested update
  const handleNestedUpdate = useCallback((parent, field, value) => {
    if (readOnly) return;
    onUpdate(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [field]: value
      }
    }));
  }, [onUpdate, readOnly]);

  // Handle checklist item toggle
  const handleChecklistToggle = useCallback((itemKey) => {
    if (readOnly) return;

    const currentItem = data.educationChecklist?.[itemKey] || {};
    const isCompleted = !currentItem.completed;

    onUpdate(prev => ({
      ...prev,
      educationChecklist: {
        ...(prev.educationChecklist || {}),
        [itemKey]: {
          completed: isCompleted,
          date: isCompleted ? new Date().toISOString() : null
        }
      }
    }));
  }, [data.educationChecklist, onUpdate, readOnly]);

  // Mark all critical items as complete
  const markAllCritical = useCallback(() => {
    if (readOnly) return;

    const updates = {};
    EDUCATION_CHECKLIST.forEach(item => {
      if (item.critical) {
        updates[item.key] = {
          completed: true,
          date: new Date().toISOString()
        };
      }
    });

    onUpdate(prev => ({
      ...prev,
      educationChecklist: {
        ...(prev.educationChecklist || {}),
        ...updates
      }
    }));

    toast.success('Items critiques marqués');
  }, [onUpdate, readOnly]);

  // Mark all items as complete
  const markAllComplete = useCallback(() => {
    if (readOnly) return;

    const updates = {};
    EDUCATION_CHECKLIST.forEach(item => {
      updates[item.key] = {
        completed: true,
        date: new Date().toISOString()
      };
    });

    onUpdate(prev => ({
      ...prev,
      educationChecklist: updates
    }));

    toast.success('Checklist complète');
  }, [onUpdate, readOnly]);

  // Get recommended intervals based on status
  const intervals = useMemo(() => {
    return FOLLOW_UP_INTERVALS[data.fittingStatus] || FOLLOW_UP_INTERVALS.initial;
  }, [data.fittingStatus]);

  // Check if checklist is complete
  const isChecklistComplete = educationProgress.percentage === 100;
  const criticalItems = EDUCATION_CHECKLIST.filter(i => i.critical);
  const completedCritical = criticalItems.filter(
    i => data.educationChecklist?.[i.key]?.completed
  ).length;
  const allCriticalComplete = completedCritical === criticalItems.length;

  // Handle print
  const handlePrint = useCallback(() => {
    toast.info('Génération du document d\'éducation...');
    // TODO: Implement print education sheet
  }, []);

  return (
    <div className="space-y-6">
      {/* Fitting Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-orange-500" />
          <span className="font-bold">Statut de l'adaptation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FITTING_STATUS_OPTIONS.map(status => {
            const colors = STATUS_COLORS[status.color];
            const isSelected = data.fittingStatus === status.value;

            return (
              <div
                key={status.value}
                className={`p-4 rounded-md border-2 cursor-pointer transition ${
                  isSelected
                    ? `${colors.border} ${colors.bg}`
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${readOnly ? 'cursor-default' : ''}`}
                onClick={() => !readOnly && handleUpdate('fittingStatus', status.value)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.badge}`}>
                    {status.label}
                  </span>
                  {isSelected && (
                    <CheckCircle className={`w-5 h-5 ${colors.icon}`} />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {status.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Follow-up Intervals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-blue-500" />
          <span className="font-bold">Intervalles de suivi recommandés</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-gray-600 mb-1">Premier contrôle</p>
            <input
              value={data.recommendedIntervals?.firstFollowUp || intervals.firstFollowUp}
              onChange={(e) => handleNestedUpdate('recommendedIntervals', 'firstFollowUp', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div className="p-3 bg-purple-50 rounded-md">
            <p className="text-sm text-gray-600 mb-1">Deuxième contrôle</p>
            <input
              value={data.recommendedIntervals?.secondFollowUp || intervals.secondFollowUp}
              onChange={(e) => handleNestedUpdate('recommendedIntervals', 'secondFollowUp', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div className="p-3 bg-green-50 rounded-md">
            <p className="text-sm text-gray-600 mb-1">Examen annuel</p>
            <input
              value={data.recommendedIntervals?.annualExam || intervals.annualExam}
              onChange={(e) => handleNestedUpdate('recommendedIntervals', 'annualExam', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>

        {onScheduleAppointment && (
          <button
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            onClick={onScheduleAppointment}
            disabled={readOnly}
          >
            <Calendar className="w-4 h-4" />
            Planifier le prochain rendez-vous
          </button>
        )}
      </div>

      <hr className="border-gray-200" />

      {/* Education Checklist */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-teal-500" />
            <span className="font-bold">Checklist éducation patient</span>
            {/* Circular Progress */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 transform -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke={isChecklistComplete ? '#22c55e' : '#3b82f6'}
                  strokeWidth="3"
                  strokeDasharray={`${educationProgress.percentage * 1.005} 100.5`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                {educationProgress.percentage}%
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              onClick={markAllCritical}
              disabled={readOnly || allCriticalComplete}
            >
              <Check className="w-4 h-4" />
              Marquer critiques
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
              onClick={markAllComplete}
              disabled={readOnly || isChecklistComplete}
            >
              <CheckCircle className="w-4 h-4" />
              Tout marquer
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">
              {educationProgress.completed} sur {educationProgress.total} items complétés
            </span>
            {!allCriticalComplete && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
                {criticalItems.length - completedCritical} items critiques restants
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${isChecklistComplete ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${educationProgress.percentage}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2">
          {EDUCATION_CHECKLIST.map(item => {
            const isCompleted = data.educationChecklist?.[item.key]?.completed;
            const completedDate = data.educationChecklist?.[item.key]?.date;

            return (
              <div
                key={item.key}
                className={`p-3 rounded-md border flex items-center justify-between cursor-pointer transition ${
                  isCompleted
                    ? 'bg-green-50 border-green-200 hover:bg-green-100'
                    : item.critical
                      ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                } ${readOnly ? 'cursor-default' : ''}`}
                onClick={() => handleChecklistToggle(item.key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isCompleted ? 'font-bold' : ''}`}>
                        {item.label}
                      </span>
                      {item.critical && !isCompleted && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
                          Critique
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {item.labelEn}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCompleted && completedDate && (
                    <span className="text-xs text-gray-500">
                      {new Date(completedDate).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  <div title={item.description}>
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Education Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes d'éducation</label>
        <textarea
          value={data.educationNotes || ''}
          onChange={(e) => handleUpdate('educationNotes', e.target.value)}
          placeholder="Notes supplémentaires concernant l'éducation du patient...&#10;&#10;Additional patient education notes..."
          rows={3}
          disabled={readOnly}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {/* Print Education Sheet */}
      <div className="flex justify-end">
        <button
          className="flex items-center gap-2 px-4 py-2 text-teal-700 border border-teal-300 rounded-md hover:bg-teal-50"
          onClick={handlePrint}
        >
          <Printer className="w-4 h-4" />
          Imprimer fiche d'éducation
        </button>
      </div>

      {/* Completion Status */}
      {isChecklistComplete ? (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-green-800">Éducation complète</p>
            <p className="text-sm text-green-600">
              Tous les items de la checklist ont été couverts avec le patient.
            </p>
          </div>
        </div>
      ) : !allCriticalComplete && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-md">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-orange-800">Items critiques manquants</p>
            <p className="text-sm text-orange-600">
              Assurez-vous de couvrir tous les items critiques avant la fin du rendez-vous.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Education progress indicator for compact display
 */
export function EducationProgressBadge({ educationChecklist }) {
  if (!educationChecklist) return null;

  const completed = Object.values(educationChecklist).filter(i => i?.completed).length;
  const total = EDUCATION_CHECKLIST.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${percentage === 100 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
      <BookOpen className="w-3 h-3" />
      <span>Éducation: {percentage}%</span>
    </span>
  );
}

// Export checklist for use in other components
export { EDUCATION_CHECKLIST };
