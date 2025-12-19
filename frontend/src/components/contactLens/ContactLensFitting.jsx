/**
 * ContactLensFitting - 4-Tab Contact Lens Fitting Module
 *
 * StudioVision Parity: Complete contact lens fitting workflow
 */

import { useState, useCallback, useMemo } from 'react';
import {
  User,
  Target,
  Droplet,
  Calendar,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Printer,
  Save
} from 'lucide-react';
import { toast } from 'react-toastify';

// Tab Components
import ContactLensHistoryTab from './ContactLensHistoryTab';
import ContactLensFittingTab from './ContactLensFittingTab';
import ContactLensCareTab from './ContactLensCareTab';
import ContactLensFollowUpTab from './ContactLensFollowUpTab';

// Tab configuration
const TABS = [
  { key: 'history', label: 'HISTORIQUE', labelEn: 'History', icon: User, color: 'blue' },
  { key: 'fitting', label: 'PARAMETRES', labelEn: 'Fitting', icon: Target, color: 'purple' },
  { key: 'care', label: 'ENTRETIEN', labelEn: 'Care', icon: Droplet, color: 'teal' },
  { key: 'followup', label: 'SUIVI', labelEn: 'Follow-up', icon: Calendar, color: 'orange' }
];

// Lens type options
const LENS_TYPES = [
  { value: 'soft_spherical', label: 'Souple Sphérique' },
  { value: 'soft_toric', label: 'Souple Torique' },
  { value: 'soft_multifocal', label: 'Souple Multifocal' },
  { value: 'rgp', label: 'Rigide (RGP)' },
  { value: 'scleral', label: 'Scléral' },
  { value: 'hybrid', label: 'Hybride' },
  { value: 'ortho_k', label: 'Ortho-K' }
];

const FITTING_STATUS = [
  { value: 'initial', label: 'Premier Essayage' },
  { value: 'refit', label: 'Réadaptation' },
  { value: 'routine', label: 'Renouvellement' }
];

