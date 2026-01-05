import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  User,
  Calendar,
  Clock,
  Package,
  Truck,
  Phone,
  Mail,
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Printer,
  Edit,
  Bell
} from 'lucide-react';
import glassesOrderService from '../../services/glassesOrderService';

const GlassesOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Handle "new" route - redirect to optical shop for creating new orders
    if (id === 'new') {
      navigate('/optical-shop', {
        replace: true,
        state: { message: 'Pour créer une nouvelle commande de lunettes, utilisez la Boutique Optique.' }
      });
      return;
    }

    // Validate that id looks like a valid MongoDB ObjectId (24 hex chars)
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      setError('Identifiant de commande invalide');
      setLoading(false);
      return;
    }

    fetchOrder();
  }, [id, navigate]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await glassesOrderService.getOrderWithInventory(id);
      setOrder(response.data);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Erreur lors du chargement de la commande');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      await glassesOrderService.updateStatus(id, newStatus);
      fetchOrder();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handleReceive = async () => {
    const notes = prompt('Notes de réception (optionnel):');
    try {
      await glassesOrderService.receiveFromLab(id, { notes });
      fetchOrder();
    } catch (err) {
      console.error('Error receiving:', err);
      alert('Erreur lors de la réception');
    }
  };

  const handleQC = async (passed) => {
    try {
      await glassesOrderService.performQC(id, {
        passed,
        checklist: {
          lensClarity: { passed: true },
          prescriptionAccuracy: { passed: true },
          frameCondition: { passed: true },
          coatingsApplied: { passed: true },
          fitAndAlignment: { passed: true },
          cleanlinessPackaging: { passed: true }
        },
        overallNotes: passed ? 'Contrôle qualité passé' : 'Problèmes détectés'
      });
      fetchOrder();
    } catch (err) {
      console.error('Error performing QC:', err);
      alert('Erreur lors du contrôle qualité');
    }
  };

  const handleSendReminder = async () => {
    try {
      await glassesOrderService.sendPickupReminder(id);
      alert('Rappel envoyé avec succès');
    } catch (err) {
      console.error('Error sending reminder:', err);
      alert('Erreur lors de l\'envoi du rappel');
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const response = await glassesOrderService.generateInvoice(id);
      alert(`Facture ${response.data.invoiceId} créée avec succès`);
      fetchOrder();
    } catch (err) {
      console.error('Error generating invoice:', err);
      alert(err.response?.data?.error || 'Erreur lors de la création de la facture');
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

  const statusConfig = {
    'draft': { color: 'bg-gray-100 text-gray-800', label: 'Brouillon' },
    'confirmed': { color: 'bg-blue-100 text-blue-800', label: 'Confirmé' },
    'sent-to-lab': { color: 'bg-purple-100 text-purple-800', label: 'Envoyé au labo' },
    'in-production': { color: 'bg-yellow-100 text-yellow-800', label: 'En production' },
    'received': { color: 'bg-indigo-100 text-indigo-800', label: 'Reçu du labo' },
    'qc-passed': { color: 'bg-teal-100 text-teal-800', label: 'QC Passé' },
    'qc-failed': { color: 'bg-red-100 text-red-800', label: 'QC Échoué' },
    'ready': { color: 'bg-green-100 text-green-800', label: 'Prêt à retirer' },
    'delivered': { color: 'bg-emerald-100 text-emerald-800', label: 'Livré' },
    'cancelled': { color: 'bg-red-100 text-red-800', label: 'Annulé' }
  };

  const currentStatus = statusConfig[order.status] || statusConfig.draft;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/glasses-orders')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              Commande {order.orderNumber}
              <span className={`px-3 py-1 text-sm rounded-full ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            </h1>
            <p className="text-gray-500">
              Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
          {!order.invoice && (
            <button
              onClick={handleGenerateInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <DollarSign className="w-4 h-4" />
              Créer Facture
            </button>
          )}
        </div>
      </div>

      {/* Prescription Changed Warning */}
      {order.prescriptionChanged && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Prescription modifiée</p>
            <p className="text-sm text-yellow-700">{order.prescriptionWarning}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              Informations Patient
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nom</p>
                <p className="font-medium">{order.patient?.firstName} {order.patient?.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {order.patient?.phoneNumber || 'Non renseigné'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {order.patient?.email || 'Non renseigné'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date de naissance</p>
                <p className="font-medium">
                  {order.patient?.dateOfBirth ? new Date(order.patient.dateOfBirth).toLocaleDateString('fr-FR') : 'Non renseigné'}
                </p>
              </div>
            </div>
          </div>

          {/* Prescription Data */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-400" />
              Données Prescription
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Oeil</th>
                    <th className="py-2 text-center">Sphere</th>
                    <th className="py-2 text-center">Cylindre</th>
                    <th className="py-2 text-center">Axe</th>
                    <th className="py-2 text-center">Addition</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium">OD (Droit)</td>
                    <td className="py-2 text-center">{order.rightLens?.sphere || order.prescriptionData?.od?.sphere || '-'}</td>
                    <td className="py-2 text-center">{order.rightLens?.cylinder || order.prescriptionData?.od?.cylinder || '-'}</td>
                    <td className="py-2 text-center">{order.rightLens?.axis || order.prescriptionData?.od?.axis || '-'}</td>
                    <td className="py-2 text-center">{order.rightLens?.add || order.prescriptionData?.od?.add || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">OS (Gauche)</td>
                    <td className="py-2 text-center">{order.leftLens?.sphere || order.prescriptionData?.os?.sphere || '-'}</td>
                    <td className="py-2 text-center">{order.leftLens?.cylinder || order.prescriptionData?.os?.cylinder || '-'}</td>
                    <td className="py-2 text-center">{order.leftLens?.axis || order.prescriptionData?.os?.axis || '-'}</td>
                    <td className="py-2 text-center">{order.leftLens?.add || order.prescriptionData?.os?.add || '-'}</td>
                  </tr>
                </tbody>
              </table>
              {(order.measurements?.pd || order.prescriptionData?.pd) && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">Ecart Pupillaire (PD)</p>
                  <p className="font-medium">
                    {order.measurements?.pd || order.prescriptionData?.pd?.binocular || '-'} mm
                    {(order.measurements?.pdRight || order.prescriptionData?.pd?.monocularOd) && ` | OD: ${order.measurements?.pdRight || order.prescriptionData?.pd?.monocularOd} mm`}
                    {(order.measurements?.pdLeft || order.prescriptionData?.pd?.monocularOs) && ` | OS: ${order.measurements?.pdLeft || order.prescriptionData?.pd?.monocularOs} mm`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Glasses Specs */}
          {(order.frame || order.lensType || order.glasses) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                Specifications Lunettes
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type de verre</p>
                  <p className="font-medium capitalize">
                    {order.lensType?.design || order.glasses?.lensType || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Materiau</p>
                  <p className="font-medium capitalize">
                    {order.lensType?.material || order.glasses?.lensMaterial || '-'}
                  </p>
                </div>
                {(order.lensOptions || order.glasses?.coatings)?.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Traitements</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(order.lensOptions || order.glasses?.coatings || []).map((opt, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded capitalize">
                          {typeof opt === 'string' ? opt : opt.name || opt.type || opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(order.frame || order.glasses?.frame) && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Monture</p>
                      <p className="font-medium">
                        {order.frame?.brand || order.glasses?.frame?.brand} {order.frame?.model || order.glasses?.frame?.model}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Couleur / Taille</p>
                      <p className="font-medium">
                        {order.frame?.color || order.glasses?.frame?.color} / {order.frame?.size || order.glasses?.frame?.size || '-'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* QC Results */}
          {order.qualityControl && order.qualityControl.inspectedAt && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-gray-400" />
                Contrôle Qualité
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Statut QC</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    order.qualityControl.status === 'passed' ? 'bg-green-100 text-green-800' :
                    order.qualityControl.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.qualityControl.status === 'passed' ? 'Passé' :
                     order.qualityControl.status === 'failed' ? 'Échoué' : 'En attente'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Inspecté le</span>
                  <span>{new Date(order.qualityControl.inspectedAt).toLocaleString('fr-FR')}</span>
                </div>
                {order.qualityControl.overrideApproved && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm font-medium text-yellow-800">Override approuvé</p>
                    <p className="text-sm text-yellow-700">{order.qualityControl.overrideReason}</p>
                  </div>
                )}
                {order.qualityControl.issues?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Problèmes détectés:</p>
                    {order.qualityControl.issues.map((issue, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded mb-2">
                        <p className="text-sm font-medium text-red-800">{issue.category}: {issue.description}</p>
                        <p className="text-xs text-red-600">Sévérité: {issue.severity}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Info */}
          {order.delivery && order.delivery.completedAt && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-gray-400" />
                Informations de Livraison
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date de livraison</p>
                  <p className="font-medium">{new Date(order.delivery.completedAt).toLocaleString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Méthode</p>
                  <p className="font-medium">
                    {order.delivery.method === 'pickup' ? 'Retrait en magasin' :
                     order.delivery.method === 'delivery' ? 'Livraison' : 'Expédition'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Réceptionnaire</p>
                  <p className="font-medium">{order.delivery.recipient?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Relation</p>
                  <p className="font-medium">
                    {order.delivery.recipient?.relationship === 'self' ? 'Patient' :
                     order.delivery.recipient?.relationship === 'family' ? 'Famille' :
                     order.delivery.recipient?.relationship === 'caregiver' ? 'Accompagnant' : 'Autre'}
                  </p>
                </div>
              </div>
              {order.delivery.signature?.dataUrl && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">Signature</p>
                  <img
                    src={order.delivery.signature.dataUrl}
                    alt="Signature"
                    className="max-w-xs border rounded"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              {order.status === 'draft' && (
                <button
                  onClick={() => handleStatusUpdate('confirmed')}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Confirmer la commande
                </button>
              )}

              {order.status === 'confirmed' && (
                <button
                  onClick={() => handleStatusUpdate('sent-to-lab')}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Envoyer au laboratoire
                </button>
              )}

              {order.status === 'sent-to-lab' && (
                <button
                  onClick={() => handleStatusUpdate('in-production')}
                  className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Marquer en production
                </button>
              )}

              {order.status === 'in-production' && (
                <button
                  onClick={handleReceive}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Réceptionner du labo
                </button>
              )}

              {(order.status === 'received' || order.status === 'qc-failed') && (
                <>
                  <button
                    onClick={() => handleQC(true)}
                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    QC Passé
                  </button>
                  <button
                    onClick={() => handleQC(false)}
                    className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    QC Échoué
                  </button>
                </>
              )}

              {order.status === 'qc-passed' && (
                <button
                  onClick={() => handleStatusUpdate('ready')}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Marquer prêt à retirer
                </button>
              )}

              {order.status === 'ready' && (
                <>
                  <button
                    onClick={() => navigate(`/glasses-orders/${id}/deliver`)}
                    className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" />
                    Procéder à la livraison
                  </button>
                  <button
                    onClick={handleSendReminder}
                    className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Envoyer rappel au patient
                  </button>
                </>
              )}

              {!['delivered', 'cancelled'].includes(order.status) && (
                <button
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir annuler cette commande?')) {
                      handleStatusUpdate('cancelled');
                    }
                  }}
                  className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Annuler la commande
                </button>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Résumé</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Type</span>
                <span className="font-medium">
                  {order.orderType === 'glasses' ? 'Lunettes' :
                   order.orderType === 'contact-lenses' ? 'Lentilles' : 'Les deux'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Priorité</span>
                <span className={`font-medium ${
                  order.priority === 'rush' ? 'text-red-600' :
                  order.priority === 'urgent' ? 'text-orange-600' : ''
                }`}>
                  {order.priority === 'rush' ? 'RUSH' :
                   order.priority === 'urgent' ? 'Urgent' : 'Normal'}
                </span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sous-total</span>
                  <span>{(order.pricing?.subtotal || order.subtotal || 0).toLocaleString()} CDF</span>
                </div>
                {(order.pricing?.discount > 0 || order.discount > 0) && (
                  <div className="flex justify-between text-green-600">
                    <span>Remise</span>
                    <span>-{(order.pricing?.discount || order.discount || 0).toLocaleString()} CDF</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total</span>
                  <span>{(order.pricing?.finalTotal || order.total || 0).toLocaleString()} CDF</span>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-600">Paiement</span>
                <span className={`font-medium ${
                  order.paymentStatus === 'paid' ? 'text-green-600' :
                  order.paymentStatus === 'partial' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {order.paymentStatus === 'paid' ? 'Payé' :
                   order.paymentStatus === 'partial' ? 'Partiel' : 'Non payé'}
                </span>
              </div>
            </div>
          </div>

          {/* Invoice Link */}
          {order.invoice && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Facture
              </h2>
              <Link
                to={`/invoices/${order.invoice._id || order.invoice}`}
                className="text-blue-600 hover:text-blue-800"
              >
                Voir la facture →
              </Link>
            </div>
          )}

          {/* Timeline */}
          {order.timeline && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                Historique
              </h2>
              <div className="space-y-3 text-sm">
                {order.timeline.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Créée</span>
                    <span>{new Date(order.timeline.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {order.timeline.confirmedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Confirmée</span>
                    <span>{new Date(order.timeline.confirmedAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {order.timeline.sentToLabAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Envoyée au labo</span>
                    <span>{new Date(order.timeline.sentToLabAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {order.timeline.readyAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prête</span>
                    <span>{new Date(order.timeline.readyAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {order.timeline.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Livrée</span>
                    <span>{new Date(order.timeline.deliveredAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlassesOrderDetail;
