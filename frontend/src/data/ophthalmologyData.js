// Comprehensive ophthalmic medication database
export const ophthalmicMedications = [
  // Glaucoma Medications
  {
    id: 'oph001',
    name: 'Latanoprost 0.005%',
    brand: 'Xalatan',
    category: 'Prostaglandin Analog',
    form: 'Gouttes Oculaires',
    bottleSize: '2.5ml',
    dosage: '1 goutte OU le soir',
    indication: 'Glaucome, Hypertension Oculaire',
    contraindications: ['Grossesse', 'Uvéite', 'Risque d\'œdème maculaire'],
    storageTemp: '2-8°C avant ouverture, puis température ambiante',
    shelfLifeOpened: '6 semaines',
    price: 45.00,
    minStock: 10,
    currentStock: 25,
    batches: [
      { lot: 'XAL2024A', quantity: 15, expiry: '2025-12-31' },
      { lot: 'XAL2024B', quantity: 10, expiry: '2025-10-15' }
    ]
  },
  {
    id: 'oph002',
    name: 'Timolol 0.5%',
    brand: 'Timoptic',
    category: 'Bêta-bloquant',
    form: 'Gouttes Oculaires',
    bottleSize: '5ml',
    dosage: '1 goutte OU 2x/jour',
    indication: 'Glaucome',
    contraindications: ['Asthme', 'BPCO', 'Bradycardie', 'Bloc cardiaque'],
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '4 semaines',
    price: 25.00,
    minStock: 15,
    currentStock: 30,
    batches: [
      { lot: 'TIM2024C', quantity: 30, expiry: '2025-11-30' }
    ]
  },

  // Anti-inflammatory
  {
    id: 'oph003',
    name: 'Prednisolone Acétate 1%',
    brand: 'Pred Forte',
    category: 'Corticostéroïde',
    form: 'Suspension Oculaire',
    bottleSize: '10ml',
    dosage: '1 goutte 4x/jour, diminuer progressivement',
    indication: 'Inflammation post-op, Uvéite',
    contraindications: ['Kératite virale', 'Infection fongique', 'Infections bactériennes'],
    warnings: ['Agiter avant usage', 'Surveiller PIO', 'Risque de cataracte si usage prolongé'],
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '4 semaines',
    price: 35.00,
    minStock: 10,
    currentStock: 18,
    batches: [
      { lot: 'PRE2024D', quantity: 18, expiry: '2025-09-30' }
    ]
  },

  // Antibiotics
  {
    id: 'oph004',
    name: 'Moxifloxacine 0.5%',
    brand: 'Vigamox',
    category: 'Antibiotique',
    form: 'Gouttes Oculaires',
    bottleSize: '3ml',
    dosage: '1 goutte 3x/jour x 7 jours',
    indication: 'Conjonctivite bactérienne',
    contraindications: ['Hypersensibilité aux fluoroquinolones'],
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '4 semaines',
    price: 40.00,
    minStock: 20,
    currentStock: 35,
    batches: [
      { lot: 'VIG2024E', quantity: 35, expiry: '2025-08-31' }
    ]
  },

  // Lubricants
  {
    id: 'oph005',
    name: 'Hyaluronate de Sodium 0.1%',
    brand: 'Hylo-Comod',
    category: 'Lubrifiant',
    form: 'Gouttes Oculaires',
    bottleSize: '10ml',
    dosage: '1 goutte au besoin',
    indication: 'Œil Sec',
    contraindications: [],
    preservativeFree: true,
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '6 mois',
    price: 20.00,
    minStock: 30,
    currentStock: 50,
    batches: [
      { lot: 'HYL2024F', quantity: 50, expiry: '2026-01-31' }
    ]
  },

  // Mydriatics
  {
    id: 'oph006',
    name: 'Tropicamide 0.5%',
    brand: 'Mydriaticum',
    category: 'Mydriatique',
    form: 'Gouttes Oculaires',
    bottleSize: '15ml',
    dosage: '1-2 gouttes pour dilatation',
    indication: 'Examen du fond d\'œil',
    contraindications: ['Glaucome à angle fermé'],
    warnings: ['Photophobie temporaire', 'Vision floue 4-6h'],
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '4 semaines',
    price: 15.00,
    minStock: 5,
    currentStock: 12,
    batches: [
      { lot: 'TRO2024G', quantity: 12, expiry: '2025-07-31' }
    ]
  },

  // Anesthetics
  {
    id: 'oph007',
    name: 'Oxybuprocaïne 0.4%',
    brand: 'Cebesine',
    category: 'Anesthésique',
    form: 'Gouttes Oculaires',
    bottleSize: '10ml',
    dosage: '1-2 gouttes avant procédure',
    indication: 'Anesthésie de surface',
    contraindications: ['Allergie aux anesthésiques locaux'],
    warnings: ['Ne pas toucher l\'œil pendant 15 min'],
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '4 semaines',
    price: 18.00,
    minStock: 3,
    currentStock: 8,
    batches: [
      { lot: 'OXY2024H', quantity: 8, expiry: '2025-06-30' }
    ]
  },

  // Combination drugs
  {
    id: 'oph008',
    name: 'Dorzolamide/Timolol',
    brand: 'Cosopt',
    category: 'Combinaison Anti-glaucome',
    form: 'Gouttes Oculaires',
    bottleSize: '5ml',
    dosage: '1 goutte OU 2x/jour',
    indication: 'Glaucome, PIO élevée',
    contraindications: ['Asthme', 'BPCO', 'Insuffisance rénale'],
    storageTemp: 'Température ambiante',
    shelfLifeOpened: '4 semaines',
    price: 55.00,
    minStock: 8,
    currentStock: 15,
    batches: [
      { lot: 'COS2024I', quantity: 15, expiry: '2025-10-31' }
    ]
  }
];

