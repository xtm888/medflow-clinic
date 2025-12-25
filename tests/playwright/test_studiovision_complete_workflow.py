"""
StudioVision Complete Workflow Screenshots
==========================================

Captures comprehensive screenshots of the MedFlow StudioVision consultation interface
for comparison with the original StudioVision XP software (oph1-5 images).

Tabs to capture (matching original):
- Résumé (oph1.jpg - Main Patient Summary)
- Réfraction (oph2.jpg - Refraction Tab)
- Lentilles (oph3.jpg - Contact Lenses Tab)
- Pathologies (oph4.jpg - Pathologies Tab)
- Orthoptie (new in MedFlow)
- Examen (clinical examination)
- Traitement (oph5.jpg - Treatment Tab)
- Règlement (billing - new dedicated tab)
"""

import pytest
import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright, expect

# Configuration
BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:5001/api"
SCREENSHOT_DIR = "tests/playwright/screenshots/studiovision_comparison"

# Test credentials
TEST_USER = {
    "email": "admin@medflow.com",
    "password": "MedFlow$ecure1"
}


async def login(page):
    """Login to MedFlow"""
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Fill login form - try multiple selectors
    email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first
    password_input = page.locator('input[type="password"], input[name="password"]').first

    await email_input.fill(TEST_USER["email"])
    await password_input.fill(TEST_USER["password"])

    # Submit
    submit_btn = page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter")').first
    await submit_btn.click()

    # Wait for navigation with increased timeout
    try:
        await page.wait_for_url(lambda url: "/login" not in url, timeout=30000)
    except:
        # Check if still on login page with error
        error = page.locator('[class*="error"], [role="alert"], .text-red')
        if await error.count() > 0:
            error_text = await error.first.text_content()
            print(f"   Login error: {error_text}")
        raise

    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    return True


async def find_patient_with_data(page):
    """Find a patient that has clinical data for realistic screenshots"""
    # Navigate to patients
    await page.goto(f"{BASE_URL}/patients")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Look for a patient row with data
    patient_rows = await page.locator('table tbody tr, [data-testid="patient-row"], .patient-card').all()

    if patient_rows:
        # Click first patient
        await patient_rows[0].click()
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        # Get patient ID from URL
        current_url = page.url
        if "/patients/" in current_url:
            patient_id = current_url.split("/patients/")[1].split("/")[0].split("?")[0]
            return patient_id

    return None


async def navigate_to_studiovision(page, patient_id):
    """Navigate to StudioVision consultation for a patient"""
    # Try direct navigation to StudioVision
    await page.goto(f"{BASE_URL}/ophthalmology/studio/{patient_id}")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)

    # Check if we're on the consultation page
    if "studiovision" in page.url.lower():
        return True

    # Alternative: try via patient detail page
    await page.goto(f"{BASE_URL}/patients/{patient_id}")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Look for consultation button
    consultation_btn = page.locator('button:has-text("Consultation"), a:has-text("Consultation"), button:has-text("StudioVision"), [data-testid="start-consultation"]')
    if await consultation_btn.count() > 0:
        await consultation_btn.first.click()
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        return True

    return False


async def take_tab_screenshot(page, tab_id, tab_name, description):
    """Take a screenshot of a specific tab"""
    # Click the tab
    tab_button = page.locator(f'[role="tab"]:has-text("{tab_name}"), button:has-text("{tab_name}")')

    if await tab_button.count() > 0:
        await tab_button.first.click()
        await asyncio.sleep(1.5)  # Wait for tab content to load

        # Take screenshot
        filename = f"{SCREENSHOT_DIR}/{tab_id}_tab.png"
        await page.screenshot(path=filename, full_page=True)
        print(f"  Captured: {tab_id} - {description}")
        return True
    else:
        print(f"  Tab not found: {tab_name}")
        return False


