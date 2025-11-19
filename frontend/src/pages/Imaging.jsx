import { useState, useEffect } from 'react';
import { Image as ImageIcon, Eye, Download, ZoomIn, Loader2, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Imaging() {
  const navigate = useNavigate();
  const [imagingStudies, setImagingStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    fetchImagingStudies();
  }, []);

  const fetchImagingStudies = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch from ophthalmology exams API
      const response = await api.get('/ophthalmology/exams', {
        params: { limit: 50 }
      });

      const exams = response.data?.data || response.data || [];

      // Transform exams to imaging study format
      const studies = exams.map(exam => ({
        id: exam._id,
        patientName: exam.patient ? `${exam.patient.firstName} ${exam.patient.lastName}` : 'Patient',
        modality: exam.examType || 'OCT',
        status: exam.status === 'completed' ? 'COMPLETED' : 'IN_PROGRESS',
        description: exam.assessment?.summary || 'Examen ophtalmologique',
        studyDate: exam.createdAt,
        bodyPart: 'Yeux',
        images: exam.images?.length || 1,
        radiologist: exam.examiner ? `${exam.examiner.firstName} ${exam.examiner.lastName}` : 'N/A'
      }));

      setImagingStudies(studies);
    } catch (err) {
      console.error('Error fetching imaging studies:', err);
      setError('Erreur lors du chargement des examens d\'imagerie');
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudy = (study) => {
    setSelectedStudy(study);
    setShowViewer(true);
  };

  const handleDownloadStudy = async (study) => {
    try {
      // Try to get images from backend
      const response = await api.get(`/ophthalmology/exams/${study.id}/images`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${study.patientName}_${study.modality}_${new Date(study.studyDate).toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading study:', err);
      // Fallback: Show alert with study info
      alert(`Téléchargement non disponible pour cette étude.\n\nPatient: ${study.patientName}\nType: ${study.modality}\nDate: ${new Date(study.studyDate).toLocaleDateString('fr-FR')}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des examens...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Imagerie Médicale</h1>
          <p className="mt-1 text-sm text-gray-500">
            Visualisation et gestion des examens d'imagerie (DICOM)
          </p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button
            onClick={fetchImagingStudies}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Imagerie Médicale</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visualisation et gestion des examens d'imagerie (DICOM)
        </p>
      </div>

      {imagingStudies.length === 0 ? (
        <div className="card text-center py-12">
          <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Aucun examen d'imagerie trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {imagingStudies.map((study) => (
            <div key={study.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{study.patientName}</h3>
                    <span className="badge badge-info">{study.modality}</span>
                    <span className={`badge ${
                      study.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {study.status === 'COMPLETED' ? 'Complété' : 'En cours'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{study.description}</p>

                  <div className="grid grid-cols-4 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Date</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(study.studyDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Partie du corps</p>
                      <p className="text-sm font-semibold text-gray-900">{study.bodyPart}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Images</p>
                      <p className="text-sm font-semibold text-gray-900">{study.images}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Radiologue</p>
                      <p className="text-sm font-semibold text-gray-900">{study.radiologist}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 ml-4">
                  <button
                    onClick={() => handleViewStudy(study)}
                    className="btn btn-primary text-sm flex items-center space-x-1"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Voir</span>
                  </button>
                  <button
                    onClick={() => handleDownloadStudy(study)}
                    className="btn btn-secondary text-sm flex items-center space-x-1"
                  >
                    <Download className="h-4 w-4" />
                    <span>Télécharger</span>
                  </button>
                </div>
              </div>

              {/* Image Preview */}
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(Math.min(4, study.images))].map((_, idx) => (
                    <div
                      key={idx}
                      className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center cursor-pointer hover:ring-2 ring-primary-500 transition-all"
                    >
                      <ZoomIn className="h-8 w-8 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Viewer Modal */}
      {showViewer && selectedStudy && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedStudy.patientName} - {selectedStudy.modality}
                </h2>
                <p className="text-sm text-gray-600">
                  {new Date(selectedStudy.studyDate).toLocaleDateString('fr-FR')} · {selectedStudy.radiologist}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowViewer(false);
                  setSelectedStudy(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              {/* Study Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Type d'examen</p>
                    <p className="font-semibold text-gray-900">{selectedStudy.modality}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Partie du corps</p>
                    <p className="font-semibold text-gray-900">{selectedStudy.bodyPart}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Statut</p>
                    <p className="font-semibold text-gray-900">
                      {selectedStudy.status === 'COMPLETED' ? 'Complété' : 'En cours'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nombre d'images</p>
                    <p className="font-semibold text-gray-900">{selectedStudy.images}</p>
                  </div>
                </div>
                {selectedStudy.description && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-gray-500 text-sm">Description</p>
                    <p className="text-gray-900">{selectedStudy.description}</p>
                  </div>
                )}
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(Math.min(6, selectedStudy.images))].map((_, idx) => (
                  <div
                    key={idx}
                    className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center cursor-pointer hover:ring-2 ring-primary-500 transition-all"
                  >
                    <div className="text-center">
                      <ZoomIn className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Image {idx + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => handleDownloadStudy(selectedStudy)}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Télécharger</span>
              </button>
              <button
                onClick={() => navigate(`/ophthalmology/exam/${selectedStudy.id}`)}
                className="btn btn-primary"
              >
                Voir l'examen complet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
