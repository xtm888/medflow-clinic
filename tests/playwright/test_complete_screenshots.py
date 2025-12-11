#!/usr/bin/env python3
"""
MedFlow Complete Screenshot & Testing Suite
Captures EVERY page, section, modal, tab, and interactive element
"""

import json
import os
import sys
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

# Configuration
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/Users/xtm888/magloire/tests/playwright/screenshots/complete"
REPORT_FILE = "/Users/xtm888/magloire/tests/playwright/complete_screenshot_report.json"
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Create directories
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Results collector
results = {
    "pages": [],
    "modals": [],
    "tabs": [],
    "forms": [],
    "errors": [],
    "summary": {}
}

def safe_screenshot(page, name, full_page=True):
    """Take screenshot safely with error handling"""
    try:
        filepath = f"{SCREENSHOT_DIR}/{name}.png"
        page.screenshot(path=filepath, full_page=full_page)
        return filepath
    except Exception as e:
        print(f"    ⚠️ Screenshot failed: {e}")
        return None

def wait_and_capture(page, name, wait_time=1000):
    """Wait for page to load and capture screenshot"""
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except:
        pass
    page.wait_for_timeout(wait_time)
    return safe_screenshot(page, name)

def capture_page_info(page):
    """Capture detailed page information"""
    info = {
        "url": page.url,
        "title": page.title(),
        "buttons": page.locator('button').count(),
        "inputs": page.locator('input').count(),
        "selects": page.locator('select').count(),
        "tables": page.locator('table').count(),
        "forms": page.locator('form').count(),
        "modals": page.locator('[role="dialog"], .modal, [class*="modal"]').count(),
        "tabs": page.locator('[role="tab"]').count(),
        "cards": page.locator('[class*="card"]').count(),
    }
    return info


