# Plan d'Amélioration Architecture MedFlow

**Date**: 2025-12-22
**Basé sur**: Analyse architecture ultra-détaillée + vérification codebase
**Dernière mise à jour**: 2025-12-22

---

## Statut d'Implémentation

| Priorité | Tâche | Statut | Date |
|----------|-------|--------|------|
| **P0-1** | Transaction dans appointmentController.checkInAppointment | ✅ Fait | 2025-12-22 |
| **P0-2** | Documenter comportement seuil chirurgie 100% | ✅ Validé (comportement correct) | 2025-12-22 |
| **P1-4** | Draft factures pharmacie | ✅ Fait | 2025-12-22 |
| **P2-8** | Standardiser API companies | ✅ Fait | 2025-12-22 |
| **P2-9** | Déprécier endpoint check-in dupliqué | ✅ Fait | 2025-12-22 |
| **P1-5** | Services de domaine (BillingService, SurgeryService) | ✅ Fait | 2025-12-22 |
| **P1-6** | Modèle CompanyUsage | ✅ Fait | 2025-12-22 |
| **P2-7** | Matching appareils avec apprentissage | ⏳ À faire | - |

### Fichiers Modifiés (2025-12-22)

1. **backend/controllers/appointmentController.js**
   - Ajout import `mongoose`
   - Refactoring `checkInAppointment()` avec transaction MongoDB
   - Pattern identique à `queueController.addToQueue()`

2. **backend/models/Invoice.js**
   - Ajout champ `source` (enum: manual, visit, pharmacy, laboratory, optical, ivt, surgery, import)
   - Ajout champ `requiresReview` (boolean)
   - Ajout champs `reviewedBy` et `reviewedAt`

3. **backend/models/Prescription.js**
   - `generateInvoice()` crée maintenant avec `status: 'draft'` au lieu de 'issued'
   - Ajout `source: 'pharmacy'` et `requiresReview: true`

4. **backend/routes/invoices.js**
   - Nouveau endpoint `GET /api/invoices/pharmacy/pending-review`
   - Nouveau endpoint `POST /api/invoices/pharmacy/:id/finalize`

5. **backend/controllers/companyController.js**
   - `getCompanyInvoices()` retourne maintenant `data: []` au lieu de `data: {invoices: []}`
   - Ajout `meta: { totalBilled, totalPaid, totalOutstanding, count }`

6. **backend/middleware/deprecation.js** (nouveau fichier)
   - Middleware `deprecate()` pour marquer endpoints obsolètes
   - Middleware `sunsetBlock()` pour bloquer après date de suppression

7. **backend/routes/appointments.js**
   - Import middleware deprecation
   - Route `/:id/checkin` marquée deprecated (sunset: 2026-03-01)

8. **backend/models/CompanyUsage.js** (nouveau fichier)
   - Modèle pour tracker usage annuel par patient/company/année fiscale
   - Méthodes: `recordInvoiceUsage()`, `reverseInvoiceUsage()`, `rebuildFromInvoices()`
   - Intégré dans `Invoice.applyCompanyBilling()` pour lookup O(1) au lieu d'agrégation

9. **backend/services/domain/BillingService.js** (nouveau fichier)
   - Service d'orchestration paiements
   - Méthodes: `processPayment()`, `syncPaymentToServices()`, `processRefund()`, `cancelInvoice()`, `finalizeInvoice()`
   - Centralise la logique dispersée dans invoiceController

10. **backend/services/domain/SurgeryService.js** (nouveau fichier)
    - Service gestion cas chirurgie
    - Méthodes: `createCasesForPaidItems()`, `createCasesIfNeeded()`, `updateStatus()`
    - Extrait de invoiceController pour meilleure testabilité

11. **backend/scripts/migrateCompanyUsage.js** (nouveau fichier)
    - Script migration pour peupler CompanyUsage depuis factures existantes
    - Options: `--dry-run`, `--year`, `--all-years`, `--company`, `--verbose`

12. **backend/controllers/invoiceController.js**
    - Import des services de domaine (BillingService, SurgeryService)
    - Fonctions helper surgery refactorisées pour déléguer aux services
    - Code legacy commenté pour référence