@pytest.mark.asyncio
async def test_studiovision_complete_workflow():
    """
    Capture complete StudioVision workflow screenshots for comparison
    with original StudioVision XP software.
    """
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    results = {"screenshots": [], "timestamp": datetime.now().isoformat()}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Headed for better rendering
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = await context.new_page()

        try:
            # Step 1: Login
            print("\n=== StudioVision Complete Workflow Screenshots ===\n")
            print("1. Logging in...")
            await login(page)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/00_logged_in.png")
            results["screenshots"].append({"name": "00_logged_in", "status": "captured"})

            # Step 2: Find a patient
            print("2. Finding patient with data...")
            patient_id = await find_patient_with_data(page)

            if not patient_id:
                print("   No patients found, creating test patient...")
                # Navigate to create new patient
                await page.goto(f"{BASE_URL}/patients/new")
                await page.wait_for_load_state("networkidle")
                await page.screenshot(path=f"{SCREENSHOT_DIR}/01_patient_creation.png")

                # We'll use the first available patient for the workflow
                await page.goto(f"{BASE_URL}/patients")
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(1)

            await page.screenshot(path=f"{SCREENSHOT_DIR}/01_patients_list.png")
            results["screenshots"].append({"name": "01_patients_list", "status": "captured"})

            # Step 3: Navigate to patient detail
            print("3. Opening patient detail...")
            if patient_id:
                await page.goto(f"{BASE_URL}/patients/{patient_id}")
            else:
                # Click first patient in list
                first_patient = page.locator('table tbody tr, .patient-card').first
                if await first_patient.count() > 0:
                    await first_patient.click()

            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/02_patient_detail.png")
            results["screenshots"].append({"name": "02_patient_detail", "status": "captured"})

            # Get patient ID from URL if we don't have it
            if not patient_id and "/patients/" in page.url:
                patient_id = page.url.split("/patients/")[1].split("/")[0].split("?")[0]

            # Step 4: Navigate to StudioVision consultation
            print("4. Opening StudioVision consultation...")

            # Try clicking consultation/StudioVision button
            consultation_buttons = [
                'button:has-text("Nouvelle consultation")',
                'button:has-text("StudioVision")',
                'button:has-text("Consultation")',
                'a:has-text("Consultation")',
                '[data-testid="start-consultation"]'
            ]

            clicked = False
            for selector in consultation_buttons:
                btn = page.locator(selector)
                if await btn.count() > 0:
                    await btn.first.click()
                    clicked = True
                    break

            if not clicked and patient_id:
                # Direct navigation
                await page.goto(f"{BASE_URL}/ophthalmology/studio/{patient_id}")

            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)

            # Check if we need to select consultation type
            consultation_type_modal = page.locator('text="Type de Consultation", text="Nouvelle Consultation"')
            if await consultation_type_modal.count() > 0:
                await page.screenshot(path=f"{SCREENSHOT_DIR}/03_consultation_type_modal.png")
                results["screenshots"].append({"name": "03_consultation_type_modal", "status": "captured"})

                # Select a consultation type if modal is present
                vue_consolidee = page.locator('text="Vue Consolidée", button:has-text("Complète")')
                if await vue_consolidee.count() > 0:
                    await vue_consolidee.first.click()
                    await asyncio.sleep(1)

                # Click confirm/start button
                confirm_btn = page.locator('button:has-text("Commencer"), button:has-text("Vérifier"), button:has-text("Démarrer")')
                if await confirm_btn.count() > 0:
                    await confirm_btn.first.click()
                    await asyncio.sleep(2)

            await page.screenshot(path=f"{SCREENSHOT_DIR}/04_studiovision_initial.png", full_page=True)
            results["screenshots"].append({"name": "04_studiovision_initial", "status": "captured"})

            # Step 5: Capture each tab
            print("5. Capturing StudioVision tabs...")

            tabs_to_capture = [
                ("resume", "Résumé", "Main patient summary (corresponds to oph1.jpg)"),
                ("refraction", "Réfraction", "Refraction measurements (corresponds to oph2.jpg)"),
                ("lentilles", "Lentilles", "Contact lens fitting (corresponds to oph3.jpg)"),
                ("pathologies", "Pathologies", "Diagnosis and pathologies (corresponds to oph4.jpg)"),
                ("orthoptie", "Orthoptie", "Orthoptic examination (MedFlow addition)"),
                ("examen", "Examen", "Clinical examination (LAF, FO, IOP)"),
                ("traitement", "Traitement", "Treatment and prescriptions (corresponds to oph5.jpg)"),
                ("reglement", "Règlement", "Billing and payments (MedFlow addition)")
            ]

            for tab_id, tab_name, description in tabs_to_capture:
                print(f"   Capturing {tab_name} tab...")

                # Find and click tab
                tab_selector = f'[role="tab"]:has-text("{tab_name}"), button:has-text("{tab_name}")'
                tab_btn = page.locator(tab_selector)

                if await tab_btn.count() > 0:
                    await tab_btn.first.click()
                    await asyncio.sleep(1.5)

                    # Take full page screenshot
                    filename = f"{SCREENSHOT_DIR}/05_{tab_id}_tab.png"
                    await page.screenshot(path=filename, full_page=True)
                    results["screenshots"].append({
                        "name": f"05_{tab_id}_tab",
                        "status": "captured",
                        "description": description
                    })
                    print(f"      Captured: {filename}")

                    # For certain tabs, capture additional detail views
                    if tab_id == "refraction":
                        # Try to expand keratometry section if collapsed
                        kerato_expand = page.locator('button:has-text("Kératométrie"), text="Kératométrie"')
                        if await kerato_expand.count() > 0:
                            try:
                                await kerato_expand.first.click()
                                await asyncio.sleep(0.5)
                                await page.screenshot(path=f"{SCREENSHOT_DIR}/05_{tab_id}_keratometry.png", full_page=True)
                            except:
                                pass

                    elif tab_id == "pathologies":
                        # Try to open pathology picker/search
                        pathology_search = page.locator('input[placeholder*="patholog"], input[placeholder*="diagnos"], input[placeholder*="recherche"]')
                        if await pathology_search.count() > 0:
                            await pathology_search.first.fill("diabète")
                            await asyncio.sleep(1)
                            await page.screenshot(path=f"{SCREENSHOT_DIR}/05_{tab_id}_search.png", full_page=True)
                            await pathology_search.first.clear()

                    elif tab_id == "traitement":
                        # Try to open medication list
                        med_dropdown = page.locator('select, [role="combobox"], button:has-text("Ajouter")')
                        if await med_dropdown.count() > 0:
                            try:
                                await med_dropdown.first.click()
                                await asyncio.sleep(0.5)
                                await page.screenshot(path=f"{SCREENSHOT_DIR}/05_{tab_id}_medications.png", full_page=True)
                            except:
                                pass
                else:
                    print(f"      Tab not found: {tab_name}")
                    results["screenshots"].append({
                        "name": f"05_{tab_id}_tab",
                        "status": "not_found",
                        "description": description
                    })

            # Step 6: Capture header/toolbar details
            print("6. Capturing header and toolbar...")

            # Patient header bar
            header = page.locator('header, .patient-header, [class*="header"]').first
            if await header.count() > 0:
                await header.screenshot(path=f"{SCREENSHOT_DIR}/06_header_bar.png")
                results["screenshots"].append({"name": "06_header_bar", "status": "captured"})

            # Quick actions bar
            actions_bar = page.locator('[class*="QuickActions"], [class*="toolbar"], [class*="actions-bar"]')
            if await actions_bar.count() > 0:
                await actions_bar.first.screenshot(path=f"{SCREENSHOT_DIR}/06_quick_actions.png")
                results["screenshots"].append({"name": "06_quick_actions", "status": "captured"})

            # Step 7: Capture print preview if accessible
            print("7. Checking print options...")
            print_btn = page.locator('button:has-text("Imprimer")')
            if await print_btn.count() > 0:
                await print_btn.first.click()
                await asyncio.sleep(1)

                # Check for print menu
                print_menu = page.locator('[role="menu"], .dropdown-menu, [class*="print-options"]')
                if await print_menu.count() > 0:
                    await page.screenshot(path=f"{SCREENSHOT_DIR}/07_print_options.png")
                    results["screenshots"].append({"name": "07_print_options", "status": "captured"})

                    # Close menu
                    await page.keyboard.press("Escape")

            # Step 8: Final full-page capture
            print("8. Capturing final state...")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/08_final_state.png", full_page=True)
            results["screenshots"].append({"name": "08_final_state", "status": "captured"})

            # Save results summary
            results["total_screenshots"] = len([s for s in results["screenshots"] if s["status"] == "captured"])
            results["patient_id"] = patient_id

            with open(f"{SCREENSHOT_DIR}/test_results.json", "w") as f:
                json.dump(results, f, indent=2)

            print(f"\n=== Complete ===")
            print(f"Total screenshots: {results['total_screenshots']}")
            print(f"Saved to: {SCREENSHOT_DIR}/")

        except Exception as e:
            print(f"\nError during test: {str(e)}")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
            raise

        finally:
            await browser.close()


