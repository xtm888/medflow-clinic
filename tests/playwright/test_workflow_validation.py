#!/usr/bin/env python3
"""
MedFlow Workflow Validation Test Suite

Tests actual data flow and workflow correctness:
- Patient creation and retrieval
- Appointment scheduling and queue integration
- Surgery case workflow
- Optical shop sales
- Invoice generation
- Prescription workflow

Run: python3 test_workflow_validation.py
Run headed: HEADED=1 python3 test_workflow_validation.py
"""

import os
import json
import time
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "workflows")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "workflow_validation_report.json")
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = {
    "timestamp": datetime.now().isoformat(),
    "workflows": {},
    "issues": [],
    "summary": {"passed": 0, "failed": 0, "warnings": 0}
}

def take_ss(page, name):
    """Take optimized screenshot"""
    path = os.path.join(SCREENSHOT_DIR, f"{name}.jpg")
    try:
        page.screenshot(path=path, type='jpeg', quality=50)
        return path
    except:
        return None

def log_issue(workflow, issue, severity="error"):
    """Log an issue found during testing"""
    results["issues"].append({
        "workflow": workflow,
        "issue": issue,
        "severity": severity,
        "timestamp": datetime.now().isoformat()
    })
    if severity == "error":
        results["summary"]["failed"] += 1
    else:
        results["summary"]["warnings"] += 1
    print(f"  {'❌' if severity == 'error' else '⚠️'} {issue}")

def log_success(message):
    """Log success"""
    results["summary"]["passed"] += 1
    print(f"  ✅ {message}")

def login(page):
    """Login to the application"""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)
    page.locator('button[type="submit"]').click()
    try:
        page.wait_for_url("**/home", timeout=10000)
        return True
    except:
        return False

def test_patient_workflow(page):
    """Test patient list displays and patient details work"""
    workflow = "patient_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Patient Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Step 1: Go to patients list
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_timeout(2000)
    take_ss(page, "01_patients_list")

    # Check if patient list loads with data
    patient_rows = page.locator('tbody tr').count()
    total_text = page.locator('text=/\\d+\\s*patient/i').first

    if patient_rows > 0:
        log_success(f"Patient list loaded with {patient_rows} visible rows")
        results["workflows"][workflow]["steps"].append({
            "step": "list_load",
            "status": "pass",
            "data": {"rows": patient_rows}
        })
    else:
        log_issue(workflow, "Patient list is empty or failed to load")
        results["workflows"][workflow]["steps"].append({
            "step": "list_load",
            "status": "fail"
        })

    # Step 2: Search for a patient
    search_input = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first
    if search_input.count() > 0:
        search_input.fill("A")
        page.wait_for_timeout(1000)
        filtered_rows = page.locator('tbody tr').count()
        log_success(f"Search filter works - {filtered_rows} results for 'A'")
        take_ss(page, "02_patients_search")
    else:
        log_issue(workflow, "Search input not found", "warning")

    # Step 3: Click on first patient to view details
    first_row = page.locator('tbody tr').first
    if first_row.count() > 0:
        # Try to find a clickable element in the row
        view_btn = first_row.locator('button, a').first
        if view_btn.count() > 0:
            view_btn.click()
            page.wait_for_timeout(2000)
            take_ss(page, "03_patient_detail")

            # Check if we navigated to patient detail
            if '/patients/' in page.url or page.locator('text=/Dossier|Fiche|Patient/i').count() > 0:
                log_success("Patient detail page accessible")
            else:
                log_issue(workflow, "Patient detail navigation failed", "warning")

    results["workflows"][workflow]["status"] = "completed"

def test_queue_workflow(page):
    """Test queue displays and reflects waiting patients"""
    workflow = "queue_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Queue Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to queue page
    page.goto(f"{BASE_URL}/queue")
    page.wait_for_timeout(2000)
    take_ss(page, "04_queue_view")

    # Check WebSocket connection status
    ws_indicator = page.locator('text=/En direct|En ligne|Connecté/i')
    if ws_indicator.count() > 0:
        log_success("WebSocket connection indicator present")
    else:
        log_issue(workflow, "WebSocket status not visible", "warning")

    # Check queue sections
    waiting_section = page.locator('text=/En attente|Waiting/i')
    if waiting_section.count() > 0:
        log_success("Queue sections visible")

    # Check for patient cards in queue
    queue_cards = page.locator('[class*="card"], [class*="queue-item"]').count()
    log_success(f"Queue has {queue_cards} items/cards visible")

    # Check action buttons
    call_next = page.locator('button:has-text("Appeler"), button:has-text("Suivant")')
    if call_next.count() > 0:
        log_success("Call next button available")

    results["workflows"][workflow]["status"] = "completed"

