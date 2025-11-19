const mongoose = require('mongoose');
require('dotenv').config();

// Drug model
const drugSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genericName: String,
  category: { type: String, required: true },
  dosageForm: String,
  strength: String,
  route: String,
  manufacturer: String,
  description: String,
  sideEffects: [String],
  contraindications: [String],
  interactions: [String],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Drug = mongoose.model('Drug', drugSchema);

// All medications from the maquettes organized by French categories
const medicationsByCategory = {
  'A.I.N.S GENERAUX + CORTICOIDES': [
    'ADVIL', 'ASPEGIC pdre et solv p sol inj IM IV Ad 500 mg', 'ASPIRINE DU RHONE cp 500 mg',
    'ASPIRINE PH8 cp gastrorésistant 500 mg', 'ASPIRINE UPSA cp efferv 500 mg', 'BRUFEN 400 MG CES',
    'BRUFEN cp 400mg', 'BRUFENAL Capsules (Ibuprofène 400mg)', 'CATALGINE NORMALE pdre p sol buv Ad 0,50 g',
    'célestène comprimés 2mg', 'CELESTENE INJECTABLE', 'CEPHALGAN', 'CORTANCYL cp 1 mg',
    'CORTANCYL cp séc 20 mg', 'CORTANCYL cp séc 5 mg', 'DAFALGAN gél 500 mg', 'DICLIQUE PLUS CES',
    'diclodenk', 'DICLODENK SUPPO 100 MG', 'DICLOFENAC CES', 'DICLOFENAC INJ', 'diprostène injectable',
    'DOLAREN CES', 'DOLAREN cp 500mg', 'DOLIPRANE cp 500 mg', 'EFFERALGAN cp 500 mg',
    'IBUPROFEN CES 400 MG', 'ibuprofen cp', 'IBUPROFEN-DENK 600 CES', 'PREDNISOLONE CES 20 MG',
    'PREDNISOLONE CES 5 MG', 'Prednol Vision Collyre 10ml', 'PROFENID cp', 'PROFENID gélules', 'TEMPERINE INJ'
  ],
  'A.I.N.S LOCAUX': [
    'ACULAR 10ML Collyre', 'ACULAR collyre 0,5 %', 'CIPRO 0,3%', 'DICLOCED 0,1%',
    'INDOBIOTIC collyre Ad', 'INDOBIS Collyre', 'INDOCID collyre 1 %', 'indocollyre 0,1%',
    'INDOCOLLYRE collyre 0,1 %', 'INDOCOLLYRE collyre 0,1 % en unidose', 'Ket Vision collyre fl 10ml',
    'KETOROCIN collyre 0,4%', 'Ndocin(indomethacine)', 'OCUFEN collyre 0,03 % en unidose',
    'RHUMALGAN Collyre 10 ML', 'SOPHTAL collyre', 'VOLTAMICINE collyre', 'VOLTARENE collyre 0,1 %',
    'VOLTARENE collyre 0,1 % en unidose'
  ],
  'ANESTHESIE LOCALES': [
    'CEBESINE Collyre', 'CEBESINE PDE', 'OXYBUPROCAINE'
  ],
  'ANTIPALUDEENS': [
    'ARH AD 150 MG', 'ARH FORTE 225 MG', 'ASU DENK FIXED DOSE', 'CO ARINATE AD', 'CO ARINATE JUNIOR',
    'DIPERAKINE', 'LUTHER DP', 'LUTHER SP', 'QUININE 500 MG CES'
  ],
  'ANTI SPASMODIQUES': [
    'MEFTAL SPAS CES', 'MEFTAL SPAS INJ', 'SPARET CES', 'SPASFON INJ', 'SPASFON SUPPO'
  ],
  'ANTI ALLERGIQUES': [
    'aérius comprimés', 'aérius sirop', 'ALERDUAL', 'ALLERGODIL collyre 0,05 %', 'ALMIDE collyre 0,1 %',
    'ALMIDE collyre 0,1 % en unidose', 'ALTRIABAK Collyre', 'AZELASTIN - COMOD collyre 0.5 mg/ml 10 ml',
    'CELESTENE CES', 'CELESTENE Chronodose', 'CELESTENE INJ', 'CETIRIZINE',
    'CETIRIZINE sol buv 10 mg/ml', 'CEZIN CES', 'CLARITYNE cp 10 mg', 'CLARITYNE sirop 0,1 %',
    'CROMABAK collyre 2 %', 'CROMADOSES en unidose', 'CROMEDIL collyre 2 %', 'CROMEDIL en unidose',
    'CROMOGLICATE MENARINI collyre 2 %', 'CROMOPTIC collyre 2 %', 'CROMOPTIC en unidose',
    'DESLOR comprimés 5mg', 'DESLORA DENK 5 CES', 'DESOMEDINE collyre 0.1 % 10ml', 'EKON-DT cp 10mg',
    'EMADINE 0.05%', 'KETITOFENE (ALTRIABAK)', 'LEVOPHTA collyre 0,05 %', 'LIVOSTIN collyre 0.5 mg/ml',
    'LRJ collyre 10ml', 'MARTIGENE collyre', 'MAXICRON 2% Collyre', 'NAABAK collyre 4,9 %',
    'NAAXIA collyre 4,9 % en flacon', 'NAAXIA collyre 4,9 % en unidose', 'NEVXAL', 'OPATANOL',
    'OPHTACALM collyre 2 %', 'OPTICRON collyre 2 %', 'OPTICRON collyre 2 % en unidose',
    'ORCHAZID (ketotifen) 5ml', 'POLARAMINE cp séc 2 mg', 'POLARAMINE REPETABS cp enrobé Ad 6 mg',
    'POLARAMINE sirop 0,01 %', 'PRIMALAN cp séc Ad 10 mg', 'PRIMALAN sirop', 'PURIVIST fl 5mg',
    'SIMILASAN', 'TELFAST 120mg', 'TILAVIST collyre 2 %', 'TRILLERG', 'VIRLIX cp pelliculé séc 10 mg',
    'VIRLIX sol buv 10 mg/ml', 'VOZOLE Collyre', 'XYZALL cp pelliculé séc 5 mg', 'ZADITEN 0,25mg fl 5ml',
    'ZADITEN 0,25mg unidose'
  ],
  'ANTIBIOTIQUE LOCAUX': [
    'ANTIBIOPUR collyre 0,3%', 'ATEBEMYXINE collyre', 'ATEBEMYXINE pom opht', 'AUREOMYCINE EVANS pom opht 1 %',
    'AVAZIR Collyre', 'AZYTER unidoses', 'BACITRACINE MARTINET collyre 50 000 UI %', 'CEBEMYXINE collyre',
    'CEBEMYXINE pom opht', 'CEBENICOL pdre et sol p collyre 0,4 %', 'CHIBROXINE collyre 0,3 %',
    'CHLORAMPHENICOL FAURE collyre 1 %', 'CIFIN collyre 0,3%', 'CILOXAN collyre 0,3 %', 'CILOXAN pom',
    'CIPRO 0,3%', 'EXOCINE collyre 0,3 %', 'FORTICINE collyre 0,3%', 'FUCITHALMIC gel opht 1 %',
    'GENTALLINE collyre 0,3 %', 'GENTAMYCINE Chauvin 0,3% COLLYRE', 'MAGMOX collyre', 'MAGMOX-P collyre',
    'MICROPHTA collyre 0,3 %', 'MICROPHTA pom opht 0,3 %', 'MOXITAK PDE', 'NEOMYCINE BACITRACINE POMMADE',
    'NEOMYCINE DIAMANT COLLYRE', 'OFLOQUE collyre', 'OFUSIDIC collyre', 'POSICYCLINE pom opht 1 %',
    'RIFAMYCINE POMMADE', 'RIFAMYCINE CHIBRET collyre 1 %', 'RIFAMYCINE CHIBRET pom opht 1 %',
    'STERIMYCINE pom opht', 'TERRAMYCINE pommade', 'TETRACYCLINE PDE', 'TOBREX collyre', 'TOBREX pom opht',
    'TRIOKIT', 'UNICLAV DUO', 'VITA POS', 'VITASEPTINE collyre 10 %'
  ],
  'ANTIBIOTIQUE GENERAUX': [
    'ACLAV 1G', 'ACLAV 500 MG', 'AGRAM 250 Sirop', 'AGRAM 500 Gélules', 'AMOXY DENK CES',
    'amoxycicline 500mg', 'ampicilline 500mg', 'AUGMENTIN 500 MG', 'AXONE INJ', 'CEFATAX INJ',
    'CEFINIQUE CES', 'CEMYCINE CES 500MG', 'CEMYCINE cp 500mg', 'CIBLOR 250', 'CIBLOR 500', 'cifin',
    'CIFIN CES', 'CIFIN INFUSION 100ml', 'CIPRODAC CES', 'CIPRODAC cp 500mg', 'CLAMOXYL 500mg',
    'DIAMOX CES 250MG', 'DOXY 100', 'FLAGLY CES', 'FLAGYL OV', 'METROKIM CES',
    'METRONIDAZOLE INFUSION 100ML', 'MEYAMICINE CES', 'MEYAMICINE SP', 'NALIGYL CES', 'NORMET CES',
    'OFLOQUE CES', 'OFLOQUE OZ', 'ORACEFAL 500', 'ORITAXIM INJ', 'OROKEN CES 200 MG',
    'PYOSTACINE 500 cp', 'ROVAMYCINE 1,5M', 'ROVAMYCINE 3M', 'SUDROX CES', 'tetracycline 500mg'
  ],
  'ANTI CATARACTE': [
    'CATACOL collyre 0,1 %', 'CATARIDOL collyre', 'CATARSTAT collyre', 'CRISTOPAL collyre',
    'DULCIPHAK collyre', 'VITA-IODUROL A.T.P. COLLYRE', 'VITAMINE C FAURE collyre 2 %'
  ],
  'ANTI GLAUCOMATEUX': [
    'ALPHAGAN collyre 0,2 %', 'AZARGA', 'AZOPT collyre', 'BENTOS collyre 0,25 %',
    'BENTOS collyre 0,25 % en unidose', 'BENTOS collyre 0,50 % en unidoses', 'BETAGAN collyre 0,1 %',
    'BETAGAN collyre 0,5 %', 'BETAGAN collyre 0,5 % en unidose', 'BETANOL collyre 0,1 %',
    'BETANOL collyre 0,3 %', 'BETANOL collyre 0,6 %', 'BETOPTIC collyre 0,25 %', 'BETOPTIC collyre 0,5 %',
    'BETOPTIC susp opht 0,25 %', 'BRIMOTAS-T COLLYRE 5ml', 'CARTéABAK 1%', 'CARTéABAK 2%',
    'CARTEOL 1% LP', 'CARTEOL 1% LP unidose', 'CARTEOL 2% LP', 'CARTEOL 2% LP unidose',
    'CARTEOL collyre 0,5 %', 'CARTEOL collyre 1 %', 'CARTEOL collyre 2 %', 'COMBIGAN collyre',
    'COSOPT collyre', 'Cosopt unidose', 'DIAMOX cp séc 250 mg', 'DIAMOX pdre et solv p sol inj',
    'DIGAOL collyre 0,25 % en unidose', 'DIGAOL collyre 0,50 % en unidose', 'DIGAOL-Gé collyre 0,25 %',
    'DIGAOL-Gé collyre 0,50 %', 'DORTAS Collyre', 'DORZOLAMIDE CHIBRET collyre 2 %', 'DUOTRAV collyre',
    'GANFORT collyre', 'GAOPTOL collyre 0,25 % en unidose', 'GAOPTOL collyre 0,50 % en unidose',
    'GAOPTOL-Gé collyre 0,25 %', 'GAOPTOL-Gé collyre 0,50 %', 'GELTIM LP', 'GLUDORZ COLLYRE 5ml',
    'GLYCEROTONE sol buv', 'IOPIDINE collyre 0,5 %', 'IOPIDINE collyre 1 %', 'ISMELINE COLLYRE',
    'ISOPTO CARPINE Collyre', 'LUMIGAN 0,3%', 'MAGBRIM T', 'MONOPROST', 'NORMOPTIC 0,5%',
    'NYOLOL LP 0,1%', 'NYOLOL-Gé collyre 0,25 %', 'NYOLOL-Gé collyre 0,50 %', 'OCUTIM 0.5 (Timolol) Collyre',
    'OPHTIM collyre 0,25 %', 'OPHTIM collyre 0,50 %', 'PHOSPHOLINE IODIDE collyre 0,03 %', 'PILOBLOQ',
    'PILOCARPINE 2% COLLYRE', 'PILOCARPINE 1% COLLYRE', 'PROPINE collyre 0,1 %', 'SIMBRINZA collyre',
    'TIMABAK collyre 0,10 %', 'TIMABAK collyre 0,25 %', 'TIMABAK collyre 0,50 %',
    'TIMOLOL ALCON collyre 0,25 %', 'TIMOLOL ALCON collyre 0,50 %', 'TIMOPTOL collyre 0,10 %',
    'TIMOPTOL collyre 0,25 %', 'TIMOPTOL collyre 0,50 %', 'TIMOPTOL LP collyre 0,25 %',
    'TIMOPTOL LP collyre 0,50 %', 'TRAVATAN', 'TRAVONORM collyre 5ml', 'TRUSOPT collyre 2 %',
    'TWINZOL 5ml', 'VITACARPINE 1% COLLYRE', 'VITACARPINE 2% COLLYRE', 'XALACOM collyre', 'XALATAN collyre 0,005 %'
  ],
  'ANTI HISTAMINIQUES GENERAUX': [
    'CLARITYNE cp 10 mg', 'CLARITYNE cp efferv 10 mg', 'CLARITYNE sirop 0,1 %', 'DIMEGAN cp 4 mg',
    'DIMEGAN sirop', 'POLARAMINE cp séc 2 mg', 'POLARAMINE REPETABS cp enrobé Ad 6 mg',
    'POLARAMINE sirop 0,01 %', 'PRIMALAN cp séc Ad 10 mg', 'PRIMALAN sirop', 'TELFAST cp enrobé 120 mg',
    'TELFAST cp enrobé 180 mg', 'VIRLIX cp pelliculé séc 10 mg', 'VIRLIX sol buv 10 mg/ml',
    'ZYRTEC cp pelliculé séc 10 mg', 'ZYRTEC sol buv 10 mg/ml'
  ],
  'ANTI HYPERTENSEURS': [
    'AMLO DENK 10 MG', 'AMLO DENK 5 MG', 'CATAPRESSAN 150 MG INJ', 'ENALAPRIL 5 MG CES', 'LOXEN INJ',
    'TELMISARTAN', 'TRIATEC 10 MG', 'TRIATEC 5 MG', 'TRITAZIDE 10/12,5', 'TRITAZIDE 10/25', 'TRITAZIDE 5/12,5'
  ],
  'ANTI MYCOSIQUES': [
    'GYNODACTARIN', 'NATAMYCINE COLLYRE', 'RACINE COLLYRE 5%', 'VORICONAZOLE COLLYRE 1%'
  ],
  'ANTISEPT SANS VASOCONS': [
    'APIDINE 5', 'AZULENE COLLYRE', 'BACTYL 0,25%', 'BENZODODECINIUM CHIBRET collyre 0,025 %',
    'BETADINE sol p irrigation oculaire 5 %', 'BIOCIDAN collyre 0,025 %', 'BIOCIDAN collyre 0,025 % en unidoses',
    'CETYLYRE collyre 0,025 %', 'DESOMEDINE collyre 0,1 %', 'MONOSEPT monodoses', 'OPHTERGINE POMMADE',
    'POMMADE ANTISEPTIQUE CALMANTE', 'POMMADE OXYDE DE MERCURE CHAUVIN', 'PROPIONATE DE SODIUM CHIBRET',
    'SEPTISOL COLLYRE', 'SOPHTAL COLLYRE', 'STILLARGOL COLLYRE', 'VITABACT COLLYRE', 'VITABACT ophtadoses',
    'VITABLEU COLLYRE', 'VITARGENOL COLLYRE', 'VITASEPTOL COLLYRE', 'VITAZINC COLLYRE'
  ],
  'ANTITUSSIF': [
    'SALBUTAMOL INJ', 'SEKROL', 'UNIKOF'
  ],
  'ANTI VIRAUX': [
    'IDUVIRAN COLLYRE', 'ORAVIR 500', 'VIRA-A POMMADE', 'VIRGAN', 'VIROPHTA COLLYRE',
    'ZELITREX', 'ZOVIRAX CREME DERMIQUE', 'ZOVIRAX POMMADE OPHTALMIQUE', 'ZOVIRAX 800 comp'
  ],
  'CICATRISANTS': [
    'AMICIC collyre', 'Ecovitamine B12', 'EURONAC collyre 5 %', 'GENAC collyre 5 %', 'KERATYL collyre Ad 1 %',
    'MEDILAR', 'MonoVitamine B12 en Unidose', 'OPHTASILOXANE collyre', 'VITACIC collyre',
    'VITADROP', 'VITAMINE A DULCIS pom opht', 'VITAMINE A FAURE collyre', 'VITAMINE B12 collyre 0,05 %'
  ],
  'CORTICOIDES + ANTIBIOTIQUES': [
    'BACICOLINE A LA BACITRACINE pdre et solv p collyre', 'CEBEDEXACOL pdre et sol p collyre',
    'CHIBRO-CADRON collyre', 'CIDERMEX pom opht', 'clodex collyre', 'CO-AVAZIR', 'Co-AVAZIR collyre 5ml',
    'deicol collyre', 'DEXAGRANE collyre', 'DEXAPOLYFRA COLLYRE', 'DIFLUSTERO', 'FML', 'FRAKIDEX collyre',
    'FRAKIDEX pom opht', 'FRAMICETINE-DEXAMETHASONE Chauvin COLLYRE', 'FRAMICETINE-DEXAMETHASONE Chauvin POMMADE',
    'MAGMOX-P collyre', 'MAXIDROL collyre', 'MAXIDROL pom opht', 'STERDEX pom opht',
    'TERRACORTRIL pommade', 'TOBRADEX collyre', 'TOBRADEX pommade'
  ],
  'CORTICOIDES LOCAUX': [
    'bisdex', 'bisdex collyre', 'CHIBRO CADRON COLLYRE 5ml', 'DEXAfree unidoses',
    'DEXAMETHASONE Chauvin 0,1% COLLYRE', 'DEXAMETHASONE unidose', 'FLUCON collyre 0,1 %',
    'HEXALENSE collyre 3,57 %', 'KENACORT INJECTABLE 40mg/1ml', 'MAXIDEX collyre 0,1 %',
    'NEOPRED', 'PRED FORTE 1%', 'VEXOL 1% collyre'
  ],
  'CREMES DERMIQUES': [
    'ALOPATE', 'MYCOZEMA', 'UNIDERM'
  ],
  'DECONGESTIONNANT': [
    'boraline', 'BORALINE COLLYRE', 'CHIBROBORALINE COLLYRE', 'dacryoboraline', 'DACRYOBORALINE COLLYRE',
    'GOUTTES BLEUES opticalmax collyre', 'NAFCLOR', 'ROHTO', 'sulfenyl collyre', 'SULFENYL COLLYRE',
    'VISADRON collyre', 'VISINE COLLYRE', 'VISINE collyre comfort', 'VISINE collyre multi action',
    'visiodis collyre', 'VISIODIS collyre', 'VISIODOSE COLLYRE', 'ZOLIN COLLYRE'
  ],
  'DIVERS OPHA': [
    'BLEPHACLEAN', 'BORIPHARM GRANULES No 5 granules', 'BOTOX pdre p sol inj 100 U Allergan',
    'CORRECTOL collyre 0,1 %', 'CYSTINE B6 BAILLEUL cp enrobé', 'DIFRAREL 100 cp enrobé 100 mg',
    'DIFRAREL E cp enrobé', 'ILAST contour des yeux', 'ILAST gel paupière', 'LID CARE',
    'MERALOPS cp enrobé 200 mg', 'NACL COLLYRE 10ml', 'NACL POMMADE', 'OCAL collyre',
    'OCUVITE préservision', 'OPHTALMINE collyre', 'OPTICLUDE 3M', 'ORTOLUX', 'OXYDE MERCURIQUE JAUNE 1%',
    'POSIFORLID AUGENMASKE', 'SENSIVISION AU PLANTAIN collyre 2 %', 'SENSIVISION AU PLANTAIN collyre 2 % en unidose',
    'STERINET', 'UVICOL collyre', 'VITARUTINE collyre'
  ],
  'GOUTTES NASALES': [
    'CLARINEZ 1% AD'
  ],
  'HYPO CHOLESTEROLEMIANTS': [
    'ASPIRINE 81', 'ASPIRINE JUNIOR 100 MG', 'DIFRAREL 100 COMPRIMES', 'DIFRAREL E COMPRIMES',
    'ROVAS', 'VASTAREL'
  ],
  'LARMES ARTIFICIELLES': [
    'Lacrinorm gel', 'Gel gel'
  ],
  'LARMES LOTIONS CONTACTO': [
    'ACQUIFY', 'AOSEPT SOLUTION', 'BOSTON Simplus', 'CHLORURE DE SODIUM 250 ML', 'CLERZ',
    'COMPLETE Easy Rub', 'CONCERTO pack eco', 'CONSEPT', 'CONTACLAIR', 'EASYSEPT',
    'EFFICLEAN COMPRIMES', 'ILAST', 'INOCLEAR', 'JAZZ peroxyde', 'LACRYPOS COLLYRE', 'LENSPLUS',
    'LIQUIFILM LARMES ARTIFICIELLES ALLERGAN COLLYRE', 'LIQUIFILM TOTAL', 'LIQUINET', 'MENICARE +',
    'MENICARE SOFT', 'MENITEARS', 'METHYLCELLULOSE CHIBRET COLLYRE', 'MIRAFLOW', 'NEP Vision',
    'O CLAIR', 'OPTIFREE RepleniSH', 'OPTI-FREE supralens', 'OXYSEPT "1 étape"', 'pack Jazz',
    'pack PREMIO menicare soft', 'PEROXOL', 'POLYCLEAN', 'PRECILENS 55', 'Precilens B5', 'PROGENT',
    'REGARD code ACL 791 304-0', 'RENU MPS pack observance', 'SOLOcare Aqua', 'SOLO-care Soft doses',
    'STERI-DOSE', 'TOTAL CARE "Lentilles rigides"', 'TOTAL CLEAN', 'ULTRAZYME', 'UNIZYME', 'VISLUBE'
  ],
  'LAXATIFS ET ANTI DIARRHEIQUES': [
    'ACTAPULGITE', 'DUPHALAC SP'
  ],
  'MAGNESIUM': [
    'CALCIUM VITAMINE D3 GNR cp à croquer', 'LAROSCORBINE cp à croquer Ad 500 mg',
    'LAROSCORBINE SANS SUCRE cp à sucer 250 mg', 'MAG 2 cp 100 mg', 'MAG 2 sol buv',
    'MAGNE-B6 cp enrobé', 'MAGNE-B6 sol buv', 'MAGNES DIRECT DENK SOL BUVABLE',
    'MIDY VITAMINE C 1000 pdre p sol buv Ad 1 000 mg', 'VITAMINE B6 RICHARD cp quadriséc Ad 250 mg',
    'VITAMINE C UPSA cp à croquer 500 mg', 'VITAMINE C UPSA EFFERVESCENTE cp efferv 1 000 mg',
    'VITASCORBOL cp efferv 1 g', 'VITASCORBOL SANS SUCRE cp à croquer Ad 500 mg'
  ],
  'MYDRIATIQUES': [
    'atropine 0,5% collyre', 'atropine 1% collyre', 'ATROPINE FAURE collyre 1 %',
    'CHIBRO-ATROPINE collyre 0,5 %', 'CHIBRO-ATROPINE collyre Ad 1 %', 'CYCLOGYL 1%',
    'Cyclopentolate 1% collyre', 'HOMATROPINE FAURE collyre 1 %', 'ISOPTO-HOMATROPINE collyre 1 %',
    'MYDRIASERT', 'MYDRIATICUM collyre 0,5 %', 'mydrix collyre', 'NEOSYNEPHRINE CHIBRET collyre 10 %',
    'NEOSYNEPHRINE FAURE collyre 10 %', 'NEOSYNEPHRINE FAURE collyre 5 %', 'PHENYLEPHRIN Collyre',
    'SKIACOL collyre 0,5 %', 'T M Collyre', 'TROPICAMIDE FAURE collyre 0,5 %'
  ],
  'OVULES VAGINALES': [
    'NEOGYNAX', 'POLIGNAX 6', 'POLIGYNAX 12'
  ],
  'PANSEMENTS GASTRIQUES': [
    'ACILOC INJ', 'NOCIGEL SP', 'POLYGEL CES', 'RABEQUE 20 MG', 'RABEQUE D', 'RANITIDINE 50 MG INJ'
  ],
  'POTASSIUM': [
    'chloropotassuril', 'DIFFU-K gél 600 mg', 'kaleorid comprimés', 'kaleorid comprimés 600mg',
    'KALEORID LP cp enrobé LP 1 000 mg', 'KALEORID LP cp enrobé LP 600 mg', 'kcl'
  ],
  'SEDATIF': [
    'DIAZEPAM CES', 'DIAZEPAM INJ'
  ],
  'VASCULOTROPES': [
    'BAUSCH&LOMB LUTEINE', 'CARDIAZIDINE Gé 20 mg gélule', 'DIFRAREL "E"', 'DIFRAREL 100', 'DULCION',
    'I Caps R', 'IKARAN', 'ISKEDYL FORT', 'LACRY+', 'LOXEN LP 50', 'NaturOpta Macula 10',
    'NOOTROPYL 800', 'NUTROF TOTAL', 'OCCUGUARD Ces', 'OFTAN macula', 'PRESERVISION 3', 'RETIDIA',
    'RETINAT luteine', 'SEGLOR', 'SERMION 10', 'SERMION 5', 'SERMION Injectable', 'SERMION LYOC 10',
    'SERMION LYOC 5', 'SULFARLEME S 25', 'SUVEAL Duo', 'SUVEAL Retine', 'TANAKAN grd boite',
    'TOCO 500', 'TORENTAL LP 400', 'TRIVASTAL 50LP', 'VASCUNORMYL', 'VASOBRAL', 'VASTAREL 35',
    'VEINAMITOL SACHETS', 'VELITEN', 'VISIOPREV', 'VISIOPREV Duo', 'VITALUX', 'VITREOCLAR crono'
  ],
  'VERMIFUGES': [
    'LEVAMISOL 150 MG', 'LEVAMISOL 50 MG', 'MEBOX CES', 'MEBOX SP'
  ],
  'VITAMINES': [
    'BENERVA COMPRIMES', 'CEVITE', 'CIPROVITAL SP', 'FOREVER ABSORBENT - C', 'FORTALINE PLUS',
    'FORVER VISION', 'HIFER SP', 'MULTIVITAMINE SP', 'MY VITA AD', 'MY VITA KID', 'OCUGUARD',
    'PRESERVISION COMPRIMES', 'ROVIGON/ CAPSULES', 'TRIBEXFORT COMPRIMES', 'TRIOMEGA',
    'VITAMINE B6 CES', 'VITAMINE C INJ', 'VITAMINES B-DENK'
  ]
};

