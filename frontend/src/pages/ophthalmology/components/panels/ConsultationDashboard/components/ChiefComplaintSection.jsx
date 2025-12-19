/**
 * ChiefComplaintSection Component
 *
 * Chief complaint input with symptom suggestions and duration/laterality options.
 */

import { MessageSquare } from 'lucide-react';
import { SYMPTOM_SUGGESTIONS, DURATION_OPTIONS, LATERALITY_OPTIONS } from '../constants';

export default function ChiefComplaintSection({ data, updateSection }) {
  const complaint = data.complaint || {};

  const updateComplaint = (field, value) => {
    updateSection('complaint', { ...complaint, [field]: value });
  };

  const appendToMotif = (symptom) => {
    const current = complaint.motif || '';
    const newMotif = current ? `${current}, ${symptom}` : symptom;
    updateComplaint('motif', newMotif);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Motif de Consultation
        </h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Main Complaint */}
          <div className="col-span-2">
            <label className="text-xs text-gray-500 font-medium">Motif principal</label>
            <textarea
              value={complaint.motif || ''}
              onChange={(e) => updateComplaint('motif', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Décrivez le motif de consultation..."
            />
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-1 mt-2">
              {SYMPTOM_SUGGESTIONS.slice(0, 8).map(symptom => (
                <button
                  key={symptom}
                  onClick={() => appendToMotif(symptom)}
                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded-full transition"
                >
                  {symptom}
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Laterality */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Durée</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateComplaint('duration', opt.value)}
                    className={`px-2 py-1 text-xs rounded border transition ${
                      complaint.duration === opt.value
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium">Latéralité</label>
              <div className="flex gap-2 mt-1">
                {LATERALITY_OPTIONS.map(lat => (
                  <button
                    key={lat}
                    onClick={() => updateComplaint('laterality', lat)}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition ${
                      complaint.laterality === lat
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {lat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
