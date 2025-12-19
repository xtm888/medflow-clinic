"""
StudioVision Components with Patient - Full Comparison
"""
import os
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/studiovision_comparison"

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def login(page):
    """Login to MedFlow"""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', 'admin@medflow.com')
    page.fill('input[type="password"]', 'MedFlow$ecure1')
    page.click('button[type="submit"]')
    page.wait_for_url("**/home**", timeout=15000)
    print("✓ Logged in successfully")

def take_consultation_screenshots(page):
    """Take screenshots with actual patient consultation"""
    results = []

    # 1. Go to consultation page
    print("\n📸 Going to New Consultation...")
    page.goto(f"{BASE_URL}/ophthalmology/consultation")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # 2. Search for patient
    print("📸 Searching for patient...")
    patient_input = page.locator('input[type="text"]').last
    patient_input.fill("JEAN")
    page.wait_for_timeout(2000)

    # 3. Click on JEAN KULALUKA
    print("📸 Selecting patient...")
    patient_option = page.locator('text=JEAN KULALUKA').first
    if patient_option.count() > 0:
        patient_option.click()
        page.wait_for_timeout(1500)

    # 4. Click start consultation
    print("📸 Starting consultation...")
    page.wait_for_timeout(1000)
    start_btn = page.locator('button:has-text("Vérifier et Commencer")').first
    if start_btn.count() > 0 and start_btn.is_enabled():
        start_btn.click()
        page.wait_for_timeout(3000)

    # 5. CRITICAL: Handle identity verification modal
    print("📸 Handling identity verification...")
    continue_btn = page.locator('button:has-text("Continuer sans vérification")').first
    if continue_btn.count() > 0:
        continue_btn.click()
        page.wait_for_timeout(3000)
        page.wait_for_load_state("networkidle")
        print("   ✓ Bypassed identity verification")

    # Take screenshot after verification
    page.screenshot(path=f"{SCREENSHOT_DIR}/20_after_verification.png", full_page=True)
    results.append({"name": "After Verification", "file": "20_after_verification.png"})

    # 6. Now we should be in the consultation dashboard
    print("📸 Taking Consultation Dashboard screenshots...")
    page.wait_for_timeout(2000)

    # Full page
    page.screenshot(path=f"{SCREENSHOT_DIR}/21_consultation_full.png", full_page=True)
    results.append({"name": "Consultation Full Page", "file": "21_consultation_full.png"})

    # 7. Scroll and capture different sections
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/22_consultation_top.png", full_page=False)
    results.append({"name": "Consultation Top", "file": "22_consultation_top.png"})

    page.evaluate("window.scrollBy(0, 600)")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/23_consultation_mid1.png", full_page=False)
    results.append({"name": "Consultation Middle 1", "file": "23_consultation_mid1.png"})

    page.evaluate("window.scrollBy(0, 600)")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/24_consultation_mid2.png", full_page=False)
    results.append({"name": "Consultation Middle 2", "file": "24_consultation_mid2.png"})

    page.evaluate("window.scrollBy(0, 600)")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/25_consultation_bottom.png", full_page=False)
    results.append({"name": "Consultation Bottom", "file": "25_consultation_bottom.png"})

    # 8. Try to click on specific module headers to expand them
    print("📸 Expanding modules...")
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)

    # Look for clickable module headers
    module_names = ['Réfraction', 'Examen', 'Diagnostic', 'Prescription', 'Traitement']
    for name in module_names:
        try:
            header = page.locator(f'button:has-text("{name}"), [class*="header"]:has-text("{name}")').first
            if header.count() > 0:
                header.click()
                page.wait_for_timeout(800)
                print(f"   ✓ Clicked on {name}")
        except:
            pass

    page.screenshot(path=f"{SCREENSHOT_DIR}/26_modules_expanded.png", full_page=True)
    results.append({"name": "Modules Expanded", "file": "26_modules_expanded.png"})

    # 9. Take viewport screenshots of expanded state
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOT_DIR}/27_expanded_top.png", full_page=False)
    results.append({"name": "Expanded Top View", "file": "27_expanded_top.png"})

    page.evaluate("window.scrollBy(0, 800)")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOT_DIR}/28_expanded_mid.png", full_page=False)
    results.append({"name": "Expanded Middle View", "file": "28_expanded_mid.png"})

    page.evaluate("window.scrollBy(0, 800)")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOT_DIR}/29_expanded_bottom.png", full_page=False)
    results.append({"name": "Expanded Bottom View", "file": "29_expanded_bottom.png"})

    return results

def main():
    ensure_dir(SCREENSHOT_DIR)

    print("="*60)
    print("StudioVision vs MedFlow - Consultation Screenshots")
    print("="*60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = context.new_page()

        try:
            login(page)
            results = take_consultation_screenshots(page)

            print("\n" + "="*60)
            print(f"✅ {len(results)} screenshots saved")
            print("="*60)
            for r in results:
                print(f"   • {r['name']}")

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_final.png")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
