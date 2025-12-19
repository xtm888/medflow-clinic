#!/usr/bin/env python3
"""
MedFlow Deep UI Explorer v2

Recursively explores the entire UI by:
1. Clicking every button/link/tab
2. Taking a screenshot after EACH interaction
3. Discovering new elements in each view
4. Building a complete UI map
5. Auto-recovery from session loss

Run: python3 test_deep_ui_explorer.py
Run headed: HEADED=1 python3 test_deep_ui_explorer.py
"""

import os
import re
import json
import hashlib
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Configuration
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots", "deep_explore")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "deep_ui_map.json")
TEST_USER = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"
MAX_DEPTH = 3
MAX_CLICKS_PER_PAGE = 25

# Only skip truly dangerous buttons (logout, delete)
SKIP_BUTTONS = [
    'logout', 'déconnexion', 'supprimer', 'delete', 'effacer'
]

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Global tracking
ui_map = {}
visited_urls = set()
screenshot_count = 0
interaction_log = []


def take_screenshot(page, name):
    """Take a screenshot with incrementing number"""
    global screenshot_count
    screenshot_count += 1
    safe_name = re.sub(r'[^\w\-]', '_', name)[:40]
    filename = f"{screenshot_count:04d}_{safe_name}.jpg"
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    try:
        page.screenshot(path=filepath, type='jpeg', quality=40, full_page=False)
        print(f"    📸 [{screenshot_count}] {safe_name}")
        return filename
    except Exception as e:
        print(f"    ⚠️ Screenshot failed: {str(e)[:30]}")
        return None


def is_logged_in(page):
    """Check if user is still logged in"""
    return '/login' not in page.url and '/forgot-password' not in page.url


def do_login(page):
    """Perform login"""
    print("  🔐 Logging in...")
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    page.locator('#email').fill(TEST_USER)
    page.locator('#password').fill(TEST_PASSWORD)
    page.locator('button[type="submit"]').click()
    try:
        page.wait_for_url("**/home", timeout=10000)
        print("  ✅ Login successful")
        return True
    except:
        print("  ❌ Login failed")
        return False


def ensure_logged_in(page):
    """Ensure we're logged in, re-login if needed"""
    if not is_logged_in(page):
        return do_login(page)
    return True


def should_skip_element(text):
    """Check if element should be skipped"""
    text_lower = text.lower()
    return any(skip in text_lower for skip in SKIP_BUTTONS)


def get_clickable_elements(page):
    """Find all clickable elements on the page"""
    elements = []

    # Buttons (excluding skip list)
    for btn in page.locator('button:visible').all():
        try:
            text = btn.inner_text().strip()[:30]
            if text and not should_skip_element(text):
                elements.append({"type": "button", "text": text, "locator": btn})
        except:
            pass

    # Links (nav items)
    for link in page.locator('a:visible').all():
        try:
            text = link.inner_text().strip()[:30]
            href = link.get_attribute('href') or ""
            if text and href and not should_skip_element(text):
                # Skip external links and logout
                if not href.startswith('http') or BASE_URL in href:
                    elements.append({"type": "link", "text": text, "href": href, "locator": link})
        except:
            pass

    # Tabs
    for tab in page.locator('[role="tab"]:visible').all():
        try:
            text = tab.inner_text().strip()[:30]
            if text and not should_skip_element(text):
                elements.append({"type": "tab", "text": text, "locator": tab})
        except:
            pass

    # Action icons (eye, edit, etc.)
    for icon_btn in page.locator('button:has(svg):visible, a:has(svg):visible').all():
        try:
            title = icon_btn.get_attribute('title') or icon_btn.get_attribute('aria-label') or ""
            if title and not should_skip_element(title):
                elements.append({"type": "icon", "text": title[:20], "locator": icon_btn})
        except:
            pass

    # Dedupe by text
    seen = set()
    unique = []
    for el in elements:
        key = f"{el['type']}:{el['text']}"
        if key not in seen and el['text']:
            seen.add(key)
            unique.append(el)

    return unique[:MAX_CLICKS_PER_PAGE]


