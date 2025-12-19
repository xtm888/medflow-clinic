const mongoose = require('mongoose');
const MedicationTemplate = require('../models/MedicationTemplate');
require('dotenv').config();

// ALL medications from the clinic maquettes - INCLUDING NON-EYE MEDICATIONS
// As requested by the user: "every equipment and non eye medication needs to be included"
const allClinicMedications = {
  'A.I.N.S GENERAUX + CORTICOIDES': [
    { name: 'ADVIL', form: 'cp', dosage: '200mg' },
    { name: 'ASPEGIC pdre et solv p sol inj IM IV Ad', dosage: '500mg' },
    { name: 'ASPIRINE DU RHONE', form: 'cp', dosage: '500mg' },
    { name: 'ASPIRINE PH8', form: 'cp gastrorésistant', dosage: '500mg' },
    { name: 'ASPIRINE UPSA', form: 'cp efferv', dosage: '500mg' },
    { name: 'BRUFEN', form: 'cp', dosage: '400mg' },
    { name: 'BRUFENAL Capsules', form: 'capsule', dosage: '400mg', description: 'Ibuprofène' },
    { name: 'CATALGINE NORMALE', form: 'pdre p sol buv Ad', dosage: '0.50g' },
    { name: 'CELESTENE', form: 'cp', dosage: '2mg' },
    { name: 'CELESTENE INJECTABLE', form: 'inj' },
    { name: 'CEPHALGAN', form: 'cp' },
    { name: 'CORTANCYL', form: 'cp', dosage: '1mg' },
    { name: 'CORTANCYL', form: 'cp séc', dosage: '5mg' },
    { name: 'CORTANCYL', form: 'cp séc', dosage: '20mg' },
    { name: 'DAFALGAN', form: 'gél', dosage: '500mg' },
    { name: 'DICLIQUE PLUS', form: 'cp' },
    { name: 'DICLODENK', form: 'cp' },
    { name: 'DICLODENK SUPPO', form: 'suppo', dosage: '100mg' },
    { name: 'DICLOFENAC', form: 'cp' },
    { name: 'DICLOFENAC INJ', form: 'inj' },
    { name: 'DIPROSTENE', form: 'injectable' },
    { name: 'DOLAREN', form: 'cp', dosage: '500mg' },
    { name: 'DOLIPRANE', form: 'cp', dosage: '500mg' },
    { name: 'EFFERALGAN', form: 'cp', dosage: '500mg' },
    { name: 'IBUPROFEN', form: 'cp', dosage: '400mg' },
    { name: 'IBUPROFEN-DENK', form: 'cp', dosage: '600mg' },
    { name: 'PREDNISOLONE', form: 'cp', dosage: '5mg' },
    { name: 'PREDNISOLONE', form: 'cp', dosage: '20mg' },
    { name: 'PREDNOL VISION', form: 'collyre', packaging: '10ml' },
    { name: 'PROFENID', form: 'cp' },
    { name: 'PROFENID', form: 'gélules' },
    { name: 'TEMPERINE INJ', form: 'inj' }
  ],

  'A.I.N.S LOCAUX': [
    { name: 'ACULAR', form: 'collyre', dosage: '0.5%', packaging: '10ml' },
    { name: 'CIPRO', form: 'collyre', dosage: '0.3%' },
    { name: 'DICLOCED', form: 'collyre', dosage: '0.1%' },
    { name: 'INDOBIOTIC', form: 'collyre Ad' },
    { name: 'INDOBIS', form: 'collyre' },
    { name: 'INDOCID', form: 'collyre', dosage: '1%' },
    { name: 'INDOCOLLYRE', form: 'collyre', dosage: '0.1%' },
    { name: 'INDOCOLLYRE UNIDOSE', form: 'collyre unidose', dosage: '0.1%' },
    { name: 'KET VISION', form: 'collyre', packaging: 'fl 10ml' },
    { name: 'KETOROCIN', form: 'collyre', dosage: '0.4%' },
    { name: 'NDOCIN', form: 'collyre', description: 'Indomethacine' },
    { name: 'OCUFEN', form: 'collyre unidose', dosage: '0.03%' },
    { name: 'RHUMALGAN', form: 'collyre', packaging: '10ml' },
    { name: 'SOPHTAL', form: 'collyre' },
    { name: 'VOLTAMICINE', form: 'collyre' },
    { name: 'VOLTARENE', form: 'collyre', dosage: '0.1%' },
    { name: 'VOLTARENE UNIDOSE', form: 'collyre unidose', dosage: '0.1%' }
  ],

  'ANESTHESIE LOCALES': [
    { name: 'CEBESINE', form: 'collyre' },
    { name: 'CEBESINE PDE', form: 'poudre' },
    { name: 'OXYBUPROCAINE', form: 'collyre' }
  ],

  // NON-EYE MEDICATION - MALARIA DRUGS (IMPORTANT FOR CONGO CLINICS!)
  'ANTIPALUDIQUES': [
    { name: 'ARH AD', form: 'cp', dosage: '150mg' },
    { name: 'ARH FORTE', form: 'cp', dosage: '225mg' },
    { name: 'ASU DENK FIXED DOSE', form: 'cp' },
    { name: 'CO ARINATE AD', form: 'cp' },
    { name: 'CO ARINATE JUNIOR', form: 'cp' },
    { name: 'DIPERAKINE', form: 'cp' },
    { name: 'LUTHER DP', form: 'cp' },
    { name: 'LUTHER SP', form: 'cp' },
    { name: 'QUININE', form: 'cp', dosage: '500mg' }
  ],

  'ANTI SPASMODIQUES': [
    { name: 'MEFTAL SPAS', form: 'cp' },
    { name: 'MEFTAL SPAS INJ', form: 'inj' },
    { name: 'SPARET', form: 'cp' },
    { name: 'SPASFON INJ', form: 'inj' },
    { name: 'SPASFON SUPPO', form: 'suppo' }
  ],

  'ANTI ALLERGIQUES': [
    { name: 'AERIUS', form: 'cp' },
    { name: 'AERIUS', form: 'sirop' },
    { name: 'ALERDUAL', form: 'cp' },
    { name: 'ALLERGODIL', form: 'collyre', dosage: '0.05%' },
    { name: 'ALMIDE', form: 'collyre', dosage: '0.1%' },
    { name: 'ALMIDE UNIDOSE', form: 'collyre unidose', dosage: '0.1%' },
    { name: 'ALTRIABAK', form: 'collyre' },
    { name: 'AZELASTIN-COMOD', form: 'collyre', dosage: '0.5mg/ml', packaging: '10ml' },
    { name: 'CELESTENE', form: 'cp' },
    { name: 'CELESTENE CHRONODOSE', form: 'inj' },
    { name: 'CETIRIZINE', form: 'cp' },
    { name: 'CETIRIZINE', form: 'sol buv', dosage: '10mg/ml' },
    { name: 'CEZIN', form: 'cp' },
    { name: 'CLARITYNE', form: 'cp', dosage: '10mg' },
    { name: 'CLARITYNE', form: 'sirop', dosage: '0.1%' },
    { name: 'CROMABAK', form: 'collyre', dosage: '2%' },
    { name: 'CROMADOSES', form: 'unidose' },
    { name: 'CROMEDIL', form: 'collyre', dosage: '2%' },
    { name: 'CROMOGLICATE MENARINI', form: 'collyre', dosage: '2%' },
    { name: 'CROMOPTIC', form: 'collyre', dosage: '2%' },
    { name: 'DESLOR', form: 'cp', dosage: '5mg' },
    { name: 'DESLORA DENK', form: 'cp', dosage: '5mg' },
    { name: 'DESOMEDINE', form: 'collyre', dosage: '0.1%', packaging: '10ml' },
    { name: 'EKON-DT', form: 'cp', dosage: '10mg' },
    { name: 'EMADINE', form: 'collyre', dosage: '0.05%' },
    { name: 'KETITOFENE (ALTRIABAK)', form: 'collyre' },
    { name: 'LEVOPHTA', form: 'collyre', dosage: '0.05%' },
    { name: 'LIVOSTIN', form: 'collyre', dosage: '0.5mg/ml' },
    { name: 'NAABAK', form: 'collyre', dosage: '4.9%' },
    { name: 'OPATANOL', form: 'collyre' },
    { name: 'POLARAMINE', form: 'cp séc', dosage: '2mg' },
    { name: 'PRIMALAN', form: 'cp séc Ad', dosage: '10mg' },
    { name: 'TELFAST', form: 'cp', dosage: '120mg' },
    { name: 'VIRLIX', form: 'cp pelliculé séc', dosage: '10mg' },
    { name: 'XYZALL', form: 'cp pelliculé séc', dosage: '5mg' },
    { name: 'ZADITEN', form: 'collyre', dosage: '0.25mg', packaging: 'fl 5ml' }
  ],

  'ANTI HYPERTENSEURS': [
    { name: 'AMLODIPINE', form: 'cp', dosage: '5mg' },
    { name: 'CAPTOPRIL', form: 'cp', dosage: '25mg' },
    { name: 'ENALAPRIL', form: 'cp', dosage: '5mg' },
    { name: 'LOSARTAN', form: 'cp', dosage: '50mg' },
    { name: 'METHYLDOPA', form: 'cp', dosage: '250mg' }
  ],

  'ANTI MYCOSIQUES': [
    { name: 'CANESTEN', form: 'crème' },
    { name: 'FLUCONAZOLE', form: 'cp', dosage: '150mg' },
    { name: 'KETOCONAZOLE', form: 'cp', dosage: '200mg' },
    { name: 'MICONAZOLE', form: 'gel oral' },
    { name: 'NYSTATINE', form: 'suspension orale' }
  ],

  'ANTISEPT SANS VASOCONS': [
    { name: 'BIOCIDAN', form: 'collyre' },
    { name: 'DACRYOSERUM', form: 'collyre' },
    { name: 'DESOCOLLYRE', form: 'collyre' },
    { name: 'OPHTACLEAN', form: 'collyre' },
    { name: 'VITASEPTINE', form: 'collyre' }
  ],

  'ANTITUSSIF': [
    { name: 'CARBOCYSTEINE', form: 'sirop' },
    { name: 'CODEINE', form: 'sirop' },
    { name: 'DEXTROMETHORPHANE', form: 'sirop' },
    { name: 'PHOLCODINE', form: 'sirop' }
  ],

  'ANTI VIRAUX': [
    { name: 'ADENOVIR', form: 'collyre' },
    { name: 'VIRGAN', form: 'gel ophtalmique', dosage: '0.15%' },
    { name: 'ZOVIRAX', form: 'pommade ophtalmique', dosage: '3%' },
    { name: 'ZIRGAN', form: 'gel ophtalmique', dosage: '0.15%' }
  ],

  'ANTIBIOTIQUE LOCAUX': [
    { name: 'ANTIBIOPUR', form: 'collyre', dosage: '0.3%' },
    { name: 'ATEBEMYXINE', form: 'collyre' },
    { name: 'ATEBEMYXINE', form: 'pom opht' },
    { name: 'AUREOMYCINE EVANS', form: 'pom opht', dosage: '1%' },
    { name: 'AZYTER', form: 'unidoses' },
    { name: 'BACITRACINE MARTINET', form: 'collyre', dosage: '50000 UI%' },
    { name: 'CEBEMYXINE', form: 'collyre' },
    { name: 'CEBEMYXINE', form: 'pom opht' },
    { name: 'CHIBROXINE', form: 'collyre', dosage: '0.3%' },
    { name: 'CHLORAMPHENICOL FAURE', form: 'collyre', dosage: '1%' },
    { name: 'CILOXAN', form: 'collyre', dosage: '0.3%' },
    { name: 'CILOXAN', form: 'pom' },
    { name: 'EXOCINE', form: 'collyre', dosage: '0.3%' },
    { name: 'FUCITHALMIC', form: 'gel opht', dosage: '1%' },
    { name: 'GENTALLINE', form: 'collyre', dosage: '0.3%' },
    { name: 'GENTAMYCINE CHAUVIN', form: 'collyre', dosage: '0.3%' },
    { name: 'TOBREX', form: 'collyre' },
    { name: 'TOBREX', form: 'pom opht' }
  ],

  'ANTIBIOTIQUE GENERAUX': [
    { name: 'ACLAV', form: 'cp', dosage: '1g' },
    { name: 'ACLAV', form: 'cp', dosage: '500mg' },
    { name: 'AGRAM', form: 'sirop', dosage: '250mg' },
    { name: 'AGRAM', form: 'gélules', dosage: '500mg' },
    { name: 'AMOXICILLINE', form: 'cp', dosage: '500mg' },
    { name: 'AMPICILLINE', form: 'cp', dosage: '500mg' },
    { name: 'AUGMENTIN', form: 'cp', dosage: '500mg' },
    { name: 'CEFTRIAXONE INJ', form: 'inj' },
    { name: 'CIPROFLOXACINE', form: 'cp', dosage: '500mg' },
    { name: 'CLAMOXYL', form: 'cp', dosage: '500mg' },
    { name: 'DOXYCYCLINE', form: 'cp', dosage: '100mg' },
    { name: 'FLAGYL', form: 'cp' },
    { name: 'METRONIDAZOLE', form: 'cp', dosage: '250mg' },
    { name: 'METRONIDAZOLE INFUSION', form: 'infusion', packaging: '100ml' },
    { name: 'PYOSTACINE', form: 'cp', dosage: '500mg' },
    { name: 'ROVAMYCINE', form: 'cp', dosage: '1.5MUI' },
    { name: 'ROVAMYCINE', form: 'cp', dosage: '3MUI' },
    { name: 'TETRACYCLINE', form: 'cp', dosage: '500mg' }
  ],

  'ANTI CATARACTE': [
    { name: 'CATACOL', form: 'collyre', dosage: '0.1%' },
    { name: 'CATARIDOL', form: 'collyre' },
    { name: 'CATARSTAT', form: 'collyre' },
    { name: 'CRISTOPAL', form: 'collyre' },
    { name: 'DULCIPHAK', form: 'collyre' },
    { name: 'VITA-IODUROL ATP', form: 'collyre' },
    { name: 'VITAMINE C FAURE', form: 'collyre', dosage: '2%' }
  ],

  'ANTI GLAUCOMATEUX': [
    { name: 'ALPHAGAN', form: 'collyre', dosage: '0.2%' },
    { name: 'AZARGA', form: 'collyre' },
    { name: 'AZOPT', form: 'collyre' },
    { name: 'BENTOS', form: 'collyre', dosage: '0.25%' },
    { name: 'BENTOS UNIDOSE', form: 'collyre unidose', dosage: '0.25%' },
    { name: 'BETAGAN', form: 'collyre', dosage: '0.1%' },
    { name: 'BETOPTIC', form: 'collyre', dosage: '0.5%' },
    { name: 'BRINZOLAMIDE', form: 'collyre' },
    { name: 'CARTEOL', form: 'collyre', dosage: '1%' },
    { name: 'CARTEOL LP', form: 'collyre', dosage: '2%' },
    { name: 'COMBIGAN', form: 'collyre' },
    { name: 'COSOPT', form: 'collyre' },
    { name: 'DIAMOX', form: 'cp', dosage: '250mg' },
    { name: 'DORZOLAMIDE', form: 'collyre' },
    { name: 'DUOTRAV', form: 'collyre' },
    { name: 'GANFORT', form: 'collyre' },
    { name: 'IOPIDINE', form: 'collyre', dosage: '1%' },
    { name: 'LATANOPROST', form: 'collyre' },
    { name: 'LUMIGAN', form: 'collyre' },
    { name: 'MONOPROST', form: 'collyre unidose' },
    { name: 'PILOCARPINE', form: 'collyre', dosage: '2%' },
    { name: 'SIMBRINZA', form: 'collyre' },
    { name: 'TIMOLOL', form: 'collyre', dosage: '0.5%' },
    { name: 'TRAVATAN', form: 'collyre' },
    { name: 'TRUSOPT', form: 'collyre' },
    { name: 'XALATAN', form: 'collyre' },
    { name: 'XALACOM', form: 'collyre' }
  ],

  'ANTI HISTAMINIQUES GENERAUX': [
    { name: 'BILASTINE', form: 'cp', dosage: '20mg' },
    { name: 'DESLORATADINE', form: 'cp', dosage: '5mg' },
    { name: 'EBASTINE', form: 'cp', dosage: '10mg' },
    { name: 'FEXOFENADINE', form: 'cp', dosage: '180mg' },
    { name: 'LEVOCETIRIZINE', form: 'cp', dosage: '5mg' },
    { name: 'LORATADINE', form: 'cp', dosage: '10mg' },
    { name: 'RUPATADINE', form: 'cp', dosage: '10mg' }
  ],

  'CICATRISANTS': [
    { name: 'CACICOL', form: 'collyre' },
    { name: 'EPITHELIALE AO', form: 'pom opht' },
    { name: 'KERATYL', form: 'collyre' },
    { name: 'POMMADE VITAMINE A', form: 'pom opht' },
    { name: 'RECUGEL', form: 'gel opht' },
    { name: 'THILO-TEARS', form: 'gel opht' },
    { name: 'VIT-A-POS', form: 'pom opht' }
  ],

  'CORTICOIDES + ANTIBIOTIQUES': [
    { name: 'CHIBRO-CADRON', form: 'collyre' },
    { name: 'CIDERMEX', form: 'pom opht' },
    { name: 'DEXAGENTA', form: 'collyre' },
    { name: 'FRAKIDEX', form: 'collyre' },
    { name: 'MAXIDROL', form: 'collyre' },
    { name: 'POLYDEXA', form: 'collyre' },
    { name: 'RIFAMYCINE-CHIBRET', form: 'collyre' },
    { name: 'STERDEX', form: 'pom opht' },
    { name: 'TOBRADEX', form: 'collyre' },
    { name: 'TOBRADEX', form: 'pom opht' }
  ],

  'CORTICOIDES LOCAUX': [
    { name: 'CHIBROCADRON', form: 'collyre' },
    { name: 'DEXAFREE', form: 'collyre unidose' },
    { name: 'DEXAMETHASONE', form: 'collyre', dosage: '0.1%' },
    { name: 'FML', form: 'collyre' },
    { name: 'FLUCON', form: 'collyre' },
    { name: 'HYDROCORTISONE', form: 'collyre' },
    { name: 'MAXIDEX', form: 'collyre' },
    { name: 'PRED FORTE', form: 'collyre' },
    { name: 'PREDNISOLONE', form: 'collyre' },
    { name: 'VEXOL', form: 'collyre' }
  ],

  'CREMES DERMIQUES': [
    { name: 'BETNEVAL', form: 'crème' },
    { name: 'DERMOVATE', form: 'crème' },
    { name: 'DIPROSONE', form: 'crème' },
    { name: 'EUMOVATE', form: 'crème' },
    { name: 'HYDROCORTISONE', form: 'crème' },
    { name: 'LOCOID', form: 'crème' }
  ],

  'DECONGESTIONNANT': [
    { name: 'COLLYRE BLEU LAITER', form: 'collyre' },
    { name: 'DACUDOSES', form: 'collyre unidose' },
    { name: 'DACRYNE', form: 'collyre' },
    { name: 'VISINE', form: 'collyre' }
  ],

  'DIVERS OPHA': [
    { name: 'AMINOCAPROIQUE', form: 'collyre' },
    { name: 'BEVACIZUMAB', form: 'inj intravitréenne' },
    { name: 'FLUORESCEINE', form: 'collyre' },
    { name: 'RANIBIZUMAB', form: 'inj intravitréenne' },
    { name: 'VERTEPORFINE', form: 'inj' }
  ],

  'GOUTTES NASALES': [
    { name: 'ATURGYL', form: 'gouttes nasales' },
    { name: 'DERINOX', form: 'gouttes nasales' },
    { name: 'DETURGYLONE', form: 'gouttes nasales' },
    { name: 'PIVALONE', form: 'gouttes nasales' },
    { name: 'RHINOFLUIMUCIL', form: 'gouttes nasales' }
  ],

  'HYPO CHOLESTEROLEMIANTS': [
    { name: 'ATORVASTATINE', form: 'cp', dosage: '20mg' },
    { name: 'PRAVASTATINE', form: 'cp', dosage: '20mg' },
    { name: 'ROSUVASTATINE', form: 'cp', dosage: '10mg' },
    { name: 'SIMVASTATINE', form: 'cp', dosage: '20mg' }
  ],

  'LARMES ARTIFICIELLES': [
    { name: 'ARTELAC', form: 'collyre' },
    { name: 'CELLUVISC', form: 'collyre unidose' },
    { name: 'DULCILARMES', form: 'collyre' },
    { name: 'GEL LARMES', form: 'gel opht' },
    { name: 'HYABAK', form: 'collyre' },
    { name: 'HYLOCOMOD', form: 'collyre' },
    { name: 'LACRIFLUID', form: 'collyre' },
    { name: 'LACRINORM', form: 'collyre' },
    { name: 'LACRYPOS', form: 'collyre' },
    { name: 'LARMABAK', form: 'collyre' },
    { name: 'LIQUIFILM', form: 'collyre' },
    { name: 'NUTRIVISC', form: 'collyre' },
    { name: 'OPTIVE', form: 'collyre' },
    { name: 'REFRESH', form: 'collyre unidose' },
    { name: 'SYSTANE', form: 'collyre' },
    { name: 'TEARS NATURALE', form: 'collyre' },
    { name: 'UNIFLUID', form: 'collyre' },
    { name: 'VISMED', form: 'collyre' },
    { name: 'VISMED MULTI', form: 'collyre' },
    { name: 'VISLUBE', form: 'collyre' }
  ],

  'LARMES LOTIONS CONTACTO': [
    { name: 'COMPLETE EASY RUB', form: 'solution' },
    { name: 'CONCERTO PACK ECO', form: 'solution' },
    { name: 'EASYSEPT', form: 'solution' },
    { name: 'LIQUINET', form: 'solution' },
    { name: 'MENICARE PLUS', form: 'solution' },
    { name: 'MENICARE SOFT', form: 'solution' },
    { name: 'OPTIFREE REPLENISH', form: 'solution' },
    { name: 'OXYSEPT', form: 'solution' },
    { name: 'REGARD', form: 'solution' },
    { name: 'RENU MPS', form: 'solution' },
    { name: 'SOLOCARE AQUA', form: 'solution' },
    { name: 'TOTAL CARE', form: 'solution' }
  ],

  // NON-EYE MEDICATIONS - IMPORTANT FOR COMPLETE CLINIC SERVICE!
  'LAXATIFS ET ANTI DIARRHEIQUES': [
    { name: 'ACTAPULGITE', form: 'sachet' },
    { name: 'DUPHALAC', form: 'sirop' },
    { name: 'IMODIUM', form: 'cp' },
    { name: 'LACTULOSE', form: 'sirop' },
    { name: 'LOPERAMIDE', form: 'cp' },
    { name: 'SMECTA', form: 'sachet' }
  ],

  'MAGNESIUM': [
    { name: 'CALCIUM VITAMINE D3', form: 'cp à croquer' },
    { name: 'LAROSCORBINE', form: 'cp à croquer', dosage: '500mg' },
    { name: 'MAG 2', form: 'cp', dosage: '100mg' },
    { name: 'MAG 2', form: 'sol buv' },
    { name: 'MAGNE-B6', form: 'cp enrobé' },
    { name: 'MAGNE-B6', form: 'sol buv' },
    { name: 'MAGNES DIRECT DENK', form: 'sol buv' }
  ],

  'MYDRIATIQUES': [
    { name: 'ATROPINE', form: 'collyre', dosage: '0.5%' },
    { name: 'ATROPINE', form: 'collyre', dosage: '1%' },
    { name: 'CHIBRO-ATROPINE', form: 'collyre', dosage: '0.5%' },
    { name: 'CHIBRO-ATROPINE', form: 'collyre Ad', dosage: '1%' },
    { name: 'CYCLOGYL', form: 'collyre', dosage: '1%' },
    { name: 'CYCLOPENTOLATE', form: 'collyre', dosage: '1%' },
    { name: 'HOMATROPINE', form: 'collyre', dosage: '1%' },
    { name: 'ISOPTO-HOMATROPINE', form: 'collyre', dosage: '1%' },
    { name: 'MYDRIASERT', form: 'insert opht' },
    { name: 'MYDRIATICUM', form: 'collyre', dosage: '0.5%' },
    { name: 'MYDRIX', form: 'collyre' },
    { name: 'NEOSYNEPHRINE', form: 'collyre', dosage: '5%' },
    { name: 'NEOSYNEPHRINE', form: 'collyre', dosage: '10%' },
    { name: 'PHENYLEPHRINE', form: 'collyre' },
    { name: 'SKIACOL', form: 'collyre', dosage: '0.5%' },
    { name: 'TROPICAMIDE', form: 'collyre', dosage: '0.5%' }
  ],

  // NON-EYE MEDICATIONS - GYNECOLOGICAL
  'OVULES VAGINALES': [
    { name: 'NEOGYNAX', form: 'ovules vaginales', packaging: 'boîte de 6' },
    { name: 'POLYGYNAX', form: 'ovules vaginales', packaging: 'boîte de 6' },
    { name: 'POLYGYNAX', form: 'ovules vaginales', packaging: 'boîte de 12' },
    { name: 'ECONAZOLE', form: 'ovules vaginales' },
    { name: 'FLAGYL', form: 'ovules vaginales' },
    { name: 'LOMEXIN', form: 'ovules vaginales' },
    { name: 'METRONIDAZOLE', form: 'ovules vaginales' }
  ],

  // NON-EYE MEDICATIONS - GASTRIC
  'PANSEMENTS GASTRIQUES': [
    { name: 'ACILOC INJ', form: 'inj' },
    { name: 'NOCIGEL', form: 'sirop' },
    { name: 'POLYGEL', form: 'cp' },
    { name: 'RABEQUE', form: 'cp', dosage: '20mg' },
    { name: 'RABEQUE D', form: 'cp' },
    { name: 'RANITIDINE', form: 'inj', dosage: '50mg' },
    { name: 'MAALOX', form: 'suspension' },
    { name: 'OMEPRAZOLE', form: 'cp', dosage: '20mg' },
    { name: 'PANTOPRAZOLE', form: 'cp', dosage: '40mg' },
    { name: 'PHOSPHALUGEL', form: 'gel oral' }
  ],

  'POTASSIUM': [
    { name: 'CHLOROPOTASSURIL', form: 'cp' },
    { name: 'DIFFU-K', form: 'gél', dosage: '600mg' },
    { name: 'KALEORID', form: 'cp', dosage: '600mg' },
    { name: 'KALEORID LP', form: 'cp enrobé LP', dosage: '600mg' },
    { name: 'KALEORID LP', form: 'cp enrobé LP', dosage: '1000mg' },
    { name: 'KCL', form: 'solution' }
  ],

  'SEDATIF': [
    { name: 'DIAZEPAM', form: 'cp' },
    { name: 'DIAZEPAM INJ', form: 'inj' },
    { name: 'BROMAZEPAM', form: 'cp', dosage: '6mg' },
    { name: 'LORAZEPAM', form: 'cp', dosage: '2.5mg' }
  ],

  'VASCULOTROPES': [
    { name: 'BAUSCH&LOMB LUTEINE', form: 'cp' },
    { name: 'DIFRAREL E', form: 'cp' },
    { name: 'DIFRAREL 100', form: 'cp' },
    { name: 'I CAPS R', form: 'cp' },
    { name: 'IKARAN', form: 'cp' },
    { name: 'LACRY+', form: 'cp' },
    { name: 'NATUROPHTA MACULA', form: 'cp' },
    { name: 'NOOTROPYL', form: 'cp', dosage: '800mg' },
    { name: 'NUTROF TOTAL', form: 'cp' },
    { name: 'OCCUGUARD', form: 'cp' },
    { name: 'PRESERVISION 3', form: 'cp' },
    { name: 'RETINAT LUTEINE', form: 'cp' },
    { name: 'SUVEAL DUO', form: 'cp' },
    { name: 'SUVEAL RETINE', form: 'cp' },
    { name: 'TANAKAN', form: 'cp' },
    { name: 'VITALUX', form: 'cp' },
    { name: 'VITREOCLAR', form: 'cp' }
  ],

  // NON-EYE MEDICATIONS - DEWORMING
  'VERMIFUGES': [
    { name: 'LEVAMISOL', form: 'cp', dosage: '50mg' },
    { name: 'LEVAMISOL', form: 'cp', dosage: '150mg' },
    { name: 'MEBOX', form: 'cp' },
    { name: 'MEBOX', form: 'sirop' },
    { name: 'ALBENDAZOLE', form: 'cp', dosage: '400mg' },
    { name: 'MEBENDAZOLE', form: 'cp', dosage: '100mg' },
    { name: 'PRAZIQUANTEL', form: 'cp', dosage: '600mg' }
  ],

  'VITAMINES': [
    { name: 'BENERVA', form: 'cp' },
    { name: 'CEVITE', form: 'cp' },
    { name: 'CIPROVITAL', form: 'sirop' },
    { name: 'FORTALINE PLUS', form: 'cp' },
    { name: 'HIFER', form: 'sirop' },
    { name: 'MULTIVITAMINE', form: 'sirop' },
    { name: 'MY VITA AD', form: 'cp' },
    { name: 'MY VITA KID', form: 'sirop' },
    { name: 'OCUGUARD', form: 'cp' },
    { name: 'PRESERVISION', form: 'cp' },
    { name: 'ROVIGON', form: 'capsules' },
    { name: 'TRIBEXFORT', form: 'cp' },
    { name: 'TRIOMEGA', form: 'capsules' },
    { name: 'VITAMINE B6', form: 'cp' },
    { name: 'VITAMINE C INJ', form: 'inj' },
    { name: 'VITAMINES B-DENK', form: 'cp' },
    { name: 'VITAMINE A', form: 'cp' },
    { name: 'VITAMINE D', form: 'ampoules' },
    { name: 'VITAMINE E', form: 'cp' }
  ]
};