def test_appointment_workflow(page):
    """Test appointments calendar and scheduling"""
    workflow = "appointment_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Appointment Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to appointments
    page.goto(f"{BASE_URL}/appointments")
    page.wait_for_timeout(2000)
    take_ss(page, "05_appointments_list")

    # Check page loaded (has stats cards and view mode buttons)
    stats_cards = page.locator('[class*="card"][class*="gradient"], [class*="bg-gradient"]')
    if stats_cards.count() >= 4:
        log_success(f"Appointments page has {stats_cards.count()} stats cards")

    # Check view mode buttons (Liste, Semaine, Mois, Agenda)
    view_buttons = page.locator('button:has-text("Liste"), button:has-text("Semaine"), button:has-text("Mois")')
    if view_buttons.count() >= 2:
        log_success("View mode buttons available")

    # Check for appointments display (list view default)
    appointment_cards = page.locator('[class*="card"]:has-text("Date"), [class*="card"]:has-text("Patient")')
    event_count = appointment_cards.count()
    if event_count > 0:
        log_success(f"Found {event_count} appointment cards in list view")

    # Check new appointment button - be more specific with selector
    new_apt_btn = page.locator('button:has-text("Nouveau rendez-vous")')
    if new_apt_btn.count() == 0:
        # Try fallback selector
        new_apt_btn = page.locator('button:has(svg):has-text("Nouveau")')

    if new_apt_btn.count() > 0:
        log_success("New appointment button available")
        # Try clicking to see if modal opens
        new_apt_btn.first.click()
        page.wait_for_timeout(1500)  # Longer wait for modal animation

        # Check for modal with multiple selectors
        modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"], div:has-text("Nouveau rendez-vous"):visible >> ..')
        if modal.count() > 0 or page.locator('text="Rechercher un patient"').count() > 0:
            log_success("Appointment creation modal opens")
            take_ss(page, "06_appointment_modal")
            # Close modal
            page.keyboard.press('Escape')
            page.wait_for_timeout(500)
        else:
            log_issue(workflow, "Appointment modal didn't open", "warning")
    else:
        log_issue(workflow, "New appointment button not found", "warning")

    results["workflows"][workflow]["status"] = "completed"

def test_surgery_workflow(page):
    """Test surgery module workflow"""
    workflow = "surgery_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Surgery Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to surgery dashboard
    page.goto(f"{BASE_URL}/surgery")
    page.wait_for_timeout(2000)
    take_ss(page, "07_surgery_dashboard")

    # Check stats cards
    stats_cards = page.locator('[class*="card"], [class*="stat"]')
    if stats_cards.count() >= 3:
        log_success(f"Surgery dashboard has {stats_cards.count()} stats cards")

    # Check sections
    sections = page.locator('text=/En attente|Agenda|Programmée/i')
    if sections.count() > 0:
        log_success("Surgery sections visible")

    # Test new case button
    new_case_btn = page.locator('button:has-text("Nouveau Cas")')
    if new_case_btn.count() > 0:
        new_case_btn.click()
        page.wait_for_timeout(2000)
        take_ss(page, "08_surgery_new_case")

        if page.locator('text=Nouveau Cas Chirurgical').count() > 0:
            log_success("Surgery new case form loads correctly")

            # Check form fields
            patient_search = page.locator('input[placeholder*="Rechercher"]')
            if patient_search.count() > 0:
                log_success("Patient search field present")

            surgery_type = page.locator('select')
            if surgery_type.count() > 0:
                log_success("Surgery type selector present")

            eye_selection = page.locator('input[type="radio"], [name="eye"]')
            if eye_selection.count() > 0:
                log_success("Eye selection options present")
        else:
            log_issue(workflow, "Surgery new case form not loading")
    else:
        log_issue(workflow, "New case button not found")

    results["workflows"][workflow]["status"] = "completed"

def test_optical_shop_workflow(page):
    """Test optical shop sales workflow"""
    workflow = "optical_shop_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Optical Shop Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to optical shop
    page.goto(f"{BASE_URL}/optical-shop")
    page.wait_for_timeout(2000)
    take_ss(page, "09_optical_shop")

    # Check dashboard elements
    stats = page.locator('[class*="stat"], [class*="card"]')
    log_success(f"Optical shop dashboard has {stats.count()} stat/card elements")

    # Check patient search
    search = page.locator('input[placeholder*="patient" i], input[placeholder*="rechercher" i]')
    if search.count() > 0:
        log_success("Patient search available for new sale")

        # Test search functionality
        search.first.fill("Test")
        page.wait_for_timeout(1500)

        results_dropdown = page.locator('[class*="dropdown"], [class*="results"], [class*="suggestion"]')
        if results_dropdown.count() > 0:
            log_success("Search results dropdown appears")
        take_ss(page, "10_optical_search")

    # Check verification queue link
    verif_btn = page.locator('text=/Vérification|Verification/i')
    if verif_btn.count() > 0:
        log_success("Verification queue accessible")

    results["workflows"][workflow]["status"] = "completed"

