#!/usr/bin/env python3
"""
MedFlow Complete UI Explorer v4

Comprehensive UI exploration with:
- No timeout limits
- Incremental report saving (never lose progress)
- Resume capability
- Better modal handling
- Full page coverage

Run: python3 test_complete_ui_explorer.py
Run headed: HEADED=1 python3 test_complete_ui_explorer.py
Resume: RESUME=1 python3 test_complete_ui_explorer.py
"""

import os
import re
import json
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "complete_ui")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "complete_ui_map.json")
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), ".ui_explorer_progress.json")
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Skip dangerous buttons and logout-related elements
SKIP_TEXTS = [
    'logout', 'déconnexion', 'supprimer', 'delete', 'deconnexion',
    'sign out', 'log out', 'se déconnecter', 'quitter',
    'effacer', 'remove', 'clear all', 'réinitialiser'
]

# All pages to explore (comprehensive list)
ALL_PAGES = [
    # Main navigation
    ("home", "Home"),
    ("dashboard", "Dashboard"),
    ("patients", "Patients"),
    ("queue", "Queue"),
    ("appointments", "Appointments"),

    # Clinical
    ("ophthalmology", "Ophthalmology"),
    ("ophthalmology/consultation", "OphthalmologyConsultation"),
    ("prescriptions", "Prescriptions"),
    ("surgery", "Surgery"),
    ("surgery/planning", "SurgeryPlanning"),

    # Laboratory
    ("laboratory", "Laboratory"),
    ("laboratory/pending", "LabPending"),
    ("laboratory/results", "LabResults"),

    # Finances
    ("invoicing", "Invoicing"),
    ("reports/financial", "FinancialReports"),
    ("conventions", "Conventions"),
    ("approvals", "Approvals"),
    ("services", "Services"),

    # Pharmacy & Inventory
    ("pharmacy", "Pharmacy"),
    ("pharmacy/inventory", "PharmacyInventory"),
    ("inventory", "Inventory"),
    ("optical-shop", "OpticalShop"),
    ("glasses-orders", "GlassesOrders"),

    # Multi-clinic
    ("companies", "Companies"),
    ("cross-clinic-dashboard", "CrossClinicDashboard"),

    # Admin
    ("settings", "Settings"),
    ("documents", "Documents"),
    ("audit", "AuditLog"),
    ("notifications", "Notifications"),
    ("analytics", "Analytics"),
]

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Global state
screenshot_count = 0
ui_map = {}
explored_pages = set()


def save_progress():
    """Save current progress to resume later"""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump({
            "screenshot_count": screenshot_count,
            "explored_pages": list(explored_pages),
            "timestamp": datetime.now().isoformat()
        }, f)


def load_progress():
    """Load previous progress if resuming"""
    global screenshot_count, explored_pages
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            data = json.load(f)
            screenshot_count = data.get("screenshot_count", 0)
            explored_pages = set(data.get("explored_pages", []))
            print(f"  Resuming from screenshot {screenshot_count}, {len(explored_pages)} pages done")
            return True
    return False


