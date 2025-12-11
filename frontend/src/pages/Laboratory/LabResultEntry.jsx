import { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, User, AlertTriangle } from 'lucide-react';

/**
 * LabResultEntry - Form for entering laboratory test results
 * Handles both single-value and multi-component tests with auto-flagging
 */
const LabResultEntry = memo(function LabResultEntry({
  order,
  templates = [],
  patients = [],
  onSubmit,
  onClose,
  submitting = false
}) {
  const [resultForm, setResultForm] = useState({
    results: '',
    componentResults: [],
    notes: '',
    specimenQuality: 'good',
    referenceRange: {},
    referenceText: '',
    unit: '',
    flag: 'normal'
  });

  // Initialize form when order changes
  useEffect(() => {
    if (!order) return;

    const template = templates.find(
      t =>
        t._id === order.templateId ||
        t.code === order.testCode ||
        t.name === order.testName
    );

    const patient = patients.find(
      p =>
        (p._id || p.id) === order.patient?._id || (p._id || p.id) === order.patient
    );

    const patientAge = patient?.dateOfBirth
      ? Math.floor(
          (Date.now() - new Date(patient.dateOfBirth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : null;
    const patientGender = patient?.gender;

    if (template?.components && template.components.length > 0) {
      // Multi-component test
      setResultForm({
        results: '',
        componentResults: template.components.map(comp => {
          let refRange = comp.referenceRange || {};

          // Gender-specific ranges
          if (patientGender && refRange[patientGender.toLowerCase()]) {
            refRange = { ...refRange, ...refRange[patientGender.toLowerCase()] };
          }

          // Age-specific ranges
          if (patientAge && refRange.ageSpecific?.length > 0) {
            const ageRange = refRange.ageSpecific.find(
              ar => patientAge >= ar.ageMin && patientAge <= ar.ageMax
            );
            if (ageRange) {
              refRange = { ...refRange, min: ageRange.min, max: ageRange.max };
            }
          }

          return {
            name: comp.name,
            code: comp.code,
            value: '',
            unit: comp.unit || '',
            referenceRange: refRange,
            referenceText:
              refRange.text ||
              (refRange.min !== undefined && refRange.max !== undefined
                ? `${refRange.min} - ${refRange.max}`
                : ''),
            criticalLow: refRange.criticalLow,
            criticalHigh: refRange.criticalHigh,
            flag: 'normal'
          };
        }),
        notes: '',
        specimenQuality: 'good'
      });
    } else {
      // Single-value test
      let refRange = template?.referenceRange || {};

      if (patientGender && refRange[patientGender.toLowerCase()]) {
        refRange = { ...refRange, ...refRange[patientGender.toLowerCase()] };
      }

      setResultForm({
        results: '',
        componentResults: [],
        notes: '',
        specimenQuality: 'good',
        referenceRange: refRange,
        referenceText:
          refRange.text ||
          (refRange.min !== undefined && refRange.max !== undefined
            ? `${refRange.min} - ${refRange.max}`
            : ''),
        unit: template?.unit || '',
        flag: 'normal'
      });
    }
  }, [order, templates, patients]);

  const calculateFlag = (value, referenceRange) => {
    if (!value || value === '') return 'normal';

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'normal';

    const { min, max, criticalLow, criticalHigh } = referenceRange || {};

    if (criticalLow !== undefined && numValue < criticalLow) {
      return 'critical_low';
    }
    if (criticalHigh !== undefined && numValue > criticalHigh) {
      return 'critical_high';
    }
    if (min !== undefined && numValue < min) {
      return 'low';
    }
    if (max !== undefined && numValue > max) {
      return 'high';
    }

    return 'normal';
  };

  const handleComponentValueChange = (index, newValue) => {
    const newComponents = [...resultForm.componentResults];
    const comp = newComponents[index];
    const flag = calculateFlag(newValue, comp.referenceRange);

    newComponents[index] = {
      ...comp,
      value: newValue,
      flag
    };

    setResultForm({ ...resultForm, componentResults: newComponents });
  };

  const handleSingleResultChange = (newValue) => {
    const flag = calculateFlag(newValue, resultForm.referenceRange);
    setResultForm({ ...resultForm, results: newValue, flag });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const resultData = {
      notes: resultForm.notes,
      specimenQuality: resultForm.specimenQuality
    };

    if (resultForm.componentResults.length > 0) {
      resultData.componentResults = resultForm.componentResults
        .filter(c => c.value !== '')
        .map(c => ({
          name: c.name,
          code: c.code,
          value: c.value,
          unit: c.unit,
          flag: c.flag,
          abnormalFlag: c.flag,
          isAbnormal: c.flag !== 'normal',
          isCritical: c.flag?.includes('critical'),
          referenceRange: c.referenceRange,
          referenceRangeText: c.referenceText
        }));
    } else {
      resultData.results = resultForm.results;
      resultData.flag = resultForm.flag;
      resultData.abnormalFlag = resultForm.flag;
      resultData.isAbnormal = resultForm.flag !== 'normal';
      resultData.isCritical = resultForm.flag?.includes('critical');
      resultData.referenceRange = resultForm.referenceRange;
      resultData.unit = resultForm.unit;
    }

    onSubmit(order, resultData);
  };

  if (!order) return null;

  const patient = patients.find(
    p => (p._id || p.id) === order.patient?._id || (p._id || p.id) === order.patient
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Saisie des Résultats</h2>
            <p className="text-sm text-gray-500 mt-1">
              {order.testName || 'Test'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {patient?.firstName} {patient?.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  ID: {patient?.patientId || patient?._id}
                </p>
              </div>
            </div>
          </div>

          {/* Specimen Quality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Qualité du spécimen
            </label>
            <div className="flex gap-4">
              {[
                { value: 'good', label: 'Bonne' },
                { value: 'hemolyzed', label: 'Hémolysé' },
                { value: 'lipemic', label: 'Lipémique' },
                { value: 'icteric', label: 'Ictérique' }
              ].map(quality => (
                <label key={quality.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="specimenQuality"
                    value={quality.value}
                    checked={resultForm.specimenQuality === quality.value}
                    onChange={(e) =>
                      setResultForm({ ...resultForm, specimenQuality: e.target.value })
                    }
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">{quality.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Single Result Entry */}
          {resultForm.componentResults.length === 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Résultat *
              </label>
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-4">
                  <input
                    type="text"
                    className={`input text-lg font-bold ${
                      resultForm.flag?.includes('critical')
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : resultForm.flag === 'high' || resultForm.flag === 'low'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : ''
                    }`}
                    value={resultForm.results}
                    onChange={(e) => handleSingleResultChange(e.target.value)}
                    placeholder="Valeur"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Unité</label>
                  <span className="text-sm text-gray-600">{resultForm.unit || '-'}</span>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Valeurs de référence</label>
                  <span className="text-sm font-medium text-gray-700">
                    {resultForm.referenceText || 'Non défini'}
                  </span>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Flag</label>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                      resultForm.flag === 'critical_high' || resultForm.flag === 'critical_low'
                        ? 'bg-red-600 text-white'
                        : resultForm.flag === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : resultForm.flag === 'low'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {resultForm.flag === 'critical_high'
                      ? '⚠ Critique Élevé'
                      : resultForm.flag === 'critical_low'
                      ? '⚠ Critique Bas'
                      : resultForm.flag === 'high'
                      ? '↑ Élevé'
                      : resultForm.flag === 'low'
                      ? '↓ Bas'
                      : '✓ Normal'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Component Results */}
          {resultForm.componentResults.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Résultats par test ({resultForm.componentResults.length})
              </label>
              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 bg-gray-100 px-4 py-2 text-xs font-medium text-gray-600 uppercase">
                  <div className="col-span-3">Paramètre</div>
                  <div className="col-span-2">Valeur</div>
                  <div className="col-span-2">Résultat</div>
                  <div className="col-span-1">Unité</div>
                  <div className="col-span-2">Réf.</div>
                  <div className="col-span-2">Flag</div>
                </div>

                {/* Rows */}
                <div className="divide-y max-h-96 overflow-y-auto">
                  {resultForm.componentResults.map((comp, index) => (
                    <div
                      key={index}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                        comp.flag?.includes('critical')
                          ? 'bg-red-50'
                          : comp.flag === 'high' || comp.flag === 'low'
                          ? 'bg-orange-50'
                          : comp.value
                          ? 'bg-green-50'
                          : ''
                      }`}
                    >
                      <div className="col-span-3">
                        <span className="text-sm font-medium text-gray-900">{comp.name}</span>
                        {comp.code && (
                          <span className="text-xs text-gray-400 ml-1">({comp.code})</span>
                        )}
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          className={`input text-center font-bold ${
                            comp.flag?.includes('critical')
                              ? 'border-red-500 text-red-700'
                              : comp.flag === 'high' || comp.flag === 'low'
                              ? 'border-orange-500 text-orange-700'
                              : comp.value
                              ? 'border-green-500'
                              : ''
                          }`}
                          value={comp.value}
                          onChange={(e) => handleComponentValueChange(index, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                      <div className="col-span-2 text-center">
                        {comp.value && (
                          <span
                            className={`font-bold ${
                              comp.flag?.includes('critical')
                                ? 'text-red-600'
                                : comp.flag === 'high' || comp.flag === 'low'
                                ? 'text-orange-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {comp.value}
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 text-sm text-gray-500">{comp.unit || '-'}</div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {comp.referenceText || '-'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        {comp.value && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              comp.flag === 'critical_high' || comp.flag === 'critical_low'
                                ? 'bg-red-600 text-white'
                                : comp.flag === 'high'
                                ? 'bg-orange-100 text-orange-700'
                                : comp.flag === 'low'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {comp.flag === 'critical_high'
                              ? '⚠ Critique ↑'
                              : comp.flag === 'critical_low'
                              ? '⚠ Critique ↓'
                              : comp.flag === 'high'
                              ? '↑ Élevé'
                              : comp.flag === 'low'
                              ? '↓ Bas'
                              : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Abnormal Values Summary */}
              {resultForm.componentResults.some(
                c => c.flag && c.flag !== 'normal' && c.value
              ) && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Valeurs anormales détectées:
                      </p>
                      <ul className="mt-1 text-sm text-orange-700">
                        {resultForm.componentResults
                          .filter(c => c.flag && c.flag !== 'normal' && c.value)
                          .map((c, i) => (
                            <li key={i}>
                              • {c.name}: {c.value} {c.unit} (
                              {c.flag === 'critical_high'
                                ? 'CRITIQUE ÉLEVÉ'
                                : c.flag === 'critical_low'
                                ? 'CRITIQUE BAS'
                                : c.flag === 'high'
                                ? 'Élevé'
                                : 'Bas'}
                              )
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Commentaires
            </label>
            <textarea
              className="input"
              rows="3"
              value={resultForm.notes}
              onChange={(e) => setResultForm({ ...resultForm, notes: e.target.value })}
              placeholder="Commentaires techniques..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Enregistrer les résultats'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

LabResultEntry.propTypes = {
  order: PropTypes.shape({
    _id: PropTypes.string,
    testName: PropTypes.string,
    testCode: PropTypes.string,
    templateId: PropTypes.string,
    patient: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        _id: PropTypes.string,
        firstName: PropTypes.string,
        lastName: PropTypes.string
      })
    ])
  }),
  templates: PropTypes.array,
  patients: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  submitting: PropTypes.bool
};

export default LabResultEntry;
