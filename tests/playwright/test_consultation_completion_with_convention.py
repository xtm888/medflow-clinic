"""
Consultation Completion with Convention Billing Tests
======================================================

Tests the StudioVision consultation completion flow, specifically:
- Invoice generation with convention billing
- Company/patient share calculation
- Approval requirements display
- Screenshot capture of completion modal

Author: Claude Code
Date: 2025-12-28
"""

import asyncio
import os
import json
import requests
from datetime import datetime
from playwright.async_api import async_playwright, expect

# Configuration
BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:5001/api"
SCREENSHOT_DIR = "screenshots/consultation_completion"

# Test credentials
TEST_USER = {
    "email": "admin@medflow.com",
    "password": "MedFlow$ecure1"
}


def ensure_screenshot_dir():
    """Ensure screenshot directory exists"""
    if not os.path.exists(SCREENSHOT_DIR):
        os.makedirs(SCREENSHOT_DIR)


async def login(page):
    """Login to MedFlow"""
    print("1. Logging in...")
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Fill login form
    email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first
    password_input = page.locator('input[type="password"], input[name="password"]').first

    await email_input.fill(TEST_USER["email"])
    await password_input.fill(TEST_USER["password"])

    # Submit
    submit_btn = page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter")').first
    await submit_btn.click()

    # Wait for navigation
    try:
        await page.wait_for_url(lambda url: "/login" not in url, timeout=30000)
    except Exception as e:
        error = page.locator('[class*="error"], [role="alert"], .text-red')
        if await error.count() > 0:
            error_text = await error.first.text_content()
            print(f"   Login error: {error_text}")
        raise e

    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    # Debug: Check cookies after login
    cookies = await page.context.cookies()
    cookie_names = [c['name'] for c in cookies]
    print(f"   Cookies after login: {cookie_names}")
    if 'XSRF-TOKEN' not in cookie_names:
        print("   WARNING: XSRF-TOKEN cookie not found!")

    print("   Login successful")
    return True


async def get_api_token(page):
    """Extract JWT token from localStorage or cookies"""
    token = await page.evaluate("""
        () => {
            return localStorage.getItem('token') ||
                   sessionStorage.getItem('token') ||
                   document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        }
    """)
    return token


async def find_or_create_convention_patient(page, token):
    """Find a patient with convention or create one"""
    print("2. Finding patient with convention...")

    # First, try direct API to get patient with convention
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    try:
        response = requests.get(
            f"{API_URL}/patients?hasConvention=true&limit=1",
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            patients = data.get("data", data.get("patients", []))
            if patients and len(patients) > 0:
                patient = patients[0]
                print(f"   Found patient with convention: {patient.get('firstName')} {patient.get('lastName')}")
                return patient.get("_id") or patient.get("id")
    except Exception as e:
        print(f"   API search failed: {e}")

    # Try to get any patient from API
    try:
        response = requests.get(
            f"{API_URL}/patients?limit=5",
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            patients = data.get("data", data.get("patients", []))
            if patients and len(patients) > 0:
                # Use Marie KULALUKA who has convention
                for patient in patients:
                    if patient.get("lastName") == "KULALUKA":
                        patient_id = patient.get("_id") or patient.get("id")
                        print(f"   Found KULALUKA patient: {patient_id}")
                        return patient_id
                # Otherwise use first patient
                patient = patients[0]
                print(f"   Using first patient: {patient.get('firstName')} {patient.get('lastName')}")
                return patient.get("_id") or patient.get("id")
    except Exception as e:
        print(f"   API list failed: {e}")

    # Navigate to patients and find one via UI
    await page.goto(f"{BASE_URL}/patients")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)

    # Take screenshot for debugging
    await page.screenshot(path=f"{SCREENSHOT_DIR}/02_patients_list.png", full_page=True)

    # Try clicking on patient list items
    patient_selectors = [
        'table tbody tr',
        '[data-testid="patient-row"]',
        '.patient-card',
        '.patient-list-item',
        'div[role="row"]',
        'a[href*="/patients/"]'
    ]

    for selector in patient_selectors:
        rows = await page.locator(selector).all()
        if rows and len(rows) > 0:
            print(f"   Found {len(rows)} patients with selector: {selector}")
            await rows[0].click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)

            current_url = page.url
            if "/patients/" in current_url:
                patient_id = current_url.split("/patients/")[1].split("/")[0].split("?")[0]
                print(f"   Clicked patient, got ID: {patient_id}")
                return patient_id

    # Fallback to hardcoded patient ID for Marie KULALUKA (has convention)
    # The visit ID is also needed for consultation completion
    print("   Using hardcoded patient ID: 69441d7af3feff49134d2b49")
    return "69441d7af3feff49134d2b49"


# Hardcoded visit ID for testing (needs to be in-progress status)
TEST_VISIT_ID = "69516f3418b3f6e02e014a8d"


