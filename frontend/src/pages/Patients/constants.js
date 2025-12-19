/**
 * Patients Page Constants
 */

// Priority filter options
export const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Tous les patients' },
  { value: 'VIP', label: 'VIP' },
  { value: 'PREGNANT', label: 'Femmes enceintes' },
  { value: 'ELDERLY', label: 'Personnes agees' }
];

// Sort options
export const SORT_OPTIONS = [
  { value: 'name', label: 'Trier par nom' },
  { value: 'lastVisit', label: 'Derniere visite' },
  { value: 'nextAppointment', label: 'Prochain RDV' }
];

// Search type options
export const SEARCH_TYPE_OPTIONS = [
  { value: 'all', label: 'Tous les champs' },
  { value: 'name', label: 'Nom' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'patientId', label: 'ID Patient' },
  { value: 'legacyId', label: 'ID Legacy / Dossier' }
];

// Blood type options
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Default advanced filters
export const DEFAULT_ADVANCED_FILTERS = {
  ageMin: '',
  ageMax: '',
  gender: '',
  bloodType: '',
  insurance: '',
  lastVisitFrom: '',
  lastVisitTo: '',
  hasAllergies: ''
};

// Advanced filter keys (for URL param detection)
export const ADVANCED_FILTER_KEYS = [
  'ageMin', 'ageMax', 'gender', 'bloodType',
  'insurance', 'lastVisitFrom', 'lastVisitTo', 'hasAllergies'
];

// Keyboard shortcuts configuration
export const KEYBOARD_SHORTCUTS = [
  { category: 'Actions Patients', shortcuts: [
    { key: 'N', action: 'Nouveau patient' },
    { key: '/', action: 'Rechercher' },
    { key: 'F', action: 'Filtres avancés' },
    { key: 'R', action: 'Rafraîchir' },
    { key: 'D', action: 'Détecter doublons' }
  ]},
  { category: 'Accès Rapide', shortcuts: [
    { key: '1', action: 'Ouvrir patient #1' },
    { key: '2', action: 'Ouvrir patient #2' },
    { key: '3', action: 'Ouvrir patient #3' }
  ]},
  { category: 'Interface', shortcuts: [
    { key: 'Esc', action: 'Fermer modal' },
    { key: '?', action: 'Afficher cette aide' }
  ]}
];

// Pagination defaults
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
};

// Helper functions
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 'N/A';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const getGenderDisplay = (gender) => {
  if (!gender) return 'N/A';
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'Homme';
  if (g === 'female' || g === 'f') return 'Femme';
  return gender;
};

export const getPriorityDisplay = (priority) => {
  const displays = {
    'vip': { label: 'VIP', className: 'bg-purple-100 text-purple-800' },
    'pregnant': { label: 'Enceinte', className: 'bg-pink-100 text-pink-800' },
    'elderly': { label: 'Age', className: 'bg-blue-100 text-blue-800' },
    'normal': { label: 'Normal', className: 'bg-gray-100 text-gray-800' }
  };
  return displays[priority?.toLowerCase()] || displays.normal;
};