# =============================================================================
# COMPLETE PAGE LIST - All 80+ routes
# =============================================================================
COMPLETE_PAGES = {
    # =========================================================================
    # PUBLIC PAGES (No Auth Required)
    # =========================================================================
    "public": [
        {"path": "/login", "name": "login", "desc": "Login Page"},
        {"path": "/book", "name": "public_booking", "desc": "Public Booking"},
        {"path": "/booking/confirmation", "name": "booking_confirmation", "desc": "Booking Confirmation"},
        {"path": "/display-board", "name": "display_board", "desc": "Queue Display Board"},
    ],

    # =========================================================================
    # HOME & DASHBOARD
    # =========================================================================
    "home": [
        {"path": "/home", "name": "home_dashboard", "desc": "Home Dashboard (Navigation Launcher)"},
        {"path": "/dashboard", "name": "main_dashboard", "desc": "Main Dashboard"},
    ],

    # =========================================================================
    # PATIENT MANAGEMENT
    # =========================================================================
    "patients": [
        {"path": "/patients", "name": "patients_list", "desc": "Patients List"},
    ],

    # =========================================================================
    # QUEUE MANAGEMENT
    # =========================================================================
    "queue": [
        {"path": "/queue", "name": "queue", "desc": "Queue Management"},
        {"path": "/queue/analytics", "name": "queue_analytics", "desc": "Queue Analytics"},
    ],

    # =========================================================================
    # APPOINTMENTS
    # =========================================================================
    "appointments": [
        {"path": "/appointments", "name": "appointments", "desc": "Appointments Calendar"},
    ],

    # =========================================================================
    # PRESCRIPTIONS
    # =========================================================================
    "prescriptions": [
        {"path": "/prescriptions", "name": "prescriptions", "desc": "Prescriptions"},
        {"path": "/prescription-queue", "name": "prescription_queue", "desc": "Prescription Queue (Pharmacist)"},
    ],

    # =========================================================================
    # IMAGING
    # =========================================================================
    "imaging": [
        {"path": "/imaging", "name": "imaging", "desc": "Imaging"},
    ],

    # =========================================================================
    # NOTIFICATIONS & ALERTS
    # =========================================================================
    "notifications": [
        {"path": "/notifications", "name": "notifications", "desc": "Notifications"},
        {"path": "/alerts", "name": "alerts", "desc": "Alert Dashboard"},
    ],

    # =========================================================================
    # FINANCIAL
    # =========================================================================
    "financial": [
        {"path": "/financial", "name": "financial", "desc": "Financial Dashboard"},
        {"path": "/invoicing", "name": "invoicing", "desc": "Invoicing"},
        {"path": "/services", "name": "services", "desc": "Services"},
    ],

    # =========================================================================
    # LABORATORY
    # =========================================================================
    "laboratory": [
        {"path": "/laboratory", "name": "laboratory", "desc": "Laboratory Dashboard"},
        {"path": "/laboratory/config", "name": "lab_config", "desc": "Lab Configuration"},
        {"path": "/lab-worklist", "name": "lab_worklist", "desc": "Lab Tech Worklist"},
        {"path": "/lab-checkin", "name": "lab_checkin", "desc": "Lab Check-in"},
    ],

    # =========================================================================
    # OPHTHALMOLOGY
    # =========================================================================
    "ophthalmology": [
        {"path": "/ophthalmology", "name": "ophthalmology", "desc": "Ophthalmology Dashboard"},
        {"path": "/ophthalmology/consultation", "name": "ophthalmology_consultation", "desc": "New Consultation"},
    ],

    # =========================================================================
    # GLASSES ORDERS
    # =========================================================================
    "glasses": [
        {"path": "/glasses-orders", "name": "glasses_orders", "desc": "Glasses Orders List"},
    ],

    # =========================================================================
    # IVT (Intravitreal Injections)
    # =========================================================================
    "ivt": [
        {"path": "/ivt", "name": "ivt_dashboard", "desc": "IVT Dashboard"},
        {"path": "/ivt/new", "name": "ivt_new", "desc": "New IVT Injection"},
    ],

    # =========================================================================
    # SURGERY
    # =========================================================================
    "surgery": [
        {"path": "/surgery", "name": "surgery_dashboard", "desc": "Surgery Dashboard"},
    ],

    # =========================================================================
    # PHARMACY
    # =========================================================================
    "pharmacy": [
        {"path": "/pharmacy", "name": "pharmacy_dashboard", "desc": "Pharmacy Dashboard"},
        {"path": "/pharmacy/new", "name": "pharmacy_new", "desc": "New Medication"},
    ],

    # =========================================================================
    # DEVICE INTEGRATION
    # =========================================================================
    "devices": [
        {"path": "/devices", "name": "devices_list", "desc": "Device Manager"},
        {"path": "/devices/status", "name": "devices_status", "desc": "Device Status Dashboard"},
        {"path": "/devices/discovery", "name": "devices_discovery", "desc": "Network Discovery"},
    ],

    # =========================================================================
    # OCR IMPORT
    # =========================================================================
    "ocr": [
        {"path": "/ocr/import", "name": "ocr_import", "desc": "Import Wizard"},
        {"path": "/ocr/review", "name": "ocr_review", "desc": "OCR Review Queue"},
    ],

    # =========================================================================
    # ORTHOPTIC
    # =========================================================================
    "orthoptic": [
        {"path": "/orthoptic", "name": "orthoptic_exams", "desc": "Orthoptic Exams"},
        {"path": "/orthoptic/new", "name": "orthoptic_new", "desc": "New Orthoptic Exam"},
    ],

    # =========================================================================
    # NURSING
    # =========================================================================
    "nursing": [
        {"path": "/nurse-vitals", "name": "nurse_vitals", "desc": "Nurse Vitals Entry"},
    ],

    # =========================================================================
    # ADMIN
    # =========================================================================
    "admin": [
        {"path": "/audit", "name": "audit_trail", "desc": "Audit Trail"},
        {"path": "/users", "name": "user_management", "desc": "User Management"},
        {"path": "/backups", "name": "backup_management", "desc": "Backup Management"},
        {"path": "/settings", "name": "settings", "desc": "Settings"},
    ],

    # =========================================================================
    # PROCUREMENT
    # =========================================================================
    "procurement": [
        {"path": "/purchase-orders", "name": "purchase_orders", "desc": "Purchase Orders"},
        {"path": "/stock-reconciliation", "name": "stock_reconciliation", "desc": "Stock Reconciliation"},
        {"path": "/warranties", "name": "warranties", "desc": "Warranty Management"},
        {"path": "/repairs", "name": "repairs", "desc": "Repair Tracking"},
    ],

    # =========================================================================
    # ANALYTICS & TEMPLATES
    # =========================================================================
    "analytics": [
        {"path": "/analytics", "name": "analytics_dashboard", "desc": "Analytics Dashboard"},
        {"path": "/templates", "name": "templates", "desc": "Template Manager"},
    ],

    # =========================================================================
    # VISITS
    # =========================================================================
    "visits": [
        {"path": "/visits", "name": "visits_dashboard", "desc": "Visit Dashboard"},
    ],

    # =========================================================================
    # COMPANIES & APPROVALS
    # =========================================================================
    "companies": [
        {"path": "/companies", "name": "companies", "desc": "Companies"},
        {"path": "/approvals", "name": "approvals", "desc": "Approvals"},
    ],

    # =========================================================================
    # OPTICAL INVENTORY
    # =========================================================================
    "optical_inventory": [
        {"path": "/frame-inventory", "name": "frame_inventory", "desc": "Frame Inventory"},
        {"path": "/contact-lens-inventory", "name": "contact_lens_inventory", "desc": "Contact Lens Inventory"},
        {"path": "/optical-lens-inventory", "name": "optical_lens_inventory", "desc": "Optical Lens Inventory"},
    ],

    # =========================================================================
    # OPTICAL SHOP
    # =========================================================================
    "optical_shop": [
        {"path": "/optical-shop", "name": "optical_shop_dashboard", "desc": "Optical Shop Dashboard"},
        {"path": "/optical-shop/verification", "name": "optical_shop_verification", "desc": "Technician Verification"},
        {"path": "/optical-shop/external-orders", "name": "optical_shop_external", "desc": "External Orders"},
        {"path": "/optical-shop/performance", "name": "optical_shop_performance", "desc": "Optician Performance"},
    ],

    # =========================================================================
    # LAB INVENTORY
    # =========================================================================
    "lab_inventory": [
        {"path": "/reagent-inventory", "name": "reagent_inventory", "desc": "Reagent Inventory"},
        {"path": "/lab-consumable-inventory", "name": "lab_consumable_inventory", "desc": "Lab Consumable Inventory"},
    ],

    # =========================================================================
    # CROSS-CLINIC
    # =========================================================================
    "cross_clinic": [
        {"path": "/cross-clinic-inventory", "name": "cross_clinic_inventory", "desc": "Cross-Clinic Inventory"},
        {"path": "/cross-clinic-dashboard", "name": "cross_clinic_dashboard", "desc": "Cross-Clinic Dashboard"},
        {"path": "/consolidated-reports", "name": "consolidated_reports", "desc": "Consolidated Reports"},
    ],

    # =========================================================================
    # EXTERNAL FACILITIES & DISPATCH
    # =========================================================================
    "external": [
        {"path": "/external-facilities", "name": "external_facilities", "desc": "External Facilities"},
        {"path": "/dispatch-dashboard", "name": "dispatch_dashboard", "desc": "Dispatch Dashboard"},
    ],

    # =========================================================================
    # DOCUMENTS
    # =========================================================================
    "documents": [
        {"path": "/documents", "name": "document_generation", "desc": "Document Generation"},
    ],
}


