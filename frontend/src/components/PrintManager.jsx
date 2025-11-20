import { useState } from 'react';
import { X, FileText, Download, Printer, Calendar, ClipboardList, Receipt } from 'lucide-react';
import api from '../services/apiConfig';

const DOCUMENT_TYPES = [
  { value: 'prescription', label: 'Ordonnance', icon: FileText },
  { value: 'certificate', label: 'Certificat Médical', icon: ClipboardList },
  { value: 'sick-leave', label: 'Arrêt de Travail', icon: Calendar },
  { value: 'invoice', label: 'Facture', icon: Receipt }
];

function PrintManager({ isOpen, onClose, patient, visit, defaultType = 'prescription' }) {
  const [selectedType, setSelectedType] = useState(defaultType);
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [error, setError] = useState(null);

  // Form states for different document types
  const [prescriptionData, setPrescriptionData] = useState({
    prescriptions: [
      { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ],
    notes: ''
  });

  const [certificateData, setCertificateData] = useState({
    certificateType: 'general',
    reason: '',
    findings: ''
  });

  const [sickLeaveData, setSickLeaveData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    reason: '',
    restrictions: [],
    outingsAllowed: true,
    includeReason: false
  });

  const [invoiceData, setInvoiceData] = useState({
    items: [{ description: '', quantity: 1, price: 0 }],
    paymentMethod: 'cash'
  });

  if (!isOpen) return null;

  const handleAddPrescriptionItem = () => {
    setPrescriptionData(prev => ({
      ...prev,
      prescriptions: [...prev.prescriptions, { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    }));
  };

  const handleRemovePrescriptionItem = (index) => {
    setPrescriptionData(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index)
    }));
  };

  const handlePrescriptionItemChange = (index, field, value) => {
    setPrescriptionData(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleAddInvoiceItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, price: 0 }]
    }));
  };

  const handleRemoveInvoiceItem = (index) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleInvoiceItemChange = (index, field, value) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateInvoiceTotal = () => {
    const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tax = 0; // Modify as needed
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedDoc(null);

    try {
      let endpoint = '';
      let payload = { patientId: patient._id };

      switch (selectedType) {
        case 'prescription':
          endpoint = '/documents/generate/prescription';
          payload = {
            ...payload,
            prescriptions: prescriptionData.prescriptions,
            notes: prescriptionData.notes,
            prescriptionId: visit?._id || `PRES-${Date.now()}`
          };
          break;

        case 'certificate':
          endpoint = '/documents/generate/certificate';
          payload = {
            ...payload,
            ...certificateData,
            certificateId: `CERT-${Date.now()}`
          };
          break;

        case 'sick-leave':
          endpoint = '/documents/generate/sick-leave';
          payload = {
            ...payload,
            ...sickLeaveData,
            certificateId: `SICK-${Date.now()}`
          };
          break;

        case 'invoice':
          endpoint = '/documents/generate/invoice';
          const totals = calculateInvoiceTotal();
          payload = {
            ...payload,
            invoiceNumber: `INV-${Date.now()}`,
            items: invoiceData.items,
            ...totals,
            paymentMethod: invoiceData.paymentMethod
          };
          break;

        default:
          throw new Error('Invalid document type');
      }

      const response = await api.post(endpoint, payload);

      if (response.data.success) {
        setGeneratedDoc(response.data.data);
      } else {
        setError(response.data.message || 'Erreur lors de la génération du document');
      }
    } catch (err) {
      console.error('Error generating document:', err);
      setError(err.response?.data?.message || 'Erreur lors de la génération du document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedDoc) return;

    const downloadUrl = `${api.defaults.baseURL}/documents/download/${generatedDoc.filename}`;
    window.open(downloadUrl, '_blank');
  };

  const handlePrint = () => {
    if (!generatedDoc) return;

    const printUrl = `${api.defaults.baseURL}/documents/download/${generatedDoc.filename}`;
    const printWindow = window.open(printUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const renderFormFields = () => {
    switch (selectedType) {
      case 'prescription':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prescriptions
              </label>
              {prescriptionData.prescriptions.map((item, index) => (
                <div key={index} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-700">Médicament {index + 1}</span>
                    {prescriptionData.prescriptions.length > 1 && (
                      <button
                        onClick={() => handleRemovePrescriptionItem(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Nom du médicament"
                    value={item.medication}
                    onChange={(e) => handlePrescriptionItemChange(index, 'medication', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Dosage (ex: 500mg)"
                      value={item.dosage}
                      onChange={(e) => handlePrescriptionItemChange(index, 'dosage', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Fréquence (ex: 2x/jour)"
                      value={item.frequency}
                      onChange={(e) => handlePrescriptionItemChange(index, 'frequency', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Durée (ex: 7 jours)"
                      value={item.duration}
                      onChange={(e) => handlePrescriptionItemChange(index, 'duration', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Instructions"
                      value={item.instructions}
                      onChange={(e) => handlePrescriptionItemChange(index, 'instructions', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddPrescriptionItem}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Ajouter un médicament
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes additionnelles (optionnel)
              </label>
              <textarea
                value={prescriptionData.notes}
                onChange={(e) => setPrescriptionData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="3"
                placeholder="Notes pour le patient..."
              />
            </div>
          </div>
        );

      case 'certificate':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de certificat
              </label>
              <select
                value={certificateData.certificateType}
                onChange={(e) => setCertificateData(prev => ({ ...prev, certificateType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="general">Certificat général</option>
                <option value="sport">Certificat médical sport</option>
                <option value="work">Certificat d'aptitude au travail</option>
                <option value="school">Certificat scolaire</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Constatations
              </label>
              <textarea
                value={certificateData.findings}
                onChange={(e) => setCertificateData(prev => ({ ...prev, findings: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="4"
                placeholder="Décrivez les constatations médicales..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif du certificat
              </label>
              <textarea
                value={certificateData.reason}
                onChange={(e) => setCertificateData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="2"
                placeholder="À faire valoir ce que de droit..."
              />
            </div>
          </div>
        );

      case 'sick-leave':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début
                </label>
                <input
                  type="date"
                  value={sickLeaveData.startDate}
                  onChange={(e) => setSickLeaveData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={sickLeaveData.endDate}
                  onChange={(e) => setSickLeaveData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif médical (confidentiel)
              </label>
              <textarea
                value={sickLeaveData.reason}
                onChange={(e) => setSickLeaveData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="3"
                placeholder="Décrivez le motif de l'arrêt de travail..."
              />
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sickLeaveData.outingsAllowed}
                  onChange={(e) => setSickLeaveData(prev => ({ ...prev, outingsAllowed: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Sorties autorisées</span>
              </label>
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sickLeaveData.includeReason}
                  onChange={(e) => setSickLeaveData(prev => ({ ...prev, includeReason: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Inclure le motif sur le certificat</span>
              </label>
            </div>
          </div>
        );

      case 'invoice':
        const totals = calculateInvoiceTotal();
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Articles
              </label>
              {invoiceData.items.map((item, index) => (
                <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Article {index + 1}</span>
                    {invoiceData.items.length > 1 && (
                      <button
                        onClick={() => handleRemoveInvoiceItem(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleInvoiceItemChange(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Qté"
                      value={item.quantity}
                      onChange={(e) => handleInvoiceItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="Prix unit."
                      value={item.price}
                      onChange={(e) => handleInvoiceItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      step="0.01"
                    />
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-right font-medium">
                      {(item.quantity * item.price).toFixed(2)} €
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddInvoiceItem}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Ajouter un article
              </button>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Sous-total:</span>
                <span className="font-medium">{totals.subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">TVA:</span>
                <span className="font-medium">{totals.tax.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{totals.total.toFixed(2)} €</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode de paiement
              </label>
              <select
                value={invoiceData.paymentMethod}
                onChange={(e) => setInvoiceData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="cash">Espèces</option>
                <option value="card">Carte bancaire</option>
                <option value="check">Chèque</option>
                <option value="transfer">Virement</option>
              </select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="relative inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">
              Gestionnaire d'Impression
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Patient Info */}
          {patient && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <p className="text-sm text-gray-700">
                <strong>Patient:</strong> {patient.firstName} {patient.lastName}
                {patient.dateOfBirth && ` • Né(e) le: ${new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4">
            {/* Document Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Type de document
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DOCUMENT_TYPES.map(type => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                        selectedType === type.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <IconComponent className="w-6 h-6 mb-2" />
                      <span className="text-xs text-center font-medium">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <div className="mb-6">
              {renderFormFields()}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Generated Document Info */}
            {generatedDoc && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium mb-2">
                  ✓ Document généré avec succès!
                </p>
                <p className="text-xs text-green-700">
                  Fichier: {generatedDoc.filename}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>

            {generatedDoc ? (
              <>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Génération...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Générer le document
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintManager;
