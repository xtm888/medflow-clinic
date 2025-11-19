import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const LaboratoryTestSelector = ({ onAddTest }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tests, setTests] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [priority, setPriority] = useState('routine');
  const [notes, setNotes] = useState('');

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/template-catalog/laboratories/categories');
        setCategories(response.data.data || []);
      } catch (error) {
        console.error('Error fetching lab categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch profiles on mount
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await api.get('/template-catalog/laboratories/profiles');
        setProfiles(response.data.data || []);
      } catch (error) {
        console.error('Error fetching lab profiles:', error);
      }
    };
    fetchProfiles();
  }, []);

  // Fetch tests when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setTests([]);
      return;
    }

    const fetchTests = async () => {
      try {
        const response = await api.get(`/template-catalog/laboratories?category=${selectedCategory}&isProfile=false`);
        setTests(response.data.data || []);
      } catch (error) {
        console.error('Error fetching lab tests:', error);
      }
    };
    fetchTests();
  }, [selectedCategory]);

  const handleToggleTest = (test) => {
    setSelectedTests((prev) => {
      const exists = prev.find(t => t._id === test._id);
      if (exists) {
        return prev.filter(t => t._id !== test._id);
      } else {
        return [...prev, test];
      }
    });
  };

  const handleSelectProfile = (profile) => {
    setSelectedProfile(profile);
    // Add all tests from the profile to selected tests
    if (profile && profile.profileTests) {
      const profileTests = profile.profileTests.map(test => ({
        ...test,
        isFromProfile: true,
        profileName: profile.name
      }));
      setSelectedTests((prev) => {
        // Merge without duplicates
        const combined = [...prev];
        profileTests.forEach(test => {
          if (!combined.find(t => t._id === test._id)) {
            combined.push(test);
          }
        });
        return combined;
      });
    }
  };

  const handleAddTests = () => {
    if (selectedTests.length === 0) return;

    const testsToAdd = selectedTests.map(test => ({
      template: test._id,
      category: test.category,
      testName: test.name,
      testCode: test.code,
      specimen: test.specimen,
      priority,
      notes: test.isFromProfile ? `Profil: ${test.profileName}. ${notes}` : notes
    }));

    testsToAdd.forEach(test => onAddTest(test));

    // Reset
    setSelectedTests([]);
    setSelectedProfile(null);
    setPriority('routine');
    setNotes('');
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-lg mb-4">Commander des examens de laboratoire</h3>

      {/* Profiles Section */}
      {profiles.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profils pré-définis</label>
          <select
            value={selectedProfile?._id || ''}
            onChange={(e) => {
              const profile = profiles.find(p => p._id === e.target.value);
              handleSelectProfile(profile);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner un profil</option>
            {profiles.map((profile) => (
              <option key={profile._id} value={profile._id}>
                {profile.name} ({profile.profileTests?.length || 0} tests)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sélectionner une catégorie</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Tests Selection */}
      {tests.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tests disponibles</label>
          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 bg-white">
            {tests.map((test) => (
              <label
                key={test._id}
                className="flex items-start p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTests.some(t => t._id === test._id)}
                  onChange={() => handleToggleTest(test)}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{test.name}</div>
                  {test.description && (
                    <div className="text-sm text-gray-600">{test.description}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {test.specimen && <span>Spécimen: {test.specimen}</span>}
                    {test.normalRange && <span className="ml-3">Valeurs normales: {test.normalRange}</span>}
                    {test.unit && <span className="ml-3">Unité: {test.unit}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Selected Tests Count */}
      {selectedTests.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="text-sm font-medium text-blue-900">
            {selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} sélectionné{selectedTests.length > 1 ? 's' : ''}
          </div>
          <div className="text-xs text-blue-700 mt-1">
            {selectedTests.map(t => t.name).join(', ')}
          </div>
        </div>
      )}

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Instructions ou notes cliniques..."
        />
      </div>

      {/* Add Button */}
      <button
        onClick={handleAddTests}
        disabled={selectedTests.length === 0}
        className={`w-full px-4 py-2 rounded-md transition-colors ${
          selectedTests.length === 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        Ajouter {selectedTests.length} test{selectedTests.length > 1 ? 's' : ''}
      </button>
    </div>
  );
};

export default LaboratoryTestSelector;
