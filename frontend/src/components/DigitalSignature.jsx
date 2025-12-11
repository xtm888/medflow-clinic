/**
 * Digital Signature Capture Component
 * Captures signatures for consent forms, prescriptions, and documents
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

const DigitalSignature = ({
  onSignatureCapture,
  onClear,
  width = 500,
  height = 200,
  strokeColor = '#000000',
  strokeWidth = 2,
  backgroundColor = '#ffffff',
  disabled = false,
  required = false,
  label = 'Signature',
  showTimestamp = true,
  showClearButton = true,
  showUndoButton = true,
  placeholder = 'Sign here',
  className = ''
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [signatureData, setSignatureData] = useState(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw placeholder text
    if (!hasSignature) {
      ctx.fillStyle = '#cccccc';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(placeholder, width / 2, height / 2);
    }

    // Draw signature line
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();

    // Draw "X" indicator
    ctx.fillStyle = '#cccccc';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('X', 20, height - 35);
  }, [width, height, backgroundColor, hasSignature, placeholder]);

  // Redraw all paths
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Redraw signature line
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();

    // Redraw all paths
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of paths) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }
  }, [paths, width, height, backgroundColor, strokeColor, strokeWidth]);

  useEffect(() => {
    redrawCanvas();
  }, [paths, redrawCanvas]);

  // Get position from event
  const getPosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (event.touches) {
      return {
        x: (event.touches[0].clientX - rect.left) * scaleX,
        y: (event.touches[0].clientY - rect.top) * scaleY
      };
    }

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  // Start drawing
  const startDrawing = (event) => {
    if (disabled) return;
    event.preventDefault();

    const pos = getPosition(event);
    setIsDrawing(true);
    setCurrentPath([pos]);
    setHasSignature(true);
  };

  // Continue drawing
  const draw = (event) => {
    if (!isDrawing || disabled) return;
    event.preventDefault();

    const pos = getPosition(event);
    const newPath = [...currentPath, pos];
    setCurrentPath(newPath);

    // Draw current stroke
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentPath.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  // Stop drawing
  const stopDrawing = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    if (currentPath.length > 1) {
      setPaths([...paths, currentPath]);
    }
    setCurrentPath([]);

    // Generate signature data
    generateSignatureData();
  };

  // Generate signature data
  const generateSignatureData = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const timestamp = new Date().toISOString();

    const data = {
      signature: dataUrl,
      timestamp,
      width,
      height,
      isEmpty: paths.length === 0 && currentPath.length === 0
    };

    setSignatureData(data);

    if (onSignatureCapture && !data.isEmpty) {
      onSignatureCapture(data);
    }
  };

  // Clear signature
  const clearSignature = () => {
    setPaths([]);
    setCurrentPath([]);
    setHasSignature(false);
    setSignatureData(null);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    if (onClear) {
      onClear();
    }
  };

  // Undo last stroke
  const undoLastStroke = () => {
    if (paths.length === 0) return;

    const newPaths = paths.slice(0, -1);
    setPaths(newPaths);

    if (newPaths.length === 0) {
      setHasSignature(false);
      setSignatureData(null);
    } else {
      generateSignatureData();
    }
  };

  // Get signature as image
  const getSignatureImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  // Check if signature is empty
  const isEmpty = () => {
    return paths.length === 0 && currentPath.length === 0;
  };

  return (
    <div className={`digital-signature-container ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={`relative border-2 rounded-lg overflow-hidden ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'
        } ${hasSignature ? 'border-green-300' : 'border-gray-300'}`}
        style={{ width, height }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="touch-none"
        />

        {/* Status indicator */}
        {hasSignature && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Signed
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex space-x-2">
          {showClearButton && (
            <button
              type="button"
              onClick={clearSignature}
              disabled={disabled || !hasSignature}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          )}

          {showUndoButton && (
            <button
              type="button"
              onClick={undoLastStroke}
              disabled={disabled || paths.length === 0}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Undo
            </button>
          )}
        </div>

        {showTimestamp && signatureData && (
          <span className="text-xs text-gray-500">
            Signed: {new Date(signatureData.timestamp).toLocaleString()}
          </span>
        )}
      </div>

      {/* Validation message */}
      {required && !hasSignature && (
        <p className="mt-1 text-sm text-red-600">
          Signature is required
        </p>
      )}
    </div>
  );
};

/**
 * Signature Display Component
 * Displays a captured signature
 */
export const SignatureDisplay = ({
  signatureData,
  label = 'Signature',
  showTimestamp = true,
  width = 300,
  height = 100,
  className = ''
}) => {
  if (!signatureData?.signature) {
    return (
      <div className={`signature-display ${className}`}>
        <p className="text-sm text-gray-500">No signature</p>
      </div>
    );
  }

  return (
    <div className={`signature-display ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="border border-gray-200 rounded-md overflow-hidden" style={{ width, height }}>
        <img
          src={signatureData.signature}
          alt="Signature"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      {showTimestamp && signatureData.timestamp && (
        <p className="mt-1 text-xs text-gray-500">
          Signed: {new Date(signatureData.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
};

/**
 * Signature Verification Component
 * Compares two signatures
 */
export const SignatureVerification = ({
  originalSignature,
  newSignature,
  onVerify,
  className = ''
}) => {
  const [verified, setVerified] = useState(null);

  const handleVerify = (isVerified) => {
    setVerified(isVerified);
    if (onVerify) {
      onVerify(isVerified);
    }
  };

  return (
    <div className={`signature-verification ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Signature Verification</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <SignatureDisplay
            signatureData={originalSignature}
            label="Original Signature"
            showTimestamp={true}
          />
        </div>
        <div>
          <SignatureDisplay
            signatureData={newSignature}
            label="New Signature"
            showTimestamp={true}
          />
        </div>
      </div>

      <div className="flex items-center justify-center space-x-4">
        <button
          type="button"
          onClick={() => handleVerify(true)}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            verified === true
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Signatures Match
        </button>
        <button
          type="button"
          onClick={() => handleVerify(false)}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            verified === false
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Signatures Do Not Match
        </button>
      </div>

      {verified !== null && (
        <div className={`mt-4 p-4 rounded-md ${verified ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-sm ${verified ? 'text-green-800' : 'text-red-800'}`}>
            {verified
              ? 'Signature verification: PASSED'
              : 'Signature verification: FAILED - Please review and obtain new signature if necessary'}
          </p>
        </div>
      )}
    </div>
  );
};

export default DigitalSignature;
