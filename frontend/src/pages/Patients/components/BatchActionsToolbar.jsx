/**
 * BatchActionsToolbar Component
 *
 * Floating toolbar for batch patient operations.
 */

import { Download, Calendar, Mail, X, CheckSquare } from 'lucide-react';

export default function BatchActionsToolbar({
  selectedCount,
  batchActionLoading,
  handleBatchExport,
  handleBatchBookAppointments,
  handleBatchSendMessage,
  clearSelection
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 px-4 py-3 flex items-center gap-4">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
          <CheckSquare className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
        </div>

        {/* Batch actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchExport}
            disabled={batchActionLoading}
            className="btn btn-secondary text-sm px-3 py-2 flex items-center gap-2"
            title="Exporter la sélection"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter</span>
          </button>

          <button
            onClick={handleBatchBookAppointments}
            disabled={batchActionLoading}
            className="btn btn-secondary text-sm px-3 py-2 flex items-center gap-2"
            title="Prendre RDV pour la sélection"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">RDV groupé</span>
          </button>

          <button
            onClick={handleBatchSendMessage}
            disabled={batchActionLoading}
            className="btn btn-secondary text-sm px-3 py-2 flex items-center gap-2"
            title="Envoyer message groupé"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Message</span>
          </button>

          <div className="w-px h-6 bg-gray-200"></div>

          <button
            onClick={clearSelection}
            className="btn btn-ghost text-sm px-3 py-2 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Annuler</span>
          </button>
        </div>
      </div>
    </div>
  );
}
