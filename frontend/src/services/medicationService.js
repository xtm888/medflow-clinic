import api from './apiConfig';

/**
 * Unified Medication Service
 * Provides consistent medication search, dose templates, and data normalization
 * across all parts of the application.
 */

// Default dose template for when API fails or medication form not found
const getDefaultDoseTemplate = () => ({
  doseOptions: [
    { value: '1_drop', labelFr: '1 goutte', labelEn: '1 drop' },
    { value: '2_drops', labelFr: '2 gouttes', labelEn: '2 drops' },
    { value: '1_tablet', labelFr: '1 comprimé', labelEn: '1 tablet' },
    { value: '2_tablets', labelFr: '2 comprimés', labelEn: '2 tablets' },
    { value: '5ml', labelFr: '5 ml', labelEn: '5 ml' },
    { value: '10ml', labelFr: '10 ml', labelEn: '10 ml' },
    { value: '1_application', labelFr: '1 application', labelEn: '1 application' },
    { value: '1_injection', labelFr: '1 injection', labelEn: '1 injection' }
  ],
  posologieOptions: [
    { value: '1x_day', labelFr: '1 fois par jour', labelEn: 'Once daily' },
    { value: '2x_day', labelFr: '2 fois par jour', labelEn: 'Twice daily' },
    { value: '3x_day', labelFr: '3 fois par jour', labelEn: '3 times daily' },
    { value: '4x_day', labelFr: '4 fois par jour', labelEn: '4 times daily' },
    { value: 'every_4h', labelFr: 'Toutes les 4 heures', labelEn: 'Every 4 hours' },
    { value: 'every_6h', labelFr: 'Toutes les 6 heures', labelEn: 'Every 6 hours' },
    { value: 'every_8h', labelFr: 'Toutes les 8 heures', labelEn: 'Every 8 hours' },
    { value: 'as_needed', labelFr: 'Si besoin (PRN)', labelEn: 'As needed (PRN)' },
    { value: 'at_bedtime', labelFr: 'Au coucher', labelEn: 'At bedtime' },
    { value: 'morning', labelFr: 'Le matin', labelEn: 'In the morning' }
  ],
  detailsOptions: [
    { value: 'with_food', labelFr: 'Avec les repas', labelEn: 'With food' },
    { value: 'before_food', labelFr: 'Avant les repas', labelEn: 'Before meals' },
    { value: 'after_food', labelFr: 'Après les repas', labelEn: 'After meals' },
    { value: 'empty_stomach', labelFr: 'À jeun', labelEn: 'On empty stomach' },
    { value: 'with_water', labelFr: 'Avec de l\'eau', labelEn: 'With water' }
  ],
  durationOptions: [
    { value: '3_days', labelFr: '3 jours', labelEn: '3 days' },
    { value: '5_days', labelFr: '5 jours', labelEn: '5 days' },
    { value: '7_days', labelFr: '7 jours', labelEn: '7 days' },
    { value: '10_days', labelFr: '10 jours', labelEn: '10 days' },
    { value: '14_days', labelFr: '14 jours', labelEn: '14 days' },
    { value: '21_days', labelFr: '21 jours', labelEn: '21 days' },
    { value: '30_days', labelFr: '30 jours', labelEn: '30 days' },
    { value: '3_months', labelFr: '3 mois', labelEn: '3 months' },
    { value: 'continuous', labelFr: 'Continu', labelEn: 'Continuous' }
  ]
});

// Helper to infer route from medication form
const getRouteFromForm = (form) => {
  if (!form) return '';
  const formLower = form.toLowerCase();

  // Ophthalmic forms
  if (formLower.includes('collyre') || formLower.includes('opht') || formLower.includes('goutte opht')) {
    return 'ophtalmique';
  }
  // Oral forms
  if (formLower.includes('cp') || formLower.includes('gel') || formLower.includes('sirop') ||
      formLower.includes('sol buv') || formLower.includes('sachet') || formLower.includes('comp')) {
    return 'oral';
  }
  // Topical forms
  if (formLower.includes('pom') || formLower.includes('creme') || formLower.includes('tube')) {
    return 'topique';
  }
  // Injectable
  if (formLower.includes('inj') || formLower.includes('amp')) {
    return 'injectable';
  }
  // Nasal
  if (formLower.includes('nas') || formLower.includes('spray nas')) {
    return 'nasal';
  }

  return '';
};

