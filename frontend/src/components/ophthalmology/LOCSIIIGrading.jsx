/**
 * LOCSIIIGrading - LOCS III Cataract Grading System
 *
 * StudioVision Parity: Visual cataract grading with reference images
 *
 * LOCS III Categories:
 * - Nuclear Opalescence (NO): 0.1 - 6.9 (6 reference images)
 * - Nuclear Color (NC): 0.1 - 6.9 (6 reference images)
 * - Cortical (C): 0.1 - 5.9 (5 reference images)
 * - Posterior Subcapsular (P): 0.1 - 5.9 (5 reference images)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X
} from 'lucide-react';

// LOCS III Reference Images
import NO1 from '../../assets/locs/NO1.svg';
import NO2 from '../../assets/locs/NO2.svg';
import NO3 from '../../assets/locs/NO3.svg';
import NO4 from '../../assets/locs/NO4.svg';
import NO5 from '../../assets/locs/NO5.svg';
import NO6 from '../../assets/locs/NO6.svg';
import NC1 from '../../assets/locs/NC1.svg';
import NC2 from '../../assets/locs/NC2.svg';
import NC3 from '../../assets/locs/NC3.svg';
import NC4 from '../../assets/locs/NC4.svg';
import NC5 from '../../assets/locs/NC5.svg';
import NC6 from '../../assets/locs/NC6.svg';
import C1 from '../../assets/locs/C1.svg';
import C2 from '../../assets/locs/C2.svg';
import C3 from '../../assets/locs/C3.svg';
import C4 from '../../assets/locs/C4.svg';
import C5 from '../../assets/locs/C5.svg';
import P1 from '../../assets/locs/P1.svg';
import P2 from '../../assets/locs/P2.svg';
import P3 from '../../assets/locs/P3.svg';
import P4 from '../../assets/locs/P4.svg';
import P5 from '../../assets/locs/P5.svg';

// Image mapping by category
const LOCS_IMAGES = {
  nuclearOpalescence: [NO1, NO2, NO3, NO4, NO5, NO6],
  nuclearColor: [NC1, NC2, NC3, NC4, NC5, NC6],
  cortical: [C1, C2, C3, C4, C5],
  posteriorSubcapsular: [P1, P2, P3, P4, P5]
};

// LOCS III Categories Configuration
const LOCS_CATEGORIES = [
  {
    key: 'nuclearOpalescence',
    label: 'Nuclear Opalescence',
    labelFr: 'Opalescence Nucléaire',
    abbrev: 'NO',
    minGrade: 0.1,
    maxGrade: 6.9,
    step: 0.1,
    referenceImages: 6,
    color: 'blue',
    description: 'Grades nuclear lens opacity based on light scattering'
  },
  {
    key: 'nuclearColor',
    label: 'Nuclear Color',
    labelFr: 'Couleur Nucléaire',
    abbrev: 'NC',
    minGrade: 0.1,
    maxGrade: 6.9,
    step: 0.1,
    referenceImages: 6,
    color: 'amber',
    description: 'Grades yellowing/browning of the nuclear lens'
  },
  {
    key: 'cortical',
    label: 'Cortical',
    labelFr: 'Corticale',
    abbrev: 'C',
    minGrade: 0.1,
    maxGrade: 5.9,
    step: 0.1,
    referenceImages: 5,
    color: 'purple',
    description: 'Grades spoke-like cortical opacities'
  },
  {
    key: 'posteriorSubcapsular',
    label: 'Posterior Subcapsular',
    labelFr: 'Sous-Capsulaire Postérieur',
    abbrev: 'P',
    minGrade: 0.1,
    maxGrade: 5.9,
    step: 0.1,
    referenceImages: 5,
    color: 'rose',
    description: 'Grades posterior subcapsular opacities'
  }
];

// Grade severity thresholds
const SEVERITY_THRESHOLDS = {
  mild: 2.0,
  moderate: 4.0,
  significant: 5.0
};

// Get severity info
const getSeverity = (grade) => {
  if (!grade) return null;
  if (grade < SEVERITY_THRESHOLDS.mild) return { label: 'Léger', bgClass: 'bg-green-100', textClass: 'text-green-800' };
  if (grade < SEVERITY_THRESHOLDS.moderate) return { label: 'Modéré', bgClass: 'bg-yellow-100', textClass: 'text-yellow-800' };
  if (grade < SEVERITY_THRESHOLDS.significant) return { label: 'Significatif', bgClass: 'bg-orange-100', textClass: 'text-orange-800' };
  return { label: 'Sévère', bgClass: 'bg-red-100', textClass: 'text-red-800' };
};

export default function LOCSIIIGrading({
  data = {},
  previousGrading,
  onUpdate,
  readOnly = false,
  compact = false,
  showComparison = true
}) {
  const [activeEye, setActiveEye] = useState('OD');
  const [isExpanded, setIsExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const gradingData = useMemo(() => ({
    performed: data.performed || false,
    OD: data.OD || {},
    OS: data.OS || {},
    notes: data.notes || ''
  }), [data]);

  const handleUpdate = useCallback((eye, category, field, value) => {
    if (readOnly) return;
    onUpdate(prev => ({
      ...prev,
      performed: true,
      [eye]: {
        ...(prev[eye] || {}),
        [category]: {
          ...(prev[eye]?.[category] || {}),
          [field]: value
        }
      }
    }));
  }, [onUpdate, readOnly]);

  const handlePerformedToggle = useCallback(() => {
    if (readOnly) return;
    onUpdate(prev => ({ ...prev, performed: !prev.performed }));
  }, [onUpdate, readOnly]);

  const copyODtoOS = useCallback(() => {
    if (readOnly) return;
    onUpdate(prev => ({ ...prev, OS: { ...prev.OD } }));
  }, [onUpdate, readOnly]);

  const getProgression = useCallback((eye, category) => {
    if (!previousGrading?.[eye]?.[category]?.grade) return null;
    const currentGrade = gradingData[eye]?.[category]?.grade;
    const previousGrade = previousGrading[eye][category].grade;
    if (!currentGrade) return null;
    const diff = currentGrade - previousGrade;
    if (Math.abs(diff) < 0.5) return { type: 'stable', diff };
    if (diff > 0) return { type: 'progression', diff };
    return { type: 'improvement', diff };
  }, [gradingData, previousGrading]);

  const getOverallSeverity = (eye) => {
    const grades = LOCS_CATEGORIES.map(cat => gradingData[eye]?.[cat.key]?.grade).filter(Boolean);
    if (grades.length === 0) return null;
    return getSeverity(Math.max(...grades));
  };

  // Compact view
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {['OD', 'OS'].map(eye => {
          const severity = getOverallSeverity(eye);
          return (
            <span key={eye} className={`px-3 py-1 rounded text-sm font-medium ${severity ? `${severity.bgClass} ${severity.textClass}` : 'bg-gray-100 text-gray-600'}`}>
              {eye}: {severity?.label || 'Non évalué'}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-gray-600" />
          <div>
            <span className="font-bold">LOCS III - Classification des Cataractes</span>
            <p className="text-xs text-gray-500">Lens Opacities Classification System III</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${gradingData.performed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {gradingData.performed ? 'Effectué' : 'Non effectué'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              className={`px-3 py-1 rounded text-sm font-medium ${gradingData.performed ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white'}`}
              onClick={(e) => { e.stopPropagation(); handlePerformedToggle(); }}
            >
              {gradingData.performed ? 'Marquer non effectué' : 'Commencer'}
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {isExpanded && gradingData.performed && (
        <>
          {/* Eye Tabs */}
          <div className="p-3 bg-gray-50 flex items-center justify-between border-t">
            <div className="flex gap-2">
              {['OD', 'OS'].map(eye => (
                <button
                  key={eye}
                  className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${activeEye === eye ? 'bg-white border border-b-0' : 'bg-gray-100'}`}
                  onClick={() => setActiveEye(eye)}
                >
                  <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${eye === 'OD' ? 'bg-green-600' : 'bg-blue-600'}`}>{eye}</span>
                  <span>{eye === 'OD' ? 'Œil Droit' : 'Œil Gauche'}</span>
                </button>
              ))}
            </div>
            {!readOnly && <button className="text-sm text-gray-600 hover:text-gray-900" onClick={copyODtoOS}>Copier OD → OS</button>}
          </div>

          {/* Categories */}
          <div className="p-4 space-y-6">
            {LOCS_CATEGORIES.map(category => {
              const currentGrade = gradingData[activeEye]?.[category.key]?.grade;
              const selectedImage = gradingData[activeEye]?.[category.key]?.selectedImage;
              const severity = getSeverity(currentGrade);
              const progression = showComparison ? getProgression(activeEye, category.key) : null;

              const colorMap = {
                blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600 text-white', text: 'text-blue-600' },
                amber: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600 text-white', text: 'text-amber-600' },
                purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-600 text-white', text: 'text-purple-600' },
                rose: { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-600 text-white', text: 'text-rose-600' }
              };
              const colors = colorMap[category.color];

              return (
                <div key={category.key} className={`p-4 rounded-md border ${colors.bg} ${colors.border}`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${colors.badge}`}>{category.abbrev}</span>
                      <div>
                        <span className="font-bold">{category.labelFr}</span>
                        <p className="text-xs text-gray-500">{category.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {severity && <span className={`px-2 py-0.5 rounded text-xs font-medium ${severity.bgClass} ${severity.textClass}`}>{severity.label}</span>}
                      {progression && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${progression.type === 'stable' ? 'bg-gray-100' : progression.type === 'progression' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                          {progression.type === 'stable' ? <Minus className="w-3 h-3" /> : progression.type === 'progression' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {progression.diff > 0 ? '+' : ''}{progression.diff.toFixed(1)}
                        </span>
                      )}
                      <button className="p-1 hover:bg-black/10 rounded" onClick={() => { setSelectedCategory(category); setModalOpen(true); }}>
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="px-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Grade: <strong>{currentGrade?.toFixed(1) || '-'}</strong></span>
                      <span className="text-sm text-gray-500">{category.minGrade} - {category.maxGrade}</span>
                    </div>
                    <input
                      type="range"
                      min={category.minGrade}
                      max={category.maxGrade}
                      step={category.step}
                      value={currentGrade || category.minGrade}
                      onChange={(e) => handleUpdate(activeEye, category.key, 'grade', parseFloat(e.target.value))}
                      disabled={readOnly}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                    />
                    <div className="flex justify-center gap-2 mt-4">
                      {Array.from({ length: category.referenceImages }, (_, i) => (
                        <button
                          key={i}
                          className={`px-3 py-1 rounded text-sm font-medium ${selectedImage === i + 1 ? colors.badge : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          onClick={() => !readOnly && handleUpdate(activeEye, category.key, 'selectedImage', i + 1)}
                          disabled={readOnly}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="p-4 bg-gray-50 border-t grid grid-cols-2 gap-4">
            {['OD', 'OS'].map(eye => {
              const severity = getOverallSeverity(eye);
              return (
                <div key={eye} className={`p-3 bg-white rounded-md border ${eye === 'OD' ? 'border-green-200' : 'border-blue-200'}`}>
                  <div className="flex justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${eye === 'OD' ? 'bg-green-600' : 'bg-blue-600'}`}>{eye}</span>
                    {severity && <span className={`px-2 py-0.5 rounded text-xs font-medium ${severity.bgClass} ${severity.textClass}`}>{severity.label}</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {LOCS_CATEGORIES.map(cat => {
                      const grade = gradingData[eye]?.[cat.key]?.grade;
                      const colorMap = { blue: 'text-blue-600', amber: 'text-amber-600', purple: 'text-purple-600', rose: 'text-rose-600' };
                      return (
                        <div key={cat.key} className="text-center">
                          <span className="text-xs text-gray-500">{cat.abbrev}</span>
                          <p className={`font-bold ${grade ? colorMap[cat.color] : 'text-gray-400'}`}>{grade?.toFixed(1) || '-'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal */}
      {modalOpen && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Images de référence - {selectedCategory.labelFr}</h3>
                <p className="text-sm text-gray-500">{selectedCategory.label}</p>
              </div>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <p className="text-gray-600 text-sm mb-4">{selectedCategory.description}</p>
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: selectedCategory.referenceImages }, (_, i) => {
                  const images = LOCS_IMAGES[selectedCategory.key];
                  const imageSrc = images?.[i];
                  const gradeValue = selectedCategory.minGrade + (i * (selectedCategory.maxGrade - selectedCategory.minGrade) / (selectedCategory.referenceImages - 1));
                  const colorMap = { blue: 'bg-blue-600', amber: 'bg-amber-600', purple: 'bg-purple-600', rose: 'bg-rose-600' };
                  return (
                    <div
                      key={i}
                      className="p-4 bg-gray-100 rounded-md text-center cursor-pointer hover:bg-gray-200 transition"
                      onClick={() => {
                        if (!readOnly) {
                          handleUpdate(activeEye, selectedCategory.key, 'grade', gradeValue);
                          handleUpdate(activeEye, selectedCategory.key, 'selectedImage', i + 1);
                        }
                      }}
                    >
                      {imageSrc ? (
                        <img src={imageSrc} alt={`Grade ${i + 1}`} className="w-full h-20 object-contain bg-white rounded p-1 mb-2" />
                      ) : (
                        <div className="w-full h-20 bg-gray-300 rounded mb-2 flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-500" /></div>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${colorMap[selectedCategory.color]}`}>Grade {i + 1}</span>
                      <p className="text-xs text-gray-500 mt-1">{gradeValue.toFixed(1)}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 text-center mt-4">Cliquez sur une image pour sélectionner ce grade pour {activeEye}.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LOCSIIISummary({ locsData }) {
  if (!locsData?.performed) {
    return <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">LOCS III: Non évalué</span>;
  }
  const getMaxGrade = (eye) => {
    const grades = LOCS_CATEGORIES.map(cat => locsData[eye]?.[cat.key]?.grade).filter(Boolean);
    return grades.length > 0 ? Math.max(...grades) : null;
  };
  return (
    <div className="flex gap-2">
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OD: {getMaxGrade('OD')?.toFixed(1) || '-'}</span>
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">OS: {getMaxGrade('OS')?.toFixed(1) || '-'}</span>
    </div>
  );
}

export function LOCSIIIQuickDisplay({ locsData, eye }) {
  if (!locsData?.performed || !locsData[eye]) return <span className="text-gray-400">-</span>;
  return (
    <div className="flex gap-1 text-sm">
      {LOCS_CATEGORIES.map(cat => {
        const grade = locsData[eye]?.[cat.key]?.grade;
        const colorMap = { blue: 'bg-blue-100 text-blue-800', amber: 'bg-amber-100 text-amber-800', purple: 'bg-purple-100 text-purple-800', rose: 'bg-rose-100 text-rose-800' };
        return (
          <span key={cat.key} className={`px-1.5 py-0.5 rounded text-xs ${grade ? colorMap[cat.color] : 'bg-gray-100 text-gray-400'}`} title={cat.labelFr}>
            {cat.abbrev}:{grade?.toFixed(1) || '-'}
          </span>
        );
      })}
    </div>
  );
}

export { LOCS_CATEGORIES, SEVERITY_THRESHOLDS };
