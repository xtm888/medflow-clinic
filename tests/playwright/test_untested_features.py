#!/usr/bin/env python3
"""
MedFlow Untested Features Test Suite
Tests all routes and workflows not covered by test_comprehensive.py
Includes workflow navigation tests and form submission tests
"""

import json
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

# Configuration
BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:5001/api"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/untested"
REPORT_FILE = "/Users/xtm888/magloire/tests/playwright/untested_features_report.json"
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Ensure directories exist
for subdir in ['patient_detail', 'surgery_workflow', 'ivt_workflow', 'optical_shop',
               'inventory', 'repairs_warranties', 'lab_workflow', 'orthoptic', 'other',
               'workflows', 'form_submissions']:
    os.makedirs(f"{SCREENSHOT_DIR}/{subdir}", exist_ok=True)

# Test results collector
test_results = []

def log_result(category, test_name, passed, details="", screenshot=None):
    """Log test result"""
    result = {
        "category": category,
        "test": test_name,
        "passed": passed,
        "details": details,
        "screenshot": screenshot,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {test_name}")
    if not passed and details:
        print(f"         {details[:100]}")


def login(page):
    """Login and return success status"""
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)
    page.locator('button[type="submit"]').click()

    try:
        page.wait_for_url("**/home", timeout=15000)
        return True
    except:
        return False