async function seedAllClinicMedications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carevision');
    console.log('🔌 Connected to MongoDB');

    // Clear existing medication templates
    await MedicationTemplate.deleteMany({});
    console.log('🧹 Cleared existing medication templates');

    // Prepare all medications for insertion
    const medicationsToInsert = [];
    let totalMedications = 0;

    console.log('\n📦 Preparing ALL clinic medications (INCLUDING NON-EYE MEDICATIONS)...\n');

    for (const [category, medications] of Object.entries(allClinicMedications)) {
      console.log(`Processing ${category}: ${medications.length} medications`);

      for (const med of medications) {
        medicationsToInsert.push({
          category,
          name: med.name,
          description: med.description || '',
          form: med.form || '',
          dosage: med.dosage || '',
          packaging: med.packaging || '',
          isActive: true,
          searchTerms: [
            med.name.toLowerCase(),
            category.toLowerCase(),
            med.form?.toLowerCase() || ''
          ].filter(Boolean)
        });
        totalMedications++;
      }
    }

    // Insert all medications
    const result = await MedicationTemplate.insertMany(medicationsToInsert);
    console.log(`\n✅ Successfully inserted ${result.length} medications`);

    // Display summary
    console.log('\n📊 MEDICATION SUMMARY BY CATEGORY:');
    console.log('=====================================');

    const categoryCounts = {};
    for (const [category, medications] of Object.entries(allClinicMedications)) {
      categoryCounts[category] = medications.length;
      console.log(`${category}: ${medications.length} medications`);
    }

    // Highlight non-eye medications
    console.log('\n🔍 NON-EYE MEDICATIONS INCLUDED:');
    console.log('=====================================');
    const nonEyeCategories = [
      'ANTIPALUDIQUES',
      'ANTI HYPERTENSEURS',
      'ANTITUSSIF',
      'CREMES DERMIQUES',
      'GOUTTES NASALES',
      'HYPO CHOLESTEROLEMIANTS',
      'LAXATIFS ET ANTI DIARRHEIQUES',
      'OVULES VAGINALES',
      'PANSEMENTS GASTRIQUES',
      'VERMIFUGES'
    ];

    for (const category of nonEyeCategories) {
      if (categoryCounts[category]) {
        console.log(`✓ ${category}: ${categoryCounts[category]} medications`);
      }
    }

    console.log('\n✨ ALL CLINIC MEDICATIONS SEEDED SUCCESSFULLY!');
    console.log(`   Total categories: ${Object.keys(allClinicMedications).length}`);
    console.log(`   Total medications: ${totalMedications}`);
    console.log('   Including ALL non-eye medications from clinic maquettes');

  } catch (error) {
    console.error('❌ Error seeding medications:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute seeding
seedAllClinicMedications();
