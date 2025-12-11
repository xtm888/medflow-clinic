import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Prescription Service - Offline-First
 * Handles optical and medical prescriptions with offline support
 *
 * SAFETY NOTE: Drug interaction checks and safety validations show warnings when offline
 * to ensure patient safety is not compromised
 */

const prescriptionService = {
  /**
   * Get all prescriptions with filters - WORKS OFFLINE
   * @param {Object} params - Query parameters
   * @returns {Promise} Prescriptions list
   */
  async getPrescriptions(params = {}) {
    return offlineWrapper.get(
      () => api.get('/prescriptions', { params }),
      'prescriptions',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Get single prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @returns {Promise} Prescription data
   */
  async getPrescription(id) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/${id}`),
      'prescriptions',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Create new prescription - MEDICATION REQUIRES ONLINE
   * Optical prescriptions work offline, medication prescriptions require online for safety checks
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise} Created prescription
   */
  async createPrescription(prescriptionData) {
    // CRITICAL SAFETY: Block offline creation for medication prescriptions
    // Safety checks (drug interactions, allergies, contraindications) REQUIRE server connectivity
    if (!navigator.onLine && prescriptionData.type === 'medication') {
      throw new Error(
        'SÉCURITÉ PATIENT: Les prescriptions de médicaments nécessitent une connexion internet.\n\n' +
        'Les contrôles de sécurité suivants ne peuvent pas être effectués hors ligne:\n' +
        '• Interactions médicamenteuses\n' +
        '• Allergies patient\n' +
        '• Contre-indications\n' +
        '• Vérification de l\'âge pour le dosage\n\n' +
        'Veuillez vous reconnecter avant de prescrire des médicaments.'
      );
    }

    // Optical prescriptions can work offline (no drug safety checks needed)
    const localData = {
      ...prescriptionData,
      _tempId: `temp_${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/prescriptions', prescriptionData),
      'CREATE',
      'prescriptions',
      localData
    );
  },

  /**
   * Update prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} prescriptionData - Updated data
   * @returns {Promise} Updated prescription
   */
  async updatePrescription(id, prescriptionData) {
    const updateData = {
      ...prescriptionData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/prescriptions/${id}`, prescriptionData),
      'UPDATE',
      'prescriptions',
      updateData,
      id
    );
  },

  /**
   * Delete prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @returns {Promise} Confirmation
   */
  async deletePrescription(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/prescriptions/${id}`),
      'DELETE',
      'prescriptions',
      { deletedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get prescriptions by patient - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Patient prescriptions
   */
  async getPatientPrescriptions(patientId, params = {}) {
    // If offline, filter from local cache
    if (!navigator.onLine) {
      try {
        const prescriptions = await db.prescriptions
          .where('patientId')
          .equals(patientId)
          .toArray();

        return {
          success: true,
          data: prescriptions,
          _fromCache: true
        };
      } catch (error) {
        console.error('[PrescriptionService] Offline patient fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/patients/${patientId}/prescriptions`, { params }),
      'prescriptions',
      { type: 'patient', patientId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get prescriptions by provider - WORKS OFFLINE
   * @param {string} providerId - Provider ID
   * @param {Object} params - Query params
   * @returns {Promise} Provider prescriptions
   */
  async getProviderPrescriptions(providerId, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/provider/${providerId}`, { params }),
      'prescriptions',
      { type: 'provider', providerId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create optical prescription - WORKS OFFLINE
   * @param {Object} prescriptionData - Optical prescription data
   * @returns {Promise} Created prescription
   */
  async createOpticalPrescription(prescriptionData) {
    const localData = {
      ...prescriptionData,
      _tempId: `temp_${Date.now()}`,
      type: 'optical',
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/prescriptions/optical', prescriptionData),
      'CREATE',
      'prescriptions',
      localData
    );
  },

  /**
   * Update optical prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} prescriptionData - Updated data
   * @returns {Promise} Updated prescription
   */
  async updateOpticalPrescription(id, prescriptionData) {
    return offlineWrapper.mutate(
      () => api.put(`/prescriptions/optical/${id}`, prescriptionData),
      'UPDATE',
      'prescriptions',
      { ...prescriptionData, updatedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get optical prescriptions - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Optical prescriptions
   */
  async getOpticalPrescriptions(params = {}) {
    return offlineWrapper.get(
      () => api.get('/prescriptions/optical', { params }),
      'prescriptions',
      { type: 'optical', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create drug prescription - ONLINE ONLY (SAFETY CRITICAL)
   * Drug prescriptions require online connectivity for safety checks
   * @param {Object} prescriptionData - Drug prescription data
   * @returns {Promise} Created prescription
   */
  async createDrugPrescription(prescriptionData) {
    // CRITICAL SAFETY: Block offline creation entirely for drug prescriptions
    // Drug interactions, allergies, and contraindications MUST be checked before prescribing
    if (!navigator.onLine) {
      throw new Error(
        'SÉCURITÉ PATIENT: Les prescriptions de médicaments nécessitent une connexion internet.\n\n' +
        'Les contrôles de sécurité suivants ne peuvent pas être effectués hors ligne:\n' +
        '• Interactions médicamenteuses\n' +
        '• Allergies patient\n' +
        '• Contre-indications\n' +
        '• Vérification de l\'âge pour le dosage\n' +
        '• Disponibilité en stock\n\n' +
        'Veuillez vous reconnecter avant de prescrire des médicaments.'
      );
    }

    try {
      const response = await api.post('/prescriptions/drug', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('[PrescriptionService] Drug prescription creation failed:', error);
      throw error;
    }
  },

  /**
   * Update drug prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} prescriptionData - Updated data
   * @returns {Promise} Updated prescription
   */
  async updateDrugPrescription(id, prescriptionData) {
    return offlineWrapper.mutate(
      () => api.put(`/prescriptions/drug/${id}`, prescriptionData),
      'UPDATE',
      'prescriptions',
      { ...prescriptionData, updatedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get drug prescriptions - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Drug prescriptions
   */
  async getDrugPrescriptions(params = {}) {
    return offlineWrapper.get(
      () => api.get('/prescriptions/drug', { params }),
      'prescriptions',
      { type: 'drug', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Verify prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} verificationData - Verification data
   * @returns {Promise} Verified prescription
   */
  async verifyPrescription(id, verificationData) {
    const updateData = {
      ...verificationData,
      verified: true,
      verifiedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/prescriptions/${id}/verify`, verificationData),
      'UPDATE',
      'prescriptions',
      updateData,
      id
    );
  },

  /**
   * Create invoice for prescription (before dispensing) - ONLINE ONLY
   * Enables "pay first, dispense on payment" workflow
   * @param {string} id - Prescription ID
   * @param {Object} options - Optional invoice options (dueDate, etc.)
   * @returns {Promise} Created invoice
   */
  async createInvoiceForPrescription(id, options = {}) {
    if (!navigator.onLine) {
      throw new Error('Création de facture nécessite une connexion internet.');
    }

    try {
      const response = await api.post(`/prescriptions/${id}/invoice`, options);
      return response.data;
    } catch (error) {
      console.error('Error creating invoice for prescription:', error);
      throw error;
    }
  },

  /**
   * Dispense prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} dispensingData - Dispensing data
   * @returns {Promise} Updated prescription
   */
  async dispensePrescription(id, dispensingData) {
    const updateData = {
      ...dispensingData,
      status: 'dispensed',
      dispensedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/prescriptions/${id}/dispense`, dispensingData),
      'UPDATE',
      'prescriptions',
      updateData,
      id
    );
  },

  /**
   * Refill prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} refillData - Refill data
   * @returns {Promise} Refill result
   */
  async refillPrescription(id, refillData = {}) {
    const localData = {
      ...refillData,
      prescriptionId: id,
      refillDate: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/prescriptions/${id}/refill`, refillData),
      'CREATE',
      'prescriptions',
      localData
    );
  },

  /**
   * Renew prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {Object} renewData - Renewal data
   * @returns {Promise} New prescription
   */
  async renewPrescription(id, renewData = {}) {
    const localData = {
      ...renewData,
      originalPrescriptionId: id,
      _tempId: `temp_${Date.now()}`,
      renewedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/prescriptions/${id}/renew`, renewData),
      'CREATE',
      'prescriptions',
      localData
    );
  },

  /**
   * Get refill history - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @returns {Promise} Refill history
   */
  async getRefillHistory(id) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/${id}/refill-history`),
      'prescriptions',
      { type: 'refillHistory', prescriptionId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Update pharmacy status - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {string} status - New status
   * @param {string} notes - Notes
   * @param {string} reason - Reason
   * @returns {Promise} Updated prescription
   */
  async updatePharmacyStatus(id, status, notes = '', reason = '') {
    const updateData = {
      pharmacyStatus: status,
      pharmacyNotes: notes,
      pharmacyReason: reason,
      pharmacyUpdatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/prescriptions/${id}/pharmacy-status`, { status, notes, reason }),
      'UPDATE',
      'prescriptions',
      updateData,
      id
    );
  },

  /**
   * Cancel prescription - WORKS OFFLINE
   * @param {string} id - Prescription ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise} Updated prescription
   */
  async cancelPrescription(id, reason) {
    const updateData = {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/prescriptions/${id}/cancel`, { reason }),
      'UPDATE',
      'prescriptions',
      updateData,
      id
    );
  },

  /**
   * Check drug interactions - ONLINE PREFERRED (SAFETY CRITICAL)
   * Returns warning when offline - do NOT silently fail
   * @param {Array} drugs - List of drugs
   * @param {string} patientId - Patient ID
   * @param {Array} currentMedications - Current medications
   * @returns {Promise} Interaction check result
   */
  async checkDrugInteractions(drugs, patientId = null, currentMedications = []) {
    if (!navigator.onLine) {
      // Return explicit warning - drug interactions cannot be verified offline
      return {
        success: false,
        offline: true,
        warnings: [
          'AVERTISSEMENT: Verification des interactions medicamenteuses non disponible hors ligne',
          'Veuillez verifier les interactions manuellement ou attendre la connexion'
        ],
        interactions: [],
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/prescriptions/check-interactions', {
        drugs,
        patientId,
        currentMedications
      });
      return response.data;
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      throw error;
    }
  },

  /**
   * Run comprehensive safety check - ONLINE ONLY (SAFETY CRITICAL)
   * @param {Array} drugs - List of drugs
   * @param {string} patientId - Patient ID
   * @returns {Promise} Safety check result
   */
  async runSafetyCheck(drugs, patientId) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        warnings: [
          'AVERTISSEMENT: Controle de securite non disponible hors ligne',
          'Veuillez verifier avant de prescrire lorsque vous serez en ligne'
        ],
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/prescriptions/safety-check', { drugs, patientId });
      return response.data;
    } catch (error) {
      console.error('Error running safety check:', error);
      throw error;
    }
  },

  /**
   * Check insurance coverage - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Coverage result
   */
  async checkInsuranceCoverage(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Verification de couverture necessite une connexion internet.');
    }

    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/check-coverage`);
      return response.data;
    } catch (error) {
      console.error('Error checking insurance coverage:', error);
      throw error;
    }
  },

  /**
   * Search drugs - ONLINE ONLY (needs full database)
   * @param {string} query - Search query
   * @returns {Promise} Search results
   */
  async searchDrugs(query) {
    if (!navigator.onLine) {
      throw new Error('Recherche de medicaments necessite une connexion internet.');
    }

    try {
      const response = await api.get('/pharmacy/search', { params: { q: query } });
      return response.data;
    } catch (error) {
      console.error('Error searching drugs:', error);
      throw error;
    }
  },

  /**
   * Get drug details - ONLINE ONLY
   * @param {string} drugId - Drug ID
   * @returns {Promise} Drug details
   */
  async getDrugDetails(drugId) {
    if (!navigator.onLine) {
      throw new Error('Details du medicament necessite une connexion internet.');
    }

    try {
      const response = await api.get(`/pharmacy/inventory/${drugId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching drug details:', error);
      throw error;
    }
  },

  /**
   * Get prescription templates - WORKS OFFLINE
   * @param {string} type - Template type
   * @returns {Promise} Templates
   */
  async getPrescriptionTemplates(type) {
    return offlineWrapper.get(
      () => api.get('/prescriptions/templates', { params: { type } }),
      'prescriptions',
      { type: 'templates', templateType: type },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400 // 24 hours for templates
      }
    );
  },

  /**
   * Apply prescription template - WORKS OFFLINE
   * @param {string} prescriptionId - Prescription ID
   * @param {string} templateId - Template ID
   * @returns {Promise} Updated prescription
   */
  async applyTemplate(prescriptionId, templateId) {
    return offlineWrapper.mutate(
      () => api.post(`/prescriptions/${prescriptionId}/apply-template`, { templateId }),
      'UPDATE',
      'prescriptions',
      { templateId, appliedAt: new Date().toISOString() },
      prescriptionId
    );
  },

  /**
   * Send prescription to pharmacy - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @param {Object} pharmacyData - Pharmacy data
   * @returns {Promise} Send result
   */
  async sendToPharmacy(prescriptionId, pharmacyData) {
    if (!navigator.onLine) {
      throw new Error('Envoi a la pharmacie necessite une connexion internet.');
    }

    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/send-to-pharmacy`, pharmacyData);
      return response.data;
    } catch (error) {
      console.error('Error sending prescription to pharmacy:', error);
      throw error;
    }
  },

  /**
   * Send prescription to patient - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @param {string} method - Send method (email/sms)
   * @returns {Promise} Send result
   */
  async sendToPatient(prescriptionId, method = 'email') {
    if (!navigator.onLine) {
      throw new Error('Envoi au patient necessite une connexion internet.');
    }

    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/send-to-patient`, { method });
      return response.data;
    } catch (error) {
      console.error('Error sending prescription to patient:', error);
      throw error;
    }
  },

  /**
   * Print prescription - WORKS OFFLINE
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Print data
   */
  async printPrescription(prescriptionId) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/${prescriptionId}/print`),
      'prescriptions',
      { type: 'print', prescriptionId },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Generate PDF prescription - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise<Blob>} PDF blob
   */
  async generatePDF(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Generation PDF necessite une connexion internet.');
    }

    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/pdf`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  },

  /**
   * Download prescription PDF - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @param {string} filename - Optional filename
   * @returns {Promise<boolean>} Success
   */
  async downloadPDF(prescriptionId, filename = null) {
    if (!navigator.onLine) {
      throw new Error('Telechargement PDF necessite une connexion internet.');
    }

    try {
      const blob = await this.generatePDF(prescriptionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `prescription-${prescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Error downloading PDF:', error);
      throw error;
    }
  },

  /**
   * Get prescription history - WORKS OFFLINE
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} History
   */
  async getPrescriptionHistory(prescriptionId) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/${prescriptionId}/history`),
      'prescriptions',
      { type: 'history', prescriptionId },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Clone prescription - WORKS OFFLINE
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Cloned prescription
   */
  async clonePrescription(prescriptionId) {
    const localData = {
      _tempId: `temp_${Date.now()}`,
      clonedFrom: prescriptionId,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/prescriptions/${prescriptionId}/clone`),
      'CREATE',
      'prescriptions',
      localData
    );
  },

  /**
   * Get prescription statistics - WORKS OFFLINE (computed)
   * @param {Object} params - Query params
   * @returns {Promise} Statistics
   */
  async getPrescriptionStatistics(params = {}) {
    if (!navigator.onLine) {
      try {
        const prescriptions = await db.prescriptions.toArray();
        const stats = {
          total: prescriptions.length,
          optical: prescriptions.filter(p => p.type === 'optical').length,
          drug: prescriptions.filter(p => p.type === 'drug').length,
          active: prescriptions.filter(p => p.status === 'active').length,
          dispensed: prescriptions.filter(p => p.status === 'dispensed').length,
          _computed: true
        };
        return { success: true, data: stats, _fromCache: true };
      } catch (error) {
        console.error('[PrescriptionService] Offline stats failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/prescriptions/statistics', { params }),
      'prescriptions',
      { type: 'statistics', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Validate prescription - ONLINE ONLY
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise} Validation result
   */
  async validatePrescription(prescriptionData) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        warnings: ['Validation complete non disponible hors ligne'],
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/prescriptions/validate', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error validating prescription:', error);
      throw error;
    }
  },

  /**
   * Get lens options - WORKS OFFLINE
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Lens options
   */
  async getLensOptions(prescriptionId) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/optical/${prescriptionId}/lens-options`),
      'prescriptions',
      { type: 'lensOptions', prescriptionId },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  /**
   * Calculate lens power - ONLINE ONLY
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise} Calculated power
   */
  async calculateLensPower(prescriptionData) {
    if (!navigator.onLine) {
      throw new Error('Calcul de puissance necessite une connexion internet.');
    }

    try {
      const response = await api.post('/prescriptions/optical/calculate-power', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error calculating lens power:', error);
      throw error;
    }
  },

  /**
   * Get frame recommendations - WORKS OFFLINE
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Recommendations
   */
  async getFrameRecommendations(prescriptionId) {
    return offlineWrapper.get(
      () => api.get(`/prescriptions/optical/${prescriptionId}/frame-recommendations`),
      'prescriptions',
      { type: 'frameRecommendations', prescriptionId },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  /**
   * Bulk create prescriptions - ONLINE ONLY
   * @param {Array} prescriptionsData - Array of prescriptions
   * @returns {Promise} Created prescriptions
   */
  async bulkCreatePrescriptions(prescriptionsData) {
    if (!navigator.onLine) {
      throw new Error('Creation en masse necessite une connexion internet.');
    }

    try {
      const response = await api.post('/prescriptions/bulk', prescriptionsData);
      return response.data;
    } catch (error) {
      console.error('Error bulk creating prescriptions:', error);
      throw error;
    }
  },

  /**
   * Get expired prescriptions - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Expired prescriptions
   */
  async getExpiredPrescriptions(params = {}) {
    if (!navigator.onLine) {
      try {
        const now = new Date();
        const prescriptions = await db.prescriptions.toArray();
        const expired = prescriptions.filter(p =>
          p.expiryDate && new Date(p.expiryDate) < now
        );
        return { success: true, data: expired, _fromCache: true };
      } catch (error) {
        console.error('[PrescriptionService] Offline expired fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/prescriptions/expired', { params }),
      'prescriptions',
      { type: 'expired', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get active prescriptions - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @returns {Promise} Active prescriptions
   */
  async getActivePrescriptions(patientId) {
    if (!navigator.onLine) {
      try {
        const prescriptions = await db.prescriptions
          .where('patientId')
          .equals(patientId)
          .toArray();
        const active = prescriptions.filter(p => p.status === 'active');
        return { success: true, data: active, _fromCache: true };
      } catch (error) {
        console.error('[PrescriptionService] Offline active fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/patients/${patientId}/prescriptions/active`),
      'prescriptions',
      { type: 'active', patientId },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Check prescription eligibility - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Eligibility result
   */
  async checkEligibility(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Verification eligibilite necessite une connexion internet.');
    }

    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/check-eligibility`);
      return response.data;
    } catch (error) {
      console.error('Error checking prescription eligibility:', error);
      throw error;
    }
  },

  /**
   * Get prescription QR code - ONLINE ONLY
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise<Blob>} QR code blob
   */
  async getQRCode(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Generation QR code necessite une connexion internet.');
    }

    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/qr-code`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching prescription QR code:', error);
      throw error;
    }
  },

  // ============================================
  // E-PRESCRIBING METHODS - ALL ONLINE ONLY
  // ============================================

  async transmitEPrescription(prescriptionId, pharmacyData) {
    if (!navigator.onLine) {
      throw new Error('Transmission e-prescription necessite une connexion internet.');
    }
    const response = await api.post(`/prescriptions/${prescriptionId}/e-prescribe`, pharmacyData);
    return response.data;
  },

  async getEPrescriptionStatus(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Statut e-prescription necessite une connexion internet.');
    }
    const response = await api.get(`/prescriptions/${prescriptionId}/e-prescribe/status`);
    return response.data;
  },

  async cancelEPrescription(prescriptionId, reason) {
    if (!navigator.onLine) {
      throw new Error('Annulation e-prescription necessite une connexion internet.');
    }
    const response = await api.post(`/prescriptions/${prescriptionId}/e-prescribe/cancel`, { reason });
    return response.data;
  },

  async respondToRefillRequest(prescriptionId, approved, reason, options = {}) {
    if (!navigator.onLine) {
      throw new Error('Reponse demande de renouvellement necessite une connexion internet.');
    }
    const response = await api.post(`/prescriptions/${prescriptionId}/e-prescribe/refill-response`, {
      approved, reason, ...options
    });
    return response.data;
  },

  async searchEPrescribingPharmacies(criteria = {}) {
    if (!navigator.onLine) {
      throw new Error('Recherche pharmacies necessite une connexion internet.');
    }
    const response = await api.get('/prescriptions/e-prescribing/pharmacies', { params: criteria });
    return response.data;
  },

  async verifyPharmacy(ncpdpId) {
    if (!navigator.onLine) {
      throw new Error('Verification pharmacie necessite une connexion internet.');
    }
    const response = await api.get(`/prescriptions/e-prescribing/pharmacy/${ncpdpId}/verify`);
    return response.data;
  },

  async getEPrescribingServiceStatus() {
    if (!navigator.onLine) {
      throw new Error('Statut service e-prescribing necessite une connexion internet.');
    }
    const response = await api.get('/prescriptions/e-prescribing/status');
    return response.data;
  },

  // ============================================
  // PRIOR AUTHORIZATION - ALL ONLINE ONLY
  // ============================================

  async requestPriorAuthorization(prescriptionId, authData) {
    if (!navigator.onLine) {
      throw new Error('Demande autorisation prealable necessite une connexion internet.');
    }
    const response = await api.post(`/prescriptions/${prescriptionId}/prior-auth/request`, authData);
    return response.data;
  },

  async updatePriorAuthorization(prescriptionId, updateData) {
    if (!navigator.onLine) {
      throw new Error('Mise a jour autorisation prealable necessite une connexion internet.');
    }
    const response = await api.put(`/prescriptions/${prescriptionId}/prior-auth/update`, updateData);
    return response.data;
  },

  async getPriorAuthorizationStatus(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Statut autorisation prealable necessite une connexion internet.');
    }
    const response = await api.get(`/prescriptions/${prescriptionId}/prior-auth/status`);
    return response.data;
  },

  async getPendingPriorAuthorizations(params = {}) {
    if (!navigator.onLine) {
      throw new Error('Liste autorisations en attente necessite une connexion internet.');
    }
    const response = await api.get('/prescriptions/prior-auth/pending', { params });
    return response.data;
  },

  async approvePriorAuthorization(prescriptionId, approvalData) {
    if (!navigator.onLine) {
      throw new Error('Approbation autorisation necessite une connexion internet.');
    }
    const response = await api.put(`/prescriptions/${prescriptionId}/prior-auth/update`, {
      status: 'approved', ...approvalData
    });
    return response.data;
  },

  async denyPriorAuthorization(prescriptionId, denialReason) {
    if (!navigator.onLine) {
      throw new Error('Refus autorisation necessite une connexion internet.');
    }
    const response = await api.put(`/prescriptions/${prescriptionId}/prior-auth/update`, {
      status: 'denied', denialReason
    });
    return response.data;
  },

  // ==========================================
  // PRESCRIPTION SIGNING
  // ==========================================

  /**
   * Sign a prescription (doctor/prescriber signature)
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise} Signed prescription
   */
  async signPrescription(prescriptionId) {
    if (!navigator.onLine) {
      throw new Error('Signature d\'ordonnance nécessite une connexion internet.');
    }

    try {
      const response = await api.put(`/prescriptions/${prescriptionId}/sign`);
      return response.data;
    } catch (error) {
      console.error('Error signing prescription:', error);
      throw error;
    }
  },

  /**
   * Get unsigned prescriptions for current provider
   * @param {Object} params - Query params (patientId optional)
   * @returns {Promise} Unsigned prescriptions list
   */
  async getUnsignedPrescriptions(params = {}) {
    if (!navigator.onLine) {
      // Try to filter from local cache
      try {
        const prescriptions = await db.prescriptions.toArray();
        const unsigned = prescriptions.filter(p =>
          !p.signature?.prescriber?.signed &&
          (params.patientId ? (p.patientId === params.patientId || p.patient === params.patientId) : true)
        );
        return { success: true, data: unsigned, _fromCache: true };
      } catch (error) {
        console.error('[PrescriptionService] Offline unsigned fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/prescriptions', {
        params: {
          ...params,
          unsigned: true
        }
      }),
      'prescriptions',
      { type: 'unsigned', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache prescriptions for offline use
   * @param {Object} params - Cache params
   * @returns {Promise} Cache result
   */
  async preCachePrescriptions(params = { limit: 100 }) {
    if (!navigator.onLine) {
      console.warn('[PrescriptionService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[PrescriptionService] Pre-caching prescriptions...');

      const response = await api.get('/prescriptions', { params });
      const prescriptions = response.data?.data || [];

      if (prescriptions.length > 0) {
        const timestamp = new Date().toISOString();
        const prescriptionsWithSync = prescriptions.map(p => ({
          ...p,
          id: p._id || p.id,
          lastSync: timestamp
        }));

        await db.prescriptions.bulkPut(prescriptionsWithSync);
        console.log(`[PrescriptionService] Pre-cached ${prescriptions.length} prescriptions`);
      }

      return { success: true, cached: prescriptions.length };
    } catch (error) {
      console.error('[PrescriptionService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get cached prescription count
   * @returns {Promise<number>} Count
   */
  async getCachedPrescriptionCount() {
    return db.prescriptions.count();
  }
};

export default prescriptionService;
