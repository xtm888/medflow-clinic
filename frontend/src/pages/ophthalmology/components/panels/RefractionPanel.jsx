import { useState, useEffect, useCallback, useMemo } from 'react';
import { Eye, Glasses, Target, Copy, ChevronDown, ChevronUp, Calculator, ToggleLeft, ToggleRight, RefreshCw, History, CopyPlus, Archive, AlertCircle, AlertTriangle, Check, Info, TrendingUp, Plus, Minus, Zap, Clock, FlipHorizontal } from 'lucide-react';
import { usePreviousExamData } from '../../../../hooks/usePreviousExamData';
import patientService from '../../../../services/patientService';
import {
  validateSphere,
  validateCylinder,
  validateAxis,
  validateAdd,
  validatePD,
  validateKeratometry,
  validateRefractionForm,
  isRefractionComplete,
  REFRACTION_LIMITS
} from '../../../../utils/refractionValidation';
import {
  calculateSphericalEquivalent,
  calculatePowerVectors,
  calculateCornealAstigmatism,
  calculateAverageK,
  diopterToRadius,
  calculateRefractionChange,
  calculateExpectedAdd,
  formatRefraction,
  recommendLensType,
  calculatePDDiscrepancy,
  calculateAnisometropia,
  mirrorAxis,
  detectPrescriptionChanges,
  QUICK_RX_PRESETS
} from '../../../../utils/refractionCalculations';

/**
 * RefractionPanel - Consolidated 3-column refraction module
 * Combines: Visual Acuity | Objective Refraction | Subjective Refraction
 * Plus: Keratometry expandable section
 *
 * Uses French Monoyer scale by default (10/10 = normal vision)
 * With option to toggle to Snellen (20/20) for international use
 */
