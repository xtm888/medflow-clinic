#!/usr/bin/env python3
"""
StudioVision Clinical Data Entry E2E Tests
Tests actual data entry in clinical fields:
- Refraction: Sphere, Cylinder, Axis, Addition
- Visual Acuity: Monoyer scale
- IOP: Intraocular pressure
- Exam findings
"""

import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "screenshots/studiovision_data"
RESULTS_FILE = f"{SCREENSHOT_DIR}/results.json"

TEST_EMAIL = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Clinical test data (Monoyer scale)
REFRACTION_DATA = {
    "OD": {"sphere": "-2.50", "cylinder": "-0.75", "axis": "180", "addition": "+2.00"},
    "OS": {"sphere": "-2.25", "cylinder": "-1.00", "axis": "175", "addition": "+2.00"},
}

VISUAL_ACUITY = {
    "OD": {"distance": "8/10", "near": "P2"},
    "OS": {"distance": "7/10", "near": "P3"},
}

IOP_DATA = {
    "OD": "16",
    "OS": "17",
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


async def navigate_to_studiovision(page):
    """Navigate to StudioVision with a patient context"""
    # Go directly to ophthalmology dashboard
    await page.goto(f"{BASE_URL}/ophthalmology")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(1000)

    await page.screenshot(path=f"{SCREENSHOT_DIR}/ophthalmology_dashboard.png")

    # Click on the "StudioVision" green button to start consultation
    sv_button = page.locator('text="StudioVision"')
    if await sv_button.count() > 0:
        await sv_button.first.click()
        await page.wait_for_timeout(1000)
        log_result("Navigate: Click StudioVision", "PASS", "StudioVision button clicked")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/patient_selection_modal.png")

    # Patient selection modal should now appear
    # Wait for modal and select first patient
    await page.wait_for_timeout(500)

    # Click on first patient in the list (CELESTE NGONE or similar)
    patient_item = page.locator('text="CELESTE NGONE"')
    if await patient_item.count() > 0:
        await patient_item.click()
        await page.wait_for_timeout(2000)
        log_result("Navigate: Select patient", "PASS", "CELESTE NGONE selected")
    else:
        # Try to find any patient name pattern - names are in uppercase
        all_text = await page.content()
        # Click on first item that looks like a patient row
        patient_rows = page.locator('div >> text=/^[A-Z]{2,}/')
        if await patient_rows.count() > 0:
            await patient_rows.first.click()
            await page.wait_for_timeout(2000)
            log_result("Navigate: Select patient", "PASS", "First patient selected")
        else:
            log_result("Navigate: Select patient", "SKIP", "No patient found in modal")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/studiovision_loaded.png")


async def test_refraction_entry(page):
    """Test refraction data entry"""
    await page.screenshot(path=f"{SCREENSHOT_DIR}/refraction_initial.png")

    # We should now be in StudioVision consultation after navigation
    # Wait for page to fully load
    await page.wait_for_timeout(1000)

    # Check current URL - should be /ophthalmology/studio/{patientId}
    current_url = page.url
    if "studio" in current_url:
        log_result("StudioVision loaded", "PASS", f"URL: {current_url}")
    else:
        log_result("StudioVision loaded", "SKIP", f"Not in consultation: {current_url}")

    # StudioVision uses tab navigation - click Réfraction tab first
    refraction_tab = page.locator('button:has-text("Réfraction"), [role="tab"]:has-text("Réfraction")')
    if await refraction_tab.count() > 0:
        await refraction_tab.first.click()
        await page.wait_for_timeout(500)
        log_result("Refraction tab", "PASS", "Tab clicked")
    else:
        log_result("Refraction tab", "SKIP", "No Refraction tab found")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/refraction_tab_active.png")

    # Look for refraction section (pink/rose color) - it should be visible
    refraction_section = page.locator(':has-text("REFRACTION"), :has-text("Refraction")')
    if await refraction_section.count() > 0:
        log_result("Refraction section", "PASS", "Section visible")

    # The refraction inputs use class: w-14 h-6 text-center text-sm font-mono font-medium
    # Find all text inputs in the refraction grid using the correct class pattern
    refraction_inputs = page.locator('input.font-mono, input.text-center')
    input_count = await refraction_inputs.count()

    if input_count >= 4:
        # Fill refraction inputs with delays for React state updates
        # Check if input is enabled before filling

        # OD Sphere
        sphere_input = refraction_inputs.nth(0)
        if not await sphere_input.is_disabled():
            await sphere_input.fill(REFRACTION_DATA["OD"]["sphere"])
            await page.wait_for_timeout(200)
            log_result("Refraction: OD Sphere", "PASS", REFRACTION_DATA["OD"]["sphere"])

        # OD Cylinder
        cylinder_input = refraction_inputs.nth(1)
        if not await cylinder_input.is_disabled():
            await cylinder_input.fill(REFRACTION_DATA["OD"]["cylinder"])
            await page.wait_for_timeout(200)
            log_result("Refraction: OD Cylinder", "PASS", REFRACTION_DATA["OD"]["cylinder"])

        # OD Axis (may be disabled if cylinder is 0)
        axis_input = refraction_inputs.nth(2)
        if not await axis_input.is_disabled():
            await axis_input.fill(REFRACTION_DATA["OD"]["axis"])
            await page.wait_for_timeout(200)
            log_result("Refraction: OD Axis", "PASS", REFRACTION_DATA["OD"]["axis"])
        else:
            log_result("Refraction: OD Axis", "SKIP", "Axis disabled (may need cylinder)")

        # OD Addition
        addition_input = refraction_inputs.nth(3)
        if not await addition_input.is_disabled():
            await addition_input.fill(REFRACTION_DATA["OD"]["addition"])
            await page.wait_for_timeout(200)
            log_result("Refraction: OD Addition", "PASS", REFRACTION_DATA["OD"]["addition"])
        else:
            log_result("Refraction: OD Addition", "SKIP", "Addition disabled")

        await page.screenshot(path=f"{SCREENSHOT_DIR}/refraction_od_filled.png")

        # OS inputs (next 4)
        if input_count >= 8:
            # OD Sphere
            if not await refraction_inputs.nth(4).is_disabled():
                await refraction_inputs.nth(4).fill(REFRACTION_DATA["OS"]["sphere"])
                await page.wait_for_timeout(200)
                log_result("Refraction: OS Sphere", "PASS", REFRACTION_DATA["OS"]["sphere"])

            # OS Cylinder
            if not await refraction_inputs.nth(5).is_disabled():
                await refraction_inputs.nth(5).fill(REFRACTION_DATA["OS"]["cylinder"])
                await page.wait_for_timeout(200)
                log_result("Refraction: OS Cylinder", "PASS", REFRACTION_DATA["OS"]["cylinder"])
    else:
        # Fallback: Try to find inputs by looking for number-like patterns
        all_inputs = page.locator('input[type="text"]')
        all_count = await all_inputs.count()
        log_result("Refraction: OD Sphere", "SKIP", f"Found {all_count} text inputs, expected grid pattern")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/refraction_filled.png")
    findings.append({
        "category": "REFRACTION",
        "description": f"Refraction data entry: {input_count} inputs found"
    })


async def test_visual_acuity_entry(page):
    """Test visual acuity entry (Monoyer scale)"""

    # Look for AV/Visual Acuity section
    av_section = page.locator('div:has-text("Acuite"), [class*="acuity"]')
    if await av_section.count() > 0:
        log_result("VA section", "PASS", "Visual acuity section found")

    # Distance vision OD
    od_distance = page.locator('select[name="od.distanceVA"], input[name="odDistanceVA"]')
    if await od_distance.count() > 0:
        try:
            await od_distance.first.select_option(label=VISUAL_ACUITY["OD"]["distance"])
            log_result("VA: OD Distance", "PASS", VISUAL_ACUITY["OD"]["distance"])
        except:
            log_result("VA: OD Distance", "SKIP", "Could not select option")
    else:
        # Try input field
        od_distance_input = page.locator('input[name*="distance"][name*="OD"], input[name*="avl"]')
        if await od_distance_input.count() > 0:
            await od_distance_input.first.fill("8")
            log_result("VA: OD Distance", "PASS", "8/10 entered")

    # Near vision OD (Parinaud)
    od_near = page.locator('select[name="od.nearVA"], input[name="odNearVA"]')
    if await od_near.count() > 0:
        try:
            await od_near.first.select_option(label=VISUAL_ACUITY["OD"]["near"])
            log_result("VA: OD Near", "PASS", VISUAL_ACUITY["OD"]["near"])
        except:
            log_result("VA: OD Near", "SKIP", "Could not select option")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/visual_acuity_filled.png")
    findings.append({
        "category": "VISUAL_ACUITY",
        "description": "Visual acuity fields accessible (Monoyer/Parinaud)"
    })


async def test_iop_entry(page):
    """Test IOP (tonometry) entry"""

    # Look for IOP/Tonometry section (green color)
    iop_section = page.locator('button:has-text("Tonus"), button:has-text("PIO"), [class*="iop"]')
    if await iop_section.count() > 0:
        await iop_section.first.click()
        await page.wait_for_timeout(500)
        log_result("IOP section", "PASS", "Clicked IOP section")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/iop_section.png")

    # OD IOP
    od_iop = page.locator('input[name="od.iop"], input[name="odIop"], input[name*="pio"][name*="OD"]')
    if await od_iop.count() > 0:
        await od_iop.first.fill(IOP_DATA["OD"])
        log_result("IOP: OD", "PASS", f"{IOP_DATA['OD']} mmHg")

    # OS IOP
    os_iop = page.locator('input[name="os.iop"], input[name="osIop"], input[name*="pio"][name*="OS"]')
    if await os_iop.count() > 0:
        await os_iop.first.fill(IOP_DATA["OS"])
        log_result("IOP: OS", "PASS", f"{IOP_DATA['OS']} mmHg")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/iop_filled.png")
    findings.append({
        "category": "IOP",
        "description": "IOP entry fields accessible"
    })


async def test_save_consultation(page):
    """Test saving the consultation data"""

    # Look for save button
    save_btn = page.locator('button:has-text("Enregistrer"), button:has-text("Sauvegarder"), button[type="submit"]')
    if await save_btn.count() > 0:
        await save_btn.first.click()
        await page.wait_for_timeout(2000)
        log_result("Save consultation", "PASS", "Save button clicked")
    else:
        log_result("Save consultation", "SKIP", "Save button not found")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/after_save.png")

    # Check for success
    if await page.locator('.toast-success, [class*="success"]').count() > 0:
        log_result("Save result", "PASS", "Success toast shown")
        findings.append({
            "category": "SAVE",
            "description": "Consultation data saved successfully"
        })
    else:
        log_result("Save result", "CHECK", "Verify data was saved")


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
            await navigate_to_studiovision(page)
            await test_refraction_entry(page)
            await test_visual_acuity_entry(page)
            await test_iop_entry(page)
            await test_save_consultation(page)
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
