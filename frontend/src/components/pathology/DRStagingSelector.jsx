/**
 * DRStagingSelector - Diabetic Retinopathy Staging Component
 *
 * StudioVision Parity: Matches diabetic retinopathy staging from oph4.jpg
 * - Visual stage selector with color coding
 * - ETDRS classification support
 * - Maculopathy grading
 * - OD/OS independent staging
 * - French and English labels
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Eye,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';

// Diabetic Retinopathy Stages (ETDRS Classification)
const DR_STAGES = [
  {
    id: 'none',
    code: 'R0',
    label: 'Pas de rétinopathie diabétique',
    labelEn: 'No Diabetic Retinopathy',
    shortLabel: 'Absence RD',
    description: 'Pas de lésion visible',
    color: 'green',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    textColor: 'text-green-800',
    icon: CheckCircle,
    severity: 0,
    recommendedFollowUp: '12 mois'
  },
  {
    id: 'mild_npdr',
    code: 'R1',
    label: 'RDNP Légère (Minime)',
    labelEn: 'Mild NPDR',
    shortLabel: 'RDNP Légère',
    description: 'Microanévrismes isolés (< 5)',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-800',
    icon: AlertTriangle,
    severity: 1,
    recommendedFollowUp: '12 mois'
  },
  {
    id: 'moderate_npdr',
    code: 'R2',
    label: 'RDNP Modérée',
    labelEn: 'Moderate NPDR',
    shortLabel: 'RDNP Modérée',
    description: 'Microanévrismes > 5, hémorragies rétiniennes, exsudats',
    color: 'orange',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    textColor: 'text-orange-800',
    icon: AlertTriangle,
    severity: 2,
    recommendedFollowUp: '6-9 mois'
  },
  {
    id: 'severe_npdr',
    code: 'R3',
    label: 'RDNP Sévère (Pré-proliférative)',
    labelEn: 'Severe NPDR',
    shortLabel: 'RDNP Sévère',
    description: 'Règle 4-2-1: hémorragies 4 quadrants, chapelet veineux 2 quadrants, AMIR 1 quadrant',
    color: 'red',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    textColor: 'text-red-800',
    icon: AlertCircle,
    severity: 3,
    recommendedFollowUp: '3-4 mois'
  },
  {
    id: 'pdr',
    code: 'R4',
    label: 'RD Proliférative',
    labelEn: 'Proliferative DR',
    shortLabel: 'RD Prolif.',
    description: 'Néovascularisation papillaire ou rétinienne',
    color: 'purple',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-800',
    icon: XCircle,
    severity: 4,
    recommendedFollowUp: 'Urgent - Laser/IVT'
  },
  {
    id: 'pdr_complicated',
    code: 'R5',
    label: 'RD Proliférative Compliquée',
    labelEn: 'Complicated PDR',
    shortLabel: 'RD Prolif. Compl.',
    description: 'Hémorragie intravitréenne, décollement de rétine tractionnel, glaucome néovasculaire',
    color: 'pink',
    bgColor: 'bg-pink-100',
    borderColor: 'border-pink-300',
    textColor: 'text-pink-800',
    icon: XCircle,
    severity: 5,
    recommendedFollowUp: 'Urgent - Chirurgie'
  }
];

// Diabetic Maculopathy (DME) Stages
const DME_STAGES = [
  {
    id: 'no_dme',
    code: 'M0',
    label: 'Pas de maculopathie',
    labelEn: 'No DME',
    description: 'Macula normale, pas d\'épaississement',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    severity: 0
  },
  {
    id: 'dme_non_central',
    code: 'M1',
    label: 'OMD Non Central',
    labelEn: 'Non-center-involving DME',
    description: 'Épaississement maculaire n\'atteignant pas le centre (> 1mm de la fovéa)',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    severity: 1
  },
  {
    id: 'dme_central',
    code: 'M2',
    label: 'OMD Central',
    labelEn: 'Center-involving DME',
    description: 'Épaississement maculaire atteignant le centre (< 1mm de la fovéa)',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    severity: 2
  }
];

// CSME criteria for maculopathy
const CSME_CRITERIA = [
  { id: 'thickening_500', label: 'Épaississement à 500μm du centre', labelEn: 'Thickening within 500μm of center' },
  { id: 'exudates_500', label: 'Exsudats durs à 500μm du centre', labelEn: 'Hard exudates within 500μm' },
  { id: 'thickening_1dd', label: 'Zone d\'épaississement ≥ 1 DD incluant centre', labelEn: 'Thickening zone ≥1 DD including center' }
];

// Neovascularization options for PDR
const NV_OPTIONS = [
  { id: 'nv_none', label: 'Pas de néovaisseaux', short: '-' },
  { id: 'nvd', label: 'NVD - Néovaisseaux papillaires', short: 'NVD' },
  { id: 'nve', label: 'NVE - Néovaisseaux extra-papillaires', short: 'NVE' },
  { id: 'nvi', label: 'NVI - Néovaisseaux iriens (rubéose)', short: 'NVI' },
  { id: 'nva', label: 'NVA - Néovaisseaux de l\'angle', short: 'NVA' }
];

/**
 * Single Eye Stage Selector
 */
