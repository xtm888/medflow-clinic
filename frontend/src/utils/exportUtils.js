// Export utilities for generating CSV, Excel, and JSON exports

/**
 * Export data as CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 * @param {Array} columns - Optional column configuration [{key: 'fieldName', label: 'Display Name'}]
 */
export const exportToCSV = (data, filename, columns = null) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return false;
  }

  try {
    // If columns not specified, use keys from first object
    const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

    // Generate headers
    const headers = cols.map(col => col.label);

    // Generate rows
    const rows = data.map(item => {
      return cols.map(col => {
        let value = item[col.key];

        // Handle nested objects
        if (col.key.includes('.')) {
          const keys = col.key.split('.');
          value = keys.reduce((obj, key) => obj?.[key], item);
        }

        // Format value for CSV
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
          if (value instanceof Date) {
            return value.toLocaleDateString('fr-FR');
          }
          return JSON.stringify(value);
        }
        return String(value);
      });
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;', true);
    return true;
  } catch (error) {
    console.error('CSV export error:', error);
    return false;
  }
};

/**
 * Export data as JSON file
 * @param {any} data - Data to export
 * @param {string} filename - Name of the file (without extension)
 */
export const exportToJSON = (data, filename) => {
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, `${filename}.json`, 'application/json');
    return true;
  } catch (error) {
    console.error('JSON export error:', error);
    return false;
  }
};

/**
 * Export data for specific modules
 */
export const exportPatients = (patients, filename = 'patients') => {
  const columns = [
    { key: 'patientId', label: 'ID Patient' },
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'dateOfBirth', label: 'Date de naissance' },
    { key: 'gender', label: 'Sexe' },
    { key: 'phoneNumber', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
    { key: 'address.city', label: 'Ville' },
    { key: 'createdAt', label: 'Date création' }
  ];

  return exportToCSV(patients, filename, columns);
};

export const exportAppointments = (appointments, filename = 'appointments') => {
  const columns = [
    { key: 'appointmentId', label: 'ID RDV' },
    { key: 'date', label: 'Date' },
    { key: 'startTime', label: 'Heure' },
    { key: 'patient.firstName', label: 'Patient Prénom' },
    { key: 'patient.lastName', label: 'Patient Nom' },
    { key: 'provider.firstName', label: 'Médecin Prénom' },
    { key: 'provider.lastName', label: 'Médecin Nom' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'reason', label: 'Motif' }
  ];

  return exportToCSV(appointments, filename, columns);
};

export const exportInvoices = (invoices, filename = 'invoices') => {
  const columns = [
    { key: 'invoiceNumber', label: 'N° Facture' },
    { key: 'date', label: 'Date' },
    { key: 'patient.firstName', label: 'Patient Prénom' },
    { key: 'patient.lastName', label: 'Patient Nom' },
    { key: 'totalAmount', label: 'Montant Total' },
    { key: 'paidAmount', label: 'Montant Payé' },
    { key: 'status', label: 'Statut' },
    { key: 'dueDate', label: 'Date Échéance' }
  ];

  return exportToCSV(invoices, filename, columns);
};

export const exportLabResults = (results, filename = 'lab_results') => {
  const columns = [
    { key: 'createdAt', label: 'Date' },
    { key: 'patient.firstName', label: 'Patient Prénom' },
    { key: 'patient.lastName', label: 'Patient Nom' },
    { key: 'testName', label: 'Examen' },
    { key: 'status', label: 'Statut' },
    { key: 'priority', label: 'Priorité' },
    { key: 'result', label: 'Résultat' },
    { key: 'referenceRange', label: 'Valeurs Normales' }
  ];

  return exportToCSV(results, filename, columns);
};

export const exportPrescriptions = (prescriptions, filename = 'prescriptions') => {
  const columns = [
    { key: 'prescriptionId', label: 'N° Ordonnance' },
    { key: 'date', label: 'Date' },
    { key: 'patient.firstName', label: 'Patient Prénom' },
    { key: 'patient.lastName', label: 'Patient Nom' },
    { key: 'prescriber.firstName', label: 'Prescripteur Prénom' },
    { key: 'prescriber.lastName', label: 'Prescripteur Nom' },
    { key: 'status', label: 'Statut' },
    { key: 'medicationCount', label: 'Nb Médicaments' }
  ];

  return exportToCSV(prescriptions, filename, columns);
};

/**
 * Helper function to download file
 */
function downloadFile(content, filename, mimeType, addBOM = false) {
  const bom = addBOM ? '\ufeff' : '';
  const blob = new Blob([bom + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format data for display before export
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR');
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

export default {
  exportToCSV,
  exportToJSON,
  exportPatients,
  exportAppointments,
  exportInvoices,
  exportLabResults,
  exportPrescriptions,
  formatDate,
  formatDateTime,
  formatCurrency
};