// Normalize medication data from different sources to a consistent format
const normalizeMedication = (medication, source) => {
  if (!medication) return null;

  // Handle template catalog format (MedicationTemplate model)
  // Fields: name, category, form, dosage (strength), packaging
  if (source === 'template-catalog') {
    return {
      _id: medication._id || medication.id,
      name: medication.name,
      genericName: medication.name, // Use name as genericName since templates don't separate
      brandName: medication.name,   // Use name as brandName since templates don't separate
      form: medication.form,
      category: medication.category,
      strength: medication.dosage,  // dosage field in template = strength
      route: getRouteFromForm(medication.form), // Infer route from form
      packaging: medication.packaging,
      source: 'template-catalog',
      original: medication
    };
  }

  // Handle pharmacy drugs format
  if (source === 'pharmacy') {
    return {
      _id: medication._id || medication.id,
      name: medication.medication?.brandName || medication.genericName || medication.name,
      genericName: medication.medication?.genericName || medication.genericName,
      brandName: medication.medication?.brandName || medication.brandName,
      form: medication.medication?.form || medication.form,
      category: medication.medication?.category || medication.category,
      strength: medication.medication?.strength || medication.strength,
      route: medication.medication?.route || medication.route,
      source: 'pharmacy',
      original: medication
    };
  }

  // Generic format
  return {
    _id: medication._id || medication.id,
    name: medication.name || medication.genericName || medication.brandName,
    genericName: medication.genericName,
    brandName: medication.brandName,
    form: medication.form,
    category: medication.category,
    strength: medication.strength,
    route: medication.route,
    source: source || 'unknown',
    original: medication
  };
};