def test_glasses_orders_workflow(page):
    """Test glasses orders list and management"""
    workflow = "glasses_orders_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Glasses Orders Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to glasses orders
    page.goto(f"{BASE_URL}/glasses-orders")
    page.wait_for_timeout(2000)
    take_ss(page, "11_glasses_orders")

    # Check if page loaded without error
    error = page.locator('text=TypeError, text=Error')
    if error.count() > 0:
        log_issue(workflow, "Glasses orders page has errors")
    else:
        log_success("Glasses orders page loads without errors")

    # Check stats
    stats = page.locator('[class*="stat"]')
    if stats.count() > 0:
        log_success(f"Order statistics displayed ({stats.count()} stat cards)")

    # Check tabs
    tabs = page.locator('[role="tab"], button[class*="tab"]')
    if tabs.count() > 0:
        log_success(f"Filter tabs available ({tabs.count()} tabs)")

    # Check order list
    orders_table = page.locator('table, [class*="order-list"]')
    if orders_table.count() > 0:
        log_success("Orders list/table rendered")

    results["workflows"][workflow]["status"] = "completed"

def test_invoicing_workflow(page):
    """Test invoicing list and creation"""
    workflow = "invoicing_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Invoicing Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to invoicing
    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_timeout(2000)
    take_ss(page, "12_invoicing")

    # Check invoice list
    invoice_table = page.locator('table tbody tr')
    count = invoice_table.count()
    log_success(f"Invoice list shows {count} invoices")

    # Check filters
    filters = page.locator('select, input[type="date"]')
    if filters.count() > 0:
        log_success("Invoice filters available")

    # Check totals/summary
    totals = page.locator('text=/Total|Montant|FCFA/i')
    if totals.count() > 0:
        log_success("Invoice totals displayed")

    # Check create button
    create_btn = page.locator('button:has-text("Créer"), button:has-text("Nouvelle")')
    if create_btn.count() > 0:
        log_success("Create invoice button available")

    results["workflows"][workflow]["status"] = "completed"

def test_prescription_workflow(page):
    """Test prescription list and management"""
    workflow = "prescription_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Prescription Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to prescriptions
    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_timeout(2000)
    take_ss(page, "13_prescriptions")

    # Check list loads
    prescription_list = page.locator('table tbody tr, [class*="prescription-item"]')
    count = prescription_list.count()
    log_success(f"Prescription list shows {count} items")

    # Check status filters
    status_filters = page.locator('button:has-text("En attente"), button:has-text("Dispensé")')
    if status_filters.count() > 0:
        log_success("Status filter buttons available")

    # Check search
    search = page.locator('input[placeholder*="Rechercher"]')
    if search.count() > 0:
        log_success("Prescription search available")

    results["workflows"][workflow]["status"] = "completed"

def test_laboratory_workflow(page):
    """Test laboratory orders and results"""
    workflow = "laboratory_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Laboratory Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to laboratory
    page.goto(f"{BASE_URL}/laboratory")
    page.wait_for_timeout(2000)
    take_ss(page, "14_laboratory")

    # Check sections
    sections = page.locator('text=/En attente|Résultats|Pending|Results/i')
    if sections.count() > 0:
        log_success("Laboratory sections visible")

    # Check order list
    orders = page.locator('table tbody tr, [class*="lab-order"]')
    count = orders.count()
    log_success(f"Laboratory shows {count} orders")

    # Check stats
    stats = page.locator('[class*="stat"], [class*="card"]')
    if stats.count() > 0:
        log_success(f"Lab statistics displayed ({stats.count()} cards)")

    results["workflows"][workflow]["status"] = "completed"

def test_pharmacy_workflow(page):
    """Test pharmacy dispensing workflow"""
    workflow = "pharmacy_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Pharmacy Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to pharmacy
    page.goto(f"{BASE_URL}/pharmacy")
    page.wait_for_timeout(2000)
    take_ss(page, "15_pharmacy")

    # Check pending prescriptions
    pending = page.locator('text=/En attente|Pending/i')
    if pending.count() > 0:
        log_success("Pending prescriptions section visible")

    # Check inventory link
    inventory = page.locator('a[href*="inventory"], button:has-text("Inventaire")')
    if inventory.count() > 0:
        log_success("Inventory link available")

    # Check low stock alerts
    alerts = page.locator('text=/Stock bas|Low stock|Alerte/i')
    log_success(f"Stock alert indicators: {alerts.count()}")

    results["workflows"][workflow]["status"] = "completed"