async function seedFrenchDrugs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing drugs
    await Drug.deleteMany({});
    console.log('Cleared existing drugs');

    // Create drugs from maquettes
    const drugs = [];
    let totalCount = 0;

    for (const [category, medications] of Object.entries(medicationsByCategory)) {
      for (const med of medications) {
        drugs.push({
          name: med,
          genericName: med.split(' ')[0], // First word as generic name
          category: category,
          dosageForm: determineDosageForm(med),
          route: determineRoute(category, med),
          isActive: true
        });
        totalCount++;
      }
    }

    await Drug.insertMany(drugs);
    console.log(`Created ${totalCount} drugs in ${Object.keys(medicationsByCategory).length} French categories`);

    // Summary by category
    console.log('\n=== SUMMARY BY CATEGORY ===');
    for (const [category, medications] of Object.entries(medicationsByCategory)) {
      console.log(`${category}: ${medications.length} medications`);
    }

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

function determineDosageForm(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('collyre') || nameLower.includes('goutte')) return 'collyre';
  if (nameLower.includes('pom') || nameLower.includes('pommade')) return 'pommade';
  if (nameLower.includes('cp') || nameLower.includes('comprimé') || nameLower.includes('ces')) return 'comprimé';
  if (nameLower.includes('inj') || nameLower.includes('injectable')) return 'injectable';
  if (nameLower.includes('sirop') || nameLower.includes('sol buv')) return 'sirop';
  if (nameLower.includes('gél') || nameLower.includes('capsule')) return 'gélule';
  if (nameLower.includes('suppo')) return 'suppositoire';
  if (nameLower.includes('unidose')) return 'unidose';
  return 'autre';
}

function determineRoute(category, name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('collyre') || category.includes('LOCAUX') || category.includes('OPHA')) return 'ophtalmique';
  if (nameLower.includes('pom') || nameLower.includes('pommade')) return 'topique';
  if (nameLower.includes('inj') || nameLower.includes('injectable')) return 'parentérale';
  if (nameLower.includes('sirop') || nameLower.includes('cp') || nameLower.includes('gél')) return 'orale';
  if (nameLower.includes('suppo')) return 'rectale';
  return 'orale';
}

seedFrenchDrugs();
