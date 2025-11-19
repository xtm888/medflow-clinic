require('dotenv').config();
const mongoose = require('mongoose');
const DocumentTemplate = require('../models/DocumentTemplate');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/magloire', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// All document templates extracted from the MD file
const documentTemplates = [
  // ==================== VISUAL ACUITY CERTIFICATES ====================
  {
    name: 'Certificat d\'Acuité Visuelle',
    nameEn: 'Visual Acuity Certificate',
    category: 'certificate',
    subCategory: 'visual_acuity',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie avoir examiné ce jour :

{{patientTitle}} {{patientName}}

Son acuité visuelle sans correction est :

à Droite de {{vaOD}} dixièmes

à Gauche de {{vaOG}} dixièmes.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre (Monsieur/Madame)', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'vaOD', label: 'Acuité visuelle OD (dixièmes)', type: 'number', required: true },
      { name: 'vaOG', label: 'Acuité visuelle OG (dixièmes)', type: 'number', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['acuité', 'vision', 'certificat']
  },

  // ==================== CONSULTATION CERTIFICATES ====================
  {
    name: 'Certificat de Consultation avec Accompagnement',
    nameEn: 'Consultation with Accompaniment Certificate',
    category: 'certificate',
    subCategory: 'consultation',
    specialty: 'general',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie que

{{patientTitle}} {{patientName}}

s'est présenté(e) ce jour à mon cabinet pour une consultation accompagné de {{accompanyRelation}}, qui a dû s'absenter de son travail.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'accompanyRelation', label: 'Relation (sa mère, son père, etc.)', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['consultation', 'accompagnement', 'certificat']
  },

  {
    name: 'Certificat de Consultation Simple',
    nameEn: 'Simple Consultation Certificate',
    category: 'certificate',
    subCategory: 'consultation',
    specialty: 'general',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie que

{{patientTitle}} {{patientName}} né(e) le {{dateOfBirth}}

s'est présenté(e) ce jour à mon cabinet pour une consultation.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['consultation', 'certificat']
  },

  // ==================== MEDICAL LEAVE CERTIFICATES ====================
  {
    name: 'Certificat d\'Arrêt de Travail',
    nameEn: 'Medical Leave Certificate',
    category: 'certificate',
    subCategory: 'medical_leave',
    specialty: 'general',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie que

{{patientTitle}} {{patientName}} né(e) le {{dateOfBirth}}

s'est présenté(e) ce jour à mon cabinet pour une consultation. Son état de santé nécessite un repos physique jusqu'au {{leaveEndDate}} inclus; il(elle) sera revu(e) le {{followUpDate}}

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true },
      { name: 'leaveEndDate', label: 'Fin du repos', type: 'date', required: true },
      { name: 'followUpDate', label: 'Date de contrôle', type: 'date', required: false }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['arrêt', 'repos', 'travail', 'certificat']
  },

  {
    name: 'Certificat d\'Arrêt Post-Chirurgical',
    nameEn: 'Post-Surgical Leave Certificate',
    category: 'certificate',
    subCategory: 'medical_leave',
    specialty: 'surgery',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie que

{{patientTitle}} {{patientName}}

a été reçu dans notre clinique pour une intervention chirurgicale. Son état de santé nécessite un repos physique jusqu'au {{leaveEndDate}} inclus;

Certificat médical établi et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'leaveEndDate', label: 'Fin du repos', type: 'date', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['chirurgie', 'arrêt', 'repos', 'certificat']
  },

  // ==================== FITNESS & WORK CERTIFICATES ====================
  {
    name: 'Certificat d\'Aptitude Physique',
    nameEn: 'Physical Fitness Certificate',
    category: 'certificate',
    subCategory: 'fitness',
    specialty: 'general',
    language: 'fr',
    content: `CERTIFICAT D'APTITUDE PHYSIQUE

Je soussigné {{doctorName}}, Docteur en médecine résidant à Kinshasa. Sur demande qui m'a été faite par l'Entreprise {{companyName}} et après avoir examiné ce jour {{patientTitle}} {{patientName}} né à {{birthPlace}} le {{dateOfBirth}} employé au poste de {{jobTitle}};

Je certifie que l'intéressé(e) est :

• Apte aux travaux physiques {{workloadLevel}} (très légers, légers, modérés, lourds ou très lourds)

• Apte à l'exercice de sa fonction actuelle

{{additionalConditions}}

Certificat médical établi et remis en main propre pour faire valoir ce que de droit`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'companyName', label: 'Nom de l\'entreprise', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'birthPlace', label: 'Lieu de naissance', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true },
      { name: 'jobTitle', label: 'Poste occupé', type: 'text', required: true },
      { name: 'workloadLevel', label: 'Niveau de charge', type: 'select', options: ['très légers', 'légers', 'modérés', 'lourds', 'très lourds'], required: true },
      { name: 'additionalConditions', label: 'Conditions supplémentaires', type: 'text', required: false }
    ],
    allowedRoles: ['admin', 'doctor'],
    tags: ['aptitude', 'travail', 'entreprise', 'certificat']
  },

  {
    name: 'Certificat Port de Lunettes Obligatoire',
    nameEn: 'Glasses Required Certificate',
    category: 'certificate',
    subCategory: 'glasses_required',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie que l'état de

{{patientTitle}} {{patientName}}

nécessite obligatoirement le port de verres correcteurs adaptés pour le travail sur écran.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['lunettes', 'écran', 'certificat']
  },

  // ==================== SCHOOL CERTIFICATES ====================
  {
    name: 'Certificat d\'Arrêt Scolaire',
    nameEn: 'School Leave Certificate',
    category: 'certificate',
    subCategory: 'school',
    specialty: 'general',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}}, certifie que

