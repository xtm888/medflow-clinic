import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Check, RotateCcw, Image } from 'lucide-react';
import tryOnPhotoService from '../../services/tryOnPhotoService';

const TryOnPhotoCapture = ({ orderId, frameId, frameName, onPhotosCaptured, onClose }) => {
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [sidePhoto, setSidePhoto] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [sidePreview, setSidePreview] = useState(null);
  const [activeCapture, setActiveCapture] = useState('front');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const [useCamera, setUseCamera] = useState(true);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setUseCamera(false);
      setError('Caméra non disponible. Veuillez utiliser le téléchargement de fichier.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `${activeCapture}_photo.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      if (activeCapture === 'front') {
        setFrontPhoto(file);
        setFrontPreview(previewUrl);
        setActiveCapture('side');
      } else {
        setSidePhoto(file);
        setSidePreview(previewUrl);
      }
    }, 'image/jpeg', 0.9);
  }, [activeCapture]);

  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (activeCapture === 'front') {
      setFrontPhoto(file);
      setFrontPreview(previewUrl);
      setActiveCapture('side');
    } else {
      setSidePhoto(file);
      setSidePreview(previewUrl);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [activeCapture]);

  const resetPhoto = useCallback((type) => {
    if (type === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontPhoto(null);
      setFrontPreview(null);
      setActiveCapture('front');
    } else {
      if (sidePreview) URL.revokeObjectURL(sidePreview);
      setSidePhoto(null);
      setSidePreview(null);
      setActiveCapture('side');
    }
  }, [frontPreview, sidePreview]);

  const handleUpload = async () => {
    if (!frontPhoto || !sidePhoto) {
      setError('Both photos are required');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const result = await tryOnPhotoService.uploadPhotos(orderId, frontPhoto, sidePhoto, frameId, notes);
      stopCamera();
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (sidePreview) URL.revokeObjectURL(sidePreview);
      onPhotosCaptured(result.data);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload photos');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (useCamera) startCamera();
    return () => stopCamera();
  }, [useCamera, startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Capture Try-On Photos</h3>
            <p className="text-sm text-gray-500">{frameName || 'Selected Frame'}</p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Front View {frontPhoto && <Check className="inline w-4 h-4 text-green-500" />}
              </label>
              <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                {frontPreview ? (
                  <>
                    <img src={frontPreview} alt="Front view" className="w-full h-full object-cover" />
                    <button onClick={() => resetPhoto('front')} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                ) : activeCapture === 'front' && useCamera ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full"><Image className="w-12 h-12 text-gray-300" /></div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                3/4 Angle View {sidePhoto && <Check className="inline w-4 h-4 text-green-500" />}
              </label>
              <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                {sidePreview ? (
                  <>
                    <img src={sidePreview} alt="Side view" className="w-full h-full object-cover" />
                    <button onClick={() => resetPhoto('side')} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                ) : activeCapture === 'side' && useCamera && frontPhoto ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full"><Image className="w-12 h-12 text-gray-300" /></div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
            {useCamera && (
              <button onClick={capturePhoto} disabled={frontPhoto && sidePhoto}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
                <Camera className="w-5 h-5" />
                Capture {activeCapture === 'front' ? 'Front' : 'Side'} Photo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handleFileSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={frontPhoto && sidePhoto}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              <Upload className="w-5 h-5" />
              Upload {activeCapture === 'front' ? 'Front' : 'Side'} Photo
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes about the frame fit..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={2} maxLength={500} />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={() => { stopCamera(); onClose(); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleUpload} disabled={!frontPhoto || !sidePhoto || isUploading}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
            {isUploading ? (<><span className="animate-spin">⏳</span>Uploading...</>) : (<><Check className="w-5 h-5" />Save Photos</>)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TryOnPhotoCapture;
