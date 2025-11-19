const mongoose = require('mongoose');
const LetterTemplate = require('../models/LetterTemplate');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI);

const letterTemplates = [
  // CERTIFICATS
  {
    name: 'Certificat d\'acuité visuelle',
    category: 'CERTIFICAT',
    content: `Je soussigné, {{doctorName}},

certifie avoir examiné ce jour :

{{patientName}}

Son acuité visuelle sans correction est :
à Droite de {{odVA}} dixièmes
à Gauche de {{osVA}} dixièmes.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'odVA', label: 'Acuité OD', type: 'number', required: true },
      { name: 'osVA', label: 'Acuité OS', type: 'number', required: true }
    ]
  },

  {
    name: 'Certificat de consultation avec accompagnant',
    category: 'CERTIFICAT',
    content: `Je soussigné, {{doctorName}},

certifie que

{{patientName}}

s'est présenté(e) ce jour à mon cabinet pour une consultation accompagné de {{accompagnant}}, qui a dû s'absenter de son travail.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'accompagnant', label: 'Accompagnant', type: 'text', required: true }
    ]
  },

  {
    name: 'Certificat de repos',
    category: 'CERTIFICAT',
    content: `Je soussigné, {{doctorName}},

certifie que

{{patientName}} né(e) le {{birthDate}}

s'est présenté(e) ce jour à mon cabinet pour une consultation. Son état de santé nécessite un repos physique jusqu'au {{endDate}} inclus; il(elle) sera revu(e) le {{nextAppointment}}

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'birthDate', label: 'Date de naissance', type: 'date', required: true },
      { name: 'endDate', label: 'Date de fin de repos', type: 'date', required: true },
      { name: 'nextAppointment', label: 'Prochain RDV', type: 'date' }
    ]
  },

  {
    name: 'Certificat port de verres obligatoire',
    category: 'CERTIFICAT',
    content: `Je soussigné, {{doctorName}},

certifie que l'état de

{{patientName}}

nécessite obligatoirement le port de verres correcteurs adaptés pour le travail sur écran.

Certificat médical établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true }
    ]
  },

  {
    name: 'Certificat arrêt scolaire',
    category: 'CERTIFICAT',
    content: `Je soussigné, {{doctorName}}, certifie que

{{patientName}} né(e) le {{birthDate}}

nécessite un arrêt scolaire de {{days}} jours.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'birthDate', label: 'Date de naissance', type: 'date', required: true },
      { name: 'days', label: 'Nombre de jours', type: 'number', required: true }
    ]
  },

  {
    name: 'Certificat placement premiers rangs',
    category: 'CERTIFICAT',
    content: `Je soussigné, {{doctorName}}, certifie que

{{patientName}} né(e) le {{birthDate}}

doit être placé(e) en classe dans les premiers rangs.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'birthDate', label: 'Date de naissance', type: 'date', required: true }
    ]
  },

  // CERTIFICAT D'APTITUDE
  {
    name: 'Certificat d\'aptitude physique',
    category: 'CERTIFICAT_APTITUDE',
    content: `Je soussigné {{doctorName}}, Docteur en médecine résidant à Kinshasa. Sur demande qui m'a été faite par l'Entreprise {{company}} et après avoir examiné ce jour {{patientName}} né à {{birthPlace}} le {{birthDate}} employé au poste de {{position}};

Je certifie que l'intéressé(e) est :

· Apte aux travaux physiques {{workLevel}} (très légers, légers, modérés, lourds ou très lourds)
· Apte à l'exercice de sa fonction actuelle
· Apte à l'exercice de sa fonction sous réserve de port des verres pour correction optique

Certificat médical établi et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'company', label: 'Entreprise', type: 'text', required: true },
      { name: 'birthPlace', label: 'Lieu de naissance', type: 'text' },
      { name: 'birthDate', label: 'Date de naissance', type: 'date', required: true },
      { name: 'position', label: 'Poste', type: 'text', required: true },
      { name: 'workLevel', label: 'Niveau de travaux', type: 'select', options: ['très légers', 'légers', 'modérés', 'lourds', 'très lourds'] }
    ]
  },

  // COMPTE RENDU OPERATOIRE
  {
    name: 'Compte rendu opératoire phaco',
    category: 'COMPTE_RENDU_OPERATOIRE',
    content: `Compte Rendu Opératoire

de {{patientName}}

âgé(e) de {{age}} ans

Intervention du {{operationDate}}

PhacoEmulsification {{eye}}

Pose d'ICP de marque {{implantBrand}}

Puissance {{implantPower}} Dioptries

Technique classique sans incident.

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'age', label: 'Âge', type: 'number', required: true },
      { name: 'operationDate', label: 'Date d\'intervention', type: 'date', required: true },
      { name: 'eye', label: 'Œil', type: 'select', options: ['OD', 'OG', 'ODG'], required: true },
      { name: 'implantBrand', label: 'Marque implant', type: 'text' },
      { name: 'implantPower', label: 'Puissance implant', type: 'number', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // COURRIER CONFRERE
  {
    name: 'Demande anesthésie cataracte',
    category: 'COURRIER_CONFRERE',
    content: `Cher confrère,

Merci d'examiner {{patientName}}

que je vais opérer de cataracte le: {{operationDate}}

de son œil {{eye}}

Dans le cas présent en accord avec le patient et compte tenu de son âge, je souhaite une anesthésie {{anesthesiaType}}, est ce possible?

PS: Je te laisse le soin de programmer les examens pré-opératoires que tu souhaites

Bien amicalement.

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'operationDate', label: 'Date d\'intervention', type: 'date', required: true },
      { name: 'eye', label: 'Œil', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'anesthesiaType', label: 'Type anesthésie', type: 'select', options: ['générale', 'locale'], required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  {
    name: 'Compte rendu post-opératoire confrère',
    category: 'COURRIER_CONFRERE',
    content: `Cher ami,

J'ai opéré de cataracte l'œil {{eye}} de ton patient

{{patientName}} ce jour.

L'intervention s'est déroulée sous anesthésie locale sans incidents.

J'ai pratiqué une phacoémulsification par voie cornéenne avec pose d'un implant "dans le sac" de {{implantPower}} dioptries qui devrait ammétropiser ce patient d'après les mesures de biométrie pré-opératoires.

Je pense que les suites seront simples.

Je te remercie de ta confiance.

Avec toute mon amitié.

{{doctorName}}`,
    variables: [
      { name: 'eye', label: 'Œil', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'implantPower', label: 'Puissance implant', type: 'number', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // ORDONNANCE POST-OP
  {
    name: 'Ordonnance post-cataracte',
    category: 'ORDONNANCE_POSTOP',
    content: `{{patientName}}

Mettre dans l'œil opéré :

Collyre CHIBROCADRON 1 gtte 3 fois par jour
Collyre INDOCOLLYRE 1 gtte 3 fois par jour

Pendant 1 mois

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  {
    name: 'Traitement pré-opératoire',
    category: 'ORDONNANCE_POSTOP',
    content: `{{patientName}}

Traitement pré-opératoire :

ATARAX 25 : 1cp la veille de l'intervention
1cp le matin même de l'intervention

Mettre dans l'œil à opérer :

Collyre EXOCINE : 1 goutte la veille de l'intervention et ensuite 1 goutte 5 fois par jour
Collyre VOLTARENE : Même posologie que le EXOCINE

Traitement à faire pendant la durée du port de la lentille pansement et ensuite se conformer à la prescription médicale

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // CONSENTEMENT CHIRURGIE
  {
    name: 'Consentement chirurgie myopie',
    category: 'CONSENTEMENT_CHIRURGIE',
    content: `{{patientName}}

Vous avez choisi de faire opérer votre myopie et éventuellement l'astigmatisme associé. Cette lettre matérialise votre consentement éclairé.

Votre ophtalmologiste après avoir étudié votre cas particulier vous a approuvé dans cette démarche. Vous devez savoir quelques éléments qui gouvernent cette chirurgie et ce que l'on peut en attendre.

Des mesures pré-opératoires précises seront prises afin d'établir le protocole opératoire et le geste, authentique geste chirurgical, sera pratiqué sous anesthésie locale par instillation de collyres et dans un centre spécialisé.

Les mesures prises permettent de corriger votre trouble de réfraction avec précision, cependant le résultat final dépend de paramètres difficiles à apprécier comme en particulier la texture exacte de votre cornée et votre cicatrisation. Il s'en suit qu'un œil opéré peut devoir porter une petite correction complémentaire soit par lunettes soit par lentille de contact.

Les complications de cette chirurgie sont rares si on la réserve à des myopies petites ou moyennes. Cependant, comme dans toute chirurgie, des complications infectieuses peuvent survenir, elles seront la plupart du temps facilement jugulées par l'instillation de collyres pendant quelques jours.

Il est indispensable que le port des lentilles de contact soit interrompu une semaine avant les mesures pratiquées au cabinet et également une semaine avant la date de la chirurgie dans le cas de lentilles souples et trois semaines dans le cas de lentilles rigides.

Je confirme vouloir me faire opérer de ma myopie et de mon astigmatisme :

Signature du patient : _______________

Date de la consultation préalable : {{consultationDate}}
Date de la chirurgie du premier œil : {{surgeryDate}}

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'consultationDate', label: 'Date consultation', type: 'date', required: true },
      { name: 'surgeryDate', label: 'Date chirurgie', type: 'date', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // RAPPEL RDV
  {
    name: 'Rappel de rendez-vous',
    category: 'RAPPEL_RDV',
    content: `Cher {{patientName}}

Il serait souhaitable, dans votre intérêt, que nous procédions à une nouvelle consultation pour vérifier votre état de santé oculaire.

Vous pouvez prendre rendez-vous comme d'habitude avec mon secrétariat.

Cordialement vôtre,

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // RELANCE PAIEMENT
  {
    name: 'Relance paiement',
    category: 'RELANCE_PAIEMENT',
    content: `Cher {{patientName}}

J'ai le regret de vous informer que sauf erreur ou omission,

l'acte {{actName}} du {{actDate}} d'un montant de {{amount}} euros

ne m'a pas encore été honoré.

Je vous serais reconnaissant de bien vouloir y remédier par tout moyen à votre convenance.

Cordialement vôtre

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'actName', label: 'Acte', type: 'text', required: true },
      { name: 'actDate', label: 'Date de l\'acte', type: 'date', required: true },
      { name: 'amount', label: 'Montant', type: 'number', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // ECHOGRAPHIE
  {
    name: 'Rapport échographie oculaire',
    category: 'ECHOGRAPHIE',
    content: `{{date}}

Kinshasa

Concerne : {{patientName}}

Age : {{age}} ans    Sexe : {{gender}}

ECHOGRAPHIE OCULAIRE

Indication: {{indication}}

Conclusion: {{conclusion}}

{{doctorName}}`,
    variables: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'age', label: 'Âge', type: 'number', required: true },
      { name: 'gender', label: 'Sexe', type: 'select', options: ['Monsieur', 'Madame'], required: true },
      { name: 'indication', label: 'Indication', type: 'text', required: true },
      { name: 'conclusion', label: 'Conclusion', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  },

  // CHAMP VISUEL
  {
    name: 'Rapport champ visuel',
    category: 'CHAMP_VISUEL',
    content: `J'ai examiné attentivement {{patientName}} :

son examen est tout à fait normal tant au Fond d'œil qu'au biomicroscope.

{{fieldResult}}

{{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'fieldResult', label: 'Résultat champ visuel', type: 'select', options: [
        'champ visuel dans les limites de la normale',
        'champ visuel compatible avec un déficit glaucomateux minime',
        'champ visuel compatible avec un déficit glaucomateux modéré',
        'champ visuel compatible avec un déficit glaucomateux sévère',
        'champ visuel à confronter avec la clinique',
        'marche nasale supérieure',
        'marche nasale inférieure',
        'déficit arciforme supérieur',
        'déficit arciforme inférieur',
        'scotome paracentral',
        'scotome central',
        'scotome caeco-central',
        'baisse générale de la sensibilité rétinienne'
      ], required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true }
    ]
  }
];

async function seedLetterTemplates() {
  try {
    console.log('Starting letter templates seeding...');

    // Clear existing templates
    await LetterTemplate.deleteMany({});

    // Insert new templates
    for (const template of letterTemplates) {
      await LetterTemplate.create(template);
      console.log(`Added template: ${template.name}`);
    }

    console.log(`✅ Successfully seeded ${letterTemplates.length} letter templates`);
  } catch (error) {
    console.error('Error seeding letter templates:', error);
  } finally {
    await mongoose.connection.close();
  }
}

seedLetterTemplates();