import { useState } from 'react';
import {
  FileText, Eye, Activity, Stethoscope, Pill, TestTube,
  ClipboardList, Printer, Download, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Clock
} from 'lucide-react';

/**
 * SummaryStep - Auto-generated consultation summary (Fermer's Résumé)
 *
 * Aggregates all step data into a comprehensive, printable summary
 */
export default function SummaryStep({
  data,
  onChange,
  patient,
  allStepData = {},
  previousExams = [],
  readOnly = false
}) {
  const [expandedSections, setExpandedSections] = useState({
    refraction: true,
    examination: true,
    diagnosis: true,
    prescription: true,
    procedures: true,
    laboratory: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Format refraction data for display
  const formatRefraction = (eye, refractionData) => {
    if (!refractionData) return 'Non mesuré';
    const { sphere, cylinder, axis, va } = refractionData;
    let result = '';

    if (sphere) {
      result += sphere > 0 ? `+${sphere}` : sphere;
    }
    if (cylinder) {
      result += ` (${cylinder > 0 ? '+' : ''}${cylinder} à ${axis || 0}°)`;
    }
    if (va) {
      result += ` = ${va}`;
    }

    return result || 'Non mesuré';
  };

  // Format visual acuity
  const formatVA = (vaData, eye) => {
    if (!vaData?.distance?.[eye]) return 'Non mesuré';
    const { unaided, pinhole, corrected } = vaData.distance[eye];
    let parts = [];
    if (unaided) parts.push(`SC: ${unaided}`);
    if (pinhole) parts.push(`PH: ${pinhole}`);
    if (corrected) parts.push(`AC: ${corrected}`);
    return parts.join(' / ') || 'Non mesuré';
  };

  // Get IOP values
  const getIOP = () => {
    const exam = allStepData.examination;
    if (!exam?.iop) return null;
    return {
      OD: exam.iop.OD?.value || exam.iop.OD || 0,
      OS: exam.iop.OS?.value || exam.iop.OS || 0,
      method: exam.iop.OD?.method || 'goldman'
    };
  };

  const iop = getIOP();

  // Section component
  const Section = ({ id, title, icon: Icon, color, children }) => (
    <div className={`border rounded-lg overflow-hidden mb-4 bg-${color}-50`}>
      <button
        onClick={() => toggleSection(id)}
        className={`w-full px-4 py-3 flex items-center justify-between bg-${color}-100 hover:bg-${color}-200 transition`}
      >
        <span className="flex items-center font-medium text-gray-800">
          <Icon className={`w-5 h-5 mr-2 text-${color}-600`} />
          {title}
        </span>
        {expandedSections[id] ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {expandedSections[id] && (
        <div className="p-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Résumé de Consultation</h2>
        <div className="flex space-x-2">
          <button className="flex items-center px-3 py-2 border rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </button>
          <button className="flex items-center px-3 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </button>
        </div>
      </div>

      {/* Patient Info Banner */}
      {patient && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">
                {patient.lastName} {patient.firstName}
              </div>
              <div className="text-sm text-gray-600">
                {patient.dateOfBirth && new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}
                {patient.mrn && ` • MRN: ${patient.mrn}`}
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div>Date: {new Date().toLocaleDateString('fr-FR')}</div>
              <div>Heure: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>
      )}

      {/* Chief Complaint */}
      {allStepData.complaint && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4">
          <div className="font-medium text-gray-700 mb-2">Motif de consultation</div>
          <div className="text-gray-900">
            {allStepData.complaint.complaint || allStepData.complaint.motif || 'Non spécifié'}
          </div>
          {allStepData.complaint.duration && (
            <div className="text-sm text-gray-500 mt-1">
              Durée: {allStepData.complaint.duration}
            </div>
          )}
        </div>
      )}

      {/* Refraction Section */}
      <Section id="refraction" title="Réfraction" icon={Eye} color="blue">
        {/* Visual Acuity */}
        {allStepData.visual_acuity && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Acuité Visuelle</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">OD:</span> {formatVA(allStepData.visual_acuity, 'OD')}
              </div>
              <div>
                <span className="font-medium">OG:</span> {formatVA(allStepData.visual_acuity, 'OS')}
              </div>
            </div>
          </div>
        )}

        {/* Subjective Refraction */}
        {allStepData.subjective_refraction && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Réfraction Subjective</div>
            <div className="bg-gray-50 rounded p-3 text-sm font-mono">
              <div>OD = {formatRefraction('OD', allStepData.subjective_refraction.OD)}</div>
              <div>OG = {formatRefraction('OS', allStepData.subjective_refraction.OS)}</div>
            </div>
          </div>
        )}

        {/* Keratometry */}
        {allStepData.keratometry && (allStepData.keratometry.OD?.k1?.power || allStepData.keratometry.OS?.k1?.power) && (
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">Kératométrie</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {allStepData.keratometry.OD?.k1?.power && (
                <div>
                  <span className="font-medium">OD:</span> K1: {allStepData.keratometry.OD.k1.power}D @ {allStepData.keratometry.OD.k1.axis}°
                  / K2: {allStepData.keratometry.OD.k2?.power}D @ {allStepData.keratometry.OD.k2?.axis}°
                </div>
              )}
              {allStepData.keratometry.OS?.k1?.power && (
                <div>
                  <span className="font-medium">OG:</span> K1: {allStepData.keratometry.OS.k1.power}D @ {allStepData.keratometry.OS.k1.axis}°
                  / K2: {allStepData.keratometry.OS.k2?.power}D @ {allStepData.keratometry.OS.k2?.axis}°
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Tonometry / IOP */}
      {iop && (iop.OD > 0 || iop.OS > 0) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-2">
            <Activity className="w-5 h-5 mr-2 text-purple-600" />
            <span className="font-medium">Tonométrie</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className={`${iop.OD > 21 ? 'text-red-600 font-bold' : ''}`}>
              TOD = {iop.OD} mmHg
              {iop.OD > 21 && <AlertTriangle className="w-4 h-4 inline ml-1" />}
            </div>
            <div className={`${iop.OS > 21 ? 'text-red-600 font-bold' : ''}`}>
              TOG = {iop.OS} mmHg
              {iop.OS > 21 && <AlertTriangle className="w-4 h-4 inline ml-1" />}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Méthode: {iop.method === 'goldman' ? 'Goldman' : iop.method}
          </div>
        </div>
      )}

      {/* Examination Findings */}
      <Section id="examination" title="Examen Ophtalmologique" icon={Stethoscope} color="orange">
        {allStepData.examination ? (
          <div className="space-y-4">
            {/* Anterior Segment */}
            {allStepData.examination.slitLamp && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Segment Antérieur</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">OD:</span>
                    <ul className="list-disc list-inside ml-2">
                      {Object.entries(allStepData.examination.slitLamp.OD || {}).map(([key, value]) => (
                        value && <li key={key}>{key}: {value}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium">OG:</span>
                    <ul className="list-disc list-inside ml-2">
                      {Object.entries(allStepData.examination.slitLamp.OS || {}).map(([key, value]) => (
                        value && <li key={key}>{key}: {value}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Fundus */}
            {allStepData.examination.fundus && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Fond d'Œil</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">OD:</span>
                    <ul className="list-disc list-inside ml-2">
                      {Object.entries(allStepData.examination.fundus.OD || {}).map(([key, value]) => (
                        value && <li key={key}>{key}: {value}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium">OG:</span>
                    <ul className="list-disc list-inside ml-2">
                      {Object.entries(allStepData.examination.fundus.OS || {}).map(([key, value]) => (
                        value && <li key={key}>{key}: {value}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 italic">Aucun examen documenté</p>
        )}
      </Section>

      {/* Diagnosis */}
      <Section id="diagnosis" title="Diagnostics" icon={FileText} color="yellow">
        {Array.isArray(allStepData.diagnosis) && allStepData.diagnosis.length > 0 ? (
          <div className="space-y-2">
            {allStepData.diagnosis.map((diag, index) => (
              <div
                key={index}
                className={`p-3 rounded border ${
                  diag.isPrimary ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium">
                      {diag.isPrimary && '→ '}
                      {diag.description || diag.name}
                    </span>
                    {diag.code && (
                      <span className="ml-2 text-sm text-gray-500">({diag.code})</span>
                    )}
                  </div>
                  {diag.laterality && (
                    <span className="text-sm text-gray-600">{diag.laterality}</span>
                  )}
                </div>
                {diag.notes && (
                  <div className="text-sm text-gray-600 mt-1">{diag.notes}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">Aucun diagnostic enregistré</p>
        )}
      </Section>

      {/* Procedures */}
      {Array.isArray(allStepData.procedures) && allStepData.procedures.length > 0 && (
        <Section id="procedures" title="Examens Complémentaires" icon={ClipboardList} color="indigo">
          <div className="space-y-2">
            {allStepData.procedures.map((proc, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{proc.name || proc.code}</span>
                <div className="flex items-center space-x-2">
                  {proc.laterality && (
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{proc.laterality}</span>
                  )}
                  {proc.priority === 'urgent' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Urgent</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Laboratory */}
      {Array.isArray(allStepData.laboratory) && allStepData.laboratory.length > 0 && (
        <Section id="laboratory" title="Analyses Laboratoire" icon={Flask} color="teal">
          <div className="space-y-2">
            {allStepData.laboratory.map((lab, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{lab.name || lab.code}</span>
                {lab.urgency && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    lab.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-200'
                  }`}>
                    {lab.urgency}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Prescription */}
      <Section id="prescription" title="Prescription" icon={Pill} color="green">
        {allStepData.prescription ? (
          <div className="space-y-4">
            {/* Glasses Prescription */}
            {allStepData.prescription.type === 'glasses' && allStepData.prescription.finalPrescription && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Prescription Lunettes</div>
                <div className="bg-green-50 rounded p-3 font-mono text-sm">
                  <div>OD: {formatRefraction('OD', allStepData.prescription.finalPrescription.OD)}</div>
                  <div>OG: {formatRefraction('OS', allStepData.prescription.finalPrescription.OS)}</div>
                  {allStepData.prescription.finalPrescription.add && (
                    <div>Addition: +{allStepData.prescription.finalPrescription.add}</div>
                  )}
                </div>
                {allStepData.prescription.lensTypes?.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Types de verres:</span> {allStepData.prescription.lensTypes.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Medications */}
            {allStepData.prescription.medications?.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Médicaments</div>
                <div className="space-y-2">
                  {allStepData.prescription.medications.map((med, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium">{med.name}</div>
                      {med.dosage && <div className="text-gray-600">{med.dosage}</div>}
                      {med.duration && <div className="text-gray-500">Durée: {med.duration}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {allStepData.prescription.recommendations?.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Recommandations</div>
                <ul className="list-disc list-inside text-sm">
                  {allStepData.prescription.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comments */}
            {allStepData.prescription.comment && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Commentaires</div>
                <p className="text-sm text-gray-700">{allStepData.prescription.comment}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 italic">Aucune prescription</p>
        )}
      </Section>

      {/* Footer with completion status */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg flex items-center justify-between">
        <div className="flex items-center text-green-600">
          <CheckCircle className="w-5 h-5 mr-2" />
          <span className="font-medium">Consultation complète</span>
        </div>
        <div className="text-sm text-gray-500 flex items-center">
          <Clock className="w-4 h-4 mr-1" />
          {new Date().toLocaleString('fr-FR')}
        </div>
      </div>
    </div>
  );
}
