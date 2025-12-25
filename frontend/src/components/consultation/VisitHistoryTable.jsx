/**
 * VisitHistoryTable - Rich visit history table matching StudioVision XP (oph1.jpg)
 *
 * Columns:
 * - Date: Visit date (DD/MM/YYYY format)
 * - Description: Consultation type (Lunettes, Cataracte, Diabète, etc.)
 * - Dominante: Which eye was primary focus (OD/OS/OU)
 * - Dr: Examiner initials
 * - Image: Icon if imaging attached (click to view)
 * - Texte: Icon if documents attached (click to view)
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Camera,
  FileText,
  ChevronDown,
  ChevronUp,
  Eye,
  Glasses,
  Activity,
  Pill,
  Stethoscope
} from 'lucide-react';

// Map consultation types to icons
const getTypeIcon = (type) => {
  const typeMap = {
    lunettes: Glasses,
    refraction: Glasses,
    glasses: Glasses,
    consultation: Stethoscope,
    examen: Eye,
    suivi: Activity,
    controle: Activity,
    traitement: Pill,
    treatment: Pill,
    surgery: Activity,
    chirurgie: Activity,
  };

  const normalizedType = type?.toLowerCase() || '';
  for (const [key, Icon] of Object.entries(typeMap)) {
    if (normalizedType.includes(key)) {
      return Icon;
    }
  }
  return Stethoscope;
};

// Format laterality display
const formatLaterality = (laterality) => {
  if (!laterality) return '-';
  const lat = laterality.toUpperCase();
  if (lat === 'OD' || lat === 'RIGHT') return 'OD';
  if (lat === 'OS' || lat === 'LEFT' || lat === 'OG') return 'OG';
  if (lat === 'OU' || lat === 'BOTH') return 'OU';
  return lat;
};

// Format doctor name to initials
const formatDoctorInitials = (doctor) => {
  if (!doctor) return '-';
  if (typeof doctor === 'object') {
    const name = doctor.name || doctor.lastName || '';
    return name.substring(0, 3).toLowerCase();
  }
  return doctor.substring(0, 3).toLowerCase();
};

function VisitRow({ visit, onSelect, onViewImages, onViewDocuments }) {
  const [expanded, setExpanded] = useState(false);

  const TypeIcon = getTypeIcon(visit.type || visit.reason);
  const hasImages = visit.hasImages || visit.imagingCount > 0 || visit.images?.length > 0;
  const hasDocuments = visit.hasDocuments || visit.documentCount > 0 || visit.documents?.length > 0;

  return (
    <>
      <tr
        className="hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100"
        onClick={() => onSelect?.(visit)}
      >
        {/* Date */}
        <td className="px-2 py-1.5 text-sm text-gray-900 whitespace-nowrap">
          {visit.date || visit.visitDate || visit.createdAt
            ? format(new Date(visit.date || visit.visitDate || visit.createdAt), 'dd/MM/yyyy')
            : '-'}
        </td>

        {/* Description with icon */}
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <TypeIcon className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm text-gray-700 truncate max-w-[120px]">
              {visit.description || visit.type || visit.reason || visit.chiefComplaint || 'Consultation'}
            </span>
          </div>
        </td>

        {/* Dominante (OD/OS/OU) */}
        <td className="px-2 py-1.5 text-center">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            formatLaterality(visit.dominantEye || visit.laterality) === 'OD'
              ? 'bg-blue-100 text-blue-700'
              : formatLaterality(visit.dominantEye || visit.laterality) === 'OG'
              ? 'bg-green-100 text-green-700'
              : formatLaterality(visit.dominantEye || visit.laterality) === 'OU'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {formatLaterality(visit.dominantEye || visit.laterality)}
          </span>
        </td>

        {/* Doctor initials */}
        <td className="px-2 py-1.5 text-center text-sm text-gray-600">
          {formatDoctorInitials(visit.doctor || visit.provider || visit.examiner)}
        </td>

        {/* Image icon */}
        <td className="px-2 py-1.5 text-center">
          {hasImages ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewImages?.(visit);
              }}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title="Voir les images"
            >
              <Camera className="w-4 h-4 text-blue-600" />
            </button>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* Document icon */}
        <td className="px-2 py-1.5 text-center">
          {hasDocuments ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDocuments?.(visit);
              }}
              className="p-1 hover:bg-green-100 rounded transition-colors"
              title="Voir les documents"
            >
              <FileText className="w-4 h-4 text-green-600" />
            </button>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* Expand button */}
        <td className="px-1 py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        </td>
      </tr>

      {/* Expanded details row */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-4 py-2">
            <div className="text-xs text-gray-600 space-y-1">
              {visit.notes && (
                <p><span className="font-medium">Notes:</span> {visit.notes}</p>
              )}
              {visit.diagnoses?.length > 0 && (
                <p>
                  <span className="font-medium">Diagnostics:</span>{' '}
                  {visit.diagnoses.map(d => d.name || d.label || d).join(', ')}
                </p>
              )}
              {(visit.refraction?.OD || visit.refraction?.OS) && (
                <p>
                  <span className="font-medium">Réfraction:</span>{' '}
                  OD: {visit.refraction.OD?.sphere || '-'} / OG: {visit.refraction.OS?.sphere || '-'}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function VisitHistoryTable({
  visits = [],
  onSelectVisit,
  onViewImages,
  onViewDocuments,
  maxRows = 10,
  showHeader = true,
  className = ''
}) {
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  // Sort visits by date
  const sortedVisits = [...visits].sort((a, b) => {
    const dateA = new Date(a.date || a.visitDate || a.createdAt);
    const dateB = new Date(b.date || b.visitDate || b.createdAt);
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const displayedVisits = sortedVisits.slice(0, maxRows);

  return (
    <div className={`bg-white border border-gray-300 rounded-lg overflow-hidden ${className}`}>
      <table className="w-full text-sm">
        {showHeader && (
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th
                className="px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              >
                <div className="flex items-center gap-1">
                  Date
                  {sortOrder === 'desc' ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  )}
                </div>
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-700">Description</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-700">Dom.</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-700">Dr</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-700" title="Images">
                <Camera className="w-3.5 h-3.5 mx-auto text-gray-500" />
              </th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-700" title="Documents">
                <FileText className="w-3.5 h-3.5 mx-auto text-gray-500" />
              </th>
              <th className="w-6"></th>
            </tr>
          </thead>
        )}
        <tbody>
          {displayedVisits.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                Aucune consultation précédente
              </td>
            </tr>
          ) : (
            displayedVisits.map((visit, idx) => (
              <VisitRow
                key={visit._id || idx}
                visit={visit}
                onSelect={onSelectVisit}
                onViewImages={onViewImages}
                onViewDocuments={onViewDocuments}
              />
            ))
          )}
        </tbody>
      </table>

      {/* Show more indicator */}
      {visits.length > maxRows && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-center">
          <span className="text-xs text-gray-500">
            {visits.length - maxRows} consultation(s) supplémentaire(s)
          </span>
        </div>
      )}
    </div>
  );
}
