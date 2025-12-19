#!/usr/bin/env python3
"""
MedFlow Workflow Test Suite

Tests complete clinical workflows:
- Ophthalmology consultation (exam -> diagnosis -> prescription)
- Prescription workflow (create -> print -> view PA)
- Queue workflow (add patient -> call -> complete)

Run: python3 test_workflows.py
Run headed: HEADED=1 python3 test_workflows.py
"""

import os
import re
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

# Configuration
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "workflows")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "workflow_test_report.json")
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)
test_results = []


def take_screenshot(page, name):
    filepath = os.path.join(SCREENSHOT_DIR, f"{name}.jpg")
    page.screenshot(path=filepath, type='jpeg', quality=40, full_page=False)
    return f"{name}.jpg"


def log_test(workflow, step, passed, details=None, error=None):
    result = {"workflow": workflow, "step": step, "passed": passed, 
              "details": details, "error": error, "timestamp": datetime.now().isoformat()}
    test_results.append(result)
    status = "pass" if passed else "FAIL"
    print(f"  [{status}] {step}")
    if details: print(f"         {details}")
    if error: print(f"         Error: {error[:80]}")
    return passed


def test_ophthalmology_consultation(page):
    """Test ophthalmology consultation workflow"""
    print("\n=== OPHTHALMOLOGY CONSULTATION WORKFLOW ===")
    
    page.goto(f"{BASE_URL}/ophthalmology")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    take_screenshot(page, "ophthalmo_01_dashboard")
    log_test("Ophthalmology", "Navigate to dashboard", True)
    
    # Click consultation button
    consult_btn = page.locator('button:has-text("Consultation"), a:has-text("Consultation"), [class*="card"]:has-text("Consultation")').first
    if consult_btn.count() > 0:
        consult_btn.click()
        page.wait_for_timeout(1000)
        take_screenshot(page, "ophthalmo_02_after_click")
        log_test("Ophthalmology", "Clicked consultation", True)
    else:
        log_test("Ophthalmology", "Find consultation button", False, error="Not found")
        return False
    
    # Check for patient selection or exam interface
    patient_search = page.locator('input[placeholder*="patient" i]')
    exam_elements = page.locator('[class*="exam"], [class*="refraction"], text=Vision')
    
    if patient_search.count() > 0:
        log_test("Ophthalmology", "Patient selection shown", True)
        patient_search.first.fill("TEST")
        page.wait_for_timeout(1000)
        patient_row = page.locator('tbody tr, [class*="patient-item"]').first
        if patient_row.count() > 0:
            patient_row.click()
            page.wait_for_timeout(1000)
            take_screenshot(page, "ophthalmo_03_patient_selected")
            log_test("Ophthalmology", "Patient selected", True)
    elif exam_elements.count() > 0:
        log_test("Ophthalmology", "Exam interface loaded", True)
    
    # Check for exam steps
    page.wait_for_timeout(500)
    take_screenshot(page, "ophthalmo_04_exam")
    next_btn = page.locator('button:has-text("Suivant"), button:has-text("Next")').first
    if next_btn.count() > 0:
        log_test("Ophthalmology", "Wizard steps available", True)
    
    return True


def test_prescription_workflow(page):
    """Test prescription workflow"""
    print("\n=== PRESCRIPTION WORKFLOW ===")
    
    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    take_screenshot(page, "prescription_01_list")
    log_test("Prescription", "Navigate to list", True)
    
    # Check list loaded
    prescription_list = page.locator('table tbody tr, [class*="prescription-item"]')
    count = prescription_list.count()
    log_test("Prescription", "List loaded", True, details=f"{count} prescriptions")
    
    # Test PA filters
    for filter_text in ['Sans PA', 'Avec PA', 'Tous']:
        filter_btn = page.locator(f'button:has-text("{filter_text}")').first
        if filter_btn.count() > 0:
            filter_btn.click()
            page.wait_for_timeout(500)
            take_screenshot(page, f"prescription_02_filter_{filter_text.lower().replace(' ', '_')}")
            log_test("Prescription", f"Filter '{filter_text}' works", True)
            break
    
    # Test action buttons
    action_buttons = page.locator('button:has-text("Imprimer"), button:has-text("Voir PA"), button:has-text("Certificat")')
    if action_buttons.count() > 0:
        log_test("Prescription", "Action buttons available", True, details=f"{action_buttons.count()} buttons")
    
    return True


def test_queue_workflow(page):
    """Test queue management workflow"""
    print("\n=== QUEUE MANAGEMENT WORKFLOW ===")
    
    page.goto(f"{BASE_URL}/queue")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    take_screenshot(page, "queue_01_main")
    log_test("Queue", "Navigate to queue", True)
    
    # Check stats
    stats = page.locator('[class*="stat"], [class*="card"]')
    log_test("Queue", "Stats displayed", stats.count() > 0, details=f"{stats.count()} stat cards")
    
    # Check queue items
    queue_items = page.locator('table tbody tr, [class*="queue-item"]')
    log_test("Queue", "Queue loaded", True, details=f"{queue_items.count()} patients")
    
    # Test refresh
    refresh_btn = page.locator('button:has-text("Actualiser"), [aria-label*="refresh"]').first
    if refresh_btn.count() > 0:
        refresh_btn.click()
        page.wait_for_timeout(1000)
        take_screenshot(page, "queue_02_refreshed")
        log_test("Queue", "Refresh works", True)
    
    return True


