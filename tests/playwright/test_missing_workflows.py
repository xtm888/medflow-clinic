#!/usr/bin/env python3
"""
MedFlow Missing Workflows Test Suite
Tests all workflows identified as untested in gap analysis
"""

import os
import json
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

# Configuration
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "screenshots/missing"
REPORT_FILE = "missing_workflows_report.json"

# Test users for role-based testing (from config/defaults.js)
# Password: MedFlow$ecure1 (default) - can be overridden by DEFAULT_ADMIN_PASSWORD env
DEMO_PASSWORD = "MedFlow$ecure1"

# Demo credentials from Login.jsx
DEMO_ROLES = {
    "Administrateur": "admin@medflow.com",
    "Médecin": "doctor@medflow.com",
    "Ophtalmologue": "ophthalmologist@medflow.com",
    "Infirmier(ère)": "nurse@medflow.com",
    "Pharmacien(ne)": "pharmacist@medflow.com",
    "Réceptionniste": "reception@medflow.com"
}

# Results tracking
results = {
    "timestamp": datetime.now().isoformat(),
    "phases": {},
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "screenshots": []
}

def setup_dirs():
    """Create screenshot directories"""
    dirs = [
        f"{SCREENSHOT_DIR}/roles",
        f"{SCREENSHOT_DIR}/pdf",
        f"{SCREENSHOT_DIR}/devices",
        f"{SCREENSHOT_DIR}/surgery",
        f"{SCREENSHOT_DIR}/glasses",
        f"{SCREENSHOT_DIR}/lab",
        f"{SCREENSHOT_DIR}/templates",
        f"{SCREENSHOT_DIR}/portal",
        f"{SCREENSHOT_DIR}/advanced"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

def log_result(phase, test_name, passed, details=""):
    """Log test result"""
    results["total_tests"] += 1
    if passed:
        results["passed"] += 1
        print(f"  [PASS] {test_name}")
    else:
        results["failed"] += 1
        print(f"  [FAIL] {test_name}")
        if details:
            print(f"         {details[:100]}")

    if phase not in results["phases"]:
        results["phases"][phase] = {"passed": 0, "failed": 0, "tests": []}

    results["phases"][phase]["tests"].append({
        "name": test_name,
        "passed": passed,
        "details": details
    })
    if passed:
        results["phases"][phase]["passed"] += 1
    else:
        results["phases"][phase]["failed"] += 1

def screenshot(page, name, phase="general"):
    """Take and log screenshot"""
    path = f"{SCREENSHOT_DIR}/{phase}/{name}.png"
    page.screenshot(path=path, full_page=True)
    results["screenshots"].append(path)
    return path

def login(page, role="Administrateur"):
    """Login to the application using demo credentials"""
    try:
        # Clear storage and cookies for a fresh session
        page.context.clear_cookies()

        # Navigate to login page with force reload
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Get email for this role from DEMO_ROLES mapping
        email = DEMO_ROLES.get(role, "admin@medflow.com")

        # Wait for email field to be visible and fill it
        email_field = page.locator('#email')
        email_field.wait_for(state="visible", timeout=10000)
        email_field.fill(email)
        page.wait_for_timeout(300)

        # Fill password field with the default password
        password_field = page.locator('#password')
        password_field.fill(DEMO_PASSWORD)
        page.wait_for_timeout(300)

        # Click login button with explicit timeout
        login_btn = page.locator('button[type="submit"]').first
        login_btn.wait_for(state="visible", timeout=10000)
        login_btn.click()

        try:
            page.wait_for_url("**/home", timeout=15000)
            return True
        except:
            # Take diagnostic screenshot on failure
            safe_role = role.replace('/', '_').replace('(', '').replace(')', '')
            page.screenshot(path=f"{SCREENSHOT_DIR}/login_failed_{safe_role}.png")
            page.wait_for_timeout(2000)
            return "/login" not in page.url
    except Exception as e:
        safe_role = role.replace('/', '_').replace('(', '').replace(')', '')
        page.screenshot(path=f"{SCREENSHOT_DIR}/login_error_{safe_role}.png")
        print(f"    Login error for {role}: {str(e)[:80]}")
        return False

# =============================================================================
# PHASE 1: ROLE-BASED ACCESS TESTING
# =============================================================================
def test_role_based_access(page):
    """Test role-based access control for all demo roles"""
    print("\n" + "="*70)
    print("PHASE 1: ROLE-BASED ACCESS TESTING")
    print("="*70)

    # All demo roles from login page (must match DEMO_ROLES keys exactly)
    demo_roles = [
        ("Administrateur", "admin"),
        ("Médecin", "doctor"),
        ("Ophtalmologue", "ophthalmologist"),
        ("Infirmier(ère)", "nurse"),
        ("Pharmacien(ne)", "pharmacist"),
        ("Réceptionniste", "receptionist")
    ]

    # Pages to test access for each role
    test_pages = [
        ("/dashboard", "Dashboard"),
        ("/patients", "Patients"),
        ("/queue", "Queue"),
        ("/appointments", "Appointments"),
        ("/invoicing", "Invoicing"),
        ("/pharmacy", "Pharmacy"),
        ("/laboratory", "Laboratory"),
        ("/users", "User Management"),
        ("/settings", "Settings"),
        ("/audit", "Audit Trail"),
    ]

    for role_name, role_code in demo_roles:
        print(f"\n[{role_name} Role]")

        if login(page, role_name):
            log_result("Roles", f"{role_name} login", True)
            screenshot(page, f"{role_code}_dashboard", "roles")

            # Test which pages this role can access
            for route, page_name in test_pages[:5]:  # Test first 5 pages per role
                page.goto(f"{BASE_URL}{route}")
                page.wait_for_timeout(1500)

                # Check if page loaded vs redirected
                if route in page.url:
                    log_result("Roles", f"{role_name} -> {page_name}", True)
                else:
                    log_result("Roles", f"{role_name} -> {page_name}", False, "No access")

            # Screenshot after testing
            screenshot(page, f"{role_code}_final", "roles")

            # Logout for next role (go to login page)
            page.goto(f"{BASE_URL}/login")
            page.wait_for_timeout(1000)
        else:
            log_result("Roles", f"{role_name} login", False)
            screenshot(page, f"{role_code}_login_fail", "roles")

# =============================================================================
# PHASE 2: PDF DOCUMENT GENERATION
# =============================================================================
def test_pdf_generation(page):
    """Test PDF document generation"""
    print("\n" + "="*70)
    print("PHASE 2: PDF DOCUMENT GENERATION")
    print("="*70)

    login(page)

    # Test 1: Invoice PDF
    print("\n[Invoice PDF]")
    page.goto(f"{BASE_URL}/invoicing")
    page.wait_for_timeout(2000)
    screenshot(page, "invoice_list", "pdf")

    # Find an invoice to print
    print_btn = page.locator('button:has-text("Imprimer")').first
    if print_btn.count() > 0:
        log_result("PDF", "Invoice print button found", True)
        try:
            # Set up to capture new page/download
            with page.context.expect_page() as new_page_info:
                print_btn.click()
                page.wait_for_timeout(3000)

            new_page = new_page_info.value
            new_page.wait_for_load_state()
            screenshot(new_page, "invoice_pdf_preview", "pdf")
            log_result("PDF", "Invoice PDF opens", True)
            new_page.close()
        except Exception as e:
            # Try alternative - check if print dialog opens
            page.wait_for_timeout(2000)
            screenshot(page, "invoice_after_print_click", "pdf")
            log_result("PDF", "Invoice PDF opens", False, str(e)[:100])
    else:
        log_result("PDF", "Invoice print button found", False)

    # Test 2: Prescription PDF
    print("\n[Prescription PDF]")
    page.goto(f"{BASE_URL}/prescriptions")
    page.wait_for_timeout(2000)
    screenshot(page, "prescription_list", "pdf")

    print_btn = page.locator('button:has-text("Imprimer")').first
    if print_btn.count() > 0:
        log_result("PDF", "Prescription print button found", True)
        try:
            print_btn.click()
            page.wait_for_timeout(2000)
            screenshot(page, "prescription_after_print", "pdf")
            log_result("PDF", "Prescription print clicked", True)
        except Exception as e:
            log_result("PDF", "Prescription print clicked", False, str(e))
    else:
        log_result("PDF", "Prescription print button found", False)

    # Test 3: Patient document generation
    print("\n[Patient Documents]")
    page.goto(f"{BASE_URL}/patients")
    page.wait_for_timeout(2000)

    # Try to navigate to a patient detail
    view_btn = page.locator('button:has-text("Voir"), a:has-text("Voir")').first
    if view_btn.count() > 0:
        view_btn.click()
        page.wait_for_timeout(2000)
        screenshot(page, "patient_detail_for_docs", "pdf")

        # Look for document buttons
        doc_buttons = [
            ("Ordonnance Lunettes", "glasses_prescription"),
            ("Ordonnance Médicale", "medical_prescription"),
            ("Certificat", "certificate"),
            ("Fiche", "exam_sheet")
        ]

        for btn_text, name in doc_buttons:
            btn = page.locator(f'button:has-text("{btn_text}")').first
            if btn.count() > 0:
                log_result("PDF", f"{btn_text} button found", True)
                try:
                    btn.click()
                    page.wait_for_timeout(2000)
                    screenshot(page, f"patient_{name}_clicked", "pdf")
                    log_result("PDF", f"{btn_text} clicked", True)
                    # Go back if navigated
                    if "patients" not in page.url:
                        page.go_back()
                        page.wait_for_timeout(1000)
                except Exception as e:
                    log_result("PDF", f"{btn_text} clicked", False, str(e))
            else:
                log_result("PDF", f"{btn_text} button found", False)

# =============================================================================
# PHASE 3: DEVICE DATA IMPORT
# =============================================================================
def test_device_import(page):
    """Test device data import workflows"""
    print("\n" + "="*70)
    print("PHASE 3: DEVICE DATA IMPORT")
    print("="*70)

    login(page)

    # Test 1: Device Discovery
    print("\n[Device Discovery]")
    page.goto(f"{BASE_URL}/devices/discovery")
    page.wait_for_timeout(2000)
    screenshot(page, "discovery_page", "devices")

    # Check if discovery page loaded
    if "discovery" in page.url or page.locator('text="Découverte"').count() > 0:
        log_result("Devices", "Discovery page loads", True)

        # Look for scan button
        scan_btn = page.locator('button:has-text("Scan"), button:has-text("Découvrir"), button:has-text("Rechercher")').first
        if scan_btn.count() > 0:
            log_result("Devices", "Scan button found", True)
            try:
                scan_btn.click()
                page.wait_for_timeout(5000)  # Network scan takes time
                screenshot(page, "discovery_results", "devices")
                log_result("Devices", "Discovery scan executed", True)
            except Exception as e:
                log_result("Devices", "Discovery scan executed", False, str(e))
        else:
            log_result("Devices", "Scan button found", False)
    else:
        log_result("Devices", "Discovery page loads", False)

    # Test 2: Device Manager
    print("\n[Device Manager]")
    page.goto(f"{BASE_URL}/devices")
    page.wait_for_timeout(2000)
    screenshot(page, "device_manager", "devices")

    # Check for device list
    device_cards = page.locator('[class*="device"], [class*="card"]').all()
    log_result("Devices", "Device list visible", len(device_cards) > 0, f"Found {len(device_cards)} devices")

    # Look for add device button
    add_btn = page.locator('button:has-text("Ajouter"), button:has-text("Nouveau")').first
    if add_btn.count() > 0:
        log_result("Devices", "Add device button found", True)
        try:
            add_btn.click()
            page.wait_for_timeout(1500)
            screenshot(page, "add_device_form", "devices")
            log_result("Devices", "Add device form opens", True)
        except Exception as e:
            log_result("Devices", "Add device form opens", False, str(e))

    # Test 3: Auto-sync status
    print("\n[Auto-Sync Status]")
    # Check for sync status indicators on device page
    sync_status = page.get_by_text("Sync").or_(page.get_by_text("Synchronisation")).or_(page.locator('[class*="sync"]'))
    if sync_status.count() > 0:
        log_result("Devices", "Sync status visible", True)
        screenshot(page, "sync_status", "devices")
    else:
        log_result("Devices", "Sync status visible", False)

# =============================================================================
# PHASE 4: SURGERY COMPLETE WORKFLOW
# =============================================================================
def test_surgery_workflow(page):
    """Test complete surgery workflow"""
    print("\n" + "="*70)
    print("PHASE 4: SURGERY COMPLETE WORKFLOW")
    print("="*70)

    login(page)

    # Test 1: Surgery Dashboard
    print("\n[Surgery Dashboard]")
    page.goto(f"{BASE_URL}/surgery")
    page.wait_for_timeout(2000)
    screenshot(page, "surgery_dashboard", "surgery")

    if "surgery" in page.url:
        log_result("Surgery", "Dashboard loads", True)

        # Check for surgery cases
        cases = page.locator('tbody tr, [class*="case"], [class*="card"]').all()
        log_result("Surgery", "Surgery cases visible", len(cases) > 0, f"Found {len(cases)} cases")
    else:
        log_result("Surgery", "Dashboard loads", False)

    # Test 2: New Surgery Case
    print("\n[New Surgery Case]")
    page.goto(f"{BASE_URL}/surgery/new")
    page.wait_for_timeout(2000)
    screenshot(page, "new_surgery_form", "surgery")

    if "surgery" in page.url and "new" in page.url:
        log_result("Surgery", "New case form loads", True)

        # Check for form fields
        form_fields = ["Patient", "Procédure", "Date", "Chirurgien", "Anesthésie"]
        for field in form_fields:
            # Use Playwright text selector syntax
            elem = page.locator(f'label:has-text("{field}")').or_(page.get_by_text(field))
            if elem.count() > 0:
                log_result("Surgery", f"Form field: {field}", True)
            else:
                log_result("Surgery", f"Form field: {field}", False)
    else:
        log_result("Surgery", "New case form loads", False)

    # Test 3: Surgery Check-in (if cases exist)
    print("\n[Surgery Check-in]")
    page.goto(f"{BASE_URL}/surgery")
    page.wait_for_timeout(1500)

    checkin_btn = page.locator('button:has-text("Check-in"), button:has-text("Enregistrer")').first
    if checkin_btn.count() > 0:
        log_result("Surgery", "Check-in button found", True)
        try:
            checkin_btn.click()
            page.wait_for_timeout(2000)
            screenshot(page, "surgery_checkin", "surgery")
            log_result("Surgery", "Check-in form opens", True)
        except Exception as e:
            log_result("Surgery", "Check-in form opens", False, str(e))
    else:
        log_result("Surgery", "Check-in button found", False, "No pending surgeries")

# =============================================================================
# PHASE 5: GLASSES ORDER DELIVERY
# =============================================================================
def test_glasses_delivery(page):
    """Test glasses order delivery workflow"""
    print("\n" + "="*70)
    print("PHASE 5: GLASSES ORDER DELIVERY WORKFLOW")
    print("="*70)

    login(page)

    # Test 1: Glasses Orders List
    print("\n[Glasses Orders]")
    page.goto(f"{BASE_URL}/glasses-orders")
    page.wait_for_timeout(2000)
    screenshot(page, "glasses_orders_list", "glasses")

    if "glasses" in page.url:
        log_result("Glasses", "Orders page loads", True)

        # Test filter tabs
        tabs = ["Toutes", "Contrôle Qualité", "Prêts à retirer"]
        for tab in tabs:
            tab_elem = page.locator(f'button:has-text("{tab}"), [role="tab"]:has-text("{tab}")').first
            if tab_elem.count() > 0:
                tab_elem.click()
                page.wait_for_timeout(1000)
                screenshot(page, f"glasses_tab_{tab.lower().replace(' ', '_')}", "glasses")
                log_result("Glasses", f"Tab: {tab}", True)
            else:
                log_result("Glasses", f"Tab: {tab}", False)
    else:
        log_result("Glasses", "Orders page loads", False)

    # Test 2: Order Detail
    print("\n[Order Detail]")
    view_btn = page.locator('button:has-text("Voir"), button:has-text("Détails")').first
    if view_btn.count() > 0:
        view_btn.click()
        page.wait_for_timeout(2000)
        screenshot(page, "glasses_order_detail", "glasses")
        log_result("Glasses", "Order detail opens", True)

        # Look for delivery/QC buttons
        action_btns = ["Livrer", "Contrôle", "Approuver", "Rejeter"]
        for btn_text in action_btns:
            btn = page.locator(f'button:has-text("{btn_text}")')
            if btn.count() > 0:
                log_result("Glasses", f"Action button: {btn_text}", True)
    else:
        log_result("Glasses", "Order detail opens", False, "No orders to view")

# =============================================================================
# PHASE 6: LABORATORY ADVANCED FEATURES
# =============================================================================
def test_lab_advanced(page):
    """Test laboratory advanced features"""
    print("\n" + "="*70)
    print("PHASE 6: LABORATORY ADVANCED FEATURES")
    print("="*70)

    login(page)

    # Test 1: Lab Worklist
    print("\n[Lab Worklist]")
    page.goto(f"{BASE_URL}/lab-worklist")
    page.wait_for_timeout(2000)
    screenshot(page, "lab_worklist", "lab")

    if "lab" in page.url or "worklist" in page.url:
        log_result("Lab", "Worklist page loads", True)
    else:
        # Try alternative
        page.goto(f"{BASE_URL}/laboratory")
        page.wait_for_timeout(2000)
        worklist_tab = page.get_by_text("Worklist").or_(page.get_by_text("Liste de travail"))
        if worklist_tab.count() > 0:
            worklist_tab.first.click()
            page.wait_for_timeout(1500)
            screenshot(page, "lab_worklist_tab", "lab")
            log_result("Lab", "Worklist page loads", True)
        else:
            log_result("Lab", "Worklist page loads", False)

    # Test 2: Lab Configuration
    print("\n[Lab Configuration]")
    page.goto(f"{BASE_URL}/laboratory/config")
    page.wait_for_timeout(2000)
    screenshot(page, "lab_config", "lab")

    if "config" in page.url or "configuration" in page.url:
        log_result("Lab", "Config page loads", True)

        # Look for configuration sections
        config_sections = ["Analyseurs", "Tests", "Références", "QC"]
        for section in config_sections:
            elem = page.locator(f'text="{section}"')
            if elem.count() > 0:
                log_result("Lab", f"Config section: {section}", True)
    else:
        log_result("Lab", "Config page loads", False)

    # Test 3: Lab Check-in
    print("\n[Lab Check-in]")
    page.goto(f"{BASE_URL}/lab-checkin")
    page.wait_for_timeout(2000)
    screenshot(page, "lab_checkin", "lab")

    if "checkin" in page.url:
        log_result("Lab", "Check-in page loads", True)
    else:
        log_result("Lab", "Check-in page loads", False)

    # Test 4: Reagent Inventory
    print("\n[Reagent Inventory]")
    page.goto(f"{BASE_URL}/reagent-inventory")
    page.wait_for_timeout(2000)
    screenshot(page, "reagent_inventory", "lab")

    if "reagent" in page.url:
        log_result("Lab", "Reagent inventory loads", True)

        # Check for lot tracking
        lot_info = page.get_by_text("Lot").or_(page.get_by_text("Expiration"))
        log_result("Lab", "Lot tracking visible", lot_info.count() > 0)
    else:
        log_result("Lab", "Reagent inventory loads", False)

# =============================================================================
# PHASE 7: TEMPLATE SYSTEM
# =============================================================================
def test_templates(page):
    """Test template system"""
    print("\n" + "="*70)
    print("PHASE 7: TEMPLATE SYSTEM")
    print("="*70)

    login(page)

    # Test 1: Template List
    print("\n[Template List]")
    page.goto(f"{BASE_URL}/templates")
    page.wait_for_timeout(2000)
    screenshot(page, "template_list", "templates")

    # Check for errors
    error_elem = page.get_by_text("Error").or_(page.get_by_text("Erreur")).or_(page.locator('[class*="error"]'))
    if error_elem.count() > 0:
        log_result("Templates", "Template list loads", False, "Error on page")
        screenshot(page, "template_error", "templates")
    elif "templates" in page.url:
        log_result("Templates", "Template list loads", True)

        # Look for template items
        templates = page.locator('[class*="template"], [class*="card"], tbody tr').all()
        log_result("Templates", "Templates visible", len(templates) > 0, f"Found {len(templates)}")
    else:
        log_result("Templates", "Template list loads", False)

    # Test 2: Template Builder
    print("\n[Template Builder]")
    page.goto(f"{BASE_URL}/templates/new")
    page.wait_for_timeout(2000)
    screenshot(page, "template_builder", "templates")

    if "new" in page.url or "builder" in page.url:
        log_result("Templates", "Builder page loads", True)

        # Check for builder elements
        builder_elements = ["Type", "Nom", "Contenu", "Champs"]
        for elem_name in builder_elements:
            elem = page.locator(f'label:has-text("{elem_name}")').or_(page.get_by_text(elem_name))
            if elem.count() > 0:
                log_result("Templates", f"Builder has: {elem_name}", True)
    else:
        log_result("Templates", "Builder page loads", False)

# =============================================================================
# PHASE 8: ADDITIONAL FEATURES
# =============================================================================
def test_additional_features(page):
    """Test additional untested features"""
    print("\n" + "="*70)
    print("PHASE 8: ADDITIONAL UNTESTED FEATURES")
    print("="*70)

    login(page)

    # Test 1: Clinical Alerts
    print("\n[Clinical Alerts]")
    page.goto(f"{BASE_URL}/alerts")
    page.wait_for_timeout(2000)
    screenshot(page, "clinical_alerts", "advanced")

    if "alerts" in page.url:
        log_result("Advanced", "Alerts page loads", True)

        # Check for alert types
        alert_items = page.locator('[class*="alert"], [class*="warning"], tbody tr').all()
        log_result("Advanced", "Alerts visible", len(alert_items) > 0, f"Found {len(alert_items)}")
    else:
        log_result("Advanced", "Alerts page loads", False)

    # Test 2: Notifications
    print("\n[Notifications]")
    page.goto(f"{BASE_URL}/notifications")
    page.wait_for_timeout(2000)
    screenshot(page, "notifications", "advanced")

    if "notifications" in page.url:
        log_result("Advanced", "Notifications page loads", True)
    else:
        log_result("Advanced", "Notifications page loads", False)

    # Test 3: External Facilities
    print("\n[External Facilities]")
    page.goto(f"{BASE_URL}/external-facilities")
    page.wait_for_timeout(2000)
    screenshot(page, "external_facilities", "advanced")

    if "facilities" in page.url or "external" in page.url:
        log_result("Advanced", "External facilities page loads", True)
    else:
        log_result("Advanced", "External facilities page loads", False)

    # Test 4: Backup Management
    print("\n[Backup Management]")
    page.goto(f"{BASE_URL}/backups")
    page.wait_for_timeout(2000)
    screenshot(page, "backup_management", "advanced")

    if "backup" in page.url:
        log_result("Advanced", "Backup page loads", True)

        # Check for backup controls
        backup_btn = page.locator('button:has-text("Backup"), button:has-text("Sauvegarder")')
        log_result("Advanced", "Backup button found", backup_btn.count() > 0)
    else:
        log_result("Advanced", "Backup page loads", False)

    # Test 5: Fiscal Year
    print("\n[Fiscal Year]")
    page.goto(f"{BASE_URL}/fiscal-year")
    page.wait_for_timeout(2000)
    screenshot(page, "fiscal_year", "advanced")

    if "fiscal" in page.url:
        log_result("Advanced", "Fiscal year page loads", True)
    else:
        log_result("Advanced", "Fiscal year page loads", False)

    # Test 6: Drug Safety
    print("\n[Drug Safety]")
    page.goto(f"{BASE_URL}/drug-safety")
    page.wait_for_timeout(2000)
    screenshot(page, "drug_safety", "advanced")

    if "drug" in page.url or "safety" in page.url:
        log_result("Advanced", "Drug safety page loads", True)
    else:
        # Try via pharmacy
        page.goto(f"{BASE_URL}/pharmacy")
        page.wait_for_timeout(1500)
        safety_tab = page.get_by_text("Sécurité").or_(page.get_by_text("Safety")).or_(page.get_by_text("Interactions"))
        if safety_tab.count() > 0:
            safety_tab.first.click()
            page.wait_for_timeout(1500)
            screenshot(page, "drug_safety_from_pharmacy", "advanced")
            log_result("Advanced", "Drug safety page loads", True)
        else:
            log_result("Advanced", "Drug safety page loads", False)

# =============================================================================
# PATIENT PORTAL TESTING
# =============================================================================
def test_patient_portal(page):
    """Test patient portal features"""
    print("\n" + "="*70)
    print("PHASE 9: PATIENT PORTAL")
    print("="*70)

    # Test portal pages (no login required for public pages)
    portal_pages = [
        ("/patient/login", "Portal Login"),
        ("/book", "Public Booking"),
        ("/display-board", "Display Board"),
    ]

    for route, name in portal_pages:
        page.goto(f"{BASE_URL}{route}")
        page.wait_for_timeout(2000)
        screenshot(page, name.lower().replace(" ", "_"), "portal")

        if route.split("/")[-1] in page.url or page.url.endswith(route):
            log_result("Portal", f"{name} loads", True)
        else:
            log_result("Portal", f"{name} loads", False, f"Redirected to {page.url}")

# =============================================================================
# MAIN EXECUTION
# =============================================================================
def main():
    print("="*70)
    print("MEDFLOW MISSING WORKFLOWS TEST SUITE")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base URL: {BASE_URL}")
    print(f"Screenshots: {SCREENSHOT_DIR}/")

    setup_dirs()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=os.environ.get("HEADED", "0") != "1"
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()

        try:
            # Run all test phases
            test_role_based_access(page)
            test_pdf_generation(page)
            test_device_import(page)
            test_surgery_workflow(page)
            test_glasses_delivery(page)
            test_lab_advanced(page)
            test_templates(page)
            test_additional_features(page)
            test_patient_portal(page)

        except Exception as e:
            print(f"\n[ERROR] Test suite failed: {e}")
            screenshot(page, "error_state", "general")

        finally:
            browser.close()

    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Total Tests: {results['total_tests']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Pass Rate: {results['passed']/max(results['total_tests'],1)*100:.1f}%")
    print(f"Screenshots: {len(results['screenshots'])}")

    print("\nBy Phase:")
    for phase, data in results["phases"].items():
        total = data["passed"] + data["failed"]
        print(f"  {phase}: {data['passed']}/{total} passed")

    # Save report
    with open(REPORT_FILE, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nReport saved: {REPORT_FILE}")

if __name__ == "__main__":
    main()
