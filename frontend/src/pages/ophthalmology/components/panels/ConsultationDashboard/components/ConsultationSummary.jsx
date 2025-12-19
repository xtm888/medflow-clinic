/**
 * ConsultationSummary Component
 *
 * Displays a summary of the consultation data.
 */

import { CheckCircle } from 'lucide-react';
import { formatRefraction } from '../constants';

export default function ConsultationSummary({ data }) {
  const hasRefraction = data.refraction?.subjective?.OD?.sphere || data.refraction?.subjective?.OS?.sphere;
  const hasIOP = data.examination?.iop?.OD?.value || data.examination?.iop?.OS?.value;
  const hasDiagnoses = data.diagnostic?.diagnoses?.length > 0;
  const hasProcedures = data.diagnostic?.procedures?.length > 0;
  const hasLab = data.diagnostic?.laboratory?.length > 0;
  const hasPrescription = data.prescription?.glasses?.OD?.sphere || data.prescription?.medications?.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-gray-600" />
          Résumé de la Consultation
        </h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-6 text-sm">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Complaint */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Motif</h4>
              <p className="text-gray-900">{data.complaint?.motif || 'Non renseigné'}</p>
              {data.complaint?.duration && (
                <p className="text-xs text-gray-500">Durée: {data.complaint.duration}</p>
              )}
            </div>

            {/* Refraction */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Réfraction</h4>
              {hasRefraction ? (
                <div className="space-y-1">
                  <p className="text-gray-900">OD: {formatRefraction(data, 'OD')}</p>
                  <p className="text-gray-900">OS: {formatRefraction(data, 'OS')}</p>
                </div>
              ) : (
                <p className="text-gray-400">Non effectuée</p>
              )}
            </div>

            {/* IOP */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">PIO</h4>
              {hasIOP ? (
                <p className="text-gray-900">
                  OD: {data.examination?.iop?.OD?.value || '--'} mmHg |
                  OS: {data.examination?.iop?.OS?.value || '--'} mmHg
                </p>
              ) : (
                <p className="text-gray-400">Non mesurée</p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Diagnoses */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnostics</h4>
              {hasDiagnoses ? (
                <ul className="space-y-1">
                  {data.diagnostic.diagnoses.map((dx, i) => (
                    <li key={i} className="text-gray-900 flex items-center gap-1">
                      {dx.isPrimary && <span className="text-yellow-500">★</span>}
                      {dx.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">Aucun</p>
              )}
            </div>

            {/* Procedures & Lab */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Examens demandés</h4>
              {hasProcedures || hasLab ? (
                <div className="flex flex-wrap gap-1">
                  {data.diagnostic?.procedures?.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {p.code}
                    </span>
                  ))}
                  {data.diagnostic?.laboratory?.map((l, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      {l.code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">Aucun</p>
              )}
            </div>

            {/* Prescription */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Prescription</h4>
              {hasPrescription ? (
                <div className="space-y-1">
                  {data.prescription?.glasses?.OD?.sphere && (
                    <p className="text-gray-900 text-xs">Lunettes prescrites</p>
                  )}
                  {data.prescription?.medications?.length > 0 && (
                    <p className="text-gray-900 text-xs">
                      {data.prescription.medications.length} médicament(s)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">Aucune</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
