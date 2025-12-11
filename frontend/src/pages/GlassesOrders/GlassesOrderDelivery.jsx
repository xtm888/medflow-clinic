import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Camera,
  Pen,
  Check,
  Truck,
  AlertCircle
} from 'lucide-react';
import glassesOrderService from '../../services/glassesOrderService';

const GlassesOrderDelivery = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    recipientName: '',
    recipientRelationship: 'self',
    idVerified: false,
    deliveryMethod: 'pickup',
    notes: ''
  });

  // Signature state
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Photo state
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await glassesOrderService.getOrder(id);
      setOrder(response.data);

      // Pre-fill recipient name
      if (response.data.patient) {
        setFormData(prev => ({
          ...prev,
          recipientName: `${response.data.patient.firstName} ${response.data.patient.lastName}`
        }));
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Erreur lors du chargement de la commande');
    } finally {
      setLoading(false);
    }
  };

  // Signature handling
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  useEffect(() => {
    initCanvas();
  }, [loading]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    initCanvas();
    setHasSignature(false);
  };

  const getSignatureDataUrl = () => {
    if (!hasSignature) return null;
    const canvas = canvasRef.current;
    return canvas.toDataURL('image/png');
  };

  // Photo handling
  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    const signatureDataUrl = getSignatureDataUrl();

    // Validation
    if (!formData.recipientName.trim()) {
      alert('Le nom du réceptionnaire est requis');
      return;
    }

    if (!signatureDataUrl && !photoUrl) {
      alert('Une signature ou une photo est requise pour confirmer la livraison');
      return;
    }

    setSubmitting(true);

    try {
      await glassesOrderService.recordDelivery(id, {
        recipientName: formData.recipientName,
        recipientRelationship: formData.recipientRelationship,
        idVerified: formData.idVerified,
        deliveryMethod: formData.deliveryMethod,
        signatureDataUrl,
        photoUrl,
        notes: formData.notes
      });

      alert('Livraison enregistrée avec succès!');
      navigate(`/glasses-orders/${id}`);
    } catch (err) {
      console.error('Error recording delivery:', err);
      alert(err.response?.data?.error || 'Erreur lors de l\'enregistrement de la livraison');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Commande non trouvée'}
        </div>
      </div>
    );
  }

  if (order.status !== 'ready') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-5 h-5" />
            <span>Cette commande n'est pas prête pour la livraison</span>
          </div>
          <button
            onClick={() => navigate(`/glasses-orders/${id}`)}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            ← Retour aux détails
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/glasses-orders/${id}`)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Livraison - {order.orderNumber}
          </h1>
          <p className="text-gray-500">
            {order.patient?.firstName} {order.patient?.lastName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Recipient Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            Informations du Réceptionnaire
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du réceptionnaire *
              </label>
              <input
                type="text"
                value={formData.recipientName}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relation avec le patient
              </label>
              <select
                value={formData.recipientRelationship}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientRelationship: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="self">Patient lui-même</option>
                <option value="family">Membre de la famille</option>
                <option value="caregiver">Accompagnant</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode de livraison
              </label>
              <select
                value={formData.deliveryMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="pickup">Retrait en magasin</option>
                <option value="delivery">Livraison</option>
                <option value="shipping">Expédition</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.idVerified}
                  onChange={(e) => setFormData(prev => ({ ...prev, idVerified: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Identité vérifiée</span>
              </label>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Pen className="w-5 h-5 text-gray-400" />
            Signature
          </h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              className="w-full max-w-lg mx-auto border bg-white rounded cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={clearSignature}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Effacer la signature
              </button>
            </div>

            {hasSignature && (
              <p className="text-center text-sm text-green-600 mt-2">
                <Check className="w-4 h-4 inline mr-1" />
                Signature capturée
              </p>
            )}
          </div>
        </div>

        {/* Photo */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-gray-400" />
            Photo de livraison (optionnel)
          </h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            {photoUrl ? (
              <div className="text-center">
                <img
                  src={photoUrl}
                  alt="Photo de livraison"
                  className="max-w-full max-h-64 mx-auto rounded"
                />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="mt-4 px-4 py-2 text-sm text-red-600 hover:text-red-800"
                >
                  Supprimer la photo
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Camera className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <label className="cursor-pointer">
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Prendre une photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Notes (optionnel)</h2>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Notes sur la livraison..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(`/glasses-orders/${id}`)}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Enregistrement...
              </>
            ) : (
              <>
                <Truck className="w-5 h-5" />
                Confirmer la livraison
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GlassesOrderDelivery;
