/**
 * ImageTimelineSelector
 *
 * Timeline component for selecting historical images for comparison.
 * Shows thumbnails organized by date with filtering by image type.
 */

import { useState, useMemo } from 'react';
import {
  Calendar,
  Image,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Check,
  Layers
} from 'lucide-react';

// Image types
const IMAGE_TYPES = {
  fundus: { label: 'Fond d\'œil', icon: Eye },
  oct: { label: 'OCT', icon: Layers },
  visual_field: { label: 'Champ visuel', icon: Image },
  anterior_segment: { label: 'Segment antérieur', icon: Eye },
  gonioscopy: { label: 'Gonioscopie', icon: Eye },
  other: { label: 'Autre', icon: Image }
};

export default function ImageTimelineSelector({
  images = [],
  selectedImage,
  onSelectImage,
  currentExamDate,
  filterByType = null,
  showTypeFilter = true,
  orientation = 'horizontal', // horizontal | vertical
  maxVisible = 6,
  className = ''
}) {
  // State
  const [typeFilter, setTypeFilter] = useState(filterByType);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Filter and sort images
  const filteredImages = useMemo(() => {
    let result = [...images];

    // Apply type filter
    if (typeFilter) {
      result = result.filter(img => img.type === typeFilter);
    }

    // Sort by date descending
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    return result;
  }, [images, typeFilter]);

  // Group images by date
  const groupedByDate = useMemo(() => {
    const groups = {};

    filteredImages.forEach(img => {
      const dateKey = new Date(img.date).toISOString().split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(img);
    });

    return Object.entries(groups).map(([date, imgs]) => ({
      date,
      images: imgs,
      isCurrentExam: currentExamDate && new Date(date).toDateString() === new Date(currentExamDate).toDateString()
    }));
  }, [filteredImages, currentExamDate]);

  // Pagination
  const canScrollLeft = scrollOffset > 0;
  const canScrollRight = scrollOffset + maxVisible < groupedByDate.length;

  const handleScrollLeft = () => {
    setScrollOffset(prev => Math.max(0, prev - 1));
  };

  const handleScrollRight = () => {
    setScrollOffset(prev => Math.min(groupedByDate.length - maxVisible, prev + 1));
  };

  // Visible items
  const visibleGroups = groupedByDate.slice(scrollOffset, scrollOffset + maxVisible);

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Get available types
  const availableTypes = useMemo(() => {
    const types = new Set(images.map(img => img.type));
    return Array.from(types);
  }, [images]);

  if (images.length === 0) {
    return (
      <div className={`text-center py-4 text-gray-500 ${className}`}>
        <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune image disponible</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header with Type Filter */}
      {showTypeFilter && availableTypes.length > 1 && (
        <div className="px-4 py-2 border-b flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <button
            onClick={() => setTypeFilter(null)}
            className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
              typeFilter === null
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tous ({images.length})
          </button>
          {availableTypes.map(type => {
            const typeConfig = IMAGE_TYPES[type] || IMAGE_TYPES.other;
            const count = images.filter(img => img.type === type).length;

            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2 py-1 text-xs rounded whitespace-nowrap flex items-center gap-1 ${
                  typeFilter === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {typeConfig.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className={`p-4 ${orientation === 'vertical' ? '' : 'flex items-center gap-2'}`}>
        {/* Scroll Left */}
        {orientation === 'horizontal' && canScrollLeft && (
          <button
            onClick={handleScrollLeft}
            className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </button>
        )}

        {/* Image Groups */}
        <div className={`flex-1 ${orientation === 'vertical' ? 'space-y-4' : 'flex gap-4 overflow-hidden'}`}>
          {visibleGroups.map((group) => (
            <div
              key={group.date}
              className={`${orientation === 'vertical' ? '' : 'flex-shrink-0'}`}
            >
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span className={`text-xs font-medium ${group.isCurrentExam ? 'text-blue-600' : 'text-gray-600'}`}>
                  {formatDate(group.date)}
                  {group.isCurrentExam && (
                    <span className="ml-1 text-blue-500">(Actuel)</span>
                  )}
                </span>
              </div>

              {/* Thumbnails */}
              <div className={`${orientation === 'vertical' ? 'flex gap-2 overflow-x-auto' : 'flex gap-1'}`}>
                {group.images.map((img, idx) => {
                  const isSelected = selectedImage?.id === img.id;
                  const TypeIcon = IMAGE_TYPES[img.type]?.icon || Image;

                  return (
                    <button
                      key={img.id || idx}
                      onClick={() => onSelectImage(img)}
                      className={`
                        relative flex-shrink-0 rounded-lg overflow-hidden transition
                        ${orientation === 'vertical' ? 'w-20 h-20' : 'w-16 h-16'}
                        ${isSelected
                          ? 'ring-2 ring-blue-500 ring-offset-2'
                          : 'hover:ring-2 hover:ring-gray-300'
                        }
                      `}
                    >
                      {img.thumbnail || img.url ? (
                        <img
                          src={img.thumbnail || img.url}
                          alt={img.type}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <TypeIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}

                      {/* Type Badge */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                        {IMAGE_TYPES[img.type]?.label || img.type}
                      </div>

                      {/* Eye indicator */}
                      {img.eye && (
                        <div className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] px-1 rounded">
                          {img.eye}
                        </div>
                      )}

                      {/* Selection check */}
                      {isSelected && (
                        <div className="absolute top-1 left-1 bg-blue-500 rounded-full p-0.5">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Scroll Right */}
        {orientation === 'horizontal' && canScrollRight && (
          <button
            onClick={handleScrollRight}
            className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
          >
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
        <span>
          {filteredImages.length} image{filteredImages.length > 1 ? 's' : ''} sur {groupedByDate.length} date{groupedByDate.length > 1 ? 's' : ''}
        </span>
        {selectedImage && (
          <span className="text-blue-600">
            Sélection: {formatDate(selectedImage.date)} - {IMAGE_TYPES[selectedImage.type]?.label || selectedImage.type}
          </span>
        )}
      </div>
    </div>
  );
}
