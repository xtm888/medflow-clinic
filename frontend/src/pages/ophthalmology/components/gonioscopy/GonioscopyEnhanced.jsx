/**
 * GonioscopyEnhanced
 *
 * Comprehensive gonioscopy assessment component with support for
 * multiple grading systems (Shaffer, Scheie, Spaeth).
 * Includes tracking for synechiae, pigmentation, and neovascularization.
 */

import { useState, useMemo } from 'react';
import {
  Eye,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
  Circle,
  Layers
} from 'lucide-react';

// Grading Systems
const GRADING_SYSTEMS = {
  shaffer: {
    id: 'shaffer',
    name: 'Shaffer',
    description: 'Estimation de l\'angle en degrés',
    grades: [
      { value: '4', label: 'Grade 4', angle: '35-45°', description: 'Grand ouvert, toutes structures visibles', risk: 'none' },
      { value: '3', label: 'Grade 3', angle: '25-35°', description: 'Ouvert, éperon scléral visible', risk: 'none' },
      { value: '2', label: 'Grade 2', angle: '20°', description: 'Modérément étroit, trabéculum visible', risk: 'low' },
      { value: '1', label: 'Grade 1', angle: '10°', description: 'Très étroit, seule ligne de Schwalbe visible', risk: 'moderate' },
      { value: 'slit', label: 'Fente', angle: '<10°', description: 'Fente, risque de fermeture', risk: 'high' },
      { value: '0', label: 'Grade 0', angle: '0°', description: 'Fermé, contact irido-cornéen', risk: 'critical' }
    ]
  },
  scheie: {
    id: 'scheie',
    name: 'Scheie',
    description: 'Basé sur les structures visibles',
    grades: [
      { value: 'wide_open', label: 'Grand ouvert', description: 'Corps ciliaire visible', risk: 'none' },
      { value: 'grade_i', label: 'Grade I', description: 'Éperon scléral visible', risk: 'none' },
      { value: 'grade_ii', label: 'Grade II', description: 'Trabéculum antérieur visible', risk: 'low' },
      { value: 'grade_iii', label: 'Grade III', description: 'Seule ligne de Schwalbe visible', risk: 'moderate' },
      { value: 'grade_iv', label: 'Grade IV', description: 'Aucune structure angulaire visible', risk: 'high' }
    ]
  },
  spaeth: {
    id: 'spaeth',
    name: 'Spaeth',
    description: 'Système le plus détaillé - insertion iris, configuration, angle',
    components: {
      irisInsertion: {
        label: 'Insertion de l\'iris',
        options: [
          { value: 'A', label: 'A', description: 'Antérieur à la ligne de Schwalbe' },
          { value: 'B', label: 'B', description: 'Derrière la ligne de Schwalbe (trabéculum)' },
          { value: 'C', label: 'C', description: 'Au niveau de l\'éperon scléral' },
          { value: 'D', label: 'D', description: 'Profond dans le corps ciliaire' },
          { value: 'E', label: 'E', description: 'Extrêmement profond' }
        ]
      },
      angularWidth: {
        label: 'Largeur angulaire',
        options: [
          { value: '40', label: '40°', description: 'Grand ouvert' },
          { value: '30', label: '30°', description: 'Ouvert' },
          { value: '20', label: '20°', description: 'Modérément étroit' },
          { value: '10', label: '10°', description: 'Très étroit' },
          { value: '0', label: '0°', description: 'Fermé' }
        ]
      },
      irisConfiguration: {
        label: 'Configuration de l\'iris',
        options: [
          { value: 'r', label: 'r (regular)', description: 'Plat/régulier' },
          { value: 's', label: 's (steep)', description: 'Abrupt/convexe' },
          { value: 'q', label: 'q (queer)', description: 'Concave/plateau' }
        ]
      }
    }
  }
};

// Quadrant labels
const QUADRANTS = [
  { id: 'superior', label: 'Supérieur', abbr: 'S', position: 'top' },
  { id: 'inferior', label: 'Inférieur', abbr: 'I', position: 'bottom' },
  { id: 'nasal', label: 'Nasal', abbr: 'N', position: 'left' },
  { id: 'temporal', label: 'Temporal', abbr: 'T', position: 'right' }
];

// Pigmentation grades
const PIGMENTATION_GRADES = [
  { value: '0', label: '0', description: 'Aucune pigmentation' },
  { value: '1', label: '1+', description: 'Pigmentation légère' },
  { value: '2', label: '2+', description: 'Pigmentation modérée' },
  { value: '3', label: '3+', description: 'Pigmentation dense' },
  { value: '4', label: '4+', description: 'Pigmentation très dense' }
];

// PAS extent options (clock hours)
const PAS_OPTIONS = Array.from({ length: 13 }, (_, i) => ({
  value: i.toString(),
  label: i === 0 ? 'Aucune' : `${i} heure${i > 1 ? 's' : ''}`
}));