def login(page):
    """Login to the application"""
    print("🔐 Logging in...")
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    # Capture login page
    safe_screenshot(page, "00_login_page")

    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)

    # Capture filled login form
    safe_screenshot(page, "00_login_filled")

    page.locator('button[type="submit"]').click()

    try:
        page.wait_for_url("**/home", timeout=15000)
        print("✅ Logged in successfully")
        return True
    except Exception as e:
        print(f"❌ Login failed: {e}")
        safe_screenshot(page, "00_login_failed")
        return False


def capture_all_pages(page):
    """Capture screenshots of all pages"""
    print("\n" + "="*70)
    print("📸 CAPTURING ALL PAGES")
    print("="*70)

    total_pages = sum(len(pages) for pages in COMPLETE_PAGES.values())
    captured = 0

    for category, pages in COMPLETE_PAGES.items():
        print(f"\n📁 Category: {category.upper()}")

        # Create category directory
        cat_dir = f"{SCREENSHOT_DIR}/{category}"
        os.makedirs(cat_dir, exist_ok=True)

        for page_info in pages:
            captured += 1
            path = page_info["path"]
            name = page_info["name"]
            desc = page_info["desc"]

            print(f"  [{captured}/{total_pages}] {desc}...", end=" ")

            try:
                # Skip public pages if already logged in (except specific ones)
                if category == "public" and path not in ["/login"]:
                    # Create new context for public pages
                    pass

                page.goto(f"{BASE_URL}{path}")
                page.wait_for_load_state("networkidle", timeout=15000)
                page.wait_for_timeout(1000)

                # Capture page info
                info = capture_page_info(page)

                # Take screenshot
                screenshot_path = f"{cat_dir}/{name}.png"
                page.screenshot(path=screenshot_path, full_page=True)

                # Take viewport screenshot
                viewport_path = f"{cat_dir}/{name}_viewport.png"
                page.screenshot(path=viewport_path, full_page=False)

                results["pages"].append({
                    "category": category,
                    "name": name,
                    "description": desc,
                    "path": path,
                    "url": page.url,
                    "screenshot": screenshot_path,
                    "viewport_screenshot": viewport_path,
                    "info": info,
                    "status": "success"
                })

                print(f"✅ ({info['buttons']} btns, {info['inputs']} inputs)")

            except Exception as e:
                print(f"❌ Error: {str(e)[:50]}")
                results["pages"].append({
                    "category": category,
                    "name": name,
                    "description": desc,
                    "path": path,
                    "status": "error",
                    "error": str(e)
                })
                results["errors"].append({
                    "type": "page",
                    "name": name,
                    "error": str(e)
                })


