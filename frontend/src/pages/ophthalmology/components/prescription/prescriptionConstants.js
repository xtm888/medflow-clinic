/**
 * Prescription Constants
 *
 * Centralized constants and data definitions for the prescription step.
 */

// Lens types from StudioVision/Fermer style
export const LENS_TYPES = [
  { value: 'far', label: 'Loin', description: 'Vision de loin uniquement' },
  { value: 'near', label: 'Près', description: 'Vision de près uniquement' },
  { value: 'two_pairs', label: 'Deux Paires', description: 'Loin + Près séparés' },
  { value: 'progressive', label: 'Progressif', description: 'Vision progressive' },
  { value: 'bifocal', label: 'Bifocaux', description: 'Double foyer' },
  { value: 'varifocal', label: 'Varifocal', description: 'Multifocal' }
];

// Extended prescription options - Fermer style
export const USAGE_TYPES = [
  { value: 'constant', label: 'Port Constant', description: 'À porter en permanence' },
  { value: 'intermittent', label: 'Port Intermittent', description: 'À porter selon les besoins' },
  { value: 'distance', label: 'Vision de Loin', description: 'Pour voir de loin uniquement' },
  { value: 'near', label: 'Vision de Près', description: 'Pour voir de près uniquement' },
  { value: 'driving', label: 'Conduite', description: 'Spécialement pour la conduite' },
  { value: 'computer', label: 'Travail sur Écran', description: 'Pour ordinateur/tablette' }
];

export const ACTIVITY_USES = [
  { value: 'school', label: 'Pour École', icon: '📚' },
  { value: 'tv', label: 'Pour TV', icon: '📺' },
  { value: 'homework', label: 'Pour Devoirs', icon: '✏️' },
  { value: 'computer', label: 'Pour Écran', icon: '💻' },
  { value: 'driving', label: 'Pour Conduite', icon: '🚗' },
  { value: 'sports', label: 'Pour Sport', icon: '⚽' },
  { value: 'reading', label: 'Pour Lecture', icon: '📖' },
  { value: 'all_day', label: 'Toute la Journée', icon: '☀️' }
];

export const LENS_MATERIALS = [
  { value: 'organic', label: 'Verres Organiques', description: 'Légers et résistants aux chocs' },
  { value: 'mineral', label: 'Verres Minéraux', description: 'Résistants aux rayures' },
  { value: 'polycarbonate', label: 'Polycarbonate', description: 'Ultra-résistant aux impacts' },
  { value: 'trivex', label: 'Trivex', description: 'Léger avec haute qualité optique' }
];

export const LENS_FEATURES = [
  { value: 'photochromic', label: 'Photochromiques', description: 'S\'assombrissent au soleil' },
  { value: 'tinted', label: 'Teintés', description: 'Couleur permanente' },
  { value: 'polarized', label: 'Polarisés', description: 'Réduction des reflets' },
  { value: 'blue_filter', label: 'Filtre Lumière Bleue', description: 'Protection écrans' },
  { value: 'anti_reflective', label: 'Anti-Reflet', description: 'Réduction des reflets' },
  { value: 'anti_scratch', label: 'Anti-Rayures', description: 'Protection surface' },
  { value: 'hydrophobic', label: 'Hydrophobe', description: 'Anti-gouttes et anti-traces' },
  { value: 'thin', label: 'Aminci', description: 'Verres plus fins et esthétiques' }
];

export const LENS_INDEX = [
  { value: '1.5', label: 'Indice 1.5', description: 'Standard' },
  { value: '1.56', label: 'Indice 1.56', description: 'Aminci léger' },
  { value: '1.6', label: 'Indice 1.6', description: 'Aminci' },
  { value: '1.67', label: 'Indice 1.67', description: 'Très aminci' },
  { value: '1.74', label: 'Indice 1.74', description: 'Ultra aminci' }
];

export const PRESCRIPTION_TEMPLATES = [
  {
    id: 'standard',
    label: 'Standard',
    text: 'Port permanent recommandé. Contrôle à 1 an.'
  },
  {
    id: 'first_time',
    label: 'Première Prescription',
    text: 'Première correction optique. Port progressif conseillé les premiers jours. Contrôle à 3 mois pour vérifier l\'adaptation.'
  },
  {
    id: 'progressive_adaptation',
    label: 'Adaptation Progressifs',
    text: 'Verres progressifs. Période d\'adaptation de 2-3 semaines normale. Bouger la tête plutôt que les yeux pour la vision périphérique.'
  },
  {
    id: 'child',
    label: 'Enfant',
    text: 'Port permanent obligatoire, y compris à l\'école. Prévoir monture solide avec branches flexibles. Contrôle tous les 6 mois.'
  },
  {
    id: 'computer',
    label: 'Travail sur Écran',
    text: 'Verres spécial écran recommandés. Faire des pauses régulières (règle 20-20-20). Traitement anti-lumière bleue conseillé.'
  },
  {
    id: 'driving',
    label: 'Conduite',
    text: 'Port obligatoire pour la conduite. Traitement antireflet recommandé. Éviter les verres photochromiques pour conduite de nuit.'
  }
];

// Prescription status options
export const PRESCRIPTION_STATUSES = [
  { value: 'pending', label: 'En attente', color: 'gray' },
  { value: 'prescribed', label: 'Verres Prescrits', color: 'green' },
  { value: 'not_prescribed', label: 'Verres non Prescrits', color: 'red' },
  { value: 'external', label: 'Externe...', color: 'purple' },
  { value: 'renewed', label: 'Renouvellement', color: 'blue' }
];

// Default values for prescription data initialization
export const DEFAULT_SUBJECTIVE = {
  OD: { sphere: 0, cylinder: 0, axis: 0, va: '' },
  OS: { sphere: 0, cylinder: 0, axis: 0, va: '' },
  add: 0,
  binocular: { balanced: false }
};

export const DEFAULT_PUPIL_DISTANCE = {
  binocular: 63,
  OD: 31.5,
  OS: 31.5
};