---

## Résumé Exécutif

Suite à l'analyse approfondie du codebase MedFlow, ce plan priorise les améliorations selon leur impact sur la stabilité opérationnelle et la maintenabilité.

---

## P0 - Critique (Bugs Potentiels)

### 1. Risque de Doublons Visit dans appointmentController

**Problème identifié**: `appointmentController.checkInAppointment()` n'utilise PAS de transaction MongoDB, contrairement à `queueController.addToQueue()`.

**Risque**: Requêtes concurrentes peuvent créer des Visit en double.

**Fichiers concernés**:
- `backend/controllers/appointmentController.js` (lignes 377-473)
- `backend/controllers/queueController.js` (lignes 152-404) - référence avec transaction

**Solution**:
```javascript
// appointmentController.js - checkInAppointment()
async checkInAppointment(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const appointment = await Appointment.findById(id).session(session);

    // Idempotency check ATOMIQUE
    if (appointment.status === 'checked-in' && appointment.visit) {
      await session.abortTransaction();
      return success(res, { /* ... */ });
    }

    // Création Visit dans la transaction
    const visit = await Visit.create([visitData], { session });
    appointment.visit = visit[0]._id;
    await appointment.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

**Effort**: 1-2 heures
**Impact**: Élimine les doublons de visites

---

### 2. Condition Paiement → SurgeryCase sans Seuil

**Problème identifié**: SurgeryCase créé uniquement quand item = 100% payé. Pas de seuil configurable pour acomptes chirurgie.

**Fichiers concernés**:
- `backend/controllers/invoiceController.js` (lignes 169-293)

**Solution proposée**:
```javascript
// Nouvelle configuration dans Company ou SurgerySettings
surgeryDepositThreshold: {
  type: Number,
  default: 100, // 100% = comportement actuel
  min: 0,
  max: 100
}

// invoiceController.js - createSurgeryCasesForPaidItems()
const isPaymentSufficient = (item, threshold) => {
  const paidPercentage = (item.paidAmount / item.total) * 100;
  return paidPercentage >= threshold;
};

// Créer SurgeryCase quand seuil atteint
if (isPaymentSufficient(item, surgeryDepositThreshold)) {
  await createSurgeryCase(item);
}
```

**Alternative rapide**: Documenter le comportement actuel et exiger paiement complet avant inscription chirurgie.

**Effort**: 2-4 heures (avec config) ou 30 min (documentation)
**Impact**: Clarté métier sur workflow chirurgie

---

### 3. Relation SurgeryCase au Niveau Item (Déjà Implémenté ✓)

**Statut**: Le codebase utilise déjà `item.surgeryCaseCreated` et `item.surgeryCaseId` au niveau des items de facture.

**Aucune action requise** - Votre documentation doit être mise à jour pour refléter cette implémentation.

---

## P1 - Important (Complexité Opérationnelle)

### 4. Statut Draft pour Factures Pharmacie

**Problème**: Couplage fort dispensation → facturation sans possibilité de correction.

**Fichiers à modifier**:
- `backend/controllers/pharmacyController.js`
- `backend/models/Invoice.js`
- `frontend/src/pages/PharmacyDetail.jsx`

**Solution**:
```javascript
// pharmacyController.js - dispenseItems()
const invoice = await Invoice.create({
  ...invoiceData,
  status: 'draft',  // Changement clé
  source: 'pharmacy_dispensing',
  requiresReview: true
});

// Nouvelle route pour validation
router.post('/invoices/:id/finalize-pharmacy', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (invoice.source !== 'pharmacy_dispensing') {
    return error(res, 'Cette facture ne provient pas de la pharmacie');
  }
  invoice.status = 'pending';
  invoice.finalizedBy = req.user.id;
  invoice.finalizedAt = new Date();
  await invoice.save();
});
```

**Frontend**: Nouveau dashboard "Factures Pharmacie à Valider"

**Effort**: 4-6 heures
**Impact**: Réduction erreurs de facturation pharmacie

---

### 5. Services de Domaine pour Cascades Billing

**Problème**: Logique dispersée dans controllers avec couplages cachés.

**Refactoring proposé**:
```
backend/services/
  domain/
    BillingService.js      # Orchestration paiements
    SurgeryService.js      # Création/gestion cas chirurgie
    QueueService.js        # Check-in unifiée
    ConventionService.js   # Calculs coverage