def check_for_modal(page):
    """Check if a modal is open"""
    modals = page.locator('[role="dialog"]:visible, [class*="modal"]:visible, [class*="Modal"]:visible, .MuiDialog-root:visible')
    return modals.count() > 0


def close_modal(page, max_attempts=3):
    """Close any open modal with multiple strategies"""
    for attempt in range(max_attempts):
        # Check if modal is still open
        if not check_for_modal(page):
            return True

        # Strategy 1: Click close/X buttons
        close_selectors = [
            'button[aria-label="close"]',
            'button[aria-label="Close"]',
            '[class*="close"]:visible',
            '[class*="Close"]:visible',
            'button:has-text("Fermer")',
            'button:has-text("Annuler")',
            'button:has-text("Close")',
            'button:has-text("Cancel")',
            'button:has-text("OK")',
            '[role="dialog"] button:first-child',
            '.MuiDialogTitle-root button',
            '[class*="modal-header"] button',
            'svg[class*="close"]',
            '[class*="IconButton"]:has(svg)',
        ]

        for sel in close_selectors:
            try:
                btn = page.locator(sel).first
                if btn.count() > 0 and btn.is_visible():
                    btn.click(timeout=1000)
                    page.wait_for_timeout(300)
                    if not check_for_modal(page):
                        return True
            except:
                pass

        # Strategy 2: Press Escape
        try:
            page.keyboard.press('Escape')
            page.wait_for_timeout(300)
            if not check_for_modal(page):
                return True
        except:
            pass

        # Strategy 3: Click outside modal (backdrop)
        try:
            page.locator('[class*="backdrop"], [class*="Backdrop"], [class*="overlay"]').first.click(force=True)
            page.wait_for_timeout(300)
            if not check_for_modal(page):
                return True
        except:
            pass

    return False


def explore_modal(page, parent_name, current_url):
    """Explore elements inside a modal and ensure we close it"""
    print(f"      📦 Modal opened - exploring contents")
    take_screenshot(page, f"{parent_name}_modal")

    # Find modal content and take detailed screenshots
    modal_content = page.locator('[role="dialog"], [class*="modal"]:visible, [class*="Modal"]:visible').first
    if modal_content.count() > 0:
        try:
            # Get modal title if available
            title = page.locator('[role="dialog"] h2, [class*="modal-title"], [class*="DialogTitle"]').first
            if title.count() > 0:
                modal_title = title.inner_text()[:30]
                print(f"        Modal title: {modal_title}")
                take_screenshot(page, f"{parent_name}_modal_{modal_title}")
        except:
            pass

    # Don't click inside modal - just capture and close
    # This prevents nested modals and hangs

    # Close the modal
    if not close_modal(page):
        print(f"        ⚠️ Could not close modal - reloading page")
        try:
            page.goto(current_url)
            page.wait_for_timeout(1000)
        except:
            pass


