// Orthoptic Examination Reference Data
// Based on the extracted data from Care Vision document

export const visualAcuityScales = {
  dixiemes: [
    '1/10', '2/10', '3/10', '4/10', '5/10',
    '6/10', '7/10', '8/10', '9/10', '10/10'
  ],
  vingtiemes: ['1/20'],
  parinaud: [
    'N° 1.5', 'N° 2', 'N° 3', 'N° 4', 'N° 5',
    'N° 6', 'N° 8', 'N° 10', 'N° 14', 'N° 20'
  ],
  pediatric: {
    tests: ['nombres', 'dessins_rossano', 'cadet', 'lea_symbols', 'allen_pictures'],
    values: ['CLD', 'P', 'M']
  }
};

export const motilityLevels = [
  'Normal',
  '++',
  '+++',
  'Abaissement',
  'Abduction',
  'Adduction',
  'Élévation',
  'Hyperaction',
  'Limitation',
  'Paralysie',
  'Parésie',
  'Sous action'
];

export const extraocularMuscles = {
  OD: [
    { id: 'droitExterne', label: 'Droit Externe' },
    { id: 'droitInterne', label: 'Droit Interne' },
    { id: 'droitSuperieur', label: 'Droit Supérieur' },
    { id: 'droitInferieur', label: 'Droit Inférieur' },
    { id: 'grandOblique', label: 'Grand Oblique' },
    { id: 'petitOblique', label: 'Petit Oblique' }
  ],
  OS: [
    { id: 'droitExterne', label: 'Droit Externe' },
    { id: 'droitInterne', label: 'Droit Interne' },
    { id: 'droitSuperieur', label: 'Droit Supérieur' },
    { id: 'droitInferieur', label: 'Droit Inférieur' },
    { id: 'grandOblique', label: 'Grand Oblique' },
    { id: 'petitOblique', label: 'Petit Oblique' }
  ]
};

export const specialSyndromes = [
  'Duane',
  'Brown',
  'Pattern A',
  'Pattern V',
  'Pattern X',
  'DVD',
  'Nystagmus'
];

export const wirtTestCircles = [
  '40', '50', '60', '80', '100',
  '140', '200', '400', '800'
];

export const langTestLevels = ['550', '600', '1200'];

export const coverTestDeviations = [
  'E',    // Esophoria
  "E'",   // Esophoria variable
  'Et',   // Esotropia
  'HD',   // Hyperphoria Droite (Right hyperphoria)
  'HG',   // Hyperphoria Gauche (Left hyperphoria)
  'X',    // Exophoria
  "X'",   // Exophoria variable
  'Xt',   // Exotropia
  'Orthophorie'
];

export const worthTestResults = [
  'fusion',
  'diplopie_croisee',
  'diplopie_homonyme',
  'neutralisation_OD',
  'neutralisation_OS',
  'suppression_alternante'
];

export const bagoliniResults = [
  'fusion',
  'croisement',
  'neutralisation_OD',
  'neutralisation_OS'
];

export const retinalCorrespondence = [
  'CRN',  // Correspondance Rétinienne Normale
  'CRA',  // Correspondance Rétinienne Anormale
  'CRA_harmonieuse',
  'CRA_dysharmonieuse'
];

export const convergenceQuality = ['bon', 'moyen', 'faible', 'nul'];

export const convergenceEase = ['facile', 'moyen', 'difficile', 'impossible'];

export const fusionQuality = ['good', 'medium', 'poor', 'absent'];

export const stereopsisQuality = ['excellent', 'good', 'fair', 'poor', 'absent'];

export const synoptophoreResults = ['normal', 'suppression_OD', 'suppression_OS', 'alternating_suppression'];

export const stabilityLevels = ['stable', 'unstable', 'very_unstable'];

export const functionalSigns = [
  { id: 'cephalees', label: 'Céphalées (Headaches)' },
  { id: 'diplopie', label: 'Diplopie (Double vision)' },
  { id: 'fatigue', label: 'Fatigue visuelle' },
  { id: 'brulures', label: 'Brûlures oculaires' },
  { id: 'flou', label: 'Vision floue' },
  { id: 'photophobie', label: 'Photophobie' },
  { id: 'douleurOculaire', label: 'Douleur oculaire' },
  { id: 'vertiges', label: 'Vertiges' },
  { id: 'nausees', label: 'Nausées' },
  { id: 'asthenopie', label: 'Asthénopie' }
];

export const treatmentTypes = [
  { value: 'reeducation_orthoptique', label: 'Rééducation orthoptique' },
  { value: 'barre_lecture', label: 'Barre de lecture' },
  { value: 'diploscope', label: 'Diploscope' },
  { value: 'synoptophore', label: 'Synoptophore' },
  { value: 'exercices_domicile', label: 'Exercices à domicile' },
  { value: 'prismes', label: 'Prismes' },
  { value: 'occlusion', label: 'Occlusion' },
  { value: 'combined', label: 'Traitement combiné' }
];