// Spectacle lens options
export const spectacleLensOptions = [
  {
    type: 'Simple Vision',
    materials: [
      { name: 'CR-39', index: 1.50, price: 30, description: 'Verre standard, léger' },
      { name: 'Polycarbonate', index: 1.59, price: 50, description: 'Résistant aux impacts' },
      { name: 'Haut Indice', index: 1.67, price: 80, description: 'Plus mince pour fortes corrections' },
      { name: 'Très Haut Indice', index: 1.74, price: 120, description: 'Ultra-mince' }
    ],
    coatings: [
      { name: 'Anti-Reflet', price: 40, description: 'Réduit les reflets' },
      { name: 'Filtre Lumière Bleue', price: 30, description: 'Protection écrans' },
      { name: 'Photochromique', price: 60, description: 'Verres adaptatifs' },
      { name: 'Polarisé', price: 50, description: 'Réduit l\'éblouissement' },
      { name: 'Anti-Rayure', price: 20, description: 'Protection supplémentaire' }
    ]
  },
  {
    type: 'Progressif',
    materials: [
      { name: 'Progressif Standard', price: 150, description: 'Vision de loin et de près' },
      { name: 'Progressif Premium', price: 250, description: 'Champ de vision élargi' },
      { name: 'Progressif Individualisé', price: 400, description: 'Personnalisé selon vos mesures' }
    ]
  },
  {
    type: 'Bifocal',
    materials: [
      { name: 'Bifocal Standard', price: 80, description: 'Deux zones de vision' },
      { name: 'Bifocal Executive', price: 100, description: 'Segment plus large' }
    ]
  }
];

// Contact lens options
export const contactLensOptions = [
  {
    brand: 'Acuvue Oasys',
    type: 'Bi-mensuel',
    material: 'Hydrogel de Silicone',
    parameters: {
      powers: { min: -12.00, max: 8.00, step: 0.25 },
      baseCurves: [8.4, 8.8],
      diameters: [14.0]
    },
    price: 45.00 // per box of 6
  },
  {
    brand: 'Dailies Total 1',
    type: 'Journalier',
    material: 'Gradient d\'Eau',
    parameters: {
      powers: { min: -12.00, max: 8.00, step: 0.25 },
      baseCurves: [8.5],
      diameters: [14.1]
    },
    price: 35.00 // per box of 30
  },
  {
    brand: 'Air Optix Night & Day',
    type: 'Mensuel',
    material: 'Lotrafilcon A',
    parameters: {
      powers: { min: -10.00, max: 8.00, step: 0.25 },
      baseCurves: [8.4, 8.6],
      diameters: [13.8]
    },
    price: 55.00 // per box of 6
  },
  {
    brand: 'Biofinity Toric',
    type: 'Mensuel',
    material: 'Comfilcon A',
    parameters: {
      powers: { min: -10.00, max: 6.00, step: 0.25 },
      cylinder: { min: -0.75, max: -2.25, step: 0.50 },
      axis: { min: 10, max: 180, step: 10 },
      baseCurves: [8.7],
      diameters: [14.5]
    },
    price: 65.00 // per box of 6
  }
];

