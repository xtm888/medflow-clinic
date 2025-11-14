import React, { useState, useEffect } from 'react';
import {
  X, Download, Share2, Edit3, Trash2, ZoomIn, ZoomOut,
  RotateCw, FileText, Tag, Clock, User, Calendar, Volume2,
  Play, Pause, MessageSquare, Eye
} from 'lucide-react';
import api from '../../services/api';

const DocumentViewer = ({ document, onClose, onUpdate }) => {
  const [doc, setDoc] = useState(document);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: document.title,
    description: document.description || '',
    tags: document.tags?.join(', ') || ''
  });
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);

  useEffect(() => {
    trackView();
    if (doc.type === 'audio' && doc.audio?.transcription) {
      setTranscription(doc.audio.transcription);
    }
  }, []);

  const trackView = async () => {
    try {
      await api.get(`/api/documents/${doc._id}`);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const response = await api.put(`/api/documents/${doc._id}`, {
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      });

      setDoc(response.data.data);
      onUpdate(response.data.data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const handleDownload = () => {
    // Create download link
    const link = document.createElement('a');
    link.href = doc.file?.url || doc.file?.path || '#';
    link.download = doc.file?.originalName || doc.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTranscribe = async () => {
    try {
      const response = await api.post(`/api/documents/${doc._id}/transcribe`);
      setDoc(response.data.data);
      setTranscription(response.data.data.audio?.transcription);
      setShowTranscription(true);
    } catch (error) {
      console.error('Error transcribing audio:', error);
    }
  };

  const renderContent = () => {
    switch (doc.type) {
      case 'pdf':
        return (
          <div className="flex-1 bg-gray-100 flex items-center justify-center">
            <iframe
              src={doc.file?.url || doc.file?.path}
              className="w-full h-full"
              title={doc.title}
            />
          </div>
        );

      case 'image':
        return (
          <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto p-4">
            <img
              src={doc.file?.url || doc.file?.path}
              alt={doc.title}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: 'transform 0.3s'
              }}
              className="max-w-full h-auto"
            />
          </div>
        );

      case 'audio':
        return (
          <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center p-8">
            <Volume2 size={64} className="mb-6 text-gray-400" />
            <audio
              controls
              className="w-full max-w-md"
              src={doc.file?.url || doc.file?.path}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {doc.audio?.duration && (
              <p className="mt-4 text-gray-600">
                Duration: {Math.floor(doc.audio.duration / 60)}:
                {(doc.audio.duration % 60).toString().padStart(2, '0')}
              </p>
            )}

            {!transcription && (
              <button
                onClick={handleTranscribe}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <MessageSquare size={16} />
                Transcribe Audio
              </button>
            )}

            {transcription && (
              <div className="mt-6 w-full max-w-2xl">
                <button
                  onClick={() => setShowTranscription(!showTranscription)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-3"
                >
                  <MessageSquare size={16} />
                  {showTranscription ? 'Hide' : 'Show'} Transcription
                </button>

                {showTranscription && (
                  <div className="bg-white rounded-lg p-4 border">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {transcription.text}
                    </p>
                    {transcription.confidence && (
                      <p className="mt-2 text-sm text-gray-500">
                        Confidence: {Math.round(transcription.confidence * 100)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {doc.audio?.summary && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg max-w-2xl">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-gray-700">{doc.audio.summary}</p>
              </div>
            )}
          </div>
        );

      case 'text':
      default:
        return (
          <div className="flex-1 bg-white p-8 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {doc.content?.extracted ? (
                <pre className="whitespace-pre-wrap font-sans">
                  {doc.content.extracted}
                </pre>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <FileText size={48} className="mx-auto mb-4" />
                  <p>Document preview not available</p>
                  <button
                    onClick={handleDownload}
                    className="mt-4 text-blue-600 hover:text-blue-700"
                  >
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex z-50">
      <div className="flex-1 bg-white flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="text-xl font-semibold w-full px-2 py-1 border rounded"
                />
              ) : (
                <h2 className="text-xl font-semibold">{doc.title}</h2>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {doc.createdBy?.firstName} {doc.createdBy?.lastName}
                </span>
                {doc.stats?.views && (
                  <span className="flex items-center gap-1">
                    <Eye size={14} />
                    {doc.stats.views} views
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {(doc.type === 'image' || doc.type === 'pdf') && (
                <>
                  <button
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Zoom out"
                  >
                    <ZoomOut size={20} />
                  </button>
                  <span className="text-sm text-gray-600 min-w-[50px] text-center">
                    {zoom}%
                  </span>
                  <button
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Zoom in"
                  >
                    <ZoomIn size={20} />
                  </button>
                  {doc.type === 'image' && (
                    <button
                      onClick={() => setRotation((rotation + 90) % 360)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Rotate"
                    >
                      <RotateCw size={20} />
                    </button>
                  )}
                </>
              )}

              <div className="h-8 w-px bg-gray-300 mx-2" />

              <button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-100 rounded"
                title="Download"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-2 hover:bg-gray-100 rounded"
                title="Edit"
              >
                <Edit3 size={20} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-gray-50 border-b px-6 py-4">
            <div className="grid grid-cols-2 gap-4 max-w-4xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    title: doc.title,
                    description: doc.description || '',
                    tags: doc.tags?.join(', ') || ''
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        {renderContent()}

        {/* Footer with metadata */}
        <div className="bg-gray-50 border-t px-6 py-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Type: <span className="font-medium">{doc.type}</span>
              </span>
              <span className="text-gray-600">
                Category: <span className="font-medium">{doc.category}</span>
              </span>
              {doc.file?.size && (
                <span className="text-gray-600">
                  Size: <span className="font-medium">
                    {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </span>
              )}
            </div>
            {doc.tags && doc.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-gray-400" />
                {doc.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-200 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;