def save_report():
    """Save current report (incremental)"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "screenshots": screenshot_count,
            "pages": len(ui_map),
            "elements": sum(len(p.get("elements", [])) for p in ui_map.values())
        },
        "pages": ui_map
    }
    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2)


def safe_name(text):
    return re.sub(r'[^\w\-]', '_', str(text))[:35]


def take_ss(page, name):
    global screenshot_count
    screenshot_count += 1
    filename = f"{screenshot_count:04d}_{safe_name(name)}.jpg"
    path = os.path.join(SCREENSHOT_DIR, filename)
    try:
        page.screenshot(path=path, type='jpeg', quality=40)
        return filename
    except:
        return None


def login(page):
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


def is_logged_in(page):
    return '/login' not in page.url


def ensure_logged_in(page):
    if not is_logged_in(page):
        return login(page)
    return True


def should_skip(text):
    return any(s in text.lower() for s in SKIP_TEXTS)


def check_modal(page):
    return page.locator('[role="dialog"]:visible, [class*="modal"]:visible, [class*="Modal"]:visible').count() > 0


def close_modal(page, current_url):
    """Close modal with multiple strategies"""
    for _ in range(3):
        if not check_modal(page):
            return True

        # Try close buttons
        for sel in ['button[aria-label*="close" i]', 'button:has-text("Fermer")',
                    'button:has-text("Annuler")', 'button:has-text("OK")',
                    '[class*="close"]:visible', '.MuiDialogTitle-root button']:
            try:
                btn = page.locator(sel).first
                if btn.count() > 0 and btn.is_visible():
                    btn.click(timeout=1000)
                    page.wait_for_timeout(300)
                    if not check_modal(page):
                        return True
            except:
                pass

        # Try Escape
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        if not check_modal(page):
            return True

    # Last resort: reload page
    try:
        page.goto(current_url)
        page.wait_for_timeout(800)
    except:
        pass
    return False


def get_elements(page):
    """Get all interactive elements"""
    elements = []

    # Buttons
    for btn in page.locator('button:visible').all()[:25]:
        try:
            text = btn.inner_text().strip()[:30]
            if text and not should_skip(text):
                elements.append({"type": "button", "text": text, "el": btn})
        except: pass

    # Tabs
    for tab in page.locator('[role="tab"]:visible').all()[:15]:
        try:
            text = tab.inner_text().strip()[:30]
            if text and not should_skip(text):
                elements.append({"type": "tab", "text": text, "el": tab})
        except: pass

    # Links (sidebar/nav)
    for link in page.locator('nav a:visible, aside a:visible, [class*="sidebar"] a:visible').all()[:15]:
        try:
            text = link.inner_text().strip()[:30]
            if text and not should_skip(text):
                elements.append({"type": "link", "text": text, "el": link})
        except: pass

    # Table rows (first 5)
    for row in page.locator('tbody tr:visible').all()[:5]:
        try:
            # Click view button in row if exists
            view_btn = row.locator('button:has(svg), a:has(svg)').first
            if view_btn.count() > 0:
                elements.append({"type": "row_action", "text": "view_row", "el": view_btn})
        except: pass

    # Icon buttons
    for icon in page.locator('button:has(svg):visible').all()[:10]:
        try:
            title = icon.get_attribute('title') or icon.get_attribute('aria-label') or ''
            if title and not should_skip(title):
                elements.append({"type": "icon", "text": title[:20], "el": icon})
        except: pass

    # Dedupe
    seen = set()
    unique = []
    for e in elements:
        key = f"{e['type']}:{e['text']}"
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique


def explore_page(page, page_name, page_url):
    """Explore a single page thoroughly"""
    global ui_map

    print(f"\n{'─' * 50}")
    print(f"📍 {page_name}")
    print(f"   {page_url}")

    # Navigate
    try:
        page.goto(page_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
    except Exception as e:
        print(f"   ❌ Failed to load: {str(e)[:40]}")
        return

    # Check login
    if not ensure_logged_in(page):
        print("   ❌ Login failed")
        return

    # Re-navigate after login
    if page.url != page_url:
        page.goto(page_url)
        page.wait_for_timeout(800)

    # Initialize page data
    page_data = {"url": page_url, "elements": []}

    # Main screenshot
    ss = take_ss(page, f"{page_name}_view")
    page_data["main_screenshot"] = ss
    print(f"   📸 Main view: {ss}")

    # Get elements
    elements = get_elements(page)
    print(f"   🔍 Found {len(elements)} elements")

    for i, el in enumerate(elements):
        print(f"   [{i+1}/{len(elements)}] {el['type']}: {el['text'][:25]}", end=" ")

        try:
            # Ensure we're on the right page
            if page.url != page_url:
                page.goto(page_url)
                page.wait_for_timeout(500)

            before_url = page.url
            before_modal = check_modal(page)

            # Click
            el['el'].click(timeout=3000)
            page.wait_for_timeout(500)

            after_url = page.url
            after_modal = check_modal(page)

            # Screenshot
            ss = take_ss(page, f"{page_name}_{el['type']}_{el['text']}")

            # Determine action type
            if not is_logged_in(page):
                action = "logout_trigger"
                print("⚠️ logout")
                login(page)
            elif before_url != after_url:
                action = "navigate"
                print(f"→ {after_url.split('/')[-1]}")
                page.go_back()
                page.wait_for_timeout(500)
            elif not before_modal and after_modal:
                action = "modal"
                print("📦 modal")
                # Screenshot modal content
                take_ss(page, f"{page_name}_modal_{el['text']}")
                close_modal(page, page_url)
            else:
                action = "state_change"
                print("✓")

            page_data["elements"].append({
                "type": el['type'],
                "text": el['text'],
                "action": action,
                "screenshot": ss
            })

        except PlaywrightTimeout:
            print("⏱️ timeout")
        except Exception as e:
            print(f"❌ {str(e)[:25]}")
            # Recovery
            if check_modal(page):
                close_modal(page, page_url)

    ui_map[page_name] = page_data
    explored_pages.add(page_name)

    # Save progress after each page
    save_progress()
    save_report()
    print(f"   ✅ Saved ({screenshot_count} screenshots total)")


def main():
    global screenshot_count, ui_map, explored_pages

    headed = os.environ.get('HEADED', '0') == '1'
    resume = os.environ.get('RESUME', '0') == '1'

    print("=" * 60)
    print("MEDFLOW COMPLETE UI EXPLORER v4")
    print("=" * 60)
    print(f"Mode: {'Headed' if headed else 'Headless'}")
    print(f"Resume: {resume}")
    print(f"Pages to explore: {len(ALL_PAGES)}")
    print()

    if resume:
        load_progress()
    else:
        screenshot_count = 0
        ui_map = {}
        explored_pages = set()
        # Clear old screenshots
        for f in os.listdir(SCREENSHOT_DIR):
            if f.endswith('.jpg'):
                os.remove(os.path.join(SCREENSHOT_DIR, f))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed, slow_mo=100 if headed else 20)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Initial login
        print("Logging in...")
        if not login(page):
            print("❌ Initial login failed!")
            browser.close()
            return False
        print("✅ Login successful")

        # Explore all pages
        for url_path, page_name in ALL_PAGES:
            if page_name in explored_pages:
                print(f"\n⏭️ Skipping {page_name} (already done)")
                continue

            try:
                explore_page(page, page_name, f"{BASE_URL}/{url_path}")
            except Exception as e:
                print(f"\n❌ Error on {page_name}: {str(e)[:50]}")
                # Try to recover
                try:
                    context.close()
                    context = browser.new_context(viewport={"width": 1400, "height": 900})
                    page = context.new_page()
                    login(page)
                except:
                    pass

        browser.close()

    # Final report
    save_report()

    print("\n" + "=" * 60)
    print("EXPLORATION COMPLETE")
    print("=" * 60)
    print(f"Total Screenshots: {screenshot_count}")
    print(f"Pages Explored: {len(ui_map)}")
    print(f"Elements Clicked: {sum(len(p.get('elements', [])) for p in ui_map.values())}")
    print(f"\nReport: {REPORT_FILE}")
    print(f"Screenshots: {SCREENSHOT_DIR}")

    # Cleanup progress file
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)

    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
