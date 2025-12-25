/**
 * EyeSchemaCanvas - Canvas-based eye diagram annotation tool
 *
 * Features:
 * - Pre-loaded eye diagram templates (anterior, fundus, external, cross-section)
 * - Drawing tools: pen, line, circle, arrow, text
 * - Color palette: Red, Blue, Green, Yellow, Black
 * - Undo/Redo functionality
 * - Save as image / Load from saved
 * - OD/OS eye selection
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil,
  Minus,
  Circle,
  ArrowRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Download,
  Eye,
  RotateCcw
} from 'lucide-react';
import { AnteriorSegment, Fundus, ExternalEye, CrossSection, templates } from './eyeTemplates';

// Tool types
const TOOLS = {
  PEN: 'pen',
  LINE: 'line',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  TEXT: 'text'
};

// Color palette
const COLORS = [
  { id: 'red', value: '#DC2626', name: 'Rouge' },
  { id: 'blue', value: '#2563EB', name: 'Bleu' },
  { id: 'green', value: '#16A34A', name: 'Vert' },
  { id: 'yellow', value: '#CA8A04', name: 'Jaune' },
  { id: 'black', value: '#1F2937', name: 'Noir' }
];

// Template components map
const TEMPLATE_COMPONENTS = {
  anterior: AnteriorSegment,
  fundus: Fundus,
  external: ExternalEye,
  crossSection: CrossSection
};

export default function EyeSchemaCanvas({
  initialTemplate = 'anterior',
  initialEye = 'OD',
  initialDrawings = [],
  onSave,
  width = 450,
  height = 500,
  className = ''
}) {
  // State
  const [template, setTemplate] = useState(initialTemplate);
  const [selectedEye, setSelectedEye] = useState(initialEye);
  const [currentTool, setCurrentTool] = useState(TOOLS.PEN);
  const [currentColor, setCurrentColor] = useState(COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [drawings, setDrawings] = useState(initialDrawings);
  const [undoStack, setUndoStack] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);

  // Refs
  const canvasRef = useRef(null);
  const templateRef = useRef(null);
  const containerRef = useRef(null);

  // Get canvas context
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  // Clear canvas and redraw everything
  const redrawCanvas = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Redraw all saved drawings
    drawings.forEach(drawing => {
      drawShape(ctx, drawing);
    });
  }, [drawings, getContext, width, height]);

  // Draw a single shape
  const drawShape = (ctx, shape) => {
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (shape.tool) {
      case TOOLS.PEN:
        if (shape.points && shape.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(shape.points[i].x, shape.points[i].y);
          }
          ctx.stroke();
        }
        break;

      case TOOLS.LINE:
        ctx.beginPath();
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();
        break;

      case TOOLS.CIRCLE:
        const radius = Math.sqrt(
          Math.pow(shape.end.x - shape.start.x, 2) +
          Math.pow(shape.end.y - shape.start.y, 2)
        );
        ctx.beginPath();
        ctx.arc(shape.start.x, shape.start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case TOOLS.ARROW:
        // Draw line
        ctx.beginPath();
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x);
        const headLength = 12;
        ctx.beginPath();
        ctx.moveTo(shape.end.x, shape.end.y);
        ctx.lineTo(
          shape.end.x - headLength * Math.cos(angle - Math.PI / 6),
          shape.end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(shape.end.x, shape.end.y);
        ctx.lineTo(
          shape.end.x - headLength * Math.cos(angle + Math.PI / 6),
          shape.end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;

      case TOOLS.TEXT:
        ctx.font = `${shape.fontSize || 14}px sans-serif`;
        ctx.fillText(shape.text, shape.position.x, shape.position.y);
        break;
    }
  };

  // Get mouse position relative to canvas
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Mouse event handlers
  const handleMouseDown = (e) => {
    if (currentTool === TOOLS.TEXT) {
      setTextPosition(getMousePos(e));
      return;
    }

    setIsDrawing(true);
    const pos = getMousePos(e);
    setStartPoint(pos);

    if (currentTool === TOOLS.PEN) {
      setCurrentPath([pos]);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    const ctx = getContext();
    if (!ctx) return;

    // Redraw everything first
    redrawCanvas();

    // Draw current shape preview
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (currentTool) {
      case TOOLS.PEN:
        const newPath = [...currentPath, pos];
        setCurrentPath(newPath);
        if (newPath.length > 1) {
          ctx.beginPath();
          ctx.moveTo(newPath[0].x, newPath[0].y);
          for (let i = 1; i < newPath.length; i++) {
            ctx.lineTo(newPath[i].x, newPath[i].y);
          }
          ctx.stroke();
        }
        break;

      case TOOLS.LINE:
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        break;

      case TOOLS.CIRCLE:
        const radius = Math.sqrt(
          Math.pow(pos.x - startPoint.x, 2) +
          Math.pow(pos.y - startPoint.y, 2)
        );
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case TOOLS.ARROW:
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        // Arrowhead preview
        const angle = Math.atan2(pos.y - startPoint.y, pos.x - startPoint.x);
        const headLength = 12;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(
          pos.x - headLength * Math.cos(angle - Math.PI / 6),
          pos.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(
          pos.x - headLength * Math.cos(angle + Math.PI / 6),
          pos.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing && currentTool !== TOOLS.TEXT) return;

    const pos = getMousePos(e);
    let newDrawing = null;

    switch (currentTool) {
      case TOOLS.PEN:
        if (currentPath.length > 1) {
          newDrawing = {
            tool: TOOLS.PEN,
            points: [...currentPath, pos],
            color: currentColor,
            strokeWidth
          };
        }
        break;

      case TOOLS.LINE:
        newDrawing = {
          tool: TOOLS.LINE,
          start: startPoint,
          end: pos,
          color: currentColor,
          strokeWidth
        };
        break;

      case TOOLS.CIRCLE:
        newDrawing = {
          tool: TOOLS.CIRCLE,
          start: startPoint,
          end: pos,
          color: currentColor,
          strokeWidth
        };
        break;

      case TOOLS.ARROW:
        newDrawing = {
          tool: TOOLS.ARROW,
          start: startPoint,
          end: pos,
          color: currentColor,
          strokeWidth
        };
        break;
    }

    if (newDrawing) {
      setUndoStack([...undoStack, drawings]);
      setDrawings([...drawings, newDrawing]);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPath([]);
  };

  // Add text annotation
  const handleAddText = () => {
    if (!textInput || !textPosition) return;

    const newDrawing = {
      tool: TOOLS.TEXT,
      text: textInput,
      position: textPosition,
      color: currentColor,
      fontSize: 14
    };

    setUndoStack([...undoStack, drawings]);
    setDrawings([...drawings, newDrawing]);
    setTextInput('');
    setTextPosition(null);
  };

  // Undo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setDrawings(previousState);
  };

  // Clear all
  const handleClear = () => {
    if (drawings.length === 0) return;
    setUndoStack([...undoStack, drawings]);
    setDrawings([]);
  };

  // Save schema
  const handleSave = () => {
    const canvas = canvasRef.current;
    const templateElement = templateRef.current;

    // Create a combined canvas with template + drawings
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext('2d');

    // Draw white background
    exportCtx.fillStyle = 'white';
    exportCtx.fillRect(0, 0, width, height);

    // Convert SVG template to image and draw it
    const svgData = new XMLSerializer().serializeToString(templateElement.querySelector('svg'));
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      exportCtx.drawImage(img, 25, 50, 400, 400);

      // Draw annotations on top
      drawings.forEach(drawing => {
        drawShape(exportCtx, drawing);
      });

      // Add eye indicator
      exportCtx.font = 'bold 16px sans-serif';
      exportCtx.fillStyle = '#333';
      exportCtx.fillText(selectedEye, 30, 30);

      const imageData = exportCanvas.toDataURL('image/png');

      if (onSave) {
        onSave({
          template,
          eye: selectedEye,
          drawings,
          imageData
        });
      }

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Download as image
  const handleDownload = () => {
    handleSave(); // This will trigger onSave with imageData

    // Also trigger download
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `schema_${selectedEye}_${template}_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Redraw when drawings change
  useEffect(() => {
    redrawCanvas();
  }, [drawings, redrawCanvas]);

  // Get template component
  const TemplateComponent = TEMPLATE_COMPONENTS[template];

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2">
        {/* Template & Eye Selection */}
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Schéma:</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Oeil:</label>
            <div className="flex rounded-lg border overflow-hidden">
              {['OD', 'OS'].map(eye => (
                <button
                  key={eye}
                  onClick={() => setSelectedEye(eye)}
                  className={`px-3 py-1 text-sm font-medium transition ${
                    selectedEye === eye
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {eye}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Drawing Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            {[
              { tool: TOOLS.PEN, icon: Pencil, label: 'Crayon' },
              { tool: TOOLS.LINE, icon: Minus, label: 'Ligne' },
              { tool: TOOLS.CIRCLE, icon: Circle, label: 'Cercle' },
              { tool: TOOLS.ARROW, icon: ArrowRight, label: 'Flèche' },
              { tool: TOOLS.TEXT, icon: Type, label: 'Texte' }
            ].map(({ tool, icon: Icon, label }) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                className={`p-2 rounded transition ${
                  currentTool === tool
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            {COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => setCurrentColor(color.value)}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  currentColor === color.value
                    ? 'border-gray-800 scale-110'
                    : 'border-gray-300'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            <input
              type="range"
              min="1"
              max="8"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-16"
              title="Épaisseur"
            />
            <span className="text-xs text-gray-500">{strokeWidth}px</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-50"
              title="Annuler"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              disabled={drawings.length === 0}
              className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-50"
              title="Effacer tout"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="p-2 rounded hover:bg-green-100 text-green-600"
              title="Enregistrer"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded hover:bg-blue-100 text-blue-600"
              title="Télécharger"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="relative" style={{ width, height: height - 80 }}>
        {/* Template SVG (background) */}
        <div
          ref={templateRef}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ padding: '25px' }}
        >
          {TemplateComponent && <TemplateComponent width={400} height={400} />}
        </div>

        {/* Drawing Canvas (overlay) */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height - 80}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Text Input Popup */}
        {textPosition && (
          <div
            className="absolute bg-white border shadow-lg rounded p-2 z-10"
            style={{ left: textPosition.x, top: textPosition.y }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Entrez le texte..."
              className="border rounded px-2 py-1 text-sm w-40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText();
                if (e.key === 'Escape') setTextPosition(null);
              }}
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleAddText}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
              >
                OK
              </button>
              <button
                onClick={() => setTextPosition(null)}
                className="px-2 py-1 bg-gray-200 text-xs rounded"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Eye Indicator */}
      <div className="absolute top-16 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
        {selectedEye}
      </div>
    </div>
  );
}