{{patientName}} né(e) le {{dateOfBirth}}

nécessite un arrêt scolaire de {{leaveDays}} jours.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true },
      { name: 'leaveDays', label: 'Nombre de jours', type: 'number', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['école', 'arrêt', 'scolaire', 'certificat']
  },

  {
    name: 'Certificat Non Contagieux',
    nameEn: 'Non-Contagious Certificate',
    category: 'certificate',
    subCategory: 'school',
    specialty: 'general',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}}, certifie que

{{patientName}} né(e) {{dateOfBirth}}

ne présente pas de risque contagieux.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['école', 'contagieux', 'certificat']
  },

  {
    name: 'Certificat Placement Premier Rang',
    nameEn: 'Front Row Seating Certificate',
    category: 'certificate',
    subCategory: 'school',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}}, certifie que

{{patientName}} né(e) le {{dateOfBirth}}

doit être placé(e) en classe dans les premiers rangs.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['école', 'vision', 'placement', 'certificat']
  },

  // ==================== EXAMINATION REPORTS ====================
  {
    name: 'Rapport d\'Échographie Oculaire',
    nameEn: 'Ocular Ultrasound Report',
    category: 'examination_report',
    subCategory: 'ultrasound',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `{{consultationDate}}

Kinshasa

Concerne : {{patientName}}

Age : {{patientAge}} ans    Sexe : {{patientTitle}}

ECHOGRAPHIE OCULAIRE

Indication : {{indication}}

Conclusion : {{conclusion}}

{{doctorName}}`,
    variables: [
      { name: 'consultationDate', label: 'Date', type: 'date', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'patientAge', label: 'Âge', type: 'number', required: true },
      { name: 'patientTitle', label: 'Sexe', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'indication', label: 'Indication', type: 'text', required: true },
      { name: 'conclusion', label: 'Conclusion', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['échographie', 'examen', 'rapport']
  },

  {
    name: 'Rapport d\'Examen Normal',
    nameEn: 'Normal Examination Report',
    category: 'examination_report',
    subCategory: 'general',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `J'ai examiné attentivement {{patientTitle}} {{patientName}} :

son examen est tout à fait normal tant au Fond d'oeil qu'au biomicroscope.

{{additionalFindings}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'additionalFindings', label: 'Observations supplémentaires', type: 'text', required: false }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist'],
    tags: ['examen', 'normal', 'rapport']
  },

  // ==================== CATARACT SURGERY ====================
  {
    name: 'Demande d\'Anesthésie - Cataracte (Générale)',
    nameEn: 'Anesthesia Request - Cataract (General)',
    category: 'correspondence',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `Cher {{colleagueName}},

Merci d'examiner {{patientTitle}} {{patientName}}

que je vais opèrer de cataracte le: {{surgeryDate}}

de son oeil {{eye}}

Dans le cas présent en accord avec le patient et compte tenu de son âge, je souhaite une anesthésie générale, est ce possible?

PS: Je te laisse le soin de programmer les examens pré-opératoires que tu souhaites

Bien amicalement.

{{doctorName}}`,
    variables: [
      { name: 'colleagueName', label: 'Nom du confrère', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'surgeryDate', label: 'Date de chirurgie', type: 'date', required: true },
      { name: 'eye', label: 'Oeil', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['cataracte', 'chirurgie', 'anesthésie', 'correspondance']
  },

  {
    name: 'Demande d\'Anesthésie - Cataracte (Locale)',
    nameEn: 'Anesthesia Request - Cataract (Local)',
    category: 'correspondence',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `Cher {{colleagueName}},

Merci d'examiner {{patientTitle}} {{patientName}}

que je vais opèrer de cataracte OG le {{surgeryDate}}

Dans le cas présent en accord avec la patiente, je souhaite une anesthésie locale, qu'en penses tu ?

PS: Je te laisse le soin de programmer les examens pré-opératoires que tu souhaites

Bien amicalement.

{{doctorName}}`,
    variables: [
      { name: 'colleagueName', label: 'Nom du confrère', type: 'text', required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'surgeryDate', label: 'Date de chirurgie', type: 'date', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['cataracte', 'chirurgie', 'anesthésie', 'correspondance']
  },

  {
    name: 'Référence Pré-Opératoire - Cataracte',
    nameEn: 'Pre-operative Referral - Cataract',
    category: 'correspondence',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `Cher confrère,

Je vais opérer de cataracte votre patient

{{patientTitle}} {{patientName}} le {{surgeryDate}}

Je vous serais reconnaissant de le revoir en consultation pré-opératoire et de me transmettre les éléments qui pourraient m'être utiles en particulier le résumé de son état cardio-vasculaire et son traitement en cours (traitement anti-coagulant ?)

Je vous remercie de votre collaboration et ne manquerai pas de vous tenir au courant du résultat de cette chirurgie.

Bien cordialement.

{{doctorName}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'surgeryDate', label: 'Date de chirurgie', type: 'date', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['cataracte', 'chirurgie', 'référence', 'correspondance']
  },

  {
    name: 'Compte Rendu Post-Opératoire - Cataracte',
    nameEn: 'Post-operative Report - Cataract',
    category: 'correspondence',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `Cher ami,

J'ai opéré de cataracte l'oeil {{eye}} de ton patient

{{patientTitle}} {{patientName}} ce jour.

L'intervention s'est déroulée sous anesthésie locale sans incidents.

J'ai pratiqué une phacoémulsification par voie cornéenne avec pose d'un implant "dans le sac" de {{iolPower}} dioptries qui devrait ammétropiser ce patient d'après les mesures de biométrie pré-opératoires.

Je pense que les suites seront simples.

Je te remercie de ta confiance.

Avec toute mon amitié.

{{doctorName}}`,
    variables: [
      { name: 'eye', label: 'Oeil', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'iolPower', label: 'Puissance IOL (dioptries)', type: 'number', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['cataracte', 'chirurgie', 'post-op', 'correspondance']
  },

  {
    name: 'Instructions Pré-Opératoires - Cataracte',
    nameEn: 'Pre-operative Instructions - Cataract',
    category: 'prescription_instructions',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `{{patientTitle}} {{patientName}}

Mettre dans les deux yeux 8 jours avant l'intervention :

Collyre INDOCOLLYRE 1 gtte 3 fois par jour
Collyre EXOCINE 1 gtte 3 fois par jour

Apporter les collyres à la clinique car ils seront mis le soir qui précède l'intervention ainsi que le matin même de l'intervention.

Ne pas prendre d'ASPIRINE ni tout autre médicament apparenté pendant les 15 jours qui précèdent l'intervention.`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist', 'nurse'],
    tags: ['cataracte', 'pré-op', 'instructions', 'traitement']
  },

  {
    name: 'Instructions Post-Opératoires - Cataracte',
    nameEn: 'Post-operative Instructions - Cataract',
    category: 'prescription_instructions',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `{{patientTitle}} {{patientName}}

Mettre dans l'oeil opéré :

Collyre CHIBROCADRON 1 gtte 3 fois par jour
Collyre INDOCOLLYRE 1 gtte 3 fois par jour

Pendant 1 mois`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist', 'nurse'],
    tags: ['cataracte', 'post-op', 'instructions', 'traitement']
  },

  {
    name: 'Compte Rendu Opératoire - Phacoémulsification',
    nameEn: 'Operative Report - Phacoemulsification',
    category: 'operative_report',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `Compte Rendu Opératoire

de {{patientTitle}} {{patientName}}

né(e) le {{dateOfBirth}}

Intervention du {{surgeryDate}}

PhacoEmulsification {{eye}}

Pose d'ICP de marque {{iolBrand}}

Puissance {{iolPower}} Dioptries

Technique classique sans incident.

{{additionalNotes}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date', required: true },
      { name: 'surgeryDate', label: 'Date d\'intervention', type: 'date', required: true },
      { name: 'eye', label: 'Oeil', type: 'select', options: ['OD', 'OG'], required: true },
      { name: 'iolBrand', label: 'Marque IOL', type: 'text', required: true },
      { name: 'iolPower', label: 'Puissance (dioptries)', type: 'number', required: true },
      { name: 'additionalNotes', label: 'Notes supplémentaires', type: 'text', required: false }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['cataracte', 'chirurgie', 'compte rendu']
  },

  // ==================== MYOPIA SURGERY ====================
  {
    name: 'Certificat Post-Opératoire - Chirurgie de Myopie',
    nameEn: 'Post-operative Certificate - Myopia Surgery',
    category: 'certificate',
    subCategory: 'myopia_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `Je soussigné, {{doctorName}}, certifie avoir opéré de sa myopie de l'oeil {{eye}}

{{patientTitle}} {{patientName}}.

Il s'agit d'une myopie bilatérale pour laquelle la correction en lunettes était mal supportée.

Les chiffres de la myopie permettent d'attendre un résultat visuel correct sans correction jusqu'au début de la presbytie (vers 48 ans).

A cet âge le port d'une lunette uniquement pour lire sera nécessaire.

Le résultat à 8 jours pour l'oeil {{eye}} est conforme à notre attente et la chirurgie de l'oeil {{oppositeEye}} est prévu le {{nextSurgeryDate}}.

Certificat fait à la demande de l'intéréssé et remis en mains propres pour faire et valoir ce que de droit.`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'eye', label: 'Oeil opéré', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'oppositeEye', label: 'Oeil controlatéral', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'nextSurgeryDate', label: 'Date prochaine chirurgie', type: 'date', required: false }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['myopie', 'chirurgie', 'laser', 'certificat']
  },

  {
    name: 'Consentement Éclairé - Chirurgie de Myopie',
    nameEn: 'Informed Consent - Myopia Surgery',
    category: 'surgical_consent',
    subCategory: 'myopia_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `{{patientTitle}} {{patientName}}

Vous avez choisi de faire opérer votre myopie et éventuellement l'astigmatisme associé. Cette lettre matérialise votre consentement éclairé.

Votre ophtalmologiste après avoir étudié votre cas particulier vous a approuvé dans cette démarche. Vous devez savoir quelques éléments qui gouvernent cette chirurgie et ce que l'on peut en attendre.

Des mesures pré-opèratoires précises seront prises afin d'établir le protocole opératoire et le geste, authentique geste chirurgical, sera pratiqué sous anesthésie locale par instillation de collyres et dans un centre spécialisé.

Les mesures prises permettent de corriger votre trouble de réfraction avec précision, cependant le résultat final dépend de paramètres difficiles à apprécier comme en particulier la texture exacte de votre cornée et votre cicatrisation.

Les complications de cette chirurgie sont rares si on la réserve à des myopies petites ou moyennes. Cependant, comme dans toute chirurgie, des complications infectieuses peuvent survenir, elles seront la plupart du temps facilement jugulées par l'instillation de collyres pendant quelques jours.

Il est indispensable que le port des lentilles de contact soit interrompu une semaine avant les mesures pratiquées au cabinet et également une semaine avant la date de la chirurgie dans le cas de lentilles souples et trois semaines dans le cas de lentilles rigides.

Il est important d'avoir compris que la correction d'une myopie par chirurgie ne permettra pas de mieux voir qu'avec des lunettes ou qu'avec des lentilles; de même la surveillance médicale régulière demeure indispensable après chirurgie même si vous avez une vision correcte sans correction.

Les honoraires relatifs à cette chirurgie ne pourront faire l'objet d'une prise en charge par les caisses d'assurance maladie. Lors du règlement des honoraires un reçu vous sera remis pour être éventuellement remis à votre mutuelle.

Je confirme vouloir me faire opérer de ma myopie et de mon astigmatisme :

{{patientTitle}} {{patientName}}

Date de la consultation préalable : {{consultationDate}}
Date de la chirurgie du premier oeil : {{surgeryDate}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'consultationDate', label: 'Date consultation', type: 'date', required: true },
      { name: 'surgeryDate', label: 'Date chirurgie', type: 'date', required: false }
    ],
    allowedRoles: ['admin', 'ophthalmologist'],
    tags: ['myopie', 'consentement', 'chirurgie', 'laser']
  },

  {
    name: 'Instructions Pré-Opératoires - Chirurgie de Myopie',
    nameEn: 'Pre-operative Instructions - Myopia Surgery',
    category: 'prescription_instructions',
    subCategory: 'myopia_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `{{patientTitle}} {{patientName}}

Traitement pré-opératoire :

ATARAX 25 : 1cp la veille de l'intervention
             1cp le matin même de l'intervention

Mettre dans l'oeil à opérer :

Collyre EXOCINE : 1goutte la veille de l'intervention et ensuite 1 goutte 5 fois par jour
Collyre VOLTARENE : Même posologie que le EXOCINE

Traitement à faire pendant la durée du port de la lentille pansement et ensuite se conformer à la prescription médicale

Consignes de prudences dans les suites d'une chirurgie de Myopie au laser:

Eviter :
- Maquillage et fumée pendant une semaine
- L'eau dans l'oeil pendant deux semaines
- De se frotter les yeux pendant la semaine qui suit le geste afin de ne pas déplacer la lentille "pansement" et de ne pas gêner la cicatrisation. Pour cela il est conseillé de fixer sur l'oeil pendant la nuit une coque rigide achetée en pharmacie et fixée par MICROPORE
- Les sports violents (squash, rugby, tennis, etc...) pendant un mois sans port de lunettes de protection

ATTENTION : Ne pas porter de lentilles de contact pendant les 8 jours qui précèdent la chirurgie`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'ophthalmologist', 'nurse'],
    tags: ['myopie', 'pré-op', 'instructions', 'laser']
  },

  // ==================== PAYMENT DOCUMENTS ====================
  {
    name: 'Reçu de Paiement - Chirurgie',
    nameEn: 'Payment Receipt - Surgery',
    category: 'payment',
    subCategory: 'payment_receipt',
    specialty: 'surgery',
    language: 'fr',
    content: `CERTIFICAT

Je soussigné, {{doctorName}},

certifie avoir reçu ce jour la somme de {{amount}} {{currency}} par {{paymentMethod}}

de {{patientTitle}} {{patientName}}

au titre de dépassement d'honoraires pour la chirurgie du {{surgeryDate}}

(secteur 2) {{procedure}}.

Certificat remis à la patiente pour être remis à sa mutuelle en vue d'une éventuelle prise en charge.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'amount', label: 'Montant', type: 'number', required: true },
      { name: 'currency', label: 'Devise', type: 'select', options: ['USD', 'CDF', '€uros'], required: true },
      { name: 'paymentMethod', label: 'Mode de paiement', type: 'select', options: ['chèque', 'espèces', 'virement', 'carte'], required: true },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'surgeryDate', label: 'Date de chirurgie', type: 'date', required: true },
      { name: 'procedure', label: 'Acte réalisé', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'ophthalmologist', 'receptionist'],
    tags: ['paiement', 'reçu', 'chirurgie']
  },

  {
    name: 'Rappel de Paiement',
    nameEn: 'Payment Reminder',
    category: 'reminder',
    subCategory: 'payment_request',
    specialty: 'general',
    language: 'fr',
    content: `Cher {{patientTitle}} {{patientName}}

J'ai le regret de vous informer que sauf erreur ou omission,

l'acte {{procedure}} du {{serviceDate}} d'un montant de {{amount}} {{currency}}

ne m'a pas encore été honoré.

Je vous serais reconnaissant de bien vouloir y remédier par tout moyen à votre convenance.

Cordialement vôtre

{{doctorName}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'procedure', label: 'Acte réalisé', type: 'text', required: true },
      { name: 'serviceDate', label: 'Date de l\'acte', type: 'date', required: true },
      { name: 'amount', label: 'Montant', type: 'number', required: true },
      { name: 'currency', label: 'Devise', type: 'select', options: ['USD', 'CDF', '€uros'], required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'receptionist'],
    tags: ['paiement', 'rappel', 'impayé']
  },

  // ==================== REMINDERS ====================
  {
    name: 'Rappel Rendez-vous Manqués',
    nameEn: 'Missed Appointment Reminder',
    category: 'reminder',
    subCategory: 'missed_appointment',
    specialty: 'general',
    language: 'fr',
    content: `Cher {{patientTitle}} {{patientName}}

J'ai le regret de constater qu'à plusieurs reprises vous n'honoriez pas vos engagements de rendez-vous, sans prévenir.

Ceci désorganise ma consultation et m'empêche d'examiner des urgences parfois sérieuses dans l'attente de votre venue.

Merci à l'avenir de songer aux autres malades qui attendent leur tour.

Cordialement vôtre.

{{doctorName}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'receptionist'],
    tags: ['rappel', 'rendez-vous', 'absence']
  },

  {
    name: 'Rappel de Consultation',
    nameEn: 'Follow-up Consultation Reminder',
    category: 'reminder',
    subCategory: 'follow_up',
    specialty: 'general',
    language: 'fr',
    content: `Cher {{patientTitle}} {{patientName}}

Il serait souhaitable, dans votre intérêt, que nous procédions à une nouvelle consultation pour vérifier votre état de santé oculaire.

Vous pouvez prendre rendez-vous comme d'habitude avec mon secrétariat.

Cordialement vôtre,

{{doctorName}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ],
    allowedRoles: ['admin', 'doctor', 'receptionist'],
    tags: ['rappel', 'consultation', 'suivi']
  }
];

// Seed function
const seedTemplates = async () => {
  try {
    console.log('Starting template seeding...');

    // Clear existing templates
    await DocumentTemplate.deleteMany({});
    console.log('Cleared existing templates');

    // Add templateIds manually before inserting
    const templatesWithIds = documentTemplates.map((template, index) => ({
      ...template,
      templateId: `TPL${String(index + 1).padStart(4, '0')}`
    }));

    // Insert all templates
    const inserted = await DocumentTemplate.insertMany(templatesWithIds);
    console.log(`✅ Successfully seeded ${inserted.length} document templates`);

    // Display summary by category
    const categories = await DocumentTemplate.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Templates by category:');
    categories.forEach(cat => {
      console.log(`  - ${cat._id}: ${cat.count} templates`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  }
};

// Run the seeder
connectDB().then(() => {
  seedTemplates();
});
