/**
 * MedicationScheduleGenerator - Patient-friendly medication schedule
 *
 * StudioVision Parity: Printable daily medication schedule for compliance
 *
 * Features:
 * - Organizes medications by time of day
 * - Visual timeline format
 * - Includes wait time between drops
 * - Bilingual (French/English) support
 * - Print-optimized layout
 * - PDF download functionality
 *
 * Usage:
 * <MedicationScheduleGenerator
 *   medications={prescriptionMedications}
 *   patient={patientData}
 *   prescriber={prescriberData}
 * />
 */

import React, { useMemo, useRef, useState } from 'react';
import { Printer, Download, Clock, Sun, Moon, AlertTriangle, Phone, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import prescriptionService from '../../services/prescriptionService';

// Time slot configuration
const TIME_SLOTS = [
  { key: 'morning', label: 'MATIN', labelEn: 'MORNING', time: '8h00', icon: '☀️', color: 'yellow' },
  { key: 'noon', label: 'MIDI', labelEn: 'NOON', time: '12h00', icon: '☀️', color: 'orange' },
  { key: 'afternoon', label: 'APRÈS-MIDI', labelEn: 'AFTERNOON', time: '15h00', icon: '🌆', color: 'amber' },
  { key: 'evening', label: 'SOIR', labelEn: 'EVENING', time: '18h00', icon: '🌆', color: 'purple' },
  { key: 'bedtime', label: 'COUCHER', labelEn: 'BEDTIME', time: '22h00', icon: '🌙', color: 'blue' }
];

// Frequency to time slots mapping
const FREQUENCY_TO_SLOTS = {
  'QD': ['morning'],
  'BID': ['morning', 'evening'],
  'TID': ['morning', 'noon', 'evening'],
  'QID': ['morning', 'noon', 'afternoon', 'evening'],
  'Q4H': ['morning', 'noon', 'afternoon', 'evening', 'bedtime'],
  'Q6H': ['morning', 'noon', 'evening', 'bedtime'],
  'QHS': ['bedtime'],
  'PRN': ['morning'] // As needed - show once with note
};

// Eye labels
const EYE_LABELS = {
  'OD': 'œil droit / right eye',
  'OS': 'œil gauche / left eye',
  'OU': 'les deux yeux / both eyes'
};

// Color mappings for Tailwind
const COLOR_CLASSES = {
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }
};

