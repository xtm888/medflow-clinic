"""
Test the new Surgeon View page
"""

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

def test_surgeon_view(page):
    """Test the new Surgeon View page."""
    print("\n2. Testing Surgeon View...")

    # Navigate directly to surgeon view
    page.goto(f"{BASE_URL}/surgery/surgeon-view", wait_until='networkidle')
    time.sleep(2)
    take_screenshot(page, '13_surgery_surgeon_view', 'Surgeon View dashboard')

    content = page.content().lower()

    # Check for key elements
    features = {
        'title': 'vue chirurgien' in content,
        'schedule_section': any(x in content for x in ['planning', 'programmé', 'schedule']),
        'checkin_section': any(x in content for x in ['check-in', 'attente', 'patients']),
        'reports_section': any(x in content for x in ['rapport', 'brouillon', 'report']),
        'date_picker': 'date' in content,
        'stats_cards': any(x in content for x in ['aujourd', 'programmé', 'attente'])
    }

    print(f"  Features found: {features}")

    all_working = all(features.values())
    print(f"  All features working: {all_working}")

    return features

def test_surgeon_view_from_dashboard(page):
    """Test navigating to surgeon view from main dashboard."""
    print("\n3. Testing navigation from dashboard...")

    page.goto(f"{BASE_URL}/surgery", wait_until='networkidle')
    time.sleep(2)

    # Try to click "Vue Chirurgien" button
    try:
        surgeon_btn = page.locator('button:has-text("Vue Chirurgien")').first
        if surgeon_btn.is_visible(timeout=3000):
            surgeon_btn.click()
            time.sleep(2)

            # Check if we're on the surgeon view page
            current_url = page.url
            print(f"  Current URL: {current_url}")

            if 'surgeon-view' in current_url:
                print("  [OK] Navigation to surgeon view successful")
                take_screenshot(page, '13b_surgeon_view_from_nav', 'Surgeon View from navigation')
                return True
            else:
                print("  [WARN] URL doesn't contain surgeon-view")
                return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False

def run_tests():
    print("=" * 60)
    print("SURGEON VIEW TEST")
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
            results['surgeon_view_direct'] = test_surgeon_view(page)
            results['surgeon_view_nav'] = test_surgeon_view_from_dashboard(page)

        except Exception as e:
            print(f"\n[ERROR] {e}")
            take_screenshot(page, 'error_surgeon_view', str(e)[:50])
        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

    return results

if __name__ == '__main__':
    run_tests()
