/**
 * Face Recognition Service
 *
 * Client-side service for interacting with the face recognition API.
 */

import api from './apiConfig';

const faceRecognitionService = {
  /**
   * Check service health
   */
  async checkHealth() {
    const response = await api.get('/face-recognition/health');
    return response.data;
  },

  /**
   * Detect faces in an image
   * @param {string} imageBase64 - Base64 encoded image
   */
  async detectFaces(imageBase64) {
    const response = await api.post('/face-recognition/detect', {
      image: imageBase64
    });
    return response.data;
  },

  /**
   * Check for duplicate patients using facial recognition
   * @param {string} imageBase64 - Base64 encoded image
   */
  async checkDuplicates(imageBase64) {
    const response = await api.post('/face-recognition/check-duplicates', {
      image: imageBase64
    });
    return response.data;
  },

  /**
   * Enroll a patient's face encoding
   * @param {string} patientId - Patient ID
   * @param {string} imageBase64 - Base64 encoded image
   * @param {boolean} consentGiven - Whether patient has given consent
   */
  async enrollPatient(patientId, imageBase64, consentGiven = true) {
    const response = await api.post(`/face-recognition/enroll/${patientId}`, {
      image: imageBase64,
      consentGiven
    });
    return response.data;
  },

  /**
   * Enroll with pre-generated encoding
   * @param {string} patientId - Patient ID
   * @param {string} imageBase64 - Base64 encoded image
   * @param {number[]} encoding - Face encoding array
   * @param {object} faceLocation - Face location in image
   * @param {boolean} consentGiven - Whether patient has given consent
   */
  async enrollWithEncoding(patientId, imageBase64, encoding, faceLocation, consentGiven = true) {
    const response = await api.post(`/face-recognition/enroll/${patientId}`, {
      image: imageBase64,
      encoding,
      faceLocation,
      consentGiven
    });
    return response.data;
  },

  /**
   * Verify a patient's identity
   * @param {string} patientId - Patient ID
   * @param {string} imageBase64 - Base64 encoded live image
   */
  async verifyIdentity(patientId, imageBase64) {
    const response = await api.post(`/face-recognition/verify/${patientId}`, {
      image: imageBase64
    });
    return response.data;
  },

  /**
   * Remove a patient's face encoding (GDPR compliance)
   * @param {string} patientId - Patient ID
   * @param {string} reason - Reason for removal
   */
  async removeEncoding(patientId, reason = '') {
    const response = await api.delete(`/face-recognition/encoding/${patientId}`, {
      data: { reason }
    });
    return response.data;
  },

  /**
   * Get face recognition statistics
   */
  async getStats() {
    const response = await api.get('/face-recognition/stats');
    return response.data;
  }
};

export default faceRecognitionService;
