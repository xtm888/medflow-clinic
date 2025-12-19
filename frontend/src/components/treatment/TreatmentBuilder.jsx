/**
 * TreatmentBuilder Component
 *
 * StudioVision Parity: 4-Column Treatment/Prescription Builder
 * Now using unified design system with responsive ColumnLayout.
 *
 * Layout:
 * - COLUMN 1 (Purple): Medication categories
 * - COLUMN 2 (Green): Drug brand names (Vidal)
 * - COLUMN 3 (Yellow): Dose | Posologie | Détails
 * - COLUMN 4 (Gray): Duration + Standard treatments + options
 * - BOTTOM (Cyan): Active prescription display with tabs
 *
 * Features:
 * - Click-to-add medication building
 * - Standard treatment protocols quick-select
 * - Multiple ordonnance tabs
 * - Print options (Simple, Dupli, Double, etc.)
 * - Responsive: columns become tabs on mobile
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Printer,
  Eye,
  X,
  RefreshCw,
  History,
  Clock,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import ColumnLayout from '../layout/ColumnLayout';
import { colors } from '../../styles/designTokens';

// ============================================================================
// CONSTANTS
// ============================================================================

const MEDICATION_CATEGORIES = [
  { id: 'Maquettes', label: 'Maquettes' },
  { id: 'AINS-Generaux', label: 'A.I.N.S-Généraux' },
  { id: 'Antalgiques', label: 'Antalgiques' },
  { id: 'Antibiotiques-Generaux', label: 'Antibiotiques Généraux' },
  { id: 'Anti-cataracte', label: 'Anti-cataracte' },
  { id: 'Anti-glaucomateux', label: 'Anti-glaucomateux' },
  { id: 'Anti-histaminiques', label: 'Anti-histaminiques' },
  { id: 'Anti-Inflammatoire', label: 'Anti-Inflammatoire' },
  { id: 'Antioxydants', label: 'Antioxydants' },
  { id: 'Antisept-Avec-Vaso', label: 'Antisept Avec Vasocons' },
  { id: 'Antisept-Sans-Vaso', label: 'Antisept Sans Vasocons' },
  { id: 'Anti-viraux', label: 'Anti-viraux' },
  { id: 'Cicatrisants', label: 'Cicatrisants' },
  { id: 'Collyres-AINS', label: 'Collyres A.I.N.S' },
  { id: 'Collyres-Antiallergiques', label: 'Collyres Antiallergiques' },
  { id: 'Collyres-Antibio-Cortico', label: 'Collyres Antibio/Cortico' },
  { id: 'Collyres-Antibiotiques', label: 'Collyres Antibiotiques' },
  { id: 'Collyres-Antiseptiques', label: 'Collyres Antiseptiques' },
  { id: 'Collyres-Beta-bloquants', label: 'Collyres Béta-bloquants' },
  { id: 'Corticoides-Generaux', label: 'Corticoïdes Généraux' },
  { id: 'Corticoides-Locaux', label: 'Corticoïdes locaux' },
  { id: 'Divers-OPH', label: 'Divers OPH' },
  { id: 'Larmes-Lotions', label: 'Larmes Lotions Contacto' },
  { id: 'Mydriatiques', label: 'Mydriatiques' },
  { id: 'Pommades-Antibio-Cortico', label: 'Pommades Antibio/Cortico' },
  { id: 'Pommades-Antibiotiques', label: 'Pommades Antibiotiques' },
  { id: 'Vasculotropes', label: 'Vasculotropes' },
];

const DRUG_DATABASE = {
  // ============================================================================
  // MAQUETTES - Pre-configured treatment templates
  // ============================================================================
  'Maquettes': [
    { id: 1000, name: 'POST-OP CATARACTE J1', generic: 'Protocole post-opératoire cataracte standard' },
    { id: 1001, name: 'POST-OP CATARACTE J8', generic: 'Protocole post-opératoire cataracte semaine' },
    { id: 1002, name: 'POST-OP GLAUCOME', generic: 'Protocole post-opératoire glaucome' },
    { id: 1003, name: 'POST-IVT', generic: 'Protocole post-injection intravitréenne' },
    { id: 1004, name: 'POST-LASER YAG', generic: 'Protocole post-capsulotomie YAG' },
    { id: 1005, name: 'POST-LASER ARGON', generic: 'Protocole post-photocoagulation' },
    { id: 1006, name: 'CONJONCTIVITE VIRALE', generic: 'Protocole conjonctivite virale standard' },
    { id: 1007, name: 'CONJONCTIVITE BACTERIENNE', generic: 'Protocole conjonctivite bactérienne' },
    { id: 1008, name: 'CHALAZION', generic: 'Protocole chalazion standard' },
    { id: 1009, name: 'SECHERESSE MODEREE', generic: 'Protocole sécheresse oculaire modérée' },
    { id: 1010, name: 'SECHERESSE SEVERE', generic: 'Protocole sécheresse oculaire sévère' },
    { id: 1011, name: 'ALLERGIE SAISONNIERE', generic: 'Protocole allergie oculaire saisonnière' },
  ],

  // ============================================================================
  // AINS-GENERAUX - Anti-inflammatoires non stéroïdiens systémiques
  // ============================================================================
  'AINS-Generaux': [
    { id: 100, name: 'IBUPROFENE 400', generic: 'Ibuprofène 400mg' },
    { id: 101, name: 'IBUPROFENE 200', generic: 'Ibuprofène 200mg' },
    { id: 102, name: 'ADVIL', generic: 'Ibuprofène' },
    { id: 103, name: 'NUROFEN', generic: 'Ibuprofène' },
    { id: 104, name: 'KETOPROFENE', generic: 'Kétoprofène 100mg' },
    { id: 105, name: 'PROFENID', generic: 'Kétoprofène' },
    { id: 106, name: 'DICLOFENAC', generic: 'Diclofénac 50mg' },
    { id: 107, name: 'VOLTARENE', generic: 'Diclofénac' },
    { id: 108, name: 'NAPROXENE', generic: 'Naproxène 500mg' },
    { id: 109, name: 'APRANAX', generic: 'Naproxène sodique' },
    { id: 110, name: 'PIROXICAM', generic: 'Piroxicam 20mg' },
    { id: 111, name: 'FELDENE', generic: 'Piroxicam' },
    { id: 112, name: 'CELECOXIB', generic: 'Célécoxib 200mg' },
    { id: 113, name: 'CELEBREX', generic: 'Célécoxib' },
  ],

  // ============================================================================
  // ANTALGIQUES - Pain relievers
  // ============================================================================
  'Antalgiques': [
    { id: 120, name: 'PARACETAMOL 1G', generic: 'Paracétamol 1000mg' },
    { id: 121, name: 'PARACETAMOL 500', generic: 'Paracétamol 500mg' },
    { id: 122, name: 'DOLIPRANE', generic: 'Paracétamol' },
    { id: 123, name: 'EFFERALGAN', generic: 'Paracétamol effervescent' },
    { id: 124, name: 'DAFALGAN', generic: 'Paracétamol' },
    { id: 125, name: 'TRAMADOL 50', generic: 'Tramadol 50mg' },
    { id: 126, name: 'TRAMADOL 100 LP', generic: 'Tramadol 100mg LP' },
    { id: 127, name: 'CONTRAMAL', generic: 'Tramadol' },
    { id: 128, name: 'TOPALGIC', generic: 'Tramadol' },
    { id: 129, name: 'IXPRIM', generic: 'Paracétamol + Tramadol' },
    { id: 130, name: 'CODOLIPRANE', generic: 'Paracétamol + Codéine' },
    { id: 131, name: 'EFFERALGAN CODEINE', generic: 'Paracétamol + Codéine' },
    { id: 132, name: 'LAMALINE', generic: 'Paracétamol + Opium + Caféine' },
    { id: 133, name: 'ACUPAN', generic: 'Néfopam' },
    { id: 134, name: 'IZALGI', generic: 'Paracétamol + Opium' },
  ],

  // ============================================================================
  // ANTIBIOTIQUES-GENERAUX - Systemic antibiotics
  // ============================================================================
  'Antibiotiques-Generaux': [
    { id: 140, name: 'AMOXICILLINE 1G', generic: 'Amoxicilline 1000mg' },
    { id: 141, name: 'AMOXICILLINE 500', generic: 'Amoxicilline 500mg' },
    { id: 142, name: 'CLAMOXYL', generic: 'Amoxicilline' },
    { id: 143, name: 'AUGMENTIN 1G', generic: 'Amoxicilline + Acide clavulanique' },
    { id: 144, name: 'AUGMENTIN 500', generic: 'Amoxicilline + Acide clavulanique' },
    { id: 145, name: 'AZITHROMYCINE 250', generic: 'Azithromycine 250mg' },
    { id: 146, name: 'ZITHROMAX', generic: 'Azithromycine' },
    { id: 147, name: 'DOXYCYCLINE 100', generic: 'Doxycycline 100mg' },
    { id: 148, name: 'VIBRAMYCINE', generic: 'Doxycycline' },
    { id: 149, name: 'CIPROFLOXACINE 500', generic: 'Ciprofloxacine 500mg' },
    { id: 150, name: 'CIFLOX', generic: 'Ciprofloxacine' },
    { id: 151, name: 'OFLOXACINE 200', generic: 'Ofloxacine 200mg' },
    { id: 152, name: 'OFLOCET', generic: 'Ofloxacine' },
    { id: 153, name: 'LEVOFLOXACINE 500', generic: 'Lévofloxacine 500mg' },
    { id: 154, name: 'TAVANIC', generic: 'Lévofloxacine' },
    { id: 155, name: 'PRISTINAMYCINE', generic: 'Pristinamycine 500mg' },
    { id: 156, name: 'PYOSTACINE', generic: 'Pristinamycine' },
  ],

  // ============================================================================
  // ANTI-CATARACTE - Cataract prevention/treatment
  // ============================================================================
  'Anti-cataracte': [
    { id: 160, name: 'CATARSTAT', generic: 'Pirenoxine' },
    { id: 161, name: 'QUINAX', generic: 'Azapentacène' },
    { id: 162, name: 'DULCIPHAK', generic: 'Pirenoxine' },
    { id: 163, name: 'VITREOLENT', generic: 'Iodure de potassium' },
  ],

  // ============================================================================
  // ANTI-GLAUCOMATEUX - Glaucoma treatments
  // ============================================================================
  'Anti-glaucomateux': [
    { id: 20, name: 'XALATAN', generic: 'Latanoprost' },
    { id: 21, name: 'LUMIGAN', generic: 'Bimatoprost' },
    { id: 22, name: 'TRAVATAN', generic: 'Travoprost' },
    { id: 23, name: 'TIMOPTOL', generic: 'Timolol' },
    { id: 24, name: 'AZOPT', generic: 'Brinzolamide' },
    { id: 25, name: 'COSOPT', generic: 'Dorzolamide + Timolol' },
    { id: 26, name: 'GANFORT', generic: 'Bimatoprost + Timolol' },
    { id: 27, name: 'XALACOM', generic: 'Latanoprost + Timolol' },
    { id: 28, name: 'DUOTRAV', generic: 'Travoprost + Timolol' },
    { id: 29, name: 'TRUSOPT', generic: 'Dorzolamide' },
    { id: 200, name: 'ALPHAGAN', generic: 'Brimonidine' },
    { id: 201, name: 'COMBIGAN', generic: 'Brimonidine + Timolol' },
    { id: 202, name: 'SIMBRINZA', generic: 'Brinzolamide + Brimonidine' },
    { id: 203, name: 'BETOPTIC', generic: 'Bétaxolol' },
    { id: 204, name: 'PILOCARPINE', generic: 'Pilocarpine' },
    { id: 205, name: 'DIAMOX', generic: 'Acétazolamide' },
    { id: 206, name: 'MONOPROST', generic: 'Latanoprost sans conservateur' },
    { id: 207, name: 'TAFLOTAN', generic: 'Tafluprost' },
    { id: 208, name: 'ROCLANDA', generic: 'Latanoprost + Nétarsudil' },
  ],

  // ============================================================================
  // ANTI-HISTAMINIQUES - Antihistamines systemic
  // ============================================================================
  'Anti-histaminiques': [
    { id: 170, name: 'CETIRIZINE 10', generic: 'Cétirizine 10mg' },
    { id: 171, name: 'ZYRTEC', generic: 'Cétirizine' },
    { id: 172, name: 'VIRLIX', generic: 'Cétirizine' },
    { id: 173, name: 'LORATADINE 10', generic: 'Loratadine 10mg' },
    { id: 174, name: 'CLARITYNE', generic: 'Loratadine' },
    { id: 175, name: 'DESLORATADINE 5', generic: 'Desloratadine 5mg' },
    { id: 176, name: 'AERIUS', generic: 'Desloratadine' },
    { id: 177, name: 'FEXOFENADINE 180', generic: 'Fexofénadine 180mg' },
    { id: 178, name: 'TELFAST', generic: 'Fexofénadine' },
    { id: 179, name: 'BILASKA', generic: 'Bilastine 20mg' },
    { id: 180, name: 'LEVOCETIRIZINE 5', generic: 'Lévocétirizine 5mg' },
    { id: 181, name: 'XYZALL', generic: 'Lévocétirizine' },
    { id: 182, name: 'EBASTINE 10', generic: 'Ébastine 10mg' },
    { id: 183, name: 'KESTIN', generic: 'Ébastine' },
  ],

  // ============================================================================
  // ANTI-INFLAMMATOIRE - Anti-inflammatory local (non-ophthalmic)
  // ============================================================================
  'Anti-Inflammatoire': [
    { id: 185, name: 'PREDNISOLONE 20', generic: 'Prednisolone 20mg' },
    { id: 186, name: 'SOLUPRED', generic: 'Prednisolone' },
    { id: 187, name: 'PREDNISONE 5', generic: 'Prednisone 5mg' },
    { id: 188, name: 'CORTANCYL', generic: 'Prednisone' },
    { id: 189, name: 'METHYLPREDNISOLONE 16', generic: 'Méthylprednisolone 16mg' },
    { id: 190, name: 'MEDROL', generic: 'Méthylprednisolone' },
    { id: 191, name: 'BETAMETHASONE', generic: 'Bétaméthasone' },
    { id: 192, name: 'CELESTENE', generic: 'Bétaméthasone' },
    { id: 193, name: 'DEXAMETHASONE 0.5', generic: 'Dexaméthasone 0.5mg' },
    { id: 194, name: 'DECTANCYL', generic: 'Dexaméthasone' },
  ],

  // ============================================================================
  // ANTIOXYDANTS - Antioxidants / vitamins
  // ============================================================================
  'Antioxydants': [
    { id: 210, name: 'NUTROF TOTAL', generic: 'Lutéine + Zéaxanthine + Oméga-3' },
    { id: 211, name: 'PRESERVISION', generic: 'AREDS2 formula' },
    { id: 212, name: 'VITALUX PLUS', generic: 'Lutéine + Vitamines + Minéraux' },
    { id: 213, name: 'MACULA Z', generic: 'Lutéine + Zéaxanthine + Zinc' },
    { id: 214, name: 'AREDS FORMULA', generic: 'Vitamines C, E + Zinc + Cuivre' },
    { id: 215, name: 'OCUVITE', generic: 'Lutéine + Zéaxanthine + Oméga-3' },
    { id: 216, name: 'OPHTALMINE', generic: 'Vitamines A, B, E + Oligo-éléments' },
    { id: 217, name: 'SANTE VERTE', generic: 'Lutéine + Myrtille' },
    { id: 218, name: 'VISIOPREV DUO', generic: 'Lutéine + DHA' },
    { id: 219, name: 'CENTROVISION', generic: 'Lutéine + Zéaxanthine' },
  ],

  // ============================================================================
  // ANTISEPT-AVEC-VASO - Antiseptics with vasoconstrictor
  // ============================================================================
  'Antisept-Avec-Vaso': [
    { id: 220, name: 'COLLYRE BLEU', generic: 'Naphazoline + Bleu méthylène' },
    { id: 221, name: 'DACRYOSERUM', generic: 'Benzalkonium + Naphazoline' },
    { id: 222, name: 'OPTREX', generic: 'Naphazoline + Hamamelis' },
    { id: 223, name: 'BIOCIDAN', generic: 'Céthéxonium + Phényléphrine' },
    { id: 224, name: 'SEDACOLLYRE', generic: 'Céthéxonium + Naphazoline' },
  ],

  // ============================================================================
  // ANTISEPT-SANS-VASO - Antiseptics without vasoconstrictor
  // ============================================================================
  'Antisept-Sans-Vaso': [
    { id: 230, name: 'VITABACT', generic: 'Picloxydine' },
    { id: 231, name: 'DESOMEDINE', generic: 'Hexamidine' },
    { id: 232, name: 'MONOSEPT', generic: 'Céthéxonium unidose' },
    { id: 233, name: 'BIOCIDAN UNIDOSE', generic: 'Céthéxonium sans conservateur' },
    { id: 234, name: 'NOVOPTINE', generic: 'Oxyde mercurique jaune' },
  ],

  // ============================================================================
  // ANTI-VIRAUX - Antivirals
  // ============================================================================
  'Anti-viraux': [
    { id: 240, name: 'ZOVIRAX OPHT', generic: 'Aciclovir pommade ophtalmique' },
    { id: 241, name: 'VIRGAN', generic: 'Ganciclovir gel ophtalmique' },
    { id: 242, name: 'ACICLOVIR 200', generic: 'Aciclovir 200mg comprimé' },
    { id: 243, name: 'ACICLOVIR 800', generic: 'Aciclovir 800mg comprimé' },
    { id: 244, name: 'ZELITREX 500', generic: 'Valaciclovir 500mg' },
    { id: 245, name: 'ZELITREX 1000', generic: 'Valaciclovir 1000mg' },
    { id: 246, name: 'VALACICLOVIR 500', generic: 'Valaciclovir 500mg' },
    { id: 247, name: 'FAMVIR 500', generic: 'Famciclovir 500mg' },
  ],

  // ============================================================================
  // CICATRISANTS - Healing agents
  // ============================================================================
  'Cicatrisants': [
    { id: 60, name: 'VITAMINE A DULCIS', generic: 'Rétinol' },
    { id: 61, name: 'LIPOSIC', generic: 'Carbomère' },
    { id: 62, name: 'LACRIGEL', generic: 'Carbomère' },
    { id: 63, name: 'VITA-POS', generic: 'Vitamine A palmitate' },
    { id: 64, name: 'RECUGEL', generic: 'Dexpanthénol' },
    { id: 65, name: 'CORNEREGEL', generic: 'Dexpanthénol' },
    { id: 66, name: 'BEPANTHEN COLLYRE', generic: 'Dexpanthénol' },
    { id: 67, name: 'EPITELIALE AH', generic: 'Acide hyaluronique' },
  ],

  // ============================================================================
  // COLLYRES-AINS - Ophthalmic NSAIDs
  // ============================================================================
  'Collyres-AINS': [
    { id: 250, name: 'INDOCOLLYRE', generic: 'Indométacine' },
    { id: 251, name: 'OCUFEN', generic: 'Flurbiprofène' },
    { id: 252, name: 'VOLTARENE OPHTA', generic: 'Diclofénac collyre' },
    { id: 253, name: 'ACULAR', generic: 'Kétorolac' },
    { id: 254, name: 'NEVANAC', generic: 'Népafénac' },
    { id: 255, name: 'YELLOX', generic: 'Bromfénac' },
    { id: 256, name: 'DICLOABAK', generic: 'Diclofénac sans conservateur' },
    { id: 257, name: 'FLURBIPROFENE UNIDOSE', generic: 'Flurbiprofène sans conservateur' },
  ],

  // ============================================================================
  // COLLYRES-ANTIALLERGIQUES - Anti-allergy eye drops
  // ============================================================================
  'Collyres-Antiallergiques': [
    { id: 260, name: 'OPATANOL', generic: 'Olopatadine' },
    { id: 261, name: 'ZADITEN', generic: 'Kétotifène' },
    { id: 262, name: 'ZALERG', generic: 'Kétotifène' },
    { id: 263, name: 'EMADINE', generic: 'Émédastine' },
    { id: 264, name: 'NAABAK', generic: 'Acide N-acétyl aspartyl glutamique' },
    { id: 265, name: 'CROMABAK', generic: 'Cromoglycate de sodium' },
    { id: 266, name: 'OPTICRON', generic: 'Cromoglycate de sodium' },
    { id: 267, name: 'ALLERGODIL', generic: 'Azélastine' },
    { id: 268, name: 'LEVOPHTA', generic: 'Lévocabastine' },
    { id: 269, name: 'LASTACAFT', generic: 'Alcaftadine' },
    { id: 270, name: 'PURIVIST', generic: 'Olopatadine 0.2%' },
  ],

  // ============================================================================
  // COLLYRES-ANTIBIO-CORTICO - Antibiotic + corticosteroid combinations
  // ============================================================================
  'Collyres-Antibio-Cortico': [
    { id: 1, name: 'TOBRADEX', generic: 'Tobramycine + Dexaméthasone' },
    { id: 2, name: 'MAXIDROL', generic: 'Dexaméthasone + Néomycine + Polymyxine B' },
    { id: 3, name: 'CHIBRO-CADRON', generic: 'Dexaméthasone + Néomycine' },
    { id: 4, name: 'FRAKIDEX', generic: 'Dexaméthasone + Framycétine' },
    { id: 5, name: 'STERDEX', generic: 'Dexaméthasone + Oxytétracycline' },
    { id: 6, name: 'TOBRADEX ST', generic: 'Tobramycine + Dexaméthasone suspension' },
    { id: 7, name: 'DEXAGRANE', generic: 'Dexaméthasone + Néomycine + Polymyxine B' },
  ],

  // ============================================================================
  // COLLYRES-ANTIBIOTIQUES - Antibiotic eye drops
  // ============================================================================
  'Collyres-Antibiotiques': [
    { id: 10, name: 'TOBREX', generic: 'Tobramycine' },
    { id: 11, name: 'CILOXAN', generic: 'Ciprofloxacine' },
    { id: 12, name: 'EXOCINE', generic: 'Ofloxacine' },
    { id: 13, name: 'AZYTER', generic: 'Azithromycine' },
    { id: 14, name: 'FUCITHALMIC', generic: 'Acide fusidique' },
    { id: 15, name: 'CHIBROXINE', generic: 'Norfloxacine' },
    { id: 16, name: 'RIFAMYCINE', generic: 'Rifamycine' },
    { id: 17, name: 'TOBRABACT', generic: 'Tobramycine sans conservateur' },
    { id: 18, name: 'QUINOFREE', generic: 'Ofloxacine sans conservateur' },
    { id: 19, name: 'VIGAMOX', generic: 'Moxifloxacine' },
  ],

  // ============================================================================
  // COLLYRES-ANTISEPTIQUES - Antiseptic eye drops
  // ============================================================================
  'Collyres-Antiseptiques': [
    { id: 280, name: 'VITABACT', generic: 'Picloxydine' },
    { id: 281, name: 'DESOMEDINE', generic: 'Hexamidine' },
    { id: 282, name: 'SOPHTAL', generic: 'Guanidine' },
    { id: 283, name: 'BIOCIDAN', generic: 'Céthéxonium' },
    { id: 284, name: 'SEDACOLLYRE', generic: 'Céthéxonium' },
  ],

  // ============================================================================
  // COLLYRES-BETA-BLOQUANTS - Beta-blocker eye drops
  // ============================================================================
  'Collyres-Beta-bloquants': [
    { id: 290, name: 'TIMOPTOL 0.25%', generic: 'Timolol 0.25%' },
    { id: 291, name: 'TIMOPTOL 0.5%', generic: 'Timolol 0.5%' },
    { id: 292, name: 'TIMOPTOL LP', generic: 'Timolol gel forming' },
    { id: 293, name: 'TIMABAK', generic: 'Timolol sans conservateur' },
    { id: 294, name: 'GELTIM', generic: 'Timolol gel sans conservateur' },
    { id: 295, name: 'BETOPTIC', generic: 'Bétaxolol' },
    { id: 296, name: 'BETOPTIC S', generic: 'Bétaxolol suspension' },
    { id: 297, name: 'CARTEOL 1%', generic: 'Cartéolol 1%' },
    { id: 298, name: 'CARTEOL 2%', generic: 'Cartéolol 2%' },
    { id: 299, name: 'CARTEOL LP', generic: 'Cartéolol LP' },
  ],

  // ============================================================================
  // CORTICOIDES-GENERAUX - Systemic corticosteroids
  // ============================================================================
  'Corticoides-Generaux': [
    { id: 300, name: 'PREDNISOLONE 5', generic: 'Prednisolone 5mg' },
    { id: 301, name: 'PREDNISOLONE 20', generic: 'Prednisolone 20mg' },
    { id: 302, name: 'SOLUPRED 5', generic: 'Prednisolone 5mg orodispersible' },
    { id: 303, name: 'SOLUPRED 20', generic: 'Prednisolone 20mg orodispersible' },
    { id: 304, name: 'CORTANCYL 1', generic: 'Prednisone 1mg' },
    { id: 305, name: 'CORTANCYL 5', generic: 'Prednisone 5mg' },
    { id: 306, name: 'CORTANCYL 20', generic: 'Prednisone 20mg' },
    { id: 307, name: 'MEDROL 4', generic: 'Méthylprednisolone 4mg' },
    { id: 308, name: 'MEDROL 16', generic: 'Méthylprednisolone 16mg' },
    { id: 309, name: 'CELESTENE 0.5', generic: 'Bétaméthasone 0.5mg' },
    { id: 310, name: 'CELESTENE 2', generic: 'Bétaméthasone 2mg' },
    { id: 311, name: 'DECTANCYL', generic: 'Dexaméthasone 0.5mg' },
  ],

  // ============================================================================
  // CORTICOIDES-LOCAUX - Local/ophthalmic corticosteroids
  // ============================================================================
  'Corticoides-Locaux': [
    { id: 40, name: 'DEXAFREE', generic: 'Dexaméthasone unidose' },
    { id: 41, name: 'MAXIDEX', generic: 'Dexaméthasone' },
    { id: 42, name: 'VEXOL', generic: 'Rimexolone' },
    { id: 43, name: 'SOFTACORT', generic: 'Hydrocortisone' },
    { id: 44, name: 'CHIBRO-CADRON', generic: 'Dexaméthasone' },
    { id: 45, name: 'FLUCON', generic: 'Fluorométholone' },
    { id: 46, name: 'FML', generic: 'Fluorométholone' },
    { id: 47, name: 'LOTEMAX', generic: 'Lotéprednol' },
    { id: 48, name: 'PRED FORTE', generic: 'Prednisolone acétate 1%' },
  ],

  // ============================================================================
  // DIVERS-OPH - Miscellaneous ophthalmology
  // ============================================================================
  'Divers-OPH': [
    { id: 320, name: 'BLEPHAGEL', generic: 'Gel nettoyant paupières' },
    { id: 321, name: 'BLEPHACLEAN', generic: 'Lingettes nettoyantes' },
    { id: 322, name: 'BLEPHASOL', generic: 'Lotion micellaire paupières' },
    { id: 323, name: 'ILAST', generic: 'Compresses chauffantes' },
    { id: 324, name: 'MASQUE MGD', generic: 'Masque chauffant yeux' },
    { id: 325, name: 'NAVIBLEF', generic: 'Mousse nettoyante paupières' },
    { id: 326, name: 'TEARLAB', generic: 'Test osmolarité' },
    { id: 327, name: 'FLUORESCEINE', generic: 'Fluorescéine bandelettes' },
    { id: 328, name: 'LISSAMINE VERT', generic: 'Lissamine vert bandelettes' },
    { id: 329, name: 'ROSE BENGALE', generic: 'Rose Bengale' },
    { id: 330, name: 'OXYBUPROCAINE', generic: 'Oxybuprocaïne' },
    { id: 331, name: 'TETRACAINE', generic: 'Tétracaïne' },
    { id: 332, name: 'OCRIPLASMINA', generic: 'Ocriplasmine (Jetrea)' },
  ],

  // ============================================================================
  // LARMES-LOTIONS - Artificial tears and lotions
  // ============================================================================
  'Larmes-Lotions': [
    { id: 30, name: 'DACUDOSES', generic: 'Solution saline stérile' },
    { id: 31, name: 'OPTIVE', generic: 'Carmellose + Glycérol' },
    { id: 32, name: 'HYLO-DUAL', generic: 'Hyaluronate + Ectoïne' },
    { id: 33, name: 'THEALOZ DUO', generic: 'Tréhalose + Hyaluronate' },
    { id: 34, name: 'SYSTANE ULTRA', generic: 'Propylène glycol + PEG' },
    { id: 35, name: 'REFRESH', generic: 'Carmellose' },
    { id: 36, name: 'HYABAK', generic: 'Acide hyaluronique 0.15%' },
    { id: 37, name: 'HYLO-COMOD', generic: 'Hyaluronate de sodium' },
    { id: 38, name: 'ARTELAC', generic: 'Hypromellose' },
    { id: 39, name: 'CELLUVISC', generic: 'Carmellose 1%' },
    { id: 340, name: 'VISMED', generic: 'Acide hyaluronique 0.18%' },
    { id: 341, name: 'VISMED GEL', generic: 'Acide hyaluronique 0.3%' },
    { id: 342, name: 'CATIONORM', generic: 'Émulsion cationique' },
    { id: 343, name: 'LACRYVISC', generic: 'Carbomère' },
    { id: 344, name: 'SICCAFLUID', generic: 'Carbomère unidose' },
    { id: 345, name: 'GENTEAL', generic: 'Hypromellose + Carbomère' },
    { id: 346, name: 'AQUALARM', generic: 'Acide hyaluronique' },
    { id: 347, name: 'HYLO-GEL', generic: 'Hyaluronate de sodium 0.2%' },
    { id: 348, name: 'XILOIAL', generic: 'Acide hyaluronique + Xylitol' },
    { id: 349, name: 'I-DROP PUR', generic: 'Hyaluronate viscoélastique' },
  ],

  // ============================================================================
  // MYDRIATIQUES - Mydriatics and cycloplegics
  // ============================================================================
  'Mydriatiques': [
    { id: 50, name: 'MYDRIATICUM', generic: 'Tropicamide' },
    { id: 51, name: 'NEOSYNEPHRINE', generic: 'Phényléphrine' },
    { id: 52, name: 'ATROPINE', generic: 'Atropine' },
    { id: 53, name: 'SKIACOL', generic: 'Cyclopentolate' },
    { id: 54, name: 'TROPICAMIDE 0.5%', generic: 'Tropicamide 0.5%' },
    { id: 55, name: 'TROPICAMIDE 1%', generic: 'Tropicamide 1%' },
    { id: 56, name: 'PHENYLEPHRINE 10%', generic: 'Phényléphrine 10%' },
    { id: 57, name: 'PHENYLEPHRINE 2.5%', generic: 'Phényléphrine 2.5%' },
    { id: 58, name: 'ATROPINE 0.3%', generic: 'Atropine 0.3%' },
    { id: 59, name: 'ATROPINE 1%', generic: 'Atropine 1%' },
    { id: 350, name: 'HOMATROPINE', generic: 'Homatropine' },
    { id: 351, name: 'CYCLOPENTOLATE 0.5%', generic: 'Cyclopentolate 0.5%' },
    { id: 352, name: 'CYCLOPENTOLATE 1%', generic: 'Cyclopentolate 1%' },
    { id: 353, name: 'MYDRIASERT', generic: 'Tropicamide + Phényléphrine insert' },
  ],

  // ============================================================================
  // POMMADES-ANTIBIO-CORTICO - Antibiotic + corticosteroid ointments
  // ============================================================================
  'Pommades-Antibio-Cortico': [
    { id: 360, name: 'STERDEX POMMADE', generic: 'Dexaméthasone + Oxytétracycline pommade' },
    { id: 361, name: 'MAXIDROL POMMADE', generic: 'Dexaméthasone + Néomycine + Polymyxine B pommade' },
    { id: 362, name: 'FRAKIDEX POMMADE', generic: 'Dexaméthasone + Framycétine pommade' },
    { id: 363, name: 'TOBRADEX POMMADE', generic: 'Tobramycine + Dexaméthasone pommade' },
    { id: 364, name: 'CHIBRO-CADRON POMMADE', generic: 'Dexaméthasone + Néomycine pommade' },
  ],

  // ============================================================================
  // POMMADES-ANTIBIOTIQUES - Antibiotic ointments
  // ============================================================================
  'Pommades-Antibiotiques': [
    { id: 370, name: 'TOBREX POMMADE', generic: 'Tobramycine pommade' },
    { id: 371, name: 'FUCITHALMIC GEL', generic: 'Acide fusidique gel' },
    { id: 372, name: 'AUREOMYCINE OPHT', generic: 'Chlortétracycline pommade' },
    { id: 373, name: 'RIFAMYCINE POMMADE', generic: 'Rifamycine pommade' },
    { id: 374, name: 'POSICYCLINE', generic: 'Tétracycline pommade' },
    { id: 375, name: 'BACITRACINE POMMADE', generic: 'Bacitracine pommade' },
  ],

  // ============================================================================
  // VASCULOTROPES - Vasoactive / vascular agents
  // ============================================================================
  'Vasculotropes': [
    { id: 380, name: 'DIOVENOR 600', generic: 'Diosmine 600mg' },
    { id: 381, name: 'DAFLON 500', generic: 'Diosmine + Hespéridine' },
    { id: 382, name: 'GINKOR FORT', generic: 'Ginkgo biloba + Troxérutine' },
    { id: 383, name: 'ENDOTELON', generic: 'Oligomères procyanidoliques' },
    { id: 384, name: 'DIFRAREL E', generic: 'Anthocyanosides + Vitamine E' },
    { id: 385, name: 'VEINAMITOL', generic: 'Troxérutine' },
    { id: 386, name: 'ESBERIVEN', generic: 'Ruscogénines + Hespéridine' },
    { id: 387, name: 'VASOCEDINE', generic: 'Naftidrofuryl' },
    { id: 388, name: 'TANAKAN', generic: 'Ginkgo biloba' },
    { id: 389, name: 'FONZYLANE', generic: 'Buflomedil' },
  ],
};

const DOSE_OPTIONS = [
  'Une goutte', 'Deux gouttes', 'Une application', 'Un lavage',
  'Un comprimé', 'Deux comprimés', 'Un sachet', 'Une ampoule',
  'Une gélule', 'Deux gélules', 'Une pipette', 'Une boîte',
  'Deux boîtes', 'Un tube', 'Deux tubes', 'Un flacon', 'Deux flacons',
];

const POSOLOGIE_OPTIONS = [
  'le matin', 'à midi', 'l\'après midi', 'le soir', 'matin et soir',
  'trois fois par jour', 'quatre fois par jour', 'cinq fois par jour',
  'toutes les heures', 'toutes les 2 heures', 'toutes les 3 heures',
  'toutes les 4 heures', 'toutes les 6 heures', 'un jour sur deux',
  'un jour sur trois', 'une fois par semaine',
];

const DETAILS_OPTIONS = [
  'dans l\'œil droit', 'dans l\'œil gauche', 'dans les deux yeux',
  'dans l\'œil concerné', 'sur la paupière droite', 'sur la paupière gauche',
  'sur les deux paupières', 'à la racine des cils', 'avant les repas',
  'au repas', 'après le repas', 'au réveil', 'au coucher',
  'en cas d\'irritation', 'pour l\'hygiène oculaire',
];

const DURATION_OPTIONS = [
  'pendant un jour.', 'pendant deux jours.', 'pendant trois jours.',
  'pendant quatre jours.', 'pendant cinq jours.', 'pendant six jours.',
  'pendant une semaine.', 'pendant huit jours.', 'pendant dix jours.',
  'pendant douze jours.', 'pendant deux semaines.', 'pendant trois semaines.',
  'pendant un mois.', 'pendant trois mois.', 'en continu', 'jusqu\'à amélioration',
];

// QSP = Quantité Suffisante Pour (French pharmacy standard)
const QSP_OPTIONS = [
  { id: 'qsp_1w', label: 'QSP 1 SEM', value: 'QSP 1 semaine.', short: '1S' },
  { id: 'qsp_2w', label: 'QSP 2 SEM', value: 'QSP 2 semaines.', short: '2S' },
  { id: 'qsp_1m', label: 'QSP 1 MOIS', value: 'QSP 1 mois.', short: '1M' },
  { id: 'qsp_3m', label: 'QSP 3 MOIS', value: 'QSP 3 mois.', short: '3M', highlight: true },
  { id: 'qsp_6m', label: 'QSP 6 MOIS', value: 'QSP 6 mois.', short: '6M' },
  { id: 'qsp_12m', label: 'QSP 1 AN', value: 'QSP 1 an.', short: '1A' },
  { id: 'ar', label: 'AR', value: 'A renouveler.', tooltip: 'À Renouveler' },
  { id: 'ar_3', label: 'AR x3', value: 'A renouveler 3 fois.', tooltip: 'À Renouveler 3 fois' },
];

const STANDARD_TREATMENTS = [
  { id: 'chalazion', name: 'Chalazion', items: [
    '- Appliquer un gant de toilette imprégné de l\'eau chaude du robinet sur les paupières 10 minutes matin et soir.',
    '- STERDEX: 1 application matin et soir sur la paupière concernée pendant huit jours.',
    '- DACUDOSES: pour laver les yeux.',
  ]},
  { id: 'conjonctivite-bact', name: 'Conjonctivite Bact', items: [
    '- EXOCINE: Une goutte trois fois par jour dans les deux yeux pendant sept jours.'
  ]},
  { id: 'secheresse', name: 'Sécheresse oculaire', items: [
    '- OPTIVE: Une goutte quatre fois par jour dans les deux yeux en continu.'
  ]},
  { id: 'glaucome-post-op', name: 'Post-op Glaucome', items: [
    '- TOBRADEX: Une goutte quatre fois par jour pendant 15 jours puis diminuer progressivement.',
    '- INDOCOLLYRE: Une goutte trois fois par jour pendant un mois.',
  ]},
  { id: 'cataracte-post-op', name: 'Post-op Cataracte', items: [
    '- TOBRADEX: Une goutte quatre fois par jour pendant trois semaines.',
    '- INDOCOLLYRE: Une goutte trois fois par jour pendant un mois.',
  ]},
];

const PRESCRIPTION_TYPES = [
  { id: 'simple', label: 'Simple' },
  { id: 'dupli', label: 'Dupli (1)' },
  { id: 'double', label: 'Double (2)' },
  { id: 'gras', label: 'Gras' },
  { id: 'cerfa', label: '100% Cerfa' },
];

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  input: {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    border: `1px solid ${colors.gray[300]}`,
    borderRadius: '4px',
    outline: 'none',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 10px',
    minHeight: '36px',
    fontSize: '13px',
    textAlign: 'left',
    border: 'none',
    borderBottom: `1px solid ${colors.gray[200]}`,
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 150ms',
  },
  smallListItem: {
    display: 'block',
    width: '100%',
    padding: '6px 8px',
    fontSize: '12px',
    textAlign: 'left',
    border: 'none',
    borderBottom: `1px solid ${colors.gray[100]}`,
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 150ms',
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
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 200ms',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  tabActive: {
    borderBottomColor: colors.primary[600],
    color: colors.primary[600],
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TreatmentBuilder = ({
  value = { ordonnances: [{ items: [] }] },
  onChange,
  disabled = false,
  height = 700,
  previousPrescriptions = [], // Array of { date, items, doctor } for renewal
  patientName = '',
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState('Collyres-Antibiotiques');
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [selectedDose, setSelectedDose] = useState(null);
  const [selectedPosologie, setSelectedPosologie] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [activeOrdonnance, setActiveOrdonnance] = useState(0);
  const [prescriptionType, setPrescriptionType] = useState('simple');
  const [categorySearch, setCategorySearch] = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedRenewalPrescription, setSelectedRenewalPrescription] = useState(null);

  // Get drugs for selected category
  const categoryDrugs = useMemo(() => {
    const drugs = DRUG_DATABASE[selectedCategory] || [];
    if (!drugSearch) return drugs;
    return drugs.filter(d =>
      d.name.toLowerCase().includes(drugSearch.toLowerCase()) ||
      d.generic.toLowerCase().includes(drugSearch.toLowerCase())
    );
  }, [selectedCategory, drugSearch]);

  // Filter categories
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return MEDICATION_CATEGORIES;
    return MEDICATION_CATEGORIES.filter(c =>
      c.label.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categorySearch]);

  // Get current ordonnance
  const currentOrdonnance = value.ordonnances?.[activeOrdonnance] || { items: [] };

  // Show toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  // Add item to prescription
  const addPrescriptionItem = useCallback(() => {
    if (!selectedDrug) {
      showToast('Sélectionnez un médicament', 'warning');
      return;
    }

    const newItem = [
      `- ${selectedDrug.name}`,
      selectedDose,
      selectedPosologie,
      selectedDetails,
      selectedDuration,
    ].filter(Boolean).join(' ');

    const newOrdonnances = [...(value.ordonnances || [{ items: [] }])];
    if (!newOrdonnances[activeOrdonnance]) {
      newOrdonnances[activeOrdonnance] = { items: [] };
    }
    newOrdonnances[activeOrdonnance].items.push(newItem);

    onChange?.({ ...value, ordonnances: newOrdonnances });

    // Clear selections
    setSelectedDrug(null);
    setSelectedDose(null);
    setSelectedPosologie(null);
    setSelectedDetails(null);
    setSelectedDuration(null);

    showToast(`${selectedDrug.name} ajouté`);
  }, [selectedDrug, selectedDose, selectedPosologie, selectedDetails, selectedDuration, value, activeOrdonnance, onChange]);

  // Remove item
  const removePrescriptionItem = useCallback((index) => {
    const newOrdonnances = [...(value.ordonnances || [])];
    newOrdonnances[activeOrdonnance].items.splice(index, 1);
    onChange?.({ ...value, ordonnances: newOrdonnances });
  }, [value, activeOrdonnance, onChange]);

  // Apply standard treatment
  const applyStandardTreatment = useCallback((treatment) => {
    const newOrdonnances = [...(value.ordonnances || [{ items: [] }])];
    if (!newOrdonnances[activeOrdonnance]) {
      newOrdonnances[activeOrdonnance] = { items: [] };
    }
    newOrdonnances[activeOrdonnance].items.push(...treatment.items);
    onChange?.({ ...value, ordonnances: newOrdonnances });
    showToast(`Traitement "${treatment.name}" appliqué`);
  }, [value, activeOrdonnance, onChange]);

  // Add new ordonnance
  const addOrdonnance = useCallback(() => {
    const newOrdonnances = [...(value.ordonnances || []), { items: [] }];
    onChange?.({ ...value, ordonnances: newOrdonnances });
    setActiveOrdonnance(newOrdonnances.length - 1);
  }, [value, onChange]);

  // Renew from previous prescription
  const applyRenewal = useCallback((prescription) => {
    if (!prescription?.items?.length) return;

    const newOrdonnances = [...(value.ordonnances || [{ items: [] }])];
    if (!newOrdonnances[activeOrdonnance]) {
      newOrdonnances[activeOrdonnance] = { items: [] };
    }

    // Add items from previous prescription
    newOrdonnances[activeOrdonnance].items.push(...prescription.items);
    onChange?.({ ...value, ordonnances: newOrdonnances });

    setShowRenewalModal(false);
    setSelectedRenewalPrescription(null);
    showToast(`Renouvellement appliqué (${prescription.items.length} médicaments)`);
  }, [value, activeOrdonnance, onChange]);

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'absolute',
            bottom: '220px',
            right: '16px',
            padding: '10px 16px',
            background: toast.type === 'success' ? colors.success.main : colors.warning.main,
            color: 'white',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Main 4-Column Layout */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ColumnLayout columns={4} height={height - 200} showMobileNav>
          {/* COLUMN 1 - Categories (Purple) */}
          <ColumnLayout.Column variant="category" label="Catégories">
            <div style={{ padding: '8px', borderBottom: `1px solid ${colors.gray[300]}` }}>
              <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                Liste globale des médicaments
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: colors.gray[400] }} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  style={{ ...styles.input, paddingLeft: '28px', fontSize: '12px' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    ...styles.listItem,
                    fontSize: '12px',
                    minHeight: '32px',
                    background: selectedCategory === cat.id ? colors.primary[600] : 'transparent',
                    color: selectedCategory === cat.id ? 'white' : colors.gray[800],
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== cat.id) e.currentTarget.style.background = colors.gray[100];
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== cat.id) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </ColumnLayout.Column>

          {/* COLUMN 2 - Drugs (Green) */}
          <ColumnLayout.Column variant="entry" label="Vidal">
            <div style={{ padding: '8px', borderBottom: `1px solid ${colors.gray[300]}` }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: colors.gray[400] }} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  style={{ ...styles.input, paddingLeft: '28px', fontSize: '12px' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {categoryDrugs.map(drug => (
                <button
                  key={drug.id}
                  onClick={() => setSelectedDrug(drug)}
                  style={{
                    ...styles.listItem,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    minHeight: '44px',
                    background: selectedDrug?.id === drug.id ? colors.primary[500] : 'transparent',
                    color: selectedDrug?.id === drug.id ? 'white' : colors.gray[800],
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDrug?.id !== drug.id) e.currentTarget.style.background = colors.gray[100];
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDrug?.id !== drug.id) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontWeight: '600', fontSize: '13px' }}>{drug.name}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{drug.generic}</span>
                </button>
              ))}
            </div>
          </ColumnLayout.Column>

          {/* COLUMN 3 - Dosage (Yellow - 3 sub-columns) */}
          <ColumnLayout.Column variant="selection" label="Posologie">
            <ColumnLayout.SubColumns columns={3}>
              {/* Dose */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ColumnLayout.SectionHeader>Dose</ColumnLayout.SectionHeader>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {DOSE_OPTIONS.map((dose, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDose(dose)}
                      style={{
                        ...styles.smallListItem,
                        background: selectedDose === dose ? colors.primary[100] : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedDose !== dose) e.currentTarget.style.background = colors.gray[100];
                      }}
                      onMouseLeave={(e) => {
                        if (selectedDose !== dose) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {dose}
                    </button>
                  ))}
                </div>
              </div>

              {/* Posologie */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ColumnLayout.SectionHeader>Fréquence</ColumnLayout.SectionHeader>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {POSOLOGIE_OPTIONS.map((pos, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPosologie(pos)}
                      style={{
                        ...styles.smallListItem,
                        background: selectedPosologie === pos ? colors.primary[100] : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPosologie !== pos) e.currentTarget.style.background = colors.gray[100];
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPosologie !== pos) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Détails */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ColumnLayout.SectionHeader>Détails</ColumnLayout.SectionHeader>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {DETAILS_OPTIONS.map((detail, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDetails(detail)}
                      style={{
                        ...styles.smallListItem,
                        background: selectedDetails === detail ? colors.primary[100] : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedDetails !== detail) e.currentTarget.style.background = colors.gray[100];
                      }}
                      onMouseLeave={(e) => {
                        if (selectedDetails !== detail) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {detail}
                    </button>
                  ))}
                </div>
              </div>
            </ColumnLayout.SubColumns>
          </ColumnLayout.Column>

          {/* COLUMN 4 - Duration & Standards (Gray) */}
          <ColumnLayout.Column variant="summary" label="Options">
            {/* Duration */}
            <div style={{ height: '35%', borderBottom: `1px solid ${colors.gray[300]}`, display: 'flex', flexDirection: 'column' }}>
              <ColumnLayout.SectionHeader>Durée</ColumnLayout.SectionHeader>
              {/* QSP Quick Shortcuts */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                padding: '6px 4px',
                borderBottom: `1px solid ${colors.gray[200]}`,
                background: colors.info?.light || '#e3f2fd'
              }}>
                {QSP_OPTIONS.map((qsp) => (
                  <button
                    key={qsp.id}
                    onClick={() => setSelectedDuration(qsp.value)}
                    title={qsp.tooltip || qsp.label}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      border: qsp.highlight
                        ? `2px solid ${colors.primary.main}`
                        : `1px solid ${colors.gray[300]}`,
                      borderRadius: '4px',
                      background: selectedDuration === qsp.value
                        ? colors.primary[100]
                        : qsp.highlight
                          ? colors.warning.light
                          : 'white',
                      color: selectedDuration === qsp.value
                        ? colors.primary.dark
                        : qsp.highlight
                          ? colors.warning.dark || '#e65100'
                          : colors.gray[700],
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDuration !== qsp.value) {
                        e.currentTarget.style.background = colors.primary[100];
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedDuration !== qsp.value) {
                        e.currentTarget.style.background = qsp.highlight
                          ? colors.warning.light
                          : 'white';
                      }
                    }}
                  >
                    {qsp.short || qsp.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', background: 'white', margin: '4px', borderRadius: '4px' }}>
                {DURATION_OPTIONS.map((dur, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDuration(dur)}
                    style={{
                      ...styles.smallListItem,
                      background: selectedDuration === dur ? colors.primary[100] : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDuration !== dur) e.currentTarget.style.background = colors.gray[100];
                    }}
                    onMouseLeave={(e) => {
                      if (selectedDuration !== dur) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>

            {/* Standard Treatments */}
            <div style={{ height: '40%', borderBottom: `1px solid ${colors.gray[300]}`, display: 'flex', flexDirection: 'column' }}>
              <ColumnLayout.SectionHeader>Traitements Standards</ColumnLayout.SectionHeader>
              <div style={{ flex: 1, overflowY: 'auto', background: 'white', margin: '4px', borderRadius: '4px' }}>
                {STANDARD_TREATMENTS.map(treatment => (
                  <button
                    key={treatment.id}
                    onClick={() => applyStandardTreatment(treatment)}
                    style={{
                      ...styles.listItem,
                      fontSize: '12px',
                      minHeight: '36px',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.success.light}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>- {treatment.name}</span>
                    <Plus size={14} style={{ color: colors.success.main }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Prescription Options */}
            <div style={{ flex: 1, padding: '10px' }}>
              {/* RENOUVELLEMENT Button - StudioVision Parity */}
              {previousPrescriptions.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <button
                    onClick={() => setShowRenewalModal(true)}
                    style={{
                      ...styles.button,
                      width: '100%',
                      background: `linear-gradient(135deg, ${colors.warning.main} 0%, ${colors.warning.dark || '#f57c00'} 100%)`,
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: '600',
                      padding: '10px 12px',
                      boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
                    }}
                  >
                    <RefreshCw size={16} />
                    RENOUVELLEMENT
                    <span style={{
                      marginLeft: '8px',
                      background: 'rgba(255,255,255,0.3)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                    }}>
                      {previousPrescriptions.length}
                    </span>
                  </button>
                  <p style={{ fontSize: '10px', color: colors.gray[500], marginTop: '4px', textAlign: 'center' }}>
                    Copier une ordonnance précédente
                  </p>
                </div>
              )}

              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Type d'ordonnance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {PRESCRIPTION_TYPES.map(type => (
                  <label key={type.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="prescriptionType"
                      value={type.id}
                      checked={prescriptionType === type.id}
                      onChange={() => setPrescriptionType(type.id)}
                    />
                    <span style={{ fontSize: '12px' }}>{type.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  style={{
                    ...styles.button,
                    flex: 1,
                    background: colors.primary[600],
                    color: 'white',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                >
                  <Printer size={14} />
                  Imprimer
                </button>
                <button
                  style={{
                    ...styles.button,
                    background: 'white',
                    border: `1px solid ${colors.gray[300]}`,
                    color: colors.gray[700],
                    padding: '8px 12px',
                  }}
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          </ColumnLayout.Column>
        </ColumnLayout>
      </div>

      {/* BOTTOM - Active Prescription Display */}
      <div
        style={{
          background: colors.studio.prescription.bg,
          borderTop: `2px solid ${colors.primary[400]}`,
          padding: '12px',
          minHeight: '200px',
        }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px', borderBottom: `1px solid ${colors.gray[300]}` }}>
          {(value.ordonnances || [{ items: [] }]).map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveOrdonnance(i)}
              style={{
                ...styles.tab,
                ...(activeOrdonnance === i ? styles.tabActive : {}),
              }}
            >
              Ordonnance {i + 1}
            </button>
          ))}
          <button
            onClick={addOrdonnance}
            style={{
              ...styles.button,
              padding: '4px 10px',
              fontSize: '12px',
              background: colors.gray[100],
              color: colors.gray[700],
            }}
          >
            <Plus size={12} />
            Ajouter
          </button>
        </div>

        {/* Current item preview */}
        {selectedDrug && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              marginBottom: '10px',
              background: 'white',
              borderRadius: '6px',
              border: `1px dashed ${colors.primary[400]}`,
            }}
          >
            <span style={{ flex: 1, fontSize: '13px' }}>
              <strong>{selectedDrug.name}:</strong>{' '}
              {[selectedDose, selectedPosologie, selectedDetails, selectedDuration].filter(Boolean).join(' ') || '(sélectionnez dose/posologie/détails/durée)'}
            </span>
            <button
              onClick={addPrescriptionItem}
              style={{
                ...styles.button,
                background: colors.success.main,
                color: 'white',
                padding: '6px 14px',
                fontSize: '13px',
              }}
            >
              Ajouter
            </button>
          </div>
        )}

        {/* Prescription items */}
        <div
          style={{
            background: 'white',
            padding: '12px',
            borderRadius: '6px',
            border: `1px solid ${colors.gray[300]}`,
            minHeight: '80px',
          }}
        >
          {currentOrdonnance.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: colors.gray[400], fontSize: '13px' }}>
              Cliquez sur les médicaments et options pour construire l'ordonnance
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {currentOrdonnance.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: idx < currentOrdonnance.items.length - 1 ? `1px solid ${colors.gray[100]}` : 'none',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{item}</span>
                  <button
                    onClick={() => removePrescriptionItem(idx)}
                    style={{ ...styles.iconButton, color: colors.error.main }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.error.light}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RENOUVELLEMENT Modal - StudioVision Parity */}
      {showRenewalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setShowRenewalModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: `linear-gradient(135deg, ${colors.warning.main} 0%, ${colors.warning.dark || '#f57c00'} 100%)`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={24} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                    Renouvellement d'Ordonnance
                  </h3>
                  {patientName && (
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                      Patient: {patientName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowRenewalModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content - Previous Prescriptions List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {previousPrescriptions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.gray[400] }}>
                  <History size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <p>Aucune ordonnance précédente disponible</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {previousPrescriptions.map((prescription, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: selectedRenewalPrescription === idx
                          ? `2px solid ${colors.warning.main}`
                          : `1px solid ${colors.gray[200]}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: selectedRenewalPrescription === idx ? colors.warning.light : 'white',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                      onClick={() => setSelectedRenewalPrescription(idx)}
                    >
                      {/* Prescription Header */}
                      <div
                        style={{
                          padding: '10px 14px',
                          background: selectedRenewalPrescription === idx
                            ? colors.warning.main
                            : colors.gray[50],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: `1px solid ${colors.gray[200]}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Clock
                            size={16}
                            style={{
                              color: selectedRenewalPrescription === idx ? 'white' : colors.gray[500]
                            }}
                          />
                          <div>
                            <span
                              style={{
                                fontWeight: '600',
                                fontSize: '13px',
                                color: selectedRenewalPrescription === idx ? 'white' : colors.gray[800],
                              }}
                            >
                              {formatDate(prescription.date)}
                            </span>
                            {prescription.doctor && (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  fontSize: '12px',
                                  color: selectedRenewalPrescription === idx
                                    ? 'rgba(255,255,255,0.8)'
                                    : colors.gray[500],
                                }}
                              >
                                Dr. {prescription.doctor}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: selectedRenewalPrescription === idx
                              ? 'rgba(255,255,255,0.3)'
                              : colors.gray[200],
                            color: selectedRenewalPrescription === idx ? 'white' : colors.gray[600],
                          }}
                        >
                          {prescription.items?.length || 0} médicament(s)
                        </span>
                      </div>

                      {/* Prescription Items Preview */}
                      <div style={{ padding: '10px 14px' }}>
                        {(prescription.items || []).slice(0, 3).map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            style={{
                              fontSize: '12px',
                              color: colors.gray[700],
                              padding: '4px 0',
                              borderBottom: itemIdx < 2 && itemIdx < prescription.items.length - 1
                                ? `1px solid ${colors.gray[100]}`
                                : 'none',
                            }}
                          >
                            {item}
                          </div>
                        ))}
                        {prescription.items?.length > 3 && (
                          <div style={{ fontSize: '11px', color: colors.gray[400], marginTop: '4px' }}>
                            + {prescription.items.length - 3} autre(s) médicament(s)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: `1px solid ${colors.gray[200]}`,
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowRenewalModal(false)}
                style={{
                  ...styles.button,
                  background: 'white',
                  border: `1px solid ${colors.gray[300]}`,
                  color: colors.gray[700],
                  padding: '10px 20px',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (selectedRenewalPrescription !== null) {
                    applyRenewal(previousPrescriptions[selectedRenewalPrescription]);
                  }
                }}
                disabled={selectedRenewalPrescription === null}
                style={{
                  ...styles.button,
                  background: selectedRenewalPrescription !== null
                    ? colors.success.main
                    : colors.gray[300],
                  color: 'white',
                  padding: '10px 20px',
                  opacity: selectedRenewalPrescription !== null ? 1 : 0.6,
                  cursor: selectedRenewalPrescription !== null ? 'pointer' : 'not-allowed',
                }}
              >
                <Copy size={16} />
                Appliquer le renouvellement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUMMARY COMPONENT
// ============================================================================

export const TreatmentSummary = ({ ordonnances = [] }) => {
  if (!ordonnances.length || !ordonnances[0]?.items?.length) {
    return null;
  }

  return (
    <div
      style={{
        padding: '16px',
        background: colors.studio.prescription.bg,
        borderRadius: '8px',
        border: `1px solid ${colors.primary[200]}`,
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Traitement</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {ordonnances[0].items.map((item, i) => (
          <div key={i} style={{ fontSize: '13px', color: colors.gray[700] }}>{item}</div>
        ))}
      </div>
    </div>
  );
};

// Export constants
export {
  MEDICATION_CATEGORIES,
  DOSE_OPTIONS,
  POSOLOGIE_OPTIONS,
  DETAILS_OPTIONS,
  DURATION_OPTIONS,
  QSP_OPTIONS,
  STANDARD_TREATMENTS,
  PRESCRIPTION_TYPES,
};

export default TreatmentBuilder;