```

**Exemple BillingService.js**:
```javascript
class BillingService {
  async processPayment(invoiceId, paymentData, userId) {
    const invoice = await Invoice.findById(invoiceId);

    // 1. Enregistrer le paiement
    const payment = await this.recordPayment(invoice, paymentData);

    // 2. Mettre à jour le résumé
    await this.updateInvoiceSummary(invoice);

    // 3. Créer cas chirurgie si nécessaire
    const surgeryCases = await SurgeryService.createCasesIfNeeded(invoice, userId);

    // 4. Dispatcher si optique
    await this.dispatchOpticalIfNeeded(invoice);

    // 5. Notifications
    await NotificationService.paymentReceived(invoice, payment);

    return { invoice, payment, surgeryCases };
  }
}

module.exports = new BillingService();
```

**Effort**: 8-16 heures (refactoring progressif)
**Impact**: Maintenabilité et testabilité accrues

---

### 6. Agrégat CompanyUsage pour Plafonds Annuels

**Problème actuel**: Chaque calcul de coverage fait une agrégation MongoDB sur toutes les factures YTD - coûteux en performance.

**Solution avec modèle dédié**:
```javascript
// backend/models/CompanyUsage.js
const companyUsageSchema = new mongoose.Schema({
  patient: { type: ObjectId, ref: 'Patient', required: true },
  company: { type: ObjectId, ref: 'Company', required: true },
  fiscalYear: { type: Number, required: true },

  // Totaux par catégorie
  categories: [{
    category: String,
    totalBilled: { type: Number, default: 0 },
    totalCovered: { type: Number, default: 0 },
    invoiceCount: { type: Number, default: 0 }
  }],

  // Totaux globaux
  totalBilled: { type: Number, default: 0 },
  totalCovered: { type: Number, default: 0 },
  visitCount: { type: Number, default: 0 },

  lastUpdated: Date,
  lastInvoice: { type: ObjectId, ref: 'Invoice' }
}, {
  timestamps: true
});

// Index composite pour lookups rapides
companyUsageSchema.index({ patient: 1, company: 1, fiscalYear: 1 }, { unique: true });

// Méthode statique pour mise à jour atomique
companyUsageSchema.statics.recordUsage = async function(invoice) {
  const year = invoice.dateIssued.getFullYear();

  // Upsert avec incréments atomiques
  await this.findOneAndUpdate(
    { patient: invoice.patient, company: invoice.companyBilling.company, fiscalYear: year },
    {
      $inc: {
        totalBilled: invoice.summary.total,
        totalCovered: invoice.summary.companyShare,
        visitCount: 1
      },
      $set: { lastUpdated: new Date(), lastInvoice: invoice._id }
    },
    { upsert: true }
  );
};
```

**Migration**: Script pour calculer usage YTD depuis factures existantes.

**Effort**: 6-8 heures
**Impact**: Performance 10-100x sur calculs coverage pour patients avec historique

---

## P2 - Amélioration (UX/DX)

### 7. Matching Interactif Appareils avec Apprentissage

**Implémentation proposée**:
```javascript
// backend/models/DeviceFolderMapping.js
const deviceFolderMappingSchema = new mongoose.Schema({
  device: { type: ObjectId, ref: 'Device', required: true },
  folderPattern: String,  // Regex ou pattern détecté
  patient: { type: ObjectId, ref: 'Patient' },
  confidence: { type: Number, min: 0, max: 100 },
  verifiedBy: { type: ObjectId, ref: 'User' },
  verifiedAt: Date,
  autoLearn: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 }
});

