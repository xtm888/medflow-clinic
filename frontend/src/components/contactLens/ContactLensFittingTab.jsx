/**
 * ContactLensFittingTab - Trial Lens & Assessment
 *
 * StudioVision Parity: Tab 2 of Contact Lens Fitting workflow
 *
 * Features:
 * - Trial lens selection with inventory lookup
 * - Assessment grading (centration, movement, coverage)
 * - Comfort and vision quality sliders
 * - Over-refraction calculation
 * - Fluorescein pattern for RGP
 * - Final prescription auto-calculation
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Target,
  Eye,
  Check,
  X,
  Copy,
  RefreshCw,
  Search,
  Droplet,
  Info,
  AlertCircle
} from 'lucide-react';

// Centration options
const CENTRATION_OPTIONS = [
  { value: 'centered', label: 'Centré', color: 'green' },
  { value: 'decentered_nasal', label: 'Décentré nasal', color: 'orange' },
  { value: 'decentered_temporal', label: 'Décentré temporal', color: 'orange' },
  { value: 'decentered_superior', label: 'Décentré supérieur', color: 'orange' },
  { value: 'decentered_inferior', label: 'Décentré inférieur', color: 'orange' }
];

// Movement options
const MOVEMENT_OPTIONS = [
  { value: 'optimal', label: 'Optimal', color: 'green', desc: '0.5-1mm' },
  { value: 'tight', label: 'Serré', color: 'red', desc: '<0.5mm' },
  { value: 'loose', label: 'Lâche', color: 'orange', desc: '>1mm' }
];

// Coverage options
const COVERAGE_OPTIONS = [
  { value: 'full', label: 'Complet', color: 'green' },
  { value: 'partial', label: 'Partiel', color: 'orange' },
  { value: 'inadequate', label: 'Insuffisant', color: 'red' }
];

// Fluorescein patterns for RGP
const FLUORESCEIN_OPTIONS = [
  { value: 'alignment', label: 'Alignement', desc: 'Pattern uniforme' },
  { value: 'apical_clearance', label: 'Clearance apicale', desc: 'Lentille plate' },
  { value: 'apical_bearing', label: 'Appui apical', desc: 'Lentille cambrée' },
  { value: 'three_point_touch', label: 'Appui 3 points', desc: 'Pattern torique' }
];

// Modality options
const MODALITY_OPTIONS = [
  { value: 'daily', label: 'Journalière' },
  { value: 'biweekly', label: 'Bi-hebdo' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'annual', label: 'Annuelle' },
  { value: 'extended', label: 'Port prolongé' }
];

// Contact Lens Labs/Manufacturers
const CONTACT_LENS_LABS = [
  { id: 'jnj', name: 'Johnson & Johnson Vision', shortName: 'J&J', country: 'USA' },
  { id: 'alcon', name: 'Alcon', shortName: 'Alcon', country: 'USA' },
  { id: 'coopervision', name: 'CooperVision', shortName: 'Cooper', country: 'USA' },
  { id: 'bausch', name: 'Bausch + Lomb', shortName: 'B+L', country: 'USA' },
  { id: 'menicon', name: 'Menicon', shortName: 'Menicon', country: 'Japon' },
  { id: 'markennovy', name: 'Mark\'ennovy', shortName: 'Markennovy', country: 'Espagne' },
  { id: 'swissprecision', name: 'SwissLens', shortName: 'Swiss', country: 'Suisse' },
  { id: 'lcs', name: 'LCS France', shortName: 'LCS', country: 'France' },
  { id: 'precilens', name: 'Precilens', shortName: 'Precilens', country: 'France' }
];

// Comprehensive Contact Lens Product Database
const CONTACT_LENS_PRODUCTS = [
  // Johnson & Johnson
  {
    id: 'acuvue-oasys-1day',
    name: 'Acuvue Oasys 1-Day',
    lab: 'jnj',
    type: 'soft_spherical',
    modality: 'daily',
    material: 'Senofilcon A',
    waterContent: 38,
    dkT: 121,
    bcOptions: [8.5, 9.0],
    diaOptions: [14.3],
    powerRange: { min: -12.00, max: +8.00, step: 0.25 },
    uvBlocking: true,
    featured: true
  },
  {
    id: 'acuvue-oasys-1day-astig',
    name: 'Acuvue Oasys 1-Day for Astigmatism',
    lab: 'jnj',
    type: 'soft_toric',
    modality: 'daily',
    material: 'Senofilcon A',
    waterContent: 38,
    dkT: 121,
    bcOptions: [8.5],
    diaOptions: [14.3],
    powerRange: { min: -9.00, max: +4.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25],
    axisRange: { min: 10, max: 180, step: 10 },
    uvBlocking: true,
    featured: true
  },
  {
    id: 'acuvue-oasys',
    name: 'Acuvue Oasys',
    lab: 'jnj',
    type: 'soft_spherical',
    modality: 'biweekly',
    material: 'Senofilcon A',
    waterContent: 38,
    dkT: 147,
    bcOptions: [8.4, 8.8],
    diaOptions: [14.0],
    powerRange: { min: -12.00, max: +8.00, step: 0.25 },
    uvBlocking: true,
    featured: true
  },
  {
    id: 'acuvue-oasys-astig',
    name: 'Acuvue Oasys for Astigmatism',
    lab: 'jnj',
    type: 'soft_toric',
    modality: 'biweekly',
    material: 'Senofilcon A',
    waterContent: 38,
    dkT: 129,
    bcOptions: [8.6],
    diaOptions: [14.5],
    powerRange: { min: -9.00, max: +6.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25, -2.75],
    axisRange: { min: 10, max: 180, step: 10 },
    uvBlocking: true
  },
  {
    id: 'acuvue-oasys-multifocal',
    name: 'Acuvue Oasys MAX 1-Day Multifocal',
    lab: 'jnj',
    type: 'soft_multifocal',
    modality: 'daily',
    material: 'Senofilcon A',
    waterContent: 38,
    dkT: 121,
    bcOptions: [8.4],
    diaOptions: [14.3],
    powerRange: { min: -9.00, max: +6.00, step: 0.25 },
    addPowers: ['LOW', 'MID', 'HIGH'],
    uvBlocking: true
  },
  // Alcon
  {
    id: 'dailies-total1',
    name: 'Dailies Total1',
    lab: 'alcon',
    type: 'soft_spherical',
    modality: 'daily',
    material: 'Delefilcon A',
    waterContent: 33,
    dkT: 156,
    bcOptions: [8.5],
    diaOptions: [14.1],
    powerRange: { min: -12.00, max: +6.00, step: 0.25 },
    uvBlocking: false,
    featured: true
  },
  {
    id: 'dailies-total1-astig',
    name: 'Dailies Total1 for Astigmatism',
    lab: 'alcon',
    type: 'soft_toric',
    modality: 'daily',
    material: 'Delefilcon A',
    waterContent: 33,
    dkT: 156,
    bcOptions: [8.6],
    diaOptions: [14.4],
    powerRange: { min: -8.00, max: +4.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25],
    axisRange: { min: 10, max: 180, step: 10 }
  },
  {
    id: 'dailies-total1-multifocal',
    name: 'Dailies Total1 Multifocal',
    lab: 'alcon',
    type: 'soft_multifocal',
    modality: 'daily',
    material: 'Delefilcon A',
    waterContent: 33,
    dkT: 156,
    bcOptions: [8.5],
    diaOptions: [14.1],
    powerRange: { min: -10.00, max: +6.00, step: 0.25 },
    addPowers: ['LOW', 'MED', 'HIGH']
  },
  {
    id: 'precision1',
    name: 'Precision1',
    lab: 'alcon',
    type: 'soft_spherical',
    modality: 'daily',
    material: 'Verofilcon A',
    waterContent: 51,
    dkT: 90,
    bcOptions: [8.3],
    diaOptions: [14.2],
    powerRange: { min: -12.00, max: +8.00, step: 0.25 },
    uvBlocking: true,
    featured: true
  },
  {
    id: 'precision1-astig',
    name: 'Precision1 for Astigmatism',
    lab: 'alcon',
    type: 'soft_toric',
    modality: 'daily',
    material: 'Verofilcon A',
    waterContent: 51,
    dkT: 90,
    bcOptions: [8.5],
    diaOptions: [14.5],
    powerRange: { min: -8.00, max: +4.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25],
    axisRange: { min: 10, max: 180, step: 10 },
    uvBlocking: true
  },
  {
    id: 'air-optix-plus',
    name: 'Air Optix Plus HydraGlyde',
    lab: 'alcon',
    type: 'soft_spherical',
    modality: 'monthly',
    material: 'Lotrafilcon B',
    waterContent: 33,
    dkT: 138,
    bcOptions: [8.6],
    diaOptions: [14.2],
    powerRange: { min: -12.00, max: +6.00, step: 0.25 },
    uvBlocking: false,
    featured: true
  },
  {
    id: 'air-optix-astig',
    name: 'Air Optix Plus HydraGlyde for Astigmatism',
    lab: 'alcon',
    type: 'soft_toric',
    modality: 'monthly',
    material: 'Lotrafilcon B',
    waterContent: 33,
    dkT: 108,
    bcOptions: [8.7],
    diaOptions: [14.5],
    powerRange: { min: -10.00, max: +6.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25],
    axisRange: { min: 10, max: 180, step: 10 }
  },
  {
    id: 'air-optix-multifocal',
    name: 'Air Optix Plus HydraGlyde Multifocal',
    lab: 'alcon',
    type: 'soft_multifocal',
    modality: 'monthly',
    material: 'Lotrafilcon B',
    waterContent: 33,
    dkT: 138,
    bcOptions: [8.6],
    diaOptions: [14.2],
    powerRange: { min: -10.00, max: +6.00, step: 0.25 },
    addPowers: ['LOW', 'MED', 'HIGH']
  },
  // CooperVision
  {
    id: 'biofinity',
    name: 'Biofinity',
    lab: 'coopervision',
    type: 'soft_spherical',
    modality: 'monthly',
    material: 'Comfilcon A',
    waterContent: 48,
    dkT: 160,
    bcOptions: [8.6],
    diaOptions: [14.0],
    powerRange: { min: -12.00, max: +8.00, step: 0.25 },
    uvBlocking: false,
    featured: true
  },
  {
    id: 'biofinity-toric',
    name: 'Biofinity Toric',
    lab: 'coopervision',
    type: 'soft_toric',
    modality: 'monthly',
    material: 'Comfilcon A',
    waterContent: 48,
    dkT: 116,
    bcOptions: [8.7],
    diaOptions: [14.5],
    powerRange: { min: -10.00, max: +10.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25, -2.75],
    axisRange: { min: 5, max: 180, step: 5 },
    featured: true
  },
  {
    id: 'biofinity-multifocal',
    name: 'Biofinity Multifocal',
    lab: 'coopervision',
    type: 'soft_multifocal',
    modality: 'monthly',
    material: 'Comfilcon A',
    waterContent: 48,
    dkT: 160,
    bcOptions: [8.6],
    diaOptions: [14.0],
    powerRange: { min: -10.00, max: +6.00, step: 0.25 },
    addPowers: ['+1.00', '+1.50', '+2.00', '+2.50']
  },
  {
    id: 'myday',
    name: 'MyDay',
    lab: 'coopervision',
    type: 'soft_spherical',
    modality: 'daily',
    material: 'Stenfilcon A',
    waterContent: 54,
    dkT: 80,
    bcOptions: [8.4],
    diaOptions: [14.2],
    powerRange: { min: -12.00, max: +8.00, step: 0.25 },
    uvBlocking: true,
    featured: true
  },
  {
    id: 'myday-toric',
    name: 'MyDay Toric',
    lab: 'coopervision',
    type: 'soft_toric',
    modality: 'daily',
    material: 'Stenfilcon A',
    waterContent: 54,
    dkT: 80,
    bcOptions: [8.6],
    diaOptions: [14.5],
    powerRange: { min: -10.00, max: +6.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25],
    axisRange: { min: 10, max: 180, step: 10 },
    uvBlocking: true
  },
  {
    id: 'clariti-1day',
    name: 'clariti 1 day',
    lab: 'coopervision',
    type: 'soft_spherical',
    modality: 'daily',
    material: 'Somofilcon A',
    waterContent: 56,
    dkT: 86,
    bcOptions: [8.6],
    diaOptions: [14.1],
    powerRange: { min: -10.00, max: +8.00, step: 0.25 },
    uvBlocking: true
  },
  // Bausch + Lomb
  {
    id: 'biotrue-oneday',
    name: 'Biotrue ONEday',
    lab: 'bausch',
    type: 'soft_spherical',
    modality: 'daily',
    material: 'Nesofilcon A',
    waterContent: 78,
    dkT: 42,
    bcOptions: [8.6],
    diaOptions: [14.2],
    powerRange: { min: -9.00, max: +6.00, step: 0.25 },
    uvBlocking: true
  },
  {
    id: 'biotrue-oneday-astig',
    name: 'Biotrue ONEday for Astigmatism',
    lab: 'bausch',
    type: 'soft_toric',
    modality: 'daily',
    material: 'Nesofilcon A',
    waterContent: 78,
    dkT: 42,
    bcOptions: [8.4],
    diaOptions: [14.5],
    powerRange: { min: -9.00, max: +4.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25],
    axisRange: { min: 10, max: 180, step: 10 },
    uvBlocking: true
  },
  {
    id: 'ultra',
    name: 'Bausch + Lomb ULTRA',
    lab: 'bausch',
    type: 'soft_spherical',
    modality: 'monthly',
    material: 'Samfilcon A',
    waterContent: 46,
    dkT: 114,
    bcOptions: [8.5],
    diaOptions: [14.2],
    powerRange: { min: -12.00, max: +6.00, step: 0.25 },
    uvBlocking: true
  },
  {
    id: 'ultra-astig',
    name: 'Bausch + Lomb ULTRA for Astigmatism',
    lab: 'bausch',
    type: 'soft_toric',
    modality: 'monthly',
    material: 'Samfilcon A',
    waterContent: 46,
    dkT: 114,
    bcOptions: [8.6],
    diaOptions: [14.5],
    powerRange: { min: -9.00, max: +6.00, step: 0.25 },
    cylOptions: [-0.75, -1.25, -1.75, -2.25, -2.75],
    axisRange: { min: 10, max: 180, step: 10 },
    uvBlocking: true
  },
  // Menicon
  {
    id: 'menicon-z',
    name: 'Menicon Z',
    lab: 'menicon',
    type: 'rgp',
    modality: 'annual',
    material: 'Tisilfocon A',
    waterContent: 0,
    dkT: 163,
    bcOptions: null, // Custom
    diaOptions: null, // Custom
    powerRange: { min: -20.00, max: +20.00, step: 0.25 },
    customizable: true
  },
  {
    id: 'menicon-bloom',
    name: 'Menicon Bloom Night',
    lab: 'menicon',
    type: 'ortho_k',
    modality: 'annual',
    material: 'Tisilfocon A',
    waterContent: 0,
    dkT: 163,
    bcOptions: null,
    diaOptions: null,
    powerRange: { min: -4.00, max: 0.00, step: 0.25 },
    customizable: true
  },
  // Mark'ennovy
  {
    id: 'markennovy-toric',
    name: 'Mark\'ennovy Custom Toric',
    lab: 'markennovy',
    type: 'soft_toric',
    modality: 'monthly',
    material: 'Filcon IV 3',
    waterContent: 47,
    dkT: 60,
    bcOptions: [7.8, 8.0, 8.2, 8.4, 8.6, 8.8, 9.0],
    diaOptions: [13.5, 14.0, 14.5, 15.0],
    powerRange: { min: -20.00, max: +20.00, step: 0.01 },
    cylOptions: [-0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.50, -3.00, -4.00, -5.00, -6.00],
    axisRange: { min: 1, max: 180, step: 1 },
    customizable: true
  },
  {
    id: 'markennovy-multifocal',
    name: 'Mark\'ennovy Custom Multifocal',
    lab: 'markennovy',
    type: 'soft_multifocal',
    modality: 'monthly',
    material: 'Filcon IV 3',
    waterContent: 47,
    dkT: 60,
    bcOptions: [7.8, 8.0, 8.2, 8.4, 8.6, 8.8, 9.0],
    diaOptions: [13.5, 14.0, 14.5, 15.0],
    powerRange: { min: -20.00, max: +15.00, step: 0.01 },
    addPowers: ['+0.50', '+0.75', '+1.00', '+1.25', '+1.50', '+1.75', '+2.00', '+2.25', '+2.50', '+2.75', '+3.00', '+3.50'],
    customizable: true
  },
  // SwissLens
  {
    id: 'swisslens-scleral',
    name: 'SwissLens Scleral',
    lab: 'swissprecision',
    type: 'scleral',
    modality: 'annual',
    material: 'Optimum Extra',
    waterContent: 0,
    dkT: 100,
    bcOptions: null,
    diaOptions: [15.5, 16.0, 16.5, 17.0, 18.0],
    powerRange: { min: -25.00, max: +25.00, step: 0.25 },
    customizable: true
  },
  // LCS France
  {
    id: 'lcs-kerato',
    name: 'LCS Kératocône',
    lab: 'lcs',
    type: 'rgp',
    modality: 'annual',
    material: 'Boston XO',
    waterContent: 0,
    dkT: 100,
    bcOptions: null,
    diaOptions: [8.5, 9.0, 9.5, 10.0],
    powerRange: { min: -25.00, max: +25.00, step: 0.25 },
    customizable: true,
    specialty: 'keratoconus'
  },
  // Precilens
  {
    id: 'precilens-kc',
    name: 'Precilens KC',
    lab: 'precilens',
    type: 'rgp',
    modality: 'annual',
    material: 'Boston XO2',
    waterContent: 0,
    dkT: 141,
    bcOptions: null,
    diaOptions: [8.6, 9.2, 9.6, 10.0, 10.4],
    powerRange: { min: -30.00, max: +30.00, step: 0.25 },
    customizable: true,
    specialty: 'keratoconus'
  }
];

// Quick access for featured/common products
const FEATURED_PRODUCTS = CONTACT_LENS_PRODUCTS.filter(p => p.featured);

// Legacy COMMON_BRANDS for backward compatibility
const COMMON_BRANDS = FEATURED_PRODUCTS.map(p => p.name);

// Badge color mapping
const BADGE_COLORS = {
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800'
};

// K-Range constants for contact lens fitting
const K_RANGE_CONFIG = {
  min: 40.0, // Minimum keratometry (flat cornea)
  max: 50.0, // Maximum keratometry (steep cornea)
  normalMin: 42.0,
  normalMax: 46.0,
  flatZone: { min: 40.0, max: 42.0, label: 'Plat', color: 'bg-blue-400' },
  normalZone: { min: 42.0, max: 46.0, label: 'Normal', color: 'bg-green-400' },
  steepZone: { min: 46.0, max: 48.0, label: 'Cambré', color: 'bg-orange-400' },
  verySteepZone: { min: 48.0, max: 50.0, label: 'Très cambré', color: 'bg-red-400' }
};

// Base curve recommendation based on K values
const getRecommendedBC = (avgK) => {
  if (!avgK) return null;
  const bcFromK = 337.5 / avgK;
  return {
    calculated: bcFromK.toFixed(2),
    soft: {
      flat: (bcFromK + 0.8).toFixed(1),
      steep: (bcFromK + 0.4).toFixed(1)
    },
    rgp: {
      onK: bcFromK.toFixed(2),
      flat: (bcFromK + 0.10).toFixed(2),
      steep: (bcFromK - 0.10).toFixed(2)
    }
  };
};

export default function ContactLensFittingTab({
  trialLens = { OD: {}, OS: {} },
  assessment = { OD: {}, OS: {} },
  finalPrescription = { OD: {}, OS: {} },
  lensType = 'soft_spherical',
  refraction,
  keratometry,
  onUpdateTrialLens,
  onUpdateAssessment,
  onUpdateFinalRx,
  readOnly = false
}) {
  const [activeEye, setActiveEye] = useState('OD');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // Is RGP lens type?
  const isRGP = ['rgp', 'scleral', 'hybrid', 'ortho_k'].includes(lensType);

  // Calculate final power from trial + over-refraction
  const calculateFinalPower = useCallback((trialPower, overRef) => {
    if (!overRef?.needed) return trialPower;
    return (trialPower || 0) + (overRef.sphere || 0);
  }, []);

  // Update trial lens
  const handleTrialUpdate = useCallback((eye, field, value) => {
    if (readOnly) return;
    onUpdateTrialLens(prev => ({
      ...prev,
      [eye]: {
        ...(prev[eye] || {}),
        [field]: value
      }
    }));
  }, [onUpdateTrialLens, readOnly]);

  // Update assessment
  const handleAssessmentUpdate = useCallback((eye, field, value) => {
    if (readOnly) return;
    onUpdateAssessment(prev => ({
      ...prev,
      [eye]: {
        ...(prev[eye] || {}),
        [field]: value
      }
    }));
  }, [onUpdateAssessment, readOnly]);

  // Update over-refraction
  const handleOverRefUpdate = useCallback((eye, field, value) => {
    if (readOnly) return;
    onUpdateAssessment(prev => {
      const eyeData = prev[eye] || {};
      const overRef = eyeData.overRefraction || {};
      const newOverRef = { ...overRef, [field]: value };

      // Auto-calculate final power
      if (field === 'sphere' || field === 'needed') {
        const trialPower = trialLens[eye]?.power || 0;
        newOverRef.finalPower = calculateFinalPower(trialPower, newOverRef);
      }

      return {
        ...prev,
        [eye]: {
          ...eyeData,
          overRefraction: newOverRef
        }
      };
    });
  }, [onUpdateAssessment, readOnly, trialLens, calculateFinalPower]);

  // Update final prescription
  const handleFinalRxUpdate = useCallback((eye, field, value) => {
    if (readOnly) return;
    onUpdateFinalRx(prev => ({
      ...prev,
      [eye]: {
        ...(prev[eye] || {}),
        [field]: value
      }
    }));
  }, [onUpdateFinalRx, readOnly]);

  // Copy trial to final prescription
  const copyTrialToFinal = useCallback((eye) => {
    if (readOnly) return;
    const trial = trialLens[eye] || {};
    const overRef = assessment[eye]?.overRefraction || {};

    onUpdateFinalRx(prev => ({
      ...prev,
      [eye]: {
        ...trial,
        power: calculateFinalPower(trial.power, overRef)
      }
    }));
  }, [trialLens, assessment, onUpdateFinalRx, calculateFinalPower, readOnly]);

  // Copy OD to OS
  const copyODtoOS = useCallback(() => {
    if (readOnly) return;
    onUpdateTrialLens(prev => ({
      ...prev,
      OS: { ...prev.OD }
    }));
    onUpdateAssessment(prev => ({
      ...prev,
      OS: { ...prev.OD }
    }));
  }, [onUpdateTrialLens, onUpdateAssessment, readOnly]);

  // Suggested parameters from refraction/keratometry
  const suggestedParams = useMemo(() => {
    if (!refraction && !keratometry) return null;

    return {
      OD: {
        power: refraction?.subjective?.OD?.sphere,
        cylinder: refraction?.subjective?.OD?.cylinder,
        axis: refraction?.subjective?.OD?.axis,
        baseCurve: keratometry?.OD?.flatK ? (337.5 / keratometry.OD.flatK).toFixed(1) : null
      },
      OS: {
        power: refraction?.subjective?.OS?.sphere,
        cylinder: refraction?.subjective?.OS?.cylinder,
        axis: refraction?.subjective?.OS?.axis,
        baseCurve: keratometry?.OS?.flatK ? (337.5 / keratometry.OS.flatK).toFixed(1) : null
      }
    };
  }, [refraction, keratometry]);

  // Apply suggested parameters
  const applySuggested = useCallback((eye) => {
    if (!suggestedParams?.[eye] || readOnly) return;
    onUpdateTrialLens(prev => ({
      ...prev,
      [eye]: {
        ...(prev[eye] || {}),
        ...suggestedParams[eye]
      }
    }));
  }, [suggestedParams, onUpdateTrialLens, readOnly]);

  // Get assessment badge color
  const getAssessmentBadgeColor = (value, options) => {
    const opt = options.find(o => o.value === value);
    return opt?.color || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Suggested Parameters Alert */}
      {suggestedParams && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-blue-800">Paramètres suggérés disponibles</p>
            <p className="text-sm text-blue-600">
              Basés sur la réfraction et/ou kératométrie du patient
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50"
              onClick={() => applySuggested('OD')}
              disabled={readOnly}
            >
              <RefreshCw className="w-4 h-4" />
              Appliquer OD
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50"
              onClick={() => applySuggested('OS')}
              disabled={readOnly}
            >
              <RefreshCw className="w-4 h-4" />
              Appliquer OS
            </button>
          </div>
        </div>
      )}

      {/* K-Range Visual Bar - Shows keratometry data if available */}
      {keratometry && (keratometry.OD || keratometry.OS) && (
        <div className="grid grid-cols-2 gap-4">
          <KRangeVisualBar
            keratometry={keratometry}
            eye="OD"
            showRecommendations={true}
          />
          <KRangeVisualBar
            keratometry={keratometry}
            eye="OS"
            showRecommendations={true}
          />
        </div>
      )}

      {/* OD/OS Tabs */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="flex border-b border-gray-200">
            {['OD', 'OS'].map((eye) => (
              <button
                key={eye}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeEye === eye
                    ? eye === 'OD'
                      ? 'border-green-500 text-green-600'
                      : 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveEye(eye)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{eye}</span>
                  <span className="text-xs text-gray-500">{eye === 'OD' ? 'Droit' : 'Gauche'}</span>
                  {assessment[eye]?.centration && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
            onClick={copyODtoOS}
            disabled={readOnly}
          >
            <Copy className="w-4 h-4" />
            Copier OD → OS
          </button>
        </div>

        {/* Tab Content for Active Eye */}
        {['OD', 'OS'].map(eye => (
          <div
            key={eye}
            className={`p-4 rounded-md ${eye === 'OD' ? 'bg-green-50' : 'bg-blue-50'} ${activeEye !== eye ? 'hidden' : ''}`}
          >
            {/* Trial Lens Parameters */}
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Lentille d'essai
            </h4>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Brand */}
              <div className="col-span-3">
                <label className="block text-sm font-medium mb-1">Marque</label>
                <div className="flex gap-2">
                  <input
                    value={trialLens[eye]?.brand || ''}
                    onChange={(e) => handleTrialUpdate(eye, 'brand', e.target.value)}
                    placeholder="Marque de la lentille"
                    disabled={readOnly}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => setIsInventoryOpen(true)}
                    disabled={readOnly}
                  >
                    <Search className="w-4 h-4" />
                    Inventaire
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {COMMON_BRANDS.slice(0, 4).map(brand => (
                    <button
                      key={brand}
                      className={`px-2 py-0.5 text-xs rounded border transition ${
                        trialLens[eye]?.brand === brand
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                      onClick={() => !readOnly && handleTrialUpdate(eye, 'brand', brand)}
                      disabled={readOnly}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>

              {/* Power */}
              <div>
                <label className="block text-sm font-medium mb-1">Puissance</label>
                <input
                  type="number"
                  step="0.25"
                  value={trialLens[eye]?.power ?? ''}
                  onChange={(e) => handleTrialUpdate(eye, 'power', parseFloat(e.target.value))}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* BC */}
              <div>
                <label className="block text-sm font-medium mb-1">Rayon de base (BC)</label>
                <input
                  type="number"
                  step="0.1"
                  value={trialLens[eye]?.baseCurve ?? ''}
                  onChange={(e) => handleTrialUpdate(eye, 'baseCurve', parseFloat(e.target.value))}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Diameter */}
              <div>
                <label className="block text-sm font-medium mb-1">Diamètre</label>
                <input
                  type="number"
                  step="0.1"
                  value={trialLens[eye]?.diameter ?? ''}
                  onChange={(e) => handleTrialUpdate(eye, 'diameter', parseFloat(e.target.value))}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Toric parameters */}
              {lensType.includes('toric') && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cylindre</label>
                    <input
                      type="number"
                      step="0.25"
                      value={trialLens[eye]?.cylinder ?? ''}
                      onChange={(e) => handleTrialUpdate(eye, 'cylinder', parseFloat(e.target.value))}
                      disabled={readOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Axe</label>
                    <input
                      type="number"
                      value={trialLens[eye]?.axis ?? ''}
                      onChange={(e) => handleTrialUpdate(eye, 'axis', parseInt(e.target.value))}
                      disabled={readOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </>
              )}
            </div>

            <hr className="my-4 border-gray-200" />

            {/* Assessment */}
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Évaluation
            </h4>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Centration */}
              <div>
                <label className="block text-sm font-medium mb-1">Centrage</label>
                <select
                  value={assessment[eye]?.centration || ''}
                  onChange={(e) => handleAssessmentUpdate(eye, 'centration', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner...</option>
                  {CENTRATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {assessment[eye]?.centration && (
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${BADGE_COLORS[getAssessmentBadgeColor(assessment[eye].centration, CENTRATION_OPTIONS)]}`}>
                    {CENTRATION_OPTIONS.find(o => o.value === assessment[eye].centration)?.label}
                  </span>
                )}
              </div>

              {/* Movement */}
              <div>
                <label className="block text-sm font-medium mb-1">Mouvement</label>
                <select
                  value={assessment[eye]?.movement || ''}
                  onChange={(e) => handleAssessmentUpdate(eye, 'movement', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner...</option>
                  {MOVEMENT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.desc})
                    </option>
                  ))}
                </select>
                {assessment[eye]?.movement && (
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${BADGE_COLORS[getAssessmentBadgeColor(assessment[eye].movement, MOVEMENT_OPTIONS)]}`}>
                    {MOVEMENT_OPTIONS.find(o => o.value === assessment[eye].movement)?.label}
                  </span>
                )}
              </div>

              {/* Coverage */}
              <div>
                <label className="block text-sm font-medium mb-1">Couverture</label>
                <select
                  value={assessment[eye]?.coverage || ''}
                  onChange={(e) => handleAssessmentUpdate(eye, 'coverage', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner...</option>
                  {COVERAGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {assessment[eye]?.coverage && (
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${BADGE_COLORS[getAssessmentBadgeColor(assessment[eye].coverage, COVERAGE_OPTIONS)]}`}>
                    {COVERAGE_OPTIONS.find(o => o.value === assessment[eye].coverage)?.label}
                  </span>
                )}
              </div>
            </div>

            {/* Comfort & Vision Sliders */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Confort (1-10)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={assessment[eye]?.comfort || 5}
                    onChange={(e) => handleAssessmentUpdate(eye, 'comfort', parseInt(e.target.value))}
                    disabled={readOnly}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <span className="text-sm font-bold w-6 text-center">{assessment[eye]?.comfort || 5}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Qualité visuelle (1-10)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={assessment[eye]?.visionQuality || 5}
                    onChange={(e) => handleAssessmentUpdate(eye, 'visionQuality', parseInt(e.target.value))}
                    disabled={readOnly}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-sm font-bold w-6 text-center">{assessment[eye]?.visionQuality || 5}</span>
                </div>
              </div>
            </div>

            {/* Fluorescein for RGP */}
            {isRGP && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Droplet className="w-4 h-4 text-yellow-500" />
                  Pattern fluorescéine
                </label>
                <select
                  value={assessment[eye]?.fluoresceinPattern || ''}
                  onChange={(e) => handleAssessmentUpdate(eye, 'fluoresceinPattern', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner...</option>
                  {FLUORESCEIN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} - {opt.desc}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Over-refraction */}
            <div className="p-3 bg-white rounded-md border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">Sur-réfraction</span>
                <label className="flex items-center gap-2 text-sm">
                  <span>Nécessaire ?</span>
                  <input
                    type="checkbox"
                    checked={assessment[eye]?.overRefraction?.needed || false}
                    onChange={(e) => handleOverRefUpdate(eye, 'needed', e.target.checked)}
                    disabled={readOnly}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              {assessment[eye]?.overRefraction?.needed && (
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Sphère</label>
                    <input
                      type="number"
                      step="0.25"
                      value={assessment[eye]?.overRefraction?.sphere ?? ''}
                      onChange={(e) => handleOverRefUpdate(eye, 'sphere', parseFloat(e.target.value))}
                      disabled={readOnly}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Cylindre</label>
                    <input
                      type="number"
                      step="0.25"
                      value={assessment[eye]?.overRefraction?.cylinder ?? ''}
                      onChange={(e) => handleOverRefUpdate(eye, 'cylinder', parseFloat(e.target.value))}
                      disabled={readOnly}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Axe</label>
                    <input
                      type="number"
                      value={assessment[eye]?.overRefraction?.axis ?? ''}
                      onChange={(e) => handleOverRefUpdate(eye, 'axis', parseInt(e.target.value))}
                      disabled={readOnly}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Puissance finale</label>
                    <input
                      value={assessment[eye]?.overRefraction?.finalPower?.toFixed(2) || '-'}
                      readOnly
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <hr className="border-gray-200" />

      {/* Final Prescription */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Ordonnance finale
          </h4>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              onClick={() => copyTrialToFinal('OD')}
              disabled={readOnly}
            >
              <Copy className="w-4 h-4" />
              Copier essai OD
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              onClick={() => copyTrialToFinal('OS')}
              disabled={readOnly}
            >
              <Copy className="w-4 h-4" />
              Copier essai OS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {['OD', 'OS'].map(eye => (
            <div
              key={eye}
              className={`p-3 rounded-md border-2 ${eye === 'OD' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}
            >
              <h5 className={`font-bold mb-2 ${eye === 'OD' ? 'text-green-700' : 'text-blue-700'}`}>
                {eye} - {eye === 'OD' ? 'Droit' : 'Gauche'}
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Marque</label>
                  <input
                    value={finalPrescription[eye]?.brand || ''}
                    onChange={(e) => handleFinalRxUpdate(eye, 'brand', e.target.value)}
                    disabled={readOnly}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Puissance</label>
                  <input
                    type="number"
                    step="0.25"
                    value={finalPrescription[eye]?.power ?? ''}
                    onChange={(e) => handleFinalRxUpdate(eye, 'power', parseFloat(e.target.value))}
                    disabled={readOnly}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">BC</label>
                  <input
                    type="number"
                    step="0.1"
                    value={finalPrescription[eye]?.baseCurve ?? ''}
                    onChange={(e) => handleFinalRxUpdate(eye, 'baseCurve', parseFloat(e.target.value))}
                    disabled={readOnly}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Diamètre</label>
                  <input
                    type="number"
                    step="0.1"
                    value={finalPrescription[eye]?.diameter ?? ''}
                    onChange={(e) => handleFinalRxUpdate(eye, 'diameter', parseFloat(e.target.value))}
                    disabled={readOnly}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                {lensType.includes('toric') && (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-1">Cylindre</label>
                      <input
                        type="number"
                        step="0.25"
                        value={finalPrescription[eye]?.cylinder ?? ''}
                        onChange={(e) => handleFinalRxUpdate(eye, 'cylinder', parseFloat(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Axe</label>
                      <input
                        type="number"
                        value={finalPrescription[eye]?.axis ?? ''}
                        onChange={(e) => handleFinalRxUpdate(eye, 'axis', parseInt(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1">Modalité</label>
                  <select
                    value={finalPrescription[eye]?.modality || ''}
                    onChange={(e) => handleFinalRxUpdate(eye, 'modality', e.target.value)}
                    disabled={readOnly}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">-</option>
                    {MODALITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Database Picker Modal */}
      {isInventoryOpen && (
        <ProductPickerModal
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
          lensType={lensType}
          onSelectProduct={(product) => {
            handleTrialUpdate(activeEye, 'brand', product.name);
            handleTrialUpdate(activeEye, 'productId', product.id);
            handleTrialUpdate(activeEye, 'labId', product.lab);
            if (product.bcOptions?.length === 1) {
              handleTrialUpdate(activeEye, 'baseCurve', product.bcOptions[0]);
            }
            if (product.diaOptions?.length === 1) {
              handleTrialUpdate(activeEye, 'diameter', product.diaOptions[0]);
            }
            handleFinalRxUpdate(activeEye, 'modality', product.modality);
            setIsInventoryOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * K-Range Visual Bar - Keratometry Range Indicator for Contact Lens Fitting
 *
 * StudioVision Parity: Visual K-range bar showing corneal curvature zones
 */
export function KRangeVisualBar({ keratometry, eye = 'OD', showRecommendations = true }) {
  if (!keratometry?.[eye]) {
    return (
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Pas de données kératométriques pour {eye}
        </p>
      </div>
    );
  }

  const kData = keratometry[eye];
  const flatK = kData.flatK || kData.k1;
  const steepK = kData.steepK || kData.k2;
  const avgK = (flatK + steepK) / 2;
  const astigmatism = Math.abs(steepK - flatK);

  // Calculate position on the range (0-100%)
  const getPosition = (k) => {
    const clamped = Math.max(K_RANGE_CONFIG.min, Math.min(K_RANGE_CONFIG.max, k));
    return ((clamped - K_RANGE_CONFIG.min) / (K_RANGE_CONFIG.max - K_RANGE_CONFIG.min)) * 100;
  };

  const flatKPos = getPosition(flatK);
  const steepKPos = getPosition(steepK);
  const avgKPos = getPosition(avgK);

  // Get zone for average K
  const getZone = (k) => {
    if (k < K_RANGE_CONFIG.flatZone.max) return K_RANGE_CONFIG.flatZone;
    if (k < K_RANGE_CONFIG.normalZone.max) return K_RANGE_CONFIG.normalZone;
    if (k < K_RANGE_CONFIG.steepZone.max) return K_RANGE_CONFIG.steepZone;
    return K_RANGE_CONFIG.verySteepZone;
  };

  const currentZone = getZone(avgK);
  const recommendations = getRecommendedBC(avgK);

  return (
    <div className={`p-3 rounded-md border ${eye === 'OD' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h5 className={`font-bold text-sm ${eye === 'OD' ? 'text-green-700' : 'text-blue-700'}`}>
          Kératométrie {eye} - {eye === 'OD' ? 'Droit' : 'Gauche'}
        </h5>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          currentZone.color.replace('bg-', 'bg-').replace('-400', '-100')
        } ${currentZone.color.replace('bg-', 'text-').replace('-400', '-800')}`}>
          {currentZone.label}
        </span>
      </div>

      {/* K Values Display */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="text-center p-2 bg-white rounded border">
          <span className="text-gray-500 block">K Plat</span>
          <span className="font-bold text-lg">{flatK?.toFixed(2)}</span>
          <span className="text-gray-400 block">D</span>
        </div>
        <div className="text-center p-2 bg-white rounded border">
          <span className="text-gray-500 block">K Cambré</span>
          <span className="font-bold text-lg">{steepK?.toFixed(2)}</span>
          <span className="text-gray-400 block">D</span>
        </div>
        <div className="text-center p-2 bg-white rounded border border-purple-300">
          <span className="text-purple-600 block">K Moyen</span>
          <span className="font-bold text-lg text-purple-700">{avgK?.toFixed(2)}</span>
          <span className="text-gray-400 block">D</span>
        </div>
      </div>

      {/* Visual Range Bar */}
      <div className="relative mb-3">
        {/* Zone labels */}
        <div className="flex text-xs mb-1">
          <div className="flex-1 text-blue-600 text-center">Plat</div>
          <div className="flex-[2] text-green-600 text-center">Normal</div>
          <div className="flex-1 text-orange-600 text-center">Cambré</div>
          <div className="flex-1 text-red-600 text-center">Très cambré</div>
        </div>

        {/* Bar */}
        <div className="relative h-6 rounded-full overflow-hidden flex">
          <div className="flex-1 bg-blue-300" style={{ flex: '20%' }} />
          <div className="flex-[2] bg-green-300" style={{ flex: '40%' }} />
          <div className="flex-1 bg-orange-300" style={{ flex: '20%' }} />
          <div className="flex-1 bg-red-300" style={{ flex: '20%' }} />
        </div>

        {/* Markers */}
        <div className="absolute top-6 left-0 right-0 h-6" style={{ pointerEvents: 'none' }}>
          {/* Flat K marker */}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${flatKPos}%` }}
          >
            <div className="w-0.5 h-2 bg-blue-600" />
            <span className="text-[10px] font-bold text-blue-600">K1</span>
          </div>

          {/* Steep K marker */}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${steepKPos}%` }}
          >
            <div className="w-0.5 h-2 bg-orange-600" />
            <span className="text-[10px] font-bold text-orange-600">K2</span>
          </div>

          {/* Average K marker */}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${avgKPos}%` }}
          >
            <div className="w-1 h-3 bg-purple-600 rounded" />
            <span className="text-[10px] font-bold text-purple-600">Moy</span>
          </div>
        </div>

        {/* Scale */}
        <div className="flex justify-between text-[10px] text-gray-400 mt-4">
          <span>40D</span>
          <span>42D</span>
          <span>44D</span>
          <span>46D</span>
          <span>48D</span>
          <span>50D</span>
        </div>
      </div>

      {/* Astigmatism Alert */}
      {astigmatism > 1.5 && (
        <div className="flex items-center gap-2 p-2 mb-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <span className="text-yellow-800">
            Astigmatisme cornéen: <strong>{astigmatism.toFixed(2)} D</strong>
            {astigmatism > 2.5 && ' - Lentilles toriques recommandées'}
          </span>
        </div>
      )}

      {/* BC Recommendations */}
      {showRecommendations && recommendations && (
        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
          <h6 className="text-xs font-bold text-gray-700 mb-2">Rayons de base recommandés</h6>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Lentilles souples:</span>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                  Plat: {recommendations.soft.flat}
                </span>
                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded">
                  Cambré: {recommendations.soft.steep}
                </span>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Lentilles rigides:</span>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded">
                  Sur K: {recommendations.rgp.onK}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact K-Range summary for headers/badges
 */
export function KRangeBadge({ keratometry, eye = 'OD' }) {
  if (!keratometry?.[eye]) return null;

  const kData = keratometry[eye];
  const flatK = kData.flatK || kData.k1;
  const steepK = kData.steepK || kData.k2;
  const avgK = (flatK + steepK) / 2;

  const getZoneColor = (k) => {
    if (k < 42.0) return 'bg-blue-100 text-blue-800';
    if (k < 46.0) return 'bg-green-100 text-green-800';
    if (k < 48.0) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getZoneColor(avgK)}`}>
      {eye}: K̄={avgK.toFixed(1)}D
    </span>
  );
}

/**
 * Product Picker Modal - StudioVision Lab/Product Database
 */
function ProductPickerModal({ isOpen, onClose, lensType, onSelectProduct }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLab, setSelectedLab] = useState('all');
  const [selectedModality, setSelectedModality] = useState('all');

  // Filter products based on lens type, lab, modality, and search
  const filteredProducts = useMemo(() => {
    return CONTACT_LENS_PRODUCTS.filter(product => {
      // Filter by lens type
      if (lensType && product.type !== lensType) return false;

      // Filter by lab
      if (selectedLab !== 'all' && product.lab !== selectedLab) return false;

      // Filter by modality
      if (selectedModality !== 'all' && product.modality !== selectedModality) return false;

      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const lab = CONTACT_LENS_LABS.find(l => l.id === product.lab);
        return (
          product.name.toLowerCase().includes(term) ||
          product.material?.toLowerCase().includes(term) ||
          lab?.name.toLowerCase().includes(term) ||
          lab?.shortName.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [lensType, selectedLab, selectedModality, searchTerm]);

  // Group products by lab
  const groupedProducts = useMemo(() => {
    const groups = {};
    filteredProducts.forEach(product => {
      const lab = CONTACT_LENS_LABS.find(l => l.id === product.lab);
      const labName = lab?.name || 'Autre';
      if (!groups[labName]) groups[labName] = [];
      groups[labName].push(product);
    });
    return groups;
  }, [filteredProducts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-purple-50">
          <div>
            <h3 className="text-lg font-bold text-purple-800">Base de Données Lentilles</h3>
            <p className="text-sm text-purple-600">Contact Lens Product Database</p>
          </div>
          <button
            className="p-2 hover:bg-purple-100 rounded-full"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, matériau ou fabricant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Filter row */}
          <div className="flex gap-4 flex-wrap">
            {/* Lab filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Laboratoire:</label>
              <select
                value={selectedLab}
                onChange={(e) => setSelectedLab(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Tous</option>
                {CONTACT_LENS_LABS.map(lab => (
                  <option key={lab.id} value={lab.id}>{lab.shortName}</option>
                ))}
              </select>
            </div>

            {/* Modality filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Modalité:</label>
              <select
                value={selectedModality}
                onChange={(e) => setSelectedModality(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Toutes</option>
                {MODALITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Results count */}
            <div className="flex-1 text-right text-sm text-gray-500">
              {filteredProducts.length} produit(s) trouvé(s)
            </div>
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.keys(groupedProducts).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucun produit trouvé pour ces critères</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedProducts).map(([labName, products]) => (
                <div key={labName}>
                  <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    {labName}
                    <span className="text-xs font-normal text-gray-500">({products.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {products.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={() => onSelectProduct(product)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Product Card for picker modal
 */
function ProductCard({ product, onSelect }) {
  const lab = CONTACT_LENS_LABS.find(l => l.id === product.lab);
  const modalityLabel = MODALITY_OPTIONS.find(m => m.value === product.modality)?.label;

  return (
    <button
      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition group"
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h5 className="font-bold text-gray-800 group-hover:text-purple-700">{product.name}</h5>
          <p className="text-xs text-gray-500">{lab?.name}</p>
        </div>
        {product.featured && (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
            Populaire
          </span>
        )}
      </div>

      {/* Product specs */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <div>
          <span className="text-gray-500">Matériau:</span>
          <span className="ml-1 font-medium">{product.material || '-'}</span>
        </div>
        <div>
          <span className="text-gray-500">Eau:</span>
          <span className="ml-1 font-medium">{product.waterContent}%</span>
        </div>
        <div>
          <span className="text-gray-500">DK/t:</span>
          <span className="ml-1 font-medium">{product.dkT}</span>
        </div>
      </div>

      {/* Parameters */}
      <div className="flex flex-wrap gap-1">
        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
          {modalityLabel}
        </span>
        {product.bcOptions && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
            BC: {product.bcOptions.join(' / ')}
          </span>
        )}
        {product.diaOptions && (
          <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded">
            Ø: {product.diaOptions.join(' / ')}
          </span>
        )}
        {product.uvBlocking && (
          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded">
            UV
          </span>
        )}
        {product.customizable && (
          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded">
            Sur mesure
          </span>
        )}
      </div>

      {/* Power range */}
      <div className="mt-2 text-xs text-gray-500">
        Puissance: {product.powerRange.min.toFixed(2)} à {product.powerRange.max > 0 ? '+' : ''}{product.powerRange.max.toFixed(2)} D
      </div>
    </button>
  );
}

/**
 * Assessment summary for compact display
 */
export function AssessmentSummary({ assessment }) {
  if (!assessment) return null;

  const hasOD = assessment.OD?.centration;
  const hasOS = assessment.OS?.centration;

  const getColorScheme = (eyeAssessment) => {
    if (!eyeAssessment) return 'gray';
    if (eyeAssessment.centration === 'centered' &&
        eyeAssessment.movement === 'optimal' &&
        eyeAssessment.coverage === 'full') {
      return 'green';
    }
    if (eyeAssessment.movement === 'tight' || eyeAssessment.coverage === 'inadequate') {
      return 'red';
    }
    return 'orange';
  };

  const getLabel = (eyeAssessment) => {
    if (!eyeAssessment) return '-';
    const parts = [];
    if (eyeAssessment.centration === 'centered') parts.push('C');
    if (eyeAssessment.movement === 'optimal') parts.push('M');
    if (eyeAssessment.coverage === 'full') parts.push('V');
    return parts.length ? parts.join('') : 'En cours';
  };

  return (
    <div className="flex items-center gap-2">
      {hasOD && (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${BADGE_COLORS[getColorScheme(assessment.OD)]}`}>
          OD: {getLabel(assessment.OD)}
        </span>
      )}
      {hasOS && (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${BADGE_COLORS[getColorScheme(assessment.OS)]}`}>
          OS: {getLabel(assessment.OS)}
        </span>
      )}
    </div>
  );
}