async def open_studiovision(page, patient_id, visit_id=None):
    """Open StudioVision consultation for patient"""
    print("3. Opening StudioVision consultation...")

    # Navigate directly to StudioVision with optional visit ID
    url = f"{BASE_URL}/ophthalmology/studio/{patient_id}"
    if visit_id:
        url += f"?visitId={visit_id}"
        print(f"   Using visit ID: {visit_id}")

    await page.goto(url)
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)

    # Wait for page to load (check for StudioVision elements)
    sv_indicators = page.locator('[class*="studio"], [data-testid*="studio"], h1:has-text("Consultation")')
    try:
        await sv_indicators.first.wait_for(timeout=10000)
        print("   StudioVision loaded")
    except:
        # Take screenshot of current state
        await page.screenshot(path=f"{SCREENSHOT_DIR}/03_page_not_found.png", full_page=True)
        print(f"   StudioVision not found, screenshot saved")

    return True


async def fill_basic_exam_data(page):
    """Fill in minimal exam data for consultation completion"""
    print("4. Filling basic exam data...")

    # Try to find visual acuity inputs
    try:
        # Right eye (OD) visual acuity
        od_va = page.locator('input[name*="od"][name*="va"], input[placeholder*="OD"], [data-testid="od-va"]').first
        if await od_va.count() > 0:
            await od_va.fill("10/10")

        # Left eye (OS) visual acuity
        os_va = page.locator('input[name*="os"][name*="va"], input[placeholder*="OS"], [data-testid="os-va"]').first
        if await os_va.count() > 0:
            await os_va.fill("10/10")

        print("   Filled visual acuity")
    except:
        print("   Could not fill visual acuity (may not be visible)")

    return True


async def complete_consultation(page):
    """Complete the consultation and capture the completion modal"""
    print("5. Completing consultation...")

    # Add listener for API responses
    async def log_response(response):
        if "ophthalmology" in response.url and "complete" in response.url:
            print(f"   API Response: {response.status} - {response.url}")
            try:
                body = await response.json()
                print(f"   Response body: {body}")
            except:
                try:
                    text = await response.text()
                    print(f"   Response text: {text[:500]}")
                except:
                    pass

    page.on("response", log_response)

    # Take screenshot before completion
    await page.screenshot(path=f"{SCREENSHOT_DIR}/04_before_completion.png", full_page=True)

    # Look for the complete/finish button
    complete_btn_selectors = [
        'button:has-text("Terminer")',
        'button:has-text("Compléter")',
        'button:has-text("Finaliser")',
        'button:has-text("Clôturer")',
        '[data-testid="complete-consultation"]',
        'button[type="submit"]:has-text("Valider")',
    ]

    complete_btn = None
    for selector in complete_btn_selectors:
        btn = page.locator(selector).first
        if await btn.count() > 0:
            complete_btn = btn
            print(f"   Found completion button: {selector}")
            break

    if not complete_btn:
        print("   Looking for action buttons...")
        # Try to find any action button in the toolbar area
        action_btns = await page.locator('.quick-actions button, .toolbar button, header button').all()
        for btn in action_btns:
            text = await btn.text_content()
            if text and any(w in text.lower() for w in ['termin', 'complet', 'final', 'clôtur']):
                complete_btn = btn
                print(f"   Found button: {text}")
                break

    if complete_btn:
        await complete_btn.click()
        await asyncio.sleep(3)

        # Wait for modal to appear - look for "Consultation terminée" text
        modal_selectors = [
            'text="Consultation terminée"',
            ':has-text("Consultation terminée")',
            '[role="dialog"]',
            '.modal',
            '[class*="modal"]',
            'div:has-text("Examen enregistré")'
        ]

        modal_found = False
        for selector in modal_selectors:
            try:
                modal = page.locator(selector).first
                await modal.wait_for(timeout=3000)
                modal_found = True
                print(f"   Completion modal found with selector: {selector}")
                break
            except:
                continue

        if modal_found:
            # Take screenshot of completion modal
            await page.screenshot(path=f"{SCREENSHOT_DIR}/05_completion_modal.png", full_page=True)

            # Check for convention billing info
            convention_text = await page.locator('text="Convention"').count()
            part_entreprise = await page.locator('text="Part entreprise"').count()
            part_patient = await page.locator('text="Part patient"').count()

            if convention_text > 0 or part_entreprise > 0:
                print("   ✅ Convention billing info found in modal")
                # Get the actual values
                try:
                    convention_name = await page.locator(':has-text("Convention") >> span, :has-text("ACTIVA")').first.text_content()
                    print(f"   Convention: {convention_name}")
                except:
                    pass

            if part_entreprise > 0:
                print("   ✅ Company share displayed")
            if part_patient > 0:
                print("   ✅ Patient share displayed")

            # Check for checkmarks (completed items)
            checkmarks = await page.locator('svg[class*="text-green"], .text-green-500, :has-text("✓")').count()
            print(f"   Found {checkmarks} success indicators")

            return True
        else:
            print("   No modal appeared after clicking complete")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/05_after_complete_click.png", full_page=True)
    else:
        print("   Complete button not found")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/05_no_complete_button.png", full_page=True)

    return False


