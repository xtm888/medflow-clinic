"""
StudioVision vs MedFlow Comparison Screenshots
Takes screenshots of MedFlow's StudioVision components for comparison with original
"""
import os
import json
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

    # Fill login form
    page.fill('input[type="email"]', 'admin@medflow.com')
    page.fill('input[type="password"]', 'MedFlow$ecure1')
    page.click('button[type="submit"]')

    # Wait for redirect
    page.wait_for_url("**/home**", timeout=15000)
    print("✓ Logged in successfully")

def take_studiovision_screenshots(page):
    """Take screenshots of StudioVision components in MedFlow"""
    results = []

    # 1. Dashboard - Main view
    print("\n📸 Taking Dashboard screenshot...")
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_medflow_dashboard.png", full_page=True)
    results.append({"name": "Dashboard", "file": "01_medflow_dashboard.png"})

    # 2. Patients list - with 34k patients
    print("📸 Taking Patients list screenshot...")
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_medflow_patients_list.png", full_page=False)
    results.append({"name": "Patients List", "file": "02_medflow_patients_list.png"})

    # 3. Get first patient ID and go to their detail
    print("📸 Taking Patient Detail screenshot...")
    # Click on first patient row
    patient_row = page.locator('tr[class*="cursor-pointer"], div[class*="patient-row"]').first
    if patient_row.count() > 0:
        patient_row.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_medflow_patient_detail.png", full_page=True)
        results.append({"name": "Patient Detail", "file": "03_medflow_patient_detail.png"})

    # 4. Ophthalmology Dashboard
    print("📸 Taking Ophthalmology Dashboard screenshot...")
    page.goto(f"{BASE_URL}/ophthalmology")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_medflow_ophthalmology_dashboard.png", full_page=True)
    results.append({"name": "Ophthalmology Dashboard", "file": "04_medflow_ophthalmology_dashboard.png"})

    # 5. New Consultation - This is where StudioVision components are!
    print("📸 Taking New Consultation screenshot (StudioVision mode)...")
    page.goto(f"{BASE_URL}/ophthalmology/consultation")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Take full consultation view
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_medflow_consultation_full.png", full_page=True)
    results.append({"name": "Consultation Full (StudioVision)", "file": "05_medflow_consultation_full.png"})

    # 6. Try to find and screenshot the Refraction Panel
    print("📸 Looking for Refraction Panel...")
    refraction_section = page.locator('text=Module Réfraction').first
    if refraction_section.count() > 0:
        # Click to expand if needed
        refraction_section.click()
        page.wait_for_timeout(1000)

        # Screenshot the refraction area
        refraction_panel = page.locator('[class*="refraction"], [data-testid*="refraction"]').first
        if refraction_panel.count() > 0:
            refraction_panel.screenshot(path=f"{SCREENSHOT_DIR}/06_medflow_refraction_panel.png")
            results.append({"name": "Refraction Panel (StudioVision)", "file": "06_medflow_refraction_panel.png"})
        else:
            # Take viewport screenshot of refraction area
            page.screenshot(path=f"{SCREENSHOT_DIR}/06_medflow_refraction_area.png", full_page=False)
            results.append({"name": "Refraction Area", "file": "06_medflow_refraction_area.png"})

    # 7. Diagnostic Panel with PathologyPicker
    print("📸 Looking for Diagnostic Panel...")
    diagnostic_section = page.locator('text=Module Diagnostic').first
    if diagnostic_section.count() > 0:
        diagnostic_section.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/07_medflow_diagnostic_panel.png", full_page=False)
        results.append({"name": "Diagnostic Panel (StudioVision)", "file": "07_medflow_diagnostic_panel.png"})

    # 8. Check for Mode Toggle
    print("📸 Looking for StudioVision Mode Toggle...")
    mode_toggle = page.locator('text=StudioVision, text=Standard, [class*="mode-toggle"]').first
    if mode_toggle.count() > 0:
        mode_toggle.screenshot(path=f"{SCREENSHOT_DIR}/08_medflow_mode_toggle.png")
        results.append({"name": "Mode Toggle", "file": "08_medflow_mode_toggle.png"})

    # 9. Take a final full-page screenshot with all panels expanded
    print("📸 Taking expanded consultation view...")
    # Scroll to top
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/09_medflow_consultation_expanded.png", full_page=True)
    results.append({"name": "Consultation Expanded", "file": "09_medflow_consultation_expanded.png"})

    return results

def main():
    ensure_dir(SCREENSHOT_DIR)

    print("="*60)
    print("StudioVision vs MedFlow Comparison Screenshots")
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
            results = take_studiovision_screenshots(page)

            # Save results
            report = {
                "timestamp": datetime.now().isoformat(),
                "screenshots": results,
                "original_studiovision": [
                    "/Users/xtm888/magloire/assets/ophthalmology-images/oph1.jpg",
                    "/Users/xtm888/magloire/assets/ophthalmology-images/oph2.jpg",
                    "/Users/xtm888/magloire/assets/ophthalmology-images/oph3.jpg",
                    "/Users/xtm888/magloire/assets/ophthalmology-images/oph4.jpg"
                ],
                "comparison_notes": {
                    "oph1": "Patient file overview - Compare with patient detail + consultation dashboard",
                    "oph2": "Refraction module - Compare with StudioVisionRefractionGrid",
                    "oph3": "Contact lenses - Compare with prescription module",
                    "oph4": "Pathologies - Compare with PathologyPicker 3-column layout"
                }
            }

            with open(f"{SCREENSHOT_DIR}/comparison_report.json", "w") as f:
                json.dump(report, f, indent=2)

            print("\n" + "="*60)
            print(f"✅ {len(results)} screenshots saved to:")
            print(f"   {SCREENSHOT_DIR}/")
            print("="*60)

            for r in results:
                print(f"   • {r['name']}: {r['file']}")

        except Exception as e:
            print(f"\n❌ Error: {e}")
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    main()