def explore_page(page, page_name, depth=0):
    """Explore a single page thoroughly"""
    global ui_map

    if depth > MAX_DEPTH:
        return

    current_url = page.url

    # Skip if already visited
    if current_url in visited_urls:
        print(f"{'  ' * depth}↩️ Already visited: {current_url}")
        return
    visited_urls.add(current_url)

    print(f"\n{'─' * 50}")
    print(f"{'  ' * depth}📍 [{depth}] {page_name}")
    print(f"{'  ' * depth}   URL: {current_url}")

    page.wait_for_timeout(500)
    screenshot = take_screenshot(page, f"{page_name}_view")

    # Get clickable elements
    elements = get_clickable_elements(page)
    print(f"{'  ' * depth}🔍 Found {len(elements)} clickable elements")

    # Store page info
    ui_map[current_url] = {
        "name": page_name,
        "screenshot": screenshot,
        "depth": depth,
        "elements": []
    }

    for i, el in enumerate(elements):
        # Check session before each click
        if not ensure_logged_in(page):
            print(f"{'  ' * depth}❌ Session lost, cannot continue")
            return

        # Navigate back to page if needed
        if page.url != current_url:
            page.goto(current_url)
            page.wait_for_timeout(800)

        print(f"{'  ' * depth}  [{i+1}/{len(elements)}] {el['type']}: '{el['text']}'")

        try:
            before_url = page.url
            before_modal = check_for_modal(page)

            # Click element
            el['locator'].click(timeout=3000)
            page.wait_for_timeout(600)

            after_url = page.url
            after_modal = check_for_modal(page)

            # Check if logged out
            if not is_logged_in(page):
                print(f"{'  ' * depth}    ⚠️ Logged out! Re-logging...")
                do_login(page)
                page.goto(current_url)
                page.wait_for_timeout(800)
                continue

            # Take screenshot
            ss = take_screenshot(page, f"{page_name}_{el['type']}_{el['text']}")

            # Record element
            ui_map[current_url]["elements"].append({
                "type": el['type'],
                "text": el['text'],
                "screenshot": ss,
                "action": "navigate" if before_url != after_url else ("modal" if after_modal else "state_change")
            })

            # Handle navigation
            if before_url != after_url and is_logged_in(page):
                new_page = after_url.split('/')[-1] or "page"
                print(f"{'  ' * depth}    → Navigated to: {new_page}")

                # Recursively explore
                explore_page(page, new_page, depth + 1)

                # Return to original page
                page.goto(current_url)
                page.wait_for_timeout(800)

            # Handle modal
            elif not before_modal and after_modal:
                explore_modal(page, page_name, current_url)

        except PlaywrightTimeout:
            print(f"{'  ' * depth}    ⏱️ Timeout - recovering")
            try:
                page.goto(current_url)
                page.wait_for_timeout(800)
            except:
                pass
        except Exception as e:
            err = str(e)[:40]
            print(f"{'  ' * depth}    ❌ {err}")
            # Try to recover
            try:
                if check_for_modal(page):
                    close_modal(page)
                if page.url != current_url:
                    page.goto(current_url)
                    page.wait_for_timeout(800)
            except:
                pass


def main():
    global screenshot_count, ui_map, visited_urls

    screenshot_count = 0
    ui_map = {}
    visited_urls = set()

    headed = os.environ.get('HEADED', '0') == '1'

    print("=" * 60)
    print("MEDFLOW DEEP UI EXPLORER v2")
    print("=" * 60)
    print(f"Mode: {'Headed' if headed else 'Headless'}")
    print(f"Screenshots: {SCREENSHOT_DIR}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed, slow_mo=150 if headed else 30)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Initial login
        if not do_login(page):
            browser.close()
            return False

        take_screenshot(page, "00_home")

        # Define pages to explore
        pages_to_explore = [
            ("home", "Home"),
            ("patients", "Patients"),
            ("queue", "Queue"),
            ("appointments", "Appointments"),
            ("ophthalmology", "Ophthalmology"),
            ("prescriptions", "Prescriptions"),
            ("invoicing", "Invoicing"),
            ("pharmacy", "Pharmacy"),
            ("laboratory", "Laboratory"),
            ("surgery", "Surgery"),
            ("inventory", "Inventory"),
            ("settings", "Settings"),
            ("documents", "Documents"),
            ("audit", "AuditLog"),
        ]

        for url_path, name in pages_to_explore:
            try:
                print(f"\n{'=' * 60}")
                print(f"EXPLORING: {name}")
                print(f"{'=' * 60}")

                ensure_logged_in(page)
                page.goto(f"{BASE_URL}/{url_path}")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(800)

                explore_page(page, name, depth=0)

            except Exception as e:
                print(f"Error on {name}: {str(e)[:50]}")

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("EXPLORATION COMPLETE")
    print("=" * 60)
    print(f"Screenshots taken: {screenshot_count}")
    print(f"Pages explored: {len(ui_map)}")

    # Save report
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "screenshots": screenshot_count,
            "pages": len(ui_map),
            "interactions": sum(len(p.get("elements", [])) for p in ui_map.values())
        },
        "pages": ui_map
    }

    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nReport: {REPORT_FILE}")
    print(f"Screenshots: {SCREENSHOT_DIR}")

    return True


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
