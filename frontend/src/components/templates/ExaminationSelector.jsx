import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ExaminationSelector = ({ onAddExamination }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [examinations, setExaminations] = useState([]);
  const [selectedExamination, setSelectedExamination] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/template-catalog/examinations/categories');
        setCategories(response.data.data || []);
      } catch (error) {
        console.error('Error fetching examination categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch examinations when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setExaminations([]);
      return;
    }

    const fetchExaminations = async () => {
      try {
        const response = await api.get(`/template-catalog/examinations?category=${selectedCategory}`);
        setExaminations(response.data.data || []);
      } catch (error) {
        console.error('Error fetching examinations:', error);
      }
    };
    fetchExaminations();
  }, [selectedCategory]);

  const handleAddExamination = () => {
    if (!selectedExamination) return;

    const examination = {
      template: selectedExamination._id,
      category: selectedExamination.category,
      examinationName: selectedExamination.name,
      examinationCode: selectedExamination.code,
      scheduledDate: scheduledDate || undefined,
      notes
    };

    onAddExamination(examination);

    // Reset
    setSelectedExamination(null);
    setScheduledDate('');
    setNotes('');
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-lg mb-4">Commander un examen</h3>

      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setSelectedExamination(null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sélectionner une catégorie</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Examination Selection */}
      {examinations.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Examen</label>
          <select
            value={selectedExamination?._id || ''}
            onChange={(e) => {
              const exam = examinations.find(ex => ex._id === e.target.value);
              setSelectedExamination(exam);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner un examen</option>
            {examinations.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.name}
                {exam.description && ` - ${exam.description}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Examination Details - Only show when examination is selected */}
      {selectedExamination && (
        <>
          {/* Examination Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="font-medium text-blue-900">{selectedExamination.name}</div>
            {selectedExamination.description && (
              <div className="text-sm text-blue-700 mt-1">{selectedExamination.description}</div>
            )}
            <div className="text-xs text-blue-600 mt-2 space-y-1">
              {selectedExamination.duration && (
                <div>Durée: {selectedExamination.duration} minutes</div>
              )}
              {selectedExamination.requiresAnesthesia && (
                <div className="text-red-600">⚠️ Nécessite une anesthésie</div>
              )}
              {selectedExamination.requiresDilation && (
                <div className="text-orange-600">⚠️ Nécessite une dilatation pupillaire</div>
              )}
              {selectedExamination.price > 0 && (
                <div>Prix: {selectedExamination.price.toLocaleString()} CFA</div>
              )}
            </div>
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date prévue (optionnel)
            </label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Instructions ou indications cliniques..."
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddExamination}
            className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
          >
            Commander cet examen
          </button>
        </>
      )}
    </div>
  );
};

export default ExaminationSelector;
