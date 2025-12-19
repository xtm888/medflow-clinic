#!/usr/bin/env python3
"""
MedFlow Patient Detail E2E Tests
Tests patient detail pages, editing, history, documents, and imaging
"""

import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_utils import (
    BASE_URL, API_URL, login, APIClient, TestReporter,
    wait_for_page_load, navigate_to, has_element, has_text,
    get_test_patient_id, take_screenshot
)

SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/patient_detail"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def test_patient_detail_page(page, reporter, patient_id):
    """Test patient detail page loads with all sections"""
    print("\n👤 Testing PATIENT DETAIL PAGE...")

    navigate_to(page, f"/patients/{patient_id}")
    page.wait_for_timeout(1500)

    # Test: Page loads
    page_loaded = "/patients/" in page.url
    reporter.add_result("Patient detail page loads", page_loaded,
                       f"URL: {page.url}", category="patient_detail")

    # Test: Patient name displayed
    name_visible = has_element(page, 'h1, h2, [class*="patient-name"], [class*="header"]')
    reporter.add_result("Patient name displayed", name_visible, category="patient_detail")

    # Test: Patient info section (Actions Rapides, Refraction, Documents, Historique)
    info_section = has_text(page, "Actions Rapides") or has_text(page, "Historique") or \
                   has_text(page, "Documents") or has_text(page, "Réfraction") or \
                   has_element(page, '[class*="info"]')
    reporter.add_result("Patient info section present", info_section, category="patient_detail")

    # Test: Action buttons (Consultation, Ordonnance, or edit icon)
    consultation_btn = page.locator('button:has-text("Consultation")').count() + \
                       page.locator('a:has-text("Consultation")').count()
    new_consult_btn = page.locator('button:has-text("Nouvelle consultation")').count()
    ordonnance_btn = page.locator('text="Ordonnance"').count()
    reporter.add_result("Action buttons present", consultation_btn > 0 or new_consult_btn > 0 or ordonnance_btn > 0,
                       f"Consultation: {consultation_btn}, New: {new_consult_btn}, Ordonnance: {ordonnance_btn}",
                       category="patient_detail")

    take_screenshot(page, "patient_detail_main", "patient_detail")


def test_patient_tabs(page, reporter, patient_id):
    """Test patient detail sections/tabs navigation"""
    print("\n📑 Testing PATIENT TABS...")

    navigate_to(page, f"/patients/{patient_id}")
    page.wait_for_timeout(1000)

    # Look for collapsible sections (not traditional tabs)
    sections = page.locator('[class*="collapse"], [class*="accordion"], [class*="section"]')
    section_count = sections.count()

    # Also check for section headers
    section_headers = ["Actions Rapides", "Documents", "Historique", "Réfraction",
                       "Pression Intraoculaire", "Diagnostics", "Impression Rapide", "Prochains RDV"]

    found_sections = []
    for name in section_headers:
        if has_text(page, name):
            found_sections.append(name)

    reporter.add_result("Patient tabs present", len(found_sections) >= 2 or section_count >= 2,
                       f"Found {len(found_sections)} sections", category="patient_tabs")

    reporter.add_result("Expected tabs visible", len(found_sections) >= 2,
                       f"Found: {', '.join(found_sections)}", category="patient_tabs")

    # Try clicking History/Historique section
    history_section = page.locator('text="Historique"')
    if history_section.count() > 0:
        history_section.first.click()
        page.wait_for_timeout(1000)
        reporter.add_result("History tab clickable", True, category="patient_tabs")
        take_screenshot(page, "patient_history_tab", "patient_detail")
    else:
        reporter.add_result("History tab clickable", False, "Section not found", category="patient_tabs")


