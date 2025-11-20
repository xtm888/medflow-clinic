import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileText, Image, Mic, Video, Search, Filter,
  Download, Share2, Edit3, Trash2, Eye, Clock, Tag,
  Folder, Grid, List, ChevronRight, X, Play, Pause,
  Square, Volume2, FileAudio
} from 'lucide-react';
import api from '../../services/apiConfig';
import AudioRecorder from './AudioRecorder';
import DocumentViewer from './DocumentViewer';

const DocumentManager = ({ patientId, visitId, mode = 'grid' }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [viewMode, setViewMode] = useState(mode);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const categories = [
    { value: 'all', label: 'All Documents', icon: Folder },
    { value: 'clinical', label: 'Clinical', icon: FileText },
    { value: 'imaging', label: 'Imaging', icon: Image },
    { value: 'laboratory', label: 'Laboratory', icon: FileText },
    { value: 'audio', label: 'Audio Notes', icon: FileAudio },
    { value: 'correspondence', label: 'Correspondence', icon: FileText },
    { value: 'insurance', label: 'Insurance', icon: FileText }
  ];

  useEffect(() => {
    fetchDocuments();
  }, [patientId, visitId, filterCategory]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      let url = `/api/documents`;

      if (visitId) {
        url = `/api/documents/visit/${visitId}`;
      } else if (patientId) {
        url = `/api/documents/patient/${patientId}`;
      }

      const params = new URLSearchParams();
      if (filterCategory !== 'all') {
        params.append('category', filterCategory);
      }

      const response = await api.get(`${url}?${params}`);
      setDocuments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchDocuments();
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        patientId: patientId,
        visitId: visitId || '',
        category: filterCategory !== 'all' ? filterCategory : ''
      });

      const response = await api.get(`/api/documents/search?${params}`);
      setDocuments(response.data.data || []);
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files) => {
    const formData = new FormData();
    const file = files[0];

    formData.append('document', file);
    formData.append('patientId', patientId);
    if (visitId) formData.append('visitId', visitId);
    formData.append('title', file.name);
    formData.append('category', determineCategory(file));

    try {
      setUploadProgress(10);
      const response = await api.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setDocuments([response.data.data, ...documents]);
      setShowUploadModal(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Error uploading document:', error);
      if (error.response?.status === 409) {
        alert('This document already exists in the system');
      }
      setUploadProgress(0);
    }
  };

  const determineCategory = (file) => {
    const type = file.type.toLowerCase();
    if (type.includes('image')) return 'imaging';
    if (type.includes('audio')) return 'audio';
    if (type.includes('pdf')) return 'clinical';
    return 'other';
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleAudioSave = async (audioBlob, duration) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio-note.webm');
    formData.append('patientId', patientId);
    if (visitId) formData.append('visitId', visitId);
    formData.append('duration', duration);
    formData.append('title', `Audio Note - ${new Date().toLocaleString()}`);
    formData.append('transcribe', 'true');

    try {
      const response = await api.post('/api/documents/audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDocuments([response.data.data, ...documents]);
      setShowAudioRecorder(false);
    } catch (error) {
      console.error('Error saving audio note:', error);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await api.delete(`/api/documents/${docId}`);
      setDocuments(documents.filter(doc => doc._id !== docId));
      setSelectedDoc(null);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleShare = async (docId) => {
    // Implement share functionality
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocIcon = (doc) => {
    switch (doc.type) {
      case 'image': return Image;
      case 'audio': return Volume2;
      case 'video': return Video;
      case 'pdf':
      case 'text':
      default: return FileText;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Document Management</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload size={16} />
              Upload
            </button>
            <button
              onClick={() => setShowAudioRecorder(true)}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Mic size={16} />
              Record
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search documents..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Document Grid/List */}
      <div
        className="flex-1 overflow-auto p-4"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="fixed inset-0 bg-blue-50 bg-opacity-90 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <Upload size={48} className="mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Folder size={48} className="mb-4" />
            <p>No documents found</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Upload first document
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {documents.map(doc => {
              const Icon = getDocIcon(doc);
              return (
                <div
                  key={doc._id}
                  className="group relative bg-white rounded-lg border hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="aspect-square p-4 flex flex-col items-center justify-center">
                    {doc.type === 'image' && doc.file?.url ? (
                      <img
                        src={doc.file.url}
                        alt={doc.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Icon size={48} className="text-gray-400" />
                    )}
                  </div>
                  <div className="p-3 border-t">
                    <p className="text-sm font-medium truncate" title={doc.title}>
                      {doc.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(doc.file?.size || 0)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle download
                        }}
                        className="p-1.5 bg-white rounded shadow hover:bg-gray-100"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(doc._id);
                        }}
                        className="p-1.5 bg-white rounded shadow hover:bg-gray-100"
                      >
                        <Share2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc._id);
                        }}
                        className="p-1.5 bg-white rounded shadow hover:bg-red-100 text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const Icon = getDocIcon(doc);
              return (
                <div
                  key={doc._id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                    <Icon size={24} className="text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-gray-500">
                        {doc.category} • {formatFileSize(doc.file?.size || 0)} • {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Download size={16} />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Share2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="p-2 hover:bg-red-100 rounded text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileUpload(e.target.files)}
        className="hidden"
        accept="image/*,application/pdf,audio/*,video/*,.doc,.docx"
      />

      {/* Upload Progress */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 min-w-[300px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Uploading...</span>
            <span className="text-sm text-gray-500">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Audio Recorder Modal */}
      {showAudioRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Record Audio Note</h3>
              <button
                onClick={() => setShowAudioRecorder(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <AudioRecorder
              onSave={handleAudioSave}
              onCancel={() => setShowAudioRecorder(false)}
            />
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDoc && (
        <DocumentViewer
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onUpdate={(updatedDoc) => {
            setDocuments(documents.map(doc =>
              doc._id === updatedDoc._id ? updatedDoc : doc
            ));
            setSelectedDoc(updatedDoc);
          }}
        />
      )}
    </div>
  );
};

export default DocumentManager;