// backend/services/deviceMatchingService.js
class DeviceMatchingService {
  async suggestPatientMatch(deviceId, folderName, dicomMetadata) {
    // 1. Chercher mapping existant vérifié
    const existingMapping = await DeviceFolderMapping.findOne({
      device: deviceId,
      folderPattern: this.extractPattern(folderName),
      verifiedBy: { $exists: true }
    }).populate('patient');

    if (existingMapping) {
      return { patient: existingMapping.patient, confidence: 95, source: 'learned' };
    }

    // 2. Extraction depuis métadonnées DICOM
    if (dicomMetadata?.PatientName) {
      const matches = await Patient.find({
        $text: { $search: dicomMetadata.PatientName }
      }).limit(5);
      return { suggestions: matches, confidence: 60, source: 'dicom' };
    }

    // 3. Fuzzy matching sur pattern
    return { suggestions: [], confidence: 0, source: 'unknown' };
  }

  async confirmMapping(deviceId, folderPattern, patientId, userId) {
    await DeviceFolderMapping.findOneAndUpdate(
      { device: deviceId, folderPattern },
      {
        patient: patientId,
        verifiedBy: userId,
        verifiedAt: new Date(),
        $inc: { usageCount: 1 }
      },
      { upsert: true }
    );
  }
}
```

**Effort**: 8-12 heures
**Impact**: Réduction travail manuel matching patients ↔ images

---

### 8. Standardisation Structure API Companies

**Problème**: `GET /api/companies/:id/invoices` retourne `{data: {invoices: []}}` au lieu du standard.

**Solution**:
```javascript
// AVANT (incohérent)
res.json({ data: { invoices: [], totalAmount: 5000 } });

// APRÈS (standard)
res.json({
  data: invoices,
  meta: { totalAmount: 5000, count: invoices.length },
  pagination: { page, limit, total, pages }
});
```

**Effort**: 1-2 heures
**Impact**: Cohérence API, facilité d'intégration frontend

---

### 9. Unification des Endpoints Check-in

**Recommandation**: Déprécier `/api/appointments/:id/checkin` au profit de `/api/queue` unique.

```javascript
// routes/appointments.js
router.put('/:id/checkin',
  deprecationMiddleware('Use POST /api/queue with appointmentId instead'),
  appointmentController.checkInAppointment
);

// middleware/deprecation.js
const deprecationMiddleware = (message) => (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Mar 2026 00:00:00 GMT');
  res.set('Link', '</api/queue>; rel="successor-version"');
  console.warn(`DEPRECATED: ${req.originalUrl} - ${message}`);
  next();
};
```

**Effort**: 2 heures
**Impact**: Réduction surface API, moins de confusion

---

## Priorités d'Implémentation Recommandées

| Priorité | Tâche | Effort | Impact | Sprint |
|----------|-------|--------|--------|--------|
| **P0-1** | Transaction dans appointmentController.checkInAppointment | 1-2h | Critique | 1 |
| **P0-2** | Documenter/configurer seuil chirurgie | 30min-4h | Critique | 1 |
| **P1-4** | Draft factures pharmacie | 4-6h | Élevé | 1 |
| **P2-8** | Standardiser API companies | 1-2h | Moyen | 1 |
| **P2-9** | Déprécier endpoint check-in dupliqué | 2h | Moyen | 1 |
| **P1-5** | Services de domaine (BillingService) | 8-16h | Élevé | 2 |
| **P1-6** | Modèle CompanyUsage | 6-8h | Élevé | 2 |
| **P2-7** | Matching appareils avec apprentissage | 8-12h | Moyen | 3 |

---

## Documentation à Mettre à Jour

1. **medflow-architecture-ultra-detailed-fr.html**:
   - Corriger: SurgeryCase lié au niveau Invoice (pas InvoiceItem)
   - Confirmer: Visit → OphthalmologyExam est 1:1
   - Ajouter: Cross-clinic patient access déjà implémenté

2. **CLAUDE.md**:
   - Ajouter section sur services de domaine (après refactoring P1-5)
   - Documenter CompanyUsage model (après P1-6)

---

## Métriques de Succès

| Métrique | Avant | Cible |
|----------|-------|-------|
| Doublons Visit/jour | À mesurer | 0 |
| Temps calcul coverage (>100 factures YTD) | ~500ms | <50ms |
| Corrections factures pharmacie/semaine | À mesurer | -50% |
| Endpoints API incohérents | 3 | 0 |
