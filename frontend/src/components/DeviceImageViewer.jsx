import { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Maximize2,
  Minimize2,
  Download,
  Eye,
  EyeOff,
  Sliders,
  Grid3X3,
  X,
  Calendar,
  HardDrive,
  Info,
  Ruler,
  Pencil,
  Type,
  Circle,
  Square,
  ArrowRight,
  Trash2,
  Save
} from 'lucide-react';

/**
 * DeviceImageViewer Component
 *
 * Advanced medical image viewer with support for:
 * - Zoom, pan, rotate controls
 * - Brightness/contrast adjustment
 * - Annotations (lines, circles, rectangles, text)
 * - Comparison view (side-by-side)
 * - DICOM metadata display
 * - Image measurements
 */
const DeviceImageViewer = ({
  image,
  images = [],
  onClose,
  onAnnotationSave,
  showComparison = false
}) => {
  // View state
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Image adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showAdjustments, setShowAdjustments] = useState(false);

  // Annotation state
  const [annotationMode, setAnnotationMode] = useState(null); // 'line', 'circle', 'rectangle', 'text', 'ruler'
  const [annotations, setAnnotations] = useState(image?.annotations || []);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // UI state
  const [showMetadata, setShowMetadata] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [comparisonImage, setComparisonImage] = useState(null);

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleResetView = () => {
    setZoom(100);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
  };

  // Pan controls
  const handleMouseDown = (e) => {
    if (annotationMode) return; // Don't pan in annotation mode
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging && !annotationMode) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (isDrawing && annotationMode) {
      handleAnnotationMove(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (isDrawing) {
      handleAnnotationEnd();
    }
  };

  // Annotation handlers
  const startAnnotation = (e) => {
    if (!annotationMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (zoom / 100);
    const y = (e.clientY - rect.top) / (zoom / 100);

    setCurrentAnnotation({
      type: annotationMode,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      color: '#FF0000',
      thickness: 2,
      text: annotationMode === 'text' ? '' : undefined
    });
    setIsDrawing(true);
  };

  const handleAnnotationMove = (e) => {
    if (!isDrawing || !currentAnnotation) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (zoom / 100);
    const y = (e.clientY - rect.top) / (zoom / 100);

    setCurrentAnnotation(prev => ({
      ...prev,
      endX: x,
      endY: y
    }));
  };

  const handleAnnotationEnd = () => {
    if (currentAnnotation) {
      if (currentAnnotation.type === 'text') {
        const text = prompt('Enter text:');
        if (text) {
          setAnnotations(prev => [...prev, { ...currentAnnotation, text }]);
        }
      } else {
        setAnnotations(prev => [...prev, currentAnnotation]);
      }
    }
    setCurrentAnnotation(null);
    setIsDrawing(false);
    setAnnotationMode(null);
  };

  const deleteAnnotation = (index) => {
    setAnnotations(prev => prev.filter((_, i) => i !== index));
  };

  const saveAnnotations = () => {
    if (onAnnotationSave) {
      onAnnotationSave(image._id, annotations);
    }
  };

  // Render annotations on canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation);
    });

    // Draw current annotation being created
    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation);
    }
  }, [annotations, currentAnnotation, zoom]);

  const drawAnnotation = (ctx, annotation) => {
    const scale = zoom / 100;
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = annotation.thickness;
    ctx.fillStyle = annotation.color;

    const startX = annotation.startX * scale;
    const startY = annotation.startY * scale;
    const endX = annotation.endX * scale;
    const endY = annotation.endY * scale;

    switch (annotation.type) {
      case 'line':
      case 'ruler':
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (annotation.type === 'ruler') {
          const distance = Math.sqrt(
            Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
          );
          ctx.font = '14px Arial';
          ctx.fillText(
            `${(distance / scale).toFixed(1)}px`,
            (startX + endX) / 2,
            (startY + endY) / 2 - 10
          );
        }
        break;

      case 'circle':
        const radius = Math.sqrt(
          Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
        );
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'rectangle':
        ctx.strokeRect(
          startX,
          startY,
          endX - startX,
          endY - startY
        );
        break;

      case 'text':
        ctx.font = '16px Arial';
        ctx.fillText(annotation.text, startX, startY);
        break;

      default:
        break;
    }
  };

  // Image style with transformations
  const imageStyle = {
    transform: `scale(${zoom / 100}) rotate(${rotation}deg) translate(${pan.x}px, ${pan.y}px)`,
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    transition: isDragging ? 'none' : 'transform 0.2s ease',
    cursor: annotationMode ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'),
    maxWidth: '100%',
    maxHeight: '100%'
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

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-black z-50 flex flex-col ${isFullscreen ? 'p-0' : 'p-4'}`}
    >
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-semibold">
              {formatImageType(image?.imageType)} - {image?.eye}
            </h2>
            <p className="text-sm text-gray-400">
              {new Date(image?.captureDate).toLocaleString('fr-FR')}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        <div className="bg-gray-900 text-white p-2 flex flex-col gap-2 border-r border-gray-800">
          {/* View Controls */}
          <div className="pb-2 border-b border-gray-800">
            <p className="text-xs text-gray-400 mb-2 px-2">Vue</p>
            <button
              onClick={handleZoomIn}
              className="w-full p-2 hover:bg-gray-800 rounded flex items-center gap-2 text-sm"
              title="Zoom avant"
            >
              <ZoomIn className="w-4 h-4" />
              <span>Zoom +</span>
            </button>
            <button
              onClick={handleZoomOut}
              className="w-full p-2 hover:bg-gray-800 rounded flex items-center gap-2 text-sm"
              title="Zoom arrière"
            >
              <ZoomOut className="w-4 h-4" />
              <span>Zoom -</span>
            </button>
            <button
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="w-full p-2 hover:bg-gray-800 rounded flex items-center gap-2 text-sm"
              title="Rotation"
            >
              <RotateCw className="w-4 h-4" />
              <span>Rotation</span>
            </button>
            <button
              onClick={handleResetView}
              className="w-full p-2 hover:bg-gray-800 rounded flex items-center gap-2 text-sm"
              title="Réinitialiser"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Réinitialiser</span>
            </button>
          </div>

          {/* Annotation Tools */}
          <div className="pb-2 border-b border-gray-800">
            <p className="text-xs text-gray-400 mb-2 px-2">Annotations</p>
            <button
              onClick={() => setAnnotationMode(annotationMode === 'line' ? null : 'line')}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                annotationMode === 'line' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              <Pencil className="w-4 h-4" />
              <span>Ligne</span>
            </button>
            <button
              onClick={() => setAnnotationMode(annotationMode === 'circle' ? null : 'circle')}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                annotationMode === 'circle' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              <Circle className="w-4 h-4" />
              <span>Cercle</span>
            </button>
            <button
              onClick={() => setAnnotationMode(annotationMode === 'rectangle' ? null : 'rectangle')}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                annotationMode === 'rectangle' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              <Square className="w-4 h-4" />
              <span>Rectangle</span>
            </button>
            <button
              onClick={() => setAnnotationMode(annotationMode === 'ruler' ? null : 'ruler')}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                annotationMode === 'ruler' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              <Ruler className="w-4 h-4" />
              <span>Mesure</span>
            </button>
            <button
              onClick={() => setAnnotationMode(annotationMode === 'text' ? null : 'text')}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                annotationMode === 'text' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>Texte</span>
            </button>
            {annotations.length > 0 && (
              <button
                onClick={saveAnnotations}
                className="w-full p-2 hover:bg-green-700 bg-green-600 rounded flex items-center gap-2 text-sm mt-2"
              >
                <Save className="w-4 h-4" />
                <span>Sauvegarder</span>
              </button>
            )}
          </div>

          {/* Display Options */}
          <div className="pb-2 border-b border-gray-800">
            <p className="text-xs text-gray-400 mb-2 px-2">Affichage</p>
            <button
              onClick={() => setShowAdjustments(!showAdjustments)}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                showAdjustments ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Ajuster</span>
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                showGrid ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Grille</span>
            </button>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className={`w-full p-2 rounded flex items-center gap-2 text-sm ${
                showMetadata ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Métadonnées</span>
            </button>
          </div>

          {/* Actions */}
          <div>
            <p className="text-xs text-gray-400 mb-2 px-2">Actions</p>
            <button
              className="w-full p-2 hover:bg-gray-800 rounded flex items-center gap-2 text-sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = image?.imageUrl || image?.filePath;
                link.download = `${image?.imageType}-${image?.eye}-${new Date(image?.captureDate).toISOString()}.jpg`;
                link.click();
              }}
            >
              <Download className="w-4 h-4" />
              <span>Télécharger</span>
            </button>
          </div>

          {/* Zoom Level Display */}
          <div className="mt-auto pt-2 border-t border-gray-800">
            <div className="text-center text-sm text-gray-400">
              <div>{zoom}%</div>
              <div className="text-xs">{rotation}°</div>
            </div>
          </div>
        </div>

        {/* Image Display Area */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {/* Adjustment Controls */}
          {showAdjustments && (
            <div className="bg-gray-900 p-4 border-b border-gray-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Luminosité: {brightness}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Contraste: {contrast}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image Container */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            <div
              className="relative"
              onMouseDown={annotationMode ? startAnnotation : handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={imageRef}
                src={image?.imageUrl || image?.thumbnailUrl || image?.filePath}
                alt={`${image?.imageType} - ${image?.eye}`}
                style={imageStyle}
                draggable={false}
              />

              {/* Annotation Canvas Overlay */}
              <canvas
                ref={canvasRef}
                width={imageRef.current?.width || 800}
                height={imageRef.current?.height || 600}
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg) translate(${pan.x}px, ${pan.y}px)`,
                }}
              />

              {/* Grid Overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                  }}
                />
              )}
            </div>
          </div>

          {/* Annotations List */}
          {annotations.length > 0 && (
            <div className="bg-gray-900 border-t border-gray-800 p-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">
                  Annotations ({annotations.length})
                </p>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {annotations.map((annotation, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm text-white bg-gray-800 rounded px-2 py-1"
                  >
                    <span className="capitalize">{annotation.type}</span>
                    <button
                      onClick={() => deleteAnnotation(index)}
                      className="p-1 hover:bg-red-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metadata Panel */}
        {showMetadata && (
          <div className="w-80 bg-gray-900 text-white p-4 overflow-y-auto border-l border-gray-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Métadonnées
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-1">Type d'image</p>
                <p className="font-medium">{formatImageType(image?.imageType)}</p>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1">Œil</p>
                <p className="font-medium">{image?.eye}</p>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1">Date de capture</p>
                <p className="font-medium">
                  {new Date(image?.captureDate).toLocaleString('fr-FR')}
                </p>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1">Appareil</p>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-400" />
                  <p className="font-medium">{image?.device?.name || 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1">Résolution</p>
                <p className="font-medium">
                  {image?.metadata?.width || 'N/A'} × {image?.metadata?.height || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1">Taille du fichier</p>
                <p className="font-medium">{formatFileSize(image?.metadata?.fileSize)}</p>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-1">Format</p>
                <p className="font-medium uppercase">
                  {image?.metadata?.format || image?.fileFormat || 'N/A'}
                </p>
              </div>

              {image?.metadata?.dicom && (
                <>
                  <div className="pt-3 border-t border-gray-800">
                    <p className="text-gray-400 text-xs mb-2">Données DICOM</p>
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs mb-1">Patient ID</p>
                    <p className="font-medium font-mono text-xs">
                      {image.metadata.dicom.patientID || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs mb-1">Study Date</p>
                    <p className="font-medium">
                      {image.metadata.dicom.studyDate || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs mb-1">Modality</p>
                    <p className="font-medium">
                      {image.metadata.dicom.modality || 'N/A'}
                    </p>
                  </div>
                </>
              )}

              {image?.notes && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Notes</p>
                  <p className="text-sm text-gray-300">{image.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceImageViewer;
