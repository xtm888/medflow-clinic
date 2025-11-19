import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Glasses, ShoppingCart, ArrowLeft, Save, Plus, Trash2,
  Eye, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ophthalmologyService from '../../services/ophthalmologyService';
import glassesOrderService from '../../services/glassesOrderService';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ToastContainer';

export default function GlassesOrder() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { toasts, success, error: showError, removeToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState(null);
  const [patient, setPatient] = useState(null);

  // Order form state
  const [orderType, setOrderType] = useState('glasses');
  const [lensType, setLensType] = useState('single-vision-distance');
  const [lensMaterial, setLensMaterial] = useState('cr39');
  const [coatings, setCoatings] = useState([]);
  const [frame, setFrame] = useState({ brand: '', model: '', color: '' });
  const [contactLenses, setContactLenses] = useState({
    od: { brand: '', baseCurve: '', diameter: '' },
    os: { brand: '', baseCurve: '', diameter: '' },
    wearSchedule: 'monthly',
    boxQuantity: { od: 1, os: 1 }
  });
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({ clinical: '', production: '' });
  const [priority, setPriority] = useState('normal');
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');

  // Product options
  const lensTypes = [
    { value: 'single-vision-distance', label: 'Vision de loin (Simple)' },
    { value: 'single-vision-near', label: 'Vision de près (Simple)' },
    { value: 'bifocal', label: 'Bifocaux' },
    { value: 'progressive', label: 'Progressifs' },
    { value: 'varifocal', label: 'Multifocaux' },
    { value: 'two-pairs', label: 'Deux paires (Loin + Près)' }
  ];

  const lensMaterials = [
    { value: 'cr39', label: 'CR-39 (Standard)', index: '1.50' },
    { value: 'polycarbonate', label: 'Polycarbonate', index: '1.59' },
    { value: 'trivex', label: 'Trivex', index: '1.53' },
    { value: 'hi-index-1.60', label: 'Haut indice', index: '1.60' },
    { value: 'hi-index-1.67', label: 'Haut indice', index: '1.67' },
    { value: 'hi-index-1.74', label: 'Ultra haut indice', index: '1.74' }
  ];

  const coatingOptions = [
    { value: 'anti-reflective', label: 'Anti-reflet', price: 25 },
    { value: 'blue-light', label: 'Filtre lumière bleue', price: 30 },
    { value: 'photochromic', label: 'Photochromique', price: 50 },
    { value: 'polarized', label: 'Polarisé', price: 45 },
    { value: 'scratch-resistant', label: 'Anti-rayures', price: 15 },
    { value: 'uv-protection', label: 'Protection UV', price: 10 },
    { value: 'hydrophobic', label: 'Hydrophobe', price: 20 }
  ];

  useEffect(() => {
    fetchExamData();
  }, [examId]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      const response = await ophthalmologyService.getExam(examId);
      const examData = response.data || response;
      setExam(examData);
      setPatient(examData.patient);

      // Initialize items with base lens price
      setItems([
        {
          description: 'Verres correcteurs',
          category: 'lens',
          quantity: 2,
          unitPrice: 50,
          discount: 0,
          total: 100
        }
      ]);
    } catch (err) {
      showError('Erreur lors du chargement de l\'examen');
      console.error('Error fetching exam:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoatingChange = (coatingValue) => {
    setCoatings(prev => {
      if (prev.includes(coatingValue)) {
        return prev.filter(c => c !== coatingValue);
      } else {
        return [...prev, coatingValue];
      }
    });
  };

  const addItem = () => {
    setItems([...items, {
      description: '',
      category: 'accessory',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      total: 0
    }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Recalculate total
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const qty = newItems[index].quantity || 1;
      const price = newItems[index].unitPrice || 0;
      const discount = newItems[index].discount || 0;
      newItems[index].total = (qty * price) - discount;
    }

    setItems(newItems);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const coatingsTotal = coatings.reduce((sum, c) => {
      const coating = coatingOptions.find(opt => opt.value === c);
      return sum + (coating?.price || 0);
    }, 0);
    return itemsTotal + coatingsTotal;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!exam) {
      showError('Données d\'examen manquantes');
      return;
    }

    try {
      setSaving(true);

      // Add coating items
      const allItems = [...items];
      coatings.forEach(c => {
        const coating = coatingOptions.find(opt => opt.value === c);
        if (coating) {
          allItems.push({
            description: coating.label,
            category: 'coating',
            quantity: 1,
            unitPrice: coating.price,
            discount: 0,
            total: coating.price
          });
        }
      });

      const orderData = {
        examId,
        orderType,
        glasses: orderType !== 'contact-lenses' ? {
          lensType,
          lensMaterial,
          coatings,
          frame
        } : undefined,
        contactLenses: orderType !== 'glasses' ? contactLenses : undefined,
        items: allItems,
        notes,
        priority,
        deliveryInfo: {
          method: deliveryMethod
        }
      };

      const result = await glassesOrderService.createOrder(orderData);

      success('Commande créée avec succès!');

      // Navigate to order details or back to ophthalmology
      setTimeout(() => {
        navigate('/ophthalmology');
      }, 1500);

    } catch (err) {
      showError(err.response?.data?.error || 'Erreur lors de la création de la commande');
      console.error('Error creating order:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Examen introuvable</p>
        <button
          onClick={() => navigate('/ophthalmology')}
          className="btn btn-primary mt-4"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Glasses className="h-6 w-6 mr-2 text-primary-600" />
              Commander Lunettes/Lentilles
            </h1>
            <p className="text-sm text-gray-500">
              Patient: {patient?.firstName} {patient?.lastName} |
              Examen du {exam.examDate ? format(new Date(exam.examDate), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Prescription Summary */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2 text-blue-600" />
            Prescription
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 mb-1">OD (Droit)</p>
              <p className="font-mono text-sm">
                Sph: {exam.finalPrescription?.od?.sphere || 0} |
                Cyl: {exam.finalPrescription?.od?.cylinder || 0} |
                Axe: {exam.finalPrescription?.od?.axis || 0}°
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">OS (Gauche)</p>
              <p className="font-mono text-sm">
                Sph: {exam.finalPrescription?.os?.sphere || 0} |
                Cyl: {exam.finalPrescription?.os?.cylinder || 0} |
                Axe: {exam.finalPrescription?.os?.axis || 0}°
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Addition</p>
              <p className="font-mono text-sm">
                {exam.finalPrescription?.od?.add || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">ÉP</p>
              <p className="font-mono text-sm">
                {exam.finalPrescription?.pd?.binocular || 'N/A'} mm
              </p>
            </div>
          </div>
        </div>

        {/* Order Type */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Type de commande</h2>
          <div className="flex space-x-4">
            {[
              { value: 'glasses', label: 'Lunettes' },
              { value: 'contact-lenses', label: 'Lentilles' },
              { value: 'both', label: 'Les deux' }
            ].map(type => (
              <label key={type.value} className="flex items-center">
                <input
                  type="radio"
                  name="orderType"
                  value={type.value}
                  checked={orderType === type.value}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="mr-2"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* Glasses Options */}
        {orderType !== 'contact-lenses' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Options Lunettes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lens Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de verres
                </label>
                <select
                  value={lensType}
                  onChange={(e) => setLensType(e.target.value)}
                  className="input"
                >
                  {lensTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lens Material */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matériau des verres
                </label>
                <select
                  value={lensMaterial}
                  onChange={(e) => setLensMaterial(e.target.value)}
                  className="input"
                >
                  {lensMaterials.map(material => (
                    <option key={material.value} value={material.value}>
                      {material.label} (n={material.index})
                    </option>
                  ))}
                </select>
              </div>

              {/* Coatings */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Traitements
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {coatingOptions.map(coating => (
                    <label
                      key={coating.value}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                        coatings.includes(coating.value)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coatings.includes(coating.value)}
                        onChange={() => handleCoatingChange(coating.value)}
                        className="mr-2"
                      />
                      <div>
                        <span className="text-sm">{coating.label}</span>
                        <span className="text-xs text-gray-500 block">${coating.price}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Frame */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monture (optionnel)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Marque"
                    value={frame.brand}
                    onChange={(e) => setFrame({ ...frame, brand: e.target.value })}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Modèle"
                    value={frame.model}
                    onChange={(e) => setFrame({ ...frame, model: e.target.value })}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Couleur"
                    value={frame.color}
                    onChange={(e) => setFrame({ ...frame, color: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Lens Options */}
        {orderType !== 'glasses' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Options Lentilles de Contact</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">OD (Droit)</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Marque"
                    value={contactLenses.od.brand}
                    onChange={(e) => setContactLenses({
                      ...contactLenses,
                      od: { ...contactLenses.od, brand: e.target.value }
                    })}
                    className="input"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="BC"
                      value={contactLenses.od.baseCurve}
                      onChange={(e) => setContactLenses({
                        ...contactLenses,
                        od: { ...contactLenses.od, baseCurve: e.target.value }
                      })}
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="DIA"
                      value={contactLenses.od.diameter}
                      onChange={(e) => setContactLenses({
                        ...contactLenses,
                        od: { ...contactLenses.od, diameter: e.target.value }
                      })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">OS (Gauche)</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Marque"
                    value={contactLenses.os.brand}
                    onChange={(e) => setContactLenses({
                      ...contactLenses,
                      os: { ...contactLenses.os, brand: e.target.value }
                    })}
                    className="input"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="BC"
                      value={contactLenses.os.baseCurve}
                      onChange={(e) => setContactLenses({
                        ...contactLenses,
                        os: { ...contactLenses.os, baseCurve: e.target.value }
                      })}
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="DIA"
                      value={contactLenses.os.diameter}
                      onChange={(e) => setContactLenses({
                        ...contactLenses,
                        os: { ...contactLenses.os, diameter: e.target.value }
                      })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Programme de port
                </label>
                <select
                  value={contactLenses.wearSchedule}
                  onChange={(e) => setContactLenses({
                    ...contactLenses,
                    wearSchedule: e.target.value
                  })}
                  className="input"
                >
                  <option value="daily">Journalier</option>
                  <option value="bi-weekly">Bi-mensuel</option>
                  <option value="monthly">Mensuel</option>
                  <option value="extended">Port prolongé</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Items */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Articles et Tarification</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn btn-secondary text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter article
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="input flex-1"
                />
                <input
                  type="number"
                  placeholder="Qté"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="input w-20"
                  min="1"
                />
                <input
                  type="number"
                  placeholder="Prix"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="input w-24"
                  step="0.01"
                />
                <span className="font-semibold w-24 text-right">
                  ${(item.total || 0).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Coatings total */}
          {coatings.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Traitements sélectionnés: +${coatings.reduce((sum, c) => {
                  const coating = coatingOptions.find(opt => opt.value === c);
                  return sum + (coating?.price || 0);
                }, 0).toFixed(2)}
              </p>
            </div>
          )}

          {/* Total */}
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-2xl font-bold text-primary-600">
              ${calculateTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {/* Additional Options */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Options supplémentaires</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorité
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="rush">Express</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Livraison
              </label>
              <select
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
                className="input"
              >
                <option value="pickup">Retrait sur place</option>
                <option value="delivery">Livraison</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes cliniques
              </label>
              <textarea
                value={notes.clinical}
                onChange={(e) => setNotes({ ...notes, clinical: e.target.value })}
                className="input"
                rows="3"
                placeholder="Notes pour le dossier patient..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes de production
              </label>
              <textarea
                value={notes.production}
                onChange={(e) => setNotes({ ...notes, production: e.target.value })}
                className="input"
                rows="3"
                placeholder="Instructions pour le laboratoire..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex items-center"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Créer la commande
              </>
            )}
          </button>
        </div>
      </form>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