export default function ContactLensFitting({
  examData = {},
  patient,
  refraction,
  keratometry,
  onUpdate,
  onSave,
  readOnly = false,
  showPrint = true,
  defaultTab = 0
}) {
  const [tabIndex, setTabIndex] = useState(defaultTab);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const [fittingData, setFittingData] = useState(() => {
    return examData?.contactLensFitting || {
      wearingHistory: { isWearer: false, currentIssues: [] },
      lensType: 'soft_spherical',
      trialLens: { OD: {}, OS: {} },
      assessment: { OD: {}, OS: {} },
      finalPrescription: { OD: {}, OS: {} },
      careInstructions: { annualSupply: { wearingDaysPerWeek: 7 } },
      followUp: {
        fittingStatus: 'initial',
        recommendedIntervals: { firstFollowUp: '1-2 weeks', secondFollowUp: '1 month', annualExam: '12 months' },
        educationChecklist: {}
      },
      status: 'in_progress'
    };
  });

  const handleDataUpdate = useCallback((section, data) => {
    setFittingData(prev => {
      const updated = { ...prev, [section]: typeof data === 'function' ? data(prev[section]) : data };
      if (onUpdate) onUpdate({ contactLensFitting: updated });
      return updated;
    });
    setHasChanges(true);
  }, [onUpdate]);

  const tabCompletion = useMemo(() => {
    const h = fittingData.wearingHistory || {};
    const a = fittingData.assessment || {};
    const c = fittingData.careInstructions || {};
    const f = fittingData.followUp || {};
    const ed = f.educationChecklist || {};
    return {
      history: h.isWearer !== undefined,
      fitting: (a.OD?.centration || a.OS?.centration) && (a.OD?.movement || a.OS?.movement),
      care: c.solutionType || c.annualSupply?.boxesNeeded,
      followup: Object.values(ed).filter(item => item?.completed).length >= 4
    };
  }, [fittingData]);

  const educationProgress = useMemo(() => {
    const checklist = fittingData.followUp?.educationChecklist || {};
    const total = 8;
    const completed = Object.values(checklist).filter(item => item?.completed).length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }, [fittingData.followUp?.educationChecklist]);

  const handleSave = useCallback(() => {
    if (onSave) onSave({ contactLensFitting: fittingData });
    setHasChanges(false);
    toast.success('Les données ont été sauvegardées');
  }, [fittingData, onSave]);

  const handlePrint = useCallback(() => {
    toast.info('Fonction d\'impression à venir');
  }, []);

  const isNewWearer = !fittingData.wearingHistory?.isWearer;

  const tabColorClasses = {
    blue: { active: 'text-blue-600 border-blue-600', inactive: 'text-gray-500 hover:text-blue-500' },
    purple: { active: 'text-purple-600 border-purple-600', inactive: 'text-gray-500 hover:text-purple-500' },
    teal: { active: 'text-teal-600 border-teal-600', inactive: 'text-gray-500 hover:text-teal-500' },
    orange: { active: 'text-orange-600 border-orange-600', inactive: 'text-gray-500 hover:text-orange-500' }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="p-3 bg-purple-50 flex items-center justify-between border-b border-purple-200">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-purple-600" />
          <div>
            <span className="font-bold text-purple-700">ADAPTATION LENTILLES DE CONTACT</span>
            <p className="text-xs text-gray-600">Contact Lens Fitting</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${fittingData.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
            {fittingData.status === 'completed' ? 'Terminé' : 'En cours'}
          </span>
          {isNewWearer && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
              Nouveau porteur
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && !readOnly && (
            <button className="flex items-center gap-1 px-3 py-1 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700" onClick={handleSave}>
              <Save className="w-4 h-4" /> Sauvegarder
            </button>
          )}
          {showPrint && (
            <button className="p-1 hover:bg-purple-100 rounded" onClick={handlePrint}>
              <Printer className="w-5 h-5" />
            </button>
          )}
          <button className="p-1 hover:bg-purple-100 rounded" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Lens Type Selector */}
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium mr-2">Type de lentille:</span>
              {LENS_TYPES.map(type => (
                <button
                  key={type.value}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    fittingData.lensType === type.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => !readOnly && handleDataUpdate('lensType', type.value)}
                  disabled={readOnly}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-gray-50 px-2 pt-2">
            <div className="flex gap-1">
              {TABS.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = tabIndex === idx;
                const colors = tabColorClasses[tab.color];
                return (
                  <button
                    key={tab.key}
                    className={`px-4 py-2 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
                      isActive ? `bg-white ${colors.active}` : `bg-gray-100 border-transparent ${colors.inactive}`
                    }`}
                    onClick={() => setTabIndex(idx)}
                  >
                    <Icon className="w-4 h-4" />
                    <div className="text-left">
                      <span className="text-sm font-medium block">{tab.label}</span>
                      <span className="text-xs text-gray-500">{tab.labelEn}</span>
                    </div>
                    {tabCompletion[tab.key] && <Check className="w-4 h-4 text-green-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {tabIndex === 0 && (
              <ContactLensHistoryTab
                data={fittingData.wearingHistory}
                currentCorrection={examData?.currentCorrection?.contacts}
                onUpdate={(data) => handleDataUpdate('wearingHistory', data)}
                readOnly={readOnly}
              />
            )}
            {tabIndex === 1 && (
              <ContactLensFittingTab
                trialLens={fittingData.trialLens}
                assessment={fittingData.assessment}
                finalPrescription={fittingData.finalPrescription}
                lensType={fittingData.lensType}
                refraction={refraction}
                keratometry={keratometry}
                onUpdateTrialLens={(data) => handleDataUpdate('trialLens', data)}
                onUpdateAssessment={(data) => handleDataUpdate('assessment', data)}
                onUpdateFinalRx={(data) => handleDataUpdate('finalPrescription', data)}
                readOnly={readOnly}
              />
            )}
            {tabIndex === 2 && (
              <ContactLensCareTab
                data={fittingData.careInstructions}
                finalPrescription={fittingData.finalPrescription}
                onUpdate={(data) => handleDataUpdate('careInstructions', data)}
                readOnly={readOnly}
              />
            )}
            {tabIndex === 3 && (
              <ContactLensFollowUpTab
                data={fittingData.followUp}
                educationProgress={educationProgress}
                onUpdate={(data) => handleDataUpdate('followUp', data)}
                onScheduleAppointment={() => toast.info('Ouverture du calendrier...')}
                readOnly={readOnly}
              />
            )}
          </div>

          {/* Summary Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex gap-4">
                {TABS.map(tab => (
                  <div key={tab.key} className="flex items-center gap-1">
                    {tabCompletion[tab.key] ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                    )}
                    <span className="text-xs text-gray-600">{tab.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Éducation: {educationProgress.completed}/{educationProgress.total}
                </span>
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${educationProgress.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${educationProgress.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ContactLensFittingBadge({ fittingData }) {
  if (!fittingData) return null;
  const status = fittingData.status || 'in_progress';
  const lensType = LENS_TYPES.find(t => t.value === fittingData.lensType);
  return (
    <div className="flex gap-2">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
        {status === 'completed' ? 'CL Complet' : 'CL En cours'}
      </span>
      {lensType && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
          {lensType.label}
        </span>
      )}
    </div>
  );
}

export { LENS_TYPES, FITTING_STATUS, TABS as CL_TABS };