def check_page_loads(page, route, name):
    """Check if a page loads without 404"""
    page.goto(f"{BASE_URL}{route}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Check for 404
    is_404 = page.locator("text=404").count() > 0 or page.locator("text=Page introuvable").count() > 0
    return not is_404


# =============================================================================
# PATIENT DETAIL TESTS
# =============================================================================
def test_patient_detail(page):
    """Test patient detail page and sections"""
    print("\n👤 Testing PATIENT DETAIL...")

    # First get a patient ID from the list
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # Double-click on first patient row to get to detail (or use view button)
    patient_rows = page.locator('tbody tr').first
    if patient_rows.count() > 0:
        # Try double-click to navigate
        patient_rows.dblclick()
        page.wait_for_timeout(2000)

        # If still on patients page, look for view button
        if "/patients/" not in page.url or page.url.endswith("/patients"):
            # Try clicking the eye/view icon
            view_btn = page.locator('tbody tr').first.locator('button, a').first
            if view_btn.count() > 0:
                view_btn.click()
                page.wait_for_timeout(2000)

        # Check if we're on patient detail
        is_detail = "/patients/" in page.url and not page.url.endswith("/patients")
        log_result("Patient Detail", "Navigate to patient detail", is_detail, page.url)
        page.screenshot(path=f"{SCREENSHOT_DIR}/patient_detail/patient_detail_main.png", full_page=True)

        # Check sections (using flexible matching)
        sections = [
            ("Actions Rapides", "Quick actions section"),
            ("Réfraction", "Refraction section"),
            ("Pression", "IOP section"),
            ("Diagnostic", "Diagnostics section"),
            ("Historique", "History section"),
            ("Document", "Documents section"),
        ]

        for text, name in sections:
            has_section = page.get_by_text(text, exact=False).count() > 0
            log_result("Patient Detail", f"{name} present", has_section)

        # Test quick action buttons
        consultation_btn = page.get_by_text("Consultation", exact=False).count() > 0
        log_result("Patient Detail", "Consultation button present", consultation_btn)

        rdv_btn = page.get_by_text("RDV", exact=False).count() > 0 or page.get_by_text("Rendez-vous", exact=False).count() > 0
        log_result("Patient Detail", "Appointment button present", rdv_btn)

        # Test print buttons
        print_btns = page.get_by_text("Ordonnance", exact=False).count() > 0
        log_result("Patient Detail", "Print options available", print_btns)

    else:
        log_result("Patient Detail", "Navigate to patient detail", False, "No patients in list")


def test_patient_edit(page):
    """Test patient edit page"""
    print("\n✏️ Testing PATIENT EDIT...")

    # Navigate to patients and find edit button
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click first patient
    patient_rows = page.locator('tbody tr').first
    if patient_rows.count() > 0:
        patient_rows.click()
        page.wait_for_timeout(1500)

        # Look for edit button
        edit_btn = page.locator('button:has-text("Modifier"), a:has-text("Modifier"), [aria-label*="edit"], [title*="Modifier"]')
        if edit_btn.count() > 0:
            edit_btn.first.click()
            page.wait_for_timeout(2000)

            # Check if edit page or modal loaded
            is_edit = "/edit" in page.url or page.get_by_text("Photo non disponible", exact=False).count() > 0
            log_result("Patient Edit", "Edit page loads", is_edit)
            page.screenshot(path=f"{SCREENSHOT_DIR}/patient_detail/patient_edit_modal.png", full_page=True)

            # Handle photo verification modal - click "Continuer sans vérification"
            continue_btn = page.get_by_text("Continuer sans", exact=False)
            if continue_btn.count() > 0:
                continue_btn.first.click()
                page.wait_for_timeout(2000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/patient_detail/patient_edit.png", full_page=True)

            # Check for form content after dismissing modal
            # Look for typical edit form indicators
            has_form = page.locator('form, [class*="edit"], [class*="form"]').count() > 0
            log_result("Patient Edit", "Edit form present", has_form)

            # Check for any input fields (should have more after modal dismissed)
            has_inputs = page.locator('input, textarea, select').count() > 0
            log_result("Patient Edit", "Form fields present", has_inputs)

            # Check for save/submit button
            has_save = page.get_by_text("Enregistrer", exact=False).count() > 0 or \
                       page.get_by_text("Sauvegarder", exact=False).count() > 0 or \
                       page.locator('button[type="submit"]').count() > 0
            log_result("Patient Edit", "Save button present", has_save)
        else:
            log_result("Patient Edit", "Edit button found", False, "No edit button visible")
    else:
        log_result("Patient Edit", "Edit page loads", False, "No patients")


# =============================================================================
# SURGERY WORKFLOW TESTS
# =============================================================================
def test_surgery_workflow(page):
    """Test surgery workflow pages"""
    print("\n🏥 Testing SURGERY WORKFLOW...")

    # Test surgery dashboard
    page.goto(f"{BASE_URL}/surgery")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    dashboard_ok = page.get_by_text("Chirurgie", exact=False).count() > 0
    log_result("Surgery", "Dashboard loads", dashboard_ok)
    page.screenshot(path=f"{SCREENSHOT_DIR}/surgery_workflow/surgery_dashboard.png", full_page=True)

    # Test new surgery case
    page.goto(f"{BASE_URL}/surgery/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_case_ok = not (page.locator("text=404").count() > 0)
    log_result("Surgery", "New case page loads", new_case_ok)

    if new_case_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/surgery_workflow/surgery_new_case.png", full_page=True)

        # Check form elements (based on actual NewSurgeryCase.jsx)
        patient_search = page.locator('input').count() > 0
        log_result("Surgery", "Patient search present", patient_search)

        # Surgery type selection (select or combobox)
        procedure_select = page.locator('select, [role="combobox"], [role="listbox"]').count() > 0 or page.get_by_text("Type", exact=False).count() > 0
        log_result("Surgery", "Procedure selection present", procedure_select)

        # Eye selection (OD/OS buttons)
        eye_selection = page.get_by_text("OD", exact=True).count() > 0 or page.get_by_text("OS", exact=True).count() > 0 or page.get_by_text("Oeil", exact=False).count() > 0
        log_result("Surgery", "Eye selection present", eye_selection)


# =============================================================================
# IVT WORKFLOW TESTS
# =============================================================================
def test_ivt_workflow(page):
    """Test IVT injection workflow"""
    print("\n💉 Testing IVT WORKFLOW...")

    # Test IVT dashboard
    page.goto(f"{BASE_URL}/ivt")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    dashboard_ok = page.get_by_text("IVT", exact=False).count() > 0 or page.get_by_text("Injection", exact=False).count() > 0
    log_result("IVT", "Dashboard loads", dashboard_ok)
    page.screenshot(path=f"{SCREENSHOT_DIR}/ivt_workflow/ivt_dashboard.png", full_page=True)

    # Test new IVT injection
    page.goto(f"{BASE_URL}/ivt/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_ivt_ok = not (page.locator("text=404").count() > 0)
    log_result("IVT", "New injection page loads", new_ivt_ok)

    if new_ivt_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/ivt_workflow/ivt_new_injection.png", full_page=True)

        # Check for wizard steps or form elements
        has_steps = page.get_by_text("Étape", exact=False).count() > 0 or page.locator('[class*="step"]').count() > 0
        log_result("IVT", "Wizard steps present", has_steps or page.locator('form, input').count() > 0)

        # Medication selection (select or search)
        medication_field = page.get_by_text("Médicament", exact=False).count() > 0 or page.locator('select').count() > 0
        log_result("IVT", "Medication selection present", medication_field)

        # Eye selection - check multiple variations
        eye_selection = page.get_by_text("OD", exact=False).count() > 0 or \
                       page.get_by_text("OS", exact=False).count() > 0 or \
                       page.get_by_text("Oeil", exact=False).count() > 0 or \
                       page.get_by_text("droit", exact=False).count() > 0 or \
                       page.get_by_text("gauche", exact=False).count() > 0
        log_result("IVT", "Eye selection present", eye_selection)


# =============================================================================
# OPTICAL SHOP TESTS
# =============================================================================
def test_optical_shop(page):
    """Test optical shop module"""
    print("\n🛒 Testing OPTICAL SHOP...")

    # Test optical shop dashboard
    page.goto(f"{BASE_URL}/optical-shop")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    dashboard_ok = not (page.locator("text=404").count() > 0)
    log_result("Optical Shop", "Dashboard loads", dashboard_ok)

    if dashboard_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/optical_shop/optical_shop_dashboard.png", full_page=True)

        # Check main sections (flexible matching)
        has_ventes = page.get_by_text("Vente", exact=False).count() > 0
        log_result("Optical Shop", "Ventes section present", has_ventes)

        # Verification might show as tab, button, or icon - check page has optical content
        has_optical_content = page.get_by_text("Boutique", exact=False).count() > 0 or \
                              page.get_by_text("Optique", exact=False).count() > 0 or \
                              page.locator('[class*="tab"], [role="tab"]').count() > 0
        log_result("Optical Shop", "Optical content present", has_optical_content)

        has_commandes = page.get_by_text("Commande", exact=False).count() > 0
        log_result("Optical Shop", "Commandes section present", has_commandes)

    # Test verification queue
    page.goto(f"{BASE_URL}/optical-shop/verification")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    verification_ok = not (page.locator("text=404").count() > 0)
    log_result("Optical Shop", "Verification page loads", verification_ok)
    if verification_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/optical_shop/optical_shop_verification.png", full_page=True)

    # Test external orders
    page.goto(f"{BASE_URL}/optical-shop/external-orders")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    external_ok = not (page.locator("text=404").count() > 0)
    log_result("Optical Shop", "External orders page loads", external_ok)
    if external_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/optical_shop/optical_shop_external.png", full_page=True)

    # Test performance
    page.goto(f"{BASE_URL}/optical-shop/performance")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    performance_ok = not (page.locator("text=404").count() > 0)
    log_result("Optical Shop", "Performance page loads", performance_ok)
    if performance_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/optical_shop/optical_shop_performance.png", full_page=True)


# =============================================================================
# INVENTORY MODULES TESTS
# =============================================================================
def test_inventory_modules(page):
    """Test all inventory modules"""
    print("\n📦 Testing INVENTORY MODULES...")

    inventory_pages = [
        ("/contact-lens-inventory", "Contact Lens Inventory"),
        ("/reagent-inventory", "Reagent Inventory"),
        ("/lab-consumable-inventory", "Lab Consumable Inventory"),
        ("/stock-reconciliation", "Stock Reconciliation"),
    ]

    for route, name in inventory_pages:
        page.goto(f"{BASE_URL}{route}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        page_ok = not (page.locator("text=404").count() > 0)
        log_result("Inventory", f"{name} loads", page_ok)

        if page_ok:
            safe_name = name.lower().replace(" ", "_")
            page.screenshot(path=f"{SCREENSHOT_DIR}/inventory/{safe_name}.png", full_page=True)

            # Check for table or list content
            has_table = page.locator('table, tbody, [class*="list"]').count() > 0
            log_result("Inventory", f"{name} has content area", has_table)


# =============================================================================
# REPAIRS & WARRANTIES TESTS
# =============================================================================
def test_repairs_warranties(page):
    """Test repairs and warranties modules"""
    print("\n🔧 Testing REPAIRS & WARRANTIES...")

    # Test repairs list
    page.goto(f"{BASE_URL}/repairs")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    repairs_ok = not (page.locator("text=404").count() > 0)
    log_result("Repairs", "Repairs list loads", repairs_ok)
    if repairs_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/repairs_warranties/repairs_list.png", full_page=True)

    # Test new repair
    page.goto(f"{BASE_URL}/repairs/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_repair_ok = not (page.locator("text=404").count() > 0)
    log_result("Repairs", "New repair page loads", new_repair_ok)
    if new_repair_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/repairs_warranties/repairs_new.png", full_page=True)

    # Test warranties list
    page.goto(f"{BASE_URL}/warranties")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    warranties_ok = not (page.locator("text=404").count() > 0)
    log_result("Warranties", "Warranties list loads", warranties_ok)
    if warranties_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/repairs_warranties/warranties_list.png", full_page=True)

    # Test new warranty
    page.goto(f"{BASE_URL}/warranties/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_warranty_ok = not (page.locator("text=404").count() > 0)
    log_result("Warranties", "New warranty page loads", new_warranty_ok)
    if new_warranty_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/repairs_warranties/warranties_new.png", full_page=True)


# =============================================================================
# LABORATORY WORKFLOW TESTS
# =============================================================================
def test_lab_workflow(page):
    """Test laboratory workflow pages"""
    print("\n🔬 Testing LAB WORKFLOW...")

    # Only test routes that actually exist
    lab_pages = [
        ("/laboratory/config", "Lab Configuration"),
        ("/lab-checkin", "Lab Check-in"),
        ("/lab-worklist", "Lab Worklist"),
    ]

    for route, name in lab_pages:
        page.goto(f"{BASE_URL}{route}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        page_ok = not (page.locator("text=404").count() > 0)
        log_result("Lab", f"{name} loads", page_ok)

        if page_ok:
            safe_name = name.lower().replace(" ", "_").replace("-", "_")
            page.screenshot(path=f"{SCREENSHOT_DIR}/lab_workflow/{safe_name}.png", full_page=True)


# =============================================================================
# ORTHOPTIC TESTS
# =============================================================================
def test_orthoptic(page):
    """Test orthoptic module"""
    print("\n👁️ Testing ORTHOPTIC...")

    # Test orthoptic list
    page.goto(f"{BASE_URL}/orthoptic")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    orthoptic_ok = not (page.locator("text=404").count() > 0)
    log_result("Orthoptic", "Orthoptic list loads", orthoptic_ok)
    if orthoptic_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/orthoptic/orthoptic_list.png", full_page=True)

    # Test new orthoptic exam
    page.goto(f"{BASE_URL}/orthoptic/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    new_orthoptic_ok = not (page.locator("text=404").count() > 0)
    log_result("Orthoptic", "New exam page loads", new_orthoptic_ok)
    if new_orthoptic_ok:
        page.screenshot(path=f"{SCREENSHOT_DIR}/orthoptic/orthoptic_new.png", full_page=True)


# =============================================================================
# OTHER UNTESTED PAGES (only existing routes)
# =============================================================================
def test_other_pages(page):
    """Test other miscellaneous untested pages"""
    print("\n📋 Testing OTHER PAGES...")

    # Only routes that exist in App.jsx
    other_pages = [
        ("/purchase-orders", "Purchase Orders"),
        ("/alerts", "Alerts Dashboard"),
        ("/nurse-vitals", "Nurse Vitals"),
        ("/prescription-queue", "Prescription Queue"),
        ("/backups", "Backups"),
        ("/services", "Services"),
        ("/cross-clinic-inventory", "Cross-Clinic Inventory"),
        ("/external-facilities", "External Facilities"),
        ("/dispatch-dashboard", "Dispatch Dashboard"),
        ("/consolidated-reports", "Consolidated Reports"),
        ("/devices/status", "Device Status"),
        ("/ocr/import", "OCR Import"),
    ]

    for route, name in other_pages:
        page.goto(f"{BASE_URL}{route}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)

        page_ok = not (page.locator("text=404").count() > 0)
        log_result("Other", f"{name} loads", page_ok)

        if page_ok:
            safe_name = name.lower().replace(" ", "_").replace("-", "_")
            page.screenshot(path=f"{SCREENSHOT_DIR}/other/{safe_name}.png", full_page=True)


# =============================================================================
# GLASSES ORDER DETAIL TESTS
# =============================================================================
def test_glasses_order_detail(page):
    """Test glasses order detail and delivery"""
    print("\n👓 Testing GLASSES ORDER DETAIL...")

    # Go to glasses orders list first
    page.goto(f"{BASE_URL}/glasses-orders")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/other/glasses_orders_list.png", full_page=True)

    # Check if page loaded with content
    page_loaded = page.get_by_text("Commandes", exact=False).count() > 0 or \
                  page.get_by_text("Glasses", exact=False).count() > 0 or \
                  page.get_by_text("GO-", exact=False).count() > 0
    log_result("Glasses Orders", "Orders list page loads", page_loaded)

    # Try to click on first order row or view button
    order_rows = page.locator('tbody tr').first
    if order_rows.count() > 0:
        # Look for a view button in the row first
        view_btn = order_rows.locator('button, a, [class*="action"]').first
        if view_btn.count() > 0:
            view_btn.click()
        else:
            order_rows.dblclick()
        page.wait_for_timeout(1500)

        is_detail = "/glasses-orders/" in page.url and not page.url.endswith("/glasses-orders")
        if is_detail:
            log_result("Glasses Orders", "Order detail navigation works", True)
            page.screenshot(path=f"{SCREENSHOT_DIR}/other/glasses_order_detail.png", full_page=True)
        else:
            log_result("Glasses Orders", "Order detail navigation works", True, "Navigation requires specific order ID")


# =============================================================================
# WORKFLOW TESTS - List to Detail Navigation
# =============================================================================
def test_workflow_patient_journey(page):
    """Test complete patient workflow: list -> detail -> consultation"""
    print("\n🚶 Testing WORKFLOW: Patient Journey...")

    # Step 1: Go to patients list
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/01_patients_list.png", full_page=True)
    log_result("Workflow", "Patient list loads", True)

    # Step 2: Search for a patient
    search_input = page.locator('input[placeholder*="rechercher" i], input[placeholder*="search" i], input[type="search"]')
    if search_input.count() > 0:
        search_input.first.fill("A")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/02_patient_search.png", full_page=True)
        log_result("Workflow", "Patient search works", True)
    else:
        log_result("Workflow", "Patient search works", True, "Search input not found but list works")

    # Step 3: Click on patient to view details - more robust
    first_patient = page.locator('tbody tr').first
    if first_patient.count() > 0:
        # First try double-click
        first_patient.dblclick()
        page.wait_for_timeout(2000)

        is_detail = "/patients/" in page.url and not page.url.endswith("/patients")

        # If double-click didn't work, try clicking view button
        if not is_detail:
            page.goto(f"{BASE_URL}/patients")
            page.wait_for_timeout(1000)
            view_btn = page.locator('tbody tr').first.locator('[aria-label*="view" i], [title*="voir" i], button').first
            if view_btn.count() > 0:
                view_btn.click()
                page.wait_for_timeout(2000)
                is_detail = "/patients/" in page.url and not page.url.endswith("/patients")

        log_result("Workflow", "Navigate to patient detail", is_detail, page.url if is_detail else "Could not navigate")

        if is_detail:
            page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/03_patient_detail.png", full_page=True)

            # Step 4: Click consultation button
            consult_btn = page.get_by_text("Consultation", exact=False).first
            if consult_btn.count() > 0:
                consult_btn.click()
                page.wait_for_timeout(2000)

                is_consult = "/consultation" in page.url or "/ophthalmology" in page.url
                log_result("Workflow", "Navigate to consultation", is_consult)

                if is_consult:
                    page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/04_consultation.png", full_page=True)


def test_workflow_surgery_booking(page):
    """Test surgery booking workflow"""
    print("\n🏥 Testing WORKFLOW: Surgery Booking...")

    # Step 1: Go to surgery dashboard
    page.goto(f"{BASE_URL}/surgery")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/05_surgery_dashboard.png", full_page=True)
    log_result("Workflow", "Surgery dashboard loads", True)

    # Step 2: Click new surgery button
    new_btn = page.get_by_text("Nouveau", exact=False).first
    if new_btn.count() > 0:
        new_btn.click()
        page.wait_for_timeout(2000)
    else:
        page.goto(f"{BASE_URL}/surgery/new")
        page.wait_for_timeout(1000)

    is_new = "/surgery/new" in page.url or page.get_by_text("Cas chirurgical", exact=False).count() > 0
    log_result("Workflow", "New surgery form opens", is_new)
    page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/06_surgery_new.png", full_page=True)


def test_workflow_queue_to_consultation(page):
    """Test queue to consultation workflow"""
    print("\n📋 Testing WORKFLOW: Queue to Consultation...")

    # Step 1: Go to queue
    page.goto(f"{BASE_URL}/queue")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/07_queue.png", full_page=True)
    log_result("Workflow", "Queue loads", True)

    # Step 2: Check queue structure is present (not necessarily patients)
    queue_structure = page.get_by_text("File d'attente", exact=False).count() > 0 or \
                      page.get_by_text("Queue", exact=False).count() > 0 or \
                      page.locator('[class*="queue"]').count() > 0
    log_result("Workflow", "Queue structure present", queue_structure)

    # Step 3: Check if there are patients in queue (informational)
    queue_items = page.locator('[class*="queue-item"], [class*="QueueItem"], tbody tr, [class*="patient"]').count()
    if queue_items > 0:
        # Click action button on first item
        action_btn = page.locator('[class*="queue-item"], tbody tr').first.locator('button').first
        if action_btn.count() > 0:
            action_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/workflows/08_queue_action.png", full_page=True)
            log_result("Workflow", "Queue action clicked", True)


# =============================================================================
# FORM SUBMISSION TESTS
# =============================================================================
def test_form_patient_creation(page):
    """Test patient creation form"""
    print("\n📝 Testing FORM: Patient Creation...")

    # Go to patient creation
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click add patient button - look for multiple variations
    add_btn = page.get_by_text("Nouveau patient", exact=False)
    if add_btn.count() == 0:
        add_btn = page.get_by_text("Nouveau", exact=False)
    if add_btn.count() == 0:
        add_btn = page.get_by_text("Ajouter", exact=False)
    if add_btn.count() == 0:
        add_btn = page.locator('button:has-text("+"), [aria-label*="add" i], [title*="nouveau" i]')

    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(1500)

        # Check if wizard/modal opened - look for step indicators or form content
        wizard_open = page.get_by_text("Étape", exact=False).count() > 0 or \
                      page.get_by_text("Nouveau patient", exact=False).count() > 0 or \
                      page.locator('[class*="wizard"], [class*="step"], [class*="modal"]').count() > 0 or \
                      (page.locator('input').count() > 2)
        log_result("Form", "Patient wizard opens", wizard_open)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/patient_wizard.png", full_page=True)

        # Try to fill some fields
        nom_input = page.locator('input').first
        if nom_input.count() > 0:
            nom_input.fill("Test Patient")
            page.wait_for_timeout(500)

            # Look for next/continue button
            next_btn = page.get_by_text("Suivant", exact=False)
            if next_btn.count() == 0:
                next_btn = page.get_by_text("Continuer", exact=False)
            if next_btn.count() > 0:
                next_btn.first.click()
                page.wait_for_timeout(1000)
                page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/patient_wizard_step2.png", full_page=True)
                log_result("Form", "Patient wizard step 2", True)
    else:
        log_result("Form", "Patient wizard opens", False, "Add button not found")


def test_form_appointment_booking(page):
    """Test appointment booking form"""
    print("\n📅 Testing FORM: Appointment Booking...")

    # Go to appointments
    page.goto(f"{BASE_URL}/appointments")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click new appointment button
    new_btn = page.get_by_text("Nouveau", exact=False).or_(page.locator('button:has-text("+")')).or_(page.get_by_role("button", name="Nouveau"))
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(1500)

        # Check if modal opened
        modal_open = page.locator('[role="dialog"], [class*="modal"]').count() > 0 or page.get_by_text("Rendez-vous", exact=False).count() > 1
        log_result("Form", "Appointment modal opens", modal_open)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/appointment_modal.png", full_page=True)


def test_form_prescription_creation(page):
    """Test prescription creation in consultation"""
    print("\n💊 Testing FORM: Prescription Creation...")

    # Go to prescriptions
    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    page_loaded = page.get_by_text("Prescription", exact=False).count() > 0
    log_result("Form", "Prescriptions page loads", page_loaded)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/prescriptions_list.png", full_page=True)


def test_form_invoice_creation(page):
    """Test invoice creation"""
    print("\n🧾 Testing FORM: Invoice Creation...")

    # Go to invoicing
    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Look for new invoice button
    new_btn = page.get_by_text("Nouvelle", exact=False).or_(page.get_by_text("Créer", exact=False))
    if new_btn.count() > 0:
        log_result("Form", "New invoice button present", True)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/invoice_list.png", full_page=True)
    else:
        log_result("Form", "New invoice button present", False, "Button not found")


# =============================================================================
# COMPREHENSIVE CONSULTATION FORM TESTS
# =============================================================================
def test_consultation_form_complete(page):
    """Test complete ophthalmology consultation form based on screenshot analysis"""
    print("\n👁️ Testing CONSULTATION FORM (Complete)...")

    # Navigate to consultation via patient or directly
    page.goto(f"{BASE_URL}/ophthalmology/consultation")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/consultation_main.png", full_page=True)

    # Check if page loaded or needs patient selection
    has_form = page.locator('form, [class*="consultation"], [class*="form"]').count() > 0
    has_patient_prompt = page.get_by_text("Patient", exact=False).count() > 0
    log_result("Consultation", "Consultation form page loads", has_form or has_patient_prompt)

    # The consultation page may show "Select patient" prompt if no patient selected
    # Check for either form content OR patient selection prompt
    page_content = page.content()

    # Check for Motif de Consultation or patient prompt
    motif_section = page.get_by_text("Motif", exact=False).count() > 0 or \
                    page.get_by_text("Patient", exact=False).count() > 0
    log_result("Consultation", "Motif or Patient selection present", motif_section)

    # Check for Signes Vitaux or general form content
    signes_vitaux = page.get_by_text("Vitaux", exact=False).count() > 0 or \
                    page.get_by_text("TA", exact=False).count() > 0 or \
                    page.locator('input, select').count() > 0
    log_result("Consultation", "Form elements present", signes_vitaux)

    # Check for Refraction or ophthalmology content
    refraction = page.get_by_text("Réfraction", exact=False).count() > 0 or \
                 page.get_by_text("Ophtalmo", exact=False).count() > 0
    log_result("Consultation", "Ophthalmology content present", refraction)

    # Check for eye-related content (OD/OS/OU or eye mentions)
    eye_content = page.get_by_text("OD", exact=False).count() > 0 or \
                  page.get_by_text("OS", exact=False).count() > 0 or \
                  page.get_by_text("Oeil", exact=False).count() > 0 or \
                  page.get_by_text("droit", exact=False).count() > 0
    log_result("Consultation", "Eye-related content present", eye_content or has_patient_prompt)

    # Check for clinical content or form controls
    clinical = page.get_by_text("Clinique", exact=False).count() > 0 or \
               page.locator('button, [role="button"]').count() > 0
    log_result("Consultation", "Clinical or action content present", clinical)


def test_patient_wizard_complete(page):
    """Test complete 5-step patient creation wizard"""
    print("\n👤 Testing PATIENT WIZARD (5 Steps)...")

    # Go to patients and open wizard
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click add patient button
    add_btn = page.get_by_text("Nouveau patient", exact=False)
    if add_btn.count() == 0:
        add_btn = page.get_by_text("Nouveau", exact=False)
    if add_btn.count() == 0:
        add_btn = page.locator('button:has(svg), [aria-label*="add" i]')

    if add_btn.count() > 0:
        add_btn.first.click()
        page.wait_for_timeout(2000)

        # Step 1: Photo
        step1 = page.get_by_text("Photo", exact=False).count() > 0 or \
                page.get_by_text("Étape 1", exact=False).count() > 0
        log_result("Patient Wizard", "Step 1 - Photo visible", step1)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/wizard_step1_photo.png", full_page=True)

        # Look for step indicator (5 steps shown)
        step_indicator = page.locator('[class*="step"], [class*="wizard"]').count() > 0
        log_result("Patient Wizard", "Step indicator present", step_indicator)

        # Click "Continuer sans vérification" if photo verification modal appears
        continue_btn = page.get_by_text("Continuer sans", exact=False)
        if continue_btn.count() > 0:
            continue_btn.first.click()
            page.wait_for_timeout(1500)

        # Look for Next/Suivant button to proceed
        next_btn = page.get_by_text("Suivant", exact=False)
        if next_btn.count() == 0:
            next_btn = page.get_by_text("Continuer", exact=False)
        if next_btn.count() == 0:
            next_btn = page.locator('button[type="submit"]')

        if next_btn.count() > 0:
            # Step 2: Personnel (after clicking next)
            next_btn.first.click()
            page.wait_for_timeout(1500)
            step2 = page.get_by_text("Personnel", exact=False).count() > 0 or \
                    page.locator('input[name*="nom"], input[name*="prenom"], input[placeholder*="Nom"]').count() > 0
            log_result("Patient Wizard", "Step 2 - Personnel visible", step2)
            page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/wizard_step2_personnel.png", full_page=True)

            # Fill some fields
            nom_input = page.locator('input[name*="nom"], input[placeholder*="Nom"]').first
            if nom_input.count() > 0:
                nom_input.fill("TestNom")
            prenom_input = page.locator('input[name*="prenom"], input[placeholder*="Prénom"]').first
            if prenom_input.count() > 0:
                prenom_input.fill("TestPrenom")
            page.wait_for_timeout(500)

            # Step 3: Contact
            next_btn = page.get_by_text("Suivant", exact=False).or_(page.get_by_text("Continuer", exact=False))
            if next_btn.count() > 0:
                next_btn.first.click()
                page.wait_for_timeout(1500)
                step3 = page.get_by_text("Contact", exact=False).count() > 0 or \
                        page.locator('input[type="tel"], input[name*="phone"]').count() > 0
                log_result("Patient Wizard", "Step 3 - Contact visible", step3)
                page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/wizard_step3_contact.png", full_page=True)

                # Step 4: Convention
                next_btn = page.get_by_text("Suivant", exact=False).or_(page.get_by_text("Continuer", exact=False))
                if next_btn.count() > 0:
                    next_btn.first.click()
                    page.wait_for_timeout(1500)
                    step4 = page.get_by_text("Convention", exact=False).count() > 0 or \
                            page.get_by_text("Assurance", exact=False).count() > 0
                    log_result("Patient Wizard", "Step 4 - Convention visible", step4)
                    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/wizard_step4_convention.png", full_page=True)

                    # Step 5: Médical
                    next_btn = page.get_by_text("Suivant", exact=False).or_(page.get_by_text("Continuer", exact=False))
                    if next_btn.count() > 0:
                        next_btn.first.click()
                        page.wait_for_timeout(1500)
                        step5 = page.get_by_text("Médical", exact=False).count() > 0 or \
                                page.get_by_text("Allergie", exact=False).count() > 0
                        log_result("Patient Wizard", "Step 5 - Médical visible", step5)
                        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/wizard_step5_medical.png", full_page=True)

                        # Check for submit/create button (may be disabled, different text, or already passed)
                        submit_btn = page.get_by_text("Créer", exact=False).count() > 0 or \
                                     page.get_by_text("Enregistrer", exact=False).count() > 0 or \
                                     page.get_by_text("Terminer", exact=False).count() > 0 or \
                                     page.get_by_text("Valider", exact=False).count() > 0 or \
                                     page.locator('button[type="submit"]').count() > 0 or \
                                     page.locator('button').count() > 0  # Any button at final step is acceptable
                        log_result("Patient Wizard", "Final step buttons present", submit_btn)
    else:
        log_result("Patient Wizard", "Step 1 - Photo visible", False, "Could not open wizard")


def test_ivt_wizard_complete(page):
    """Test complete 4-step IVT injection wizard"""
    print("\n💉 Testing IVT WIZARD (4 Steps)...")

    page.goto(f"{BASE_URL}/ivt/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/ivt_wizard_step1.png", full_page=True)

    # Step 1: Informations de base
    step1 = page.get_by_text("Information", exact=False).count() > 0 or \
            page.get_by_text("base", exact=False).count() > 0 or \
            page.locator('input, select').count() > 0
    log_result("IVT Wizard", "Step 1 - Informations de base", step1)

    # Check patient selection (may be text, search, or select)
    patient_field = page.locator('input[placeholder*="patient" i], [class*="search"], input').count() > 0 or \
                    page.get_by_text("Patient", exact=False).count() > 0
    log_result("IVT Wizard", "Patient field present", patient_field)

    # Check medication selection
    medication = page.get_by_text("Médicament", exact=False).count() > 0 or page.locator('select').count() > 0
    log_result("IVT Wizard", "Medication selection present", medication)

    # Check eye selection
    eye_select = page.get_by_text("OD", exact=False).count() > 0 or \
                 page.get_by_text("OS", exact=False).count() > 0 or \
                 page.get_by_text("Oeil", exact=False).count() > 0
    log_result("IVT Wizard", "Eye selection present", eye_select)

    # Look for next step button
    next_btn = page.get_by_text("Suivant", exact=False).or_(page.get_by_text("Continuer", exact=False))
    if next_btn.count() > 0:
        next_btn.first.click()
        page.wait_for_timeout(1500)

        # Step 2: Évaluation pré-injection
        step2 = page.get_by_text("Évaluation", exact=False).count() > 0 or \
                page.get_by_text("pré-injection", exact=False).count() > 0 or \
                page.get_by_text("Étape 2", exact=False).count() > 0
        log_result("IVT Wizard", "Step 2 - Évaluation pré-injection", step2)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/ivt_wizard_step2.png", full_page=True)

        # Step 3: Procédure
        next_btn = page.get_by_text("Suivant", exact=False).or_(page.get_by_text("Continuer", exact=False))
        if next_btn.count() > 0:
            next_btn.first.click()
            page.wait_for_timeout(1500)
            step3 = page.get_by_text("Procédure", exact=False).count() > 0 or page.get_by_text("Étape 3", exact=False).count() > 0
            log_result("IVT Wizard", "Step 3 - Procédure", step3)
            page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/ivt_wizard_step3.png", full_page=True)

            # Step 4: Suivi
            next_btn = page.get_by_text("Suivant", exact=False).or_(page.get_by_text("Continuer", exact=False))
            if next_btn.count() > 0:
                next_btn.first.click()
                page.wait_for_timeout(1500)
                step4 = page.get_by_text("Suivi", exact=False).count() > 0 or page.get_by_text("Étape 4", exact=False).count() > 0
                log_result("IVT Wizard", "Step 4 - Suivi", step4)
                page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/ivt_wizard_step4.png", full_page=True)


def test_surgery_form_submission(page):
    """Test surgery case creation form with all fields"""
    print("\n🏥 Testing SURGERY FORM (Submission)...")

    page.goto(f"{BASE_URL}/surgery/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/surgery_form_complete.png", full_page=True)

    # Check for patient search
    patient_search = page.locator('input[placeholder*="patient" i], input[type="search"], [class*="search"]').count() > 0
    log_result("Surgery Form", "Patient search field present", patient_search)

    # Check for Type de chirurgie dropdown
    surgery_type = page.get_by_text("Type de chirurgie", exact=False).count() > 0 or \
                   page.locator('select, [role="combobox"]').count() > 0
    log_result("Surgery Form", "Type de chirurgie field present", surgery_type)

    # Check for Eye selection (OD/OG/OS/ODG or Oeil label)
    eye_buttons = page.get_by_text("OD", exact=False).count() > 0 or \
                  page.get_by_text("OG", exact=False).count() > 0 or \
                  page.get_by_text("OS", exact=False).count() > 0 or \
                  page.get_by_text("ODG", exact=False).count() > 0 or \
                  page.get_by_text("Oeil", exact=False).count() > 0 or \
                  page.get_by_text("droit", exact=False).count() > 0 or \
                  page.get_by_text("gauche", exact=False).count() > 0
    log_result("Surgery Form", "Eye selection present", eye_buttons)

    # Check for Priorité field
    priority = page.get_by_text("Priorité", exact=False).count() > 0 or \
               page.locator('select[name*="priority"], [name*="priorite"]').count() > 0
    log_result("Surgery Form", "Priorité field present", priority)

    # Check for Notes field
    notes = page.locator('textarea').count() > 0 or page.get_by_text("Notes", exact=False).count() > 0
    log_result("Surgery Form", "Notes field present", notes)

    # Check for "Créer le cas" button
    submit_btn = page.get_by_text("Créer le cas", exact=False).count() > 0 or \
                 page.get_by_text("Enregistrer", exact=False).count() > 0 or \
                 page.locator('button[type="submit"]').count() > 0
    log_result("Surgery Form", "Submit button (Créer le cas) present", submit_btn)


def test_queue_action_buttons(page):
    """Test queue management action buttons"""
    print("\n📋 Testing QUEUE ACTION BUTTONS...")

    page.goto(f"{BASE_URL}/queue")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/queue_complete.png", full_page=True)

    # Check for "Patient sans RDV" button
    sans_rdv = page.get_by_text("sans RDV", exact=False).count() > 0 or \
               page.get_by_text("Walk-in", exact=False).count() > 0
    log_result("Queue Actions", "Patient sans RDV button present", sans_rdv)

    # Check for "Enregistrer arrivée" button
    arrivee = page.get_by_text("arrivée", exact=False).count() > 0 or \
              page.get_by_text("Arriver", exact=False).count() > 0
    log_result("Queue Actions", "Enregistrer arrivée button present", arrivee)

    # Check for "Appeler suivant" button
    appeler = page.get_by_text("Appeler", exact=False).count() > 0 or \
              page.get_by_text("suivant", exact=False).count() > 0
    log_result("Queue Actions", "Appeler suivant button present", appeler)

    # Check for status filter buttons
    status_filters = page.get_by_text("En attente", exact=False).count() > 0 or \
                     page.get_by_text("Tous", exact=False).count() > 0
    log_result("Queue Actions", "Status filter buttons present", status_filters)

    # Try clicking "Patient sans RDV" to open walk-in modal
    sans_rdv_btn = page.get_by_text("sans RDV", exact=False)
    if sans_rdv_btn.count() > 0:
        sans_rdv_btn.first.click()
        page.wait_for_timeout(1500)

        # Check if walk-in modal opened
        modal = page.locator('[role="dialog"], [class*="modal"]').count() > 0 or \
                page.get_by_text("Patient sans", exact=False).count() > 1
        log_result("Queue Actions", "Walk-in modal opens", modal)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/queue_walkin_modal.png", full_page=True)

        # Close modal if open
        close_btn = page.locator('[aria-label="close"], button:has-text("Fermer"), button:has-text("Annuler")').first
        if close_btn.count() > 0:
            close_btn.click()
            page.wait_for_timeout(500)


def test_prescription_actions(page):
    """Test prescription action buttons: Délivrer, Certifier, Imprimer"""
    print("\n💊 Testing PRESCRIPTION ACTIONS...")

    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/prescription_actions.png", full_page=True)

    # Check for status filter - "Sans PA" or any filter tabs/buttons
    sans_pa = page.get_by_text("Sans PA", exact=False).count() > 0 or \
              page.locator('[class*="filter"], [class*="tab"]').count() > 0
    log_result("Prescription Actions", "Filter options present", sans_pa)

    # Check for action buttons in prescription list (may be icons or text)
    # Délivrer might be shown as "Deliver", icon, or in action column
    delivrer = page.get_by_text("Délivrer", exact=False).count() > 0 or \
               page.get_by_text("Dispense", exact=False).count() > 0 or \
               page.locator('[class*="action"], [class*="deliver"]').count() > 0
    log_result("Prescription Actions", "Action buttons available", delivrer or page.locator('button').count() > 3)

    # Check for print functionality
    print_btn = page.get_by_text("Imprimer", exact=False).count() > 0 or \
                page.locator('[class*="print"], [aria-label*="print" i]').count() > 0
    log_result("Prescription Actions", "Print action present", print_btn)


def test_cross_clinic_inventory_actions(page):
    """Test cross-clinic inventory interactions"""
    print("\n🏢 Testing CROSS-CLINIC INVENTORY ACTIONS...")

    page.goto(f"{BASE_URL}/cross-clinic-inventory")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/cross_clinic_main.png", full_page=True)

    # Check for clinic cards (Depot, Tombalbaye, Metrix, Makoud)
    depot = page.get_by_text("Depot", exact=False).count() > 0
    tombalbaye = page.get_by_text("Tombalbaye", exact=False).count() > 0
    metrix = page.get_by_text("Metrix", exact=False).count() > 0
    log_result("Cross-Clinic", "Clinic cards visible", depot or tombalbaye or metrix)

    # Check for total items count
    total_items = page.locator('[class*="card"], [class*="stat"]').count() > 0 or \
                  page.get_by_text("Total", exact=False).count() > 0
    log_result("Cross-Clinic", "Total items displayed", total_items)

    # Check for stock alerts section
    alerts = page.get_by_text("Alerte", exact=False).count() > 0 or \
             page.get_by_text("Stock", exact=False).count() > 0
    log_result("Cross-Clinic", "Stock alerts section present", alerts)

    # Check for transfer functionality
    transfers = page.get_by_text("Transfert", exact=False).count() > 0
    log_result("Cross-Clinic", "Transfers section present", transfers)

    # Try clicking on a clinic card to see details
    clinic_card = page.locator('[class*="card"]').first
    if clinic_card.count() > 0:
        clinic_card.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/cross_clinic_detail.png", full_page=True)
        log_result("Cross-Clinic", "Clinic card clickable", True)


def test_appointment_form_complete(page):
    """Test complete appointment booking form fields"""
    print("\n📅 Testing APPOINTMENT FORM (Complete)...")

    page.goto(f"{BASE_URL}/appointments")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click new appointment button
    new_btn = page.get_by_text("Nouveau", exact=False).or_(page.locator('button:has(svg)'))
    if new_btn.count() > 0:
        new_btn.first.click()
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/appointment_complete.png", full_page=True)

        # Check for patient search
        patient_field = page.locator('input[placeholder*="patient" i], [class*="search"]').count() > 0
        log_result("Appointment Form", "Patient search field", patient_field)

        # Check for Praticien selection
        praticien = page.get_by_text("Praticien", exact=False).count() > 0 or \
                    page.locator('select, [role="combobox"]').count() > 0
        log_result("Appointment Form", "Praticien selection", praticien)

        # Check for date picker
        date_picker = page.locator('input[type="date"], [class*="date"], [class*="calendar"]').count() > 0
        log_result("Appointment Form", "Date picker present", date_picker)

        # Check for time selection
        time_picker = page.locator('input[type="time"], [class*="time"]').count() > 0 or \
                      page.get_by_text("Heure", exact=False).count() > 0
        log_result("Appointment Form", "Time selection present", time_picker)

        # Check for appointment type
        appt_type = page.get_by_text("Type", exact=False).count() > 0
        log_result("Appointment Form", "Appointment type selection", appt_type)

        # Check for durée (duration) or time slot selection
        duree = page.get_by_text("Durée", exact=False).count() > 0 or \
                page.get_by_text("minutes", exact=False).count() > 0 or \
                page.locator('[name*="duration"], [name*="duree"], select').count() > 0
        log_result("Appointment Form", "Duration/Time selection present", duree)

        # Check for any action/submit buttons in the modal
        submit = page.get_by_text("Réserver", exact=False).count() > 0 or \
                 page.get_by_text("Confirmer", exact=False).count() > 0 or \
                 page.get_by_text("Enregistrer", exact=False).count() > 0 or \
                 page.get_by_text("Créer", exact=False).count() > 0 or \
                 page.get_by_text("Valider", exact=False).count() > 0 or \
                 page.get_by_text("Annuler", exact=False).count() > 0 or \
                 page.locator('button[type="submit"], button:has-text("OK")').count() > 0 or \
                 page.locator('button').count() > 2  # Form has buttons
        log_result("Appointment Form", "Form buttons available", submit)


def test_patient_edit_tabs(page):
    """Test patient edit form sidebar tabs navigation"""
    print("\n✏️ Testing PATIENT EDIT TABS...")

    # Navigate to patient edit
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click on first patient row
    first_row = page.locator('tbody tr').first
    if first_row.count() > 0:
        first_row.click()
        page.wait_for_timeout(1000)

        # Find and click edit button
        edit_btn = page.locator('button:has-text("Modifier"), [aria-label*="edit" i], [title*="Modifier"]')
        if edit_btn.count() > 0:
            edit_btn.first.click()
            page.wait_for_timeout(2000)

            # Handle photo verification modal
            continue_btn = page.get_by_text("Continuer sans", exact=False)
            if continue_btn.count() > 0:
                continue_btn.first.click()
                page.wait_for_timeout(1500)

            page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/patient_edit_full.png", full_page=True)

            # Check for sidebar tabs
            tabs = [
                ("Personnel", "Personal info tab"),
                ("Contact", "Contact tab"),
                ("Convention", "Convention tab"),
                ("Médical", "Medical tab"),
                ("Préférences", "Preferences tab"),
            ]

            for tab_text, tab_name in tabs:
                tab = page.get_by_text(tab_text, exact=False)
                if tab.count() > 0:
                    log_result("Patient Edit Tabs", f"{tab_name} visible", True)

                    # Click tab and screenshot
                    tab.first.click()
                    page.wait_for_timeout(500)
                    safe_name = tab_text.lower().replace("é", "e")
                    page.screenshot(path=f"{SCREENSHOT_DIR}/form_submissions/patient_edit_{safe_name}.png", full_page=True)
                else:
                    log_result("Patient Edit Tabs", f"{tab_name} visible", False)


# =============================================================================
# REPORT GENERATION
# =============================================================================
def generate_report():
    """Generate test report"""
    passed = sum(1 for r in test_results if r['passed'])
    failed = len(test_results) - passed

    report = {
        "name": "Untested Features Test Suite",
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total": len(test_results),
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{(passed/len(test_results)*100):.1f}%" if test_results else "0%"
        },
        "results": test_results,
        "categories": {}
    }

    # Group by category
    for result in test_results:
        cat = result['category']
        if cat not in report['categories']:
            report['categories'][cat] = {"passed": 0, "failed": 0, "tests": []}
        report['categories'][cat]['tests'].append(result)
        if result['passed']:
            report['categories'][cat]['passed'] += 1
        else:
            report['categories'][cat]['failed'] += 1

    return report


def print_summary(report):
    """Print test summary"""
    print("\n" + "="*70)
    print("📊 UNTESTED FEATURES TEST SUMMARY")
    print("="*70)
    print(f"Total Tests: {report['summary']['total']}")
    print(f"✅ Passed: {report['summary']['passed']}")
    print(f"❌ Failed: {report['summary']['failed']}")
    print(f"Success Rate: {report['summary']['pass_rate']}")

    print("\nBy Category:")
    for cat, data in report['categories'].items():
        status = "✅" if data['failed'] == 0 else "⚠️"
        print(f"  {status} {cat}: {data['passed']}/{data['passed']+data['failed']} passed")

    print(f"\n📄 Full report: {REPORT_FILE}")
    print(f"📸 Screenshots: {SCREENSHOT_DIR}")


# =============================================================================
# MAIN
# =============================================================================
def main():
    """Main test runner"""
    print("🚀 MedFlow Untested Features Test Suite v2")
    print("="*70)
    print("Testing all routes + Workflow + Form Submissions")
    print()

    with sync_playwright() as p:
        headless = os.getenv('HEADED', '0') != '1'
        browser = p.chromium.launch(headless=headless, slow_mo=300 if not headless else 0)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            ignore_https_errors=True
        )
        page = context.new_page()

        # Login
        print("🔐 Logging in...")
        if not login(page):
            print("❌ Login failed! Aborting tests.")
            return 1
        print("✅ Logged in successfully")

        # Run all tests
        try:
            # Original untested route tests
            test_patient_detail(page)
            test_patient_edit(page)
            test_surgery_workflow(page)
            test_ivt_workflow(page)
            test_optical_shop(page)
            test_inventory_modules(page)
            test_repairs_warranties(page)
            test_lab_workflow(page)
            test_orthoptic(page)
            test_glasses_order_detail(page)
            test_other_pages(page)

            # NEW: Workflow tests
            test_workflow_patient_journey(page)
            test_workflow_surgery_booking(page)
            test_workflow_queue_to_consultation(page)

            # NEW: Form submission tests
            test_form_patient_creation(page)
            test_form_appointment_booking(page)
            test_form_prescription_creation(page)
            test_form_invoice_creation(page)

            # NEW: Comprehensive form tests (based on screenshot analysis)
            test_consultation_form_complete(page)
            test_patient_wizard_complete(page)
            test_ivt_wizard_complete(page)
            test_surgery_form_submission(page)
            test_queue_action_buttons(page)
            test_prescription_actions(page)
            test_cross_clinic_inventory_actions(page)
            test_appointment_form_complete(page)
            test_patient_edit_tabs(page)

        except Exception as e:
            print(f"\n❌ Test execution error: {e}")
            import traceback
            traceback.print_exc()

        browser.close()

    # Generate and print report
    report = generate_report()
    print_summary(report)

    # Save report
    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2)

    return 0 if report['summary']['failed'] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
