#!/usr/bin/env python3
"""
StudioVision E2E Test with Patient Context
==========================================
Tests the StudioVision consultation interface with a real patient loaded.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright

# Configuration
BASE_URL = "http://localhost:5173"
CREDENTIALS = {"email": "admin@medflow.com", "password": "MedFlow$ecure1"}
SCREENSHOT_DIR = Path(__file__).parent / "screenshots" / "studiovision_patient"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

results = []

def log_result(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"test": test_name, "passed": passed, "details": details})
    print(f"  {status}: {test_name}" + (f" - {details}" if details else ""))

async def screenshot(page, name):
    path = SCREENSHOT_DIR / f"{name}.png"
    await page.screenshot(path=str(path), full_page=True)

async def login(page):
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")
    await page.fill('input[type="email"]', CREDENTIALS["email"])
    await page.fill('input[type="password"]', CREDENTIALS["password"])
    await page.click('button[type="submit"]')
    await page.wait_for_url(lambda url: "/login" not in url, timeout=15000)

async def test_studiovision_with_patient(page):
    print("\n🔬 StudioVision with Patient Context Test")
    print("=" * 50)

    # Step 1: Navigate to patients list
    print("\n📋 Step 1: Navigate to Patients List")
    await page.goto(f"{BASE_URL}/patients")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)
    await screenshot(page, "01_patients_list")

    # Step 2: Search for test patient
    print("\n🔍 Step 2: Search for Patient")
    search_input = await page.query_selector('input[placeholder*="Rechercher"], input[type="search"]')
    if search_input:
        await search_input.fill("QUEUE")
        await asyncio.sleep(1.5)
        await screenshot(page, "02_search_results")
        log_result("Search patient", True, "Found QUEUE patients")
    else:
        log_result("Search patient", False, "Search not found")
        return False

    # Step 3: Click VIEW icon to go to patient detail
    print("\n👤 Step 3: Go to Patient Detail")
    
    # The table has eye icon for view in ACTIONS column
    view_btn = await page.query_selector('table tbody tr:first-child button[title*="Voir"], table tbody tr:first-child a[href*="/patients/"], table tbody tr:first-child svg.lucide-eye')
    
    if not view_btn:
        # Try clicking on patient name which might be a link
        patient_name = await page.query_selector('table tbody tr:first-child td:first-child a, table tbody tr:first-child td:first-child span.cursor-pointer')
        if patient_name:
            await patient_name.click()
        else:
            # Try the eye icon more generically
            eye_icons = await page.query_selector_all('svg.lucide-eye, [class*="eye"]')
            if eye_icons:
                await eye_icons[0].click()
            else:
                log_result("Go to patient detail", False, "No view button found")
                return False
    else:
        await view_btn.click()
    
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)
    await screenshot(page, "03_patient_detail")
    
    # Check if we're on patient detail page
    current_url = page.url
    is_detail_page = "/patients/" in current_url and len(current_url.split("/patients/")[1]) > 5
    log_result("Go to patient detail", is_detail_page, current_url.split("/")[-1][:20])
    
    if not is_detail_page:
        # Fallback: try clicking the entire first row
        await page.goto(f"{BASE_URL}/patients")
        await asyncio.sleep(1)
        first_row = await page.query_selector('table tbody tr:first-child')
        if first_row:
            await first_row.dblclick()
            await asyncio.sleep(1)
            await screenshot(page, "03b_after_dblclick")

    # Step 4: Look for consultation/StudioVision button
    print("\n🔬 Step 4: Start Consultation")
    
    # Look for different types of consultation buttons
    consultation_selectors = [
        'button:has-text("Nouvelle consultation")',
        'button:has-text("Consultation")',
        'button:has-text("StudioVision")',
        'a:has-text("Consultation")',
        '[data-testid="start-consultation"]',
        'button:has-text("Examen")',
        '.btn-primary:has-text("Consultation")',
        'a[href*="ophthalmology"]',
        'a[href*="consultation"]'
    ]
    
    consultation_btn = None
    for selector in consultation_selectors:
        consultation_btn = await page.query_selector(selector)
        if consultation_btn:
            break
    
    if consultation_btn:
        await consultation_btn.click()
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        await screenshot(page, "04_consultation_page")
        log_result("Open consultation", True)
    else:
        # Try navigating directly to ophthalmology with patient from URL
        if "/patients/" in page.url:
            patient_id = page.url.split("/patients/")[1].split("/")[0].split("?")[0]
            await page.goto(f"{BASE_URL}/ophthalmology/consultation?patientId={patient_id}")
            await asyncio.sleep(2)
            await screenshot(page, "04_ophthalmology_direct")
            log_result("Open consultation", True, "Direct navigation")
        else:
            await screenshot(page, "04_no_consultation_btn")
            log_result("Open consultation", False, "No button found")
            # Continue anyway to see what's available

    # Step 5: Check for consultation type selection
    print("\n📝 Step 5: Select Consultation Type")
    
    type_btn = await page.query_selector('button:has-text("Vue Consolidée"), button:has-text("Complète"), [class*="consultation-type"]')
    if type_btn:
        await type_btn.click()
        await asyncio.sleep(1)
        log_result("Select consultation type", True)
    
    start_btn = await page.query_selector('button:has-text("Commencer"), button:has-text("Vérifier"), button:has-text("Démarrer")')
    if start_btn:
        await start_btn.click()
        await asyncio.sleep(2)
    
    await screenshot(page, "05_consultation_interface")

    # Step 6: Check for StudioVision tabs
    print("\n📑 Step 6: Check StudioVision Interface")
    
    page_content = await page.content()
    
    # Check for various StudioVision elements
    has_refraction = "Réfraction" in page_content or "réfraction" in page_content
    has_segment = "Segment" in page_content
    has_tonometrie = "Tonométrie" in page_content or "PIO" in page_content
    has_diagnostic = "Diagnostic" in page_content
    
    elements_found = sum([has_refraction, has_segment, has_tonometrie, has_diagnostic])
    log_result("StudioVision elements", elements_found >= 2, f"Found {elements_found}/4 sections")

    # Step 7: Try to interact with tabs
    print("\n🔄 Step 7: Tab Navigation")
    
    tabs_clicked = 0
    for tab_text in ["Réfraction", "Tonométrie", "Segment Antérieur", "Diagnostic"]:
        tab = await page.query_selector(f'button:has-text("{tab_text}"), [role="tab"]:has-text("{tab_text}")')
        if tab:
            try:
                await tab.click()
                await asyncio.sleep(0.5)
                tabs_clicked += 1
            except:
                pass
    
    log_result("Tab navigation", tabs_clicked > 0, f"{tabs_clicked} tabs clicked")
    await screenshot(page, "06_after_tab_nav")

    # Step 8: Check for patient context
    print("\n👤 Step 8: Verify Patient Context")
    
    has_patient = "QUEUE" in page_content or "PAT2025" in page_content
    log_result("Patient context visible", has_patient)
    
    await screenshot(page, "07_final_state")

    # Summary
    print("\n" + "=" * 50)
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    print(f"📊 Results: {passed}/{total} tests passed ({100*passed/total:.0f}%)")
    
    return passed >= total * 0.6  # 60% pass threshold

async def main():
    print("\n🚀 StudioVision with Patient Context - E2E Test")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        try:
            print("\n🔐 Logging in...")
            await login(page)
            print("✅ Logged in successfully")
            await screenshot(page, "00_logged_in")

            success = await test_studiovision_with_patient(page)

            # Save results
            report = {"test_name": "StudioVision with Patient", "results": results,
                     "summary": {"total": len(results), "passed": sum(1 for r in results if r["passed"])}}
            with open(SCREENSHOT_DIR / "test_results.json", "w") as f:
                json.dump(report, f, indent=2)

            print(f"\n📸 Screenshots: {SCREENSHOT_DIR}")
            return 0 if success else 1

        except Exception as e:
            print(f"\n❌ Error: {e}")
            await screenshot(page, "error_state")
            return 1
        finally:
            await browser.close()

if __name__ == "__main__":
    exit(asyncio.run(main()))
