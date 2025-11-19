import { useState, useEffect } from 'react';
import {
  GitCompare,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';
import ophthalmologyService from '../services/ophthalmologyService';
import { calculateSE } from '../utils/ophthalmologyCalculations';

/**
 * RefractionComparisonView - Side-by-side comparison of current vs previous refraction data
 * Similar to Fermer's historical comparison feature
 */
export default function RefractionComparisonView({
  patientId,
  currentExam = null,
  showKeratometry = true,
  showVisualAcuity = true,
  compact = false
}) {
  const [previousExams, setPreviousExams] = useState([]);
  const [selectedPreviousIndex, setSelectedPreviousIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    if (patientId) {
      fetchPreviousExams();
    }
  }, [patientId]);

  const fetchPreviousExams = async () => {
    try {
      setLoading(true);
      const response = await ophthalmologyService.getPatientExams(patientId, { limit: 5 });
      const exams = response.data || response || [];
      // Filter out current exam if it exists in the list
      const filtered = currentExam?._id
        ? exams.filter(e => e._id !== currentExam._id)
        : exams;
      setPreviousExams(filtered);
    } catch (error) {
      console.error('Error fetching previous exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const previousExam = previousExams[selectedPreviousIndex];

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateChange = (current, previous) => {
    if (current == null || previous == null) return null;
    const diff = current - previous;
    return diff;
  };

  const getChangeIndicator = (diff, isNegativeBetter = false) => {
    if (diff == null || Math.abs(diff) < 0.125) {
      return { icon: Minus, color: 'text-gray-400', label: 'Stable' };
    }

    const isImproved = isNegativeBetter ? diff < 0 : diff > 0;

    if (Math.abs(diff) >= 0.5) {
      return isImproved
        ? { icon: TrendingUp, color: 'text-green-600', label: 'Amélioré' }
        : { icon: TrendingDown, color: 'text-red-600', label: 'Dégradé' };
    }

    return { icon: Minus, color: 'text-yellow-500', label: 'Légère variation' };
  };

  const RefractionRow = ({ label, currentOD, currentOS, previousOD, previousOS, unit = '', isNegativeBetter = false }) => {
    const odChange = calculateChange(currentOD, previousOD);
    const osChange = calculateChange(currentOS, previousOS);
    const odIndicator = getChangeIndicator(odChange, isNegativeBetter);
    const osIndicator = getChangeIndicator(osChange, isNegativeBetter);

    return (
      <tr className="border-b border-gray-100">
        <td className="py-2 px-3 font-medium text-gray-700">{label}</td>
        <td className="py-2 px-3 text-center">
          <span className="text-gray-500">{previousOD != null ? `${previousOD}${unit}` : '-'}</span>
        </td>
        <td className="py-2 px-3 text-center font-medium">
          {currentOD != null ? `${currentOD}${unit}` : '-'}
        </td>
        <td className="py-2 px-3 text-center">
          {odChange != null && (
            <span className={`inline-flex items-center ${odIndicator.color}`}>
              <odIndicator.icon className="w-3 h-3 mr-1" />
              {odChange > 0 ? '+' : ''}{odChange.toFixed(2)}
            </span>
          )}
        </td>
        <td className="py-2 px-3 text-center">
          <span className="text-gray-500">{previousOS != null ? `${previousOS}${unit}` : '-'}</span>
        </td>
        <td className="py-2 px-3 text-center font-medium">
          {currentOS != null ? `${currentOS}${unit}` : '-'}
        </td>
        <td className="py-2 px-3 text-center">
          {osChange != null && (
            <span className={`inline-flex items-center ${osIndicator.color}`}>
              <osIndicator.icon className="w-3 h-3 mr-1" />
              {osChange > 0 ? '+' : ''}{osChange.toFixed(2)}
            </span>
          )}
        </td>
      </tr>
    );
  };

  if (!patientId) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (previousExams.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
        <GitCompare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>Aucun examen précédent disponible pour comparaison</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <GitCompare className="w-5 h-5 mr-2 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Comparaison Réfractive</h3>
        </div>
        <div className="flex items-center gap-4">
          {previousExams.length > 1 && (
            <select
              value={selectedPreviousIndex}
              onChange={(e) => setSelectedPreviousIndex(parseInt(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              {previousExams.map((exam, index) => (
                <option key={exam._id} value={index}>
                  {formatDate(exam.examDate || exam.createdAt)}
                </option>
              ))}
            </select>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && previousExam && (
        <div className="p-4">
          {/* Date Headers */}
          <div className="flex justify-between mb-4 text-sm">
            <div className="flex items-center text-gray-500">
              <Calendar className="w-4 h-4 mr-1" />
              Précédent: {formatDate(previousExam.examDate || previousExam.createdAt)}
            </div>
            {currentExam && (
              <div className="flex items-center text-blue-600 font-medium">
                <Calendar className="w-4 h-4 mr-1" />
                Actuel: {formatDate(currentExam.examDate || currentExam.createdAt || new Date())}
              </div>
            )}
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-3 text-left"></th>
                  <th colSpan="3" className="py-2 px-3 text-center border-l border-gray-200">
                    <div className="flex items-center justify-center">
                      <Eye className="w-4 h-4 mr-1 text-blue-600" />
                      OD (Droit)
                    </div>
                  </th>
                  <th colSpan="3" className="py-2 px-3 text-center border-l border-gray-200">
                    <div className="flex items-center justify-center">
                      <Eye className="w-4 h-4 mr-1 text-blue-600" />
                      OS (Gauche)
                    </div>
                  </th>
                </tr>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="py-1 px-3"></th>
                  <th className="py-1 px-3 text-center border-l border-gray-200">Préc.</th>
                  <th className="py-1 px-3 text-center">Act.</th>
                  <th className="py-1 px-3 text-center">Diff.</th>
                  <th className="py-1 px-3 text-center border-l border-gray-200">Préc.</th>
                  <th className="py-1 px-3 text-center">Act.</th>
                  <th className="py-1 px-3 text-center">Diff.</th>
                </tr>
              </thead>
              <tbody>
                {/* Visual Acuity */}
                {showVisualAcuity && (
                  <>
                    <tr className="bg-blue-50">
                      <td colSpan="7" className="py-2 px-3 font-medium text-blue-800">
                        Acuité Visuelle
                      </td>
                    </tr>
                    <RefractionRow
                      label="AV Sans Correction"
                      currentOD={currentExam?.visualAcuity?.OD?.uncorrected}
                      currentOS={currentExam?.visualAcuity?.OS?.uncorrected}
                      previousOD={previousExam?.visualAcuity?.OD?.uncorrected}
                      previousOS={previousExam?.visualAcuity?.OS?.uncorrected}
                    />
                    <RefractionRow
                      label="AV Avec Correction"
                      currentOD={currentExam?.visualAcuity?.OD?.corrected}
                      currentOS={currentExam?.visualAcuity?.OS?.corrected}
                      previousOD={previousExam?.visualAcuity?.OD?.corrected}
                      previousOS={previousExam?.visualAcuity?.OS?.corrected}
                    />
                  </>
                )}

                {/* Objective Refraction */}
                <tr className="bg-amber-50">
                  <td colSpan="7" className="py-2 px-3 font-medium text-amber-800">
                    Réfraction Objective
                  </td>
                </tr>
                <RefractionRow
                  label="Sphère"
                  currentOD={currentExam?.objectiveRefraction?.OD?.sphere}
                  currentOS={currentExam?.objectiveRefraction?.OS?.sphere}
                  previousOD={previousExam?.objectiveRefraction?.OD?.sphere}
                  previousOS={previousExam?.objectiveRefraction?.OS?.sphere}
                  unit="D"
                  isNegativeBetter={true}
                />
                <RefractionRow
                  label="Cylindre"
                  currentOD={currentExam?.objectiveRefraction?.OD?.cylinder}
                  currentOS={currentExam?.objectiveRefraction?.OS?.cylinder}
                  previousOD={previousExam?.objectiveRefraction?.OD?.cylinder}
                  previousOS={previousExam?.objectiveRefraction?.OS?.cylinder}
                  unit="D"
                />
                <RefractionRow
                  label="Axe"
                  currentOD={currentExam?.objectiveRefraction?.OD?.axis}
                  currentOS={currentExam?.objectiveRefraction?.OS?.axis}
                  previousOD={previousExam?.objectiveRefraction?.OD?.axis}
                  previousOS={previousExam?.objectiveRefraction?.OS?.axis}
                  unit="°"
                />
                <RefractionRow
                  label="Éq. Sphérique"
                  currentOD={currentExam?.objectiveRefraction?.OD ?
                    parseFloat(calculateSE(currentExam.objectiveRefraction.OD.sphere, currentExam.objectiveRefraction.OD.cylinder)) : null}
                  currentOS={currentExam?.objectiveRefraction?.OS ?
                    parseFloat(calculateSE(currentExam.objectiveRefraction.OS.sphere, currentExam.objectiveRefraction.OS.cylinder)) : null}
                  previousOD={previousExam?.objectiveRefraction?.OD ?
                    parseFloat(calculateSE(previousExam.objectiveRefraction.OD.sphere, previousExam.objectiveRefraction.OD.cylinder)) : null}
                  previousOS={previousExam?.objectiveRefraction?.OS ?
                    parseFloat(calculateSE(previousExam.objectiveRefraction.OS.sphere, previousExam.objectiveRefraction.OS.cylinder)) : null}
                  unit="D"
                  isNegativeBetter={true}
                />

                {/* Subjective Refraction */}
                <tr className="bg-green-50">
                  <td colSpan="7" className="py-2 px-3 font-medium text-green-800">
                    Réfraction Subjective
                  </td>
                </tr>
                <RefractionRow
                  label="Sphère"
                  currentOD={currentExam?.subjectiveRefraction?.OD?.sphere}
                  currentOS={currentExam?.subjectiveRefraction?.OS?.sphere}
                  previousOD={previousExam?.subjectiveRefraction?.OD?.sphere}
                  previousOS={previousExam?.subjectiveRefraction?.OS?.sphere}
                  unit="D"
                  isNegativeBetter={true}
                />
                <RefractionRow
                  label="Cylindre"
                  currentOD={currentExam?.subjectiveRefraction?.OD?.cylinder}
                  currentOS={currentExam?.subjectiveRefraction?.OS?.cylinder}
                  previousOD={previousExam?.subjectiveRefraction?.OD?.cylinder}
                  previousOS={previousExam?.subjectiveRefraction?.OS?.cylinder}
                  unit="D"
                />
                <RefractionRow
                  label="Axe"
                  currentOD={currentExam?.subjectiveRefraction?.OD?.axis}
                  currentOS={currentExam?.subjectiveRefraction?.OS?.axis}
                  previousOD={previousExam?.subjectiveRefraction?.OD?.axis}
                  previousOS={previousExam?.subjectiveRefraction?.OS?.axis}
                  unit="°"
                />
                <RefractionRow
                  label="Addition"
                  currentOD={currentExam?.subjectiveRefraction?.OD?.add}
                  currentOS={currentExam?.subjectiveRefraction?.OS?.add}
                  previousOD={previousExam?.subjectiveRefraction?.OD?.add}
                  previousOS={previousExam?.subjectiveRefraction?.OS?.add}
                  unit="D"
                />

                {/* Keratometry */}
                {showKeratometry && (
                  <>
                    <tr className="bg-purple-50">
                      <td colSpan="7" className="py-2 px-3 font-medium text-purple-800">
                        <div className="flex items-center">
                          <Activity className="w-4 h-4 mr-1" />
                          Kératométrie
                        </div>
                      </td>
                    </tr>
                    <RefractionRow
                      label="K1 (Plat)"
                      currentOD={currentExam?.keratometry?.OD?.k1?.power}
                      currentOS={currentExam?.keratometry?.OS?.k1?.power}
                      previousOD={previousExam?.keratometry?.OD?.k1?.power}
                      previousOS={previousExam?.keratometry?.OS?.k1?.power}
                      unit="D"
                    />
                    <RefractionRow
                      label="K2 (Cambré)"
                      currentOD={currentExam?.keratometry?.OD?.k2?.power}
                      currentOS={currentExam?.keratometry?.OS?.k2?.power}
                      previousOD={previousExam?.keratometry?.OD?.k2?.power}
                      previousOS={previousExam?.keratometry?.OS?.k2?.power}
                      unit="D"
                    />
                    <RefractionRow
                      label="Astigmatisme"
                      currentOD={currentExam?.keratometry?.OD?.astigmatism ? parseFloat(currentExam.keratometry.OD.astigmatism) : null}
                      currentOS={currentExam?.keratometry?.OS?.astigmatism ? parseFloat(currentExam.keratometry.OS.astigmatism) : null}
                      previousOD={previousExam?.keratometry?.OD?.astigmatism ? parseFloat(previousExam.keratometry.OD.astigmatism) : null}
                      previousOS={previousExam?.keratometry?.OS?.astigmatism ? parseFloat(previousExam.keratometry.OS.astigmatism) : null}
                      unit="D"
                    />
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs text-gray-500">
            <div className="flex items-center">
              <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
              Amélioration
            </div>
            <div className="flex items-center">
              <Minus className="w-3 h-3 mr-1 text-gray-400" />
              Stable
            </div>
            <div className="flex items-center">
              <TrendingDown className="w-3 h-3 mr-1 text-red-600" />
              Dégradation
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for sidebar or modal use
 */
export function CompactRefractionComparison({ patientId, currentExam }) {
  return (
    <RefractionComparisonView
      patientId={patientId}
      currentExam={currentExam}
      showKeratometry={false}
      showVisualAcuity={false}
      compact={true}
    />
  );
}
