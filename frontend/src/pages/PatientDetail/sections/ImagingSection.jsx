import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image, Plus, Eye, Upload, Loader2, X, Layers, Download, ZoomIn, TrendingUp,
  Archive, ToggleLeft, ToggleRight, Calendar, Database, AlertCircle
} from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import documentService from '../../../services/documentService';
import ophthalmologyService from '../../../services/ophthalmologyService';
import patientService from '../../../services/patientService';
import imagingService from '../../../services/imagingService';
import ImageComparisonViewer from '../../../components/imaging/ImageComparisonViewer';
import { toast } from 'react-toastify';

/**
 * CareVisionImageCard - Individual image card for CareVision legacy images
 */
function CareVisionImageCard({ image, onSelect, formatDateShort, getImageUrl }) {
  const [imageError, setImageError] = useState(false);

  // Build the full URL for CareVision thumbnail
  const baseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5001/api`;
  const thumbnailUrl = image.thumbnailUrl
    ? (image.thumbnailUrl.startsWith('http') ? image.thumbnailUrl : `${baseUrl.replace('/api', '')}${image.thumbnailUrl}`)
    : null;

  // Parse date from description (e.g., "RETINO DU 16/01/2026")
  const displayDate = image.dateFromDescription || image.createdAt;

  return (
    <div
      className="group relative aspect-square bg-amber-50 border border-amber-200 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-amber-400 transition"
      onClick={() => onSelect({
        ...image,
        url: image.fullUrl ? `${baseUrl.replace('/api', '')}${image.fullUrl}` : thumbnailUrl,
        thumbnailUrl: thumbnailUrl,
        title: image.description || image.name || 'Image CareVision',
        type: 'archive',
        source: 'carevision',
        createdAt: displayDate
      })}
    >
      {thumbnailUrl && !imageError ? (
        <img
          src={thumbnailUrl}
          alt={image.description || 'Archive CareVision'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-amber-100">
          <Archive className="h-8 w-8 text-amber-400" />
          <span className="text-xs text-amber-500 mt-1">Archive</span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect({
              ...image,
              url: image.fullUrl ? `${baseUrl.replace('/api', '')}${image.fullUrl}` : thumbnailUrl,
              thumbnailUrl: thumbnailUrl,
              title: image.description || image.name || 'Image CareVision',
              type: 'archive',
              source: 'carevision',
              createdAt: displayDate
            });
          }}
          className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-lg"
          title="Voir"
        >
          <ZoomIn className="h-4 w-4 text-gray-700" />
        </button>
      </div>

      {/* CareVision Archive badge */}
      <div className="absolute top-1 left-1">
        <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-semibold rounded flex items-center gap-0.5">
          <Archive className="w-2.5 h-2.5" />
          Archive
        </span>
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900/70 to-transparent p-2">
        <p className="text-xs text-white truncate">{image.description || image.name || 'Image'}</p>
        {displayDate && (
          <p className="text-xs text-white/70">{formatDateShort(displayDate)}</p>
        )}
      </div>
    </div>
  );
}

/**
 * ImagingSection - Medical imaging gallery with upload and comparison
 *
 * Enhanced to support CareVision legacy images for patients with hasLegacyData.
 * Legacy images are displayed in a separate section with amber styling.
 */
export default function ImagingSection({
  patientId,
  patientName,
  patient,
  canUploadImaging,
  onViewImaging
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imaging, setImaging] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // CareVision legacy image support
  const [careVisionImages, setCareVisionImages] = useState([]);
  const [loadingCareVision, setLoadingCareVision] = useState(false);
  const [showCareVision, setShowCareVision] = useState(true);

  // Check if patient has CareVision legacy data
  const hasCareVisionLink = patient?.hasLegacyData || patient?.legacyIds?.lv;

  // Comparison viewer state
  const [showComparisonViewer, setShowComparisonViewer] = useState(false);
  const [comparisonInitialImage, setComparisonInitialImage] = useState(null);

  // Get image URL - uses environment variable or dynamic hostname for production
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || `${window.location.protocol}//${window.location.hostname}:5001`;
    return `${baseUrl}${url}`;
  };

  // Load CareVision legacy images
  const loadCareVisionImages = async () => {
    if (!hasCareVisionLink || !showCareVision) return;

    setLoadingCareVision(true);
    try {
      const images = await patientService.getLegacyImages(patientId, { limit: 100 });
      console.log('[ImagingSection] CareVision images loaded:', images.length);
      setCareVisionImages(Array.isArray(images) ? images : []);
    } catch (err) {
      console.error('[ImagingSection] Error loading CareVision images:', err);
      setCareVisionImages([]);
    } finally {
      setLoadingCareVision(false);
    }
  };

  const loadData = async () => {
    if (Array.isArray(imaging) && imaging.length > 0) return;

    setLoading(true);
    try {
      // Fetch from all sources in parallel (MedFlow sources + PACS)
      const [documentsRes, examsRes, studiesRes] = await Promise.all([
        documentService.getPatientDocuments(patientId).catch(() => ({ data: [] })),
        ophthalmologyService.getExams({ patient: patientId }).catch(() => ({ data: [] })),
        imagingService.getPatientImagingStudies(patientId).catch(() => ({ data: [] }))
      ]);

      // Get imaging documents
      const documentData = documentsRes.data || [];
      const imagingDocs = Array.isArray(documentData) ? documentData.filter(
        d => d.type === 'imaging' || d.category === 'imaging'
      ).map(d => ({
        ...d,
        source: 'medflow',
        url: getImageUrl(d.url || d.fileUrl),
        thumbnailUrl: getImageUrl(d.thumbnailUrl || d.url || d.fileUrl)
      })) : [];

      // Get images from ophthalmology exams
      const examsData = examsRes.data || examsRes || [];
      const examImages = [];

      if (Array.isArray(examsData)) {
        examsData.forEach(exam => {
          if (exam.images && Array.isArray(exam.images)) {
            exam.images.forEach(img => {
              examImages.push({
                _id: img._id || `${exam._id}-${img.url}`,
                url: getImageUrl(img.url),
                thumbnailUrl: getImageUrl(img.url),
                title: img.caption || `${img.type} - ${img.eye}`,
                type: img.type,
                eye: img.eye,
                category: 'exam-imaging',
                source: 'medflow',
                createdAt: img.takenAt || exam.createdAt,
                examId: exam.examId || exam._id
              });
            });
          }
        });
      }

      // Get PACS/DICOM imaging studies
      const studiesData = studiesRes.data || [];
      const pacsStudies = Array.isArray(studiesData) ? studiesData.map(study => ({
        _id: study._id,
        title: study.description || `PACS Study - ${study.modality}`,
        type: study.modality?.replace(/\\/g, '/') || 'DICOM',
        category: 'pacs-study',
        source: 'pacs',
        createdAt: study.studyDate,
        studyId: study.studyId,
        studyInstanceUID: study.studyInstanceUID,
        numberOfSeries: study.numberOfSeries,
        numberOfImages: study.numberOfImages,
        series: study.series,
        // PACS studies don't have direct image URLs - they reference DICOM data
        url: null,
        thumbnailUrl: null,
        isPacsStudy: true
      })) : [];

      // Combine all sources
      const allImaging = [...imagingDocs, ...examImages, ...pacsStudies];

      // Sort by date (newest first)
      allImaging.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setImaging(allImaging);

      // Also load CareVision images if patient has legacy data
      if (hasCareVisionLink && showCareVision) {
        loadCareVisionImages();
      }
    } catch (err) {
      console.error('Error loading imaging:', err);
      setImaging([]);
    } finally {
      setLoading(false);
    }
  };

  // Validate file before upload
  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/dicom'];
    const allowedExtensions = ['.dcm', '.jpg', '.jpeg', '.png', '.gif', '.pdf'];

    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (file.size > maxSize) {
      return { valid: false, error: `${file.name} dépasse 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB)` };
    }

    if (!allowedExtensions.includes(ext) && !allowedTypes.includes(file.type)) {
      return { valid: false, error: `${file.name}: Format non supporté. Utilisez DICOM, JPG, PNG ou PDF.` };
    }

    return { valid: true };
  };

  // Process files for upload (from input or drag-drop)
  const processFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const totalFiles = files.length;
    let uploadedCount = 0;
    let errorCount = 0;

    try {
      for (const file of files) {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          toast.error(validation.error);
          errorCount++;
          continue;
        }

        try {
          // Upload with progress tracking - pass file and metadata separately
          await documentService.uploadDocument(file, {
            patientId,
            category: 'imaging',
            title: file.name,
            onProgress: (progress) => {
              // Calculate overall progress across all files
              const fileProgress = (uploadedCount / totalFiles) * 100 + (progress / totalFiles);
              setUploadProgress(Math.round(fileProgress));
            }
          });

          uploadedCount++;
        } catch (err) {
          errorCount++;
          // Handle specific error types
          if (err.response?.status === 409) {
            toast.warning(`${file.name}: Ce fichier existe déjà (doublon détecté)`);
          } else if (err.response?.status === 413) {
            toast.error(`${file.name}: Fichier trop volumineux`);
          } else if (err.response?.status === 400) {
            toast.error(`${file.name}: ${err.response?.data?.message || 'Fichier invalide'}`);
          } else if (err.response?.status === 403) {
            toast.error('Vous n\'avez pas la permission de télécharger des images');
            break; // Stop on permission error
          } else {
            toast.error(`${file.name}: Erreur de téléchargement`);
          }
        }
      }

      // Summary toast
      if (uploadedCount > 0) {
        if (errorCount > 0) {
          toast.success(`${uploadedCount}/${totalFiles} image(s) téléchargée(s)`);
        } else {
          toast.success(`${uploadedCount} image(s) téléchargée(s) avec succès`);
        }

        // Force reload by clearing and reloading
        setImaging([]);
        await loadData();
      }
    } catch (err) {
      console.error('Error uploading:', err);
      toast.error('Erreur inattendue lors du téléchargement');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle file input change
  const handleUpload = async (event) => {
    await processFiles(event.target.files);
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (canUploadImaging) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!canUploadImaging) {
      toast.warning('Vous n\'avez pas la permission de télécharger des images');
      return;
    }

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleDownload = (image) => {
    const url = image.url || image.fileUrl || image.thumbnailUrl;
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${image.type || 'image'}_${image.eye || ''}_${formatDate(image.createdAt)}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openComparisonViewer = (initialImage = null) => {
    setComparisonInitialImage(initialImage);
    setShowComparisonViewer(true);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateShort = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative transition-all ${isDragOver ? 'ring-2 ring-cyan-400 ring-offset-2 rounded-xl' : ''}`}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-cyan-100/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
            <div className="text-center">
              <Upload className="h-12 w-12 text-cyan-600 mx-auto mb-2" />
              <p className="text-cyan-700 font-medium">Déposer les fichiers ici</p>
              <p className="text-cyan-600 text-sm">DICOM, JPG, PNG, PDF (max 50MB)</p>
            </div>
          </div>
        )}

        <CollapsibleSection
          title="Imagerie"
          icon={Image}
          iconColor="text-cyan-600"
          gradient="from-cyan-50 to-teal-50"
          defaultExpanded={false}
          onExpand={loadData}
          loading={loading || loadingCareVision}
          badge={
            <div className="flex items-center gap-2">
              {Array.isArray(imaging) && imaging.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-cyan-100 text-cyan-700 rounded-full flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {imaging.length} images
                </span>
              )}
              {hasCareVisionLink && careVisionImages.length > 0 && showCareVision && (
                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                  <Archive className="w-3 h-3" />
                  {careVisionImages.length} archives
                </span>
              )}
            </div>
          }
          headerActions={
            hasCareVisionLink && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCareVision(!showCareVision);
                  if (!showCareVision) {
                    loadCareVisionImages();
                  }
                }}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                  showCareVision
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={showCareVision ? 'Masquer les archives CareVision' : 'Afficher les archives CareVision'}
              >
                {showCareVision ? (
                  <>
                    <ToggleRight className="w-4 h-4" />
                    <span className="hidden sm:inline">Archives</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Archives</span>
                  </>
                )}
              </button>
            )
          }
          actions={
            <div className="flex gap-2">
              {Array.isArray(imaging) && imaging.length > 1 && (
                <SectionActionButton
                  icon={TrendingUp}
                  onClick={() => openComparisonViewer(imaging[0])}
                  variant="secondary"
                >
                  Évolution
                </SectionActionButton>
              )}
              {canUploadImaging && (
                <SectionActionButton
                  icon={Plus}
                  onClick={() => fileInputRef.current?.click()}
                  variant="primary"
                >
                  Ajouter
                </SectionActionButton>
              )}
            </div>
          }
        >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          accept=".dcm,.jpg,.jpeg,.png,.pdf"
          multiple
          className="hidden"
        />

        {!Array.isArray(imaging) || imaging.length === 0 ? (
          <SectionEmptyState
            icon={Image}
            message="Aucune imagerie pour ce patient"
            action={
              canUploadImaging && (
                <SectionActionButton
                  icon={Upload}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Télécharger des images
                </SectionActionButton>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Image Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(Array.isArray(imaging) ? imaging.slice(0, 8) : []).map((img) => (
                <div
                  key={img._id || img.id}
                  className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition ${
                    img.isPacsStudy
                      ? 'bg-indigo-50 border-2 border-indigo-200 hover:ring-2 hover:ring-indigo-400'
                      : 'bg-gray-100 hover:ring-2 hover:ring-cyan-400'
                  }`}
                >
                  {img.isPacsStudy ? (
                    // PACS Study Card
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                      <Database className="h-8 w-8 text-indigo-500 mb-1" />
                      <span className="text-xs font-medium text-indigo-700">{img.type}</span>
                      <span className="text-[10px] text-indigo-500">{img.numberOfSeries} séries</span>
                      <span className="text-[10px] text-indigo-500">{img.numberOfImages} images</span>
                    </div>
                  ) : img.thumbnailUrl || img.url || img.fileUrl ? (
                    <img
                      src={img.thumbnailUrl || img.url || img.fileUrl}
                      alt={img.title || 'Image'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" font-size="12"%3EImage%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-8 w-8 text-gray-300" />
                    </div>
                  )}

                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(img);
                      }}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-lg"
                      title="Voir"
                    >
                      <ZoomIn className="h-4 w-4 text-gray-700" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openComparisonViewer(img);
                      }}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-lg"
                      title="Comparer"
                    >
                      <Layers className="h-4 w-4 text-gray-700" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(img);
                      }}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-lg"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>

                  {/* Type & Eye badges */}
                  {(img.type || img.eye || img.isPacsStudy) && (
                    <div className="absolute top-1 left-1 flex gap-1">
                      {img.isPacsStudy && (
                        <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] font-semibold rounded flex items-center gap-0.5">
                          <Database className="w-2.5 h-2.5" />
                          PACS
                        </span>
                      )}
                      {img.type && !img.isPacsStudy && (
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-semibold rounded">
                          {img.type}
                        </span>
                      )}
                      {img.eye && (
                        <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded">
                          {img.eye}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white truncate">{img.title || img.type}</p>
                    <p className="text-xs text-white/70">{formatDateShort(img.createdAt)}</p>
                  </div>
                </div>
              ))}

              {/* Upload Card */}
              {canUploadImaging && (
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`aspect-square bg-gray-50 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition ${
                    uploading
                      ? 'border-cyan-400 bg-cyan-50 cursor-wait'
                      : 'border-gray-300 cursor-pointer hover:border-cyan-400 hover:bg-cyan-50'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center px-2">
                      <Loader2 className="h-6 w-6 text-cyan-500 animate-spin mb-2" />
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div
                          className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-cyan-600 font-medium">{uploadProgress}%</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-xs text-gray-500 mt-1">Ajouter</span>
                      <span className="text-[10px] text-gray-400">ou glisser-déposer</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* View all / Compare buttons */}
            <div className="flex gap-2 justify-center">
              {Array.isArray(imaging) && imaging.length > 1 && (
                <button
                  onClick={() => openComparisonViewer(imaging[0])}
                  className="px-4 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition"
                >
                  <Layers className="h-4 w-4" />
                  Comparer les images
                </button>
              )}
              {Array.isArray(imaging) && imaging.length > 8 && (
                <button
                  onClick={() => navigate(`/imaging?patientId=${patientId}`)}
                  className="px-4 py-2 text-sm text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
                >
                  Voir les {imaging.length} images →
                </button>
              )}
            </div>

            {/* Drop zone hint */}
            <p className="text-xs text-center text-gray-400">
              Glissez-déposez ou cliquez pour ajouter • DICOM, JPG, PNG, PDF (max 50MB)
            </p>
          </div>
        )}

        {/* CareVision Legacy Images Section */}
        {hasCareVisionLink && showCareVision && careVisionImages.length > 0 && (
          <div className="mt-6 pt-6 border-t border-amber-200">
            <div className="flex items-center gap-2 mb-4">
              <Archive className="w-5 h-5 text-amber-600" />
              <h4 className="font-medium text-amber-800">Archives CareVision</h4>
              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                {careVisionImages.length} images
              </span>
              <span className="ml-auto text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Lecture seule
              </span>
            </div>

            {loadingCareVision ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                <span className="ml-2 text-amber-700">Chargement des archives...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {careVisionImages.slice(0, 12).map((img) => (
                  <CareVisionImageCard
                    key={img.id}
                    image={img}
                    onSelect={setSelectedImage}
                    formatDateShort={formatDateShort}
                    getImageUrl={getImageUrl}
                  />
                ))}
              </div>
            )}

            {careVisionImages.length > 12 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate(`/imaging?patientId=${patientId}&source=carevision`)}
                  className="px-4 py-2 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                >
                  Voir les {careVisionImages.length} archives →
                </button>
              </div>
            )}

            {/* Info note about CareVision archives */}
            <p className="text-xs text-center text-amber-500 mt-4 flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Les archives CareVision sont en lecture seule. Les nouvelles images sont enregistrées dans MedFlow.
            </p>
          </div>
        )}

        {/* Quick Image Viewer Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300"
              >
                <X className="h-8 w-8" />
              </button>

              <img
                src={selectedImage.url || selectedImage.fileUrl || selectedImage.thumbnailUrl}
                alt={selectedImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />

              <div className={`rounded-b-lg p-4 mt-2 ${
                selectedImage.source === 'carevision'
                  ? 'bg-amber-50 border-t-2 border-amber-300'
                  : 'bg-white'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {/* Source badge */}
                      {selectedImage.source === 'carevision' ? (
                        <span className="px-2 py-1 bg-amber-600 text-white text-xs font-semibold rounded flex items-center gap-1">
                          <Archive className="w-3 h-3" />
                          Archive CareVision
                        </span>
                      ) : selectedImage.type && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                          {selectedImage.type}
                        </span>
                      )}
                      {selectedImage.eye && (
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded">
                          {selectedImage.eye}
                        </span>
                      )}
                    </div>
                    <p className={`font-medium ${
                      selectedImage.source === 'carevision' ? 'text-amber-900' : 'text-gray-900'
                    }`}>{selectedImage.title}</p>
                    <p className={`text-sm ${
                      selectedImage.source === 'carevision' ? 'text-amber-600' : 'text-gray-500'
                    }`}>{formatDate(selectedImage.createdAt)}</p>
                    {selectedImage.source === 'carevision' && (
                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Archive en lecture seule
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {/* Only show compare for MedFlow images */}
                    {selectedImage.source !== 'carevision' && (
                      <button
                        onClick={() => {
                          setSelectedImage(null);
                          openComparisonViewer(selectedImage);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                      >
                        <Layers className="h-4 w-4" />
                        Comparer
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(selectedImage)}
                      className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                        selectedImage.source === 'carevision'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      Télécharger
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>
      </div>

      {/* Full Comparison Viewer */}
      {showComparisonViewer && (
        <ImageComparisonViewer
          images={imaging}
          initialImage={comparisonInitialImage}
          patientName={patientName}
          onClose={() => {
            setShowComparisonViewer(false);
            setComparisonInitialImage(null);
          }}
        />
      )}
    </>
  );
}
