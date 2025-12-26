/**
 * Messages d'erreur standardisés - Version française
 *
 * Messages d'erreur centralisés pour des réponses API cohérentes.
 * Organisés par domaine/fonctionnalité pour faciliter la maintenance.
 *
 * Contexte: MedFlow - Système de gestion de cabinet ophtalmologique
 * pour la RDC (République Démocratique du Congo)
 */

module.exports = {
  // ==========================================
  // AUTHENTIFICATION & AUTORISATION
  // ==========================================
  AUTH: {
    INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
    EMAIL_REQUIRED: 'L\'email est requis',
    PASSWORD_REQUIRED: 'Le mot de passe est requis',
    PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 8 caractères',
    PASSWORD_TOO_WEAK: 'Le mot de passe doit contenir des majuscules, minuscules et chiffres',
    USER_NOT_FOUND: 'Utilisateur non trouvé',
    USER_ALREADY_EXISTS: 'Un utilisateur avec cet email existe déjà',
    ACCOUNT_DISABLED: 'Votre compte a été désactivé. Contactez l\'administrateur.',
    TOKEN_INVALID: 'Jeton invalide ou expiré',
    TOKEN_MISSING: 'Jeton d\'authentification requis',
    INSUFFICIENT_PERMISSIONS: 'Vous n\'avez pas la permission d\'effectuer cette action',
    SESSION_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
    PASSWORD_RESET_INVALID: 'Le jeton de réinitialisation est invalide ou a expiré',
    EMAIL_NOT_VERIFIED: 'Veuillez vérifier votre adresse email',
    TWO_FACTOR_REQUIRED: 'Code d\'authentification à deux facteurs requis',
    TWO_FACTOR_INVALID: 'Code d\'authentification à deux facteurs invalide'
  },

  // ==========================================
  // GESTION DES PATIENTS
  // ==========================================
  PATIENT: {
    NOT_FOUND: 'Patient non trouvé',
    ID_REQUIRED: 'L\'identifiant du patient est requis',
    DUPLICATE_MRN: 'Un patient avec ce numéro de dossier médical existe déjà',
    INVALID_DATE_OF_BIRTH: 'Date de naissance invalide',
    INVALID_PHONE: 'Format de numéro de téléphone invalide',
    INVALID_EMAIL: 'Adresse email invalide',
    FIRST_NAME_REQUIRED: 'Le prénom est requis',
    LAST_NAME_REQUIRED: 'Le nom de famille est requis',
    GENDER_REQUIRED: 'Le sexe est requis',
    ALREADY_REGISTERED: 'Le patient est déjà enregistré',
    MINOR_NO_GUARDIAN: 'Les informations du tuteur sont requises pour les patients de moins de 18 ans',
    MERGE_CONFLICT: 'Impossible de fusionner: les patients ont des données contradictoires',
    DUPLICATE_DETECTION: 'Doublon potentiel détecté',
    INVALID_STATUS: 'Statut du patient invalide'
  },

  // ==========================================
  // RENDEZ-VOUS
  // ==========================================
  APPOINTMENT: {
    NOT_FOUND: 'Rendez-vous non trouvé',
    ID_REQUIRED: 'L\'identifiant du rendez-vous est requis',
    PATIENT_REQUIRED: 'Le patient est requis',
    PROVIDER_REQUIRED: 'Le médecin est requis',
    DATE_REQUIRED: 'La date du rendez-vous est requise',
    TIME_REQUIRED: 'L\'heure du rendez-vous est requise',
    INVALID_DATE: 'Date de rendez-vous invalide',
    DATE_IN_PAST: 'Impossible de planifier des rendez-vous dans le passé',
    SLOT_UNAVAILABLE: 'Ce créneau horaire n\'est pas disponible',
    OVERLAPPING: 'Ce rendez-vous entre en conflit avec un rendez-vous existant',
    ALREADY_CONFIRMED: 'Le rendez-vous est déjà confirmé',
    ALREADY_CANCELLED: 'Le rendez-vous est déjà annulé',
    TOO_LATE_TO_CANCEL: 'Impossible d\'annuler un rendez-vous moins de 24 heures avant l\'heure prévue',
    INVALID_STATUS: 'Statut du rendez-vous invalide',
    PROVIDER_UNAVAILABLE: 'Le médecin n\'est pas disponible à cette heure'
  },

  // ==========================================
  // VISITES / CONSULTATIONS
  // ==========================================
  VISIT: {
    NOT_FOUND: 'Visite non trouvée',
    ID_REQUIRED: 'L\'identifiant de la visite est requis',
    PATIENT_REQUIRED: 'Le patient est requis pour la visite',
    PROVIDER_REQUIRED: 'Le médecin est requis pour la visite',
    ALREADY_COMPLETED: 'La visite est déjà terminée',
    NOT_STARTED: 'La visite n\'a pas encore commencé',
    CHIEF_COMPLAINT_REQUIRED: 'Le motif de consultation est requis',
    VITAL_SIGNS_REQUIRED: 'Les signes vitaux sont requis',
    INVALID_STATUS: 'Statut de la visite invalide',
    CANNOT_COMPLETE: 'Impossible de terminer la visite sans la documentation requise',
    ALREADY_HAS_ACTIVE_VISIT: 'Le patient a déjà une visite en cours'
  },

  // ==========================================
  // ORDONNANCES / PRESCRIPTIONS
  // ==========================================
  PRESCRIPTION: {
    NOT_FOUND: 'Ordonnance non trouvée',
    ID_REQUIRED: 'L\'identifiant de l\'ordonnance est requis',
    PATIENT_REQUIRED: 'Le patient est requis',
    PRESCRIBER_REQUIRED: 'Le prescripteur est requis',
    MEDICATION_REQUIRED: 'Au moins un médicament est requis',
    INVALID_DOSAGE: 'Posologie invalide',
    INVALID_FREQUENCY: 'Fréquence de dosage invalide',
    INVALID_DURATION: 'Durée du traitement invalide',
    ALREADY_DISPENSED: 'L\'ordonnance a déjà été dispensée',
    ALREADY_CANCELLED: 'L\'ordonnance est déjà annulée',
    EXPIRED: 'L\'ordonnance a expiré',
    INSUFFICIENT_STOCK: 'Stock insuffisant pour ce médicament',
    DRUG_INTERACTION: 'Interaction médicamenteuse potentielle détectée',
    ALLERGY_WARNING: 'Le patient a une allergie documentée à ce médicament',
    INVALID_REFILLS: 'Nombre de renouvellements invalide',
    MAX_REFILLS_EXCEEDED: 'Nombre maximum de renouvellements dépassé'
  },

  // ==========================================
  // FACTURES & FACTURATION
  // ==========================================
  INVOICE: {
    NOT_FOUND: 'Facture non trouvée',
    ID_REQUIRED: 'L\'identifiant de la facture est requis',
    PATIENT_REQUIRED: 'Le patient est requis pour la facture',
    NO_ITEMS: 'La facture doit contenir au moins un article',
    INVALID_AMOUNT: 'Montant de la facture invalide',
    AMOUNT_MISMATCH: 'Le montant du paiement ne correspond pas au total de la facture',
    ALREADY_PAID: 'La facture est déjà payée en totalité',
    OVERPAYMENT: 'Le montant du paiement dépasse le solde restant',
    NEGATIVE_AMOUNT: 'Le montant de la facture ne peut pas être négatif',
    INVALID_PAYMENT_METHOD: 'Mode de paiement invalide',
    INVALID_ITEM_ID: 'Identifiant d\'article invalide',
    ITEM_NOT_FOUND: 'Article de la facture non trouvé',
    CANNOT_MODIFY_PAID: 'Impossible de modifier une facture payée',
    INVALID_STATUS: 'Statut de la facture invalide',
    DISCOUNT_TOO_HIGH: 'La remise ne peut pas dépasser 100%',
    FEE_SCHEDULE_NOT_FOUND: 'Code de tarification non trouvé',
    CONVENTION_NOT_ACTIVE: 'La convention du patient n\'est pas active'
  },

  // ==========================================
  // PHARMACIE & INVENTAIRE
  // ==========================================
  PHARMACY: {
    MEDICATION_NOT_FOUND: 'Médicament non trouvé dans l\'inventaire',
    INSUFFICIENT_STOCK: 'Stock insuffisant pour ce médicament',
    BATCH_EXPIRED: 'Le lot de médicament a expiré',
    BATCH_NOT_FOUND: 'Lot de médicament non trouvé',
    INVALID_QUANTITY: 'Quantité invalide',
    ALREADY_DISPENSED: 'Médicament déjà dispensé',
    DISPENSE_FAILED: 'Échec de la dispensation du médicament',
    STOCK_BELOW_MINIMUM: 'Niveau de stock inférieur au seuil minimum',
    REORDER_REQUIRED: 'Réapprovisionnement requis pour cet article',
    INVALID_EXPIRY_DATE: 'Date d\'expiration invalide',
    NEGATIVE_STOCK: 'Le niveau de stock ne peut pas être négatif',
    RESERVATION_EXPIRED: 'La réservation d\'inventaire a expiré',
    RESERVATION_NOT_FOUND: 'Réservation d\'inventaire non trouvée'
  },

  // ==========================================
  // LABORATOIRE
  // ==========================================
  LAB: {
    ORDER_NOT_FOUND: 'Ordre de laboratoire non trouvé',
    TEST_NOT_FOUND: 'Test de laboratoire non trouvé',
    RESULT_NOT_FOUND: 'Résultat de laboratoire non trouvé',
    PATIENT_REQUIRED: 'Le patient est requis pour l\'ordre de labo',
    PROVIDER_REQUIRED: 'Le médecin prescripteur est requis',
    NO_TESTS: 'L\'ordre de labo doit inclure au moins un test',
    SPECIMEN_NOT_COLLECTED: 'Échantillon pas encore prélevé',
    ALREADY_COMPLETED: 'Le test de labo est déjà terminé',
    CRITICAL_VALUE: 'Valeur critique détectée - notification immédiate du médecin requise',
    QC_FAILED: 'Échec du contrôle qualité',
    ANALYZER_OFFLINE: 'L\'analyseur de laboratoire est hors ligne',
    INVALID_RESULT: 'Valeur de résultat de test invalide',
    MISSING_REFERENCE_RANGE: 'Plage de référence non définie pour ce test'
  },

  // ==========================================
  // OPHTALMOLOGIE
  // ==========================================
  OPHTHALMOLOGY: {
    EXAM_NOT_FOUND: 'Examen ophtalmologique non trouvé',
    INVALID_VISUAL_ACUITY: 'Valeur d\'acuité visuelle invalide',
    INVALID_IOP: 'Valeur de pression intraoculaire invalide',
    GLASSES_ORDER_NOT_FOUND: 'Commande de lunettes non trouvée',
    INVALID_PRESCRIPTION: 'Ordonnance optique invalide',
    INVALID_SPHERE: 'Valeur de sphère invalide',
    INVALID_CYLINDER: 'Valeur de cylindre invalide',
    INVALID_AXIS: 'Valeur d\'axe invalide (doit être 0-180)',
    INVALID_PD: 'Écart pupillaire invalide',
    FRAME_NOT_SELECTED: 'La sélection de la monture est requise',
    LENS_TYPE_REQUIRED: 'Le type de verre est requis',
    IVT_NOT_FOUND: 'Enregistrement d\'injection IVT non trouvé',
    SURGERY_NOT_FOUND: 'Dossier de chirurgie non trouvé',
    INVALID_EYE: 'Sélection d\'œil invalide (doit être OD, OS ou OU)'
  },

  // ==========================================
  // DOCUMENTS
  // ==========================================
  DOCUMENT: {
    NOT_FOUND: 'Document non trouvé',
    INVALID_TYPE: 'Type de document invalide',
    UPLOAD_FAILED: 'Échec du téléchargement du document',
    FILE_TOO_LARGE: 'La taille du fichier dépasse la limite maximale',
    INVALID_FILE_TYPE: 'Type de fichier invalide',
    GENERATION_FAILED: 'Échec de la génération du document',
    TEMPLATE_NOT_FOUND: 'Modèle de document non trouvé',
    SIGNATURE_REQUIRED: 'La signature du document est requise',
    ALREADY_SIGNED: 'Le document est déjà signé',
    MISSING_DATA: 'Données requises manquantes pour la génération du document'
  },

  // ==========================================
  // GÉNÉRAL / VALIDATION
  // ==========================================
  VALIDATION: {
    REQUIRED_FIELD: (field) => `${field} est requis`,
    INVALID_FORMAT: (field) => `Format de ${field} invalide`,
    INVALID_VALUE: (field) => `Valeur invalide pour ${field}`,
    OUT_OF_RANGE: (field, min, max) => `${field} doit être entre ${min} et ${max}`,
    TOO_SHORT: (field, min) => `${field} doit contenir au moins ${min} caractères`,
    TOO_LONG: (field, max) => `${field} ne doit pas dépasser ${max} caractères`,
    INVALID_ENUM: (field, values) => `${field} doit être l'un des suivants: ${values.join(', ')}`,
    INVALID_DATE_RANGE: 'La date de début doit être avant la date de fin',
    FUTURE_DATE_NOT_ALLOWED: 'Les dates futures ne sont pas autorisées',
    PAST_DATE_NOT_ALLOWED: 'Les dates passées ne sont pas autorisées'
  },

  // ==========================================
  // BASE DE DONNÉES / SYSTÈME
  // ==========================================
  SYSTEM: {
    DATABASE_ERROR: 'Erreur de base de données. Veuillez réessayer.',
    CONNECTION_ERROR: 'Erreur de connexion à la base de données',
    TRANSACTION_FAILED: 'La transaction a échoué et a été annulée',
    INTERNAL_ERROR: 'Une erreur interne du serveur s\'est produite',
    SERVICE_UNAVAILABLE: 'Service temporairement indisponible. Veuillez réessayer plus tard.',
    MAINTENANCE_MODE: 'Le système est actuellement en maintenance',
    RATE_LIMIT_EXCEEDED: 'Trop de requêtes. Veuillez ralentir.',
    TIMEOUT: 'Délai d\'attente dépassé. Veuillez réessayer.',
    NETWORK_ERROR: 'Erreur réseau. Veuillez vérifier votre connexion.',
    FILE_SYSTEM_ERROR: 'Erreur du système de fichiers',
    REDIS_UNAVAILABLE: 'Service de cache indisponible'
  },

  // ==========================================
  // APPAREILS & INTÉGRATION
  // ==========================================
  DEVICE: {
    NOT_FOUND: 'Appareil médical non trouvé',
    OFFLINE: 'L\'appareil est hors ligne',
    CONNECTION_FAILED: 'Échec de la connexion à l\'appareil',
    SYNC_FAILED: 'Échec de la synchronisation des données de l\'appareil',
    INVALID_DATA: 'Données invalides reçues de l\'appareil',
    FILE_PARSE_ERROR: 'Échec de l\'analyse du fichier de l\'appareil',
    UNSUPPORTED_FORMAT: 'Format de fichier non pris en charge',
    CALIBRATION_REQUIRED: 'Calibration de l\'appareil requise',
    MAINTENANCE_DUE: 'La maintenance de l\'appareil est en retard'
  },

  // ==========================================
  // GESTION DE FILE D'ATTENTE
  // ==========================================
  QUEUE: {
    PATIENT_NOT_IN_QUEUE: 'Le patient n\'est pas dans la file d\'attente',
    ALREADY_IN_QUEUE: 'Le patient est déjà dans la file d\'attente',
    QUEUE_FULL: 'La file d\'attente est pleine',
    INVALID_PRIORITY: 'Priorité de file d\'attente invalide',
    CANNOT_SKIP: 'Impossible de passer le patient dans la file d\'attente',
    DEPARTMENT_REQUIRED: 'Le département est requis pour la file d\'attente'
  },

  // ==========================================
  // CONVENTIONS & ASSURANCES
  // ==========================================
  CONVENTION: {
    NOT_FOUND: 'Convention non trouvée',
    EXPIRED: 'La convention du patient a expiré',
    NOT_ACTIVE: 'La convention n\'est pas active',
    COVERAGE_EXCEEDED: 'Limite de couverture dépassée pour ce service',
    SERVICE_NOT_COVERED: 'Ce service n\'est pas couvert par la convention',
    APPROVAL_REQUIRED: 'Approbation préalable requise pour ce service',
    INVALID_COVERAGE: 'Pourcentage de couverture invalide',
    COMPANY_NOT_FOUND: 'Compagnie d\'assurance non trouvée'
  },

  // ==========================================
  // CHIRURGIE
  // ==========================================
  SURGERY: {
    NOT_FOUND: 'Chirurgie non trouvée',
    ROOM_NOT_AVAILABLE: 'La salle d\'opération n\'est pas disponible',
    EQUIPMENT_UNAVAILABLE: 'Équipement requis non disponible',
    SURGEON_UNAVAILABLE: 'Le chirurgien n\'est pas disponible',
    CONSENT_REQUIRED: 'Le consentement du patient est requis',
    PRE_OP_INCOMPLETE: 'Évaluation pré-opératoire incomplète',
    INVALID_STATUS: 'Statut de chirurgie invalide',
    ALREADY_COMPLETED: 'La chirurgie est déjà terminée',
    CASE_CANCELLED: 'Le cas chirurgical a été annulé'
  },

  // ==========================================
  // OPTIQUE / LUNETTERIE
  // ==========================================
  OPTICAL: {
    FRAME_NOT_FOUND: 'Monture non trouvée',
    FRAME_OUT_OF_STOCK: 'Monture en rupture de stock',
    LENS_NOT_FOUND: 'Verre non trouvé',
    ORDER_NOT_FOUND: 'Commande optique non trouvée',
    INVALID_LENS_PARAMETERS: 'Paramètres de verre invalides',
    CONTACT_LENS_NOT_FOUND: 'Lentille de contact non trouvée',
    FITTING_REQUIRED: 'Essayage requis avant la commande',
    WARRANTY_EXPIRED: 'La garantie a expiré',
    REPAIR_NOT_POSSIBLE: 'Réparation impossible pour cet article'
  },

  // ==========================================
  // CLINIQUES & MULTI-SITES
  // ==========================================
  CLINIC: {
    NOT_FOUND: 'Clinique non trouvée',
    ACCESS_DENIED: 'Accès refusé à cette clinique',
    TRANSFER_FAILED: 'Échec du transfert entre cliniques',
    INVALID_CLINIC: 'Clinique invalide spécifiée',
    NO_ACTIVE_CLINIC: 'Aucune clinique active sélectionnée'
  },

  // ==========================================
  // RAPPORTS & ANALYTIQUE
  // ==========================================
  REPORTS: {
    GENERATION_FAILED: 'Échec de la génération du rapport',
    INVALID_DATE_RANGE: 'Plage de dates invalide pour le rapport',
    NO_DATA: 'Aucune donnée disponible pour cette période',
    EXPORT_FAILED: 'Échec de l\'exportation du rapport',
    TEMPLATE_ERROR: 'Erreur dans le modèle de rapport'
  }
};
