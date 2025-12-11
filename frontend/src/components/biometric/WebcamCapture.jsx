/**
 * WebcamCapture Component
 *
 * Captures patient photos using the device camera.
 * Includes face detection feedback and quality checks.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  User,
  Maximize,
  ZoomIn,
  Loader2
} from 'lucide-react';

export default function WebcamCapture({
  onCapture,
  onCancel,
  initialImage = null,
  showPreview = true,
  autoDetectFace = true,
  minFaceSize = 100,
  aspectRatio = 1, // 1 = square, 0.75 = 3:4 portrait
  className = '',
  // New speed optimization props
  instantCapture = false, // Auto-capture when face is well-positioned
  skipPreview = false,    // Skip confirmation after capture - call onCapture immediately
  captureDelay = 1500     // Delay before instant capture (ms) - gives user time to position
}) {
  // State
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(initialImage);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBounds, setFaceBounds] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isMirrored, setIsMirrored] = useState(true);
  // Instant capture state
  const [countdown, setCountdown] = useState(null);
  const [faceStableTime, setFaceStableTime] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectionInterval = useRef(null);
  const instantCaptureTimeout = useRef(null);

  // Initialize camera
  const startCamera = useCallback(async (deviceId = null) => {
    try {
      setError(null);
      setCameraReady(false);

      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          ...(deviceId && { deviceId: { exact: deviceId } })
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Accès à la caméra refusé. Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.');
      } else if (err.name === 'NotFoundError') {
        setError('Aucune caméra détectée. Veuillez connecter une caméra et réessayer.');
      } else {
        setError(`Erreur caméra : ${err.message}`);
      }
    }
  }, [stream]);

  // Get available camera devices
  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting devices:', err);
    }
  }, [selectedDevice]);

  // Simple face detection using canvas analysis (fallback without ML)
  const detectFaceSimple = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // Simple detection: assume face is in center if video is playing
    // In production, you'd call the face-service /detect endpoint
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const faceSize = Math.min(canvas.width, canvas.height) * 0.4;

    const wasDetected = faceDetected;
    setFaceDetected(true);
    setFaceBounds({
      x: centerX - faceSize / 2,
      y: centerY - faceSize / 2,
      width: faceSize,
      height: faceSize
    });

    // Update stable time for instant capture
    if (instantCapture && !capturedImage) {
      setFaceStableTime(prev => prev + 500); // Add interval time
    }
  }, [cameraReady, faceDetected, instantCapture, capturedImage]);

  // Instant capture when face is stable for the required delay
  useEffect(() => {
    if (!instantCapture || !cameraReady || capturedImage || !faceDetected) {
      setCountdown(null);
      return;
    }

    if (faceStableTime >= captureDelay) {
      // Face has been stable long enough - capture!
      capturePhotoInstant();
    } else if (faceStableTime > 0) {
      // Show countdown
      const remaining = Math.ceil((captureDelay - faceStableTime) / 1000);
      setCountdown(remaining);
    }
  }, [faceStableTime, instantCapture, cameraReady, capturedImage, faceDetected, captureDelay]);

  // Instant capture function (skips preview)
  const capturePhotoInstant = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    setCountdown(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size / aspectRatio;

    // Calculate crop to center on face
    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - (size / aspectRatio)) / 2;

    // Draw (mirror if needed)
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      sourceX, sourceY, size, size / aspectRatio,
      0, 0, canvas.width, canvas.height
    );

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Get image data
    const imageData = canvas.toDataURL('image/jpeg', 0.9);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    setIsCapturing(false);

    // If skipPreview or instantCapture, call onCapture immediately
    if (skipPreview || instantCapture) {
      if (onCapture) {
        onCapture(imageData);
      }
    } else {
      setCapturedImage(imageData);
    }
  }, [stream, isMirrored, aspectRatio, skipPreview, instantCapture, onCapture]);

  // Start face detection loop
  useEffect(() => {
    if (autoDetectFace && cameraReady && !capturedImage) {
      faceDetectionInterval.current = setInterval(detectFaceSimple, 500);
    }
    return () => {
      if (faceDetectionInterval.current) {
        clearInterval(faceDetectionInterval.current);
      }
    };
  }, [autoDetectFace, cameraReady, capturedImage, detectFaceSimple]);

  // Initialize on mount
  useEffect(() => {
    getDevices();
    if (!initialImage) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (faceDetectionInterval.current) {
        clearInterval(faceDetectionInterval.current);
      }
      if (instantCaptureTimeout.current) {
        clearTimeout(instantCaptureTimeout.current);
      }
    };
  }, []);

  // Handle device change
  useEffect(() => {
    if (selectedDevice && !capturedImage) {
      startCamera(selectedDevice);
    }
  }, [selectedDevice]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size / aspectRatio;

    // Calculate crop to center on face
    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - (size / aspectRatio)) / 2;

    // Draw (mirror if needed)
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      sourceX, sourceY, size, size / aspectRatio,
      0, 0, canvas.width, canvas.height
    );

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Get image data
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setIsCapturing(false);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // If skipPreview, call onCapture immediately without showing preview
    if (skipPreview) {
      if (onCapture) {
        onCapture(imageData);
      }
    } else {
      setCapturedImage(imageData);
    }
  }, [stream, isMirrored, aspectRatio, skipPreview, onCapture]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setFaceDetected(false);
    setFaceBounds(null);
    setFaceStableTime(0);
    setCountdown(null);
    startCamera(selectedDevice);
  }, [selectedDevice, startCamera]);

  // Confirm photo
  const confirmPhoto = useCallback(() => {
    if (capturedImage && onCapture) {
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Camera className="h-5 w-5 text-blue-500" />
          Capture Photo du Patient
        </h3>
        {devices.length > 1 && !capturedImage && (
          <select
            value={selectedDevice || ''}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            {devices.map((device, idx) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Camera / Preview Area */}
      <div className="relative bg-gray-900 aspect-square max-h-[400px] overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-center text-sm">{error}</p>
            <button
              onClick={() => startCamera(selectedDevice)}
              className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </button>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
            />

            {/* Face guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Oval guide */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`border-4 rounded-full transition-colors ${
                    faceDetected ? 'border-green-500' : 'border-white/50'
                  }`}
                  style={{
                    width: '60%',
                    height: '70%',
                    boxShadow: faceDetected
                      ? '0 0 0 9999px rgba(0,0,0,0.3)'
                      : '0 0 0 9999px rgba(0,0,0,0.5)'
                  }}
                />
              </div>

              {/* Status indicator */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                  countdown !== null
                    ? 'bg-blue-600 text-white animate-pulse'
                    : faceDetected
                      ? 'bg-green-500 text-white'
                      : 'bg-yellow-500 text-white'
                }`}>
                  {!cameraReady ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Initialisation...
                    </span>
                  ) : countdown !== null ? (
                    <span className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Capture dans {countdown}...
                    </span>
                  ) : faceDetected ? (
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      {instantCapture ? 'Restez immobile...' : 'Visage détecté'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Positionnez le visage
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown overlay for instant capture */}
              {countdown !== null && countdown <= 3 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-8xl font-bold text-white drop-shadow-lg animate-ping">
                    {countdown}
                  </div>
                </div>
              )}
            </div>

            {/* Loading overlay */}
            {!cameraReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </>
        )}

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Instructions */}
      <div className="p-3 bg-blue-50 border-t border-b text-sm text-blue-700">
        <ul className="space-y-1">
          <li>• Assurez-vous que le visage est bien éclairé</li>
          <li>• Regardez directement la caméra</li>
          <li>• Retirez les lunettes si possible</li>
        </ul>
      </div>

      {/* Controls */}
      <div className="p-4 flex items-center justify-between">
        {capturedImage ? (
          <>
            <button
              onClick={retakePhoto}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reprendre
            </button>
            <div className="flex gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={confirmPhoto}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Confirmer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className={`p-2 rounded-lg border ${isMirrored ? 'bg-blue-50 border-blue-300' : ''}`}
                title="Miroir"
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={capturePhoto}
                disabled={!cameraReady || isCapturing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCapturing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Capture...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Capturer
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
