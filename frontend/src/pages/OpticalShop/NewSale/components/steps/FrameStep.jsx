/**
 * FrameStep Component
 *
 * Step 2: Frame selection with search and try-on photos.
 */

import { Glasses, Search, X, Box, Truck, MapPin, Camera } from 'lucide-react';
import { toast } from 'react-toastify';
import { TryOnPhotoCapture, TryOnPhotoGallery } from '../../../../../components/optical';
import { formatCurrency, FRAME_IMAGE_TYPES } from '../../constants';

export default function FrameStep({
  orderData,
  setOrderData,
  frameSearch,
  setFrameSearch,
  frames,
  searching,
  showResults,
  setShowResults,
  searchInputRef,
  containerRef,
  clearSearch,
  handleFocus,
  onCalculatePricing,
  // Try-on photos
  orderId,
  tryOnPhotos,
  setTryOnPhotos,
  showPhotoCapture,
  setShowPhotoCapture,
  loadingPhotos
}) {
  const selectFrame = (frame) => {
    const stock = frame.inventory?.currentStock || 0;
    const isInStock = stock > 0;

    setOrderData(prev => ({
      ...prev,
      frame: {
        inventoryItem: frame._id,
        brand: frame.brand,
        model: frame.model,
        color: frame.color,
        size: frame.size,
        price: frame.pricing?.retailPrice || 0,
        stock: stock,
        isInStock: isInStock,
        location: frame.inventory?.location || '',
        needsExternalOrder: !isInStock,
        images: frame.images || []
      }
    }));
    clearSearch();
    onCalculatePricing({ ...orderData, frame: { price: frame.pricing?.retailPrice || 0 } });

    if (!isInStock) {
      toast.info('Cette monture devra etre commandee chez un fournisseur');
    }
  };

  const clearFrameSelection = () => {
    setOrderData(prev => ({ ...prev, frame: null }));
    setFrameSearch('');
    searchInputRef.current?.focus();
  };

  const handlePhotosCaptured = (newPhotoSet) => {
    setTryOnPhotos(prev => [...prev, newPhotoSet]);
    setShowPhotoCapture(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Selection de la Monture</h2>

      {/* Current Selection */}
      {orderData.frame && (
        <SelectedFrameCard
          frame={orderData.frame}
          onClear={clearFrameSelection}
        />
      )}

      {/* Live Frame Search */}
      {!orderData.frame && (
        <FrameSearchInput
          frameSearch={frameSearch}
          setFrameSearch={setFrameSearch}
          frames={frames}
          searching={searching}
          showResults={showResults}
          setShowResults={setShowResults}
          searchInputRef={searchInputRef}
          containerRef={containerRef}
          clearSearch={clearSearch}
          handleFocus={handleFocus}
          onSelectFrame={selectFrame}
        />
      )}

      {/* Stock Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full"></span>
          <span>En stock local</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
          <span>Commande fournisseur</span>
        </div>
      </div>

      {/* Product Images Section */}
      {orderData?.frame && (
        <ProductImagesSection frame={orderData.frame} />
      )}

      {/* Try-On Photos Section */}
      <TryOnPhotosSection
        orderData={orderData}
        orderId={orderId}
        tryOnPhotos={tryOnPhotos}
        setTryOnPhotos={setTryOnPhotos}
        showPhotoCapture={showPhotoCapture}
        setShowPhotoCapture={setShowPhotoCapture}
        loadingPhotos={loadingPhotos}
        onPhotosCaptured={handlePhotosCaptured}
      />
    </div>
  );
}

function SelectedFrameCard({ frame, onClear }) {
  return (
    <div className={`p-4 rounded-lg border-2 ${
      frame.isInStock
        ? 'bg-green-50 border-green-200'
        : 'bg-orange-50 border-orange-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${
            frame.isInStock ? 'bg-green-100' : 'bg-orange-100'
          }`}>
            <Glasses className={`w-6 h-6 ${
              frame.isInStock ? 'text-green-600' : 'text-orange-600'
            }`} />
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {frame.brand} {frame.model}
            </p>
            <p className="text-sm text-gray-500">
              Couleur: {frame.color} | Taille: {frame.size}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {frame.isInStock ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <Box className="w-3 h-3" />
                  En stock ({frame.stock})
                  {frame.location && ` - ${frame.location}`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  <Truck className="w-3 h-3" />
                  Commande externe requise
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-purple-600">
            {formatCurrency(frame.price)}
          </p>
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-700 mt-1"
          >
            Changer
          </button>
        </div>
      </div>
    </div>
  );
}

function FrameSearchInput({
  frameSearch,
  setFrameSearch,
  frames,
  searching,
  showResults,
  setShowResults,
  searchInputRef,
  containerRef,
  clearSearch,
  handleFocus,
  onSelectFrame
}) {
  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={frameSearch}
          onChange={(e) => setFrameSearch(e.target.value)}
          onFocus={handleFocus}
          placeholder="Tapez pour rechercher une monture (marque, modele, couleur)..."
          className="w-full pl-12 pr-12 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
          autoComplete="off"
        />
        {frameSearch && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
        {searching && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && frameSearch.length >= 2 && (
        <FrameResultsDropdown
          frames={frames}
          searching={searching}
          frameSearch={frameSearch}
          onSelectFrame={onSelectFrame}
        />
      )}

      <p className="text-sm text-gray-400 mt-2">
        Commencez a taper pour rechercher automatiquement dans l'inventaire
      </p>
    </div>
  );
}

function FrameResultsDropdown({ frames, searching, frameSearch, onSelectFrame }) {
  if (searching) {
    return (
      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center text-gray-500">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Recherche en cours...
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-6 text-center">
        <Glasses className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Aucune monture trouvee pour "{frameSearch}"</p>
        <p className="text-sm text-gray-400 mt-1">Essayez une autre marque ou modele</p>
      </div>
    );
  }

  return (
    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto divide-y">
      {frames.map((frame) => {
        const stock = frame.inventory?.currentStock || 0;
        const isInStock = stock > 0;

        return (
          <div
            key={frame._id}
            className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${
              isInStock ? 'hover:bg-green-50' : 'hover:bg-orange-50 bg-gray-50'
            }`}
            onClick={() => onSelectFrame(frame)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">
                  {frame.brand} {frame.model}
                </p>
                {isInStock ? (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <Box className="w-3 h-3" />
                    {stock} en stock
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    A commander
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {frame.color} | {frame.size} | {frame.material || 'Metal'}
                {frame.inventory?.location && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {frame.inventory.location}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="font-bold text-purple-600">
                {formatCurrency(frame.pricing?.retailPrice)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductImagesSection({ frame }) {
  return (
    <div className="mt-6 border-t pt-6">
      <h4 className="text-lg font-medium text-gray-900 mb-4">
        Photos du produit
      </h4>
      {frame.images && frame.images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {frame.images.map((img, idx) => (
            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border">
              <img
                src={img.url}
                alt={img.alt || `${frame.brand} ${frame.model} - ${img.type || 'photo'}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                onClick={() => window.open(img.url, '_blank')}
              />
              {img.type && (
                <span className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                  {FRAME_IMAGE_TYPES[img.type] || img.type}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <Glasses className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Aucune photo du produit disponible</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TryOnPhotosSection({
  orderData,
  orderId,
  tryOnPhotos,
  setTryOnPhotos,
  showPhotoCapture,
  setShowPhotoCapture,
  loadingPhotos,
  onPhotosCaptured
}) {
  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900">
          Photos d'essayage client
        </h4>
        <button
          type="button"
          onClick={() => setShowPhotoCapture(true)}
          disabled={!orderData?.frame?.inventoryItem && !orderData?.frame?.brand}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Camera className="w-4 h-4" />
          Capturer photos
        </button>
      </div>

      {loadingPhotos ? (
        <div className="text-center py-4 text-gray-500">
          Chargement des photos...
        </div>
      ) : (
        <TryOnPhotoGallery
          orderId={orderId}
          photos={tryOnPhotos}
          onPhotosChange={setTryOnPhotos}
          canEdit={['draft', 'pending_verification', 'verification_rejected'].includes(orderData?.status)}
        />
      )}

      {/* Photo Capture Modal */}
      {showPhotoCapture && (
        <TryOnPhotoCapture
          orderId={orderId}
          frameId={orderData?.frame?.inventoryItem}
          frameName={orderData?.frame ? `${orderData.frame.brand || ''} ${orderData.frame.model || ''}`.trim() : null}
          onPhotosCaptured={onPhotosCaptured}
          onClose={() => setShowPhotoCapture(false)}
        />
      )}
    </div>
  );
}
