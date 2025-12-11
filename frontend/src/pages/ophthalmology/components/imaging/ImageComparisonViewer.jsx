/**
 * ImageComparisonViewer
 *
 * Side-by-side image comparison component for ophthalmology imaging.
 * Supports comparing current exam images with historical images.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Columns,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Eye,
  Download,
  Move
} from 'lucide-react';

// View modes
const VIEW_MODES = {
  SIDE_BY_SIDE: 'side_by_side',
  OVERLAY: 'overlay',
  SLIDER: 'slider'
};

export default function ImageComparisonViewer({
  currentImage,
  comparisonImage,
  currentDate,
  comparisonDate,
  imageType = 'fundus', // fundus, oct, visual_field, etc.
  onClose,
  onSelectComparison,
  availableComparisons = []
}) {
  // State
  const [viewMode, setViewMode] = useState(VIEW_MODES.SIDE_BY_SIDE);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncPan, setSyncPan] = useState(true);

  // Refs
  const containerRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Handle zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Handle rotation
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // Handle panning
  const handlePanStart = (e) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    };
  };

  const handlePanMove = (e) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Handle slider drag
  const handleSliderDrag = (e) => {
    if (viewMode !== VIEW_MODES.SLIDER) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === 'r') handleRotate();
      if (e.key === '0') handleResetZoom();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Image transform style
  const imageStyle = {
    transform: `scale(${zoom}) rotate(${rotation}deg) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
    transition: isPanning ? 'none' : 'transform 0.2s ease-out',
    cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className={`flex flex-col bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : 'rounded-lg overflow-hidden'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white">
        <div className="flex items-center gap-4">
          <h3 className="font-medium">Comparaison d'images</h3>
          <span className="text-gray-400 text-sm">{imageType}</span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode(VIEW_MODES.SIDE_BY_SIDE)}
            className={`p-1.5 rounded ${viewMode === VIEW_MODES.SIDE_BY_SIDE ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
            title="Côte à côte"
          >
            <Columns className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.OVERLAY)}
            className={`p-1.5 rounded ${viewMode === VIEW_MODES.OVERLAY ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
            title="Superposition"
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.SLIDER)}
            className={`p-1.5 rounded ${viewMode === VIEW_MODES.SLIDER ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
            title="Curseur"
          >
            <Move className="h-4 w-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-700 rounded"
            title="Zoom arrière"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-700 rounded"
            title="Zoom avant"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-1.5 hover:bg-gray-700 rounded"
            title="Rotation"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-700 mx-2" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-gray-700 rounded"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-700 rounded"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-black"
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {viewMode === VIEW_MODES.SIDE_BY_SIDE && (
          <div className="flex h-full">
            {/* Current Image */}
            <div className="flex-1 relative border-r border-gray-700">
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(currentDate)}
                <span className="text-blue-400 ml-1">Actuel</span>
              </div>
              <div className="h-full flex items-center justify-center p-4">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt="Current exam"
                    className="max-h-full max-w-full object-contain"
                    style={imageStyle}
                    draggable={false}
                  />
                ) : (
                  <div className="text-gray-500 flex flex-col items-center">
                    <Eye className="h-12 w-12 mb-2" />
                    <span>Aucune image actuelle</span>
                  </div>
                )}
              </div>
            </div>

            {/* Comparison Image */}
            <div className="flex-1 relative">
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(comparisonDate)}
                <span className="text-orange-400 ml-1">Comparaison</span>
              </div>
              <div className="h-full flex items-center justify-center p-4">
                {comparisonImage ? (
                  <img
                    src={comparisonImage}
                    alt="Comparison exam"
                    className="max-h-full max-w-full object-contain"
                    style={imageStyle}
                    draggable={false}
                  />
                ) : (
                  <div className="text-gray-500 flex flex-col items-center">
                    <Eye className="h-12 w-12 mb-2" />
                    <span>Sélectionner une image</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === VIEW_MODES.OVERLAY && (
          <div className="h-full relative">
            {/* Base Image (Current) */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {currentImage && (
                <img
                  src={currentImage}
                  alt="Current exam"
                  className="max-h-full max-w-full object-contain"
                  style={imageStyle}
                  draggable={false}
                />
              )}
            </div>

            {/* Overlay Image (Comparison) */}
            <div
              className="absolute inset-0 flex items-center justify-center p-4"
              style={{ opacity: overlayOpacity }}
            >
              {comparisonImage && (
                <img
                  src={comparisonImage}
                  alt="Comparison exam"
                  className="max-h-full max-w-full object-contain"
                  style={{ ...imageStyle, filter: 'hue-rotate(180deg)' }}
                  draggable={false}
                />
              )}
            </div>

            {/* Opacity Slider */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-white text-xs">Opacité:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-white text-xs w-8">{Math.round(overlayOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {viewMode === VIEW_MODES.SLIDER && (
          <div
            className="h-full relative cursor-ew-resize"
            onMouseMove={handleSliderDrag}
          >
            {/* Comparison Image (Full) */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {comparisonImage && (
                <img
                  src={comparisonImage}
                  alt="Comparison exam"
                  className="max-h-full max-w-full object-contain"
                  style={imageStyle}
                  draggable={false}
                />
              )}
            </div>

            {/* Current Image (Clipped) */}
            <div
              className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              {currentImage && (
                <img
                  src={currentImage}
                  alt="Current exam"
                  className="max-h-full max-w-full object-contain"
                  style={imageStyle}
                  draggable={false}
                />
              )}
            </div>

            {/* Slider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full p-2 shadow-lg">
                <ChevronLeft className="h-4 w-4 text-gray-800 inline" />
                <ChevronRight className="h-4 w-4 text-gray-800 inline" />
              </div>
            </div>

            {/* Labels */}
            <div
              className="absolute top-2 text-white text-xs px-2 py-1 bg-black/50 rounded"
              style={{ left: `${Math.min(sliderPosition - 5, 85)}%` }}
            >
              Actuel
            </div>
            <div
              className="absolute top-2 text-white text-xs px-2 py-1 bg-black/50 rounded"
              style={{ left: `${Math.max(sliderPosition + 2, 2)}%` }}
            >
              Précédent
            </div>
          </div>
        )}
      </div>

      {/* Timeline Selector */}
      {availableComparisons.length > 0 && onSelectComparison && (
        <div className="bg-gray-800 p-3 border-t border-gray-700">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-gray-400 text-sm whitespace-nowrap">Historique:</span>
            {availableComparisons.map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => onSelectComparison(item)}
                className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition ${
                  item.date === comparisonDate
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {formatDate(item.date)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
