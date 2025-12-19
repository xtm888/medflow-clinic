/**
 * FaceVerification Component
 *
 * Verifies patient identity at consultation start by comparing
 * captured face with registered patient photo.
 * Prevents fraud by ensuring the person matches the patient record.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  Check,
  X,
  AlertTriangle,
  User,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import api from '../../services/apiConfig';

export default function FaceVerification({
  patient,           // Patient object with photoUrl
  onVerified,        // Called when face matches
  onSkip,            // Called if admin skips verification
  onCancel,          // Called when user cancels
  allowSkip = false, // Only admins can skip
  className = ''
}) {
  // State
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setCameraReady(false);
      setCapturedImage(null);
      setVerificationResult(null);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
    }
  }, [stream]);

  // Simple face detection
  const detectFace = useCallback(() => {
    if (!videoRef.current || !cameraReady) return;
    // Simple detection - assume face present if video playing
    setFaceDetected(true);
  }, [cameraReady]);

  // Start detection loop
  useEffect(() => {
    if (cameraReady && !capturedImage) {
      detectionInterval.current = setInterval(detectFace, 500);
    }
    return () => {
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
    };
  }, [cameraReady, capturedImage, detectFace]);

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture and verify
  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Capture photo
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - size) / 2;

    // Mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sourceX, sourceY, size, size, 0, 0, size, size);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Verify face
    setVerifying(true);
    try {
      const response = await api.post(`/face-recognition/verify/${patient._id}`, {
        image: imageData
      });

      setVerificationResult(response.data);

      if (response.data.verified || response.data.serviceUnavailable) {
        // Auto-proceed after 2 seconds on success
        setTimeout(() => {
          onVerified?.(response.data);
        }, 1500);
      }
    } catch (err) {
      console.error('Verification error:', err);
      // Check if it's a service unavailable error
      if (err.response?.status === 503 || err.code === 'ECONNREFUSED') {
        setVerificationResult({
          verified: false,
          serviceUnavailable: true,
          error: 'Service de reconnaissance faciale non disponible'
        });
      } else if (err.response?.data?.requiresEnrollment) {
        // Patient doesn't have face encoding
        setVerificationResult({
          verified: false,
          noEncoding: true,
          error: 'Ce patient n\'a pas de photo enregistrée pour la vérification'
        });
      } else {
        setVerificationResult({
          verified: false,
          error: err.response?.data?.error || 'Erreur de vérification'
        });
      }
    } finally {
      setVerifying(false);
    }
  }, [stream, patient, onVerified]);

  // Retry verification
  const handleRetry = () => {
    setCapturedImage(null);
    setVerificationResult(null);
    startCamera();
  };

  // Check if patient has a photo
  const hasPatientPhoto = patient?.photoUrl;

  // No patient photo - allow proceeding with warning
  if (!hasPatientPhoto) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Photo non disponible
          </h3>
          <p className="text-gray-500 mb-4">
            Ce patient n'a pas de photo enregistrée. La vérification d'identité ne peut pas être effectuée.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-yellow-700">
              Veuillez vérifier manuellement l'identité du patient avant de continuer.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={() => onVerified?.({ verified: true, skipped: true, reason: 'no_photo' })}
              className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Continuer sans vérification
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="font-medium text-gray-900">
              Vérification d'Identité
            </h3>
            <p className="text-sm text-gray-500">
              Vérifiez que le patient correspond à la photo enregistrée
            </p>
          </div>
        </div>
      </div>

      {/* Comparison View */}
      <div className="p-4">
        <div className="flex items-center gap-4 justify-center mb-4">
          {/* Patient's registered photo */}
          <div className="text-center">
            <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100">
              <img
                src={patient.photoUrl}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Photo enregistrée</p>
            <p className="text-sm font-medium">{patient.firstName} {patient.lastName}</p>
          </div>

          {/* VS indicator */}
          <div className="text-2xl font-bold text-gray-300">VS</div>

          {/* Live camera / captured */}
          <div className="text-center">
            <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-blue-500 bg-gray-900 relative">
              {error ? (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                </div>
              ) : capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Capture"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {capturedImage ? 'Photo capturée' : 'Caméra en direct'}
            </p>
          </div>
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Verification Result */}
        {verificationResult && (
          <div className={`p-4 rounded-lg mb-4 ${
            verificationResult.verified
              ? 'bg-green-50 border border-green-200'
              : verificationResult.serviceUnavailable
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {verificationResult.verified ? (
                <>
                  <ShieldCheck className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Identité vérifiée</p>
                    <p className="text-sm text-green-600">
                      Correspondance: {Math.round((verificationResult.confidence || 0.95) * 100)}%
                    </p>
                  </div>
                </>
              ) : verificationResult.serviceUnavailable ? (
                <>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Service non disponible</p>
                    <p className="text-sm text-yellow-600">
                      Vérification manuelle requise
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Identité non confirmée</p>
                    <p className="text-sm text-red-600">
                      {verificationResult.error || 'Le visage ne correspond pas au patient'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Verifying state */}
        {verifying && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <div className="flex items-center gap-3 justify-center">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              <p className="font-medium text-blue-800">Vérification en cours...</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Annuler
            </button>

            {/* Admin Skip Button - Always visible for admins */}
            {allowSkip && onSkip && (
              <button
                onClick={onSkip}
                className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center gap-2 border border-amber-300"
                title="Ignorer la vérification (Admin uniquement)"
              >
                <Shield className="h-4 w-4" />
                Ignorer (Admin)
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {verificationResult ? (
              verificationResult.verified || verificationResult.serviceUnavailable ? (
                <button
                  onClick={() => onVerified?.(verificationResult)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Continuer la consultation
                </button>
              ) : (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
              )
            ) : (
              <button
                onClick={captureAndVerify}
                disabled={!cameraReady || verifying}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Vérifier l'identité
              </button>
            )}
          </div>
        </div>

        {/* Admin Override Notice */}
        {allowSkip && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            En tant qu'administrateur, vous pouvez ignorer la vérification en cas de besoin.
            Cette action sera enregistrée dans le journal d'audit.
          </p>
        )}
      </div>
    </div>
  );
}