def capture_modals_and_dialogs(page):
    """Capture all modals and dialogs by triggering them"""
    print("\n" + "="*70)
    print("📸 CAPTURING MODALS & DIALOGS")
    print("="*70)

    modal_triggers = [
        # Patients page - New patient wizard
        {
            "page": "/patients",
            "trigger": 'button:has-text("Nouveau patient")',
            "name": "patient_wizard",
            "desc": "Patient Creation Wizard"
        },
        # Appointments - New appointment
        {
            "page": "/appointments",
            "trigger": 'button:has-text("Nouveau")',
            "name": "appointment_modal",
            "desc": "New Appointment Modal"
        },
        # Pharmacy - Add medication
        {
            "page": "/pharmacy",
            "trigger": 'button:has-text("Ajouter")',
            "name": "pharmacy_add_modal",
            "desc": "Add Medication Modal"
        },
        # Queue - Check-in
        {
            "page": "/queue",
            "trigger": 'button:has-text("Enregistrer")',
            "name": "queue_checkin_modal",
            "desc": "Queue Check-in Modal"
        },
        # Invoicing - New invoice
        {
            "page": "/invoicing",
            "trigger": 'button:has-text("Nouvelle")',
            "name": "invoice_modal",
            "desc": "New Invoice Modal"
        },
        # Settings - various modals
        {
            "page": "/settings",
            "trigger": 'button:has-text("Modifier")',
            "name": "settings_edit_modal",
            "desc": "Settings Edit Modal"
        },
    ]

    modal_dir = f"{SCREENSHOT_DIR}/modals"
    os.makedirs(modal_dir, exist_ok=True)

    for modal_info in modal_triggers:
        print(f"  {modal_info['desc']}...", end=" ")

        try:
            page.goto(f"{BASE_URL}{modal_info['page']}")
            page.wait_for_load_state("networkidle", timeout=10000)
            page.wait_for_timeout(500)

            trigger = page.locator(modal_info['trigger'])
            if trigger.count() > 0:
                trigger.first.click()
                page.wait_for_timeout(1000)

                screenshot_path = f"{modal_dir}/{modal_info['name']}.png"
                page.screenshot(path=screenshot_path)

                results["modals"].append({
                    "name": modal_info['name'],
                    "description": modal_info['desc'],
                    "screenshot": screenshot_path,
                    "status": "success"
                })
                print("✅")

                # Close modal (Escape key or close button)
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                print("⚠️ Trigger not found")
                results["modals"].append({
                    "name": modal_info['name'],
                    "description": modal_info['desc'],
                    "status": "trigger_not_found"
                })

        except Exception as e:
            print(f"❌ {str(e)[:40]}")
            results["modals"].append({
                "name": modal_info['name'],
                "description": modal_info['desc'],
                "status": "error",
                "error": str(e)
            })