// Frame options
export const frameOptions = [
  {
    category: 'Économique',
    frames: [
      { id: 'FR001', name: 'Monture Métal Simple', price: 30, colors: ['Argent', 'Noir', 'Doré'] },
      { id: 'FR002', name: 'Monture Plastique Basique', price: 25, colors: ['Noir', 'Bleu', 'Rouge'] },
      { id: 'FR003', name: 'Monture Enfant Flexible', price: 35, colors: ['Rose', 'Bleu', 'Vert'] }
    ]
  },
  {
    category: 'Standard',
    frames: [
      { id: 'FR004', name: 'Monture Titane', price: 80, colors: ['Gris', 'Noir'] },
      { id: 'FR005', name: 'Monture Acétate Mode', price: 70, colors: ['Écaille', 'Noir', 'Transparent'] },
      { id: 'FR006', name: 'Monture Sport', price: 60, colors: ['Noir/Rouge', 'Bleu/Gris'] }
    ]
  },
  {
    category: 'Premium',
    frames: [
      { id: 'FR007', name: 'Monture Designer', price: 150, brand: 'Ray-Ban', colors: ['Noir', 'Écaille'] },
      { id: 'FR008', name: 'Monture Luxe', price: 200, brand: 'Prada', colors: ['Noir', 'Bordeaux'] },
      { id: 'FR009', name: 'Monture Sans Vis', price: 180, colors: ['Argent', 'Or Rose'] }
    ]
  }
];

