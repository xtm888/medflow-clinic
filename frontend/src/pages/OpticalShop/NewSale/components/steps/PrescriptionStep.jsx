/**
 * PrescriptionStep Component
 *
 * Step 1: Prescription entry (OD/OS values and measurements).
 */

import { Eye } from 'lucide-react';

export default function PrescriptionStep({
  orderData,
  setOrderData,
  prescriptionData
}) {
  const updateRightLens = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      rightLens: { ...prev.rightLens, [field]: value }
    }));
  };

  const updateLeftLens = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      leftLens: { ...prev.leftLens, [field]: value }
    }));
  };

  const updateMeasurement = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      measurements: { ...prev.measurements, [field]: value }
    }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Prescription</h2>

      {/* Prescription source info */}
      {prescriptionData?.exam && (
        <div className="p-4 bg-blue-50 rounded-lg mb-4">
          <p className="text-sm text-blue-600">
            Prescription du {new Date(prescriptionData.exam.examDate).toLocaleDateString('fr-FR')}
            {prescriptionData.exam.performedBy &&
              ` par Dr. ${prescriptionData.exam.performedBy.firstName} ${prescriptionData.exam.performedBy.lastName}`
            }
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Right Eye (OD) */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" /> Oeil Droit (OD)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Sphere</label>
              <input
                type="number"
                step="0.25"
                value={orderData.rightLens.sphere}
                onChange={(e) => updateRightLens('sphere', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="-2.00"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cylindre</label>
              <input
                type="number"
                step="0.25"
                value={orderData.rightLens.cylinder}
                onChange={(e) => updateRightLens('cylinder', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="-0.50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Axe</label>
              <input
                type="number"
                value={orderData.rightLens.axis}
                onChange={(e) => updateRightLens('axis', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="180"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Addition</label>
              <input
                type="number"
                step="0.25"
                value={orderData.rightLens.add}
                onChange={(e) => updateRightLens('add', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="+2.00"
              />
            </div>
          </div>
        </div>

        {/* Left Eye (OS) */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" /> Oeil Gauche (OS)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Sphere</label>
              <input
                type="number"
                step="0.25"
                value={orderData.leftLens.sphere}
                onChange={(e) => updateLeftLens('sphere', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="-2.00"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cylindre</label>
              <input
                type="number"
                step="0.25"
                value={orderData.leftLens.cylinder}
                onChange={(e) => updateLeftLens('cylinder', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="-0.50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Axe</label>
              <input
                type="number"
                value={orderData.leftLens.axis}
                onChange={(e) => updateLeftLens('axis', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="180"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Addition</label>
              <input
                type="number"
                step="0.25"
                value={orderData.leftLens.add}
                onChange={(e) => updateLeftLens('add', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="+2.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Measurements */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">Mesures</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">PD Total *</label>
            <input
              type="number"
              value={orderData.measurements.pd}
              onChange={(e) => updateMeasurement('pd', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="64"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">PD Droit</label>
            <input
              type="number"
              value={orderData.measurements.pdRight}
              onChange={(e) => updateMeasurement('pdRight', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="32"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">PD Gauche</label>
            <input
              type="number"
              value={orderData.measurements.pdLeft}
              onChange={(e) => updateMeasurement('pdLeft', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="32"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hauteur Segment</label>
            <input
              type="number"
              value={orderData.measurements.segmentHeight}
              onChange={(e) => updateMeasurement('segmentHeight', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="18"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