def capture_tabs_and_sections(page):
    """Capture all tabs within pages"""
    print("\n" + "="*70)
    print("📸 CAPTURING TABS & SECTIONS")
    print("="*70)

    pages_with_tabs = [
        {"page": "/invoicing", "name": "invoicing"},
        {"page": "/laboratory", "name": "laboratory"},
        {"page": "/ivt", "name": "ivt"},
        {"page": "/pharmacy", "name": "pharmacy"},
        {"page": "/financial", "name": "financial"},
        {"page": "/appointments", "name": "appointments"},
        {"page": "/analytics", "name": "analytics"},
    ]

    tabs_dir = f"{SCREENSHOT_DIR}/tabs"
    os.makedirs(tabs_dir, exist_ok=True)

    for page_info in pages_with_tabs:
        print(f"  {page_info['name']}...", end=" ")

        try:
            page.goto(f"{BASE_URL}{page_info['page']}")
            page.wait_for_load_state("networkidle", timeout=10000)
            page.wait_for_timeout(500)

            # Find all tabs
            tabs = page.locator('[role="tab"], button[class*="tab"]')
            tab_count = tabs.count()

            if tab_count > 0:
                print(f"Found {tab_count} tabs")

                for i in range(min(tab_count, 10)):  # Max 10 tabs
                    try:
                        tab = tabs.nth(i)
                        tab_text = tab.text_content()[:20] if tab.text_content() else f"tab_{i}"
                        tab_name = tab_text.replace(" ", "_").replace("/", "_").lower()

                        tab.click()
                        page.wait_for_timeout(500)

                        screenshot_path = f"{tabs_dir}/{page_info['name']}_{i}_{tab_name}.png"
                        page.screenshot(path=screenshot_path)

                        results["tabs"].append({
                            "page": page_info['name'],
                            "tab_index": i,
                            "tab_name": tab_name,
                            "screenshot": screenshot_path,
                            "status": "success"
                        })
                        print(f"    Tab {i}: {tab_text[:15]}... ✅")

                    except Exception as e:
                        print(f"    Tab {i}: ❌ {str(e)[:30]}")
            else:
                print("No tabs found")

        except Exception as e:
            print(f"❌ {str(e)[:40]}")


