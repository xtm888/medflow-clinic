/**
 * NewSurgeryCase - Create a new surgery case
 *
 * Allows creating a surgery case by:
 * - Selecting a patient
 * - Selecting surgery type
 * - Adding clinical notes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scissors, ArrowLeft, Search, User, Eye, AlertCircle,
  Loader2, CheckCircle, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import surgeryService from '../../services/surgeryService';
import patientService from '../../services/patientService';

export default function NewSurgeryCase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const searchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Surgery types
  const [surgeryTypes, setSurgeryTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedEye, setSelectedEye] = useState('');
  const [priority, setPriority] = useState('routine');
  const [notes, setNotes] = useState('');

  // Fetch surgery types on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        setLoading(true);
        const response = await surgeryService.getSurgeryTypes();
        setSurgeryTypes(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching surgery types:', err);
        toast.error('Erreur lors du chargement des types de chirurgie');
      } finally {
        setLoading(false);
      }
    };
    fetchTypes();
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search patients
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        setShowResults(true);
        const response = await patientService.searchPatients(searchQuery.trim());
        setSearchResults(response.data || response || []);
      } catch (err) {
        console.error('Error searching patients:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast.warning('Veuillez sélectionner un patient');
      return;
    }

    if (!selectedType) {
      toast.warning('Veuillez sélectionner un type de chirurgie');
      return;
    }

    if (!selectedEye) {
      toast.warning('Veuillez sélectionner l\'oeil concerné');
      return;
    }

    try {
      setSubmitting(true);

      const caseData = {
        patient: selectedPatient._id,
        surgeryType: selectedType,
        eye: selectedEye,
        priority,
        clinicalNotes: notes,
        status: 'awaiting_scheduling'
      };

      await surgeryService.createCase(caseData);
      toast.success('Cas chirurgical créé avec succès');
      navigate('/surgery');
    } catch (err) {
      console.error('Error creating surgery case:', err);
      toast.error(err.message || 'Erreur lors de la création du cas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/surgery')}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="h-6 w-6 text-purple-600" />
            Nouveau Cas Chirurgical
          </h1>
          <p className="text-sm text-gray-500">Créer un nouveau cas pour programmation</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        {/* Patient Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient *
          </label>

          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-full">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedPatient.fileNumber || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="p-1 hover:bg-purple-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          ) : (
            <div ref={searchContainerRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un patient par nom ou numéro de dossier..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((patient) => (
                    <button
                      key={patient._id}
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                    >
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {patient.fileNumber || 'Sans numéro'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                  Aucun patient trouvé
                </div>
              )}
            </div>
          )}
        </div>

        {/* Surgery Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de chirurgie *
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Sélectionner un type</option>
            {surgeryTypes.map((type) => (
              <option key={type.code || type._id} value={type.code || type.name}>
                {type.name}
              </option>
            ))}
            {/* Default options if no types loaded */}
            {surgeryTypes.length === 0 && (
              <>
                <option value="cataract">Cataracte</option>
                <option value="glaucoma">Glaucome</option>
                <option value="retina">Rétine</option>
                <option value="oculoplastic">Oculoplastique</option>
                <option value="cornea">Cornée</option>
                <option value="refractive">Réfractive</option>
                <option value="strabismus">Strabisme</option>
                <option value="other">Autre</option>
              </>
            )}
          </select>
        </div>

        {/* Eye Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Oeil concerné *
          </label>
          <div className="flex gap-4">
            {[
              { value: 'OD', label: 'Oeil Droit (OD)' },
              { value: 'OG', label: 'Oeil Gauche (OG)' },
              { value: 'ODG', label: 'Les deux (ODG)' }
            ].map((option) => (
              <label
                key={option.value}
                className={`
                  flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer
                  transition-colors
                  ${selectedEye === option.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <input
                  type="radio"
                  name="eye"
                  value={option.value}
                  checked={selectedEye === option.value}
                  onChange={(e) => setSelectedEye(e.target.value)}
                  className="sr-only"
                />
                <Eye className="h-5 w-5" />
                <span className="font-medium">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priorité
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Urgence</option>
          </select>
        </div>

        {/* Clinical Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes cliniques
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Indications, antécédents pertinents, particularités..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/surgery')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedPatient || !selectedType || !selectedEye}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Création...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                <span>Créer le cas</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