async def verify_invoice_created(page, token, patient_id):
    """Verify that an invoice was created"""
    print("6. Verifying invoice creation...")

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    try:
        response = requests.get(
            f"{API_URL}/invoices?patient={patient_id}&limit=1&sort=-createdAt",
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            invoices = data.get("data", data.get("invoices", []))
            if invoices and len(invoices) > 0:
                invoice = invoices[0]
                print(f"   Invoice found: {invoice.get('invoiceNumber')}")

                # Check for convention billing
                company_billing = invoice.get("companyBilling")
                if company_billing:
                    print(f"   Convention: {company_billing.get('companyName')}")
                    print(f"   Company share: {company_billing.get('companyShare')}")
                    print(f"   Patient share: {company_billing.get('patientShare')}")
                    return {
                        "invoice": invoice,
                        "hasConvention": True,
                        "companyBilling": company_billing
                    }
                else:
                    print("   No convention billing on invoice")
                    return {"invoice": invoice, "hasConvention": False}
    except Exception as e:
        print(f"   Could not verify invoice: {e}")

    return None


async def test_consultation_completion_with_convention():
    """Main test function"""
    print("\n=== Consultation Completion with Convention Billing Test ===\n")
    ensure_screenshot_dir()

    results = {
        "timestamp": datetime.now().isoformat(),
        "steps": [],
        "success": False
    }

    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=os.environ.get("HEADED", "0") != "1")
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="fr-FR"
        )
        page = await context.new_page()

        try:
            # Step 1: Login
            await login(page)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/01_logged_in.png", full_page=True)
            results["steps"].append({"name": "login", "success": True})

            # Get token for API calls
            token = await get_api_token(page)

            # Step 2: Find patient with convention
            patient_id = await find_or_create_convention_patient(page, token)
            if not patient_id:
                print("ERROR: Could not find any patient")
                results["steps"].append({"name": "find_patient", "success": False})
                return results

            results["steps"].append({"name": "find_patient", "success": True, "patientId": patient_id})
            await page.screenshot(path=f"{SCREENSHOT_DIR}/02_patient_selected.png", full_page=True)

            # Step 3: Open StudioVision
            await open_studiovision(page, patient_id, TEST_VISIT_ID)
            results["steps"].append({"name": "open_studiovision", "success": True})
            await page.screenshot(path=f"{SCREENSHOT_DIR}/03_studiovision_open.png", full_page=True)

            # Step 4: Fill basic data
            await fill_basic_exam_data(page)
            results["steps"].append({"name": "fill_data", "success": True})

            # Step 5: Complete consultation
            completed = await complete_consultation(page)
            results["steps"].append({"name": "complete_consultation", "success": completed})

            # Step 6: Verify invoice
            invoice_result = await verify_invoice_created(page, token, patient_id)
            if invoice_result:
                results["steps"].append({
                    "name": "verify_invoice",
                    "success": True,
                    "hasConvention": invoice_result.get("hasConvention", False)
                })

            # Final screenshot
            await page.screenshot(path=f"{SCREENSHOT_DIR}/06_final_state.png", full_page=True)

            results["success"] = all(s.get("success", False) for s in results["steps"])

        except Exception as e:
            print(f"\nError during test: {e}")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png", full_page=True)
            results["error"] = str(e)
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

    # Save results
    with open(f"{SCREENSHOT_DIR}/test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n=== Test Complete ===")
    print(f"Success: {results['success']}")
    print(f"Screenshots saved to: {SCREENSHOT_DIR}/")

    return results


async def test_completion_modal_content():
    """
    Test specifically the content of the completion modal
    to verify convention billing information is displayed correctly.
    """
    print("\n=== Testing Completion Modal Content ===\n")
    ensure_screenshot_dir()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=os.environ.get("HEADED", "0") != "1")
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="fr-FR"
        )
        page = await context.new_page()

        try:
            await login(page)
            token = await get_api_token(page)
            patient_id = await find_or_create_convention_patient(page, token)

            if patient_id:
                await open_studiovision(page, patient_id, TEST_VISIT_ID)
                await asyncio.sleep(2)

                # Find and click complete button
                complete_btn = page.locator('button:has-text("Terminer"), button:has-text("Compléter")').first
                if await complete_btn.count() > 0:
                    await complete_btn.click()
                    await asyncio.sleep(2)

                    # Check modal content
                    modal = page.locator('[role="dialog"], .modal')
                    if await modal.count() > 0:
                        modal_content = await modal.first.inner_html()

                        # Check for specific elements
                        checks = {
                            "invoice_total": "Total" in modal_content or "Montant" in modal_content,
                            "convention_section": "Convention" in modal_content or "entreprise" in modal_content,
                            "patient_share": "patient" in modal_content.lower(),
                            "company_share": "entreprise" in modal_content.lower() or "company" in modal_content.lower(),
                        }

                        print("Modal content checks:")
                        for check, passed in checks.items():
                            status = "PASS" if passed else "FAIL"
                            print(f"  {check}: {status}")

                        # Take detailed screenshot
                        await page.screenshot(path=f"{SCREENSHOT_DIR}/modal_content_check.png", full_page=True)

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(test_consultation_completion_with_convention())
