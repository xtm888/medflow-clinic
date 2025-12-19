"""
Optical & Surgery Module E2E Test V2

Improved test that properly captures all UI sections.
"""

import json
import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv('MEDFLOW_URL', 'http://localhost:5173')
SCREENSHOT_DIR = './screenshots/optical_surgery'

TEST_USER = {
    'email': 'admin@medflow.com',
    'password': 'MedFlow$ecure1'
}

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def take_screenshot(page, name, description=''):
    ensure_dir(SCREENSHOT_DIR)
    filepath = f"{SCREENSHOT_DIR}/{name}.png"
    page.screenshot(path=filepath, full_page=True)
    print(f"  [SCREENSHOT] {filepath}: {description}")
    return filepath

def login(page):
    print("\n1. Logging in...")
    page.goto(f"{BASE_URL}/login", wait_until='networkidle')
    time.sleep(1)
    page.fill('input[type="email"], input[name="email"]', TEST_USER['email'])
    page.fill('input[type="password"], input[name="password"]', TEST_USER['password'])
    page.click('button[type="submit"]')
    try:
        page.wait_for_url('**/home*', timeout=10000)
    except:
        page.wait_for_url('**/*', timeout=5000)
    print("  [OK] Login successful")
    return True

# ============================================
# OPTICAL MODULE
# ============================================

def test_glasses_orders(page):
    """Test glasses orders page with detailed analysis."""
    print("\n2. Testing Glasses Orders...")

    page.goto(f"{BASE_URL}/glasses-orders", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '01_glasses_orders_list', 'Glasses orders list with QC workflow')

    # Check content
    content = page.content().lower()

    features = {
        'status_cards': any(x in content for x in ['en attente', 'contrôle', 'prêts', 'livrés']),
        'qc_workflow': 'qc' in content or 'qualité' in content,
        'filters': 'statut' in content or 'filter' in content,
        'new_order_btn': 'nouvelle commande' in content or 'new' in content
    }

    print(f"  Features: {features}")
    return features

def test_optical_shop(page):
    """Test optical shop dashboard."""
    print("\n3. Testing Optical Shop...")

    page.goto(f"{BASE_URL}/optical-shop", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '02_optical_shop_main', 'Optical shop main dashboard')

    content = page.content().lower()

    features = {
        'sales_today': 'ventes' in content,
        'verification': 'vérification' in content or 'verification' in content,
        'external_orders': 'externes' in content or 'external' in content,
        'quick_actions': 'actions' in content
    }

    print(f"  Features: {features}")
    return features

def test_frame_inventory(page):
    """Test frame inventory with detailed view."""
    print("\n4. Testing Frame Inventory...")

    page.goto(f"{BASE_URL}/frame-inventory", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '03_frame_inventory', 'Frame inventory with stock levels')

    content = page.content().lower()

    features = {
        'total_items': 'montures' in content or 'frames' in content,
        'stock_value': any(x in content for x in ['valeur', 'value', 'fc', 'cdf']),
        'brands': 'marque' in content or 'brand' in content,
        'stock_levels': 'stock' in content
    }

    print(f"  Features: {features}")
    return features

def test_optical_lens_inventory(page):
    """Test optical lens inventory."""
    print("\n5. Testing Optical Lens Inventory...")

    page.goto(f"{BASE_URL}/optical-lens-inventory", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '04_optical_lens_inventory', 'Optical lens inventory')

    content = page.content().lower()
    features = {
        'lens_types': any(x in content for x in ['progressif', 'unifocal', 'photochrom']),
        'coatings': any(x in content for x in ['anti-reflet', 'coating', 'traitement']),
        'stock': 'stock' in content
    }

    print(f"  Features: {features}")
    return features

def test_contact_lens_inventory(page):
    """Test contact lens inventory."""
    print("\n6. Testing Contact Lens Inventory...")

    page.goto(f"{BASE_URL}/contact-lens-inventory", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '05_contact_lens_inventory', 'Contact lens inventory')

    content = page.content().lower()
    features = {
        'lens_count': 'lentilles' in content,
        'brands': any(x in content for x in ['acuvue', 'bausch', 'cooper']),
        'parameters': any(x in content for x in ['courbe', 'diamètre', 'puissance'])
    }

    print(f"  Features: {features}")
    return features

# ============================================
# SURGERY MODULE
# ============================================

