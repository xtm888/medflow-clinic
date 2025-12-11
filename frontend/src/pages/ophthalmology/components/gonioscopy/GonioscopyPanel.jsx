/**
 * GonioscopyPanel
 *
 * Container component for bilateral gonioscopy assessment.
 * Provides tabs for OD/OS evaluation with GonioscopyEnhanced.
 */

import { useState } from 'react';
import { Eye, ArrowLeftRight } from 'lucide-react';
import GonioscopyEnhanced from './GonioscopyEnhanced';

export default function GonioscopyPanel({
  data = {},
  onChange,
  readOnly = false
}) {
  const [activeEye, setActiveEye] = useState('OD');
  const [showBothEyes, setShowBothEyes] = useState(false);

  // Handle eye data change
  const handleEyeChange = (updates) => {
    onChange({
      ...data,
      ...updates
    });
  };

  // Copy OD to OS
  const copyODtoOS = () => {
    if (readOnly || !data.OD) return;

    onChange({
      ...data,
      OS: { ...data.OD }
    });
  };

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Vue:</span>
          <button
            onClick={() => setShowBothEyes(false)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              !showBothEyes
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Un œil
          </button>
          <button
            onClick={() => setShowBothEyes(true)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              showBothEyes
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Deux yeux
          </button>
        </div>

        {!showBothEyes && (
          <div className="flex items-center gap-2">
            {/* Eye Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveEye('OD')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                  activeEye === 'OD'
                    ? 'bg-white shadow text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  OD (Droit)
                </span>
              </button>
              <button
                onClick={() => setActiveEye('OS')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                  activeEye === 'OS'
                    ? 'bg-white shadow text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  OS (Gauche)
                </span>
              </button>
            </div>

            {/* Copy OD to OS */}
            {data.OD && !readOnly && (
              <button
                onClick={copyODtoOS}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50 flex items-center gap-1"
                title="Copier OD vers OS"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Copier OD → OS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {showBothEyes ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <GonioscopyEnhanced
              data={data}
              onChange={handleEyeChange}
              readOnly={readOnly}
              eye="OD"
            />
          </div>
          <div className="border rounded-lg p-4">
            <GonioscopyEnhanced
              data={data}
              onChange={handleEyeChange}
              readOnly={readOnly}
              eye="OS"
            />
          </div>
        </div>
      ) : (
        <GonioscopyEnhanced
          data={data}
          onChange={handleEyeChange}
          readOnly={readOnly}
          eye={activeEye}
        />
      )}

      {/* Comparison Summary */}
      {data.OD && data.OS && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-gray-500" />
            Comparaison OD / OS
          </h4>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded p-3 border">
              <div className="font-medium text-blue-700 mb-2">OD - Œil Droit</div>
              <div className="space-y-1 text-gray-600">
                <p>Système: {data.gradingSystem || 'Non spécifié'}</p>
                <p>SAP: {data.OD.pas || '0'} heures</p>
                <p>Néovasc.: {data.OD.neovascularization ? 'Oui' : 'Non'}</p>
              </div>
            </div>

            <div className="bg-white rounded p-3 border">
              <div className="font-medium text-blue-700 mb-2">OS - Œil Gauche</div>
              <div className="space-y-1 text-gray-600">
                <p>Système: {data.gradingSystem || 'Non spécifié'}</p>
                <p>SAP: {data.OS.pas || '0'} heures</p>
                <p>Néovasc.: {data.OS.neovascularization ? 'Oui' : 'Non'}</p>
              </div>
            </div>
          </div>

          {/* Asymmetry warning */}
          {(data.OD.neovascularization !== data.OS.neovascularization ||
            Math.abs((parseInt(data.OD.pas) || 0) - (parseInt(data.OS.pas) || 0)) > 2) && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Asymétrie détectée:</strong> Différence significative entre les deux yeux.
              Une évaluation approfondie est recommandée.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
