# E2E Test Screenshot & Verification Fix Plan

## Problem Statement

**Critical Issue:** Tests report "✅ Invoicing loaded" even when page shows 404 error.

**Root Cause:** Tests only check:
1. URL changed (`page.url.endswith("/invoices")`) - TRUE even on 404
2. Network idle (`wait_for_load_state('networkidle')`) - TRUE even on 404
3. Element counts that may be 0 but tests still pass

**Current State:**
- Screenshots: 121MB total (PNG, full_page, 1920x2700+ px)
- No actual content verification
- No 404 detection
- False positives everywhere

---

## Solution Architecture

### 1. Screenshot Optimization
- **Format:** JPEG with quality=40 (vs PNG)
- **Size:** Viewport only, not full_page (1280x720)
- **Compression:** ~90% size reduction
- **Folder:** `/tests/playwright/screenshots/verified/`

### 2. Content Verification Strategy
For each page, verify:
1. **NOT a 404** - Check for absence of error indicators
2. **Expected element EXISTS** - Not just "count >= 0"
3. **Page title/header matches** - Actual text content
4. **Screenshot captures actual state** - Visual evidence

### 3. 404 Detection Patterns
```python
def is_404_or_error(page):
    """Check if page shows error state"""
    error_indicators = [
        'text="404"',
        'text="Not Found"',
        'text="Page not found"',
        'text="Error"',
        '[class*="error-page"]',
        '[class*="not-found"]',
        'text="Something went wrong"',
    ]
    for indicator in error_indicators:
        if page.locator(indicator).count() > 0:
            return True
    return False
```

---

## Implementation Tasks

### Task 1: Create Verified Screenshots Folder
```bash
mkdir -p /Users/xtm888/magloire/tests/playwright/screenshots/verified
```

### Task 2: Create Screenshot Utility
```python
def take_verified_screenshot(page, name, expected_element):
    """
    Take optimized screenshot ONLY if page is valid.
    Returns (success, error_message)
    """
    # Check for 404 first
    if is_404_or_error(page):
        page.screenshot(
            path=f"screenshots/verified/{name}_ERROR.jpg",
            type='jpeg',
            quality=40
        )
        return False, "Page shows 404 or error"

    # Verify expected element exists
    if page.locator(expected_element).count() == 0:
        page.screenshot(
            path=f"screenshots/verified/{name}_MISSING_ELEMENT.jpg",
            type='jpeg',
            quality=40
        )
        return False, f"Expected element not found: {expected_element}"

    # All good - take success screenshot
    page.screenshot(
        path=f"screenshots/verified/{name}.jpg",
        type='jpeg',
        quality=40,
        full_page=False  # Viewport only
    )
    return True, None
```

### Task 3: Define Page Verification Rules
| Page | URL Pattern | Required Element | Title/Header |
|------|-------------|------------------|--------------|
| Dashboard | `/dashboard` | `[class*="stat"], [class*="card"]` | "Tableau de bord" |
| Patients | `/patients` | `table, [class*="patient-list"]` | "Patients" |
| Queue | `/queue` | `[class*="queue"]` | "File d'attente" |
| Appointments | `/appointments` | `[class*="calendar"], table` | "Rendez-vous" |
| Ophthalmology | `/ophthalmology` | `[class*="dashboard"]` | "Ophtalmologie" |
| Pharmacy | `/pharmacy` | `table, [class*="inventory"]` | "Pharmacie" |
| Laboratory | `/laboratory` | `[class*="lab"], table` | "Laboratoire" |
| Invoicing | `/invoices` | `table, [class*="invoice"]` | "Facturation" |

### Task 4: Update Test Functions
Replace current pattern:
```python
# OLD (false positive prone)
page.goto(f"{BASE_URL}/invoices")
page.wait_for_load_state("networkidle")
log_result("Invoicing", "Page loads", page.url.endswith("/invoices"))
```

With:
```python
# NEW (actual verification)
page.goto(f"{BASE_URL}/invoices")
page.wait_for_load_state("networkidle")
success, error = take_verified_screenshot(page, "invoicing", "table")
log_result("Invoicing", "Page loads correctly", success, error)
```

---

## Expected Results

### Size Reduction
| Metric | Before | After |
|--------|--------|-------|
| Format | PNG | JPEG q=40 |
| Dimensions | 1920x2700 | 1280x720 |
| Per image | ~300KB-3MB | ~30-80KB |
| Total folder | 121MB | ~10-15MB |

### Accuracy Improvement
| Scenario | Before | After |
|----------|--------|-------|
| 404 page | ✅ PASS (wrong) | ❌ FAIL (correct) |
| Missing element | ✅ PASS (wrong) | ❌ FAIL (correct) |
| Actual page | ✅ PASS | ✅ PASS |

---

## Sources

- [Playwright Screenshots Documentation](https://playwright.dev/python/docs/screenshots)
- [Screenshot Quality Options](https://playwright.dev/docs/screenshots)
- [Feature Request: WebP Format](https://github.com/microsoft/playwright/issues/22984)
- [Screenshot Size Reduction](https://github.com/microsoft/playwright/issues/29218)
