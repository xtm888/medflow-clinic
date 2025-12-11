import React, { useState } from 'react';
import { Star, Trash2, Eye, X } from 'lucide-react';
import tryOnPhotoService from '../../services/tryOnPhotoService';

const TryOnPhotoGallery = ({ orderId, photos = [], onPhotosChange, canEdit = true }) => {
  const [selectedView, setSelectedView] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isSelecting, setIsSelecting] = useState(null);

  const handleDelete = async (photoSetId) => {
    if (!window.confirm('Delete these try-on photos?')) return;
    setIsDeleting(photoSetId);
    try {
      await tryOnPhotoService.deletePhotos(orderId, photoSetId);
      onPhotosChange(photos.filter(p => p._id !== photoSetId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete photos');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSelect = async (photoSetId) => {
    setIsSelecting(photoSetId);
    try {
      await tryOnPhotoService.selectFrame(orderId, photoSetId);
      onPhotosChange(photos.map(p => ({ ...p, isSelectedFrame: p._id === photoSetId })));
    } catch (error) {
      console.error('Select error:', error);
      alert('Failed to select frame');
    } finally {
      setIsSelecting(null);
    }
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No try-on photos yet</p>
        <p className="text-sm">Capture photos to help the customer choose</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {photos.map((photoSet) => (
          <div key={photoSet._id} className={`border rounded-lg p-4 ${photoSet.isSelectedFrame ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {photoSet.isSelectedFrame && (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <Star className="w-4 h-4 fill-current" />Selected
                  </span>
                )}
                <span className="font-medium text-gray-900">{photoSet.frameName || 'Unknown Frame'}</span>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {!photoSet.isSelectedFrame && (
                    <button onClick={() => handleSelect(photoSet._id)} disabled={isSelecting === photoSet._id}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">
                      <Star className="w-4 h-4" />{isSelecting === photoSet._id ? 'Selecting...' : 'Select'}
                    </button>
                  )}
                  <button onClick={() => handleDelete(photoSet._id)} disabled={isDeleting === photoSet._id}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />{isDeleting === photoSet._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setSelectedView({ url: photoSet.frontPhoto?.url, title: `${photoSet.frameName} - Front View` })}>
                {photoSet.frontPhoto?.url ? (
                  <>
                    <img src={photoSet.frontPhoto.url} alt="Front view" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (<div className="flex items-center justify-center h-full text-gray-400">No photo</div>)}
                <span className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">Front</span>
              </div>

              <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setSelectedView({ url: photoSet.sidePhoto?.url, title: `${photoSet.frameName} - 3/4 Angle` })}>
                {photoSet.sidePhoto?.url ? (
                  <>
                    <img src={photoSet.sidePhoto.url} alt="Side view" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (<div className="flex items-center justify-center h-full text-gray-400">No photo</div>)}
                <span className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">3/4 Angle</span>
              </div>
            </div>

            {photoSet.notes && <p className="mt-3 text-sm text-gray-600 italic">"{photoSet.notes}"</p>}
            <p className="mt-2 text-xs text-gray-400">Captured {new Date(photoSet.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {selectedView && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedView(null)}>
          <button onClick={() => setSelectedView(null)} className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full">
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl max-h-[90vh]">
            <img src={selectedView.url} alt={selectedView.title} className="max-w-full max-h-[85vh] object-contain" />
            <p className="text-center text-white mt-2">{selectedView.title}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default TryOnPhotoGallery;