function EyeStageSelector({
  eye = 'OD',
  drStage = 'none',
  dmeStage = 'no_dme',
  nvOptions = [],
  csme = [],
  onChange,
  readOnly = false,
  compact = false
}) {
  const [expanded, setExpanded] = useState(!compact);

  const isOD = eye === 'OD';
  const eyeLabel = isOD ? 'OD - Œil Droit' : 'OG - Œil Gauche';
  const eyeColor = isOD ? 'blue' : 'green';

  const selectedDR = DR_STAGES.find(s => s.id === drStage) || DR_STAGES[0];
  const selectedDME = DME_STAGES.find(s => s.id === dmeStage) || DME_STAGES[0];

  const handleDRChange = (stageId) => {
    if (readOnly) return;
    onChange?.({
      drStage: stageId,
      dmeStage,
      nvOptions,
      csme
    });
  };

  const handleDMEChange = (stageId) => {
    if (readOnly) return;
    onChange?.({
      drStage,
      dmeStage: stageId,
      nvOptions,
      csme
    });
  };

  const handleNVToggle = (nvId) => {
    if (readOnly) return;
    const newNV = nvOptions.includes(nvId)
      ? nvOptions.filter(id => id !== nvId)
      : [...nvOptions, nvId];
    onChange?.({
      drStage,
      dmeStage,
      nvOptions: newNV,
      csme
    });
  };

  const handleCSMEToggle = (criteriaId) => {
    if (readOnly) return;
    const newCSME = csme.includes(criteriaId)
      ? csme.filter(id => id !== criteriaId)
      : [...csme, criteriaId];
    onChange?.({
      drStage,
      dmeStage,
      nvOptions,
      csme: newCSME
    });
  };

  // High severity warning
  const isHighSeverity = selectedDR.severity >= 3 || selectedDME.severity >= 2;

  return (
    <div className={`border rounded-lg overflow-hidden ${isOD ? 'border-blue-200' : 'border-green-200'}`}>
      {/* Eye Header */}
      <div
        className={`px-3 py-2 ${isOD ? 'bg-blue-100' : 'bg-green-100'} flex items-center justify-between cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Eye className={`w-4 h-4 ${isOD ? 'text-blue-600' : 'text-green-600'}`} />
          <span className={`font-bold ${isOD ? 'text-blue-800' : 'text-green-800'}`}>{eyeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick Status Badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedDR.bgColor} ${selectedDR.textColor}`}>
            {selectedDR.code}: {selectedDR.shortLabel}
          </span>
          {selectedDME.severity > 0 && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedDME.bgColor} ${selectedDME.textColor}`}>
              {selectedDME.code}
            </span>
          )}
          {isHighSeverity && <AlertCircle className="w-4 h-4 text-red-500" />}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="p-3 bg-white">
          {/* DR Staging */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
              Rétinopathie Diabétique
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DR_STAGES.map(stage => {
                const Icon = stage.icon;
                const isSelected = drStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => handleDRChange(stage.id)}
                    disabled={readOnly}
                    className={`
                      flex items-center gap-2 px-2 py-1.5 rounded border text-left transition text-xs
                      ${isSelected
                        ? `${stage.bgColor} ${stage.borderColor} ${stage.textColor} ring-2 ring-offset-1 ring-${stage.color}-400`
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }
                      ${readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                    `}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? stage.textColor : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{stage.code}: {stage.shortLabel}</div>
                      {isSelected && (
                        <div className="text-[10px] opacity-80 truncate">{stage.description}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DME Staging */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
              Maculopathie Diabétique (OMD)
            </div>
            <div className="flex gap-1.5">
              {DME_STAGES.map(stage => {
                const isSelected = dmeStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => handleDMEChange(stage.id)}
                    disabled={readOnly}
                    className={`
                      flex-1 px-2 py-1.5 rounded border text-center transition text-xs
                      ${isSelected
                        ? `${stage.bgColor} border-${stage.color}-300 ${stage.textColor} ring-2 ring-offset-1`
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }
                      ${readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                    `}
                  >
                    <div className="font-medium">{stage.code}</div>
                    <div className="text-[10px] opacity-80">{stage.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CSME Criteria (only if DME present) */}
          {dmeStage !== 'no_dme' && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Critères CSME
              </div>
              <div className="space-y-1">
                {CSME_CRITERIA.map(criteria => (
                  <label
                    key={criteria.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                      csme.includes(criteria.id) ? 'bg-orange-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={csme.includes(criteria.id)}
                      onChange={() => handleCSMEToggle(criteria.id)}
                      disabled={readOnly}
                      className="w-3 h-3 rounded border-gray-300"
                    />
                    <span className={csme.includes(criteria.id) ? 'text-orange-700' : 'text-gray-700'}>
                      {criteria.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* NV Options (only if PDR) */}
          {(drStage === 'pdr' || drStage === 'pdr_complicated') && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Type de Néovascularisation
              </div>
              <div className="flex flex-wrap gap-1">
                {NV_OPTIONS.slice(1).map(nv => (
                  <button
                    key={nv.id}
                    onClick={() => handleNVToggle(nv.id)}
                    disabled={readOnly}
                    className={`
                      px-2 py-1 rounded border text-xs transition
                      ${nvOptions.includes(nv.id)
                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }
                    `}
                  >
                    {nv.short}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Follow-up */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Info className="w-3 h-3" />
                <span>Suivi recommandé:</span>
              </div>
              <span className={`text-xs font-medium ${isHighSeverity ? 'text-red-600' : 'text-gray-700'}`}>
                {selectedDR.recommendedFollowUp}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main DRStagingSelector Component
 */
export default function DRStagingSelector({
  data = {},
  onChange,
  readOnly = false,
  compact = false,
  showSummary = true
}) {
  const handleODChange = useCallback((odData) => {
    onChange?.({
      ...data,
      OD: odData
    });
  }, [data, onChange]);

  const handleOSChange = useCallback((osData) => {
    onChange?.({
      ...data,
      OS: osData
    });
  }, [data, onChange]);

  // Calculate overall severity
  const severity = useMemo(() => {
    const odStage = DR_STAGES.find(s => s.id === data.OD?.drStage) || DR_STAGES[0];
    const osStage = DR_STAGES.find(s => s.id === data.OS?.drStage) || DR_STAGES[0];
    const odDME = DME_STAGES.find(s => s.id === data.OD?.dmeStage) || DME_STAGES[0];
    const osDME = DME_STAGES.find(s => s.id === data.OS?.dmeStage) || DME_STAGES[0];

    return Math.max(odStage.severity, osStage.severity, odDME.severity * 1.5, osDME.severity * 1.5);
  }, [data]);

  // Severity color
  const severityConfig = useMemo(() => {
    if (severity >= 4) return { label: 'Critique', color: 'red', bg: 'bg-red-100', text: 'text-red-800' };
    if (severity >= 3) return { label: 'Sévère', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-800' };
    if (severity >= 2) return { label: 'Modéré', color: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-800' };
    if (severity >= 1) return { label: 'Léger', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-800' };
    return { label: 'Normal', color: 'green', bg: 'bg-green-100', text: 'text-green-800' };
  }, [severity]);

  return (
    <div className="border border-orange-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-2 bg-orange-100 border-b border-orange-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-600" />
          <div>
            <span className="font-bold text-orange-800">RÉTINOPATHIE DIABÉTIQUE</span>
            <span className="text-xs text-gray-600 ml-2">Diabetic Retinopathy Staging</span>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.bg} ${severityConfig.text}`}>
          {severityConfig.label}
        </span>
      </div>

      {/* OD/OS Selectors */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <EyeStageSelector
            eye="OD"
            drStage={data.OD?.drStage || 'none'}
            dmeStage={data.OD?.dmeStage || 'no_dme'}
            nvOptions={data.OD?.nvOptions || []}
            csme={data.OD?.csme || []}
            onChange={handleODChange}
            readOnly={readOnly}
            compact={compact}
          />
          <EyeStageSelector
            eye="OS"
            drStage={data.OS?.drStage || 'none'}
            dmeStage={data.OS?.dmeStage || 'no_dme'}
            nvOptions={data.OS?.nvOptions || []}
            csme={data.OS?.csme || []}
            onChange={handleOSChange}
            readOnly={readOnly}
            compact={compact}
          />
        </div>

        {/* Summary Section */}
        {showSummary && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Résumé Rétinopathie Diabétique
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-blue-600 font-medium">OD: </span>
                  <span>
                    {(DR_STAGES.find(s => s.id === data.OD?.drStage) || DR_STAGES[0]).label}
                    {data.OD?.dmeStage && data.OD.dmeStage !== 'no_dme' && (
                      <span className="text-orange-600"> + {(DME_STAGES.find(s => s.id === data.OD.dmeStage) || DME_STAGES[0]).code}</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-green-600 font-medium">OG: </span>
                  <span>
                    {(DR_STAGES.find(s => s.id === data.OS?.drStage) || DR_STAGES[0]).label}
                    {data.OS?.dmeStage && data.OS.dmeStage !== 'no_dme' && (
                      <span className="text-orange-600"> + {(DME_STAGES.find(s => s.id === data.OS.dmeStage) || DME_STAGES[0]).code}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export compact badge component
export function DRStagingBadge({ data }) {
  if (!data) return null;

  const odStage = DR_STAGES.find(s => s.id === data.OD?.drStage);
  const osStage = DR_STAGES.find(s => s.id === data.OS?.drStage);

  if (!odStage && !osStage) return null;

  const maxSeverity = Math.max(odStage?.severity || 0, osStage?.severity || 0);
  const colorConfig = maxSeverity >= 3 ? 'bg-red-100 text-red-800' :
                     maxSeverity >= 2 ? 'bg-orange-100 text-orange-800' :
                     maxSeverity >= 1 ? 'bg-yellow-100 text-yellow-800' :
                     'bg-green-100 text-green-800';

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorConfig}`}>
      <Activity className="w-3 h-3" />
      <span>RD: {odStage?.code || '-'}/{osStage?.code || '-'}</span>
    </div>
  );
}

// Export constants
export { DR_STAGES, DME_STAGES, CSME_CRITERIA, NV_OPTIONS };
