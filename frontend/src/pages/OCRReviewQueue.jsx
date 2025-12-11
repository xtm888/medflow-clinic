/**
 * OCR Review Queue - Manual patient linking interface
 * For documents that couldn't be automatically matched to patients
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileImage,
  User,
  Search,
  Link2,
  SkipForward,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  Percent
} from 'lucide-react';
import { toast } from 'react-toastify';
import ocrImportService from '../services/ocrImportService';

const OCRReviewQueue = () => {
  const navigate = useNavigate();

  // Queue state
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  // Selected document
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Actions
  const [linking, setLinking] = useState(false);

  // Load queue on mount
  useEffect(() => {
    loadQueue();
  }, [pagination.page]);

  // Debounced patient search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchPatients(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const result = await ocrImportService.getReviewQueue(pagination.page, pagination.limit);
      setDocuments(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.pagination?.total || 0,
        pages: result.pagination?.pages || 1
      }));

      // Auto-select first document
      if (result.data?.length > 0 && !selectedDoc) {
        setSelectedDoc(result.data[0]);
      }
    } catch (err) {
      toast.error('Erreur lors du chargement de la file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async (query) => {
    setSearching(true);
    try {
      const result = await ocrImportService.searchPatients(query, 10);
      setSearchResults(result.data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleLinkPatient = async (patientId) => {
    if (!selectedDoc) return;

    setLinking(true);
    try {
      await ocrImportService.linkToPatient(selectedDoc._id, patientId);
      toast.success('Document lié au patient');

      // Remove from queue and select next
      const currentIndex = documents.findIndex(d => d._id === selectedDoc._id);
      const newDocs = documents.filter(d => d._id !== selectedDoc._id);
      setDocuments(newDocs);

      if (newDocs.length > 0) {
        setSelectedDoc(newDocs[Math.min(currentIndex, newDocs.length - 1)]);
      } else {
        setSelectedDoc(null);
      }

      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      toast.error('Erreur lors de la liaison');
    } finally {
      setLinking(false);
    }
  };

  const handleSkipDocument = async (reason = '') => {
    if (!selectedDoc) return;

    try {
      await ocrImportService.skipDocument(selectedDoc._id, reason);
      toast.info('Document ignoré');

      // Remove from queue and select next
      const currentIndex = documents.findIndex(d => d._id === selectedDoc._id);
      const newDocs = documents.filter(d => d._id !== selectedDoc._id);
      setDocuments(newDocs);

      if (newDocs.length > 0) {
        setSelectedDoc(newDocs[Math.min(currentIndex, newDocs.length - 1)]);
      } else {
        setSelectedDoc(null);
      }
    } catch (err) {
      toast.error('Erreur lors de l\'action');
    }
  };

  const formatConfidence = (confidence) => {
    if (!confidence) return '0%';
    return `${Math.round(confidence * 100)}%`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-100';
    if (confidence >= 0.5) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/devices')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">File de révision OCR</h1>
              <p className="text-sm text-gray-500">
                {pagination.total} documents en attente de liaison
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/ocr/import')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Nouvel import
            </button>
            <button
              onClick={loadQueue}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document list (left panel) */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-medium text-gray-900">Documents ({documents.length})</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>Tous les documents ont été traités !</p>
              </div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc._id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedDoc?._id === doc._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      {doc.metadata?.thumbnailPath ? (
                        <img
                          src={`/api/documents/thumbnail/${doc._id}`}
                          alt=""
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <FileImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {doc.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {doc.metadata?.deviceType || 'Inconnu'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getConfidenceColor(doc.customFields?.matchConfidence)}`}>
                          {formatConfidence(doc.customFields?.matchConfidence)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} / {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Document detail (center panel) */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedDoc ? (
            <>
              {/* Document preview */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                  {/* Preview image/info */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-start gap-6">
                      {/* Thumbnail */}
                      <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {selectedDoc.metadata?.thumbnailPath ? (
                          <img
                            src={`/api/documents/thumbnail/${selectedDoc._id}`}
                            alt=""
                            className="w-full h-full object-contain rounded-lg"
                          />
                        ) : (
                          <FileImage className="w-16 h-16 text-gray-300" />
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{selectedDoc.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {selectedDoc.file?.path}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                          <div>
                            <span className="text-gray-500">Type d'appareil</span>
                            <p className="font-medium">{selectedDoc.metadata?.deviceType || 'Non défini'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Confiance</span>
                            <p className={`font-medium ${getConfidenceColor(selectedDoc.customFields?.matchConfidence).split(' ')[0]}`}>
                              {formatConfidence(selectedDoc.customFields?.matchConfidence)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Importé le</span>
                            <p className="font-medium">
                              {new Date(selectedDoc.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extracted info */}
                  {selectedDoc.metadata?.extractedInfo && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Informations extraites (OCR)
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {selectedDoc.metadata.extractedInfo.last_name && (
                          <div>
                            <span className="text-gray-500">Nom</span>
                            <p className="font-medium">{selectedDoc.metadata.extractedInfo.last_name}</p>
                          </div>
                        )}
                        {selectedDoc.metadata.extractedInfo.first_name && (
                          <div>
                            <span className="text-gray-500">Prénom</span>
                            <p className="font-medium">{selectedDoc.metadata.extractedInfo.first_name}</p>
                          </div>
                        )}
                        {selectedDoc.metadata.extractedInfo.patient_id && (
                          <div>
                            <span className="text-gray-500">ID Patient</span>
                            <p className="font-medium">{selectedDoc.metadata.extractedInfo.patient_id}</p>
                          </div>
                        )}
                        {selectedDoc.metadata.extractedInfo.date_of_birth && (
                          <div>
                            <span className="text-gray-500">Date de naissance</span>
                            <p className="font-medium">
                              {new Date(selectedDoc.metadata.extractedInfo.date_of_birth).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        )}
                        {selectedDoc.metadata.extractedInfo.laterality && (
                          <div>
                            <span className="text-gray-500">Latéralité</span>
                            <p className="font-medium">{selectedDoc.metadata.extractedInfo.laterality}</p>
                          </div>
                        )}
                      </div>

                      {selectedDoc.metadata.extractedInfo.raw_text && (
                        <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600 max-h-32 overflow-y-auto">
                          <p className="font-medium text-gray-700 mb-1">Texte brut:</p>
                          {selectedDoc.metadata.extractedInfo.raw_text}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested patient */}
                  {selectedDoc.suggestedPatient && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <h4 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Patient suggéré
                      </h4>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {selectedDoc.suggestedPatient.firstName} {selectedDoc.suggestedPatient.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            ID: {selectedDoc.suggestedPatient.patientId}
                            {selectedDoc.suggestedPatient.dateOfBirth && (
                              <> • Né(e) le {new Date(selectedDoc.suggestedPatient.dateOfBirth).toLocaleDateString('fr-FR')}</>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLinkPatient(selectedDoc.suggestedPatient._id)}
                          disabled={linking}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                          Lier
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions bar (bottom) */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="max-w-2xl mx-auto">
                  {/* Patient search */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rechercher un patient
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Nom, prénom ou ID patient..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {/* Search results */}
                    {searchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {searchResults.map((patient) => (
                          <button
                            key={patient._id}
                            onClick={() => handleLinkPatient(patient._id)}
                            disabled={linking}
                            className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-gray-900">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-sm text-gray-500">
                                ID: {patient.patientId}
                                {patient.dateOfBirth && (
                                  <> • {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}</>
                                )}
                              </p>
                            </div>
                            <Link2 className="w-5 h-5 text-blue-600" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSkipDocument('Non pertinent')}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
                    >
                      <SkipForward className="w-4 h-4" />
                      Ignorer ce document
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => window.open(selectedDoc.file?.path, '_blank')}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Voir le fichier
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileImage className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Sélectionnez un document pour le réviser</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRReviewQueue;