export const treatmentPlans = [
  { value: '6_sessions', label: '6 séances' },
  { value: '12_sessions', label: '12 séances' },
  { value: '20_sessions', label: '20 séances' },
  { value: 'ongoing', label: 'Continu' },
  { value: 'custom', label: 'Personnalisé' }
];

export const occlusionEyes = [
  { value: 'OD', label: 'Œil Droit (OD)' },
  { value: 'OS', label: 'Œil Gauche (OS)' },
  { value: 'alternating', label: 'Alternée' }
];

export const prismBases = [
  { value: 'in', label: 'Base Interne' },
  { value: 'out', label: 'Base Externe' },
  { value: 'up', label: 'Base Supérieure' },
  { value: 'down', label: 'Base Inférieure' }
];

export const diagnosisConclusionTypes = [
  { value: 'Phorie décompensée VL', label: 'Phorie décompensée Vision de Loin' },
  { value: 'Phorie décompensée VP', label: 'Phorie décompensée Vision de Près' },
  { value: 'Phorie compensée', label: 'Phorie compensée' },
  { value: 'Tropie', label: 'Tropie' },
  { value: 'Micro tropie', label: 'Micro tropie' },
  { value: 'Paralysie', label: 'Paralysie' },
  { value: 'Parésie', label: 'Parésie' },
  { value: 'Insuffisance de convergence', label: 'Insuffisance de convergence' },
  { value: 'Excès de convergence', label: 'Excès de convergence' },
  { value: 'Insuffisance de divergence', label: 'Insuffisance de divergence' },
  { value: 'Excès de divergence', label: 'Excès de divergence' },
  { value: 'Custom', label: 'Personnalisé' }
];

export const salutations = [
  {
    value: 'Veuillez agréer, Cher confrère, l\'expression de mes salutations distinguées',
    label: 'Salutations distinguées'
  },
  {
    value: 'Recevez, Cher confrère, mes salutations les meilleures',
    label: 'Salutations les meilleures'
  },
  {
    value: 'Avec mes remerciements, recevez mes salutations confraternelles',
    label: 'Salutations confraternelles'
  },
  {
    value: 'Custom',
    label: 'Personnalisé'
  }
];

export const examTypes = [
  { value: 'initial', label: 'Initial' },
  { value: 'follow-up', label: 'Suivi' },
  { value: 'pre-treatment', label: 'Pré-traitement' },
  { value: 'post-treatment', label: 'Post-traitement' },
  { value: 'maintenance', label: 'Entretien' }
];

export const examStatuses = [
  { value: 'in-progress', label: 'En cours', color: 'yellow' },
  { value: 'completed', label: 'Terminé', color: 'blue' },
  { value: 'reviewed', label: 'Révisé', color: 'purple' },
  { value: 'signed', label: 'Signé', color: 'green' }
];

export const progressLevels = [
  { value: 'significant', label: 'Significatif' },
  { value: 'moderate', label: 'Modéré' },
  { value: 'slight', label: 'Léger' },
  { value: 'none', label: 'Aucun' },
  { value: 'worse', label: 'Aggravation' }
];

export const severityLevels = [
  { value: 'mild', label: 'Léger' },
  { value: 'moderate', label: 'Modéré' },
  { value: 'severe', label: 'Sévère' }
];

// Helper functions
export const formatVisualAcuity = (value, scale) => {
  if (!value) return '-';
  return `${value} (${scale})`;
};

export const getDeviationLabel = (deviation) => {
  const labels = {
    'E': 'Ésophorie',
    "E'": 'Ésophorie variable',
    'Et': 'Ésotropie',
    'HD': 'Hyperphorie Droite',
    'HG': 'Hyperphorie Gauche',
    'X': 'Exophorie',
    "X'": 'Exophorie variable',
    'Xt': 'Exotropie',
    'Orthophorie': 'Orthophorie'
  };
  return labels[deviation] || deviation;
};

export const getConclusionLabel = (type) => {
  const item = diagnosisConclusionTypes.find(d => d.value === type);
  return item ? item.label : type;
};

export const getProgressColor = (level) => {
  const colors = {
    'significant': 'text-green-600',
    'moderate': 'text-blue-600',
    'slight': 'text-yellow-600',
    'none': 'text-gray-600',
    'worse': 'text-red-600'
  };
  return colors[level] || 'text-gray-600';
};

export default {
  visualAcuityScales,
  motilityLevels,
  extraocularMuscles,
  specialSyndromes,
  wirtTestCircles,
  langTestLevels,
  coverTestDeviations,
  worthTestResults,
  bagoliniResults,
  retinalCorrespondence,
  convergenceQuality,
  convergenceEase,
  fusionQuality,
  stereopsisQuality,
  synoptophoreResults,
  stabilityLevels,
  functionalSigns,
  treatmentTypes,
  treatmentPlans,
  occlusionEyes,
  prismBases,
  diagnosisConclusionTypes,
  salutations,
  examTypes,
  examStatuses,
  progressLevels,
  severityLevels
};
