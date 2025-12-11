import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Eye, Calendar, User, Image as ImageIcon, ZoomIn, Download, FileText,
  Layers, Grid3X3, SplitSquareHorizontal, Filter, Search, Clock,
  ChevronDown, Check, TrendingUp
} from 'lucide-react';
import ophthalmologyService from '../services/ophthalmologyService';
import ImageComparisonViewer from '../components/imaging/ImageComparisonViewer';

export default function Imaging() {
  const [searchParams] = useSearchParams();
  const patientIdFilter = searchParams.get('patientId');

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterEye, setFilterEye] = useState('all');
  const [filterPatient, setFilterPatient] = useState(patientIdFilter || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'timeline', 'patient-grouped'

  // Comparison mode state
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [showComparisonViewer, setShowComparisonViewer] = useState(false);

  useEffect(() => {
    loadExamsWithImages();
  }, []);

  // Generate demo images from real clinical images
  const generateDemoImages = () => {
    // Real clinical images from the clinic
    const clinicalImages = [
      {
        filename: '004_MAHANA MUPONGO_PITSHOU BONIFACE_15052025_134829_OCTReport_L_001.jpg',
        patientName: 'MAHANA MUPONGO PITSHOU BONIFACE',
        type: 'oct',
        eye: 'OS',
        caption: 'OCT Report - Œil Gauche',
        date: '2025-05-15'
      },
      {
        filename: '004_MAHANA MUPONGO_PITSHOU BONIFACE_15052025_134909_OCTReport_R_001.jpg',
        patientName: 'MAHANA MUPONGO PITSHOU BONIFACE',
        type: 'oct',
        eye: 'OD',
        caption: 'OCT Report - Œil Droit',
        date: '2025-05-15'
      },
      {
        filename: '004_MAHANA MUPONGO_PITSHOU BONIFACE_15052025_134944_OCTReport_L_001.jpg',
        patientName: 'MAHANA MUPONGO PITSHOU BONIFACE',
        type: 'oct',
        eye: 'OS',
        caption: 'OCT Report - Œil Gauche (2)',
        date: '2025-05-15'
      },
      {
        filename: '005_MIANGO KIKUNI_BERNARD_15052025_141343_Color_R_001.jpg',
        patientName: 'MIANGO KIKUNI BERNARD',
        type: 'fundus',
        eye: 'OD',
        caption: 'Fond d\'œil Couleur - Œil Droit',
        date: '2025-05-15'
      },
      {
        filename: '005_MIANGO KIKUNI_BERNARD_15052025_141452_Color_R_001.jpg',
        patientName: 'MIANGO KIKUNI BERNARD',
        type: 'fundus',
        eye: 'OD',
        caption: 'Fond d\'œil Couleur - Œil Droit (2)',
        date: '2025-05-15'
      },
      {
        filename: '4177_NSENGA IMANE_MARVELLE_29112025_110028_Color_L_001.jpg',
        patientName: 'NSENGA IMANE MARVELLE',
        type: 'fundus',
        eye: 'OS',
        caption: 'Fond d\'œil Couleur - Œil Gauche',
        date: '2025-11-29'
      },
      {
        filename: 'GI.jpg',
        patientName: 'NSENGA IMANE MARVELLE',
        type: 'fundus',
        eye: 'OD',
        caption: 'Fond d\'œil - Imagerie',
        date: '2025-11-28'
      },
      {
        filename: 'WhatsApp Image 2023-09-12 at 10.45.22 (1).jpeg',
        patientName: 'Examen Externe',
        type: 'fundus',
        eye: 'OD',
        caption: 'Image externe - Consultation',
        date: '2023-09-12'
      },
      {
        filename: 'WhatsApp Image 2023-09-12 at 10.45.22.jpeg',
        patientName: 'Examen Externe',
        type: 'fundus',
        eye: 'OS',
        caption: 'Image externe - Consultation (2)',
        date: '2023-09-12'
      }
    ];

    return clinicalImages.map((img, i) => ({
      _id: `demo-${i}`,
      url: `/datasets/retina/${encodeURIComponent(img.filename)}`,
      type: img.type,
      eye: img.eye,
      caption: img.caption,
      takenAt: new Date(img.date).toISOString(),
      patientId: `patient-${img.patientName.replace(/\s+/g, '-').toLowerCase()}`,
      patientName: img.patientName,
      examId: `EXAM-${String(i + 1).padStart(4, '0')}`,
      examDate: new Date(img.date).toISOString(),
      exam: {
        examId: `EXAM-${String(i + 1).padStart(4, '0')}`,
        createdAt: new Date(img.date).toISOString()
      }
    }));
  };

  const [demoMode, setDemoMode] = useState(true); // Start with demo images
  const [demoImages] = useState(() => generateDemoImages());

  const loadExamsWithImages = async () => {
    try {
      setLoading(true);
      const response = await ophthalmologyService.getExams();
      const allExams = response.data || response || [];
      const examsWithImages = allExams.filter(exam => exam.images && exam.images.length > 0);
      setExams(examsWithImages);
      // Auto-enable demo mode if no real images
      if (examsWithImages.length === 0) {
        setDemoMode(true);
      }
    } catch (error) {
      console.error('Error loading imaging data:', error);
      setDemoMode(true); // Fall back to demo mode on error
    } finally {
      setLoading(false);
    }
  };

  // Get all images with exam context (or demo images)
  const getAllImages = useMemo(() => {
    // If demo mode, return demo images
    if (demoMode) {
      return demoImages;
    }

    const allImages = [];
    exams.forEach(exam => {
      if (exam.images) {
        exam.images.forEach(img => {
          allImages.push({
            ...img,
            exam: exam,
            patientId: exam.patient?._id || exam.patient,
            patientName: `${exam.patient?.firstName || ''} ${exam.patient?.lastName || ''}`.trim(),
            examDate: exam.createdAt,
            examId: exam.examId
          });
        });
      }
    });
    return allImages;
  }, [exams, demoMode, demoImages]);

  // Get unique patients for filter
  const uniquePatients = useMemo(() => {
    const patients = new Map();
    getAllImages.forEach(img => {
      if (img.patientId && img.patientName) {
        patients.set(img.patientId, img.patientName);
      }
    });
    return Array.from(patients.entries()).map(([id, name]) => ({ id, name }));
  }, [getAllImages]);

  // Filtered and sorted images
  const filteredImages = useMemo(() => {
    let filtered = [...getAllImages];

    // Apply filters
    if (filterType !== 'all') {
      filtered = filtered.filter(img => img.type === filterType);
    }
    if (filterEye !== 'all') {
      filtered = filtered.filter(img => img.eye === filterEye);
    }
    if (filterPatient !== 'all') {
      filtered = filtered.filter(img => img.patientId === filterPatient);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img =>
        img.patientName?.toLowerCase().includes(query) ||
        img.caption?.toLowerCase().includes(query) ||
        img.type?.toLowerCase().includes(query) ||
        img.examId?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.takenAt || a.examDate);
      const dateB = new Date(b.takenAt || b.examDate);

      switch (sortBy) {
        case 'date-asc':
          return dateA - dateB;
        case 'date-desc':
          return dateB - dateA;
        case 'patient':
          return (a.patientName || '').localeCompare(b.patientName || '');
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        default:
          return dateB - dateA;
      }
    });

    return filtered;
  }, [getAllImages, filterType, filterEye, filterPatient, searchQuery, sortBy]);

  // Group images by patient for timeline view
  const imagesByPatient = useMemo(() => {
    const grouped = new Map();
    filteredImages.forEach(img => {
      const key = img.patientId || 'unknown';
      if (!grouped.has(key)) {
        grouped.set(key, {
          patientId: img.patientId,
          patientName: img.patientName || 'Patient inconnu',
          images: []
        });
      }
      grouped.get(key).images.push(img);
    });
    return Array.from(grouped.values());
  }, [filteredImages]);

  const imageTypes = ['all', 'fundus', 'oct', 'visual-field', 'corneal-topography', 'fluorescein', 'icg'];

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://localhost:5001${url}`;
  };

  const handleDownload = (image) => {
    const url = getImageUrl(image.url);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${image.type}_${image.eye}_${new Date(image.takenAt).toLocaleDateString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleImageForComparison = (image) => {
    setSelectedForComparison(prev => {
      const exists = prev.find(img => (img._id || img.id) === (image._id || image.id));
      if (exists) {
        return prev.filter(img => (img._id || img.id) !== (image._id || image.id));
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), image];
      }
      return [...prev, image];
    });
  };

  const isSelectedForComparison = (image) => {
    return selectedForComparison.some(img => (img._id || img.id) === (image._id || image.id));
  };

  const openComparison = () => {
    if (selectedForComparison.length > 0) {
      setShowComparisonViewer(true);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get patient name for comparison viewer
  const getComparisonPatientName = () => {
    if (selectedForComparison.length === 0) return '';
    const firstPatient = selectedForComparison[0].patientName;
    const allSame = selectedForComparison.every(img => img.patientName === firstPatient);
    return allSame ? firstPatient : 'Patients multiples';
  };

  // Get images for comparison (same patient if filtered, all if not)
  const getImagesForComparison = () => {
    if (filterPatient !== 'all') {
      return filteredImages;
    }
    if (selectedForComparison.length > 0) {
      const patientId = selectedForComparison[0].patientId;
      return getAllImages.filter(img => img.patientId === patientId);
    }
    return filteredImages;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon className="h-7 w-7 text-blue-600" />
            Imagerie Médicale
          </h1>
          <p className="text-gray-600 mt-1">
            Galerie d'images ophtalmologiques avec comparaison avancée
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Demo mode toggle */}
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              demoMode
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Eye className="h-4 w-4" />
            {demoMode ? 'Données démo' : 'Données réelles'}
          </button>

          {/* Comparison mode toggle */}
          <button
            onClick={() => {
              setComparisonMode(!comparisonMode);
              if (comparisonMode) {
                setSelectedForComparison([]);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              comparisonMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            {comparisonMode ? 'Annuler' : 'Comparer'}
          </button>

          {/* Open comparison viewer button */}
          {comparisonMode && selectedForComparison.length > 0 && (
            <button
              onClick={openComparison}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-2"
            >
              <SplitSquareHorizontal className="h-4 w-4" />
              Ouvrir ({selectedForComparison.length})
            </button>
          )}

          <div className="text-sm bg-blue-50 px-4 py-2 rounded-lg">
            <span className="text-blue-900 font-semibold">{filteredImages.length}</span>
            <span className="text-blue-600"> image(s)</span>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-lg shadow-sm border mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par patient, type, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Patient filter */}
          <div className="relative">
            <select
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les patients</option>
              {uniquePatients.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Eye filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {['all', 'OD', 'OS'].map(eye => (
              <button
                key={eye}
                onClick={() => setFilterEye(eye)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                  filterEye === eye
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {eye === 'all' ? 'Tous' : eye}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date-desc">Plus récent</option>
              <option value="date-asc">Plus ancien</option>
              <option value="patient">Par patient</option>
              <option value="type">Par type</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* View mode */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition ${
                viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue grille"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded-md transition ${
                viewMode === 'timeline' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Vue chronologique"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('patient-grouped')}
              className={`p-2 rounded-md transition ${
                viewMode === 'patient-grouped' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Par patient"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {imageTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                filterType === type
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'Tous les types' : type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison mode instructions */}
      {comparisonMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Layers className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-blue-900 font-medium">Mode comparaison activé</p>
            <p className="text-blue-700 text-sm">
              Cliquez sur les images à comparer (max 4). Sélectionnez des images du même patient pour comparer l'évolution.
            </p>
          </div>
          {selectedForComparison.length > 0 && (
            <div className="flex gap-2">
              {selectedForComparison.map((img, idx) => (
                <div
                  key={img._id || img.id || idx}
                  className="w-12 h-12 rounded-lg overflow-hidden ring-2 ring-blue-500"
                >
                  <img
                    src={getImageUrl(img.url)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des images...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredImages.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucune image disponible
          </h3>
          <p className="text-gray-600">
            {filterType === 'all' && filterPatient === 'all'
              ? 'Aucune image médicale n\'a été capturée pour le moment.'
              : 'Aucune image ne correspond aux filtres sélectionnés.'}
          </p>
        </div>
      )}

      {/* Grid View */}
      {!loading && filteredImages.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredImages.map((image, idx) => {
            const isSelected = isSelectedForComparison(image);
            return (
              <div
                key={`${image.examId}-${idx}`}
                className={`bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-lg transition group ${
                  comparisonMode ? 'cursor-pointer' : ''
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => comparisonMode && toggleImageForComparison(image)}
              >
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={getImageUrl(image.url)}
                    alt={image.caption || `${image.type} - ${image.eye}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext fill="%239ca3af" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" font-size="16"%3EImage non disponible%3C/text%3E%3C/svg%3E';
                    }}
                  />

                  {/* Hover overlay for non-comparison mode */}
                  {!comparisonMode && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedImage(image); }}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                        title="Agrandir"
                      >
                        <ZoomIn className="h-5 w-5 text-gray-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedForComparison([image]);
                          setShowComparisonViewer(true);
                        }}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                        title="Comparer"
                      >
                        <Layers className="h-5 w-5 text-gray-700" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(image); }}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
                        title="Télécharger"
                      >
                        <Download className="h-5 w-5 text-gray-700" />
                      </button>
                    </div>
                  )}

                  {/* Selection indicator for comparison mode */}
                  {comparisonMode && isSelected && (
                    <div className="absolute top-2 right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                      {image.type}
                    </span>
                  </div>

                  {/* Eye badge */}
                  <div className="absolute bottom-2 left-2">
                    <span className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {image.eye}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                    {image.caption || `${image.type} - ${image.eye}`}
                  </p>

                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{image.patientName || 'Patient inconnu'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>Examen: {image.examId || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(image.takenAt || image.examDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline View */}
      {!loading && filteredImages.length > 0 && viewMode === 'timeline' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Chronologie des images
          </h3>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-6">
              {filteredImages.map((image, idx) => (
                <div key={`${image.examId}-${idx}`} className="relative pl-16">
                  {/* Timeline dot */}
                  <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white" />

                  <div
                    className={`bg-gray-50 rounded-lg p-4 ${comparisonMode ? 'cursor-pointer hover:bg-gray-100' : ''} ${
                      isSelectedForComparison(image) ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => comparisonMode && toggleImageForComparison(image)}
                  >
                    <div className="flex gap-4">
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={getImageUrl(image.url)}
                          alt={image.caption || image.type}
                          className="w-full h-full object-cover"
                        />
                        {comparisonMode && isSelectedForComparison(image) && (
                          <div className="absolute top-1 right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded">
                            {image.type}
                          </span>
                          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded">
                            {image.eye}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(image.takenAt || image.examDate)}
                          </span>
                        </div>

                        <p className="font-medium text-gray-900 mb-1">
                          {image.caption || `${image.type} - ${image.eye}`}
                        </p>

                        <p className="text-sm text-gray-600">
                          Patient: {image.patientName || 'Inconnu'} • Examen: {image.examId || 'N/A'}
                        </p>

                        {!comparisonMode && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setSelectedImage(image)}
                              className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                            >
                              <ZoomIn className="h-3 w-3" />
                              Voir
                            </button>
                            <button
                              onClick={() => {
                                setSelectedForComparison([image]);
                                setShowComparisonViewer(true);
                              }}
                              className="px-3 py-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                            >
                              <Layers className="h-3 w-3" />
                              Comparer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patient Grouped View */}
      {!loading && filteredImages.length > 0 && viewMode === 'patient-grouped' && (
        <div className="space-y-8">
          {imagesByPatient.map(group => (
            <div key={group.patientId} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.patientName}</h3>
                    <p className="text-sm text-gray-600">{group.images.length} image(s)</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedForComparison(group.images.slice(0, 4));
                    setShowComparisonViewer(true);
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Voir l'évolution
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {group.images.map((image, idx) => (
                    <div
                      key={`${image.examId}-${idx}`}
                      className={`relative aspect-square rounded-lg overflow-hidden group ${
                        comparisonMode ? 'cursor-pointer' : ''
                      } ${isSelectedForComparison(image) ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => comparisonMode ? toggleImageForComparison(image) : setSelectedImage(image)}
                    >
                      <img
                        src={getImageUrl(image.url)}
                        alt={image.caption || image.type}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition" />

                      {/* Badges */}
                      <div className="absolute top-1 left-1 flex gap-1">
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-semibold rounded">
                          {image.type}
                        </span>
                        <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded">
                          {image.eye}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs">{formatDate(image.takenAt || image.examDate)}</p>
                      </div>

                      {/* Selection indicator */}
                      {comparisonMode && isSelectedForComparison(image) && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simple image viewer modal (single image) */}
      {selectedImage && !showComparisonViewer && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-6xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img
              src={getImageUrl(selectedImage.url)}
              alt={selectedImage.caption}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />

            <div className="bg-white rounded-b-lg p-4 mt-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {selectedImage.caption || `${selectedImage.type} - ${selectedImage.eye}`}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Patient:</span>
                      <span className="ml-2 font-medium">{selectedImage.patientName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Examen:</span>
                      <span className="ml-2 font-medium">{selectedImage.examId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2 font-medium">{selectedImage.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Œil:</span>
                      <span className="ml-2 font-medium">{selectedImage.eye}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Date:</span>
                      <span className="ml-2 font-medium">
                        {new Date(selectedImage.takenAt || selectedImage.examDate).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedForComparison([selectedImage]);
                      setSelectedImage(null);
                      setShowComparisonViewer(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Layers className="h-4 w-4" />
                    Comparer
                  </button>
                  <button
                    onClick={() => handleDownload(selectedImage)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Comparison Viewer */}
      {showComparisonViewer && (
        <ImageComparisonViewer
          images={getImagesForComparison()}
          initialImage={selectedForComparison[0]}
          patientName={getComparisonPatientName()}
          onClose={() => {
            setShowComparisonViewer(false);
            setSelectedForComparison([]);
            setComparisonMode(false);
          }}
        />
      )}
    </div>
  );
}