def capture_patient_wizard_steps(page):
    """Capture all steps of the patient creation wizard"""
    print("\n" + "="*70)
    print("📸 CAPTURING PATIENT WIZARD STEPS")
    print("="*70)

    wizard_dir = f"{SCREENSHOT_DIR}/patient_wizard"
    os.makedirs(wizard_dir, exist_ok=True)

    try:
        page.goto(f"{BASE_URL}/patients")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)

        # Click new patient button
        new_btn = page.locator('button:has-text("Nouveau patient")')
        if new_btn.count() > 0:
            new_btn.click()
            page.wait_for_timeout(1000)

            steps = ["Photo", "Personnel", "Contact", "Convention", "Médical"]

            for i, step in enumerate(steps):
                print(f"  Step {i+1}: {step}...", end=" ")

                screenshot_path = f"{wizard_dir}/step_{i+1}_{step.lower()}.png"
                page.screenshot(path=screenshot_path)

                results["forms"].append({
                    "type": "wizard_step",
                    "name": f"patient_wizard_step_{i+1}",
                    "step": step,
                    "screenshot": screenshot_path,
                    "status": "success"
                })
                print("✅")

                # Click next button if not last step
                if i < len(steps) - 1:
                    next_btn = page.locator('button:has-text("Suivant →")')
                    if next_btn.count() > 0:
                        next_btn.click()
                        page.wait_for_timeout(500)
                    else:
                        next_btn = page.locator('button:has-text("Suivant")')
                        if next_btn.count() > 0:
                            next_btn.last.click()
                            page.wait_for_timeout(500)

    except Exception as e:
        print(f"❌ Error: {str(e)[:50]}")


def capture_responsive_layouts(page):
    """Capture key pages at multiple viewport sizes"""
    print("\n" + "="*70)
    print("📸 CAPTURING RESPONSIVE LAYOUTS")
    print("="*70)

    viewports = [
        {"name": "desktop_full", "width": 1920, "height": 1080},
        {"name": "desktop_standard", "width": 1366, "height": 768},
        {"name": "laptop", "width": 1280, "height": 800},
        {"name": "tablet_landscape", "width": 1024, "height": 768},
        {"name": "tablet_portrait", "width": 768, "height": 1024},
        {"name": "mobile_large", "width": 414, "height": 896},
        {"name": "mobile_medium", "width": 375, "height": 812},
        {"name": "mobile_small", "width": 320, "height": 568},
    ]

    key_pages = [
        "/home",
        "/dashboard",
        "/patients",
        "/queue",
        "/appointments",
        "/pharmacy",
        "/invoicing",
    ]

    responsive_dir = f"{SCREENSHOT_DIR}/responsive"
    os.makedirs(responsive_dir, exist_ok=True)

    for vp in viewports:
        print(f"  Viewport: {vp['name']} ({vp['width']}x{vp['height']})")
        page.set_viewport_size({"width": vp["width"], "height": vp["height"]})

        vp_dir = f"{responsive_dir}/{vp['name']}"
        os.makedirs(vp_dir, exist_ok=True)

        for path in key_pages:
            page_name = path.replace("/", "") or "root"
            print(f"    {page_name}...", end=" ")

            try:
                page.goto(f"{BASE_URL}{path}")
                page.wait_for_load_state("networkidle", timeout=10000)
                page.wait_for_timeout(300)

                screenshot_path = f"{vp_dir}/{page_name}.png"
                page.screenshot(path=screenshot_path, full_page=True)
                print("✅")

            except Exception as e:
                print(f"❌")

    # Reset viewport
    page.set_viewport_size({"width": 1920, "height": 1080})


def capture_sidebar_navigation(page):
    """Capture sidebar navigation and all menu items"""
    print("\n" + "="*70)
    print("📸 CAPTURING SIDEBAR NAVIGATION")
    print("="*70)

    nav_dir = f"{SCREENSHOT_DIR}/navigation"
    os.makedirs(nav_dir, exist_ok=True)

    try:
        page.goto(f"{BASE_URL}/dashboard")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)

        # Full sidebar
        sidebar = page.locator('nav, aside, [class*="sidebar"]')
        if sidebar.count() > 0:
            page.screenshot(path=f"{nav_dir}/sidebar_full.png")
            print("  Sidebar captured ✅")

        # Capture all nav links
        nav_links = page.locator('nav a, [class*="sidebar"] a')
        link_count = nav_links.count()
        print(f"  Found {link_count} navigation links")

        # Hover over menu items to show submenus
        for i in range(min(link_count, 20)):
            try:
                link = nav_links.nth(i)
                link.hover()
                page.wait_for_timeout(200)
            except:
                pass

        page.screenshot(path=f"{nav_dir}/sidebar_expanded.png")

    except Exception as e:
        print(f"❌ Error: {str(e)[:50]}")


