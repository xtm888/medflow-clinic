/**
 * OrthopticSummaryCard
 *
 * Displays a summary of the patient's latest orthoptic examination
 * within the ophthalmology consultation dashboard.
 * Read-only view with link to full orthoptic records.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ExternalLink, Plus, Calendar, AlertCircle, Activity } from 'lucide-react';
import orthopticService from '../services/orthopticService';

export default function OrthopticSummaryCard({ patientId, className = '' }) {
  const navigate = useNavigate();
  const [latestExam, setLatestExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (patientId) {
      fetchLatestExam();
    }
  }, [patientId]);

  const fetchLatestExam = async () => {
    try {
      setLoading(true);
      const response = await orthopticService.getLatestExam(patientId);
      setLatestExam(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching latest orthoptic exam:', err);
      setError(null); // Don't show error, just show "no exams"
      setLatestExam(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-blue-100 text-blue-800',
      'reviewed': 'bg-purple-100 text-purple-800',
      'signed': 'bg-green-100 text-green-800'
    };

    const statusLabels = {
      'in-progress': 'En cours',
      'completed': 'Terminé',
      'reviewed': 'Révisé',
      'signed': 'Signé'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-5 w-5 text-indigo-600" />
          <h3 className="font-medium text-gray-900">Bilan Orthoptique</h3>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-indigo-600" />
          <h3 className="font-medium text-gray-900">Bilan Orthoptique</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/orthoptic/new?patientId=${patientId}`)}
            className="text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
            title="Nouveau bilan orthoptique"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate(`/orthoptic?patientId=${patientId}`)}
            className="text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
            title="Voir tous les examens"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!latestExam ? (
        <div className="text-center py-6">
          <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Aucun examen orthoptique enregistré</p>
          <button
            onClick={() => navigate(`/orthoptic/new?patientId=${patientId}`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Créer un bilan orthoptique
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Exam Info */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Dernier examen:</span>
              <span className="font-medium">{formatDate(latestExam.examDate)}</span>
            </div>
            {getStatusBadge(latestExam.status)}
          </div>

          {/* Key Findings */}
          <div className="grid grid-cols-2 gap-3">
            {/* Cover Test */}
            {latestExam.coverTest && (
              <div className="bg-gray-50 rounded p-2">
                <div className="text-xs text-gray-500 mb-1">Cover Test</div>
                <div className="text-sm font-medium text-gray-900">
                  VL: {latestExam.coverTest?.farDeviation || '-'}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  VP: {latestExam.coverTest?.nearDeviation || '-'}
                </div>
              </div>
            )}

            {/* Convergence */}
            {latestExam.convergence && (
              <div className="bg-gray-50 rounded p-2">
                <div className="text-xs text-gray-500 mb-1">Convergence</div>
                <div className="text-sm font-medium text-gray-900">
                  PPC: {latestExam.convergence?.nearPoint || '-'}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  Qualité: {latestExam.convergence?.quality || '-'}
                </div>
              </div>
            )}

            {/* Stereopsis */}
            {latestExam.stereopsis && (
              <div className="bg-gray-50 rounded p-2">
                <div className="text-xs text-gray-500 mb-1">Stéréopsie</div>
                <div className="text-sm font-medium text-gray-900">
                  {latestExam.stereopsis?.wirtTest || latestExam.stereopsis?.langTest || '-'}
                </div>
              </div>
            )}

            {/* Motility */}
            {latestExam.motility && (
              <div className="bg-gray-50 rounded p-2">
                <div className="text-xs text-gray-500 mb-1">Motilité</div>
                <div className="text-sm font-medium text-gray-900">
                  {latestExam.motility?.overall || 'Normal'}
                </div>
              </div>
            )}
          </div>

          {/* Diagnosis/Conclusion */}
          {latestExam.diagnosis && (
            <div className="bg-indigo-50 rounded p-2 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-indigo-600" />
                <div className="text-xs font-medium text-indigo-700">Diagnostic</div>
              </div>
              <div className="text-sm text-indigo-900">
                {latestExam.diagnosis?.conclusion || '-'}
              </div>
            </div>
          )}

          {/* Treatment Plan */}
          {latestExam.treatmentPlan && (
            <div className="bg-green-50 rounded p-2 border border-green-100">
              <div className="text-xs font-medium text-green-700 mb-1">Plan de traitement</div>
              <div className="text-sm text-green-900">
                {latestExam.treatmentPlan?.type || '-'}
                {latestExam.treatmentPlan?.sessionInfo && (
                  <span className="text-xs text-green-600 ml-2">
                    ({latestExam.treatmentPlan.sessionInfo.completed || 0}/{latestExam.treatmentPlan.sessionInfo.total || 0} séances)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* View Full Button */}
          <button
            onClick={() => navigate(`/orthoptic/${latestExam._id}`)}
            className="w-full mt-2 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center justify-center gap-2 hover:bg-indigo-50 rounded transition-colors"
          >
            Voir le bilan complet
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
