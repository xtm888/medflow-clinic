import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, ZoomIn, ZoomOut, RotateCw, Move, Layers, Grid3X3,
  SplitSquareHorizontal, Calendar, ChevronLeft, ChevronRight,
  Maximize2, Download, Eye, RefreshCw, ArrowLeftRight
} from 'lucide-react';

/**
 * ImageComparisonViewer - Professional ophthalmology image comparison tool
 *
 * Features:
 * - Side-by-side comparison (2x1 layout)
 * - Overlay mode with adjustable opacity slider
 * - 2x2 grid for multi-image comparison
 * - Synchronized zoom and pan across all panels
 * - Timeline view for chronological navigation
 * - Per-eye filtering (OD/OS)
 */
export default function ImageComparisonViewer({
  images = [],
  initialImage = null,
  patientName = '',
  onClose
}) {
  // Layout modes: 'single', 'side-by-side', 'overlay', 'grid-2x2'
  const [layoutMode, setLayoutMode] = useState('single');

  // Selected images for each panel (up to 4 for 2x2 grid)
  const [selectedImages, setSelectedImages] = useState([
    initialImage || images[0] || null,
    images[1] || null,
    images[2] || null,
    images[3] || null
  ]);

  // Active panel for selection (0-3)
  const [activePanel, setActivePanel] = useState(0);

  // Zoom and pan state (synchronized across panels)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Overlay mode opacity (0-100)
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  // Timeline/filter state
  const [filterEye, setFilterEye] = useState('all'); // 'all', 'OD', 'OS'
  const [filterType, setFilterType] = useState('all');
  const [showTimeline, setShowTimeline] = useState(false);

  // Tool state
  const [activeTool, setActiveTool] = useState('pan'); // 'pan', 'zoom'

  // Rotation per panel
  const [rotations, setRotations] = useState([0, 0, 0, 0]);

  const containerRef = useRef(null);

  // Group images by patient, eye, and type for timeline
  const groupedImages = useCallback(() => {
    const filtered = images.filter(img => {
      if (filterEye !== 'all' && img.eye !== filterEye) return false;
      if (filterType !== 'all' && img.type !== filterType) return false;
      return true;
    });

    // Sort by date (newest first for selection, oldest first for timeline)
    return filtered.sort((a, b) =>
      new Date(b.takenAt || b.examDate || b.createdAt) -
      new Date(a.takenAt || a.examDate || a.createdAt)
    );
  }, [images, filterEye, filterType]);

  // Get unique image types for filter
  const imageTypes = [...new Set(images.map(img => img.type).filter(Boolean))];

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.25, 5));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.25, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotations([0, 0, 0, 0]);
  };

  // Rotation handler
  const handleRotate = (panelIndex) => {
    setRotations(prev => {
      const newRotations = [...prev];
      newRotations[panelIndex] = (newRotations[panelIndex] + 90) % 360;
      return newRotations;
    });
  };

  // Pan handlers
  const handleMouseDown = (e) => {
    if (activeTool === 'pan') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && activeTool === 'pan') {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.5, Math.min(5, z * delta)));
  };

  // Image selection
  const selectImageForPanel = (image, panelIndex = activePanel) => {
    setSelectedImages(prev => {
      const newSelected = [...prev];
      newSelected[panelIndex] = image;
      return newSelected;
    });
  };

  // Navigation through timeline
  const navigateImage = (panelIndex, direction) => {
    const filtered = groupedImages();
    const currentImage = selectedImages[panelIndex];
    if (!currentImage || filtered.length === 0) return;

    const currentIndex = filtered.findIndex(img =>
      (img._id || img.id) === (currentImage._id || currentImage.id)
    );

    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filtered.length - 1;
    } else {
      newIndex = currentIndex < filtered.length - 1 ? currentIndex + 1 : 0;
    }

    selectImageForPanel(filtered[newIndex], panelIndex);
  };

  // Get image URL
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://localhost:5001${url}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Download handler
  const handleDownload = (image) => {
    if (!image) return;
    const url = getImageUrl(image.url);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${image.type}_${image.eye}_${formatDate(image.takenAt || image.examDate)}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleResetView();
      if (e.key === 'ArrowLeft') navigateImage(activePanel, 'prev');
      if (e.key === 'ArrowRight') navigateImage(activePanel, 'next');
      if (e.key === '1') setLayoutMode('single');
      if (e.key === '2') setLayoutMode('side-by-side');
      if (e.key === '3') setLayoutMode('overlay');
      if (e.key === '4') setLayoutMode('grid-2x2');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, onClose]);

  // Render single image panel
  const renderImagePanel = (image, panelIndex, showControls = true) => {
    const isActive = activePanel === panelIndex;

    return (
      <div
        className={`relative bg-black overflow-hidden flex-1 ${
          isActive ? 'ring-2 ring-blue-500' : ''
        } ${layoutMode !== 'single' ? 'cursor-pointer' : ''}`}
        onClick={() => setActivePanel(panelIndex)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : activeTool === 'pan' ? 'grab' : 'crosshair' }}
      >
        {image ? (
          <>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotations[panelIndex]}deg)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <img
                src={getImageUrl(image.url)}
                alt={image.caption || `${image.type} - ${image.eye}`}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </div>

            {/* Image info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-blue-600 text-xs font-semibold rounded">
                      {image.type}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-600 text-xs font-semibold rounded flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {image.eye}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{image.caption || `${image.type} - ${image.eye}`}</p>
                  <p className="text-xs text-gray-300">
                    {formatDate(image.takenAt || image.examDate)}
                  </p>
                </div>

                {showControls && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRotate(panelIndex); }}
                      className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                      title="Rotation"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(image); }}
                      className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation arrows */}
            {showControls && groupedImages().length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateImage(panelIndex, 'prev'); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateImage(panelIndex, 'next'); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Grid3X3 className="h-12 w-12 mb-2" />
            <p className="text-sm">Sélectionner une image</p>
            <p className="text-xs mt-1">Panneau {panelIndex + 1}</p>
          </div>
        )}
      </div>
    );
  };

  // Render overlay comparison mode
  const renderOverlayMode = () => {
    const baseImage = selectedImages[0];
    const overlayImage = selectedImages[1];

    return (
      <div
        className="relative bg-black flex-1 overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Base image (always visible) */}
        {baseImage && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotations[0]}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <img
              src={getImageUrl(baseImage.url)}
              alt="Base"
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Overlay image with opacity */}
        {overlayImage && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              opacity: overlayOpacity / 100,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotations[1]}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <img
              src={getImageUrl(overlayImage.url)}
              alt="Overlay"
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Overlay opacity slider */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg p-4 w-80">
          <div className="flex items-center gap-3">
            <span className="text-white text-xs w-20">
              {formatDate(baseImage?.takenAt || baseImage?.examDate)}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-white text-xs w-20 text-right">
              {formatDate(overlayImage?.takenAt || overlayImage?.examDate)}
            </span>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{baseImage?.type} {baseImage?.eye}</span>
            <span className="font-medium text-white">{overlayOpacity}%</span>
            <span>{overlayImage?.type} {overlayImage?.eye}</span>
          </div>
        </div>

        {/* Info overlays */}
        <div className="absolute top-4 left-4 bg-black/60 rounded-lg p-2 text-white text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-600 rounded">Base</span>
            <span>{baseImage?.type} - {baseImage?.eye}</span>
          </div>
        </div>
        <div className="absolute top-4 right-4 bg-black/60 rounded-lg p-2 text-white text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-orange-600 rounded">Overlay</span>
            <span>{overlayImage?.type} - {overlayImage?.eye}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" ref={containerRef}>
      {/* Header toolbar */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-400" />
            Comparaison d'images
            {patientName && <span className="text-gray-400 text-sm">- {patientName}</span>}
          </h2>

          {/* Layout mode selector */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setLayoutMode('single')}
              className={`p-2 rounded ${layoutMode === 'single' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Vue unique (1)"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode('side-by-side')}
              className={`p-2 rounded ${layoutMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Côte à côte (2)"
            >
              <SplitSquareHorizontal className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode('overlay')}
              className={`p-2 rounded ${layoutMode === 'overlay' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Superposition (3)"
            >
              <Layers className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode('grid-2x2')}
              className={`p-2 rounded ${layoutMode === 'grid-2x2' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Grille 2x2 (4)"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-400 hover:text-white rounded"
              title="Zoom arrière (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-white text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-400 hover:text-white rounded"
              title="Zoom avant (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-2 text-gray-400 hover:text-white rounded"
              title="Réinitialiser (0)"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Tool selector */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTool('pan')}
              className={`p-2 rounded ${activeTool === 'pan' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Déplacer"
            >
              <Move className="h-4 w-4" />
            </button>
          </div>

          {/* Timeline toggle */}
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`p-2 rounded-lg ${showTimeline ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Chronologie"
          >
            <Calendar className="h-4 w-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white"
            title="Fermer (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image viewing area */}
        <div className="flex-1 flex flex-col">
          {/* View panels based on layout mode */}
          <div className="flex-1 flex">
            {layoutMode === 'single' && renderImagePanel(selectedImages[0], 0)}

            {layoutMode === 'side-by-side' && (
              <div className="flex-1 flex gap-1">
                {renderImagePanel(selectedImages[0], 0)}
                <div className="w-1 bg-gray-800 flex items-center justify-center">
                  <ArrowLeftRight className="h-4 w-4 text-gray-500" />
                </div>
                {renderImagePanel(selectedImages[1], 1)}
              </div>
            )}

            {layoutMode === 'overlay' && renderOverlayMode()}

            {layoutMode === 'grid-2x2' && (
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex-1 flex gap-1">
                  {renderImagePanel(selectedImages[0], 0)}
                  {renderImagePanel(selectedImages[1], 1)}
                </div>
                <div className="flex-1 flex gap-1">
                  {renderImagePanel(selectedImages[2], 2)}
                  {renderImagePanel(selectedImages[3], 3)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline sidebar */}
        {showTimeline && (
          <div className="w-72 bg-gray-900 border-l border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-white font-medium mb-3">Chronologie</h3>

              {/* Eye filter */}
              <div className="flex gap-1 mb-2">
                {['all', 'OD', 'OS'].map(eye => (
                  <button
                    key={eye}
                    onClick={() => setFilterEye(eye)}
                    className={`flex-1 px-2 py-1 text-xs rounded ${
                      filterEye === eye
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {eye === 'all' ? 'Tous' : eye}
                  </button>
                ))}
              </div>

              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white"
              >
                <option value="all">Tous les types</option>
                {imageTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Image list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {groupedImages().map((image, idx) => {
                const isSelected = selectedImages.some(
                  sel => sel && (sel._id || sel.id) === (image._id || image.id)
                );
                const panelIndex = selectedImages.findIndex(
                  sel => sel && (sel._id || sel.id) === (image._id || image.id)
                );

                return (
                  <div
                    key={image._id || image.id || idx}
                    onClick={() => selectImageForPanel(image)}
                    className={`relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition hover:ring-2 hover:ring-blue-400 ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={getImageUrl(image.url)}
                        alt={image.caption || image.type}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="120"%3E%3Crect fill="%231f2937" width="200" height="120"/%3E%3Ctext fill="%236b7280" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" font-size="12"%3EImage%3C/text%3E%3C/svg%3E';
                        }}
                      />

                      {/* Badges */}
                      <div className="absolute top-1 left-1 flex gap-1">
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded">
                          {image.type}
                        </span>
                        <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded">
                          {image.eye}
                        </span>
                      </div>

                      {/* Panel indicator if selected */}
                      {isSelected && panelIndex >= 0 && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {panelIndex + 1}
                        </div>
                      )}
                    </div>

                    <div className="p-2">
                      <p className="text-white text-xs font-medium truncate">
                        {image.caption || `${image.type} - ${image.eye}`}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {formatDate(image.takenAt || image.examDate || image.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {groupedImages().length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">Aucune image trouvée</p>
                  <p className="text-xs mt-1">Modifiez les filtres</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
              <p>Cliquez sur une image pour la charger dans le panneau actif (bordure bleue)</p>
              <p className="mt-1">Raccourcis: ← → Navigation | +/- Zoom | 1-4 Layouts</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
