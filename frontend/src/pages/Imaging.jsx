import { Image as ImageIcon, Eye, Download, ZoomIn } from 'lucide-react';
import { imagingStudies } from '../data/mockData';

export default function Imaging() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Imagerie Médicale</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visualisation et gestion des examens d'imagerie (DICOM)
        </p>
      </div>

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
                <button className="btn btn-primary text-sm flex items-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>Voir</span>
                </button>
                <button className="btn btn-secondary text-sm flex items-center space-x-1">
                  <Download className="h-4 w-4" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>

            {/* Mock Image Preview */}
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
    </div>
  );
}
