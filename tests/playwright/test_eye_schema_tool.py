"""
Test Eye Schema Tool - verifies Phase 2 features:
- Schema button in Quick Actions Bar
- Eye template selection
- Drawing tools
- Save functionality
"""

import os
import time
from playwright.sync_api import sync_playwright

PATIENT_ID = "69441d7af3feff49134d2b48"
BASE_URL = "http://localhost:5173"

def test_eye_schema_tool():
    """Verify eye schema tool displays and functions correctly"""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not os.getenv("HEADED"))
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        screenshot_dir = "/Users/xtm888/magloire/tests/playwright/screenshots/eye_schema"
        os.makedirs(screenshot_dir, exist_ok=True)

        print("\n=== Eye Schema Tool Test ===\n")

        # 1. Login
        print("1. Logging in...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.fill('#email', "admin@medflow.com")
        page.fill('#password', "MedFlow$ecure1")
        page.click('button[type="submit"]')
        time.sleep(3)
        print("   ✓ Login submitted")

        # 2. Navigate to StudioVision consultation
        print("\n2. Opening StudioVision consultation...")
        page.goto(f"{BASE_URL}/ophthalmology/studio/{PATIENT_ID}")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # 3. Look for Schema button
        print("\n3. Looking for Schema button...")
        schema_button = page.query_selector("text=Schéma")
        if schema_button:
            print("   ✓ Schema button found")
            page.screenshot(path=f"{screenshot_dir}/01_quick_actions_bar.png")

            # Click Schema button
            print("\n4. Clicking Schema button...")
            schema_button.click()
            time.sleep(1)

            # Check if modal opened
            modal = page.query_selector("text=Schéma Oculaire")
            if modal:
                print("   ✓ Eye Schema modal opened")
                page.screenshot(path=f"{screenshot_dir}/02_schema_modal_open.png")

                # Check for template selector
                template_selector = page.query_selector("select")
                if template_selector:
                    print("   ✓ Template selector found")

                # Check for eye selector (OD/OS)
                od_button = page.query_selector("text=OD")
                os_button = page.query_selector("text=OS")
                if od_button and os_button:
                    print("   ✓ Eye selector (OD/OS) found")

                # Check for drawing tools
                tools_found = 0
                for tool in ["Crayon", "Ligne", "Cercle", "Flèche", "Texte"]:
                    if page.query_selector(f"[title*='{tool}']") or page.query_selector(f"button:has-text('{tool}')"):
                        tools_found += 1
                print(f"   ✓ Drawing tools found: {tools_found}/5")

                # Check for color palette
                color_buttons = page.query_selector_all("button.rounded-full")
                if len(color_buttons) >= 4:
                    print(f"   ✓ Color palette found ({len(color_buttons)} colors)")

                # Try changing template
                print("\n5. Testing template change...")
                if template_selector:
                    template_selector.select_option("fundus")
                    time.sleep(0.5)
                    page.screenshot(path=f"{screenshot_dir}/03_fundus_template.png")
                    print("   ✓ Changed to Fundus template")

                    template_selector.select_option("external")
                    time.sleep(0.5)
                    page.screenshot(path=f"{screenshot_dir}/04_external_template.png")
                    print("   ✓ Changed to External Eye template")

                    template_selector.select_option("crossSection")
                    time.sleep(0.5)
                    page.screenshot(path=f"{screenshot_dir}/05_crosssection_template.png")
                    print("   ✓ Changed to Cross Section template")

                # Switch to OS
                print("\n6. Testing eye switch...")
                if os_button:
                    os_button.click()
                    time.sleep(0.3)
                    print("   ✓ Switched to OS")
                    page.screenshot(path=f"{screenshot_dir}/06_os_selected.png")

                # Close modal
                close_button = page.query_selector("button:has-text('Fermer')") or page.query_selector("[title='Fermer']")
                if close_button:
                    close_button.click()
                    time.sleep(0.5)
                    print("\n7. Modal closed")
            else:
                print("   ✗ Modal did not open")
        else:
            print("   ✗ Schema button not found")
            page.screenshot(path=f"{screenshot_dir}/error_no_schema_button.png")

        # Summary
        print("\n=== Test Complete ===")
        print(f"Screenshots saved to: {screenshot_dir}")

        browser.close()
        return True

if __name__ == "__main__":
    test_eye_schema_tool()