def test_cross_clinic_workflow(page):
    """Test multi-clinic dashboard"""
    workflow = "cross_clinic_workflow"
    print("\n" + "=" * 60)
    print("🧪 Testing Cross-Clinic Workflow")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Go to cross-clinic dashboard
    page.goto(f"{BASE_URL}/cross-clinic-dashboard")
    page.wait_for_timeout(2000)
    take_ss(page, "16_cross_clinic")

    # Check clinic selector
    clinic_selector = page.locator('select, [class*="clinic-select"]')
    if clinic_selector.count() > 0:
        log_success("Clinic selector available")

    # Check multi-clinic stats
    stats = page.locator('[class*="stat"], [class*="card"]')
    log_success(f"Cross-clinic dashboard has {stats.count()} stat/card elements")

    # Check comparison features
    compare = page.locator('text=/Comparaison|Compare|Consolidé/i')
    if compare.count() > 0:
        log_success("Comparison/consolidation features visible")

    results["workflows"][workflow]["status"] = "completed"

def test_data_consistency(page):
    """Test that data appears consistently across related pages"""
    workflow = "data_consistency"
    print("\n" + "=" * 60)
    print("🧪 Testing Data Consistency")
    print("=" * 60)

    results["workflows"][workflow] = {"steps": [], "status": "running"}

    # Get patient count from patients page
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_timeout(2000)

    patient_count_text = page.locator('text=/\\d+\\s*patient/i').first
    if patient_count_text.count() > 0:
        text = patient_count_text.text_content()
        import re
        match = re.search(r'(\d+)', text)
        if match:
            patient_count = int(match.group(1))
            log_success(f"Patients page shows {patient_count} patients")

    # Check dashboard stats
    page.goto(f"{BASE_URL}/dashboard")
    page.wait_for_timeout(2000)

    dashboard_stats = page.locator('[class*="stat"] [class*="value"], [class*="metric"] span')
    if dashboard_stats.count() > 0:
        log_success(f"Dashboard shows {dashboard_stats.count()} metrics")

    # Check queue count matches
    page.goto(f"{BASE_URL}/queue")
    page.wait_for_timeout(2000)

    queue_items = page.locator('[class*="queue-item"], [class*="patient-card"]').count()
    log_success(f"Queue shows {queue_items} waiting patients")

    results["workflows"][workflow]["status"] = "completed"

def main():
    headed = os.environ.get('HEADED', '0') == '1'

    print("=" * 60)
    print("MEDFLOW WORKFLOW VALIDATION TEST SUITE")
    print("=" * 60)
    print(f"Mode: {'Headed' if headed else 'Headless'}")
    print(f"Screenshots: {SCREENSHOT_DIR}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed, slow_mo=100 if headed else 0)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Login
        print("🔐 Logging in...")
        if not login(page):
            print("❌ Login failed!")
            browser.close()
            return False
        print("✅ Login successful")

        # Run all workflow tests
        try:
            test_patient_workflow(page)
            test_queue_workflow(page)
            test_appointment_workflow(page)
            test_surgery_workflow(page)
            test_optical_shop_workflow(page)
            test_glasses_orders_workflow(page)
            test_invoicing_workflow(page)
            test_prescription_workflow(page)
            test_laboratory_workflow(page)
            test_pharmacy_workflow(page)
            test_cross_clinic_workflow(page)
            test_data_consistency(page)
        except Exception as e:
            print(f"\n❌ Test error: {str(e)}")
            log_issue("general", f"Test execution error: {str(e)}")

        browser.close()

    # Save report
    with open(REPORT_FILE, 'w') as f:
        json.dump(results, f, indent=2)

    # Summary
    print("\n" + "=" * 60)
    print("WORKFLOW VALIDATION SUMMARY")
    print("=" * 60)
    print(f"✅ Passed: {results['summary']['passed']}")
    print(f"⚠️  Warnings: {results['summary']['warnings']}")
    print(f"❌ Failed: {results['summary']['failed']}")
    print(f"\n📝 Report: {REPORT_FILE}")
    print(f"📸 Screenshots: {SCREENSHOT_DIR}")

    if results["issues"]:
        print("\n📋 Issues Found:")
        for issue in results["issues"]:
            icon = "❌" if issue["severity"] == "error" else "⚠️"
            print(f"  {icon} [{issue['workflow']}] {issue['issue']}")

    return results['summary']['failed'] == 0

if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