@pytest.mark.asyncio
async def test_studiovision_with_test_data():
    """
    Alternative test that seeds test data first for realistic screenshots
    """
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        try:
            print("\n=== StudioVision with Seeded Data ===\n")

            # Login
            await login(page)

            # Navigate to ophthalmology dashboard first
            print("1. Checking ophthalmology dashboard...")
            await page.goto(f"{BASE_URL}/ophthalmology")
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/oph_dashboard.png", full_page=True)

            # Look for queue or recent patients
            queue_items = page.locator('[class*="queue"], [class*="patient-list"], table tbody tr')
            if await queue_items.count() > 0:
                print(f"   Found {await queue_items.count()} patients in queue/list")

                # Click first patient
                await queue_items.first.click()
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(1)
                await page.screenshot(path=f"{SCREENSHOT_DIR}/oph_patient_selected.png", full_page=True)

            # Try direct StudioVision route with patient
            # Get any patient ID from the current page
            patient_link = page.locator('a[href*="/patients/"]').first
            if await patient_link.count() > 0:
                href = await patient_link.get_attribute("href")
                if href and "/patients/" in href:
                    patient_id = href.split("/patients/")[1].split("/")[0].split("?")[0]
                    print(f"   Found patient: {patient_id}")

                    # Go to StudioVision
                    await page.goto(f"{BASE_URL}/ophthalmology/studio/{patient_id}")
                    await page.wait_for_load_state("networkidle")
                    await asyncio.sleep(2)
                    await page.screenshot(path=f"{SCREENSHOT_DIR}/studiovision_loaded.png", full_page=True)

            print("\n=== Screenshots saved ===")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(test_studiovision_complete_workflow())