def capture_home_dashboard_cards(page):
    """Capture all cards from the home dashboard"""
    print("\n" + "="*70)
    print("📸 CAPTURING HOME DASHBOARD CARDS")
    print("="*70)

    home_dir = f"{SCREENSHOT_DIR}/home_dashboard"
    os.makedirs(home_dir, exist_ok=True)

    try:
        page.goto(f"{BASE_URL}/home")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Full page
        page.screenshot(path=f"{home_dir}/home_full.png", full_page=True)
        print("  Full home dashboard ✅")

        # Individual cards/sections
        cards = page.locator('[class*="card"], [class*="grid"] > div')
        card_count = cards.count()
        print(f"  Found {card_count} cards/sections")

        for i in range(min(card_count, 20)):
            try:
                card = cards.nth(i)
                if card.is_visible():
                    card.screenshot(path=f"{home_dir}/card_{i}.png")
            except:
                pass

    except Exception as e:
        print(f"❌ Error: {str(e)[:50]}")


def generate_report():
    """Generate comprehensive report"""
    print("\n" + "="*70)
    print("📊 GENERATING REPORT")
    print("="*70)

    # Calculate summary
    total_pages = len(results["pages"])
    successful_pages = sum(1 for p in results["pages"] if p.get("status") == "success")
    total_modals = len(results["modals"])
    successful_modals = sum(1 for m in results["modals"] if m.get("status") == "success")
    total_tabs = len(results["tabs"])
    successful_tabs = sum(1 for t in results["tabs"] if t.get("status") == "success")
    total_errors = len(results["errors"])

    results["summary"] = {
        "timestamp": datetime.now().isoformat(),
        "total_pages": total_pages,
        "successful_pages": successful_pages,
        "page_success_rate": f"{(successful_pages/total_pages*100):.1f}%" if total_pages > 0 else "0%",
        "total_modals": total_modals,
        "successful_modals": successful_modals,
        "total_tabs": total_tabs,
        "successful_tabs": successful_tabs,
        "total_errors": total_errors,
        "screenshot_directory": SCREENSHOT_DIR
    }

    with open(REPORT_FILE, "w") as f:
        json.dump(results, f, indent=2)

    print(f"  Total Pages: {total_pages} ({successful_pages} successful)")
    print(f"  Total Modals: {total_modals} ({successful_modals} successful)")
    print(f"  Total Tabs: {total_tabs} ({successful_tabs} successful)")
    print(f"  Total Errors: {total_errors}")
    print(f"  Report saved to: {REPORT_FILE}")


def main():
    """Main test runner"""
    print("🚀 MedFlow Complete Screenshot & Testing Suite")
    print("="*70)
    print(f"Capturing ALL pages, sections, modals, and interactions")
    print(f"Screenshots will be saved to: {SCREENSHOT_DIR}")
    print()

    start_time = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            ignore_https_errors=True
        )
        page = context.new_page()

        # Login first
        if not login(page):
            print("❌ Cannot continue without login")
            return 1

        # Capture everything
        capture_home_dashboard_cards(page)
        capture_all_pages(page)
        capture_sidebar_navigation(page)
        capture_patient_wizard_steps(page)
        capture_modals_and_dialogs(page)
        capture_tabs_and_sections(page)
        capture_responsive_layouts(page)

        browser.close()

    # Generate report
    generate_report()

    elapsed = time.time() - start_time
    print(f"\n⏱️ Total time: {elapsed:.1f} seconds")
    print(f"📸 Screenshots saved to: {SCREENSHOT_DIR}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
