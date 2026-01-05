import React, { useState, useEffect } from 'react';
import api from '../../services/apiConfig';

const PathologyFindingSelector = ({ category, onAddFinding }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(category || '');
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [findings, setFindings] = useState([]);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Metadata
  const [laterality, setLaterality] = useState('');
  const [severity, setSeverity] = useState('');
  const [location, setLocation] = useState('');
  const [clockPosition, setClockPosition] = useState('');
  const [notes, setNotes] = useState('');

  const lateralityOptions = ['OD', 'OG', 'ODG', 'Droite', 'Gauche', 'Bilatéral'];
  const severityOptions = ['-', '+/-', '+', '++', '+++', '++++', '0'];
  const locationOptions = ['Nasal', 'Temporal', 'Inférieur', 'Supérieur', 'Central', 'Périphérique'];
  const clockOptions = ['1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h', 'toute la périph'];

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/template-catalog/pathologies/categories');
        // Handle various API response formats defensively
        const data = Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
          ? response.data
          : [];
        setCategories(data);
      } catch (error) {
        console.error('Error fetching pathology categories:', error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setSubcategories([]);
      return;
    }

    const fetchSubcategories = async () => {
      try {
        const response = await api.get(`/template-catalog/pathologies/subcategories?category=${selectedCategory}`);
        // Handle various API response formats defensively
        const data = Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
          ? response.data
          : [];
        setSubcategories(data);
      } catch (error) {
        console.error('Error fetching subcategories:', error);
        setSubcategories([]);
      }
    };
    fetchSubcategories();
  }, [selectedCategory]);

  // Fetch findings when category/subcategory changes
  useEffect(() => {
    if (!selectedCategory) {
      setFindings([]);
      return;
    }

    const fetchFindings = async () => {
      try {
        let url = `/template-catalog/pathologies?category=${selectedCategory}`;
        if (selectedSubcategory) {
          url += `&subcategory=${selectedSubcategory}`;
        }
        const response = await api.get(url);
        // Handle various API response formats defensively
        const data = Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
          ? response.data
          : [];
        setFindings(data);
      } catch (error) {
        console.error('Error fetching findings:', error);
        setFindings([]);
      }
    };
    fetchFindings();
  }, [selectedCategory, selectedSubcategory]);

  const handleAddFinding = () => {
    if (!selectedFinding) return;

    const finding = {
      template: selectedFinding._id,
      category: selectedFinding.category,
      subcategory: selectedFinding.subcategory,
      type: selectedFinding.type,
      name: selectedFinding.name,
      value: selectedFinding.value,
      laterality,
      severity,
      location,
      clockPosition,
      notes
    };

    onAddFinding(finding);

    // Reset metadata
    setSelectedFinding(null);
    setLaterality('');
    setSeverity('');
    setLocation('');
    setClockPosition('');
    setNotes('');
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-lg mb-4">Ajouter un résultat pathologique</h3>

      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setSelectedSubcategory('');
            setSelectedFinding(null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sélectionner une catégorie</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Subcategory Selection */}
      {subcategories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sous-catégorie</label>
          <select
            value={selectedSubcategory}
            onChange={(e) => {
              setSelectedSubcategory(e.target.value);
              setSelectedFinding(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les sous-catégories</option>
            {subcategories.map((subcat) => (
              <option key={subcat} value={subcat}>{subcat}</option>
            ))}
          </select>
        </div>
      )}

      {/* Finding Selection */}
      {findings.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Résultat</label>
          <select
            value={selectedFinding?._id || ''}
            onChange={(e) => {
              const finding = findings.find(f => f._id === e.target.value);
              setSelectedFinding(finding);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner un résultat</option>
            {findings.map((finding) => (
              <option key={finding._id} value={finding._id}>
                {finding.name} {finding.type && `(${finding.type})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Metadata - Only show when finding is selected */}
      {selectedFinding && (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* Laterality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latéralité</label>
              <select
                value={laterality}
                onChange={(e) => setLaterality(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">--</option>
                {lateralityOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sévérité</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">--</option>
                {severityOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localisation</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">--</option>
                {locationOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Clock Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position horaire</label>
              <select
                value={clockPosition}
                onChange={(e) => setClockPosition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">--</option>
                {clockOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Notes additionnelles..."
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddFinding}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Ajouter le résultat
          </button>
        </>
      )}
    </div>
  );
};

export default PathologyFindingSelector;
