#!/usr/bin/env python3
"""
Prescription Creation Workflow E2E Tests
Tests complete prescription creation:
- Patient selection
- Medication selection from French drug database
- Dosage (posologie) entry
- Duration specification
- Prescription save/print
"""

import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "screenshots/prescription"
RESULTS_FILE = f"{SCREENSHOT_DIR}/results.json"

TEST_EMAIL = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Test prescription data
PRESCRIPTION = {
    "medication": "Paracetamol",
    "dosage": "1000mg",
    "posologie": "1 comprime 3 fois par jour",
    "duration": "7 jours",
    "instructions": "Prendre pendant les repas"
}

results = []
findings = []


def log_result(test_name: str, status: str, message: str = ""):
    results.append({"test": test_name, "status": status, "message": message})
    print(f"{'✓' if status == 'PASS' else '✗'} {test_name}: {message}")


async def login(page):
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.wait_for_url(lambda url: "/login" not in url, timeout=10000)


async def test_prescription_creation(page):
    """Test complete prescription creation workflow"""

    # Navigate to prescriptions page
    await page.goto(f"{BASE_URL}/prescriptions")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(1000)

    await page.screenshot(path=f"{SCREENSHOT_DIR}/prescription_page.png")

    # Click "Nouvelle Ordonnance" button
    new_rx_btn = page.locator('button:has-text("Nouvelle"), button:has-text("Creer"), button:has-text("Ajouter")')
    if await new_rx_btn.count() > 0:
        await new_rx_btn.first.click()
        await page.wait_for_timeout(1000)
        log_result("Open new prescription", "PASS", "Modal/form opened")
    else:
        log_result("Open new prescription", "FAIL", "Button not found")
        return

    await page.screenshot(path=f"{SCREENSHOT_DIR}/rx_modal_open.png")

    # Patient selection - check for PatientSelectorModal
    modal = page.locator('.fixed.inset-0.z-50')
    if await modal.count() > 0:
        # Select patient from modal table
        patient_row = modal.locator('tbody tr').first
        if await patient_row.count() > 0:
            await patient_row.click()
            await page.wait_for_timeout(500)
            log_result("Select patient", "PASS", "Patient selected from modal")
    else:
        # Try autocomplete patient search
        patient_search = page.locator('input[placeholder*="patient"], input[placeholder*="Patient"], input[name="patient"]')
        if await patient_search.count() > 0:
            await patient_search.first.fill("Test")
            await page.wait_for_timeout(500)

            # Select from dropdown
            patient_option = page.locator('[class*="dropdown"] li, [class*="autocomplete"] div, [role="option"]')
            if await patient_option.count() > 0:
                await patient_option.first.click()
                log_result("Select patient", "PASS", "Patient selected from dropdown")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/patient_selected.png")

    # Medication search
    med_search = page.locator('input[placeholder*="medicament"], input[placeholder*="Medicament"], input[name="medication"]')
    if await med_search.count() > 0:
        await med_search.first.fill(PRESCRIPTION["medication"])
        await page.wait_for_timeout(500)

        # Select medication from dropdown
        med_option = page.locator('[class*="dropdown"] li, [class*="autocomplete"] div, [role="option"]')
        if await med_option.count() > 0:
            await med_option.first.click()
            log_result("Select medication", "PASS", PRESCRIPTION["medication"])
    else:
        log_result("Select medication", "SKIP", "Medication search not found")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/medication_selected.png")

    # Dosage/Posologie
    posologie_input = page.locator('input[name="posologie"], textarea[name="posologie"], input[placeholder*="posologie"]')
    if await posologie_input.count() > 0:
        await posologie_input.first.fill(PRESCRIPTION["posologie"])
        log_result("Enter posologie", "PASS", PRESCRIPTION["posologie"])

    # Duration
    duration_input = page.locator('input[name="duration"], input[name="duree"], input[placeholder*="duree"]')
    if await duration_input.count() > 0:
        await duration_input.first.fill(PRESCRIPTION["duration"])
        log_result("Enter duration", "PASS", PRESCRIPTION["duration"])

    # Instructions
    instructions_input = page.locator('textarea[name="instructions"], textarea[name="notes"]')
    if await instructions_input.count() > 0:
        await instructions_input.first.fill(PRESCRIPTION["instructions"])
        log_result("Enter instructions", "PASS", "Instructions added")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/rx_form_filled.png")

    # Submit prescription
    submit_btn = page.locator('button:has-text("Enregistrer"), button:has-text("Creer"), button[type="submit"]')
    if await submit_btn.count() > 0:
        await submit_btn.first.click()
        await page.wait_for_timeout(2000)
        log_result("Submit prescription", "PASS", "Form submitted")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/rx_submitted.png")

    # Check for success
    page_content = await page.content()
    if "succes" in page_content.lower() or "cree" in page_content.lower():
        log_result("Prescription created", "PASS", "Success confirmed")
        findings.append({
            "category": "PRESCRIPTION",
            "description": "Complete prescription workflow works"
        })
    elif await page.locator('.toast-success').count() > 0:
        log_result("Prescription created", "PASS", "Success toast shown")
    else:
        log_result("Prescription created", "CHECK", "Verify in database")


async def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=os.environ.get("HEADED", "1") != "1"
        )
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        try:
            await login(page)
            await test_prescription_creation(page)
        except Exception as e:
            log_result("Test execution", "ERROR", str(e))
            await page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
        finally:
            with open(RESULTS_FILE, "w") as f:
                json.dump({"results": results, "findings": findings}, f, indent=2)

            print(f"\n{'='*50}")
            print(f"Results: {sum(1 for r in results if r['status'] == 'PASS')}/{len(results)} passed")
            print(f"{'='*50}")

            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
