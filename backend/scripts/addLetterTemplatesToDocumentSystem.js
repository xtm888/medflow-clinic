const mongoose = require('mongoose');
const DocumentTemplate = require('../models/DocumentTemplate');
require('dotenv').config();

// Letter templates to add to the existing document generation system
// These will integrate with the existing documentGenerationController
const letterTemplates = [
  // ============= CERTIFICATS =============
  {
    templateId: 'CERT-VISUAL-ACUITY',
    name: 'Certificat d\'acuité visuelle',
    nameEn: 'Visual Acuity Certificate',
    category: 'certificate',
    subCategory: 'visual_acuity',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `CERTIFICAT MÉDICAL

Je soussigné, {{doctorName}}, Docteur en Médecine,

certifie avoir examiné ce jour {{consultationDate}} :

{{patientTitle}} {{patientName}}
Né(e) le {{dateOfBirth}}

Son acuité visuelle sans correction est :
- Œil Droit : {{vaOD}} dixièmes
- Œil Gauche : {{vaOG}} dixièmes

Son acuité visuelle avec correction est :
- Œil Droit : {{vaODCorrected}} dixièmes
- Œil Gauche : {{vaOGCorrected}} dixièmes

Certificat établi à la demande de l'intéressé(e) et remis en main propre pour faire valoir ce que de droit.

Fait à Kinshasa, le {{consultationDate}}

{{doctorName}}
{{doctorSpecialty}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Spécialité', type: 'text', defaultValue: 'Ophtalmologue' },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date' },
      { name: 'consultationDate', label: 'Date de consultation', type: 'date', required: true },
      { name: 'vaOD', label: 'Acuité OD sans correction', type: 'text', defaultValue: '0' },
      { name: 'vaOG', label: 'Acuité OG sans correction', type: 'text', defaultValue: '0' },
      { name: 'vaODCorrected', label: 'Acuité OD avec correction', type: 'text' },
      { name: 'vaOGCorrected', label: 'Acuité OG avec correction', type: 'text' }
    ],
    tags: ['certificat', 'acuité visuelle', 'vision'],
    status: 'active'
  },

  {
    templateId: 'CERT-APTITUDE-DRIVING',
    name: 'Certificat d\'aptitude à la conduite automobile',
    nameEn: 'Driving Fitness Certificate',
    category: 'certificate',
    subCategory: 'fitness',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `CERTIFICAT MÉDICAL D'APTITUDE À LA CONDUITE AUTOMOBILE

Je soussigné, {{doctorName}}, Docteur en Médecine, Ophtalmologue,

certifie avoir examiné ce jour {{consultationDate}} :

{{patientTitle}} {{patientName}}
Né(e) le {{dateOfBirth}}

Après examen complet, je certifie que l'intéressé(e) :

ACUITÉ VISUELLE :
- Vision binoculaire : {{visionBinoculaire}} dixièmes
- Œil Droit : {{vaOD}} dixièmes
- Œil Gauche : {{vaOG}} dixièmes

CHAMP VISUEL : {{champVisuel}}

VISION DES COULEURS : {{visionCouleurs}}

CONCLUSION : {{conclusion}}

{{additionalNotes}}

Certificat établi pour faire valoir ce que de droit.

Fait à Kinshasa, le {{consultationDate}}

{{doctorName}}
{{doctorSpecialty}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Spécialité', type: 'text', defaultValue: 'Ophtalmologue' },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date' },
      { name: 'consultationDate', label: 'Date de consultation', type: 'date', required: true },
      { name: 'visionBinoculaire', label: 'Vision binoculaire', type: 'text', required: true },
      { name: 'vaOD', label: 'Acuité OD', type: 'text', required: true },
      { name: 'vaOG', label: 'Acuité OG', type: 'text', required: true },
      { name: 'champVisuel', label: 'Champ visuel', type: 'select', options: ['Normal', 'Rétréci', 'Altéré'], defaultValue: 'Normal' },
      { name: 'visionCouleurs', label: 'Vision des couleurs', type: 'select', options: ['Normale', 'Daltonisme', 'Autre'], defaultValue: 'Normale' },
      { name: 'conclusion', label: 'Conclusion', type: 'select', options: ['APTE à la conduite automobile', 'INAPTE à la conduite automobile', 'Apte avec correction optique'], required: true },
      { name: 'additionalNotes', label: 'Notes supplémentaires', type: 'text' }
    ],
    tags: ['certificat', 'conduite', 'aptitude', 'permis'],
    status: 'active'
  },

  {
    templateId: 'CERT-MEDICAL-LEAVE',
    name: 'Certificat de congé maladie',
    nameEn: 'Medical Leave Certificate',
    category: 'certificate',
    subCategory: 'medical_leave',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `CERTIFICAT DE CONGÉ MALADIE

Je soussigné, {{doctorName}}, Docteur en Médecine,

certifie avoir examiné ce jour {{consultationDate}} :

{{patientTitle}} {{patientName}}
Profession : {{profession}}

et avoir constaté que son état de santé nécessite un arrêt de travail de {{durationDays}} jours.

Du {{startDate}} au {{endDate}} inclus.

Diagnostic : {{diagnosis}}

{{additionalRecommendations}}

Certificat établi à la demande de l'intéressé(e) et remis en main propre.

Fait à Kinshasa, le {{consultationDate}}

{{doctorName}}
{{doctorSpecialty}}`,
    variables: [
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Spécialité', type: 'text', defaultValue: 'Ophtalmologue' },
      { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'profession', label: 'Profession', type: 'text' },
      { name: 'consultationDate', label: 'Date de consultation', type: 'date', required: true },
      { name: 'durationDays', label: 'Durée (jours)', type: 'number', required: true },
      { name: 'startDate', label: 'Date de début', type: 'date', required: true },
      { name: 'endDate', label: 'Date de fin', type: 'date', required: true },
      { name: 'diagnosis', label: 'Diagnostic', type: 'text', required: true },
      { name: 'additionalRecommendations', label: 'Recommandations', type: 'text' }
    ],
    tags: ['certificat', 'congé', 'arrêt travail'],
    status: 'active'
  },

  // ============= COURRIERS CONFRÈRES =============
  {
    templateId: 'LETTER-COLLEAGUE-REFERRAL',
    name: 'Courrier de référence à un confrère',
    nameEn: 'Referral Letter to Colleague',
    category: 'correspondence',
    subCategory: 'general',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `{{recipientName}}
{{recipientTitle}}
{{recipientAddress}}

Kinshasa, le {{consultationDate}}

Cher Confrère,

J'ai l'honneur de vous adresser {{patientTitle}} {{patientName}}, né(e) le {{dateOfBirth}}, que j'ai examiné(e) le {{consultationDate}}.

MOTIF DE CONSULTATION :
{{consultationReason}}

EXAMEN CLINIQUE :
{{clinicalFindings}}

EXAMENS COMPLÉMENTAIRES RÉALISÉS :
{{additionalExams}}

DIAGNOSTIC :
{{diagnosis}}

TRAITEMENT EN COURS :
{{currentTreatment}}

MOTIF DE LA RÉFÉRENCE :
{{referralReason}}

Je vous serais reconnaissant de bien vouloir prendre en charge ce/cette patient(e) et de me tenir informé de la suite donnée.

En vous remerciant par avance, je vous prie d'agréer, Cher Confrère, l'expression de mes sentiments les plus confraternels.

{{doctorName}}
{{doctorSpecialty}}
{{doctorPhone}}
{{doctorEmail}}`,
    variables: [
      { name: 'doctorName', label: 'Votre nom', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Votre spécialité', type: 'text', defaultValue: 'Ophtalmologue' },
      { name: 'doctorPhone', label: 'Votre téléphone', type: 'text' },
      { name: 'doctorEmail', label: 'Votre email', type: 'text' },
      { name: 'recipientName', label: 'Nom du confrère', type: 'text', required: true },
      { name: 'recipientTitle', label: 'Titre du confrère', type: 'text' },
      { name: 'recipientAddress', label: 'Adresse du confrère', type: 'text' },
      { name: 'patientTitle', label: 'Titre patient', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date' },
      { name: 'consultationDate', label: 'Date de consultation', type: 'date', required: true },
      { name: 'consultationReason', label: 'Motif de consultation', type: 'text', required: true },
      { name: 'clinicalFindings', label: 'Examen clinique', type: 'text', required: true },
      { name: 'additionalExams', label: 'Examens complémentaires', type: 'text' },
      { name: 'diagnosis', label: 'Diagnostic', type: 'text', required: true },
      { name: 'currentTreatment', label: 'Traitement en cours', type: 'text' },
      { name: 'referralReason', label: 'Motif de référence', type: 'text', required: true }
    ],
    tags: ['courrier', 'référence', 'confrère'],
    status: 'active'
  },

  // ============= COMPTE-RENDUS OPÉRATOIRES =============
  {
    templateId: 'REPORT-CATARACT-SURGERY',
    name: 'Compte-rendu opératoire - Chirurgie de la cataracte',
    nameEn: 'Operative Report - Cataract Surgery',
    category: 'operative_report',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `COMPTE-RENDU OPÉRATOIRE

Patient : {{patientTitle}} {{patientName}}
Né(e) le : {{dateOfBirth}}
Date de l'intervention : {{surgeryDate}}
Heure : {{surgeryTime}}

INTERVENTION : PHACOEMULSIFICATION AVEC IMPLANTATION DE CRISTALLIN ARTIFICIEL

ŒIL OPÉRÉ : {{operatedEye}}

ANESTHÉSIE : {{anesthesiaType}}

OPÉRATEUR : {{surgeonName}}
ASSISTANT : {{assistantName}}

TECHNIQUE OPÉRATOIRE :

1. Désinfection et champage stérile
2. {{incisionType}} à {{incisionLocation}}
3. Injection de viscoélastique en chambre antérieure
4. Capsulorhexis circulaire continu de {{capsulorhexisSize}} mm
5. Hydrodissection et hydrodelineation
6. Phacoémulsification du noyau cristallinien par technique {{phacoTechnique}}
7. Aspiration des masses corticales
8. Injection de viscoélastique dans le sac capsulaire
9. Implantation d'un cristallin artificiel {{iolType}} de {{iolPower}} dioptries
10. Aspiration du viscoélastique
11. Hydratation des incisions
12. Vérification de l'étanchéité

INCIDENTS PEROPÉRATOIRES : {{intraopIncidents}}

SUITES OPÉRATOIRES IMMÉDIATES : {{immediatePostop}}

TRAITEMENT POSTOPÉRATOIRE :
{{postopTreatment}}

CONSIGNES :
- Éviter tout effort physique pendant 1 semaine
- Ne pas frotter l'œil opéré
- Port de la coque protectrice la nuit pendant 1 semaine
- Instiller les collyres selon prescription

CONTRÔLE : {{followUpDate}}

{{surgeonName}}
{{surgeonTitle}}`,
    variables: [
      { name: 'patientTitle', label: 'Titre patient', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date' },
      { name: 'surgeryDate', label: 'Date de chirurgie', type: 'date', required: true },
      { name: 'surgeryTime', label: 'Heure de chirurgie', type: 'text' },
      { name: 'operatedEye', label: 'Œil opéré', type: 'select', options: ['Droit', 'Gauche'], required: true },
      { name: 'anesthesiaType', label: 'Type d\'anesthésie', type: 'select', options: ['Topique', 'Péribulbaire', 'Rétrobulbaire', 'Générale'], defaultValue: 'Topique' },
      { name: 'surgeonName', label: 'Nom du chirurgien', type: 'text', required: true },
      { name: 'surgeonTitle', label: 'Titre du chirurgien', type: 'text', defaultValue: 'Chirurgien Ophtalmologue' },
      { name: 'assistantName', label: 'Nom de l\'assistant', type: 'text' },
      { name: 'incisionType', label: 'Type d\'incision', type: 'select', options: ['Incision cornéenne claire', 'Incision sclérale'], defaultValue: 'Incision cornéenne claire' },
      { name: 'incisionLocation', label: 'Localisation incision', type: 'text', defaultValue: '12h' },
      { name: 'capsulorhexisSize', label: 'Taille capsulorhexis (mm)', type: 'number', defaultValue: '5.5' },
      { name: 'phacoTechnique', label: 'Technique phaco', type: 'select', options: ['Divide and Conquer', 'Stop and Chop', 'Phaco Chop', 'Quick Chop'], defaultValue: 'Divide and Conquer' },
      { name: 'iolType', label: 'Type d\'implant', type: 'text', required: true },
      { name: 'iolPower', label: 'Puissance implant', type: 'text', required: true },
      { name: 'intraopIncidents', label: 'Incidents peropératoires', type: 'text', defaultValue: 'Aucun' },
      { name: 'immediatePostop', label: 'Suites immédiates', type: 'text', defaultValue: 'Simples' },
      { name: 'postopTreatment', label: 'Traitement postopératoire', type: 'text', required: true },
      { name: 'followUpDate', label: 'Date de contrôle', type: 'text', defaultValue: 'J1, J7, J30' }
    ],
    tags: ['compte-rendu', 'chirurgie', 'cataracte', 'phacoémulsification'],
    status: 'active'
  },

  // ============= ORDONNANCES POST-OPÉRATOIRES =============
  {
    templateId: 'PRESC-POSTOP-CATARACT',
    name: 'Ordonnance post-opératoire cataracte',
    nameEn: 'Post-operative Prescription - Cataract',
    category: 'prescription_instructions',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `ORDONNANCE POST-OPÉRATOIRE

Patient : {{patientName}}
Date : {{prescriptionDate}}

Suite à votre chirurgie de la cataracte de l'œil {{operatedEye}}, veuillez suivre le traitement suivant :

1. ANTIBIOTIQUE :
   {{antibiotic}}
   Posologie : {{antibioticDosage}}
   Durée : {{antibioticDuration}}

2. ANTI-INFLAMMATOIRE :
   {{antiInflammatory}}
   Posologie : {{antiInflammatoryDosage}}
   Durée : {{antiInflammatoryDuration}}

3. LARMES ARTIFICIELLES :
   {{artificialTears}}
   Posologie : {{tearsDosage}}
   Durée : {{tearsDuration}}

{{additionalMedication}}

CONSIGNES IMPORTANTES :
- Bien agiter les flacons avant usage
- Attendre 5 minutes entre chaque collyre
- Se laver les mains avant l'instillation
- Ne pas toucher l'œil avec l'embout du flacon
- Conserver les collyres au réfrigérateur après ouverture

PRÉCAUTIONS :
- Porter la coque protectrice la nuit pendant 7 jours
- Éviter de frotter ou comprimer l'œil
- Éviter l'eau dans l'œil pendant 7 jours
- Pas d'efforts physiques intenses pendant 2 semaines
- Pas de natation pendant 1 mois

SIGNES D'ALERTE (consulter en urgence si) :
- Douleur importante
- Baisse brutale de vision
- Rougeur importante
- Écoulement purulent

Prochain contrôle : {{followUpDate}}

{{doctorName}}
{{doctorSpecialty}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'prescriptionDate', label: 'Date de prescription', type: 'date', required: true },
      { name: 'operatedEye', label: 'Œil opéré', type: 'select', options: ['droit', 'gauche'], required: true },
      { name: 'antibiotic', label: 'Antibiotique', type: 'text', defaultValue: 'TOBREX collyre' },
      { name: 'antibioticDosage', label: 'Posologie antibiotique', type: 'text', defaultValue: '1 goutte 4 fois par jour' },
      { name: 'antibioticDuration', label: 'Durée antibiotique', type: 'text', defaultValue: '1 semaine' },
      { name: 'antiInflammatory', label: 'Anti-inflammatoire', type: 'text', defaultValue: 'MAXIDEX collyre' },
      { name: 'antiInflammatoryDosage', label: 'Posologie anti-inflammatoire', type: 'text', defaultValue: '1 goutte 4 fois par jour' },
      { name: 'antiInflammatoryDuration', label: 'Durée anti-inflammatoire', type: 'text', defaultValue: '4 semaines avec dégression' },
      { name: 'artificialTears', label: 'Larmes artificielles', type: 'text', defaultValue: 'SYSTANE ULTRA' },
      { name: 'tearsDosage', label: 'Posologie larmes', type: 'text', defaultValue: '1 goutte 4 à 6 fois par jour' },
      { name: 'tearsDuration', label: 'Durée larmes', type: 'text', defaultValue: '3 mois minimum' },
      { name: 'additionalMedication', label: 'Médicaments supplémentaires', type: 'text' },
      { name: 'followUpDate', label: 'Date de contrôle', type: 'text', defaultValue: 'dans 1 semaine' },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Spécialité', type: 'text', defaultValue: 'Chirurgien Ophtalmologue' }
    ],
    tags: ['ordonnance', 'post-opératoire', 'cataracte', 'instructions'],
    status: 'active'
  },

  // ============= CONSENTEMENTS ÉCLAIRÉS =============
  {
    templateId: 'CONSENT-CATARACT-SURGERY',
    name: 'Consentement éclairé - Chirurgie de la cataracte',
    nameEn: 'Informed Consent - Cataract Surgery',
    category: 'surgical_consent',
    subCategory: 'cataract_surgery',
    specialty: 'surgery',
    language: 'fr',
    content: `FORMULAIRE DE CONSENTEMENT ÉCLAIRÉ
CHIRURGIE DE LA CATARACTE

Je soussigné(e), {{patientName}}, né(e) le {{dateOfBirth}},

reconnais avoir été informé(e) par le Docteur {{doctorName}} de la nécessité d'une intervention chirurgicale pour traiter la cataracte de mon œil {{operatedEye}}.

J'AI ÉTÉ INFORMÉ(E) :

1. DE LA NATURE DE L'INTERVENTION :
   - Extraction du cristallin opacifié
   - Mise en place d'un implant intraoculaire
   - Technique : {{surgicalTechnique}}

2. DES BÉNÉFICES ATTENDUS :
   - Amélioration de l'acuité visuelle
   - Amélioration de la qualité de vision
   - Récupération visuelle habituellement rapide

3. DES RISQUES ET COMPLICATIONS POSSIBLES :
   RISQUES FRÉQUENTS (>1%) :
   - Inflammation postopératoire
   - Œdème cornéen transitoire
   - Sensibilité à la lumière
   - Vision floue temporaire

   RISQUES RARES (<1%) :
   - Infection intraoculaire (endophtalmie)
   - Décollement de rétine
   - Œdème maculaire
   - Hémorragie intraoculaire
   - Luxation de l'implant

   RISQUES EXCEPTIONNELS :
   - Perte de vision définitive
   - Perte du globe oculaire

4. DES ALTERNATIVES :
   - Abstention thérapeutique avec aggravation progressive
   - Correction optique (efficacité limitée)

5. DE L'ANESTHÉSIE :
   Type proposé : {{anesthesiaType}}
   Risques spécifiques discutés avec l'anesthésiste

J'ai pu poser toutes les questions que je souhaitais et j'ai reçu des réponses claires et compréhensibles.

Je comprends qu'aucune garantie absolue ne peut être donnée quant au résultat de l'intervention.

J'accepte que des photographies ou vidéos puissent être réalisées à des fins médicales.

☐ J'ACCEPTE l'intervention proposée
☐ JE REFUSE l'intervention proposée

Fait à Kinshasa, le {{consentDate}}

Signature du patient :                    Signature du médecin :


{{patientName}}                           {{doctorName}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date de naissance', type: 'date' },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'operatedEye', label: 'Œil à opérer', type: 'select', options: ['droit', 'gauche', 'les deux yeux'], required: true },
      { name: 'surgicalTechnique', label: 'Technique chirurgicale', type: 'select', options: ['Phacoémulsification', 'Extraction extracapsulaire', 'Extraction intracapsulaire'], defaultValue: 'Phacoémulsification' },
      { name: 'anesthesiaType', label: 'Type d\'anesthésie', type: 'select', options: ['Topique (collyre)', 'Péribulbaire', 'Rétrobulbaire', 'Générale'], defaultValue: 'Topique (collyre)' },
      { name: 'consentDate', label: 'Date du consentement', type: 'date', required: true }
    ],
    tags: ['consentement', 'chirurgie', 'cataracte', 'information'],
    status: 'active'
  },

  // ============= RAPPORTS D'EXAMENS =============
  {
    templateId: 'REPORT-OCT-MACULA',
    name: 'Compte-rendu OCT maculaire',
    nameEn: 'OCT Macula Report',
    category: 'examination_report',
    subCategory: 'general',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `COMPTE-RENDU D'EXAMEN OCT MACULAIRE

Patient : {{patientName}}
Date de l'examen : {{examDate}}
Appareil : {{deviceName}}

INDICATION : {{indication}}

RÉSULTATS :

ŒIL DROIT :
- Épaisseur maculaire centrale : {{centralThicknessOD}} µm
- Volume maculaire : {{macularVolumeOD}} mm³
- Profil fovéal : {{fovealProfileOD}}
- Interface vitréo-rétinienne : {{vitreoretinalInterfaceOD}}
- Couches rétiniennes : {{retinalLayersOD}}
- Liquide sous-rétinien : {{subretinalFluidOD}}
- Liquide intrarétinien : {{intraretinalFluidOD}}

ŒIL GAUCHE :
- Épaisseur maculaire centrale : {{centralThicknessOG}} µm
- Volume maculaire : {{macularVolumeOG}} mm³
- Profil fovéal : {{fovealProfileOG}}
- Interface vitréo-rétinienne : {{vitreoretinalInterfaceOG}}
- Couches rétiniennes : {{retinalLayersOG}}
- Liquide sous-rétinien : {{subretinalFluidOG}}
- Liquide intrarétinien : {{intraretinalFluidOG}}

CONCLUSION :
{{conclusion}}

RECOMMANDATIONS :
{{recommendations}}

{{doctorName}}
{{doctorSpecialty}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'examDate', label: 'Date de l\'examen', type: 'date', required: true },
      { name: 'deviceName', label: 'Appareil OCT', type: 'text', defaultValue: 'OCT Spectral Domain' },
      { name: 'indication', label: 'Indication', type: 'text', required: true },
      { name: 'centralThicknessOD', label: 'Épaisseur centrale OD (µm)', type: 'number' },
      { name: 'macularVolumeOD', label: 'Volume maculaire OD (mm³)', type: 'number' },
      { name: 'fovealProfileOD', label: 'Profil fovéal OD', type: 'select', options: ['Normal', 'Aplati', 'Absent'], defaultValue: 'Normal' },
      { name: 'vitreoretinalInterfaceOD', label: 'Interface vitréo-rétinienne OD', type: 'select', options: ['Normal', 'Membrane épirétinienne', 'Traction vitréo-maculaire'], defaultValue: 'Normal' },
      { name: 'retinalLayersOD', label: 'Couches rétiniennes OD', type: 'select', options: ['Normales', 'Désorganisées', 'Atrophie'], defaultValue: 'Normales' },
      { name: 'subretinalFluidOD', label: 'Liquide sous-rétinien OD', type: 'select', options: ['Absent', 'Présent'], defaultValue: 'Absent' },
      { name: 'intraretinalFluidOD', label: 'Liquide intrarétinien OD', type: 'select', options: ['Absent', 'Présent'], defaultValue: 'Absent' },
      { name: 'centralThicknessOG', label: 'Épaisseur centrale OG (µm)', type: 'number' },
      { name: 'macularVolumeOG', label: 'Volume maculaire OG (mm³)', type: 'number' },
      { name: 'fovealProfileOG', label: 'Profil fovéal OG', type: 'select', options: ['Normal', 'Aplati', 'Absent'], defaultValue: 'Normal' },
      { name: 'vitreoretinalInterfaceOG', label: 'Interface vitréo-rétinienne OG', type: 'select', options: ['Normal', 'Membrane épirétinienne', 'Traction vitréo-maculaire'], defaultValue: 'Normal' },
      { name: 'retinalLayersOG', label: 'Couches rétiniennes OG', type: 'select', options: ['Normales', 'Désorganisées', 'Atrophie'], defaultValue: 'Normales' },
      { name: 'subretinalFluidOG', label: 'Liquide sous-rétinien OG', type: 'select', options: ['Absent', 'Présent'], defaultValue: 'Absent' },
      { name: 'intraretinalFluidOG', label: 'Liquide intrarétinien OG', type: 'select', options: ['Absent', 'Présent'], defaultValue: 'Absent' },
      { name: 'conclusion', label: 'Conclusion', type: 'text', required: true },
      { name: 'recommendations', label: 'Recommandations', type: 'text' },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Spécialité', type: 'text', defaultValue: 'Ophtalmologue' }
    ],
    tags: ['OCT', 'macula', 'imagerie', 'rapport'],
    status: 'active'
  },

  {
    templateId: 'REPORT-VISUAL-FIELD',
    name: 'Compte-rendu de champ visuel',
    nameEn: 'Visual Field Report',
    category: 'examination_report',
    subCategory: 'visual_field',
    specialty: 'ophthalmology',
    language: 'fr',
    content: `COMPTE-RENDU DE CHAMP VISUEL

Patient : {{patientName}}
Date de l'examen : {{examDate}}
Appareil : {{deviceName}}
Programme : {{program}}

RÉSULTATS :

ŒIL DROIT :
- Fiabilité : FL {{falsePositiveOD}}% FN {{falseNegativeOD}}% PF {{fixationLossOD}}%
- MD (Mean Deviation) : {{mdOD}} dB
- PSD (Pattern Standard Deviation) : {{psdOD}} dB
- VFI (Visual Field Index) : {{vfiOD}}%
- Déficit : {{deficitTypeOD}}
- Localisation : {{deficitLocationOD}}

ŒIL GAUCHE :
- Fiabilité : FL {{falsePositiveOG}}% FN {{falseNegativeOG}}% PF {{fixationLossOG}}%
- MD (Mean Deviation) : {{mdOG}} dB
- PSD (Pattern Standard Deviation) : {{psdOG}} dB
- VFI (Visual Field Index) : {{vfiOG}}%
- Déficit : {{deficitTypeOG}}
- Localisation : {{deficitLocationOG}}

INTERPRÉTATION :
{{interpretation}}

ÉVOLUTION PAR RAPPORT À L'EXAMEN PRÉCÉDENT :
{{evolution}}

CONCLUSION :
{{conclusion}}

RECOMMANDATIONS :
{{recommendations}}

{{doctorName}}
{{doctorSpecialty}}`,
    variables: [
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'examDate', label: 'Date de l\'examen', type: 'date', required: true },
      { name: 'deviceName', label: 'Appareil', type: 'text', defaultValue: 'Humphrey Field Analyzer' },
      { name: 'program', label: 'Programme', type: 'select', options: ['24-2', '30-2', '10-2', '60-4'], defaultValue: '24-2' },
      { name: 'falsePositiveOD', label: 'Faux positifs OD (%)', type: 'number' },
      { name: 'falseNegativeOD', label: 'Faux négatifs OD (%)', type: 'number' },
      { name: 'fixationLossOD', label: 'Pertes de fixation OD (%)', type: 'number' },
      { name: 'mdOD', label: 'MD OD (dB)', type: 'number' },
      { name: 'psdOD', label: 'PSD OD (dB)', type: 'number' },
      { name: 'vfiOD', label: 'VFI OD (%)', type: 'number' },
      { name: 'deficitTypeOD', label: 'Type de déficit OD', type: 'select', options: ['Aucun', 'Diffus', 'Localisé', 'Arciforme', 'Nasal step'], defaultValue: 'Aucun' },
      { name: 'deficitLocationOD', label: 'Localisation déficit OD', type: 'text' },
      { name: 'falsePositiveOG', label: 'Faux positifs OG (%)', type: 'number' },
      { name: 'falseNegativeOG', label: 'Faux négatifs OG (%)', type: 'number' },
      { name: 'fixationLossOG', label: 'Pertes de fixation OG (%)', type: 'number' },
      { name: 'mdOG', label: 'MD OG (dB)', type: 'number' },
      { name: 'psdOG', label: 'PSD OG (dB)', type: 'number' },
      { name: 'vfiOG', label: 'VFI OG (%)', type: 'number' },
      { name: 'deficitTypeOG', label: 'Type de déficit OG', type: 'select', options: ['Aucun', 'Diffus', 'Localisé', 'Arciforme', 'Nasal step'], defaultValue: 'Aucun' },
      { name: 'deficitLocationOG', label: 'Localisation déficit OG', type: 'text' },
      { name: 'interpretation', label: 'Interprétation', type: 'text', required: true },
      { name: 'evolution', label: 'Évolution', type: 'select', options: ['Stable', 'Amélioration', 'Aggravation', 'Premier examen'], defaultValue: 'Premier examen' },
      { name: 'conclusion', label: 'Conclusion', type: 'text', required: true },
      { name: 'recommendations', label: 'Recommandations', type: 'text' },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'doctorSpecialty', label: 'Spécialité', type: 'text', defaultValue: 'Ophtalmologue' }
    ],
    tags: ['champ visuel', 'périmétrie', 'glaucome', 'rapport'],
    status: 'active'
  },

  // ============= RAPPELS ET RELANCES =============
  {
    templateId: 'REMINDER-APPOINTMENT',
    name: 'Rappel de rendez-vous',
    nameEn: 'Appointment Reminder',
    category: 'reminder',
    subCategory: 'missed_appointment',
    specialty: 'general',
    language: 'fr',
    content: `Kinshasa, le {{currentDate}}

{{patientTitle}} {{patientName}}
{{patientAddress}}

Objet : Rappel de votre rendez-vous

{{patientTitle}} {{patientName}},

Nous vous rappelons votre rendez-vous prévu le {{appointmentDate}} à {{appointmentTime}} avec le Docteur {{doctorName}}.

Service : {{department}}
Motif : {{appointmentReason}}

Merci de bien vouloir confirmer votre présence en nous contactant au {{clinicPhone}}.

En cas d'empêchement, nous vous prions de nous prévenir au moins 24 heures à l'avance afin que nous puissions proposer ce créneau à un autre patient.

{{additionalInstructions}}

Nous restons à votre disposition pour tout renseignement complémentaire.

Cordialement,

Le secrétariat médical
{{clinicName}}
{{clinicAddress}}
Tel : {{clinicPhone}}`,
    variables: [
      { name: 'currentDate', label: 'Date actuelle', type: 'date', required: true },
      { name: 'patientTitle', label: 'Titre patient', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'patientAddress', label: 'Adresse patient', type: 'text' },
      { name: 'appointmentDate', label: 'Date du rendez-vous', type: 'date', required: true },
      { name: 'appointmentTime', label: 'Heure du rendez-vous', type: 'text', required: true },
      { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
      { name: 'department', label: 'Service', type: 'text', defaultValue: 'Ophtalmologie' },
      { name: 'appointmentReason', label: 'Motif du rendez-vous', type: 'text' },
      { name: 'additionalInstructions', label: 'Instructions supplémentaires', type: 'text' },
      { name: 'clinicName', label: 'Nom de la clinique', type: 'text', required: true },
      { name: 'clinicAddress', label: 'Adresse clinique', type: 'text' },
      { name: 'clinicPhone', label: 'Téléphone clinique', type: 'text', required: true }
    ],
    tags: ['rappel', 'rendez-vous', 'relance'],
    status: 'active'
  },

  {
    templateId: 'PAYMENT-REMINDER',
    name: 'Relance de paiement',
    nameEn: 'Payment Reminder',
    category: 'payment',
    subCategory: 'payment_request',
    specialty: 'general',
    language: 'fr',
    content: `Kinshasa, le {{currentDate}}

{{patientTitle}} {{patientName}}
{{patientAddress}}

Objet : Rappel de paiement

{{patientTitle}} {{patientName}},

Nous nous permettons de vous rappeler que votre facture n°{{invoiceNumber}} du {{invoiceDate}} d'un montant de {{invoiceAmount}} FC reste impayée à ce jour.

DÉTAIL DE LA FACTURE :
{{invoiceDetails}}

MONTANT DÛ : {{amountDue}} FC

Nous vous prions de bien vouloir régulariser votre situation dans les plus brefs délais.

Modes de paiement acceptés :
- Espèces au secrétariat
- Virement bancaire : {{bankDetails}}
- Mobile Money : {{mobileMoneyDetails}}

Si vous avez déjà effectué ce règlement, merci de ne pas tenir compte de ce courrier et de nous transmettre votre justificatif de paiement.

Pour toute question concernant cette facture, n'hésitez pas à nous contacter au {{clinicPhone}}.

Nous vous remercions de votre compréhension et restons à votre disposition.

Cordialement,

Service Comptabilité
{{clinicName}}
{{clinicAddress}}
Tel : {{clinicPhone}}`,
    variables: [
      { name: 'currentDate', label: 'Date actuelle', type: 'date', required: true },
      { name: 'patientTitle', label: 'Titre patient', type: 'select', options: ['Monsieur', 'Madame', 'Mademoiselle'] },
      { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
      { name: 'patientAddress', label: 'Adresse patient', type: 'text' },
      { name: 'invoiceNumber', label: 'Numéro de facture', type: 'text', required: true },
      { name: 'invoiceDate', label: 'Date de facture', type: 'date', required: true },
      { name: 'invoiceAmount', label: 'Montant facture', type: 'text', required: true },
      { name: 'invoiceDetails', label: 'Détail de la facture', type: 'text' },
      { name: 'amountDue', label: 'Montant dû', type: 'text', required: true },
      { name: 'bankDetails', label: 'Coordonnées bancaires', type: 'text' },
      { name: 'mobileMoneyDetails', label: 'Détails Mobile Money', type: 'text' },
      { name: 'clinicName', label: 'Nom de la clinique', type: 'text', required: true },
      { name: 'clinicAddress', label: 'Adresse clinique', type: 'text' },
      { name: 'clinicPhone', label: 'Téléphone clinique', type: 'text', required: true }
    ],
    tags: ['paiement', 'relance', 'facture'],
    status: 'active'
  }
];

async function addLetterTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carevision');
    console.log('🔌 Connected to MongoDB');

    console.log('\n📄 Adding letter templates to existing document generation system...\n');

    let addedCount = 0;
    let skippedCount = 0;

    for (const template of letterTemplates) {
      // Check if template already exists
      const existing = await DocumentTemplate.findOne({ templateId: template.templateId });

      if (existing) {
        console.log(`⏭️  Skipping ${template.name} - already exists`);
        skippedCount++;
      } else {
        // Add allowed roles for ophthalmology templates
        template.allowedRoles = ['admin', 'doctor', 'ophthalmologist', 'nurse', 'orthoptist'];

        // Add usage count initialization
        template.usageCount = 0;

        // Create the template
        await DocumentTemplate.create(template);
        console.log(`✅ Added: ${template.name} (${template.category})`);
        addedCount++;
      }
    }

    // Display summary by category
    const categorySummary = await DocumentTemplate.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          templates: { $push: '$name' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 DOCUMENT TEMPLATE SUMMARY:');
    console.log('=====================================');
    categorySummary.forEach(cat => {
      console.log(`\n${cat._id.toUpperCase()}: ${cat.count} templates`);
      cat.templates.forEach(t => console.log(`  - ${t}`));
    });

    console.log('\n✨ Letter template integration complete!');
    console.log(`   Added: ${addedCount} new templates`);
    console.log(`   Skipped: ${skippedCount} existing templates`);
    console.log(`   Total templates in system: ${await DocumentTemplate.countDocuments()}`);
    console.log('\n💡 These templates are now available in the existing document generation system');
    console.log('   Access them via: /api/document-generation/templates');

  } catch (error) {
    console.error('❌ Error adding letter templates:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute the script
addLetterTemplates();