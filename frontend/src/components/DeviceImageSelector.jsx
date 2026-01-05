import { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  CheckCircle,
  Clock,
  HardDrive,
  RefreshCw,
  XCircle,
  Eye as EyeIcon,
  Maximize2
} from 'lucide-react';
import api from '../services/apiConfig';
import DeviceImageViewer from './DeviceImageViewer';

/**
 * DeviceImageSelector Component
 *
 * Displays available device images for an exam and allows linking them
 * Supports viewing images in full-screen viewer with annotations
 */
const DeviceImageSelector = ({ examId, patientId, onImageLinked }) => {
  const [images, setImages] = useState([]);
  const [linkedImages, setLinkedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [error, setError] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);

  useEffect(() => {
    if (examId) {
      loadImages();
    }
  }, [examId]);

  const loadImages = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get available images (within 24h window)
      const availableResponse = await api.get(
        `/devices/images?patientId=${patientId}&examId=${examId}`
      );
      // Safely extract arrays from various API response formats
      const rawImages = availableResponse?.data?.data ?? availableResponse?.data ?? [];
      setImages(Array.isArray(rawImages) ? rawImages : []);

      // Get already linked images
      const linkedResponse = await api.get(
        `/ophthalmology/exams/${examId}/device-images`
      );
      const rawLinkedImages = linkedResponse?.data?.data ?? linkedResponse?.data ?? [];
      setLinkedImages(Array.isArray(rawLinkedImages) ? rawLinkedImages : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load images');
      console.error('Error loading device images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkImage = async (image) => {
    setLinking(image._id);

    try {
      await api.post(`/ophthalmology/exams/${examId}/link-image`, {
        imageId: image._id,
        deviceId: image.device._id
      });

      // Reload images to update UI
      await loadImages();

      // Notify parent component
      if (onImageLinked) {
        onImageLinked(image);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to link image');
      console.error('Error linking image:', err);
    } finally {
      setLinking(null);
    }
  };

  const isImageLinked = (imageId) => {
    return linkedImages.some(li => li.image?._id === imageId);
  };

  const formatImageType = (type) => {
    const typeMap = {
      'oct': 'OCT',
      'fundus': 'Fond d\'œil',
      'angiography': 'Angiographie',
      'topography': 'Topographie',
      'ultrasound': 'Échographie',
      'xray': 'Radiographie'
    };
    return typeMap[type?.toLowerCase()] || type;
  };

  const handleSaveAnnotations = async (imageId, annotations) => {
    try {
      await api.put(`/devices/images/${imageId}/annotations`, {
        annotations
      });

      // Reload images to get updated annotations
      await loadImages();
    } catch (err) {
      console.error('Error saving annotations:', err);
      setError('Failed to save annotations');
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="text-sm text-blue-800">
            Chargement des images disponibles...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
        <button
          onClick={loadImages}
          className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            Aucune image d'appareil disponible pour cet examen
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Les images capturées dans les 24 heures précédant l'examen apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <ImageIcon className="w-5 h-5" />
              <h3 className="font-semibold">Images d'Appareils Disponibles</h3>
            </div>
            <button
              onClick={loadImages}
              className="p-1 hover:bg-purple-500 rounded transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-purple-100 mt-1">
            {images.length} image(s) disponible(s) - Cliquez pour visualiser ou lier
          </p>
        </div>

        {/* Images Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {images.map((image) => {
            const isLinked = isImageLinked(image._id);
            const isLinking = linking === image._id;

            return (
              <div
                key={image._id}
                className={`border rounded-lg overflow-hidden hover:shadow-lg transition-all ${
                  isLinked ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}
              >
                {/* Image Preview */}
                <div className="relative bg-black aspect-video">
                  <img
                    src={image.thumbnailUrl || image.imageUrl || image.filePath}
                    alt={`${image.imageType} - ${image.eye}`}
                    className="w-full h-full object-contain"
                  />
                  {isLinked && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                  <button
                    onClick={() => setViewingImage(image)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-50 transition-all group"
                  >
                    <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>

                {/* Image Info */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="font-medium text-gray-900 text-sm">
                      {formatImageType(image.imageType)}
                    </span>
                    {isLinked && (
                      <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                    )}
                  </div>

                  {/* Eye Badge */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <EyeIcon className="w-3 h-3" />
                    <span className="font-medium">{image.eye}</span>
                  </div>

                  {/* Device Info */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <HardDrive className="w-3 h-3" />
                    <span>{image.device?.name}</span>
                  </div>

                  {/* Capture Date */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(image.captureDate).toLocaleString('fr-FR')}
                    </span>
                  </div>

                  {/* Resolution & Size */}
                  {image.metadata && (
                    <div className="text-xs text-gray-500 mb-3">
                      {image.metadata.width}×{image.metadata.height}
                      {image.metadata.fileSize && (
                        <span className="ml-2">
                          ({(image.metadata.fileSize / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingImage(image)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Voir
                    </button>

                    {!isLinked && (
                      <button
                        onClick={() => handleLinkImage(image)}
                        disabled={isLinking}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-sm font-medium"
                      >
                        {isLinking ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Lier...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Lier
                          </>
                        )}
                      </button>
                    )}

                    {isLinked && (
                      <div className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-xs font-medium text-center flex items-center justify-center">
                        Liée
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  {isLinked && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      <span>Image liée à l'examen</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <DeviceImageViewer
          image={viewingImage}
          images={images}
          onClose={() => setViewingImage(null)}
          onAnnotationSave={handleSaveAnnotations}
        />
      )}
    </>
  );
};

export default DeviceImageSelector;
