/**
 * ConsultationDashboard Constants
 *
 * Configuration, options, and helper functions for ophthalmology consultation.
 */

// Common symptom suggestions for ophthalmology
export const SYMPTOM_SUGGESTIONS = [
  'Baisse de vision', 'Vision floue', 'Douleur oculaire', 'Rougeur',
  'Larmoiement', 'Photophobie', 'Corps flottants', 'Halos lumineux',
  'Diplopie', 'Prurit', 'Sécheresse', 'Contrôle glaucome',
  'Contrôle diabète', 'Renouvellement lunettes'
];

// Duration quick picks
export const DURATION_OPTIONS = [
  { label: 'Aujourd\'hui', value: '1 jour' },
  { label: '2-3 jours', value: '2-3 jours' },
  { label: '1 semaine', value: '1 semaine' },
  { label: '2-4 sem.', value: '2-4 semaines' },
  { label: '1-3 mois', value: '1-3 mois' },
  { label: '> 3 mois', value: 'Plus de 3 mois' },
  { label: 'Chronique', value: 'Chronique' }
];

// Laterality options
export const LATERALITY_OPTIONS = ['OD', 'OS', 'OU'];

// Ophthalmic route configuration
export const OPHTHALMIC_CATEGORIES = [
  'Collyres', 'Anti-inflammatoires', 'Antibiotiques',
  'Larmes artificielles', 'Anti-glaucomateux', 'Mydriatiques'
];

export const OPHTHALMIC_ROUTES = [
  'ophthalmic', 'intravitreal', 'subconjunctival', 'periocular', 'intracameral'
];

// Categories that may need tapering (corticosteroids)
export const TAPERING_CATEGORIES = ['Anti-inflammatoires', 'Corticostéroïdes', 'Stéroïdes'];

// Pre-built tapering templates
export const TAPERING_TEMPLATES = [
  {
    id: 'none',
    name: 'Sans dégression',
    schedule: null
  },
  {
    id: 'rapid_7d',
    name: 'Rapide (7 jours)',
    schedule: [
      { days: '1-3', frequency: '4x/jour' },
      { days: '4-5', frequency: '3x/jour' },
      { days: '6-7', frequency: '2x/jour' },
    ]
  },
  {
    id: 'standard_14d',
    name: 'Standard (14 jours)',
    schedule: [
      { days: '1-4', frequency: '4x/jour' },
      { days: '5-8', frequency: '3x/jour' },
      { days: '9-11', frequency: '2x/jour' },
      { days: '12-14', frequency: '1x/jour' },
    ]
  },
  {
    id: 'slow_21d',
    name: 'Progressif (21 jours)',
    schedule: [
      { days: '1-7', frequency: '4x/jour' },
      { days: '8-14', frequency: '3x/jour' },
      { days: '15-18', frequency: '2x/jour' },
      { days: '19-21', frequency: '1x/jour' },
    ]
  },
  {
    id: 'post_surgery',
    name: 'Post-opératoire (28 jours)',
    schedule: [
      { days: '1-7', frequency: '6x/jour' },
      { days: '8-14', frequency: '4x/jour' },
      { days: '15-21', frequency: '3x/jour' },
      { days: '22-28', frequency: '2x/jour' },
    ]
  },
];

// All medication routes with labels
export const MEDICATION_ROUTES = [
  { value: 'oral', label: 'Oral', labelFr: 'Voie orale' },
  { value: 'ophthalmic', label: 'Ophthalmic', labelFr: 'Collyre' },
  { value: 'topical', label: 'Topical', labelFr: 'Topique' },
  { value: 'intramuscular', label: 'IM', labelFr: 'Intramusculaire' },
  { value: 'intravenous', label: 'IV', labelFr: 'Intraveineuse' },
  { value: 'subcutaneous', label: 'SC', labelFr: 'Sous-cutanée' },
  { value: 'sublingual', label: 'Sublingual', labelFr: 'Sublinguale' },
  { value: 'intranasal', label: 'Nasal', labelFr: 'Intranasale' },
  { value: 'inhalation', label: 'Inhalation', labelFr: 'Inhalation' },
  { value: 'rectal', label: 'Rectal', labelFr: 'Rectale' },
  { value: 'intravitreal', label: 'Intravitreal', labelFr: 'Intravitréenne' },
  { value: 'subconjunctival', label: 'Subconj', labelFr: 'Sous-conjonctivale' },
  { value: 'periocular', label: 'Periocular', labelFr: 'Périoculaire' },
];

// Sphere options for glasses prescription
export const generateSphereOptions = () => {
  const options = [];
  for (let i = -20; i <= 20; i += 0.25) {
    options.push(i.toFixed(2));
  }
  return options;
};

// Cylinder options for glasses prescription
export const generateCylinderOptions = () => {
  const options = [];
  for (let i = -10; i <= 0; i += 0.25) {
    options.push(i.toFixed(2));
  }
  return options;
};

// Addition options
export const ADDITION_OPTIONS = [
  '+0.75', '+1.00', '+1.25', '+1.50', '+1.75',
  '+2.00', '+2.25', '+2.50', '+2.75', '+3.00'
];

// Default consultation data structure
export const getDefaultData = () => ({
  complaint: { motif: '', duration: '', laterality: '' },
  vitals: {},
  refraction: {},
  examination: {},
  diagnostic: { diagnoses: [], procedures: [], surgery: [], laboratory: [] },
  prescription: {
    type: 'glasses',
    glasses: { OD: {}, OS: {}, pd: {} },
    medications: [],
    recommendations: ''
  }
});

// Default expanded sections state
export const DEFAULT_EXPANDED_SECTIONS = {
  vitals: false,
  refraction: true,
  examination: true,
  diagnostic: true,
  prescription: true
};

// Helper: Calculate age from date of birth
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper: Format time relative to now
export const formatTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// Helper: Validate consultation data
export const validateData = (data) => {
  const errors = [];
  if (!data.complaint?.motif) {
    errors.push('- Motif de consultation requis');
  }
  return errors;
};

// Helper: Format refraction for display
export const formatRefraction = (data, eye) => {
  const r = data.refraction?.subjective?.[eye];
  if (!r?.sphere) return '--';
  return `${r.sphere > 0 ? '+' : ''}${r.sphere} ${r.cylinder || ''} x ${r.axis || ''}°`;
};

// Helper: Get route label in French
export const getRouteLabel = (routeValue) => {
  const route = MEDICATION_ROUTES.find(r => r.value === routeValue);
  return route ? route.labelFr : routeValue;
};