export default function MedicationScheduleGenerator({
  medications = [],
  patient,
  prescriber,
  clinicInfo,
  prescriptionId,
  showPrintButton = true,
  compact = false
}) {
  const scheduleRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Organize medications by time slot
  const scheduleByTimeSlot = useMemo(() => {
    const schedule = {};

    TIME_SLOTS.forEach(slot => {
      schedule[slot.key] = [];
    });

    medications.forEach((med, medIdx) => {
      const frequencyCode = med.frequencyCode || med.frequency || 'BID';
      const slots = FREQUENCY_TO_SLOTS[frequencyCode.toUpperCase()] || ['morning', 'evening'];

      slots.forEach((slotKey, slotIdx) => {
        schedule[slotKey].push({
          ...med,
          order: medIdx,
          isFirst: slotIdx === 0,
          needsWait: slotIdx > 0 || medIdx > 0
        });
      });
    });

    return schedule;
  }, [medications]);

  // Handle print
  const handlePrint = () => {
    const printContent = scheduleRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Programme de Gouttes - ${patient?.firstName} ${patient?.lastName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .patient-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .time-slot {
              margin-bottom: 20px;
              border: 1px solid #ddd;
              border-radius: 8px;
              overflow: hidden;
            }
            .time-slot-header {
              background: #f5f5f5;
              padding: 10px;
              font-weight: bold;
              border-bottom: 1px solid #ddd;
            }
            .medication {
              padding: 10px;
              border-bottom: 1px solid #eee;
            }
            .medication:last-child {
              border-bottom: none;
            }
            .wait-notice {
              color: #666;
              font-style: italic;
              font-size: 0.9em;
              padding: 5px 10px;
              background: #fffbeb;
            }
            .reminders {
              margin-top: 20px;
              padding: 15px;
              background: #fff7ed;
              border-radius: 8px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 0.9em;
              color: #666;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!prescriptionId) {
      // Generate PDF from HTML if no prescription ID
      handlePrint();
      return;
    }

    setDownloading(true);
    try {
      const response = await prescriptionService.generateSchedulePDF(prescriptionId);

      if (response?.data) {
        // Create blob and download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `programme-gouttes-${patient?.lastName || 'patient'}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('PDF téléchargé');
      } else {
        // Fallback to print
        handlePrint();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to print
      toast.info('Utilisation de l\'impression comme alternative');
      handlePrint();
    } finally {
      setDownloading(false);
    }
  };

  // Check if there are any medications
  if (medications.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Aucun médicament pour générer un programme</p>
      </div>
    );
  }

  return (
    <div>
      {/* Action buttons */}
      {showPrintButton && (
        <div className="flex justify-end mb-3 gap-2 no-print">
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Télécharger PDF
          </button>
        </div>
      )}

      {/* Printable schedule */}
      <div
        ref={scheduleRef}
        className="border border-gray-200 rounded-lg overflow-hidden bg-white"
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 text-center">
          <h2 className="text-xl font-bold">
            VOTRE PROGRAMME DE GOUTTES
          </h2>
          <p className="text-md">
            YOUR EYE DROP SCHEDULE
          </p>
        </div>

        {/* Patient & Prescriber Info */}
        <div className="flex p-4 bg-gray-50 justify-between flex-wrap">
          <div>
            <p className="font-bold">
              Patient: {patient?.firstName} {patient?.lastName}
            </p>
            {patient?.dateOfBirth && (
              <p className="text-sm text-gray-600">
                Né(e) le: {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-bold">
              Date: {new Date().toLocaleDateString('fr-FR')}
            </p>
            {prescriber && (
              <p className="text-sm text-gray-600">
                Dr. {prescriber.firstName} {prescriber.lastName}
              </p>
            )}
            {clinicInfo?.phone && (
              <p className="text-sm text-gray-600">
                Tél: {clinicInfo.phone}
              </p>
            )}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Time Slots */}
        <div className="flex flex-col">
          {TIME_SLOTS.map((slot) => {
            const slotMeds = scheduleByTimeSlot[slot.key];
            if (slotMeds.length === 0) return null;

            const colors = COLOR_CLASSES[slot.color] || COLOR_CLASSES.blue;

            return (
              <div key={slot.key}>
                {/* Time slot header */}
                <div
                  className={`flex p-3 items-center border-b ${colors.bg} ${colors.border}`}
                >
                  <span className="text-xl mr-2">{slot.icon}</span>
                  <div>
                    <p className={`font-bold ${colors.text}`}>
                      {slot.label} ({slot.time})
                    </p>
                    <p className="text-xs text-gray-500">
                      {slot.labelEn}
                    </p>
                  </div>
                </div>

                {/* Medications for this slot */}
                <div className="flex flex-col">
                  {slotMeds.map((med, idx) => (
                    <React.Fragment key={`${med.name || med.drugName}-${idx}`}>
                      {/* Wait notice between medications */}
                      {idx > 0 && (
                        <div className="flex p-2 bg-yellow-50 items-center justify-center border-b border-yellow-200">
                          <Clock className="w-4 h-4 mr-2 text-yellow-600" />
                          <span className="text-sm text-yellow-700 italic">
                            ⏳ Attendre {med.waitTimeAfter || 5} minutes / Wait {med.waitTimeAfter || 5} minutes
                          </span>
                        </div>
                      )}

                      {/* Medication */}
                      <div className="flex p-3 items-center border-b border-gray-100 hover:bg-gray-50">
                        <span className="text-xl mr-3">💧</span>
                        <div className="flex-1">
                          <p className="font-medium">
                            {med.name || med.drugName}
                          </p>
                          <p className="text-sm text-gray-600">
                            1 goutte {EYE_LABELS[med.eye] || EYE_LABELS['OU']}
                          </p>
                          {med.instructions && (
                            <p className="text-xs text-gray-500 italic">
                              {med.instructions}
                            </p>
                          )}
                        </div>
                        {med.taper?.enabled && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                            Décroissance
                          </span>
                        )}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <hr className="border-gray-200" />

        {/* Important Reminders */}
        <div className="p-4 bg-orange-50">
          <p className="font-bold text-orange-700 mb-2 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2" />
            RAPPELS IMPORTANTS / IMPORTANT REMINDERS:
          </p>
          <ul className="space-y-1 text-sm">
            <li>• Attendre 5 minutes entre chaque goutte / Wait 5 minutes between drops</li>
            <li>• Ne pas toucher l'embout du flacon / Don't touch the bottle tip</li>
            <li>• Fermer les yeux 2 minutes après chaque goutte / Close eyes for 2 minutes after each drop</li>
            <li>• Appuyer légèrement sur le coin interne de l'œil / Gently press inner corner of eye</li>
          </ul>
        </div>

        {/* Emergency Contact */}
        {clinicInfo?.phone && (
          <div className="p-3 bg-blue-50 text-center">
            <p className="font-bold text-blue-700 flex items-center justify-center">
              <Phone className="w-4 h-4 mr-2" />
              En cas de problème / If problems occur: {clinicInfo.phone}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Généré par MedFlow - {new Date().toLocaleString('fr-FR')}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact schedule preview for prescription summary
 */
export function MedicationSchedulePreview({ medications = [] }) {
  const slotCounts = useMemo(() => {
    const counts = {};
    TIME_SLOTS.forEach(slot => counts[slot.key] = 0);

    medications.forEach(med => {
      const frequencyCode = med.frequencyCode || med.frequency || 'BID';
      const slots = FREQUENCY_TO_SLOTS[frequencyCode.toUpperCase()] || ['morning', 'evening'];
      slots.forEach(slotKey => counts[slotKey]++);
    });

    return counts;
  }, [medications]);

  const COLOR_BADGE = {
    yellow: 'bg-yellow-100 text-yellow-700',
    orange: 'bg-orange-100 text-orange-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700'
  };

  return (
    <div className="flex flex-wrap gap-2">
      {TIME_SLOTS.map(slot => {
        const count = slotCounts[slot.key];
        if (count === 0) return null;

        return (
          <span
            key={slot.key}
            className={`px-2 py-1 rounded text-sm ${COLOR_BADGE[slot.color] || COLOR_BADGE.blue}`}
          >
            {slot.icon} {slot.label}: {count}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Taper schedule display for steroid protocols
 */
export function TaperScheduleDisplay({ taper, medicationName }) {
  if (!taper?.enabled || !taper?.schedule?.length) return null;

  return (
    <div className="mt-2 p-2 bg-purple-50 rounded-md">
      <p className="font-medium text-sm text-purple-700 mb-1">
        Programme de décroissance - {medicationName}
      </p>
      <div className="space-y-1">
        {taper.schedule.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 border border-purple-300 text-purple-700 rounded">
              Semaine {step.week || idx + 1}
            </span>
            <span>{step.frequency}</span>
            {step.instructions && (
              <span className="text-gray-500">({step.instructions})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
