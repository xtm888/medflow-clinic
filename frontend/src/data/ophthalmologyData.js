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

  visualAcuityFormats: ['Snellen', 'LogMAR', 'Décimal'],

  snellenValues: [
    '20/200', '20/160', '20/125', '20/100', '20/80',
    '20/63', '20/50', '20/40', '20/32', '20/25',
    '20/20', '20/16', '20/12.5', '20/10'
  ],

  refractionDevices: [
    { id: 'auto1', name: 'Topcon KR-8900', type: 'Autorefractor' },
    { id: 'auto2', name: 'Nidek AR-1a', type: 'Autorefractor' },
    { id: 'ret1', name: 'Heine Beta 200', type: 'Retinoscope' },
    { id: 'trial', name: 'Lunettes d\'essai', type: 'Manual' }
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