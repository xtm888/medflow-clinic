import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glasses, Eye, FileText, Printer, Send, Check, Package } from 'lucide-react';
import { formatPrescription, calculateReadingAdd, vertexCorrection } from '../../../utils/ophthalmologyCalculations';
import { spectacleLensOptions, contactLensOptions, frameOptions } from '../../../data/ophthalmologyData';

export default function PrescriptionStep({ data, setData, patient }) {
  const navigate = useNavigate();
  const [prescriptionType, setPrescriptionType] = useState('glasses');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showVertexCorrection, setShowVertexCorrection] = useState(false);

  // Calculate reading addition if needed
  const readingAdd = patient?.age >= 40 ? calculateReadingAdd(patient.age) : null;

  // Apply vertex correction for contact lenses
  const getContactLensPrescription = () => {
    const odSphere = parseFloat(data.subjective.OD.sphere);
    const osSphere = parseFloat(data.subjective.OS.sphere);

    return {
      OD: {
        sphere: vertexCorrection(odSphere, 0), // 0mm vertex distance for contacts
        cylinder: data.subjective.OD.cylinder,
        axis: data.subjective.OD.axis
      },
      OS: {
        sphere: vertexCorrection(osSphere, 0),
        cylinder: data.subjective.OS.cylinder,
        axis: data.subjective.OS.axis
      }
    };
  };

  // Generate final prescription
  const generatePrescription = () => {
    const prescription = {
      ...data.finalPrescription,
      OD: { ...data.subjective.OD },
      OS: { ...data.subjective.OS },
      add: readingAdd?.recommended || 0,
      prescriptionType,

      // Additional information
      examDate: new Date().toISOString(),
      examiner: data.examiner,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year

      // Measurements
      pupilDistance: data.pupilDistance,
      visualAcuity: data.visualAcuity,

      // Recommendations
      recommendations: []
    };

    // Add recommendations based on findings
    if (Math.abs(prescription.OD.sphere - prescription.OS.sphere) > 2) {
      prescription.recommendations.push('Anisométropie significative - Considérer lentilles de contact');
    }

    if (patient?.age >= 40 && !prescription.add) {
      prescription.recommendations.push('Presbytie possible - Évaluer besoin de correction de près');
    }

    if (Math.abs(prescription.OD.cylinder) > 2 || Math.abs(prescription.OS.cylinder) > 2) {
      prescription.recommendations.push('Astigmatisme élevé - Verres toriques recommandés');
    }

    setData(prev => ({
      ...prev,
      finalPrescription: prescription
    }));

    return prescription;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendToPatient = () => {
    alert('Prescription envoyée au patient par SMS/Email');
  };

  const handleCreateInvoice = () => {
    navigate(`/invoicing?patientId=${patient?.id}&type=optical&products=${JSON.stringify(selectedProducts)}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Glasses className="w-5 h-5 mr-2 text-blue-600" />
        Prescription Finale
      </h2>

      {/* Prescription Type Selector */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setPrescriptionType('glasses')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            prescriptionType === 'glasses' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Glasses className="w-4 h-4 mr-2" />
          Lunettes
        </button>
        <button
          onClick={() => setPrescriptionType('contacts')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            prescriptionType === 'contacts' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Lentilles
        </button>
        <button
          onClick={() => setPrescriptionType('both')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            prescriptionType === 'both' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4 mr-2" />
          Les Deux
        </button>
      </div>

      {/* Prescription Display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg">Prescription de Réfraction</h3>
            <p className="text-sm text-gray-600 mt-1">
              Patient: {patient?.firstName} {patient?.lastName} | Âge: {patient?.age} ans
            </p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Date: {new Date().toLocaleDateString('fr-FR')}</p>
            <p>Prescripteur: {data.examiner}</p>
          </div>
        </div>

        {/* Glasses Prescription */}
        {(prescriptionType === 'glasses' || prescriptionType === 'both') && (
          <div className="mb-6">
            <h4 className="font-semibold mb-3 flex items-center text-blue-700">
              <Glasses className="w-4 h-4 mr-2" />
              Correction Lunettes
            </h4>
            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OD:</span>
                    <span className="font-mono text-lg">{formatPrescription(data.subjective).OD}</span>
                  </div>
                  <div className="text-sm text-gray-500 ml-12">
                    AV: {data.subjective.OD.va || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OS:</span>
                    <span className="font-mono text-lg">{formatPrescription(data.subjective).OS}</span>
                  </div>
                  <div className="text-sm text-gray-500 ml-12">
                    AV: {data.subjective.OS.va || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Reading Addition */}
              {readingAdd && patient.age >= 40 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700">Addition VP:</span>
                    <span className="ml-3 font-mono text-lg text-green-600">+{readingAdd.recommended}D</span>
                    <span className="text-sm text-gray-500 ml-3">(Presbytie - {patient.age} ans)</span>
                  </div>
                </div>
              )}

              {/* PD Display */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center">
                  <span className="font-medium text-gray-700">ÉP:</span>
                  <span className="ml-3 font-mono">{data.pupilDistance.binocular}mm</span>
                  <span className="text-sm text-gray-500 ml-3">
                    (OD: {data.pupilDistance.OD}mm | OS: {data.pupilDistance.OS}mm)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Lens Prescription */}
        {(prescriptionType === 'contacts' || prescriptionType === 'both') && (
          <div className="mb-6">
            <h4 className="font-semibold mb-3 flex items-center text-blue-700">
              <Eye className="w-4 h-4 mr-2" />
              Correction Lentilles de Contact
            </h4>

            {/* Vertex Correction Notice */}
            {(Math.abs(data.subjective.OD.sphere) > 4 || Math.abs(data.subjective.OS.sphere) > 4) && (
              <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={showVertexCorrection}
                    onChange={(e) => setShowVertexCorrection(e.target.checked)}
                    className="mr-2"
                  />
                  Appliquer la correction de vertex (Rx &gt; ±4.00D)
                </label>
              </div>
            )}

            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OD:</span>
                    <span className="font-mono text-lg">
                      {showVertexCorrection
                        ? formatPrescription(getContactLensPrescription()).OD
                        : formatPrescription(data.subjective).OD}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OS:</span>
                    <span className="font-mono text-lg">
                      {showVertexCorrection
                        ? formatPrescription(getContactLensPrescription()).OS
                        : formatPrescription(data.subjective).OS}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Lens Parameters */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Courbe de Base</label>
                    <select className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>8.4</option>
                      <option>8.6</option>
                      <option>8.8</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Diamètre</label>
                    <select className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>14.0</option>
                      <option>14.2</option>
                      <option>14.5</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Marque</label>
                    <select className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {contactLensOptions.map(lens => (
                        <option key={lens.brand}>{lens.brand}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Selection */}
        {prescriptionType === 'glasses' && (
          <div className="mb-6">
            <h4 className="font-semibold mb-3 flex items-center text-blue-700">
              <Package className="w-4 h-4 mr-2" />
              Sélection de Produits
            </h4>
            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type de Verre</label>
                  <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Simple Vision</option>
                    <option>Progressif</option>
                    <option>Bifocal</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Matériau</label>
                  <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {spectacleLensOptions[0].materials.map(material => (
                      <option key={material.name}>
                        {material.name} (n={material.index}) - ${material.price}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-600">Traitements</label>
                <div className="mt-2 space-y-2">
                  {spectacleLensOptions[0].coatings.map(coating => (
                    <label key={coating.name} className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, coating]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(p => p.name !== coating.name));
                          }
                        }}
                      />
                      <span className="text-sm">{coating.name} (+${coating.price})</span>
                      <span className="text-xs text-gray-500 ml-2">- {coating.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clinical Notes */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700">Notes Cliniques</label>
          <textarea
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="Recommandations supplémentaires..."
            value={data.finalPrescription.recommendations.join('\n')}
            onChange={(e) => setData(prev => ({
              ...prev,
              finalPrescription: {
                ...prev.finalPrescription,
                recommendations: e.target.value.split('\n').filter(r => r.trim())
              }
            }))}
          />
        </div>

        {/* Validity */}
        <div className="text-sm text-gray-600 text-center pt-4 border-t border-gray-200">
          Cette prescription est valide pour 12 mois à partir de la date d'émission
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generatePrescription}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Valider Prescription
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </button>
          <button
            onClick={handleSendToPatient}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Envoyer au Patient
          </button>
        </div>

        <button
          onClick={handleCreateInvoice}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Créer Facture
        </button>
      </div>
    </div>
  );
}