export default function RefractionPanel({ data, onChange, patient, previousData }) {
  const [activeEye, setActiveEye] = useState('OD'); // OD, OS, OU
  const [showKeratometry, setShowKeratometry] = useState(false);
  const [useMonoyer, setUseMonoyer] = useState(true); // French scale by default
  const [showPreviousPreview, setShowPreviousPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    va: true,
    objective: true,
    subjective: true
  });

  // Hook to manage previous exam data
  const {
    previousData: prevExamData,
    loading: loadingPrevious,
    hasPreviousData,
    copyAllRefraction,
    getPreviousSummary
  } = usePreviousExamData(patient?._id || patient?.id);

  // CareVision legacy refraction state
  const [careVisionRefraction, setCareVisionRefraction] = useState(null);
  const [loadingCareVision, setLoadingCareVision] = useState(false);
  const [showCareVisionPreview, setShowCareVisionPreview] = useState(false);

  // Validation state
  const [validationResult, setValidationResult] = useState({ valid: true, errors: [], warnings: [], fieldErrors: {} });
  const [showCalculations, setShowCalculations] = useState(false);
  const [mirrorAxisOnCopy, setMirrorAxisOnCopy] = useState(false);
  const [showQuickPicks, setShowQuickPicks] = useState(false);

  // Check if patient has CareVision legacy data
  const hasCareVisionLink = patient?.hasLegacyData || patient?.legacyIds?.lv;

  // Load CareVision refraction data
  const loadCareVisionRefraction = useCallback(async () => {
    if (!hasCareVisionLink) return;

    setLoadingCareVision(true);
    try {
      const refraction = await patientService.getLastRefraction(patient?._id || patient?.id);
      if (refraction && refraction.source === 'carevision') {
        setCareVisionRefraction(refraction);
        setShowCareVisionPreview(true);
      }
    } catch (err) {
      console.error('[RefractionPanel] Error loading CareVision refraction:', err);
    } finally {
      setLoadingCareVision(false);
    }
  }, [hasCareVisionLink, patient]);

  // Initialize data structure
  const refractionData = data || {
    visualAcuity: {
      OD: { uncorrected: '', corrected: '', pinhole: '', near: '' },
      OS: { uncorrected: '', corrected: '', pinhole: '', near: '' }
    },
    objective: {
      OD: { sphere: '', cylinder: '', axis: '', confidence: 5 },
      OS: { sphere: '', cylinder: '', axis: '', confidence: 5 },
      device: 'autorefractor'
    },
    subjective: {
      OD: { sphere: '', cylinder: '', axis: '', add: '', va: '' },
      OS: { sphere: '', cylinder: '', axis: '', add: '', va: '' },
      pd: { distance: '', near: '' }
    },
    keratometry: {
      OD: { k1: '', k1Axis: '', k2: '', k2Axis: '' },
      OS: { k1: '', k1Axis: '', k2: '', k2Axis: '' }
    }
  };

  // Auto-calculations - memoized for performance
  const calculations = useMemo(() => {
    const result = {
      objective: { OD: {}, OS: {} },
      subjective: { OD: {}, OS: {} },
      keratometry: { OD: {}, OS: {} },
      recommendations: [],
      comparison: null
    };

    ['OD', 'OS'].forEach(eye => {
      // Objective calculations
      if (refractionData.objective?.[eye]?.sphere) {
        const obj = refractionData.objective[eye];
        result.objective[eye].SE = calculateSphericalEquivalent(obj.sphere, obj.cylinder);
        result.objective[eye].powerVectors = calculatePowerVectors(obj.sphere, obj.cylinder, obj.axis);
      }

      // Subjective calculations
      if (refractionData.subjective?.[eye]?.sphere) {
        const subj = refractionData.subjective[eye];
        result.subjective[eye].SE = calculateSphericalEquivalent(subj.sphere, subj.cylinder);
        result.subjective[eye].powerVectors = calculatePowerVectors(subj.sphere, subj.cylinder, subj.axis);
      }

      // Keratometry calculations
      if (refractionData.keratometry?.[eye]?.k1 && refractionData.keratometry?.[eye]?.k2) {
        const kerat = refractionData.keratometry[eye];
        result.keratometry[eye].cornealAstigmatism = calculateCornealAstigmatism(kerat.k1, kerat.k2);
        result.keratometry[eye].avgK = calculateAverageK(kerat.k1, kerat.k2);
        result.keratometry[eye].r1 = diopterToRadius(kerat.k1);
        result.keratometry[eye].r2 = diopterToRadius(kerat.k2);
      }
    });

    // PD analysis
    if (refractionData.subjective?.pd?.distance) {
      result.pdAnalysis = calculatePDDiscrepancy(
        refractionData.subjective?.pd?.distance ? refractionData.subjective.pd.distance / 2 : null,
        refractionData.subjective?.pd?.distance ? refractionData.subjective.pd.distance / 2 : null
      );
    }

    // Lens recommendations
    result.recommendations = recommendLensType(
      refractionData.subjective?.OD,
      refractionData.subjective?.OS
    );

    // Compare objective vs subjective
    if (result.objective.OD.SE !== undefined && result.subjective.OD.SE !== undefined) {
      const odDiff = Math.abs((result.objective.OD.SE || 0) - (result.subjective.OD.SE || 0));
      const osDiff = Math.abs((result.objective.OS?.SE || 0) - (result.subjective.OS?.SE || 0));
      if (odDiff > 1 || osDiff > 1) {
        result.comparison = {
          hasSignificantDifference: true,
          OD: odDiff,
          OS: osDiff,
          message: `Différence significative obj/subj: OD=${odDiff.toFixed(2)}D, OS=${osDiff.toFixed(2)}D`
        };
      }
    }

    // Expected add based on patient age
    if (patient?.dateOfBirth) {
      const age = Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
      result.expectedAdd = calculateExpectedAdd(age);
      result.patientAge = age;
    }

    // Anisometropia calculation (difference between eyes)
    if (refractionData.subjective?.OD?.sphere && refractionData.subjective?.OS?.sphere) {
      result.anisometropia = calculateAnisometropia(
        refractionData.subjective.OD,
        refractionData.subjective.OS
      );
    }

    // Detect significant changes from previous exam (>0.50D)
    if (previousData?.refraction?.subjective && refractionData.subjective?.OD?.sphere) {
      result.prescriptionChanges = detectPrescriptionChanges(
        {
          OD: refractionData.subjective.OD,
          OS: refractionData.subjective.OS
        },
        {
          OD: previousData.refraction.subjective.OD,
          OS: previousData.refraction.subjective.OS
        }
      );
    }

    return result;
  }, [refractionData, patient, previousData]);

  // Run validation when data changes
  useEffect(() => {
    const result = validateRefractionForm(refractionData);
    setValidationResult(result);
  }, [refractionData]);

  // Field-level validation helper
  const getFieldValidation = useCallback((section, eye, field) => {
    const fieldKey = eye ? `${section}.${eye}.${field}` : `${section}.${field}`;
    const errors = validationResult.fieldErrors?.[fieldKey] || [];
    const value = eye ? refractionData[section]?.[eye]?.[field] : refractionData[section]?.[field];

    // Real-time single field validation
    let result = { valid: true, errors: [], warnings: [] };
    if (field === 'sphere') {
      result = validateSphere(value);
    } else if (field === 'cylinder') {
      result = validateCylinder(value);
    } else if (field === 'axis') {
      const cylinder = eye ? refractionData[section]?.[eye]?.cylinder : null;
      result = validateAxis(value, cylinder);
    } else if (field === 'add') {
      result = validateAdd(value);
    }

    return {
      valid: result.valid && errors.length === 0,
      errors: [...result.errors, ...errors],
      warnings: result.warnings || []
    };
  }, [refractionData, validationResult]);

  // Update handler with validation
  const updateField = (section, eye, field, value) => {
    const newData = { ...refractionData };
    if (eye) {
      newData[section][eye][field] = value;
    } else {
      newData[section][field] = value;
    }
    onChange?.(newData);
  };

  // Copy objective to subjective
  const copyToSubjective = () => {
    const newData = { ...refractionData };
    ['OD', 'OS'].forEach(eye => {
      newData.subjective[eye].sphere = newData.objective[eye].sphere;
      newData.subjective[eye].cylinder = newData.objective[eye].cylinder;
      newData.subjective[eye].axis = newData.objective[eye].axis;
    });
    onChange?.(newData);
  };

  // Calculate spherical equivalent
  const calcSphEq = (sphere, cylinder) => {
    const s = parseFloat(sphere) || 0;
    const c = parseFloat(cylinder) || 0;
    return (s + c / 2).toFixed(2);
  };

  /**
   * Transposition Formula
   * Convert between minus and plus cylinder formats
   * New SPH = old SPH + old CYL
   * New CYL = − old CYL
   * New AXIS = old AXIS ± 90°
   */
  const transposePrescription = (section, eye) => {
    const current = refractionData[section][eye];
    if (!current?.sphere || !current?.cylinder) return;

    const oldSph = parseFloat(current.sphere) || 0;
    const oldCyl = parseFloat(current.cylinder) || 0;
    const oldAxis = parseFloat(current.axis) || 0;

    // Skip if no cylinder to transpose
    if (oldCyl === 0) return;

    const newSphere = (oldSph + oldCyl).toFixed(2);
    const newCylinder = (-oldCyl).toFixed(2);
    const newAxis = oldAxis < 90 ? oldAxis + 90 : oldAxis - 90;

    const newData = { ...refractionData };
    newData[section][eye] = {
      ...newData[section][eye],
      sphere: newSphere,
      cylinder: newCylinder,
      axis: newAxis
    };
    onChange?.(newData);
  };

  // Copy OD values to OS (Ctrl+D shortcut)
  // With optional axis mirroring for oblique astigmatism
  const copyODtoOS = useCallback(() => {
    const newData = { ...refractionData };

    // Copy visual acuity
    newData.visualAcuity.OS = { ...newData.visualAcuity.OD };

    // Copy objective refraction
    const objAxis = newData.objective.OD?.axis;
    newData.objective.OS = {
      ...newData.objective.OD,
      axis: mirrorAxisOnCopy && objAxis ? mirrorAxis(objAxis).toString() : objAxis,
      confidence: newData.objective.OS?.confidence || 5
    };

    // Copy subjective refraction
    const subjAxis = newData.subjective.OD?.axis;
    newData.subjective.OS = {
      ...newData.subjective.OD,
      axis: mirrorAxisOnCopy && subjAxis ? mirrorAxis(subjAxis).toString() : subjAxis
    };

    // Copy keratometry (axis is also mirrored if option is enabled)
    const k1Axis = newData.keratometry.OD?.k1Axis;
    const k2Axis = newData.keratometry.OD?.k2Axis;
    newData.keratometry.OS = {
      ...newData.keratometry.OD,
      k1Axis: mirrorAxisOnCopy && k1Axis ? mirrorAxis(parseInt(k1Axis)).toString() : k1Axis,
      k2Axis: mirrorAxisOnCopy && k2Axis ? mirrorAxis(parseInt(k2Axis)).toString() : k2Axis
    };

    onChange?.(newData);
  }, [refractionData, onChange, mirrorAxisOnCopy]);

  // Load previous exam data (Alt+P shortcut)
  const loadPreviousExam = useCallback(() => {
    if (!hasPreviousData) return;

    const prevData = copyAllRefraction();
    if (!prevData) return;

    const newData = { ...refractionData };

    // Merge previous data
    if (prevData.visualAcuity) {
      newData.visualAcuity = { ...newData.visualAcuity, ...prevData.visualAcuity };
    }
    if (prevData.objective) {
      newData.objective = { ...newData.objective, ...prevData.objective };
    }
    if (prevData.subjective) {
      newData.subjective = { ...newData.subjective, ...prevData.subjective };
    }
    if (prevData.keratometry) {
      newData.keratometry = { ...newData.keratometry, ...prevData.keratometry };
    }

    onChange?.(newData);
    setShowPreviousPreview(false);
  }, [hasPreviousData, copyAllRefraction, refractionData, onChange]);

  // Apply CareVision refraction data
  const applyCareVisionRefraction = useCallback(() => {
    if (!careVisionRefraction) return;

    const newData = { ...refractionData };

    // Map CareVision data to MedFlow format
    // CareVision uses od/og format, MedFlow uses OD/OS
    if (careVisionRefraction.od) {
      const od = careVisionRefraction.od;
      newData.subjective.OD = {
        ...newData.subjective.OD,
        sphere: od.sphere?.toFixed(2) || '',
        cylinder: od.cylinder?.toFixed(2) || '',
        axis: od.axis?.toString() || '',
        add: od.addition?.toFixed(2) || ''
      };
      // Also set as objective starting point
      newData.objective.OD = {
        ...newData.objective.OD,
        sphere: od.sphere?.toFixed(2) || '',
        cylinder: od.cylinder?.toFixed(2) || '',
        axis: od.axis?.toString() || ''
      };
    }

    if (careVisionRefraction.og) {
      const og = careVisionRefraction.og;
      newData.subjective.OS = {
        ...newData.subjective.OS,
        sphere: og.sphere?.toFixed(2) || '',
        cylinder: og.cylinder?.toFixed(2) || '',
        axis: og.axis?.toString() || '',
        add: og.addition?.toFixed(2) || ''
      };
      // Also set as objective starting point
      newData.objective.OS = {
        ...newData.objective.OS,
        sphere: og.sphere?.toFixed(2) || '',
        cylinder: og.cylinder?.toFixed(2) || '',
        axis: og.axis?.toString() || ''
      };
    }

    onChange?.(newData);
    setShowCareVisionPreview(false);
  }, [careVisionRefraction, refractionData, onChange]);

  // Format refraction value for display
  const formatRefractionValue = (value, includeSign = true) => {
    if (value === null || value === undefined) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    if (includeSign && num >= 0) return `+${num.toFixed(2)}`;
    return num.toFixed(2);
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in input/select
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+D: Copy OD to OS
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        copyODtoOS();
      }

      // Alt+P: Load previous exam
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        if (hasPreviousData) {
          setShowPreviousPreview(true);
        }
      }

      // Tab: Cycle through eyes (when not in form field)
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // Only intercept Tab when focus is on the panel itself, not in form fields
        if (e.target.closest('.refraction-panel-header')) {
          e.preventDefault();
          setActiveEye(prev => {
            if (prev === 'OD') return 'OS';
            if (prev === 'OS') return 'OU';
            return 'OD';
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyODtoOS, hasPreviousData]);

  // French Monoyer scale (used in France and francophone countries)
  // 10/10 = normal vision, equivalent to Snellen 20/20
  const monoyerOptions = [
    // Low vision values (French abbreviations)
    { value: 'PL-', label: 'PL-', description: 'Pas de Perception Lumineuse' },
    { value: 'PL+', label: 'PL+', description: 'Perception Lumineuse' },
    { value: 'MDM', label: 'MDM', description: 'Mouvement de la Main' },
    { value: 'CLD', label: 'CLD', description: 'Compte Les Doigts' },
    // Standard Monoyer values
    { value: '1/20', label: '1/20' },
    { value: '1/10', label: '1/10' },
    { value: '2/10', label: '2/10' },
    { value: '3/10', label: '3/10' },
    { value: '4/10', label: '4/10' },
    { value: '5/10', label: '5/10' },
    { value: '6/10', label: '6/10' },
    { value: '7/10', label: '7/10' },
    { value: '8/10', label: '8/10' },
    { value: '9/10', label: '9/10' },
    { value: '10/10', label: '10/10' },
    // Above normal vision
    { value: '12/10', label: '12/10' },
    { value: '14/10', label: '14/10' },
    { value: '16/10', label: '16/10' }
  ];

  // Snellen scale (US/International)
  const snellenOptions = [
    { value: 'NLP', label: 'NLP', description: 'No Light Perception' },
    { value: 'LP', label: 'LP', description: 'Light Perception' },
    { value: 'HM', label: 'HM', description: 'Hand Motion' },
    { value: 'CF', label: 'CF', description: 'Counting Fingers' },
    { value: '20/400', label: '20/400' },
    { value: '20/200', label: '20/200' },
    { value: '20/100', label: '20/100' },
    { value: '20/80', label: '20/80' },
    { value: '20/70', label: '20/70' },
    { value: '20/60', label: '20/60' },
    { value: '20/50', label: '20/50' },
    { value: '20/40', label: '20/40' },
    { value: '20/30', label: '20/30' },
    { value: '20/25', label: '20/25' },
    { value: '20/20', label: '20/20' },
    { value: '20/15', label: '20/15' },
    { value: '20/10', label: '20/10' }
  ];

  // Parinaud scale for near vision (French standard)
  const parinaudOptions = [
    { value: 'P1.5', label: 'P1.5', description: 'Excellent' },
    { value: 'P2', label: 'P2', description: 'Très bon' },
    { value: 'P3', label: 'P3', description: 'Bon' },
    { value: 'P4', label: 'P4', description: 'Normal' },
    { value: 'P5', label: 'P5', description: 'Acceptable' },
    { value: 'P6', label: 'P6', description: 'Limite' },
    { value: 'P8', label: 'P8' },
    { value: 'P10', label: 'P10' },
    { value: 'P14', label: 'P14' },
    { value: 'P20', label: 'P20' },
    { value: 'P28', label: 'P28' }
  ];

  // Get current scale options based on toggle
  const vaOptions = useMonoyer ? monoyerOptions : snellenOptions;

  // Validation indicator component
  const ValidationIndicator = ({ section, eye, field, children }) => {
    const validation = getFieldValidation(section, eye, field);
    const hasErrors = validation.errors.length > 0;
    const hasWarnings = validation.warnings.length > 0;

    return (
      <div className="relative">
        {children}
        {(hasErrors || hasWarnings) && (
          <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${hasErrors ? 'text-red-500' : 'text-amber-500'}`}>
            {hasErrors ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
          </div>
        )}
        {hasErrors && (
          <p className="text-xs text-red-500 mt-0.5">{validation.errors[0]}</p>
        )}
        {!hasErrors && hasWarnings && (
          <p className="text-xs text-amber-500 mt-0.5">{validation.warnings[0]}</p>
        )}
      </div>
    );
  };

  // Get validation border class for field
  const getValidationBorderClass = (section, eye, field) => {
    const validation = getFieldValidation(section, eye, field);
    if (validation.errors.length > 0) return 'border-red-400 focus:ring-red-500';
    if (validation.warnings.length > 0) return 'border-amber-400 focus:ring-amber-500';
    return 'border-gray-300 focus:ring-purple-500';
  };

  // Sphere/Cylinder increments
  const sphereOptions = [];
  for (let i = -20; i <= 20; i += 0.25) {
    sphereOptions.push(i.toFixed(2));
  }

  const cylinderOptions = [];
  for (let i = -10; i <= 0; i += 0.25) {
    cylinderOptions.push(i.toFixed(2));
  }

  const axisOptions = [];
  for (let i = 0; i <= 180; i += 5) {
    axisOptions.push(i);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with Eye Selector and Scale Toggle */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-0">
          <div className="flex flex-wrap items-center gap-2 lg:gap-4">
            <div className="flex items-center gap-2">
              <Glasses className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Réfraction</h2>
            </div>

            {/* Scale Toggle: Monoyer (FR) / Snellen (US) */}
            <button
              onClick={() => setUseMonoyer(!useMonoyer)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border border-gray-300 hover:bg-white transition"
              title={useMonoyer ? 'Échelle Monoyer (France)' : 'Échelle Snellen (USA)'}
            >
              {useMonoyer ? (
                <ToggleRight className="h-4 w-4 text-purple-600" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-gray-400" />
              )}
              <span className={useMonoyer ? 'text-purple-600 font-medium' : 'text-gray-500'}>
                {useMonoyer ? 'Monoyer (FR)' : 'Snellen (US)'}
              </span>
            </button>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-2 pl-2 border-l border-gray-300">
              {/* Validation Status Indicator */}
              {!validationResult.valid && (
                <div className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-red-50 border border-red-200 text-red-700" title={validationResult.errors.join('\n')}>
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{validationResult.errors.length}</span>
                </div>
              )}
              {validationResult.warnings?.length > 0 && validationResult.valid && (
                <div className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700" title={validationResult.warnings.join('\n')}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{validationResult.warnings.length}</span>
                </div>
              )}

              {/* Calculations Toggle */}
              <button
                onClick={() => setShowCalculations(!showCalculations)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition ${
                  showCalculations
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                title="Afficher/masquer les calculs automatiques"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Calculs</span>
              </button>

              {/* Load Previous Exam Button */}
              {hasPreviousData && (
                <button
                  onClick={() => setShowPreviousPreview(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
                  title="Charger examen précédent (Alt+P)"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Précédent</span>
                </button>
              )}

              {/* Load CareVision Archive Button */}
              {hasCareVisionLink && (
                <button
                  onClick={loadCareVisionRefraction}
                  disabled={loadingCareVision}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
                  title="Charger réfraction CareVision"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>{loadingCareVision ? '...' : 'Archive CV'}</span>
                </button>
              )}

              {/* Copy OD → OS Button with mirror axis option */}
              <div className="flex items-center gap-1">
                <button
                  onClick={copyODtoOS}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition"
                  title="Copier OD vers OS (Ctrl+D)"
                >
                  <CopyPlus className="h-3.5 w-3.5" />
                  <span>OD→OS</span>
                </button>
                <button
                  onClick={() => setMirrorAxisOnCopy(!mirrorAxisOnCopy)}
                  className={`p-1 text-xs rounded transition ${
                    mirrorAxisOnCopy
                      ? 'bg-purple-200 text-purple-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  title={mirrorAxisOnCopy ? 'Miroir axe activé (180-axe)' : 'Miroir axe désactivé'}
                >
                  <FlipHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick Picks Button */}
              <div className="relative">
                <button
                  onClick={() => setShowQuickPicks(!showQuickPicks)}
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition ${
                    showQuickPicks
                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Prescriptions rapides"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Rapide</span>
                </button>

                {/* Quick Picks Dropdown */}
                {showQuickPicks && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-72 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-700">Prescriptions communes</span>
                    </div>
                    <div className="p-1">
                      {Object.entries(QUICK_RX_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => {
                            const newData = { ...refractionData };
                            newData.subjective[activeEye === 'OU' ? 'OD' : activeEye] = {
                              ...newData.subjective[activeEye === 'OU' ? 'OD' : activeEye],
                              sphere: preset.sphere,
                              cylinder: preset.cylinder,
                              axis: preset.axis
                            };
                            if (activeEye === 'OU') {
                              newData.subjective.OS = {
                                ...newData.subjective.OS,
                                sphere: preset.sphere,
                                cylinder: preset.cylinder,
                                axis: preset.axis ? (mirrorAxisOnCopy ? mirrorAxis(parseInt(preset.axis)).toString() : preset.axis) : ''
                              };
                            }
                            onChange?.(newData);
                            setShowQuickPicks(false);
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-purple-50 flex items-center justify-between"
                        >
                          <span className="text-gray-700">{preset.label}</span>
                          <span className="font-mono text-purple-600">
                            {preset.sphere || 'Plan'} {preset.cylinder && `${preset.cylinder}×${preset.axis}°`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Eye Selector */}
          <div className="flex bg-white rounded-lg border border-gray-300 p-0.5">
            {['OD', 'OS', 'OU'].map(eye => (
              <button
                key={eye}
                onClick={() => setActiveEye(eye)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                  activeEye === eye
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {eye}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-0 lg:divide-x divide-gray-200">

        {/* Column 1: Visual Acuity */}
        <div className="p-4 border-b lg:border-b-0 border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-blue-500" />
              Acuité Visuelle
              <span className="text-xs font-normal text-gray-400">
                ({useMonoyer ? 'Monoyer' : 'Snellen'})
              </span>
            </h3>
          </div>

          {(activeEye === 'OU' ? ['OD', 'OS'] : [activeEye]).map(eye => (
            <div key={eye} className={`${activeEye === 'OU' ? 'mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0' : ''}`}>
              {activeEye === 'OU' && (
                <div className="text-xs font-medium text-purple-600 mb-2">{eye}</div>
              )}

              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">VL SC (Sans correction)</label>
                  <select
                    value={refractionData.visualAcuity[eye]?.uncorrected || ''}
                    onChange={(e) => updateField('visualAcuity', eye, 'uncorrected', e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">--</option>
                    {vaOptions.map(opt => (
                      <option key={opt.value} value={opt.value} title={opt.description}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">TS (Trou sténopéique)</label>
                  <select
                    value={refractionData.visualAcuity[eye]?.pinhole || ''}
                    onChange={(e) => updateField('visualAcuity', eye, 'pinhole', e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">--</option>
                    {vaOptions.map(opt => (
                      <option key={opt.value} value={opt.value} title={opt.description}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">VL AC (Avec correction)</label>
                  <select
                    value={refractionData.visualAcuity[eye]?.corrected || ''}
                    onChange={(e) => updateField('visualAcuity', eye, 'corrected', e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">--</option>
                    {vaOptions.map(opt => (
                      <option key={opt.value} value={opt.value} title={opt.description}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">VP (Vision de Près - Parinaud)</label>
                  <select
                    value={refractionData.visualAcuity[eye]?.near || ''}
                    onChange={(e) => updateField('visualAcuity', eye, 'near', e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">--</option>
                    {parinaudOptions.map(opt => (
                      <option key={opt.value} value={opt.value} title={opt.description}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Column 2: Objective Refraction */}
        <div className="p-4 border-b lg:border-b-0 border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-green-500" />
              Réfraction Objective
            </h3>
            <button
              onClick={copyToSubjective}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
              title="Copier vers subjective"
            >
              <Copy className="h-3 w-3" />
              Copier →
            </button>
          </div>

          {/* Device selector */}
          <div className="mb-3">
            <select
              value={refractionData.objective.device || 'autorefractor'}
              onChange={(e) => updateField('objective', null, 'device', e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-gray-50"
            >
              <option value="autorefractor">Autoréfractomètre</option>
              <option value="retinoscopy">Skiascopie</option>
              <option value="manual">Manuel</option>
            </select>
          </div>

          {(activeEye === 'OU' ? ['OD', 'OS'] : [activeEye]).map(eye => (
            <div key={eye} className={`${activeEye === 'OU' ? 'mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0' : ''}`}>
              {activeEye === 'OU' && (
                <div className="text-xs font-medium text-purple-600 mb-2">{eye}</div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Sphère</label>
                  <select
                    value={refractionData.objective[eye]?.sphere || ''}
                    onChange={(e) => updateField('objective', eye, 'sphere', e.target.value)}
                    className="w-full mt-1 px-1 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">--</option>
                    {sphereOptions.map(opt => (
                      <option key={opt} value={opt}>{opt > 0 ? `+${opt}` : opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Cylindre</label>
                  <select
                    value={refractionData.objective[eye]?.cylinder || ''}
                    onChange={(e) => updateField('objective', eye, 'cylinder', e.target.value)}
                    className="w-full mt-1 px-1 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">--</option>
                    {cylinderOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Axe</label>
                  <select
                    value={refractionData.objective[eye]?.axis || ''}
                    onChange={(e) => updateField('objective', eye, 'axis', e.target.value)}
                    className="w-full mt-1 px-1 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">--</option>
                    {axisOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}°</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Spherical Equivalent & Transpose */}
              {refractionData.objective[eye]?.sphere && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Éq. sph: {calcSphEq(refractionData.objective[eye]?.sphere, refractionData.objective[eye]?.cylinder)}
                  </div>
                  {refractionData.objective[eye]?.cylinder && parseFloat(refractionData.objective[eye]?.cylinder) !== 0 && (
                    <button
                      onClick={() => transposePrescription('objective', eye)}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      title="Transposer (±CYL)"
                    >
                      <RefreshCw className="h-3 w-3" />
                      T
                    </button>
                  )}
                </div>
              )}

              {/* Confidence slider */}
              <div className="mt-3">
                <label className="text-xs text-gray-500">Confiance: {refractionData.objective[eye]?.confidence || 5}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={refractionData.objective[eye]?.confidence || 5}
                  onChange={(e) => updateField('objective', eye, 'confidence', parseInt(e.target.value))}
                  className="w-full h-1.5 mt-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Column 3: Subjective Refraction */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Glasses className="h-4 w-4 text-purple-500" />
              Réfraction Subjective
            </h3>
          </div>

          {(activeEye === 'OU' ? ['OD', 'OS'] : [activeEye]).map(eye => (
            <div key={eye} className={`${activeEye === 'OU' ? 'mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0' : ''}`}>
              {activeEye === 'OU' && (
                <div className="text-xs font-medium text-purple-600 mb-2">{eye}</div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Sphère</label>
                  <select
                    value={refractionData.subjective[eye]?.sphere || ''}
                    onChange={(e) => updateField('subjective', eye, 'sphere', e.target.value)}
                    className="w-full mt-1 px-1 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">--</option>
                    {sphereOptions.map(opt => (
                      <option key={opt} value={opt}>{opt > 0 ? `+${opt}` : opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Cylindre</label>
                  <select
                    value={refractionData.subjective[eye]?.cylinder || ''}
                    onChange={(e) => updateField('subjective', eye, 'cylinder', e.target.value)}
                    className="w-full mt-1 px-1 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">--</option>
                    {cylinderOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Axe</label>
                  <select
                    value={refractionData.subjective[eye]?.axis || ''}
                    onChange={(e) => updateField('subjective', eye, 'axis', e.target.value)}
                    className="w-full mt-1 px-1 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">--</option>
                    {axisOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}°</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Spherical Equivalent & Transpose */}
              {refractionData.subjective[eye]?.sphere && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Éq. sph: {calcSphEq(refractionData.subjective[eye]?.sphere, refractionData.subjective[eye]?.cylinder)}
                  </div>
                  {refractionData.subjective[eye]?.cylinder && parseFloat(refractionData.subjective[eye]?.cylinder) !== 0 && (
                    <button
                      onClick={() => transposePrescription('subjective', eye)}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      title="Transposer (±CYL)"
                    >
                      <RefreshCw className="h-3 w-3" />
                      T
                    </button>
                  )}
                </div>
              )}

              {/* Add power for presbyopia */}
              <div className="mt-2">
                <label className="text-xs text-gray-500">Addition (presbytie)</label>
                <select
                  value={refractionData.subjective[eye]?.add || ''}
                  onChange={(e) => updateField('subjective', eye, 'add', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">--</option>
                  <option value="+0.75">+0.75</option>
                  <option value="+1.00">+1.00</option>
                  <option value="+1.25">+1.25</option>
                  <option value="+1.50">+1.50</option>
                  <option value="+1.75">+1.75</option>
                  <option value="+2.00">+2.00</option>
                  <option value="+2.25">+2.25</option>
                  <option value="+2.50">+2.50</option>
                  <option value="+2.75">+2.75</option>
                  <option value="+3.00">+3.00</option>
                </select>
              </div>

              {/* VA with correction */}
              <div className="mt-2">
                <label className="text-xs text-gray-500">AV corrigée ({useMonoyer ? 'Monoyer' : 'Snellen'})</label>
                <select
                  value={refractionData.subjective[eye]?.va || ''}
                  onChange={(e) => updateField('subjective', eye, 'va', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">--</option>
                  {vaOptions.map(opt => (
                    <option key={opt.value} value={opt.value} title={opt.description}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {/* PD */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <label className="text-xs text-gray-500 font-medium">Écart pupillaire (PD)</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <input
                  type="number"
                  placeholder="Loin"
                  value={refractionData.subjective.pd?.distance || ''}
                  onChange={(e) => {
                    const newData = { ...refractionData };
                    newData.subjective.pd = { ...newData.subjective.pd, distance: e.target.value };
                    onChange?.(newData);
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Près"
                  value={refractionData.subjective.pd?.near || ''}
                  onChange={(e) => {
                    const newData = { ...refractionData };
                    newData.subjective.pd = { ...newData.subjective.pd, near: e.target.value };
                    onChange?.(newData);
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Calculations Panel - Collapsible */}
      {showCalculations && (
        <div className="border-t border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-indigo-800">Calculs Automatiques</h4>
            {calculations.comparison?.hasSignificantDifference && (
              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Écart obj/subj significatif
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Spherical Equivalent Section */}
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                Équivalent Sphérique
              </h5>
              <div className="space-y-2">
                {['OD', 'OS'].map(eye => (
                  <div key={eye} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">{eye}</span>
                    <div className="flex gap-2 text-xs">
                      {calculations.objective[eye]?.SE !== undefined && (
                        <span className="text-blue-600" title="Objectif">
                          Obj: {calculations.objective[eye].SE.toFixed(2)}D
                        </span>
                      )}
                      {calculations.subjective[eye]?.SE !== undefined && (
                        <span className="text-purple-600" title="Subjectif">
                          Subj: {calculations.subjective[eye].SE.toFixed(2)}D
                        </span>
                      )}
                      {calculations.objective[eye]?.SE === undefined && calculations.subjective[eye]?.SE === undefined && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Power Vectors Section */}
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Vecteurs de Puissance
              </h5>
              <div className="space-y-2">
                {['OD', 'OS'].map(eye => {
                  const vectors = calculations.subjective[eye]?.powerVectors;
                  return (
                    <div key={eye} className="text-xs">
                      <span className="text-gray-600 font-medium">{eye}: </span>
                      {vectors ? (
                        <span className="font-mono text-purple-700">
                          M={vectors.M.toFixed(2)} J₀={vectors.J0.toFixed(2)} J₄₅={vectors.J45.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Keratometry Calculations */}
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Target className="h-3 w-3" />
                Kératométrie
              </h5>
              <div className="space-y-2">
                {['OD', 'OS'].map(eye => {
                  const kCalc = calculations.keratometry[eye];
                  return (
                    <div key={eye} className="text-xs">
                      <span className="text-gray-600 font-medium">{eye}: </span>
                      {kCalc?.avgK ? (
                        <span className="font-mono text-green-700">
                          Km={kCalc.avgK.toFixed(2)}D ΔK={kCalc.cornealAstigmatism.toFixed(2)}D
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations & Age-Based Add */}
            <div className="bg-white rounded-lg p-3 border border-indigo-100">
              <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Glasses className="h-3 w-3" />
                Recommandations
              </h5>
              <div className="space-y-1.5">
                {calculations.expectedAdd && (
                  <div className="text-xs flex items-center gap-1">
                    <span className="text-gray-500">Add suggérée:</span>
                    <span className="font-medium text-purple-700">+{calculations.expectedAdd.toFixed(2)}</span>
                    <span className="text-gray-400">({calculations.patientAge} ans)</span>
                  </div>
                )}
                {calculations.recommendations?.length > 0 ? (
                  <div className="space-y-1">
                    {calculations.recommendations.slice(0, 3).map((rec, idx) => (
                      <div key={idx} className="text-xs flex items-start gap-1">
                        <Check className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{rec}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Aucune recommandation</span>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Alert */}
          {calculations.comparison?.hasSignificantDifference && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <span className="font-medium">Attention:</span> {calculations.comparison.message}
                  <div className="mt-1 text-amber-600">
                    Vérifiez l'accommodation, la fatigue oculaire, ou répétez l'autoréfraction.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anisometropia Alert */}
          {calculations.anisometropia && (
            <div className={`mt-3 p-2 rounded-lg border ${
              calculations.anisometropia.isSignificant
                ? 'bg-red-50 border-red-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-2">
                <Eye className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                  calculations.anisometropia.isSignificant ? 'text-red-600' : 'text-blue-600'
                }`} />
                <div className={`text-xs ${
                  calculations.anisometropia.isSignificant ? 'text-red-800' : 'text-blue-800'
                }`}>
                  <span className="font-medium">Anisométropie: </span>
                  <span className="font-mono">{calculations.anisometropia.difference.toFixed(2)}D</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    calculations.anisometropia.severity === 'severe' ? 'bg-red-100 text-red-700' :
                    calculations.anisometropia.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                    calculations.anisometropia.severity === 'mild' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {calculations.anisometropia.severity === 'severe' ? 'Sévère' :
                     calculations.anisometropia.severity === 'moderate' ? 'Modérée' :
                     calculations.anisometropia.severity === 'mild' ? 'Légère' : 'Normale'}
                  </span>
                  {calculations.anisometropia.recommendation && (
                    <div className={`mt-1 ${
                      calculations.anisometropia.isSignificant ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {calculations.anisometropia.recommendation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Significant Prescription Change Alert */}
          {calculations.prescriptionChanges?.hasSignificantChange && (
            <div className="mt-3 p-2 rounded-lg border bg-purple-50 border-purple-200">
              <div className="flex items-start gap-2">
                <History className="h-4 w-4 flex-shrink-0 mt-0.5 text-purple-600" />
                <div className="text-xs text-purple-800">
                  <span className="font-medium">Changement significatif (vs examen précédent):</span>
                  <div className="mt-1 space-y-1">
                    {calculations.prescriptionChanges.summary.map((change, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          change.includes('OD') ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {change.includes('OD') ? 'OD' : 'OS'}
                        </span>
                        <span className="text-purple-700">{change}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-purple-600 text-[10px]">
                    Vérifiez les raisons du changement (progression, adaptation, erreur de mesure)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keratometry - Expandable */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowKeratometry(!showKeratometry)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Kératométrie
          </span>
          {showKeratometry ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showKeratometry && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-4">
            {['OD', 'OS'].map(eye => (
              <div key={eye} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-purple-600 mb-2">{eye}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">K1 (D)</label>
                    <input
                      type="text"
                      value={refractionData.keratometry[eye]?.k1 || ''}
                      onChange={(e) => updateField('keratometry', eye, 'k1', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="42.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Axe K1</label>
                    <input
                      type="text"
                      value={refractionData.keratometry[eye]?.k1Axis || ''}
                      onChange={(e) => updateField('keratometry', eye, 'k1Axis', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="180°"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">K2 (D)</label>
                    <input
                      type="text"
                      value={refractionData.keratometry[eye]?.k2 || ''}
                      onChange={(e) => updateField('keratometry', eye, 'k2', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="43.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Axe K2</label>
                    <input
                      type="text"
                      value={refractionData.keratometry[eye]?.k2Axis || ''}
                      onChange={(e) => updateField('keratometry', eye, 'k2Axis', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="90°"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Previous Exam Preview Modal */}
      {showPreviousPreview && hasPreviousData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  Examen Précédent
                </h3>
                <button
                  onClick={() => setShowPreviousPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
              {getPreviousSummary() && (
                <p className="text-xs text-gray-500 mt-1">
                  {getPreviousSummary().date}
                </p>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Previous Prescription Summary */}
              {getPreviousSummary() && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-purple-600 mb-2">OD (Œil Droit)</div>
                    <div className="text-sm font-mono">
                      {getPreviousSummary().prescription.OD}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      AV: {getPreviousSummary().visualAcuity.OD}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-purple-600 mb-2">OS (Œil Gauche)</div>
                    <div className="text-sm font-mono">
                      {getPreviousSummary().prescription.OS}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      AV: {getPreviousSummary().visualAcuity.OS}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button
                  onClick={() => setShowPreviousPreview(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={loadPreviousExam}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Charger ces valeurs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CareVision Archive Preview Modal */}
      {showCareVisionPreview && careVisionRefraction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                  <Archive className="h-5 w-5 text-amber-600" />
                  Archive CareVision
                </h3>
                <button
                  onClick={() => setShowCareVisionPreview(false)}
                  className="text-amber-400 hover:text-amber-600"
                >
                  &times;
                </button>
              </div>
              {careVisionRefraction.date && (
                <p className="text-xs text-amber-600 mt-1">
                  {new Date(careVisionRefraction.date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* CareVision Refraction Data */}
              <div className="grid grid-cols-2 gap-4">
                {/* OD - Right Eye */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    OD (Œil Droit)
                  </div>
                  {careVisionRefraction.od ? (
                    <div className="space-y-1">
                      <div className="text-sm font-mono text-gray-800">
                        <span className="text-gray-500">Sph:</span> {formatRefractionValue(careVisionRefraction.od.sphere)}
                        {careVisionRefraction.od.cylinder && (
                          <>
                            {' '}
                            <span className="text-gray-500">Cyl:</span> {formatRefractionValue(careVisionRefraction.od.cylinder)}
                            {' × '}{careVisionRefraction.od.axis || 0}°
                          </>
                        )}
                      </div>
                      {careVisionRefraction.od.addition && (
                        <div className="text-xs text-gray-600">
                          <span className="text-gray-500">Add:</span> {formatRefractionValue(careVisionRefraction.od.addition)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">Non disponible</div>
                  )}
                </div>

                {/* OG - Left Eye */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    OS (Œil Gauche)
                  </div>
                  {careVisionRefraction.og ? (
                    <div className="space-y-1">
                      <div className="text-sm font-mono text-gray-800">
                        <span className="text-gray-500">Sph:</span> {formatRefractionValue(careVisionRefraction.og.sphere)}
                        {careVisionRefraction.og.cylinder && (
                          <>
                            {' '}
                            <span className="text-gray-500">Cyl:</span> {formatRefractionValue(careVisionRefraction.og.cylinder)}
                            {' × '}{careVisionRefraction.og.axis || 0}°
                          </>
                        )}
                      </div>
                      {careVisionRefraction.og.addition && (
                        <div className="text-xs text-gray-600">
                          <span className="text-gray-500">Add:</span> {formatRefractionValue(careVisionRefraction.og.addition)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">Non disponible</div>
                  )}
                </div>
              </div>

              {/* Archive Notice */}
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Ces données proviennent de l'archive CareVision en lecture seule.
                  Elles seront copiées comme point de départ pour la réfraction objective et subjective.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2 border-t border-amber-200">
                <button
                  onClick={() => setShowCareVisionPreview(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={applyCareVisionRefraction}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Charger ces valeurs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
