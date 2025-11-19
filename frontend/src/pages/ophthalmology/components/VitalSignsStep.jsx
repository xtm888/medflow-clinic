/**
 * VitalSignsStep - Patient vital signs capture
 *
 * Captures:
 * - Blood pressure
 * - Heart rate
 * - Temperature
 * - Respiratory rate
 * - Oxygen saturation
 * - Weight/Height (for BMI)
 */

import { Activity, Heart, Thermometer, Wind, Droplet } from 'lucide-react';

const VITAL_RANGES = {
  bloodPressure: {
    systolic: { normal: [90, 120], warning: [121, 139], critical: [140, 180] },
    diastolic: { normal: [60, 80], warning: [81, 89], critical: [90, 120] }
  },
  heartRate: { normal: [60, 100], warning: [101, 120], critical: [121, 200] },
  temperature: { normal: [36.1, 37.2], warning: [37.3, 38.0], critical: [38.1, 42.0] },
  oxygenSaturation: { normal: [95, 100], warning: [90, 94], critical: [0, 89] }
};

export default function VitalSignsStep({ data = {}, onChange, readOnly = false }) {
  const vitals = {
    bloodPressure: data?.bloodPressure || '',
    heartRate: data?.heartRate || '',
    temperature: data?.temperature || '',
    respiratoryRate: data?.respiratoryRate || '',
    oxygenSaturation: data?.oxygenSaturation || '',
    weight: data?.weight || '',
    height: data?.height || ''
  };

  // Update parent with changes
  const updateField = (field, value) => {
    if (readOnly) return;
    onChange?.({
      ...vitals,
      [field]: value
    });
  };

  // Calculate BMI
  const calculateBMI = () => {
    if (!vitals.weight || !vitals.height) return null;
    const weight = parseFloat(vitals.weight);
    const height = parseFloat(vitals.height) / 100; // cm to m
    if (weight <= 0 || height <= 0) return null;
    return (weight / (height * height)).toFixed(1);
  };

  // Get status color for a vital value
  const getStatusColor = (value, type) => {
    if (!value) return 'text-gray-400';
    const num = parseFloat(value);
    if (isNaN(num)) return 'text-gray-600';

    if (type === 'bloodPressure') {
      const [systolic, diastolic] = value.split('/').map(v => parseInt(v));
      if (!systolic || !diastolic) return 'text-gray-600';

      const ranges = VITAL_RANGES.bloodPressure;
      if (systolic >= ranges.systolic.critical[0] || diastolic >= ranges.diastolic.critical[0]) {
        return 'text-red-600';
      }
      if (systolic >= ranges.systolic.warning[0] || diastolic >= ranges.diastolic.warning[0]) {
        return 'text-orange-600';
      }
      return 'text-green-600';
    }

    const ranges = VITAL_RANGES[type];
    if (!ranges) return 'text-gray-600';

    if (num >= ranges.critical[0] && num <= ranges.critical[1]) {
      return 'text-red-600';
    }
    if (num >= ranges.warning[0] && num <= ranges.warning[1]) {
      return 'text-orange-600';
    }
    if (num >= ranges.normal[0] && num <= ranges.normal[1]) {
      return 'text-green-600';
    }
    return 'text-gray-600';
  };

  const bmi = calculateBMI();
  const getBMIStatus = (bmi) => {
    if (!bmi) return null;
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: 'Insuffisance pondérale', color: 'text-blue-600' };
    if (val < 25) return { label: 'Normal', color: 'text-green-600' };
    if (val < 30) return { label: 'Surpoids', color: 'text-orange-600' };
    return { label: 'Obésité', color: 'text-red-600' };
  };
  const bmiStatus = getBMIStatus(bmi);

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Signes Vitaux</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blood Pressure */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Activity className="h-5 w-5 text-red-500 mr-2" />
            <label className="text-sm font-medium text-gray-700">
              Tension Artérielle
            </label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={vitals.bloodPressure}
              onChange={(e) => updateField('bloodPressure', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold ${getStatusColor(vitals.bloodPressure, 'bloodPressure')}`}
              placeholder="120/80"
              disabled={readOnly}
            />
            <span className="absolute right-3 top-2 text-sm text-gray-400">mmHg</span>
          </div>
        </div>

        {/* Heart Rate */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Heart className="h-5 w-5 text-pink-500 mr-2" />
            <label className="text-sm font-medium text-gray-700">
              Fréquence Cardiaque
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              value={vitals.heartRate}
              onChange={(e) => updateField('heartRate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold ${getStatusColor(vitals.heartRate, 'heartRate')}`}
              placeholder="72"
              disabled={readOnly}
            />
            <span className="absolute right-3 top-2 text-sm text-gray-400">bpm</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Thermometer className="h-5 w-5 text-orange-500 mr-2" />
            <label className="text-sm font-medium text-gray-700">
              Température
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={vitals.temperature}
              onChange={(e) => updateField('temperature', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold ${getStatusColor(vitals.temperature, 'temperature')}`}
              placeholder="37.0"
              disabled={readOnly}
            />
            <span className="absolute right-3 top-2 text-sm text-gray-400">°C</span>
          </div>
        </div>

        {/* Respiratory Rate */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Wind className="h-5 w-5 text-blue-500 mr-2" />
            <label className="text-sm font-medium text-gray-700">
              Fréquence Respiratoire
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              value={vitals.respiratoryRate}
              onChange={(e) => updateField('respiratoryRate', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold text-gray-600"
              placeholder="16"
              disabled={readOnly}
            />
            <span className="absolute right-3 top-2 text-sm text-gray-400">/min</span>
          </div>
        </div>

        {/* Oxygen Saturation */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Droplet className="h-5 w-5 text-cyan-500 mr-2" />
            <label className="text-sm font-medium text-gray-700">
              Saturation O₂
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              value={vitals.oxygenSaturation}
              onChange={(e) => updateField('oxygenSaturation', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold ${getStatusColor(vitals.oxygenSaturation, 'oxygenSaturation')}`}
              placeholder="98"
              disabled={readOnly}
            />
            <span className="absolute right-3 top-2 text-sm text-gray-400">%</span>
          </div>
        </div>
      </div>

      {/* Weight & Height */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Mesures Anthropométriques</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Poids</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={vitals.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="70"
                disabled={readOnly}
              />
              <span className="absolute right-3 top-2 text-sm text-gray-400">kg</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Taille</label>
            <div className="relative">
              <input
                type="number"
                value={vitals.height}
                onChange={(e) => updateField('height', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="170"
                disabled={readOnly}
              />
              <span className="absolute right-3 top-2 text-sm text-gray-400">cm</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">IMC</label>
            <div className="px-3 py-2 bg-gray-50 border rounded-lg">
              {bmi ? (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">{bmi}</span>
                  {bmiStatus && (
                    <span className={`text-xs ${bmiStatus.color}`}>
                      {bmiStatus.label}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick status summary */}
      {(vitals.bloodPressure || vitals.heartRate || vitals.oxygenSaturation) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Les valeurs en <span className="text-green-600 font-medium">vert</span> sont normales,
            en <span className="text-orange-600 font-medium">orange</span> nécessitent attention,
            en <span className="text-red-600 font-medium">rouge</span> sont critiques.
          </p>
        </div>
      )}
    </div>
  );
}