// Eye exam data structure
export const eyeExamData = {
  encounterTypes: ['Examen de Réfraction', 'Contrôle', 'Post-Op', 'Urgence Oculaire'],

  visualAcuityFormats: ['Monoyer', 'Snellen', 'LogMAR'],

  // French Monoyer decimal scale (used in France, Belgium, Congo, etc.)
  monoyerValues: [
    'CLD',      // Compte les doigts
    'MDM',      // Mouvement de la main
    '1/20',     // Très basse vision
    '1/10',     // 20/200 Snellen
    '2/10',     // 20/100
    '3/10',     // 20/63
    '4/10',     // 20/50
    '5/10',     // 20/40
    '6/10',     // 20/32
    '7/10',     // 20/28
    '8/10',     // 20/25
    '9/10',     // 20/22
    '10/10',    // 20/20 (normal)
    '12/10',    // 20/16 (above normal)
    '14/10',    // 20/14
    '16/10'     // 20/12.5
  ],

  // Snellen scale (US/UK system)
  snellenValues: [
    '20/400', '20/200', '20/160', '20/125', '20/100', '20/80',
    '20/63', '20/50', '20/40', '20/32', '20/28', '20/25', '20/22',
    '20/20', '20/16', '20/14', '20/12.5', '20/10'
  ],

  // Conversion mapping: Snellen to Monoyer (French decimal)
  snellenToMonoyer: {
    '20/400': '0.5/10',
    '20/200': '1/10',
    '20/160': '1.25/10',
    '20/125': '1.6/10',
    '20/100': '2/10',
    '20/80': '2.5/10',
    '20/63': '3/10',
    '20/50': '4/10',
    '20/40': '5/10',
    '20/32': '6/10',
    '20/28': '7/10',
    '20/25': '8/10',
    '20/22': '9/10',
    '20/20': '10/10',
    '20/16': '12/10',
    '20/14': '14/10',
    '20/12.5': '16/10',
    '20/10': '20/10'
  },

  // Low vision special values
  lowVisionValues: [
    { id: 'cld', label: 'CLD', description: 'Compte Les Doigts' },
    { id: 'mdm', label: 'MDM', description: 'Mouvement De la Main' },
    { id: 'pl', label: 'PL+', description: 'Perception Lumineuse positive' },
    { id: 'pl_neg', label: 'PL-', description: 'Perception Lumineuse négative' },
    { id: 'npl', label: 'NPL', description: 'Non Perception Lumineuse' }
  ],

  // French ophthalmology abbreviations
  abbreviations: {
    OD: 'Œil Droit (oculus dexter)',
    OG: 'Œil Gauche (oculus sinister)',
    ODG: 'Œil Droit et Gauche',
    OU: 'Les deux yeux',
    VL: 'Vision de Loin',
    VP: 'Vision de Près',
    VI: 'Vision Intermédiaire',
    AV: 'Acuité Visuelle',
    SPH: 'Sphère',
    CYL: 'Cylindre',
    AXE: 'Axe',
    ADD: 'Addition (presbytie)',
    TIO: 'Tension Intra-Oculaire',
    FO: 'Fond d\'Œil',
    CV: 'Champ Visuel'
  },

  refractionDevices: [
    { id: 'auto1', name: 'Topcon KR-8900', type: 'Autorefractor' },
    { id: 'auto2', name: 'Nidek AR-1a', type: 'Autorefractor' },
    { id: 'ret1', name: 'Heine Beta 200', type: 'Retinoscope' },
    { id: 'trial', name: 'Lunettes d\'essai', type: 'Manual' }
  ],

  // Complete refraction types from Care Vision mockups
  refractionTypes: [
    { id: 'sans_correction', name: 'Sans correction', category: 'Base' },
    { id: 'ancienne_refraction', name: 'Ancienne réfraction', category: 'Historique' },
    { id: 'lunettes_portees', name: 'Lunettes portées', category: 'Correction actuelle' },
    { id: 'lunettes_loin', name: 'Lunettes portées - De loin', category: 'Correction actuelle' },
    { id: 'lunettes_pres', name: 'Lunettes portées - De près', category: 'Correction actuelle' },
    { id: 'lunettes_progressifs', name: 'Lunettes portées - Progressifs', category: 'Correction actuelle' },
    { id: 'lunettes_bifocaux', name: 'Lunettes portées - Bifocaux', category: 'Correction actuelle' },
    { id: 'lunettes_demi_lune', name: 'Lunettes portées - Demi-lune', category: 'Correction actuelle' },
    { id: 'lunettes_triple_foyers', name: 'Lunettes portées - Triple-foyers', category: 'Correction actuelle' },
    { id: 'lunettes_2_paires', name: 'Lunettes portées - 2 paires', category: 'Correction actuelle' },
    { id: 'lunettes_proximite', name: 'Lunettes portées - Verres de proximité', category: 'Correction actuelle' },
    { id: 'autorefractometre', name: 'Autoréfractomètre', category: 'Mesure objective' },
    { id: 'autorefractometre_cyclo', name: 'Autoréfractomètre sous cyclo', category: 'Mesure objective' },
    { id: 'refraction_subjective', name: 'Réfraction subjective', category: 'Mesure subjective' },
    { id: 'refraction_subjective_cyclo', name: 'Réfraction subjective sous cyclo', category: 'Mesure subjective' },
    { id: 'refraction_subjective_auto', name: 'Réfraction subjective automatique', category: 'Mesure subjective' },
    { id: 'skiascopie', name: 'Skiascopie', category: 'Mesure objective' },
    { id: 'javal', name: 'Javal', category: 'Kératométrie' },
    { id: 'tar', name: 'Tar', category: 'Mesure objective' },
    { id: 'refraction_finale', name: 'Réfraction finale', category: 'Prescription' },
    { id: 'prescription', name: 'Prescription', category: 'Prescription' },
    { id: 'essai_lentille', name: 'Essai Lentille de Contact', category: 'Contactologie' },
    { id: 'sans_type', name: 'Sans Type', category: 'Autre' },
    { id: 'autre', name: 'Autre', category: 'Autre' },
    { id: 'apm_lunettes', name: 'APM Lunettes portées', category: 'Auto-Phoropter' },
    { id: 'apm_autorefractometre', name: 'APM Autoréfractomètre', category: 'Auto-Phoropter' },
    { id: 'apm_subjective', name: 'APM Réfraction subjective', category: 'Auto-Phoropter' },
    { id: 'apm_finale', name: 'APM Réfraction finale', category: 'Auto-Phoropter' },
    { id: 'apm_memoire_5', name: 'APM mémoire 5', category: 'Auto-Phoropter' },
    { id: 'apm_memoire_6', name: 'APM mémoire 6', category: 'Auto-Phoropter' },
    { id: 'apm_memoire_7', name: 'APM mémoire 7', category: 'Auto-Phoropter' }
  ],

  // Refraction type categories for grouping in dropdowns
  refractionTypeCategories: [
    'Base',
    'Historique',
    'Correction actuelle',
    'Mesure objective',
    'Mesure subjective',
    'Kératométrie',
    'Prescription',
    'Contactologie',
    'Auto-Phoropter',
    'Autre'
  ],

  commonDiagnoses: [
    { code: 'H52.1', name: 'Myopie', category: 'Réfraction' },
    { code: 'H52.0', name: 'Hypermétropie', category: 'Réfraction' },
    { code: 'H52.2', name: 'Astigmatisme', category: 'Réfraction' },
    { code: 'H52.4', name: 'Presbytie', category: 'Réfraction' },
    { code: 'H40.1', name: 'Glaucome à angle ouvert', category: 'Glaucome' },
    { code: 'H25.1', name: 'Cataracte sénile', category: 'Cataracte' },
    { code: 'H35.3', name: 'DMLA', category: 'Rétine' },
    { code: 'H36.0', name: 'Rétinopathie diabétique', category: 'Rétine' },
    { code: 'H04.1', name: 'Syndrome de l\'œil sec', category: 'Surface oculaire' },
    { code: 'H10.3', name: 'Conjonctivite', category: 'Infection' }
  ],

  followUpIntervals: {
    'Glaucome': 90,
    'Rétinopathie diabétique': 90,
    'DMLA': 120,
    'Cataracte': 180,
    'Œil sec': 180,
    'Progression myopique': 180,
    'Examen de routine': 365
  }
};

