/**
 * PathologyPicker Component
 *
 * StudioVision Parity: 3-Column Pathology/Diagnosis Entry
 * Now using unified design system with responsive ColumnLayout.
 *
 * Layout:
 * - LEFT (Purple): Dominante dropdown + Category navigation
 * - CENTER (Yellow): Symptom list | Description list
 * - RIGHT (Gray): Diagnostic list + Observation notes editor
 *
 * Features:
 * - Auto-text generation from symptom/description selections
 * - Category-based symptom filtering
 * - Laterality (OD/OS/OU) support
 * - Severity grading
 * - ICD-10 diagnosis linking
 * - Responsive: columns become tabs on mobile
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';
import ColumnLayout from '../layout/ColumnLayout';
import { colors } from '../../styles/designTokens';

// ============================================================================
// CONSTANTS (same as before)
// ============================================================================

const PATHOLOGY_CATEGORIES = [
  { id: 'MOTIF DE CONSULTATION', label: 'Motif de Consultation', color: 'blue' },
  { id: 'Normal', label: 'Normal', color: 'green' },
  { id: 'Inspect/OCME', label: 'Inspect/OCME', color: 'gray' },
  { id: 'LAF', label: 'LAF', color: 'purple' },
  { id: 'AV/RPM', label: 'AV/RPM', color: 'teal' },
  { id: 'Conjonctivite', label: 'Conjonctivite', color: 'pink' },
  { id: 'Traumatologie', label: 'Traumatologique', color: 'red' },
  { id: 'Cataracte', label: 'Cataracte', color: 'orange' },
  { id: 'Glaucome', label: 'Glaucome', color: 'cyan' },
  { id: 'Rétine Centrale', label: 'Rétine Centrale', color: 'yellow' },
  { id: 'Rétine Périphérique', label: 'Rétine Périphérique', color: 'yellow' },
  { id: 'Paupière', label: 'Paupière', color: 'gray' },
  { id: 'Cornée', label: 'Cornée', color: 'blue' },
  { id: 'Uvéite', label: 'Uvéite', color: 'purple' },
  { id: 'Diabète', label: 'DMLA / Diabète', color: 'orange' },
  { id: 'HTA', label: 'HTA', color: 'red' },
  { id: 'GONIOSCOPIE', label: 'Gonioscopie', color: 'teal' },
  { id: 'champ visuel', label: 'Champ Visuel', color: 'green' },
  { id: 'Chirurgie de cataracte', label: 'Chirurgie Cataracte', color: 'blue' },
];

const DOMINANTE_OPTIONS = [
  'Diabète', 'Glaucome', 'Cataracte', 'DMLA', 'Lunettes', 'Lentilles',
  'Contrôle', 'Chalazion', 'Conjonctivite', 'Traumatisme', 'Urgence',
  'Post-opératoire', 'Autre',
];

const LATERALITY_OPTIONS = [
  { value: 'OD', label: 'Œil droit', short: 'OD' },
  { value: 'OS', label: 'Œil gauche', short: 'OG' },
  { value: 'OU', label: 'Les deux yeux', short: 'ODG' },
];

const SEVERITY_OPTIONS = [
  { value: '-', label: 'Absent' },
  { value: '+/-', label: 'Trace' },
  { value: '+', label: 'Léger' },
  { value: '++', label: 'Modéré' },
  { value: '+++', label: 'Sévère' },
  { value: '++++', label: 'Très sévère' },
];

const COMMON_DIAGNOSES = {
  'Diabète': [
    { code: 'E11.3', name: 'Rétinopathie Diabétique' },
    { code: 'H36.0', name: 'Rétinopathie Diabétique Non Proliférative' },
    { code: 'H36.0', name: 'Rétinopathie Diabétique Proliférative' },
    { code: 'H35.81', name: 'Œdème Maculaire Diabétique' },
  ],
  'Glaucome': [
    { code: 'H40.1', name: 'Glaucome Primitif à Angle Ouvert' },
    { code: 'H40.2', name: 'Glaucome Primitif à Angle Fermé' },
    { code: 'H40.0', name: 'Suspicion de Glaucome' },
    { code: 'H40.5', name: 'Glaucome Secondaire' },
  ],
  'Cataracte': [
    { code: 'H25.9', name: 'Cataracte Sénile' },
    { code: 'H25.1', name: 'Cataracte Nucléaire' },
    { code: 'H25.0', name: 'Cataracte Corticale' },
    { code: 'H25.2', name: 'Cataracte Sous-Capsulaire Postérieure' },
  ],
  'Rétine Centrale': [
    { code: 'H35.3', name: 'DMLA Sèche' },
    { code: 'H35.3', name: 'DMLA Exsudative' },
    { code: 'H35.81', name: 'Œdème Maculaire' },
  ],
  'Conjonctivite': [
    { code: 'H10.1', name: 'Conjonctivite Allergique Aiguë' },
    { code: 'H10.0', name: 'Conjonctivite Bactérienne' },
    { code: 'H10.2', name: 'Conjonctivite Virale' },
  ],
  'Normal': [
    { code: 'Z01.0', name: 'Examen Ophtalmologique Normal' },
    { code: 'Z96.1', name: 'Pseudophakie' },
  ],
};

const SYMPTOM_TEMPLATES = {
  // ===== MOTIF DE CONSULTATION =====
  'MOTIF DE CONSULTATION': {
    symptoms: [
      { id: 1000, name: 'Baisse de vision' },
      { id: 1001, name: 'Vision floue' },
      { id: 1002, name: 'Œil rouge' },
      { id: 1003, name: 'Douleur oculaire' },
      { id: 1004, name: 'Larmoiement' },
      { id: 1005, name: 'Prurit oculaire' },
      { id: 1006, name: 'Corps flottants' },
      { id: 1007, name: 'Photophobie' },
      { id: 1008, name: 'Diplopie' },
      { id: 1009, name: 'Contrôle annuel' },
      { id: 1010, name: 'Renouvellement ordonnance' },
      { id: 1011, name: 'Adaptation lentilles' },
    ],
    descriptions: [
      { id: 1101, name: 'depuis quelques jours' },
      { id: 1102, name: 'depuis quelques semaines' },
      { id: 1103, name: 'depuis plusieurs mois' },
      { id: 1104, name: 'brutal' },
      { id: 1105, name: 'progressif' },
      { id: 1106, name: 'de loin' },
      { id: 1107, name: 'de près' },
      { id: 1108, name: 'de loin et de près' },
      { id: 1109, name: 'unilatéral' },
      { id: 1110, name: 'bilatéral' },
    ],
  },

  // ===== DIABÈTE =====
  'Diabète': {
    symptoms: [
      { id: 1, name: 'F.O: Stade R.D non proliférative' },
      { id: 2, name: 'Débutante: Microanévrysmes < 5' },
      { id: 3, name: 'Moyenne: Microanévrysmes > 5' },
      { id: 4, name: 'Exsudats' },
      { id: 5, name: 'Hémorragies Ponctuées' },
      { id: 6, name: 'Stade R.D pré proliférative' },
      { id: 7, name: 'Modérée: Nodules cotonneux < 2' },
      { id: 8, name: 'Sévère: Nodules cotonneux > 2' },
      { id: 9, name: 'AMIR' },
      { id: 10, name: 'Veines en chapelet' },
      { id: 11, name: 'Stade R.D proliférative' },
      { id: 12, name: 'Néovaisseaux pré-papillaires' },
      { id: 13, name: 'Néovaisseaux pré-rétiniens' },
      { id: 14, name: 'Maculopathie' },
      { id: 15, name: 'Œdème maculaire focal' },
      { id: 16, name: 'Œdème maculaire cystoïde' },
      { id: 17, name: 'Œdème maculaire diffus' },
    ],
    descriptions: [
      { id: 101, name: 'Maculopathie exsudative' },
      { id: 102, name: 'Maculopathie oédémateuse' },
      { id: 103, name: 'R.A.S.' },
      { id: 104, name: 'claire, négative à la fluoréscéine' },
      { id: 105, name: 'Absence de cataracte' },
      { id: 106, name: 'Hémorragie vitréenne' },
      { id: 107, name: 'Décollement de rétine tractionnel' },
      { id: 108, name: 'Laser déjà effectué' },
      { id: 109, name: 'Indication de laser' },
      { id: 110, name: 'fovéolaire' },
      { id: 111, name: 'couronne intermédiaire' },
      { id: 112, name: 'pôle postérieur' },
      { id: 113, name: 'Indication IVT anti-VEGF' },
    ],
  },

  // ===== LAF (Lampe à Fente) =====
  'LAF': {
    symptoms: [
      { id: 20, name: 'Annexes' },
      { id: 21, name: 'Conjonctive' },
      { id: 22, name: 'Cornée' },
      { id: 23, name: 'Chambre antérieure' },
      { id: 24, name: 'Iris' },
      { id: 25, name: 'Pupille' },
      { id: 26, name: 'Cristallin' },
      { id: 27, name: 'Vitré antérieur' },
      { id: 28, name: 'Film lacrymal' },
      { id: 29, name: 'Paupières' },
    ],
    descriptions: [
      { id: 201, name: 'Claire' },
      { id: 202, name: 'Calme' },
      { id: 203, name: 'Profonde' },
      { id: 204, name: 'Normal' },
      { id: 205, name: 'Transparent' },
      { id: 206, name: 'Légère opacité' },
      { id: 207, name: 'Opacité modérée' },
      { id: 208, name: 'Cataracte débutante' },
      { id: 209, name: 'Cataracte évoluée' },
      { id: 210, name: 'Implant en place' },
      { id: 211, name: 'Ronde et réactive' },
      { id: 212, name: 'Synéchies' },
      { id: 213, name: 'Tyndall +' },
      { id: 214, name: 'Tyndall -' },
      { id: 215, name: 'BUT diminué' },
    ],
  },

  // ===== NORMAL =====
  'Normal': {
    symptoms: [
      { id: 30, name: 'Segment antérieur' },
      { id: 31, name: 'Fond d\'œil' },
      { id: 32, name: 'Tension oculaire' },
      { id: 33, name: 'Acuité visuelle' },
      { id: 34, name: 'Réfraction' },
      { id: 35, name: 'Motilité oculaire' },
    ],
    descriptions: [
      { id: 301, name: '= Normal O.D.G.' },
      { id: 302, name: '= R.A.S.' },
      { id: 303, name: 'dans les limites de la normale' },
      { id: 304, name: 'sans particularité' },
      { id: 305, name: 'examen sans anomalie' },
      { id: 306, name: 'pas de modification depuis le dernier contrôle' },
    ],
  },

  // ===== GLAUCOME =====
  'Glaucome': {
    symptoms: [
      { id: 40, name: 'PIO élevée' },
      { id: 41, name: 'Excavation papillaire' },
      { id: 42, name: 'Rapport C/D' },
      { id: 43, name: 'Déficit du champ visuel' },
      { id: 44, name: 'Angle irido-cornéen' },
      { id: 45, name: 'Pachymétrie' },
      { id: 46, name: 'RNFL aminci' },
      { id: 47, name: 'Asymétrie papillaire' },
      { id: 48, name: 'Hémorragie papillaire' },
      { id: 49, name: 'Encoche du rebord' },
    ],
    descriptions: [
      { id: 401, name: 'C/D = 0.3' },
      { id: 402, name: 'C/D = 0.4' },
      { id: 403, name: 'C/D = 0.5' },
      { id: 404, name: 'C/D = 0.6' },
      { id: 405, name: 'C/D = 0.7' },
      { id: 406, name: 'C/D = 0.8' },
      { id: 407, name: 'C/D = 0.9' },
      { id: 408, name: 'Angle ouvert' },
      { id: 409, name: 'Angle étroit' },
      { id: 410, name: 'Angle fermé' },
      { id: 411, name: 'Scotome arciforme' },
      { id: 412, name: 'Ressaut nasal' },
      { id: 413, name: 'Scotome paracentral' },
      { id: 414, name: 'Équilibré sous traitement' },
      { id: 415, name: 'Non équilibré' },
    ],
  },

  // ===== CATARACTE =====
  'Cataracte': {
    symptoms: [
      { id: 50, name: 'Opacité nucléaire' },
      { id: 51, name: 'Opacité corticale' },
      { id: 52, name: 'Opacité sous-capsulaire postérieure' },
      { id: 53, name: 'Cataracte totale' },
      { id: 54, name: 'Cataracte brunescente' },
      { id: 55, name: 'Cataracte blanche' },
      { id: 56, name: 'Subluxation du cristallin' },
      { id: 57, name: 'Pseudoexfoliation' },
    ],
    descriptions: [
      { id: 501, name: 'Stade I (NC1-2)' },
      { id: 502, name: 'Stade II (NC3)' },
      { id: 503, name: 'Stade III (NC4)' },
      { id: 504, name: 'Stade IV (NC5-6)' },
      { id: 505, name: 'Indication chirurgicale' },
      { id: 506, name: 'Surveillance' },
      { id: 507, name: 'Biométrie à programmer' },
      { id: 508, name: 'Patient informé' },
      { id: 509, name: 'Dossier opératoire complet' },
    ],
  },

  // ===== CONJONCTIVITE =====
  'Conjonctivite': {
    symptoms: [
      { id: 60, name: 'Hyperhémie conjonctivale' },
      { id: 61, name: 'Sécrétions' },
      { id: 62, name: 'Papilles' },
      { id: 63, name: 'Follicules' },
      { id: 64, name: 'Chémosis' },
      { id: 65, name: 'Adénopathie prétragienne' },
      { id: 66, name: 'Membranes/Pseudomembranes' },
      { id: 67, name: 'Pétéchies' },
    ],
    descriptions: [
      { id: 601, name: 'Allergique' },
      { id: 602, name: 'Bactérienne' },
      { id: 603, name: 'Virale' },
      { id: 604, name: 'Sécrétions purulentes' },
      { id: 605, name: 'Sécrétions muqueuses' },
      { id: 606, name: 'Sécrétions séreuses' },
      { id: 607, name: 'Bilatérale' },
      { id: 608, name: 'Unilatérale' },
      { id: 609, name: 'Récidivante' },
      { id: 610, name: 'Chronique' },
    ],
  },

  // ===== CORNÉE =====
  'Cornée': {
    symptoms: [
      { id: 70, name: 'Kératite' },
      { id: 71, name: 'Ulcère cornéen' },
      { id: 72, name: 'Abcès cornéen' },
      { id: 73, name: 'Œdème cornéen' },
      { id: 74, name: 'Kératocône' },
      { id: 75, name: 'Dystrophie cornéenne' },
      { id: 76, name: 'Dégénérescence' },
      { id: 77, name: 'Cicatrice cornéenne' },
      { id: 78, name: 'Corps étranger cornéen' },
      { id: 79, name: 'Précipités rétro-cornéens' },
    ],
    descriptions: [
      { id: 701, name: 'Ponctuée superficielle' },
      { id: 702, name: 'Dendritique' },
      { id: 703, name: 'Disciforme' },
      { id: 704, name: 'Interstitielle' },
      { id: 705, name: 'Centrale' },
      { id: 706, name: 'Para-centrale' },
      { id: 707, name: 'Périphérique' },
      { id: 708, name: 'Séchée par fluoréscéine +' },
      { id: 709, name: 'Test de Séchelle +' },
      { id: 710, name: 'Grattage effectué' },
      { id: 711, name: 'Culture en cours' },
    ],
  },

  // ===== TRAUMATOLOGIE =====
  'Traumatologie': {
    symptoms: [
      { id: 80, name: 'Contusion oculaire' },
      { id: 81, name: 'Plaie cornéenne' },
      { id: 82, name: 'Plaie conjonctivale' },
      { id: 83, name: 'Hyphéma' },
      { id: 84, name: 'Luxation du cristallin' },
      { id: 85, name: 'Hémorragie vitréenne' },
      { id: 86, name: 'Décollement de rétine' },
      { id: 87, name: 'Corps étranger' },
      { id: 88, name: 'Brûlure chimique' },
      { id: 89, name: 'Brûlure thermique' },
    ],
    descriptions: [
      { id: 801, name: 'AVP' },
      { id: 802, name: 'Agression' },
      { id: 803, name: 'Accident domestique' },
      { id: 804, name: 'Accident de travail' },
      { id: 805, name: 'Projection' },
      { id: 806, name: 'Perforation' },
      { id: 807, name: 'Acide' },
      { id: 808, name: 'Base' },
      { id: 809, name: 'Lavage effectué' },
      { id: 810, name: 'Corps étranger retiré' },
    ],
  },

  // ===== RÉTINE CENTRALE =====
  'Rétine Centrale': {
    symptoms: [
      { id: 90, name: 'DMLA' },
      { id: 91, name: 'Drusen' },
      { id: 92, name: 'Atrophie géographique' },
      { id: 93, name: 'Néovascularisation' },
      { id: 94, name: 'Œdème maculaire' },
      { id: 95, name: 'Membrane épirétinienne' },
      { id: 96, name: 'Trou maculaire' },
      { id: 97, name: 'Choriorétinopathie séreuse centrale' },
      { id: 98, name: 'Occlusion vasculaire' },
    ],
    descriptions: [
      { id: 901, name: 'Forme sèche' },
      { id: 902, name: 'Forme exsudative/humide' },
      { id: 903, name: 'Drusen mous' },
      { id: 904, name: 'Drusen durs' },
      { id: 905, name: 'Stade précoce' },
      { id: 906, name: 'Stade intermédiaire' },
      { id: 907, name: 'Stade avancé' },
      { id: 908, name: 'Indication IVT' },
      { id: 909, name: 'Surveillance OCT' },
      { id: 910, name: 'DSR' },
    ],
  },

  // ===== RÉTINE PÉRIPHÉRIQUE =====
  'Rétine Périphérique': {
    symptoms: [
      { id: 100, name: 'Déchirure rétinienne' },
      { id: 101, name: 'Trou rétinien' },
      { id: 102, name: 'Palissade' },
      { id: 103, name: 'Blanc sans pression' },
      { id: 104, name: 'Givre' },
      { id: 105, name: 'Décollement de rétine' },
      { id: 106, name: 'Hémorragie vitréenne' },
      { id: 107, name: 'Décollement du vitré postérieur' },
    ],
    descriptions: [
      { id: 1001, name: 'Temporal supérieur' },
      { id: 1002, name: 'Temporal inférieur' },
      { id: 1003, name: 'Nasal supérieur' },
      { id: 1004, name: 'Nasal inférieur' },
      { id: 1005, name: 'Barrage laser effectué' },
      { id: 1006, name: 'Indication de laser' },
      { id: 1007, name: 'À surveiller' },
      { id: 1008, name: 'Prolifération vitréo-rétinienne' },
    ],
  },

  // ===== PAUPIÈRE =====
  'Paupière': {
    symptoms: [
      { id: 110, name: 'Chalazion' },
      { id: 111, name: 'Orgelet' },
      { id: 112, name: 'Blépharite' },
      { id: 113, name: 'Ptosis' },
      { id: 114, name: 'Entropion' },
      { id: 115, name: 'Ectropion' },
      { id: 116, name: 'Dermatochalasis' },
      { id: 117, name: 'Tumeur palpébrale' },
      { id: 118, name: 'Trichiasis' },
    ],
    descriptions: [
      { id: 1101, name: 'Paupière supérieure' },
      { id: 1102, name: 'Paupière inférieure' },
      { id: 1103, name: 'Interne' },
      { id: 1104, name: 'Externe' },
      { id: 1105, name: 'Central' },
      { id: 1106, name: 'Bilatéral' },
      { id: 1107, name: 'Incision drainage effectuée' },
      { id: 1108, name: 'Indication chirurgicale' },
      { id: 1109, name: 'Traitement médical' },
    ],
  },

  // ===== UVÉITE =====
  'Uvéite': {
    symptoms: [
      { id: 120, name: 'Uvéite antérieure' },
      { id: 121, name: 'Uvéite intermédiaire' },
      { id: 122, name: 'Uvéite postérieure' },
      { id: 123, name: 'Panuvéite' },
      { id: 124, name: 'Tyndall' },
      { id: 125, name: 'Précipités rétro-cornéens' },
      { id: 126, name: 'Synéchies' },
      { id: 127, name: 'Hyalite' },
      { id: 128, name: 'Vascularite' },
    ],
    descriptions: [
      { id: 1201, name: 'Tyndall +' },
      { id: 1202, name: 'Tyndall ++' },
      { id: 1203, name: 'Tyndall +++' },
      { id: 1204, name: 'Flare +' },
      { id: 1205, name: 'Granulomateuse' },
      { id: 1206, name: 'Non granulomateuse' },
      { id: 1207, name: 'Récidivante' },
      { id: 1208, name: 'Bilan étiologique en cours' },
      { id: 1209, name: 'HLA-B27 positif' },
      { id: 1210, name: 'Idiopathique' },
    ],
  },

  // ===== HTA =====
  'HTA': {
    symptoms: [
      { id: 130, name: 'Rétinopathie hypertensive' },
      { id: 131, name: 'Signe du croisement' },
      { id: 132, name: 'Rétrécissement artériolaire' },
      { id: 133, name: 'Hémorragies en flammèches' },
      { id: 134, name: 'Nodules cotonneux' },
      { id: 135, name: 'Exsudats' },
      { id: 136, name: 'Œdème papillaire' },
      { id: 137, name: 'Étoile maculaire' },
    ],
    descriptions: [
      { id: 1301, name: 'Stade I (Gnn)' },
      { id: 1302, name: 'Stade II (Salus)' },
      { id: 1303, name: 'Stade III' },
      { id: 1304, name: 'Stade IV (maligne)' },
      { id: 1305, name: 'HTA contrôlée' },
      { id: 1306, name: 'HTA non contrôlée' },
      { id: 1307, name: 'Avis cardiologique' },
    ],
  },

  // ===== GONIOSCOPIE =====
  'GONIOSCOPIE': {
    symptoms: [
      { id: 140, name: 'Angle ouvert' },
      { id: 141, name: 'Angle étroit' },
      { id: 142, name: 'Angle fermé' },
      { id: 143, name: 'Synéchies antérieures' },
      { id: 144, name: 'Néovaisseaux' },
      { id: 145, name: 'Pigmentation' },
      { id: 146, name: 'Pseudoexfoliation' },
    ],
    descriptions: [
      { id: 1401, name: 'Grade 0 (fermé)' },
      { id: 1402, name: 'Grade 1 (anneau de Schwalbe)' },
      { id: 1403, name: 'Grade 2 (trabéculum antérieur)' },
      { id: 1404, name: 'Grade 3 (éperon scléral)' },
      { id: 1405, name: 'Grade 4 (corps ciliaire)' },
      { id: 1406, name: 'Pigmentation 0-4' },
      { id: 1407, name: 'Iridotomie indiquée' },
      { id: 1408, name: 'Post-iridotomie' },
    ],
  },

  // ===== CHAMP VISUEL =====
  'champ visuel': {
    symptoms: [
      { id: 150, name: 'Scotome' },
      { id: 151, name: 'Ressaut nasal' },
      { id: 152, name: 'Déficit arciforme' },
      { id: 153, name: 'Hémianopsie' },
      { id: 154, name: 'Quadranopsie' },
      { id: 155, name: 'Scotome central' },
      { id: 156, name: 'Rétrécissement concentrique' },
      { id: 157, name: 'Normal' },
    ],
    descriptions: [
      { id: 1501, name: 'MD normal' },
      { id: 1502, name: 'MD limite' },
      { id: 1503, name: 'MD modérément abaissé' },
      { id: 1504, name: 'MD sévèrement abaissé' },
      { id: 1505, name: 'Progression' },
      { id: 1506, name: 'Stable' },
      { id: 1507, name: 'Fiable' },
      { id: 1508, name: 'Non fiable' },
      { id: 1509, name: 'À recontrôler' },
    ],
  },

  // ===== CHIRURGIE DE CATARACTE =====
  'Chirurgie de cataracte': {
    symptoms: [
      { id: 160, name: 'Post-opératoire J1' },
      { id: 161, name: 'Post-opératoire J7' },
      { id: 162, name: 'Post-opératoire J30' },
      { id: 163, name: 'Implant en place' },
      { id: 164, name: 'Capsule postérieure intacte' },
      { id: 165, name: 'Opacification capsulaire' },
      { id: 166, name: 'Œdème maculaire cystoïde' },
      { id: 167, name: 'Décollement de rétine' },
      { id: 168, name: 'Endophtalmie' },
    ],
    descriptions: [
      { id: 1601, name: 'Évolution favorable' },
      { id: 1602, name: 'Segment antérieur calme' },
      { id: 1603, name: 'Implant bien centré' },
      { id: 1604, name: 'FO normal' },
      { id: 1605, name: 'Œdème cornéen résiduel' },
      { id: 1606, name: 'Légère inflammation' },
      { id: 1607, name: 'Capsulotomie YAG indiquée' },
      { id: 1608, name: 'Capsulotomie YAG effectuée' },
      { id: 1609, name: 'Prescription post-op remise' },
    ],
  },

  // ===== AV/RPM =====
  'AV/RPM': {
    symptoms: [
      { id: 170, name: 'Acuité visuelle de loin' },
      { id: 171, name: 'Acuité visuelle de près' },
      { id: 172, name: 'Réflexe photomoteur direct' },
      { id: 173, name: 'Réflexe photomoteur consensuel' },
      { id: 174, name: 'Déficit pupillaire afférent relatif' },
    ],
    descriptions: [
      { id: 1701, name: '10/10' },
      { id: 1702, name: '8/10' },
      { id: 1703, name: '5/10' },
      { id: 1704, name: '< 1/10' },
      { id: 1705, name: 'CLD' },
      { id: 1706, name: 'VBLM' },
      { id: 1707, name: 'PL+' },
      { id: 1708, name: 'PL-' },
      { id: 1709, name: 'P2' },
      { id: 1710, name: 'P4' },
      { id: 1711, name: 'P6' },
      { id: 1712, name: 'RPM normal' },
      { id: 1713, name: 'Marcus-Gunn +' },
    ],
  },

  // ===== INSPECT/OCME =====
  'Inspect/OCME': {
    symptoms: [
      { id: 180, name: 'Position des globes' },
      { id: 181, name: 'Exophtalmie' },
      { id: 182, name: 'Énophtalmie' },
      { id: 183, name: 'Strabisme' },
      { id: 184, name: 'Nystagmus' },
      { id: 185, name: 'Motilité oculaire' },
    ],
    descriptions: [
      { id: 1801, name: 'Normal' },
      { id: 1802, name: 'Ésotropie' },
      { id: 1803, name: 'Exotropie' },
      { id: 1804, name: 'Hypertropie' },
      { id: 1805, name: 'Hypotropie' },
      { id: 1806, name: 'Limitation supérieure' },
      { id: 1807, name: 'Limitation inférieure' },
      { id: 1808, name: 'Limitation latérale' },
      { id: 1809, name: 'Paralysie du III' },
      { id: 1810, name: 'Paralysie du IV' },
      { id: 1811, name: 'Paralysie du VI' },
    ],
  },
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: `1px solid ${colors.gray[300]}`,
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 200ms, box-shadow 200ms',
  },
  inputFocus: {
    borderColor: colors.primary[500],
    boxShadow: `0 0 0 3px ${colors.primary[500]}30`,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: `1px solid ${colors.gray[300]}`,
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 200ms',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 200ms',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    borderRadius: '9999px',
    cursor: 'pointer',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    minHeight: '44px',
    fontSize: '14px',
    textAlign: 'left',
    border: 'none',
    borderBottom: `1px solid ${colors.gray[200]}`,
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 150ms',
  },
  textarea: {
    width: '100%',
    minHeight: '150px',
    padding: '12px',
    fontSize: '14px',
    border: `1px solid ${colors.gray[300]}`,
    borderRadius: '6px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PathologyPicker = ({
  value = {},
  onChange,
  dominante = '',
  onDominanteChange,
  disabled = false,
  height = 600,
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState('LAF');
  const [selectedSymptom, setSelectedSymptom] = useState(null);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState(value.diagnoses || []);
  const [observationText, setObservationText] = useState(value.observation || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLaterality, setSelectedLaterality] = useState('OU');
  const [toast, setToast] = useState(null);

  // Get templates for selected category
  const categoryTemplates = useMemo(() => {
    return SYMPTOM_TEMPLATES[selectedCategory] || { symptoms: [], descriptions: [] };
  }, [selectedCategory]);

  // Get diagnoses for selected category
  const categoryDiagnoses = useMemo(() => {
    return COMMON_DIAGNOSES[selectedCategory] || COMMON_DIAGNOSES['Normal'] || [];
  }, [selectedCategory]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return PATHOLOGY_CATEGORIES;
    return PATHOLOGY_CATEGORIES.filter(cat =>
      cat.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  // Handle symptom click
  const handleSymptomClick = useCallback((symptom) => {
    setSelectedSymptom(symptom);
  }, []);

  // Handle description click - append to observation
  const handleDescriptionClick = useCallback((description) => {
    const lateralityText = selectedLaterality === 'OD' ? 'OD' :
                          selectedLaterality === 'OS' ? 'OG' : 'O.D.G';

    let textToAdd = '';
    if (selectedSymptom) {
      textToAdd = `${selectedSymptom.name}: ${description.name} ${lateralityText}`;
    } else {
      textToAdd = `${description.name} ${lateralityText}`;
    }

    setObservationText(prev => {
      const newText = prev ? `${prev}\n${textToAdd}` : textToAdd;
      onChange?.({ ...value, observation: newText, diagnoses: selectedDiagnoses });
      return newText;
    });

    showToast(`Ajouté: ${textToAdd}`);
  }, [selectedSymptom, selectedLaterality, selectedDiagnoses, value, onChange]);

  // Handle diagnosis selection
  const handleDiagnosisClick = useCallback((diagnosis) => {
    setSelectedDiagnoses(prev => {
      const exists = prev.find(d => d.code === diagnosis.code && d.name === diagnosis.name);
      let newDiagnoses;
      if (exists) {
        newDiagnoses = prev.filter(d => !(d.code === diagnosis.code && d.name === diagnosis.name));
      } else {
        newDiagnoses = [...prev, { ...diagnosis, laterality: selectedLaterality }];
      }
      onChange?.({ ...value, observation: observationText, diagnoses: newDiagnoses });
      return newDiagnoses;
    });
  }, [selectedLaterality, value, observationText, onChange]);

  // Handle observation text change
  const handleObservationChange = useCallback((e) => {
    setObservationText(e.target.value);
    onChange?.({ ...value, observation: e.target.value, diagnoses: selectedDiagnoses });
  }, [value, selectedDiagnoses, onChange]);

  // Clear observation
  const handleClearObservation = useCallback(() => {
    setObservationText('');
    onChange?.({ ...value, observation: '', diagnoses: selectedDiagnoses });
  }, [value, selectedDiagnoses, onChange]);

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(observationText);
    showToast('Copié dans le presse-papiers');
  }, [observationText]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            padding: '12px 20px',
            background: toast.type === 'success' ? colors.success.main : colors.info.main,
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            animation: 'fadeIn 200ms ease',
          }}
        >
          {toast.message}
        </div>
      )}

      <ColumnLayout columns={3} height={height} showMobileNav>
        {/* LEFT COLUMN - Categories */}
        <ColumnLayout.Column variant="category" label="Catégories">
          {/* Dominante Dropdown */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${colors.gray[300]}` }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
              Dominante
            </label>
            <select
              style={styles.select}
              value={dominante}
              onChange={(e) => onDominanteChange?.(e.target.value)}
              disabled={disabled}
            >
              <option value="">Sélectionner...</option>
              {DOMINANTE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Category Search */}
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.gray[300]}` }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.gray[400],
                }}
              />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...styles.input, paddingLeft: '36px' }}
              />
            </div>
          </div>

          {/* Category List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredCategories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  ...styles.listItem,
                  background: selectedCategory === category.id ? colors.primary[600] : 'transparent',
                  color: selectedCategory === category.id ? 'white' : colors.gray[800],
                  fontWeight: selectedCategory === category.id ? '600' : '400',
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== category.id) {
                    e.currentTarget.style.background = colors.gray[100];
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== category.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {category.label}
              </button>
            ))}
          </div>
        </ColumnLayout.Column>

        {/* CENTER COLUMN - Symptoms & Descriptions */}
        <ColumnLayout.Column variant="selection" label="Symptômes">
          {/* Laterality Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: `1px solid ${colors.gray[300]}`,
              background: colors.studio.selection.bg,
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '500' }}>Latéralité:</span>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${colors.gray[300]}` }}>
              {LATERALITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedLaterality(opt.value)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: '500',
                    border: 'none',
                    background: selectedLaterality === opt.value
                      ? opt.value === 'OD' ? colors.medical.od
                      : opt.value === 'OS' ? colors.medical.os
                      : colors.medical.ou
                      : 'white',
                    color: selectedLaterality === opt.value ? 'white' : colors.gray[700],
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  {opt.short}
                </button>
              ))}
            </div>
          </div>

          {/* Split: Symptoms | Descriptions */}
          <ColumnLayout.SubColumns columns={2}>
            {/* Symptoms */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <ColumnLayout.SectionHeader>Symptômes</ColumnLayout.SectionHeader>
              <div style={{ flex: 1, overflowY: 'auto', background: colors.gray[50] }}>
                {categoryTemplates.symptoms.map(symptom => (
                  <button
                    key={symptom.id}
                    onClick={() => handleSymptomClick(symptom)}
                    style={{
                      ...styles.listItem,
                      fontSize: '13px',
                      minHeight: '38px',
                      background: selectedSymptom?.id === symptom.id ? colors.primary[500] : 'transparent',
                      color: selectedSymptom?.id === symptom.id ? 'white' : colors.gray[800],
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSymptom?.id !== symptom.id) {
                        e.currentTarget.style.background = colors.gray[200];
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSymptom?.id !== symptom.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {symptom.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Descriptions */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <ColumnLayout.SectionHeader>Description</ColumnLayout.SectionHeader>
              <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
                {categoryTemplates.descriptions.map(desc => (
                  <button
                    key={desc.id}
                    onClick={() => handleDescriptionClick(desc)}
                    style={{
                      ...styles.listItem,
                      fontSize: '13px',
                      minHeight: '38px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.primary[50];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Plus size={14} style={{ color: colors.primary[500], flexShrink: 0 }} />
                    {desc.name}
                  </button>
                ))}
              </div>
            </div>
          </ColumnLayout.SubColumns>
        </ColumnLayout.Column>

        {/* RIGHT COLUMN - Diagnostic & Notes */}
        <ColumnLayout.Column variant="summary" label="Diagnostic">
          {/* Renewal Button */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.gray[300]}` }}>
            <button
              style={{
                ...styles.button,
                width: '100%',
                background: 'white',
                border: `1px solid ${colors.gray[300]}`,
                color: colors.gray[700],
              }}
              disabled={disabled}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.gray[100];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              <RefreshCw size={16} />
              Renouvellement pathologie précédente
            </button>
          </div>

          {/* Diagnostic List */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.gray[300]}` }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Diagnostic</div>
            <div
              style={{
                background: 'white',
                border: `1px solid ${colors.gray[300]}`,
                borderRadius: '6px',
                maxHeight: '140px',
                overflowY: 'auto',
              }}
            >
              {categoryDiagnoses.map((diagnosis, idx) => {
                const isSelected = selectedDiagnoses.find(d => d.code === diagnosis.code && d.name === diagnosis.name);
                return (
                  <button
                    key={`${diagnosis.code}-${idx}`}
                    onClick={() => handleDiagnosisClick(diagnosis)}
                    style={{
                      ...styles.listItem,
                      fontSize: '13px',
                      minHeight: '36px',
                      background: isSelected ? colors.primary[100] : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = colors.gray[100];
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {isSelected && <Check size={14} style={{ color: colors.success.main, flexShrink: 0 }} />}
                    <span style={{ flex: 1 }}>{diagnosis.name}</span>
                    <span style={{ fontSize: '11px', color: colors.gray[500] }}>{diagnosis.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Diagnoses Badges */}
          {selectedDiagnoses.length > 0 && (
            <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedDiagnoses.map((d, i) => (
                <span
                  key={`${d.code}-${i}`}
                  onClick={() => handleDiagnosisClick(d)}
                  style={{
                    ...styles.badge,
                    background: colors.primary[100],
                    color: colors.primary[800],
                  }}
                >
                  {d.name} ({d.laterality || 'OU'})
                  <X size={12} />
                </span>
              ))}
            </div>
          )}

          {/* Observation Notes */}
          <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Rédaction de l'observation</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={handleCopy}
                  style={styles.iconButton}
                  title="Copier"
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.gray[200]}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={handleClearObservation}
                  style={{ ...styles.iconButton, color: colors.error.main }}
                  title="Effacer"
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.error.light}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={observationText}
              onChange={handleObservationChange}
              placeholder="L'observation s'affiche ici automatiquement en cliquant sur les symptômes et descriptions..."
              style={{ ...styles.textarea, flex: 1 }}
              disabled={disabled}
            />
          </div>
        </ColumnLayout.Column>
      </ColumnLayout>
    </div>
  );
};

// ============================================================================
// SUMMARY COMPONENT
// ============================================================================

export const PathologySummary = ({
  observation,
  diagnoses = [],
  dominante,
}) => {
  return (
    <div
      style={{
        padding: '16px',
        background: colors.gray[50],
        borderRadius: '8px',
        border: `1px solid ${colors.gray[200]}`,
      }}
    >
      {dominante && (
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: '500', marginRight: '8px' }}>Dominante:</span>
          <span
            style={{
              ...styles.badge,
              background: colors.studio.category.bg,
              color: colors.studio.category.text,
            }}
          >
            {dominante}
          </span>
        </div>
      )}

      {diagnoses.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Diagnostics:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {diagnoses.map((d, i) => (
              <span
                key={i}
                style={{
                  ...styles.badge,
                  background: colors.primary[100],
                  color: colors.primary[800],
                }}
              >
                {d.name} ({d.laterality || 'OU'})
              </span>
            ))}
          </div>
        </div>
      )}

      {observation && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Observation:</div>
          <div
            style={{
              fontSize: '13px',
              color: colors.gray[600],
              whiteSpace: 'pre-wrap',
              lineHeight: '1.5',
            }}
          >
            {observation}
          </div>
        </div>
      )}
    </div>
  );
};

// Export constants
export {
  PATHOLOGY_CATEGORIES,
  DOMINANTE_OPTIONS,
  LATERALITY_OPTIONS,
  SEVERITY_OPTIONS,
  COMMON_DIAGNOSES,
};

export default PathologyPicker;