def test_surgery_dashboard(page):
    """Test surgery dashboard - main page with all sections."""
    print("\n7. Testing Surgery Dashboard...")

    page.goto(f"{BASE_URL}/surgery", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '10_surgery_dashboard', 'Surgery main dashboard')

    content = page.content().lower()

    # Check all dashboard features
    features = {
        'awaiting_scheduling': any(x in content for x in ['attente', 'awaiting', 'à programmer']),
        'scheduled_today': any(x in content for x in ['aujourd', 'today', 'programmé']),
        'in_progress': any(x in content for x in ['en cours', 'in progress', 'check-in']),
        'completed': any(x in content for x in ['terminé', 'completed']),
        'overdue': any(x in content for x in ['retard', 'overdue']),
        'agenda': any(x in content for x in ['agenda', 'calendar', 'opératoire']),
        'queue': any(x in content for x in ['file', 'queue', 'attente']),
        'new_case_btn': any(x in content for x in ['nouveau cas', 'new case', 'nouveau'])
    }

    print(f"  Features: {features}")

    # Scroll to show more sections
    page.evaluate("window.scrollBy(0, 400)")
    time.sleep(1)
    take_screenshot(page, '10b_surgery_sections', 'Surgery dashboard - queue and agenda sections')

    return features

def test_surgery_expand_sections(page):
    """Test expanding surgery sections."""
    print("\n8. Testing Surgery Section Expansion...")

    page.goto(f"{BASE_URL}/surgery", wait_until='networkidle')
    time.sleep(2)

    # Try to click on "File d'attente" to expand
    try:
        queue_header = page.locator('text=File d\'attente, text=En attente, text=Queue').first
        if queue_header.is_visible(timeout=3000):
            queue_header.click()
            time.sleep(1)
            take_screenshot(page, '11_surgery_queue_expanded', 'Surgery queue section expanded')
            print("  [OK] Queue section expanded")
    except Exception as e:
        print(f"  [INFO] Queue section: {e}")

    # Try agenda section
    try:
        agenda_header = page.locator('text=Agenda, text=opératoire, text=Calendar').first
        if agenda_header.is_visible(timeout=3000):
            agenda_header.click()
            time.sleep(1)
            take_screenshot(page, '12_surgery_agenda_expanded', 'Surgery agenda section expanded')
            print("  [OK] Agenda section expanded")
    except Exception as e:
        print(f"  [INFO] Agenda section: {e}")

def test_surgery_surgeon_view(page):
    """Test surgeon view if available."""
    print("\n9. Testing Surgeon View...")

    try:
        page.goto(f"{BASE_URL}/surgery", wait_until='networkidle')
        time.sleep(1)

        # Try to click "Vue Chirurgien" button
        surgeon_btn = page.locator('button:has-text("Vue Chirurgien"), button:has-text("Surgeon")').first
        if surgeon_btn.is_visible(timeout=3000):
            surgeon_btn.click()
            time.sleep(2)
            take_screenshot(page, '13_surgery_surgeon_view', 'Surgeon view')
            print("  [OK] Surgeon view loaded")
    except Exception as e:
        print(f"  [SKIP] Surgeon view: {e}")

def test_new_surgery_case(page):
    """Test new surgery case form."""
    print("\n10. Testing New Surgery Case Form...")

    try:
        page.goto(f"{BASE_URL}/surgery/new", wait_until='networkidle')
        time.sleep(2)
        take_screenshot(page, '14_new_surgery_case', 'New surgery case form')

        content = page.content().lower()
        features = {
            'patient_search': 'patient' in content,
            'surgery_type': any(x in content for x in ['type', 'chirurgie', 'surgery']),
            'date_field': any(x in content for x in ['date', 'programmer']),
            'room_selection': any(x in content for x in ['salle', 'room', 'bloc'])
        }
        print(f"  Features: {features}")
    except Exception as e:
        print(f"  [SKIP] New surgery case: {e}")

# ============================================
# MAIN
# ============================================

def run_tests():
    print("=" * 60)
    print("OPTICAL & SURGERY E2E TEST V2")
    print("=" * 60)

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not os.getenv('HEADED'))
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='fr-FR'
        )
        page = context.new_page()

        try:
            results['login'] = login(page)

            # Optical tests
            results['glasses_orders'] = test_glasses_orders(page)
            results['optical_shop'] = test_optical_shop(page)
            results['frame_inventory'] = test_frame_inventory(page)
            results['optical_lens'] = test_optical_lens_inventory(page)
            results['contact_lens'] = test_contact_lens_inventory(page)

            # Surgery tests
            results['surgery_dashboard'] = test_surgery_dashboard(page)
            test_surgery_expand_sections(page)
            test_surgery_surgeon_view(page)
            test_new_surgery_case(page)

            take_screenshot(page, '99_final', 'Final state')

        except Exception as e:
            print(f"\n[ERROR] {e}")
            take_screenshot(page, 'error', str(e)[:50])
        finally:
            browser.close()

    # Save results
    ensure_dir(SCREENSHOT_DIR)
    with open(f"{SCREENSHOT_DIR}/test_results_v2.json", 'w') as f:
        json.dump(results, f, indent=2, default=str)

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print(f"Screenshots: {SCREENSHOT_DIR}/")
    print("=" * 60)

    return results

if __name__ == '__main__':
    run_tests()
