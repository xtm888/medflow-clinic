#!/usr/bin/env python3
"""
MedFlow Full UI Mapper v3

Maps the entire UI by exploring each page section independently.
Uses fresh browser context per section to avoid crash propagation.

Run: python3 test_full_ui_map.py
Run headed: HEADED=1 python3 test_full_ui_map.py
"""

import os
import re
import json
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "ui_map")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "full_ui_map.json")
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Skip dangerous/freezing buttons
SKIP_TEXTS = [
    'logout', 'déconnexion', 'supprimer', 'delete', 'actualiser', 'refresh', 'sync',
    'raccourci', 'shortcut', 'télécharger', 'download', 'cache', 'export', 'importer',
    'import', 'clavier', 'keyboard', 'préparer', 'offline', 'hors ligne'
]

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

screenshot_count = 0
all_results = {}


def safe_name(text):
    return re.sub(r'[^\w\-]', '_', text)[:35]


def take_ss(page, name):
    global screenshot_count
    screenshot_count += 1
    filename = f"{screenshot_count:04d}_{safe_name(name)}.jpg"
    path = os.path.join(SCREENSHOT_DIR, filename)
    try:
        page.screenshot(path=path, type='jpeg', quality=40)
        print(f"      📸 {screenshot_count}: {name[:40]}")
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


def should_skip(text):
    return any(s in text.lower() for s in SKIP_TEXTS)


def get_elements(page):
    """Get all interactive elements"""
    elements = []

    # Buttons
    for btn in page.locator('button:visible').all()[:20]:
        try:
            text = btn.inner_text().strip()[:30]
            if text and not should_skip(text):
                elements.append({"type": "btn", "text": text, "el": btn})
        except: pass

    # Tabs
    for tab in page.locator('[role="tab"]:visible, [class*="tab-"]:visible button').all()[:10]:
        try:
            text = tab.inner_text().strip()[:30]
            if text and not should_skip(text):
                elements.append({"type": "tab", "text": text, "el": tab})
        except: pass

    # Table rows (first 3)
    for row in page.locator('tbody tr:visible').all()[:3]:
        try:
            text = row.inner_text().strip()[:30]
            if text:
                elements.append({"type": "row", "text": text, "el": row})
        except: pass

    # Cards
    for card in page.locator('[class*="card"]:visible, [class*="Card"]:visible').all()[:5]:
        try:
            text = card.inner_text().strip()[:20]
            if text and not should_skip(text):
                elements.append({"type": "card", "text": text, "el": card})
        except: pass

    # Icons with actions
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


def close_modal(page):
    for sel in ['button:has-text("Fermer")', 'button:has-text("Annuler")', 'button[aria-label="close"]']:
        try:
            btn = page.locator(sel).first
            if btn.count() > 0:
                btn.click()
                page.wait_for_timeout(300)
                return
        except: pass
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)


def explore_page(page, page_name, page_url):
    """Explore a single page"""
    print(f"\n  📍 {page_name}")

    page_results = {"url": page_url, "screenshot": None, "elements": []}

    try:
        page.goto(page_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
    except Exception as e:
        print(f"    ❌ Failed to load: {str(e)[:40]}")
        return page_results

    # Initial screenshot
    page_results["screenshot"] = take_ss(page, f"{page_name}_main")

    # Get elements
    elements = get_elements(page)
    print(f"    Found {len(elements)} elements")

    for el in elements:
        try:
            before_url = page.url
            modal_before = page.locator('[role="dialog"]:visible').count() > 0

            print(f"      → {el['type']}: {el['text']}")
            el['el'].click(timeout=3000)
            page.wait_for_timeout(500)

            after_url = page.url
            modal_after = page.locator('[role="dialog"]:visible').count() > 0

            # Screenshot after click
            ss = take_ss(page, f"{page_name}_{el['type']}_{el['text']}")

            page_results["elements"].append({
                "type": el['type'],
                "text": el['text'],
                "screenshot": ss,
                "navigated": before_url != after_url,
                "modal": not modal_before and modal_after
            })

            # If navigated, go back
            if before_url != after_url:
                page.go_back()
                page.wait_for_timeout(500)

            # If modal opened, close it
            if not modal_before and modal_after:
                close_modal(page)

        except PlaywrightTimeout:
            print(f"        ⏱️ timeout")
        except Exception as e:
            print(f"        ❌ {str(e)[:30]}")

    return page_results


def main():
    global screenshot_count, all_results
    screenshot_count = 0
    all_results = {}

    headed = os.environ.get('HEADED', '0') == '1'

    print("=" * 60)
    print("MEDFLOW FULL UI MAPPER")
    print("=" * 60)
    print(f"Mode: {'Headed' if headed else 'Headless'}")
    print()

    # All pages to explore
    pages = [
        ("Home", "/home"),
        ("Dashboard", "/dashboard"),
        ("Patients", "/patients"),
        ("Queue", "/queue"),
        ("Appointments", "/appointments"),
        ("Ophthalmology", "/ophthalmology"),
        ("Ophthalmology Consultation", "/ophthalmology/new"),
        ("Prescriptions", "/prescriptions"),
        ("Invoicing", "/invoicing"),
        ("Pharmacy", "/pharmacy"),
        ("Pharmacy Inventory", "/pharmacy/inventory"),
        ("Laboratory", "/laboratory"),
        ("Laboratory Pending", "/laboratory/pending"),
        ("Surgery", "/surgery"),
        ("Surgery Planning", "/surgery/planning"),
        ("Inventory", "/inventory"),
        ("Optical Shop", "/optical-shop"),
        ("Glasses Orders", "/glasses-orders"),
        ("Settings", "/settings"),
        ("Documents", "/documents"),
        ("Audit Log", "/audit"),
        ("Notifications", "/notifications"),
        ("Financial Reports", "/reports/financial"),
        ("Analytics", "/analytics"),
        ("Approvals", "/approvals"),
        ("Multi-Clinic", "/multi-clinic"),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed, slow_mo=100 if headed else 20)

        for page_name, page_path in pages:
            print(f"\n{'─' * 50}")
            print(f"SECTION: {page_name}")

            # Fresh context for each page to isolate crashes
            context = browser.new_context(viewport={"width": 1400, "height": 900})
            page = context.new_page()

            try:
                if not login(page):
                    print("  ❌ Login failed")
                    context.close()
                    continue

                results = explore_page(page, page_name, f"{BASE_URL}{page_path}")
                all_results[page_name] = results

            except Exception as e:
                print(f"  ❌ Error: {str(e)[:50]}")
            finally:
                context.close()

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("MAPPING COMPLETE")
    print("=" * 60)
    print(f"Screenshots: {screenshot_count}")
    print(f"Pages mapped: {len(all_results)}")
    total_elements = sum(len(r.get('elements', [])) for r in all_results.values())
    print(f"Elements clicked: {total_elements}")

    # Save report
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "screenshots": screenshot_count,
            "pages": len(all_results),
            "elements": total_elements
        },
        "pages": all_results
    }

    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nReport: {REPORT_FILE}")
    print(f"Screenshots: {SCREENSHOT_DIR}")

    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
