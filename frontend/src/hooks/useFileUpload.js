import { useState, useCallback } from 'react';
import { documentService } from '../services';
import { useAppDispatch } from './useRedux';
import { addToast } from '../store/slices/notificationSlice';

export const useFileUpload = (options = {}) => {
  const dispatch = useAppDispatch();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    multiple = false,
    onSuccess,
    onError,
    onProgress,
  } = options;

  // Validate file
  const validateFile = useCallback((file) => {
    const errors = [];

    // Check file size
    if (file.size > maxFileSize) {
      errors.push(`File "${file.name}" exceeds maximum size of ${maxFileSize / 1024 / 1024}MB`);
    }

    // Check file type
    if (allowedTypes.length > 0) {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const mimeType = file.type;

      const isAllowed = allowedTypes.some((type) => {
        if (type.startsWith('.')) {
          return fileExtension === type.substring(1);
        }
        return mimeType.startsWith(type);
      });

      if (!isAllowed) {
        errors.push(`File type "${file.type}" is not allowed`);
      }
    }

    return errors;
  }, [maxFileSize, allowedTypes]);

  // Upload single file
  const uploadFile = useCallback(async (file, metadata = {}) => {
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      if (onError) {
        onError(validationErrors);
      }
      return null;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrors([]);

    try {
      const result = await documentService.uploadDocument(file, {
        ...metadata,
        onProgress: (progress) => {
          setUploadProgress(progress);
          if (onProgress) {
            onProgress(progress);
          }
        },
      });

      setUploadedFiles((prev) => [...prev, result]);
      setUploadProgress(100);

      dispatch(addToast({
        type: 'success',
        message: `File "${file.name}" uploaded successfully`,
      }));

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      const errorMessage = error.response?.data?.message || `Failed to upload "${file.name}"`;
      setErrors([errorMessage]);

      dispatch(addToast({
        type: 'error',
        message: errorMessage,
      }));

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setUploading(false);
    }
  }, [validateFile, dispatch, onSuccess, onError, onProgress]);

  // Upload multiple files
  const uploadMultiple = useCallback(async (files, metadata = {}) => {
    const results = [];
    const errors = [];

    for (const file of files) {
      const validationErrors = validateFile(file);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        continue;
      }
    }

    if (errors.length > 0) {
      setErrors(errors);
      if (onError) {
        onError(errors);
      }
      return [];
    }

    setUploading(true);
    setErrors([]);

    try {
      const result = await documentService.uploadMultipleDocuments(files, metadata);
      setUploadedFiles((prev) => [...prev, ...result.documents]);

      dispatch(addToast({
        type: 'success',
        message: `${files.length} files uploaded successfully`,
      }));

      if (onSuccess) {
        onSuccess(result);
      }

      return result.documents;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to upload files';
      setErrors([errorMessage]);

      dispatch(addToast({
        type: 'error',
        message: errorMessage,
      }));

      if (onError) {
        onError(error);
      }

      return [];
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [validateFile, dispatch, onSuccess, onError]);

  // Handle file input change
  const handleFileSelect = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    if (multiple) {
      return uploadMultiple(files);
    } else {
      return uploadFile(files[0]);
    }
  }, [multiple, uploadFile, uploadMultiple]);

  // Handle drag and drop
  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files || []);

    if (files.length === 0) return;

    if (multiple) {
      return uploadMultiple(files);
    } else {
      return uploadFile(files[0]);
    }
  }, [multiple, uploadFile, uploadMultiple]);

  // Handle drag over
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // Clear uploaded files
  const clearUploadedFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setUploading(false);
    setUploadProgress(0);
    setUploadedFiles([]);
    setErrors([]);
  }, []);

  return {
    // State
    uploading,
    uploadProgress,
    uploadedFiles,
    errors,
    hasErrors: errors.length > 0,

    // Methods
    uploadFile,
    uploadMultiple,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    clearUploadedFiles,
    clearErrors,
    reset,

    // Validation
    validateFile,
  };
};

// Hook for audio recording upload
export const useAudioUpload = (options = {}) => {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const { uploadFile, ...uploadState } = useFileUpload(options);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
    }
  }, [mediaRecorder, recording]);

  const uploadAudio = useCallback(async (metadata = {}) => {
    if (!audioBlob) return null;

    const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
    return uploadFile(file, { ...metadata, type: 'audio' });
  }, [audioBlob, uploadFile]);

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
  }, []);

  return {
    ...uploadState,
    recording,
    audioBlob,
    startRecording,
    stopRecording,
    uploadAudio,
    clearAudio,
  };
};

// Hook for image upload with preview
export const useImageUpload = (options = {}) => {
  const [preview, setPreview] = useState(null);
  const { uploadFile, ...uploadState } = useFileUpload({
    ...options,
    allowedTypes: options.allowedTypes || ['image/'],
  });

  const uploadImage = useCallback(async (file, metadata = {}) => {
    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload file
    return uploadFile(file, { ...metadata, type: 'image' });
  }, [uploadFile]);

  const clearPreview = useCallback(() => {
    setPreview(null);
  }, []);

  return {
    ...uploadState,
    preview,
    uploadImage,
    clearPreview,
  };
};

// Hook for document scanning (OCR)
export const useDocumentScan = (documentId) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  const scanDocument = useCallback(async () => {
    if (!documentId) return;

    setScanning(true);
    setScanError(null);

    try {
      const result = await documentService.ocrScanDocument(documentId);
      setScanResult(result);
      return result;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to scan document';
      setScanError(errorMessage);
      return null;
    } finally {
      setScanning(false);
    }
  }, [documentId]);

  const checkScanStatus = useCallback(async () => {
    if (!documentId) return;

    try {
      const status = await documentService.getOCRStatus(documentId);
      return status;
    } catch (error) {
      console.error('Error checking scan status:', error);
      return null;
    }
  }, [documentId]);

  return {
    scanning,
    scanResult,
    scanError,
    scanDocument,
    checkScanStatus,
  };
};

export default {
  useFileUpload,
  useAudioUpload,
  useImageUpload,
  useDocumentScan,
};