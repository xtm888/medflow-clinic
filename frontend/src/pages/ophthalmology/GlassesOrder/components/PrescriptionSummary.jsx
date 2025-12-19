/**
 * PrescriptionSummary Component
 *
 * Displays the exam prescription data.
 */

import { Eye } from 'lucide-react';

export default function PrescriptionSummary({ exam }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <Eye className="h-5 w-5 mr-2 text-blue-600" />
        Prescription
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
        <div>
          <p className="text-xs text-gray-500 mb-1">OD (Droit)</p>
          <p className="font-mono text-sm">
            Sph: {exam.finalPrescription?.od?.sphere || 0} |
            Cyl: {exam.finalPrescription?.od?.cylinder || 0} |
            Axe: {exam.finalPrescription?.od?.axis || 0}°
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">OS (Gauche)</p>
          <p className="font-mono text-sm">
            Sph: {exam.finalPrescription?.os?.sphere || 0} |
            Cyl: {exam.finalPrescription?.os?.cylinder || 0} |
            Axe: {exam.finalPrescription?.os?.axis || 0}°
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Addition</p>
          <p className="font-mono text-sm">
            {exam.finalPrescription?.od?.add || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">ÉP</p>
          <p className="font-mono text-sm">
            {exam.finalPrescription?.pd?.binocular || 'N/A'} mm
          </p>
        </div>
      </div>
    </div>
  );
}