const medicationService = {
  /**
   * Search medications with automatic fallback
   * Primary: Template catalog
   * Fallback: Pharmacy drugs API
   */
  async searchMedications(query, options = {}) {
    const { limit = 20 } = options;
    let results = [];

    // Try primary source: Template catalog
    try {
      const response = await api.get('/template-catalog/medications/search', {
        params: { q: query, limit }
      });
      const data = response.data?.data || response.data || [];
      results = Array.isArray(data) ? data.map(m => normalizeMedication(m, 'template-catalog')) : [];

      if (results.length > 0) {
        return { success: true, data: results, source: 'template-catalog' };
      }
    } catch (error) {
      console.warn('Template catalog search failed, trying fallback:', error.message);
    }

    // Fallback: Pharmacy drugs API
    try {
      const response = await api.get('/pharmacy/drugs', {
        params: { search: query, limit }
      });
      const data = response.data?.data || response.data || [];
      results = Array.isArray(data) ? data.map(m => normalizeMedication(m, 'pharmacy')) : [];

      return { success: true, data: results, source: 'pharmacy' };
    } catch (error) {
      console.warn('Pharmacy drugs search failed:', error.message);
    }

    // If both fail, return empty results
    return { success: false, data: [], source: null, error: 'All medication sources unavailable' };
  },

  /**
   * Get all medications (for dropdowns and autocomplete)
   */
  async getMedications(options = {}) {
    const { limit = 100 } = options;
    let results = [];

    // Try primary source: Template catalog
    try {
      const response = await api.get('/template-catalog/medications', {
        params: { limit }
      });
      const data = response.data?.data || response.data || [];
      results = Array.isArray(data) ? data.map(m => normalizeMedication(m, 'template-catalog')) : [];

      if (results.length > 0) {
        return { success: true, data: results, source: 'template-catalog' };
      }
    } catch (error) {
      console.warn('Template catalog fetch failed, trying fallback:', error.message);
    }

    // Fallback: Pharmacy drugs API
    try {
      const response = await api.get('/pharmacy/drugs', {
        params: { limit }
      });
      const data = response.data?.data || response.data || [];
      results = Array.isArray(data) ? data.map(m => normalizeMedication(m, 'pharmacy')) : [];

      return { success: true, data: results, source: 'pharmacy' };
    } catch (error) {
      console.warn('Pharmacy drugs fetch failed:', error.message);
    }

    return { success: false, data: [], source: null, error: 'All medication sources unavailable' };
  },

  /**
   * Get dose template by medication form with default fallback
   */
  async getDoseTemplate(form) {
    if (!form) {
      return { success: true, data: getDefaultDoseTemplate(), source: 'default' };
    }

    try {
      const response = await api.get(`/dose-templates/by-form/${form}`);
      const template = response.data?.data || response.data;

      if (template && Object.keys(template).length > 0) {
        return { success: true, data: template, source: 'api' };
      }

      // If template is empty, return default
      return { success: true, data: getDefaultDoseTemplate(), source: 'default' };
    } catch (error) {
      console.warn(`Dose template for form "${form}" not found, using default:`, error.message);
      return { success: true, data: getDefaultDoseTemplate(), source: 'default' };
    }
  },

  /**
   * Get all dose templates
   */
  async getAllDoseTemplates() {
    try {
      const response = await api.get('/dose-templates');
      return { success: true, data: response.data?.data || response.data || [] };
    } catch (error) {
      console.error('Error fetching dose templates:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  /**
   * Get medication categories
   */
  async getCategories() {
    try {
      const response = await api.get('/template-catalog/medications/categories');
      return { success: true, data: response.data?.data || response.data || [] };
    } catch (error) {
      console.warn('Failed to fetch medication categories:', error.message);
      // Return common default categories
      return {
        success: true,
        data: [
          'Antibiotiques',
          'Anti-inflammatoires',
          'Antalgiques',
          'Collyres',
          'Vitamines',
          'Antihypertenseurs',
          'Antidiabétiques',
          'Antihistaminiques',
          'Autres'
        ],
        source: 'default'
      };
    }
  },

  /**
   * Get default dose template (for manual use)
   */
  getDefaultDoseTemplate,

  /**
   * Normalize medication data
   */
  normalizeMedication,

  /**
   * Check medication interactions
   * Uses a local drug interaction database for common ophthalmology medications
   */
  async checkInteractions(medications) {
    const warnings = [];

    // Drug interaction database - common ophthalmology medication interactions
    const interactionDatabase = {
      // Beta-blockers (glaucoma)
      'timolol': {
        interactions: ['verapamil', 'diltiazem', 'amlodipine', 'propranolol', 'atenolol', 'metoprolol'],
        severity: 'high',
        message: 'Interaction bêta-bloquant: risque de bradycardie et hypotension'
      },
      'betaxolol': {
        interactions: ['verapamil', 'diltiazem', 'propranolol', 'atenolol'],
        severity: 'high',
        message: 'Interaction bêta-bloquant: risque de bradycardie'
      },
      // Prostaglandin analogs
      'latanoprost': {
        interactions: ['bimatoprost', 'travoprost', 'tafluprost'],
        severity: 'medium',
        message: 'Association de prostaglandines: risque de pigmentation irienne accrue'
      },
      'bimatoprost': {
        interactions: ['latanoprost', 'travoprost', 'tafluprost'],
        severity: 'medium',
        message: 'Association de prostaglandines: effet additif limité'
      },
      'travoprost': {
        interactions: ['latanoprost', 'bimatoprost', 'tafluprost'],
        severity: 'medium',
        message: 'Association de prostaglandines: risque d\'irritation accrue'
      },
      // Carbonic anhydrase inhibitors
      'dorzolamide': {
        interactions: ['acetazolamide', 'brinzolamide'],
        severity: 'medium',
        message: 'Double inhibition de l\'anhydrase carbonique: risque d\'acidose métabolique'
      },
      'brinzolamide': {
        interactions: ['acetazolamide', 'dorzolamide'],
        severity: 'medium',
        message: 'Double inhibition de l\'anhydrase carbonique'
      },
      'acetazolamide': {
        interactions: ['dorzolamide', 'brinzolamide', 'aspirin', 'lithium'],
        severity: 'high',
        message: 'Risque d\'acidose métabolique ou toxicité'
      },
      // Alpha-agonists
      'brimonidine': {
        interactions: ['clonidine', 'methyldopa', 'maoi'],
        severity: 'high',
        message: 'Interaction alpha-agoniste: risque d\'hypotension sévère'
      },
      // Mydriatics/Cycloplegics
      'atropine': {
        interactions: ['pilocarpine', 'carbachol', 'antihistamines'],
        severity: 'medium',
        message: 'Antagonisme anticholinergique-cholinergique'
      },
      'tropicamide': {
        interactions: ['pilocarpine', 'carbachol'],
        severity: 'low',
        message: 'Antagonisme potentiel'
      },
      'cyclopentolate': {
        interactions: ['pilocarpine', 'carbachol'],
        severity: 'medium',
        message: 'Antagonisme cholinergique'
      },
      // Miotics
      'pilocarpine': {
        interactions: ['atropine', 'tropicamide', 'cyclopentolate', 'homatropine'],
        severity: 'medium',
        message: 'Antagonisme avec les mydriatiques'
      },
      // Corticosteroids
      'dexamethasone': {
        interactions: ['nsaids', 'diclofenac', 'ketorolac', 'nepafenac'],
        severity: 'medium',
        message: 'Association corticoïde-AINS: risque de retard de cicatrisation'
      },
      'prednisolone': {
        interactions: ['nsaids', 'diclofenac', 'ketorolac'],
        severity: 'medium',
        message: 'Risque accru d\'effets secondaires cornéens'
      },
      // NSAIDs ophthalmic
      'diclofenac': {
        interactions: ['warfarin', 'aspirin', 'clopidogrel'],
        severity: 'medium',
        message: 'Risque de saignement accru'
      },
      'ketorolac': {
        interactions: ['warfarin', 'aspirin', 'lithium'],
        severity: 'medium',
        message: 'Interaction AINS systémique possible'
      },
      // Antibiotics
      'ciprofloxacin': {
        interactions: ['theophylline', 'warfarin', 'antacids'],
        severity: 'medium',
        message: 'Interactions fluoroquinolone'
      },
      'moxifloxacin': {
        interactions: ['antiarrhythmics', 'warfarin'],
        severity: 'medium',
        message: 'Risque de prolongation QT'
      }
    };

    // Normalize medication names for comparison
    const normalizedMeds = medications.map(med => {
      const name = (typeof med === 'string' ? med : med.name || med.genericName || '').toLowerCase();
      return {
        original: med,
        normalized: name,
        id: typeof med === 'object' ? (med._id || med.id) : med
      };
    });

    // Check for interactions between all medication pairs
    for (let i = 0; i < normalizedMeds.length; i++) {
      const med1 = normalizedMeds[i];

      // Find matching drug in database
      const drugKey = Object.keys(interactionDatabase).find(key =>
        med1.normalized.includes(key) || key.includes(med1.normalized)
      );

      if (drugKey) {
        const drugInfo = interactionDatabase[drugKey];

        // Check against other medications
        for (let j = 0; j < normalizedMeds.length; j++) {
          if (i === j) continue;

          const med2 = normalizedMeds[j];

          // Check if med2 is in the interaction list
          const hasInteraction = drugInfo.interactions.some(interactingDrug =>
            med2.normalized.includes(interactingDrug) || interactingDrug.includes(med2.normalized)
          );

          if (hasInteraction) {
            // Avoid duplicate warnings
            const warningKey = [med1.normalized, med2.normalized].sort().join('-');
            const alreadyWarned = warnings.some(w => w.key === warningKey);

            if (!alreadyWarned) {
              warnings.push({
                key: warningKey,
                type: 'INTERACTION',
                severity: drugInfo.severity,
                message: drugInfo.message,
                medications: [
                  typeof med1.original === 'string' ? med1.original : (med1.original.name || med1.original.genericName),
                  typeof med2.original === 'string' ? med2.original : (med2.original.name || med2.original.genericName)
                ]
              });
            }
          }
        }
      }
    }

    // Remove the key property before returning
    const cleanWarnings = warnings.map(({ key, ...rest }) => rest);

    return {
      success: true,
      data: cleanWarnings,
      warnings: cleanWarnings,
      hasInteractions: cleanWarnings.length > 0
    };
  },

  /**
   * Check allergies against patient allergies (placeholder for future implementation)
   */
  async checkAllergies(medicationName, patientAllergies) {
    // Simple string matching for now
    const allergies = patientAllergies || [];
    const warnings = [];

    for (const allergy of allergies) {
      const allergen = allergy.allergen?.toLowerCase() || allergy.toLowerCase();
      if (medicationName.toLowerCase().includes(allergen) ||
          allergen.includes(medicationName.toLowerCase())) {
        warnings.push({
          type: 'ALLERGY',
          severity: 'critical',
          message: `Patient allergique à ${allergy.allergen || allergy}`,
          medication: medicationName,
          allergen: allergy.allergen || allergy
        });
      }
    }

    return { success: true, warnings };
  }
};

export default medicationService;