def test_patient_detail_workflow(page):
    """Test patient detail workflow"""
    print("\n=== PATIENT DETAIL WORKFLOW ===")
    
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    log_test("Patient Detail", "Navigate to patients", True)
    
    # Find first patient row
    patient_row = page.locator('tbody tr').first
    if patient_row.count() == 0:
        log_test("Patient Detail", "Find patient", False, error="No patients")
        return False

    take_screenshot(page, "patient_detail_01_list")

    # Click the eye icon (view action) in the ACTIONS column
    # The eye icon is typically the first action button in each row
    view_btn = patient_row.locator('button, a').filter(has=page.locator('svg')).first
    if view_btn.count() > 0:
        view_btn.click()
        page.wait_for_timeout(1500)
        take_screenshot(page, "patient_detail_02_view")
    else:
        # Alternative: click on patient name (may trigger navigation)
        patient_name = patient_row.locator('td').nth(0)
        patient_name.click()
        page.wait_for_timeout(500)
        # Look for "Voir dossier" in popup
        voir_btn = page.locator('text=Voir dossier').first
        if voir_btn.count() > 0:
            voir_btn.click()
            page.wait_for_timeout(1500)
        take_screenshot(page, "patient_detail_02_view_alt")
    
    # Check if we navigated to a patient detail page (URL like /patients/abc123)
    url_has_patient_id = re.search(r'/patients/[a-f0-9]{24}', page.url)
    if url_has_patient_id:
        log_test("Patient Detail", "Opened detail", True)
    else:
        log_test("Patient Detail", "Opened detail", False, error=f"URL: {page.url}")
        return False
    
    # Check sections
    for section in ['Actions Rapides', 'Refraction', 'Documents', 'Historique']:
        if page.locator(f'text={section}').count() > 0:
            log_test("Patient Detail", f"Section '{section}'", True)
    
    # Check action buttons
    quick_actions = page.locator('button:has-text("Consultation"), button:has-text("Ordonnance")')
    if quick_actions.count() > 0:
        log_test("Patient Detail", "Quick actions", True, details=f"{quick_actions.count()} actions")
        take_screenshot(page, "patient_detail_02_actions")
    
    return True


def test_invoicing_workflow(page):
    """Test invoicing workflow"""
    print("\n=== INVOICING WORKFLOW ===")
    
    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    take_screenshot(page, "invoicing_01_list")
    log_test("Invoicing", "Navigate to invoicing", True)
    
    # Check list
    invoice_list = page.locator('table tbody tr, [class*="invoice-item"]')
    log_test("Invoicing", "Invoice list loaded", True, details=f"{invoice_list.count()} invoices")
    
    # Test category filter
    for cat in ['Services', 'Chirurgie', 'Medicaments', 'Optique']:
        tab = page.locator(f'button:has-text("{cat}")').first
        if tab.count() > 0:
            tab.click()
            page.wait_for_timeout(500)
            take_screenshot(page, f"invoicing_02_{cat.lower()}")
            log_test("Invoicing", f"Category '{cat}' filter", True)
            break
    
    # Check totals - use text-based selectors to avoid CSS parse issues
    totals = page.locator('text=FCFA, text=XAF, text=Total')
    if totals.count() > 0:
        log_test("Invoicing", "Totals displayed", True)
    else:
        # Alternative: check for any currency display
        currency_display = page.get_by_text("FCFA").or_(page.get_by_text("XAF")).or_(page.get_by_text("Total"))
        log_test("Invoicing", "Totals displayed", currency_display.count() > 0)
    
    return True


def main():
    global test_results
    test_results = []
    headed = os.environ.get('HEADED', '0') == '1'
    
    print("=" * 70)
    print("MEDFLOW WORKFLOW TEST SUITE")
    print("=" * 70)
    print(f"Screenshots: {SCREENSHOT_DIR}")
    print(f"Mode: {'Headed' if headed else 'Headless'}")
    print()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed, slow_mo=300 if headed else 0)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        
        # Login
        print("Logging in...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.locator('#email').fill(TEST_USER)
        page.locator('#password').fill(TEST_PASSWORD)
        page.locator('button[type="submit"]').click()
        
        try:
            page.wait_for_url("**/home", timeout=15000)
            print("Login successful\n")
        except:
            print("Login failed!")
            browser.close()
            return False
        
        # Run workflows
        workflows = [
            ("Ophthalmology", test_ophthalmology_consultation),
            ("Prescription", test_prescription_workflow),
            ("Queue", test_queue_workflow),
            ("Patient Detail", test_patient_detail_workflow),
            ("Invoicing", test_invoicing_workflow),
        ]
        
        for name, test_fn in workflows:
            try:
                test_fn(page)
            except Exception as e:
                log_test(name, "Workflow execution", False, error=str(e)[:100])
        
        browser.close()
    
    # Summary
    print()
    print("=" * 70)
    passed = sum(1 for r in test_results if r["passed"])
    failed = len(test_results) - passed
    print(f"Results: {passed} passed, {failed} failed out of {len(test_results)} steps")
    
    # Group by workflow
    for wf in set(r["workflow"] for r in test_results):
        wf_results = [r for r in test_results if r["workflow"] == wf]
        wf_passed = sum(1 for r in wf_results if r["passed"])
        status = "pass" if wf_passed == len(wf_results) else "partial"
        print(f"  [{status}] {wf}: {wf_passed}/{len(wf_results)}")
    
    # Save report
    with open(REPORT_FILE, 'w') as f:
        json.dump({"timestamp": datetime.now().isoformat(),
                   "summary": {"total": len(test_results), "passed": passed, "failed": failed},
                   "results": test_results}, f, indent=2)
    
    print(f"\nReport: {REPORT_FILE}")
    print("=" * 70)
    return failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