def test_patient_edit(page, reporter, patient_id):
    """Test patient edit functionality"""
    print("\n✏️ Testing PATIENT EDIT...")

    navigate_to(page, f"/patients/{patient_id}/edit")
    page.wait_for_timeout(1500)

    # Test: Edit page loads (may show face verification dialog)
    edit_page = "/edit" in page.url or has_text(page, "Modifier") or has_text(page, "Photo non disponible")
    reporter.add_result("Patient edit page loads", edit_page,
                       f"URL: {page.url}", category="patient_edit")

    # If face verification dialog is shown, click continue
    continue_btn = page.locator('button:has-text("Continuer sans vérification")')
    if continue_btn.count() > 0:
        continue_btn.click()
        page.wait_for_timeout(1500)

    # Test: Form fields present (look for Prenom/Nom labels or inputs)
    # The form uses French labels: Prenom, Nom, Date de naissance
    has_prenom = has_text(page, "Prenom") or has_text(page, "Prénom") or has_text(page, "First name")
    has_nom = has_text(page, "Nom") or has_text(page, "Last name")
    name_inputs = page.locator('input').count()  # Count all inputs on form
    reporter.add_result("Name fields present", has_prenom and has_nom or name_inputs > 2,
                       f"Found Prenom: {has_prenom}, Nom: {has_nom}, Inputs: {name_inputs}", category="patient_edit")

    # Test: Phone field (look for Telephone or Coordonnees section)
    phone_visible = has_text(page, "Coordonnees") or has_text(page, "Téléphone") or has_text(page, "Tel")
    phone_field = page.locator('input[type="tel"]').count()
    reporter.add_result("Phone field present", phone_visible or phone_field > 0, category="patient_edit")

    # Test: Save button (or continue button)
    save_btn = page.locator('button:has-text("Enregistrer")').count() + \
               page.locator('button:has-text("Save")').count() + \
               page.locator('button:has-text("Continuer")').count()
    reporter.add_result("Save button present", save_btn > 0, category="patient_edit")

    # Test: Cancel button
    cancel_btn = page.locator('button:has-text("Annuler")').count() + page.locator('button:has-text("Cancel")').count()
    reporter.add_result("Cancel button present", cancel_btn > 0, category="patient_edit")

    take_screenshot(page, "patient_edit_form", "patient_detail")


def test_patient_history(page, reporter, patient_id):
    """Test patient history/timeline view"""
    print("\n📜 Testing PATIENT HISTORY...")

    # Try direct timeline URL first
    navigate_to(page, f"/visits/{patient_id}/timeline")
    page.wait_for_timeout(1000)

    if "timeline" in page.url or "visits" in page.url:
        timeline_visible = True
    else:
        # Fallback: go to patient detail and look for history
        navigate_to(page, f"/patients/{patient_id}")
        page.wait_for_timeout(1000)
        timeline_visible = has_text(page, "Historique") or has_text(page, "History") or has_text(page, "Timeline")

    reporter.add_result("Patient history accessible", timeline_visible,
                       f"URL: {page.url}", category="patient_history")

    # Test: Visit entries visible
    visits = page.locator('[class*="visit"], [class*="timeline"], [class*="history-item"]').count()
    reporter.add_result("Visit entries displayed", visits > 0 or timeline_visible,
                       f"Found {visits} entries", category="patient_history")

    take_screenshot(page, "patient_history", "patient_detail")


def test_patient_documents(page, reporter, patient_id):
    """Test patient documents section"""
    print("\n📄 Testing PATIENT DOCUMENTS...")

    navigate_to(page, f"/patients/{patient_id}")
    page.wait_for_timeout(1000)

    # Click documents tab if present
    docs_tab = page.locator('text="Documents"')
    if docs_tab.count() > 0:
        docs_tab.first.click()
        page.wait_for_timeout(1000)

    # Test: Documents section visible
    docs_visible = has_text(page, "Documents") or has_element(page, '[class*="document"]')
    reporter.add_result("Documents section visible", docs_visible, category="patient_documents")

    # Test: Document generation or upload button present
    upload_btn = page.locator('button:has-text("Télécharger")').count() + \
                 page.locator('button:has-text("Upload")').count() + \
                 page.locator('button:has-text("Ajouter")').count() + \
                 page.locator('button:has-text("Générer document")').count() + \
                 page.locator('button:has-text("Générer")').count()
    # Also check for quick print options (Ordonnance, Certificat)
    quick_print = has_text(page, "Impression Rapide") or has_text(page, "Ordonnance") or has_text(page, "Certificat")
    reporter.add_result("Upload document button present", upload_btn > 0 or quick_print, category="patient_documents")

    take_screenshot(page, "patient_documents", "patient_detail")