export default function GonioscopyEnhanced({
  data = {},
  onChange,
  readOnly = false,
  eye = 'OD' // 'OD' or 'OS'
}) {
  const [selectedSystem, setSelectedSystem] = useState(data.gradingSystem || 'shaffer');
  const [expandedSections, setExpandedSections] = useState(new Set(['grading', 'additional']));

  // Get current eye data
  const eyeData = data[eye] || {};

  // Update eye data
  const updateEyeData = (updates) => {
    if (readOnly) return;

    onChange({
      ...data,
      gradingSystem: selectedSystem,
      [eye]: {
        ...eyeData,
        ...updates
      }
    });
  };

  // Handle quadrant grade change
  const handleQuadrantChange = (quadrant, value) => {
    updateEyeData({
      quadrants: {
        ...eyeData.quadrants,
        [quadrant]: {
          ...eyeData.quadrants?.[quadrant],
          grade: value
        }
      }
    });
  };

  // Handle Spaeth component change
  const handleSpaethChange = (quadrant, component, value) => {
    updateEyeData({
      quadrants: {
        ...eyeData.quadrants,
        [quadrant]: {
          ...eyeData.quadrants?.[quadrant],
          spaeth: {
            ...eyeData.quadrants?.[quadrant]?.spaeth,
            [component]: value
          }
        }
      }
    });
  };

  // Handle pigmentation change
  const handlePigmentationChange = (quadrant, value) => {
    updateEyeData({
      pigmentation: {
        ...eyeData.pigmentation,
        [quadrant]: value
      }
    });
  };

  // Handle additional findings
  const handleAdditionalChange = (field, value) => {
    updateEyeData({
      [field]: value
    });
  };

  // Toggle section
  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Calculate risk level based on grades
  const riskLevel = useMemo(() => {
    const quadrantGrades = eyeData.quadrants || {};
    let highestRisk = 'none';

    const riskOrder = ['none', 'low', 'moderate', 'high', 'critical'];

    Object.values(quadrantGrades).forEach(q => {
      if (!q?.grade) return;

      const system = GRADING_SYSTEMS[selectedSystem];
      let grade;

      if (selectedSystem === 'spaeth') {
        // For Spaeth, use angular width
        const width = q.spaeth?.angularWidth;
        if (width === '0') highestRisk = riskOrder.indexOf('critical') > riskOrder.indexOf(highestRisk) ? 'critical' : highestRisk;
        else if (width === '10') highestRisk = riskOrder.indexOf('high') > riskOrder.indexOf(highestRisk) ? 'high' : highestRisk;
        else if (width === '20') highestRisk = riskOrder.indexOf('moderate') > riskOrder.indexOf(highestRisk) ? 'moderate' : highestRisk;
      } else {
        grade = system.grades.find(g => g.value === q.grade);
        if (grade) {
          const gradeRiskIdx = riskOrder.indexOf(grade.risk);
          const currentRiskIdx = riskOrder.indexOf(highestRisk);
          if (gradeRiskIdx > currentRiskIdx) {
            highestRisk = grade.risk;
          }
        }
      }
    });

    // Check for synechiae
    if (eyeData.pas && parseInt(eyeData.pas) > 0) {
      const pasRisk = parseInt(eyeData.pas) >= 6 ? 'high' : parseInt(eyeData.pas) >= 3 ? 'moderate' : 'low';
      if (riskOrder.indexOf(pasRisk) > riskOrder.indexOf(highestRisk)) {
        highestRisk = pasRisk;
      }
    }

    // Check for neovascularization
    if (eyeData.neovascularization) {
      highestRisk = 'critical';
    }

    return highestRisk;
  }, [eyeData, selectedSystem]);

  // Get risk color
  const getRiskColor = (risk) => {
    switch (risk) {
      case 'none': return 'text-green-600 bg-green-50 border-green-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Format Spaeth grade
  const formatSpaethGrade = (quadrantData) => {
    if (!quadrantData?.spaeth) return '-';
    const { irisInsertion, angularWidth, irisConfiguration } = quadrantData.spaeth;
    if (!irisInsertion || !angularWidth || !irisConfiguration) return '-';
    return `${irisInsertion}${angularWidth}${irisConfiguration}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            Gonioscopie - {eye === 'OD' ? 'Œil Droit' : 'Œil Gauche'}
          </h3>
        </div>

        {/* Risk Badge */}
        <div className={`px-3 py-1.5 rounded-lg border ${getRiskColor(riskLevel)}`}>
          <span className="text-sm font-medium">
            Risque: {riskLevel === 'none' ? 'Aucun' : riskLevel === 'low' ? 'Faible' : riskLevel === 'moderate' ? 'Modéré' : riskLevel === 'high' ? 'Élevé' : 'Critique'}
          </span>
        </div>
      </div>

      {/* Grading System Selector */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Système de classification:</span>
        <div className="flex gap-2">
          {Object.entries(GRADING_SYSTEMS).map(([key, system]) => (
            <button
              key={key}
              onClick={() => !readOnly && setSelectedSystem(key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                selectedSystem === key
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
              } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {system.name}
            </button>
          ))}
        </div>
      </div>

      {/* System Description */}
      <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p>{GRADING_SYSTEMS[selectedSystem].description}</p>
      </div>

      {/* Quadrant Assessment */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('grading')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
        >
          <span className="font-medium text-gray-900">Classification par quadrant</span>
          {expandedSections.has('grading') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('grading') && (
          <div className="p-4">
            {/* Visual representation */}
            <div className="flex justify-center mb-6">
              <div className="relative w-48 h-48">
                {/* Eye circle */}
                <div className="absolute inset-4 rounded-full border-4 border-gray-300 bg-gray-50" />

                {/* Quadrant indicators */}
                {QUADRANTS.map(quadrant => {
                  const quadrantData = eyeData.quadrants?.[quadrant.id];
                  const hasGrade = selectedSystem === 'spaeth'
                    ? quadrantData?.spaeth?.angularWidth
                    : quadrantData?.grade;

                  const position = {
                    top: quadrant.position === 'top' ? '0' : quadrant.position === 'bottom' ? 'auto' : '50%',
                    bottom: quadrant.position === 'bottom' ? '0' : 'auto',
                    left: quadrant.position === 'left' ? '0' : quadrant.position === 'right' ? 'auto' : '50%',
                    right: quadrant.position === 'right' ? '0' : 'auto',
                    transform: quadrant.position === 'top' || quadrant.position === 'bottom'
                      ? 'translateX(-50%)'
                      : 'translateY(-50%)'
                  };

                  return (
                    <div
                      key={quadrant.id}
                      className={`absolute w-10 h-10 flex items-center justify-center rounded-full text-xs font-bold border-2 transition-all ${
                        hasGrade
                          ? 'bg-blue-100 border-blue-400 text-blue-700'
                          : 'bg-gray-100 border-gray-300 text-gray-500'
                      }`}
                      style={position}
                    >
                      {selectedSystem === 'spaeth'
                        ? formatSpaethGrade(quadrantData)
                        : (quadrantData?.grade || quadrant.abbr)}
                    </div>
                  );
                })}

                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-400">{eye}</span>
                </div>
              </div>
            </div>

            {/* Quadrant inputs */}
            <div className="space-y-4">
              {QUADRANTS.map(quadrant => {
                const quadrantData = eyeData.quadrants?.[quadrant.id] || {};

                return (
                  <div key={quadrant.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 mb-3">{quadrant.label}</div>

                    {selectedSystem === 'spaeth' ? (
                      // Spaeth grading
                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(GRADING_SYSTEMS.spaeth.components).map(([compKey, component]) => (
                          <div key={compKey}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {component.label}
                            </label>
                            <select
                              value={quadrantData.spaeth?.[compKey] || ''}
                              onChange={(e) => handleSpaethChange(quadrant.id, compKey, e.target.value)}
                              disabled={readOnly}
                              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                            >
                              <option value="">-</option>
                              {component.options.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label} - {opt.description}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Shaffer or Scheie grading
                      <div className="flex flex-wrap gap-2">
                        {GRADING_SYSTEMS[selectedSystem].grades.map(grade => (
                          <button
                            key={grade.value}
                            onClick={() => handleQuadrantChange(quadrant.id, grade.value)}
                            disabled={readOnly}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                              quadrantData.grade === grade.value
                                ? getRiskColor(grade.risk)
                                : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                            } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                            title={grade.description}
                          >
                            {grade.label}
                            {selectedSystem === 'shaffer' && ` (${grade.angle})`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pigmentation */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('pigmentation')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
        >
          <span className="font-medium text-gray-900">Pigmentation trabéculaire</span>
          {expandedSections.has('pigmentation') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('pigmentation') && (
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {QUADRANTS.map(quadrant => (
                <div key={quadrant.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {quadrant.label}
                  </label>
                  <div className="flex gap-1">
                    {PIGMENTATION_GRADES.map(grade => (
                      <button
                        key={grade.value}
                        onClick={() => handlePigmentationChange(quadrant.id, grade.value)}
                        disabled={readOnly}
                        className={`flex-1 py-1.5 text-sm rounded border transition-all ${
                          eyeData.pigmentation?.[quadrant.id] === grade.value
                            ? 'bg-amber-100 border-amber-400 text-amber-800'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                        } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                        title={grade.description}
                      >
                        {grade.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Additional Findings */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('additional')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
        >
          <span className="font-medium text-gray-900">Observations additionnelles</span>
          {expandedSections.has('additional') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('additional') && (
          <div className="p-4 space-y-4">
            {/* PAS (Peripheral Anterior Synechiae) */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Synéchies Antérieures Périphériques (SAP)
              </label>
              <div className="flex items-center gap-4">
                <select
                  value={eyeData.pas || '0'}
                  onChange={(e) => handleAdditionalChange('pas', e.target.value)}
                  disabled={readOnly}
                  className="border rounded px-3 py-2 bg-white"
                >
                  {PAS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {parseInt(eyeData.pas) > 0 && (
                  <span className="text-sm text-orange-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {parseInt(eyeData.pas) >= 6 ? 'Étendue significative' : 'Présence de synéchies'}
                  </span>
                )}
              </div>

              {/* PAS location */}
              {parseInt(eyeData.pas) > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Localisation des SAP
                  </label>
                  <input
                    type="text"
                    value={eyeData.pasLocation || ''}
                    onChange={(e) => handleAdditionalChange('pasLocation', e.target.value)}
                    placeholder="Ex: 2h-4h supérieur"
                    disabled={readOnly}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Neovascularization */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Néovascularisation angulaire
                </label>
                <button
                  onClick={() => handleAdditionalChange('neovascularization', !eyeData.neovascularization)}
                  disabled={readOnly}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    eyeData.neovascularization ? 'bg-red-500' : 'bg-gray-300'
                  } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      eyeData.neovascularization ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {eyeData.neovascularization && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Glaucome néovasculaire suspecté</span>
                  </div>
                  <input
                    type="text"
                    value={eyeData.neoLocation || ''}
                    onChange={(e) => handleAdditionalChange('neoLocation', e.target.value)}
                    placeholder="Étendue et localisation..."
                    disabled={readOnly}
                    className="w-full mt-2 border rounded px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Blood in angle */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Sang dans l'angle (Hyphéma)
                </label>
                <button
                  onClick={() => handleAdditionalChange('bloodInAngle', !eyeData.bloodInAngle)}
                  disabled={readOnly}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    eyeData.bloodInAngle ? 'bg-red-500' : 'bg-gray-300'
                  } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      eyeData.bloodInAngle ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Iris processes */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Processus iriens
                </label>
                <button
                  onClick={() => handleAdditionalChange('irisProcesses', !eyeData.irisProcesses)}
                  disabled={readOnly}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    eyeData.irisProcesses ? 'bg-blue-500' : 'bg-gray-300'
                  } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      eyeData.irisProcesses ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Sampaolesi line */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Ligne de Sampaolesi
                  </label>
                  <p className="text-xs text-gray-500">Pigment antérieur à la ligne de Schwalbe</p>
                </div>
                <button
                  onClick={() => handleAdditionalChange('sampaolesiLine', !eyeData.sampaolesiLine)}
                  disabled={readOnly}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    eyeData.sampaolesiLine ? 'bg-amber-500' : 'bg-gray-300'
                  } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      eyeData.sampaolesiLine ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes additionnelles
              </label>
              <textarea
                value={eyeData.notes || ''}
                onChange={(e) => handleAdditionalChange('notes', e.target.value)}
                placeholder="Observations supplémentaires, anomalies, comparaison avec examen précédent..."
                disabled={readOnly}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Résumé - {eye}</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {QUADRANTS.map(quadrant => {
            const quadrantData = eyeData.quadrants?.[quadrant.id];
            const grade = selectedSystem === 'spaeth'
              ? formatSpaethGrade(quadrantData)
              : quadrantData?.grade || '-';
            const pigment = eyeData.pigmentation?.[quadrant.id] || '0';

            return (
              <div key={quadrant.id} className="bg-white rounded p-3 border">
                <div className="font-medium text-gray-700">{quadrant.label}</div>
                <div className="mt-1 text-gray-900">Grade: {grade}</div>
                <div className="text-gray-500">Pigment: {pigment}+</div>
              </div>
            );
          })}
        </div>

        {/* Alerts */}
        {(eyeData.neovascularization || parseInt(eyeData.pas) >= 6 || riskLevel === 'critical' || riskLevel === 'high') && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-medium">
              <AlertTriangle className="h-5 w-5" />
              Alertes
            </div>
            <ul className="mt-2 space-y-1 text-sm text-red-600">
              {eyeData.neovascularization && (
                <li>• Néovascularisation angulaire - Risque de glaucome néovasculaire</li>
              )}
              {parseInt(eyeData.pas) >= 6 && (
                <li>• SAP étendues ({eyeData.pas} heures) - Fermeture progressive</li>
              )}
              {(riskLevel === 'critical' || riskLevel === 'high') && (
                <li>• Angles étroits - Risque de fermeture aiguë</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
