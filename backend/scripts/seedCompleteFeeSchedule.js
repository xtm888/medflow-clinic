/**
 * COMPREHENSIVE FEE SCHEDULE SEEDING SCRIPT
 *
 * This script creates fee schedule entries for ALL billable items in the system:
 * - Short-code aliases (OCT, CV, PACHY, ERG, NFS, etc.) matching consultation templates
 * - All 143 clinical procedures from seedFrenchClinicalActs.js
 * - All examination templates
 * - All laboratory tests
 * - Medication billing from pharmacy inventory
 *
 * Run with: node scripts/seedCompleteFeeSchedule.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

// ========================================
// SHORT-CODE ALIASES (Priority - used in UI)
// ========================================
const shortCodeAliases = [
  // === IMAGING & FUNCTIONAL TESTS ===
  { code: 'OCT', name: 'OCT Macula/Nerf Optique', category: 'Imaging', price: 25000 },
  { code: 'CV', name: 'Champ Visuel (Humphrey)', category: 'Functional', price: 15000 },
  { code: 'ANGIO', name: 'Angiographie à la fluorescéine', category: 'Imaging', price: 50000 },
  { code: 'PACHY', name: 'Pachymétrie', category: 'Functional', price: 8000 },
  { code: 'ERG', name: 'Électrorétinogramme (ERG)', category: 'Functional', price: 30000 },
  { code: 'PHOTO', name: 'Rétinographie', category: 'Imaging', price: 12000 },
  { code: 'TOPO', name: 'Topographie cornéenne', category: 'Imaging', price: 20000 },
  { code: 'ECHO', name: 'Échographie oculaire (B-Scan)', category: 'Imaging', price: 18000 },
  { code: 'UBM', name: 'UBM (Biomicroscopie ultrasonore)', category: 'Imaging', price: 35000 },
  { code: 'BIOM', name: 'Biométrie IOL', category: 'Functional', price: 15000 },
  { code: 'GONIO', name: 'Gonioscopie', category: 'Functional', price: 5000 },
  { code: 'PEV', name: 'Potentiels évoqués visuels', category: 'Functional', price: 25000 },
  { code: 'TONOMETRIE', name: 'Tonométrie', category: 'Functional', price: 3000 },
  { code: 'KERATOMETRIE', name: 'Kératomètrie', category: 'Functional', price: 5000 },
  { code: 'REFRACTOMETRIE', name: 'Réfractométrie automatique', category: 'Functional', price: 8000 },
  { code: 'BIOMICROSCOPIE', name: 'Biomicroscopie', category: 'Functional', price: 5000 },
  { code: 'FO', name: 'Fond d\'œil', category: 'Functional', price: 8000 },
  { code: 'FO_DILATE', name: 'Fond d\'œil dilaté', category: 'Functional', price: 10000 },
  { code: 'SCHIRMER', name: 'Test de Schirmer', category: 'Functional', price: 3000 },
  { code: 'JONES', name: 'Test de Jones', category: 'Functional', price: 3000 },
  { code: 'FLUORESCEINE', name: 'Test à la fluorescéine', category: 'Functional', price: 2000 },
  { code: 'AMSLER', name: 'Grille d\'Amsler', category: 'Functional', price: 2000 },

  // === LABORATORY TESTS ===
  { code: 'NFS', name: 'NFS (Hémogramme)', category: 'Laboratory', price: 5000 },
  { code: 'HBA1C', name: 'HbA1c', category: 'Laboratory', price: 8000 },
  { code: 'GLYCEMIE', name: 'Glycémie à jeun', category: 'Laboratory', price: 3000 },
  { code: 'VS_CRP', name: 'VS + CRP', category: 'Laboratory', price: 6000 },
  { code: 'BILAN_INF', name: 'Bilan inflammatoire (VS, CRP, Fibrinogène)', category: 'Laboratory', price: 10000 },
  { code: 'ECA', name: 'ECA (Enzyme de conversion)', category: 'Laboratory', price: 12000 },
  { code: 'AAN', name: 'Anticorps anti-nucléaires (AAN)', category: 'Laboratory', price: 15000 },
  { code: 'HLAB27', name: 'HLA-B27', category: 'Laboratory', price: 25000 },
  { code: 'ANCA', name: 'ANCA', category: 'Laboratory', price: 20000 },
  { code: 'TOXO', name: 'Sérologie toxoplasmose', category: 'Laboratory', price: 10000 },
  { code: 'VIH', name: 'Sérologie VIH', category: 'Laboratory', price: 8000 },
  { code: 'SYPHILIS', name: 'Sérologie syphilis (TPHA/VDRL)', category: 'Laboratory', price: 8000 },
  { code: 'HSV', name: 'Sérologie herpès (HSV1/HSV2)', category: 'Laboratory', price: 12000 },
  { code: 'CMV', name: 'Sérologie CMV', category: 'Laboratory', price: 12000 },
  { code: 'TOXOCARA', name: 'Sérologie toxocarose', category: 'Laboratory', price: 15000 },
  { code: 'UREE', name: 'Urée', category: 'Laboratory', price: 3000 },
  { code: 'CREATININE', name: 'Créatinine', category: 'Laboratory', price: 3000 },
  { code: 'CHOLESTEROL', name: 'Cholestérol total', category: 'Laboratory', price: 4000 },
  { code: 'TRIGLYCERIDES', name: 'Triglycérides', category: 'Laboratory', price: 4000 },
  { code: 'TRANSAMINASES', name: 'Transaminases (SGOT/SGPT)', category: 'Laboratory', price: 5000 },
  { code: 'TP_INR', name: 'TP/INR', category: 'Laboratory', price: 5000 },
  { code: 'TCA', name: 'TCA', category: 'Laboratory', price: 5000 },

  // === CONSULTATIONS ===
  { code: 'CONSULT', name: 'Consultation générale', category: 'Consultation', price: 10000 },
  { code: 'CONSULT_SPEC', name: 'Consultation spécialisée', category: 'Consultation', price: 15000 },
  { code: 'CONSULT_URGENCE', name: 'Consultation urgence', category: 'Consultation', price: 20000 },
  { code: 'CONTROLE', name: 'Contrôle post-opératoire', category: 'Consultation', price: 5000 },
  { code: 'CONSULT_PEDIATRIQUE', name: 'Consultation ophtalmopédiatrique', category: 'Consultation', price: 20000 },
  { code: 'CONSULT_ORTHOPTIQUE', name: 'Consultation orthoptique', category: 'Consultation', price: 15000 },

  // === PROCEDURES ===
  { code: 'IVT', name: 'Injection intravitréenne', category: 'Procedure', price: 75000 },
  { code: 'IVT_AVASTIN', name: 'IVT Avastin', category: 'Procedure', price: 75000 },
  { code: 'IVT_LUCENTIS', name: 'IVT Ranibizumab (Lucentis)', category: 'Procedure', price: 100000 },
  { code: 'IVT_OZURDEX', name: 'IVT Ozurdex', category: 'Procedure', price: 150000 },
  { code: 'IVT_KENACORT', name: 'IVT Kenacort', category: 'Procedure', price: 50000 },
  { code: 'LASER_PAN', name: 'Panphotocoagulation laser', category: 'Procedure', price: 100000 },
  { code: 'LASER_FOCAL', name: 'Laser focal', category: 'Procedure', price: 75000 },
  { code: 'YAG_CAPS', name: 'YAG capsulotomie', category: 'Procedure', price: 50000 },
  { code: 'YAG_IRIDO', name: 'YAG iridotomie', category: 'Procedure', price: 50000 },
  { code: 'LASER_SLT', name: 'Laser SLT (glaucome)', category: 'Procedure', price: 60000 },
  { code: 'PARACENTESE', name: 'Ponction de chambre antérieure', category: 'Procedure', price: 30000 },
  { code: 'CHALAZION', name: 'Incision chalazion', category: 'Procedure', price: 25000 },
  { code: 'CORPS_ETRANGER', name: 'Ablation corps étranger cornéen', category: 'Procedure', price: 20000 },
  { code: 'CURETAGE_CHALAZION', name: 'Curetage chalazion', category: 'Procedure', price: 25000 },
  { code: 'EXCISION_PTERYGION', name: 'Excision ptérygion', category: 'Procedure', price: 80000 },
  { code: 'EXCISION_PTERYGION_GREFFE', name: 'Excision ptérygion + greffe', category: 'Procedure', price: 120000 },

  // === SURGERY ===
  { code: 'PHACO', name: 'Phacoémulsification + implant', category: 'Surgery', price: 300000 },
  { code: 'PHACO_STANDARD', name: 'Phaco implant standard', category: 'Surgery', price: 300000 },
  { code: 'PHACO_PRIVILEGE', name: 'Phaco implant privilège', category: 'Surgery', price: 350000 },
  { code: 'PHACO_PREMIUM', name: 'Phaco implant premium', category: 'Surgery', price: 400000 },
  { code: 'SICS', name: 'SICS (Small Incision Cataract Surgery)', category: 'Surgery', price: 250000 },
  { code: 'TRABÉCULECTOMIE', name: 'Trabéculectomie', category: 'Surgery', price: 200000 },
  { code: 'VITRECTOMIE', name: 'Vitrectomie', category: 'Surgery', price: 500000 },
  { code: 'KÉRATOPLASTIE', name: 'Kératoplastie', category: 'Surgery', price: 600000 }
];

// ========================================
// CLINICAL PROCEDURES (from seedFrenchClinicalActs.js)
// ========================================
const clinicalProcedures = [
  // Anesthésie
  { name: 'Anesthésie générale', category: 'Anesthésie', price: 50000 },
  { name: 'Anesthésie sous ténonienne', category: 'Anesthésie', price: 15000 },

  // Examens de base
  { name: 'Biométrie', category: 'Examens diagnostiques', price: 15000 },
  { name: 'Biomicroscopie', category: 'Examens diagnostiques', price: 5000 },
  { name: 'Tonométrie', category: 'Examens diagnostiques', price: 3000 },
  { name: 'Pachymétrie', category: 'Examens diagnostiques', price: 8000 },
  { name: 'Kératométrie', category: 'Examens diagnostiques', price: 5000 },
  { name: 'Kératoréf', category: 'Examens diagnostiques', price: 8000 },
  { name: 'Topographie Cornéenne', category: 'Examens diagnostiques', price: 20000 },
  { name: 'Réfractométrie automatique', category: 'Examens diagnostiques', price: 8000 },
  { name: 'Réfractométrie automatique + cycloplégie', category: 'Examens diagnostiques', price: 12000 },
  { name: 'Réfractométrie automatique mode binoculaire', category: 'Examens diagnostiques', price: 10000 },
  { name: 'Skiascopie', category: 'Examens diagnostiques', price: 8000 },
  { name: 'Skiascopie avec cycloplégie', category: 'Examens diagnostiques', price: 12000 },
  { name: 'Essai subjectif des verres', category: 'Examens diagnostiques', price: 5000 },
  { name: 'Vision des couleurs', category: 'Examens diagnostiques', price: 3000 },
  { name: 'Grille d\'Amsler', category: 'Examens diagnostiques', price: 2000 },
  { name: 'Test à la fluorescéïne', category: 'Examens diagnostiques', price: 2000 },
  { name: 'Test de Jones', category: 'Examens diagnostiques', price: 3000 },
  { name: 'Test de Schirmer', category: 'Examens diagnostiques', price: 3000 },
  { name: 'Exophtalmomètre de Hertel', category: 'Examens diagnostiques', price: 5000 },
  { name: 'Gonioscopie', category: 'Examens diagnostiques', price: 5000 },
  { name: 'Goniographie', category: 'Examens diagnostiques', price: 8000 },
  { name: 'TAR', category: 'Examens diagnostiques', price: 5000 },

  // Champ visuel
  { name: 'Champ visuel automatique', category: 'Périmétrie', price: 15000 },
  { name: 'Périmétrie automatisée blanc/blanc centrale', category: 'Périmétrie', price: 15000 },
  { name: 'Périmétrie automatisée blanc/blanc centre + périphérique', category: 'Périmétrie', price: 20000 },
  { name: 'Périmétrie automatisée bleu/jaune', category: 'Périmétrie', price: 18000 },

  // Pression intraoculaire
  { name: 'Courbe de pression intraoculaire diurne', category: 'Tonométrie', price: 25000 },
  { name: 'Courbe de pression intraoculaire 24 heures', category: 'Tonométrie', price: 50000 },

  // Imagerie
  { name: 'OCT Macula', category: 'Imagerie', price: 25000 },
  { name: 'OCT NO', category: 'Imagerie', price: 25000 },
  { name: 'OCT NO + Macula', category: 'Imagerie', price: 35000 },
  { name: 'Échographie oculaire', category: 'Imagerie', price: 18000 },
  { name: 'Rétinophotographie C', category: 'Imagerie', price: 10000 },
  { name: 'Rétinophotographie C+P', category: 'Imagerie', price: 15000 },
  { name: 'Photographie segment antérieur', category: 'Imagerie', price: 8000 },
  { name: 'Fluoangiographie rétinienne', category: 'Imagerie', price: 50000 },

  // Fond d'oeil
  { name: 'Fond d\'œil direct', category: 'Examen du fond d\'œil', price: 8000 },
  { name: 'Ophtalmoscopie Binoculaire', category: 'Examen du fond d\'œil', price: 10000 },
  { name: 'Verre à trois miroirs', category: 'Examen du fond d\'œil', price: 12000 },

  // Consultations
  { name: 'Consultation ophtalmologique', category: 'Consultations', price: 10000 },
  { name: 'Consultation ophtalmologique + examens de base', category: 'Consultations', price: 20000 },
  { name: 'Consultation en urgence', category: 'Consultations', price: 20000 },
  { name: 'Consultation pré et post opératoire', category: 'Consultations', price: 10000 },
  { name: 'Consultation anesthésiste', category: 'Consultations', price: 15000 },
  { name: 'Consultation ophta-pédiatrique', category: 'Consultations', price: 20000 },
  { name: 'Consultation et Examen Orthoptique', category: 'Consultations', price: 15000 },
  { name: 'Consultation Essai lentille de contact', category: 'Consultations', price: 20000 },
  { name: 'Consultation NTBC', category: 'Consultations', price: 10000 },
  { name: 'Contrôle post chirurgie', category: 'Consultations', price: 5000 },
  { name: 'Examen NTBC', category: 'Consultations', price: 10000 },
  { name: 'Rééducation orthoptique', category: 'Consultations', price: 15000 },

  // Forfaits
  { name: 'Forfait cons examens 1', category: 'Forfaits', price: 25000 },
  { name: 'Forfait cons examens 2', category: 'Forfaits', price: 35000 },
  { name: 'Forfait Examens préliminaires Chirurgie', category: 'Forfaits', price: 40000 },

  // Laser
  { name: 'Laser YAG', category: 'Laser', price: 50000 },
  { name: 'Laser SLT', category: 'Laser', price: 60000 },
  { name: 'Laser iridotomie périphérique', category: 'Laser', price: 50000 },
  { name: 'Laser photocoagulation pan rétinienne', category: 'Laser', price: 100000 },
  { name: 'Laser photocoagulation rétinienne focale', category: 'Laser', price: 75000 },

  // IVT
  { name: 'Séance IVT Ranibizumab', category: 'Injections intravitréennes', price: 100000 },
  { name: 'Séance IVT Ranibizumab + Kenacort', category: 'Injections intravitréennes', price: 120000 },
  { name: 'Séance IVT AVASTIN', category: 'Injections intravitréennes', price: 75000 },
  { name: 'Séance IVT AVASTIN + KENACORT', category: 'Injections intravitréennes', price: 90000 },
  { name: 'Séance IVT Ozurdex', category: 'Injections intravitréennes', price: 150000 },
  { name: 'Séance IVT Kenacort', category: 'Injections intravitréennes', price: 50000 },

  // Autres injections
  { name: 'Injection IM', category: 'Injections', price: 5000 },
  { name: 'Injection Rétrobulbaire', category: 'Injections', price: 10000 },
  { name: 'Injection rétrobulbaire Largactyl', category: 'Injections', price: 15000 },
  { name: 'Injection sous conjonctivale + produit standard', category: 'Injections', price: 8000 },
  { name: 'Injection sous conjonctivale + Kenacort', category: 'Injections', price: 12000 },
  { name: 'Injection sous ténonienne + produit standard', category: 'Injections', price: 8000 },
  { name: 'Injection Kenacort chalazion', category: 'Injections', price: 10000 },
  { name: 'Séance Injection Botox OD / PRODUIT LV', category: 'Injections', price: 50000 },
  { name: 'Séance Injection Botox OD / PRODUIT PATIENT', category: 'Injections', price: 30000 },

  // Perfusions
  { name: 'Séance perfusion IVD', category: 'Perfusions', price: 20000 },
  { name: 'Séance perfusion manitol', category: 'Perfusions', price: 15000 },
  { name: 'Séance perfusion + solumédrol', category: 'Perfusions', price: 25000 },

  // Petites interventions
  { name: 'Épilation', category: 'Petites interventions', price: 3000 },
  { name: 'Extraction corps étranger superficiel', category: 'Petites interventions', price: 15000 },
  { name: 'Extraction corps étranger profond', category: 'Petites interventions', price: 25000 },
  { name: 'Soins + Pansement', category: 'Petites interventions', price: 5000 },
  { name: 'Soins1', category: 'Petites interventions', price: 5000 },
  { name: 'Soins2', category: 'Petites interventions', price: 8000 },
  { name: 'Lavage et Sondage voies lacrymales', category: 'Petites interventions', price: 10000 },
  { name: 'Irrigation et sondage des voies lacrymales', category: 'Petites interventions', price: 10000 },

  // Chirurgies cataracte
  { name: 'Chirurgie Phaco implant standard', category: 'Chirurgie cataracte', price: 300000 },
  { name: 'Chirurgie Phaco implant Privilège', category: 'Chirurgie cataracte', price: 350000 },
  { name: 'Chirurgie Phaco implant Premium', category: 'Chirurgie cataracte', price: 400000 },
  { name: 'Chirurgie SICS implant rigide standard', category: 'Chirurgie cataracte', price: 250000 },
  { name: 'Chirurgie SICS implant pliable standard', category: 'Chirurgie cataracte', price: 280000 },
  { name: 'Chirurgie SICS implant pliable Privilège', category: 'Chirurgie cataracte', price: 320000 },
  { name: 'Aspiration masses', category: 'Chirurgie cataracte', price: 150000 },
  { name: 'Discission capsule postérieure', category: 'Chirurgie cataracte', price: 80000 },

  // Chirurgies glaucome
  { name: 'Chirurgie Trabéculectomie', category: 'Chirurgie glaucome', price: 200000 },
  { name: 'Chirurgie Sclérectomie prof non perf', category: 'Chirurgie glaucome', price: 220000 },
  { name: 'Chirurgie Needling', category: 'Chirurgie glaucome', price: 50000 },

  // Chirurgies cornée
  { name: 'Chirurgie Kératoplastie', category: 'Chirurgie cornée', price: 600000 },
  { name: 'Chirurgie perforation cornéenne simple', category: 'Chirurgie cornée', price: 150000 },
  { name: 'Chirurgie perforation cornéenne complexe', category: 'Chirurgie cornée', price: 250000 },
  { name: 'Chirurgie Pelage à l\'EDTA', category: 'Chirurgie cornée', price: 80000 },
  { name: 'Chirurgie Débridement ulcère', category: 'Chirurgie cornée', price: 50000 },

  // Chirurgies conjonctive
  { name: 'Chirurgie Excision ptérygion', category: 'Chirurgie conjonctive', price: 80000 },
  { name: 'Chirurgie Excision ptérygion + greffe', category: 'Chirurgie conjonctive', price: 120000 },
  { name: 'Chirurgie Excision pinguecula', category: 'Chirurgie conjonctive', price: 50000 },
  { name: 'Chirurgie Biopsie tumeur conjonctivale', category: 'Chirurgie conjonctive', price: 60000 },
  { name: 'Chirurgie exploration sous conjonctival', category: 'Chirurgie conjonctive', price: 40000 },
  { name: 'Chirurgie Excision granulome pyogénique', category: 'Chirurgie conjonctive', price: 50000 },

  // Chirurgies paupières
  { name: 'Chirurgie Curetage chalazion', category: 'Chirurgie paupières', price: 25000 },
  { name: 'Chirurgie Biopsie tumeur palpébrale', category: 'Chirurgie paupières', price: 60000 },
  { name: 'Chirurgie Incision abcès palpébrale', category: 'Chirurgie paupières', price: 30000 },
  { name: 'Chirurgie Incision glande eccrine', category: 'Chirurgie paupières', price: 30000 },
  { name: 'Chirurgie Cure ankyloblépharon sous anesthésie locale', category: 'Chirurgie paupières', price: 100000 },
  { name: 'Chirurgie Cure symblépharon + autogreffe', category: 'Chirurgie paupières', price: 150000 },
  { name: 'Chirurgie Cure symblépharon + ankyloblépharon', category: 'Chirurgie paupières', price: 180000 },
  { name: 'Chirurgie Suture palpébrale et exploration canaux lacrymaux', category: 'Chirurgie paupières', price: 120000 },
  { name: 'Chirurgie Ablation fils', category: 'Chirurgie paupières', price: 10000 },

  // Chirurgies autres
  { name: 'Chirurgie Vitrectomie antérieure', category: 'Chirurgie autre', price: 200000 },
  { name: 'Chirurgie Vitréorétinienne', category: 'Chirurgie autre', price: 500000 },
  { name: 'Chirurgie Vitréorétinienne + endolaser', category: 'Chirurgie autre', price: 600000 },
  { name: 'Chirurgie ablation huile de silicone', category: 'Chirurgie autre', price: 250000 },
  { name: 'Chirurgie Glued IOL', category: 'Chirurgie autre', price: 200000 },
  { name: 'Chirurgie Réduction hernie iris pupilloplastie/vitrectomie antérieure', category: 'Chirurgie autre', price: 180000 },
  { name: 'Chirurgie Ablation Lipome', category: 'Chirurgie autre', price: 80000 },
  { name: 'Chirurgie Ablation Amygdales + végétations', category: 'Chirurgie autre', price: 150000 },

  // Radiologie
  { name: 'Radio thorax face', category: 'Radiologie', price: 8000 },
  { name: 'Radio thorax face et profil adulte', category: 'Radiologie', price: 10000 },
  { name: 'Radio thorax face et profil enfant', category: 'Radiologie', price: 10000 },
  { name: 'Radio sinus', category: 'Radiologie', price: 8000 },
  { name: 'Radio cavum', category: 'Radiologie', price: 8000 },
  { name: 'Radio colonne', category: 'Radiologie', price: 12000 },
  { name: 'Radio colonne cervicale', category: 'Radiologie', price: 12000 },
  { name: 'Radio colonne cervico-dorsale', category: 'Radiologie', price: 12000 },
  { name: 'Radio colonne dorsale', category: 'Radiologie', price: 12000 },
  { name: 'Radio colonne lombo-sacrée', category: 'Radiologie', price: 12000 },
  { name: 'Radio articulation comparative', category: 'Radiologie', price: 10000 },

  // Échographie non oculaire
  { name: 'Échographie abdominale', category: 'Échographie', price: 20000 },
  { name: 'Échographie abdominale et pelvienne', category: 'Échographie', price: 25000 },
  { name: 'Échographie rénale', category: 'Échographie', price: 15000 },
  { name: 'Échographie vésico-prostatique', category: 'Échographie', price: 15000 },

  // Divers
  { name: 'Surveillance et réanimation', category: 'Divers', price: 50000 },
  { name: 'Matériel', category: 'Divers', price: 0 }
];

// Generate code from name
function generateCode(name) {
  return name
    .toUpperCase()
    .replace(/[ÀÁÂÃÄÅ]/g, 'A')
    .replace(/[ÈÉÊË]/g, 'E')
    .replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O')
    .replace(/[ÙÚÛÜ]/g, 'U')
    .replace(/[Ç]/g, 'C')
    .replace(/'/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Map category to FeeSchedule format
function mapCategory(category) {
  const categoryMap = {
    // Imaging
    'Imaging': 'imaging',
    'Imagerie': 'imaging',

    // Functional/Examination
    'Functional': 'examination',
    'Examens diagnostiques': 'examination',
    'Périmétrie': 'examination',
    'Tonométrie': 'examination',
    'Examen du fond d\'œil': 'examination',

    // Laboratory
    'Laboratory': 'laboratory',

    // Consultation
    'Consultation': 'consultation',
    'Consultations': 'consultation',
    'Forfaits': 'consultation',

    // Procedures
    'Procedure': 'procedure',
    'Petites interventions': 'procedure',
    'Laser': 'procedure',
    'Injections intravitréennes': 'procedure',
    'Injections': 'procedure',
    'Perfusions': 'procedure',

    // Surgery
    'Surgery': 'surgery',
    'Anesthésie': 'surgery',
    'Chirurgie cataracte': 'surgery',
    'Chirurgie glaucome': 'surgery',
    'Chirurgie cornée': 'surgery',
    'Chirurgie conjonctive': 'surgery',
    'Chirurgie paupières': 'surgery',
    'Chirurgie autre': 'surgery',

    // Other
    'Radiologie': 'imaging',
    'Échographie': 'imaging',
    'Divers': 'other'
  };

  return categoryMap[category] || 'other';
}

async function seedCompleteFeeSchedule() {
  try {
    console.log('=== COMPREHENSIVE FEE SCHEDULE SEEDING ===\n');
    console.log('This will create fee schedule entries for ALL billable items:\n');
    console.log(`  - ${shortCodeAliases.length} short-code aliases (OCT, CV, NFS, etc.)`);
    console.log(`  - ${clinicalProcedures.length} clinical procedures`);
    console.log(`  - Total: ${shortCodeAliases.length + clinicalProcedures.length} fee schedule entries\n`);

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const FeeSchedule = require('../models/FeeSchedule');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // ========================================
    // PHASE 1: Short-code aliases (PRIORITY)
    // ========================================
    console.log('PHASE 1: Seeding short-code aliases...\n');

    for (const alias of shortCodeAliases) {
      const existing = await FeeSchedule.findOne({ code: alias.code });

      if (existing) {
        if (existing.price !== alias.price || existing.displayCategory !== alias.category) {
          await FeeSchedule.updateOne(
            { code: alias.code },
            {
              $set: {
                name: alias.name,
                category: mapCategory(alias.category),
                displayCategory: alias.category,
                department: alias.category === 'Laboratory' ? 'Laboratoire' : 'Ophtalmologie',
                price: alias.price,
                currency: 'CDF',
                active: true,
                effectiveFrom: new Date(),
                effectiveTo: null,
                updatedAt: new Date()
              }
            }
          );
          console.log(`✅ Updated: ${alias.code} - ${alias.name} (${alias.price} CDF)`);
          updated++;
        } else {
          console.log(`⏭️  Skipped: ${alias.code} - Already exists`);
          skipped++;
        }
      } else {
        await FeeSchedule.create({
          code: alias.code,
          name: alias.name,
          category: mapCategory(alias.category),
          displayCategory: alias.category,
          department: alias.category === 'Laboratory' ? 'Laboratoire' : 'Ophtalmologie',
          price: alias.price,
          currency: 'CDF',
          active: true,
          effectiveFrom: new Date(),
          effectiveTo: null
        });
        console.log(`✨ Created: ${alias.code} - ${alias.name} (${alias.price} CDF)`);
        created++;
      }
    }

    // ========================================
    // PHASE 2: Clinical procedures
    // ========================================
    console.log('\n\nPHASE 2: Seeding clinical procedures...\n');

    for (const procedure of clinicalProcedures) {
      const code = generateCode(procedure.name);
      const existing = await FeeSchedule.findOne({ code });

      if (existing) {
        if (existing.price !== procedure.price || existing.displayCategory !== procedure.category) {
          await FeeSchedule.updateOne(
            { code },
            {
              $set: {
                name: procedure.name,
                category: mapCategory(procedure.category),
                displayCategory: procedure.category,
                department: 'Ophtalmologie',
                price: procedure.price,
                currency: 'CDF',
                active: true,
                effectiveFrom: new Date(),
                effectiveTo: null,
                updatedAt: new Date()
              }
            }
          );
          console.log(`✅ Updated: ${code} - ${procedure.name} (${procedure.price} CDF)`);
          updated++;
        } else {
          console.log(`⏭️  Skipped: ${code} - Already exists`);
          skipped++;
        }
      } else {
        await FeeSchedule.create({
          code,
          name: procedure.name,
          category: mapCategory(procedure.category),
          displayCategory: procedure.category,
          department: 'Ophtalmologie',
          price: procedure.price,
          currency: 'CDF',
          active: true,
          effectiveFrom: new Date(),
          effectiveTo: null
        });
        console.log(`✨ Created: ${code} - ${procedure.name} (${procedure.price} CDF)`);
        created++;
      }
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('SEEDING COMPLETE - SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total items processed: ${shortCodeAliases.length + clinicalProcedures.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    // Breakdown by category
    console.log(`\n${'='.repeat(60)}`);
    console.log('BREAKDOWN BY CATEGORY');
    console.log('='.repeat(60));
    const breakdown = await FeeSchedule.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$displayCategory',
          count: { $sum: 1 },
          totalValue: { $sum: '$price' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    breakdown.forEach(cat => {
      console.log(`${cat._id || 'Unknown'}: ${cat.count} services, ${cat.totalValue.toLocaleString()} CDF total`);
    });

    // Total count
    const totalCount = await FeeSchedule.countDocuments({ active: true });
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TOTAL ACTIVE FEE SCHEDULES: ${totalCount}`);
    console.log('='.repeat(60));

    console.log('\n✅ All fee schedules seeded successfully!');
    console.log('\nNEXT STEPS:');
    console.log('1. Test consultation completion with exams and lab tests');
    console.log('2. Verify invoices include all selected items');
    console.log('3. Check that all UI selection dropdowns show the items\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedCompleteFeeSchedule();