// Ophthalmic services pricing
export const ophthalmologyServices = [
  { code: 'OPH001', name: 'Examen de Réfraction Complet', price: 75.00, duration: 45 },
  { code: 'OPH002', name: 'Tonométrie (Pression Oculaire)', price: 30.00, duration: 15 },
  { code: 'OPH003', name: 'Fond d\'Œil Dilaté', price: 50.00, duration: 20 },
  { code: 'OPH004', name: 'OCT Rétine', price: 120.00, duration: 30 },
  { code: 'OPH005', name: 'OCT Glaucome (RNFL)', price: 100.00, duration: 25 },
  { code: 'OPH006', name: 'Topographie Cornéenne', price: 80.00, duration: 20 },
  { code: 'OPH007', name: 'Champ Visuel Automatisé', price: 90.00, duration: 40 },
  { code: 'OPH008', name: 'Adaptation Lentilles de Contact', price: 60.00, duration: 30 },
  { code: 'OPH009', name: 'Biométrie (Calcul IOL)', price: 150.00, duration: 30 },
  { code: 'OPH010', name: 'Angiographie Rétinienne', price: 200.00, duration: 60 },
  { code: 'OPH011', name: 'Pachymétrie', price: 40.00, duration: 10 },
  { code: 'OPH012', name: 'Gonioscopie', price: 50.00, duration: 15 },
  { code: 'OPH013', name: 'Test de Schirmer', price: 25.00, duration: 10 },
  { code: 'OPH014', name: 'Photographie du Segment Antérieur', price: 35.00, duration: 10 },
  { code: 'OPH015', name: 'Examen Orthoptique', price: 60.00, duration: 30 }
];