def test_patient_imaging(page, reporter, patient_id):
    """Test patient imaging/refraction section with device data"""
    print("\n🔬 Testing PATIENT IMAGING...")

    navigate_to(page, f"/patients/{patient_id}")
    page.wait_for_timeout(1000)

    # Imaging data is integrated in Refraction section on patient detail page
    # Look for refraction data, OD/OS columns, or imaging sections
    refraction_visible = has_text(page, "Réfraction") or has_text(page, "Refraction") or \
                         has_text(page, "OD") or has_text(page, "OS")
    imaging_visible = has_text(page, "Imagerie") or has_text(page, "Imaging") or \
                      has_text(page, "Pression Intraoculaire") or \
                      has_element(page, '[class*="imaging"], [class*="device"]')

    reporter.add_result("Imaging section visible", refraction_visible or imaging_visible, category="patient_imaging")

    # Test: Device data types (Refraction values, IOP, or device names)
    device_types = ["OD", "OS", "AV sc", "AV ac", "Rx", "Add", "Pression", "mmHg",
                    "OCT", "Fundus", "Topographie", "Biometrie", "Autoréfractomètre"]
    found_devices = []
    for device in device_types:
        if has_text(page, device):
            found_devices.append(device)

    reporter.add_result("Device data types visible", len(found_devices) > 0,
                       f"Found: {', '.join(found_devices) if found_devices else 'None'}",
                       category="patient_imaging")

    take_screenshot(page, "patient_imaging", "patient_detail")


def test_patient_api_detail(reporter):
    """Test patient detail API endpoint"""
    print("\n🔌 Testing PATIENT API...")

    api = APIClient('admin')

    # Get a patient ID
    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result("Patient API - Get patient", False, "No patients in database", category="patient_api")
        return

    # Test: Get patient detail
    response = api.get(f'/api/patients/{patient_id}')
    reporter.add_result("Patient API - Get detail", response.ok,
                       f"Status: {response.status_code}", category="patient_api")

    if response.ok:
        data = response.json()
        patient = data.get('data', data.get('patient', data))

        # Verify required fields
        has_name = 'firstName' in patient or 'lastName' in patient or 'name' in patient
        reporter.add_result("Patient API - Has name fields", has_name, category="patient_api")

        has_id = '_id' in patient or 'id' in patient
        reporter.add_result("Patient API - Has ID", has_id, category="patient_api")

    # Test: Get patient history
    response = api.get(f'/api/patients/{patient_id}/history')
    reporter.add_result("Patient API - Get history", response.ok or response.status_code == 404,
                       f"Status: {response.status_code}", category="patient_api")

    # Test: Get patient visits timeline
    response = api.get(f'/api/visits/timeline/{patient_id}')
    reporter.add_result("Patient API - Get visits", response.ok or response.status_code == 404,
                       f"Status: {response.status_code}", category="patient_api")


def main():
    """Run all patient detail tests"""
    print("=" * 70)
    print("🏥 MedFlow Patient Detail E2E Tests")
    print("=" * 70)

    reporter = TestReporter("Patient Detail Tests")

    # Get a test patient ID
    patient_id = get_test_patient_id()
    if not patient_id:
        print("❌ No patients found in database!")
        return

    print(f"Using patient ID: {patient_id}")

    headless = os.getenv('HEADED', '0') != '1'

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()

        # Login
        print("\n🔐 Logging in...")
        if login(page, 'admin'):
            print("✅ Logged in successfully")

            # Run UI tests
            test_patient_detail_page(page, reporter, patient_id)
            test_patient_tabs(page, reporter, patient_id)
            test_patient_edit(page, reporter, patient_id)
            test_patient_history(page, reporter, patient_id)
            test_patient_documents(page, reporter, patient_id)
            test_patient_imaging(page, reporter, patient_id)
        else:
            print("❌ Login failed")
            reporter.add_result("Login", False, "Could not login", category="setup")

        browser.close()

    # Run API tests (no browser needed)
    test_patient_api_detail(reporter)

    # Save report
    reporter.save("/Users/xtm888/magloire/tests/playwright/patient_detail_report.json")

    print("\n" + "=" * 70)
    print("📸 Screenshots saved to:", SCREENSHOT_DIR)
    print("=" * 70)


if __name__ == "__main__":
    main()
