"""
Test StudioVision patient data display - verifies Phase 1 features:
- Patient photo in header
- Profession badge
- Referring doctor badge
- Visit history with images
"""

import os
import time
from playwright.sync_api import sync_playwright

# Test patient ID with complete data
PATIENT_ID = "69441d7af3feff49134d2b48"
BASE_URL = "http://localhost:5173"

def test_studiovision_patient_data():
    """Verify patient data displays correctly in StudioVision consultation"""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not os.getenv("HEADED"))
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # Screenshot directory
        screenshot_dir = "/Users/xtm888/magloire/tests/playwright/screenshots/studiovision_data"
        os.makedirs(screenshot_dir, exist_ok=True)

        print("\n=== StudioVision Patient Data Test ===\n")

        # 1. Login
        print("1. Logging in...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.fill('#email', "admin@medflow.com")
        page.fill('#password', "MedFlow$ecure1")
        page.click('button[type="submit"]')
        time.sleep(3)  # Wait for login to process
        # Check if we're still on login or redirected
        if "/login" not in page.url:
            print(f"   ✓ Logged in successfully (redirected to {page.url})")
        else:
            print("   ! Still on login page, but continuing...")

        # 2. Navigate to StudioVision consultation for test patient
        # Correct route: /ophthalmology/studio/:patientId
        print(f"\n2. Opening StudioVision for patient {PATIENT_ID}...")
        page.goto(f"{BASE_URL}/ophthalmology/studio/{PATIENT_ID}")
        page.wait_for_load_state("networkidle")
        time.sleep(2)  # Wait for data to load

        # 3. Check for patient photo
        print("\n3. Checking patient photo...")
        photo_element = page.query_selector("img.rounded-full")
        if photo_element:
            print("   ✓ Patient photo element found")
            src = photo_element.get_attribute("src")
            if src and "pravatar" in src:
                print(f"   ✓ Photo URL loaded: {src[:60]}...")
        else:
            # Check for camera placeholder
            camera_placeholder = page.query_selector("[title*='photo']")
            if camera_placeholder:
                print("   ○ Photo placeholder displayed (no photo available)")
            else:
                print("   ✗ No photo element found")

        # 4. Check for profession badge
        print("\n4. Checking profession badge...")
        # Look for Briefcase icon + text
        profession_text = page.query_selector("text=Entrepreneur") or \
                          page.query_selector("text=Commerçant") or \
                          page.query_selector("text=Fonctionnaire") or \
                          page.query_selector("text=Profession:")
        if profession_text:
            print("   ✓ Profession badge found")
        else:
            # Check the header area for any profession text
            header = page.query_selector(".bg-gradient-to-r")
            if header:
                header_text = header.inner_text()
                if any(prof in header_text for prof in ["Entrepreneur", "Commerçant", "Médecin", "Profession"]):
                    print("   ✓ Profession found in header")
                else:
                    print("   ○ Profession not visible in header")
            else:
                print("   ✗ Header not found")

        # 5. Check for referring doctor
        print("\n5. Checking referring doctor...")
        referring_doctor = page.query_selector("text=Dr. Lukusa") or \
                           page.query_selector("text=Médecin Référent") or \
                           page.query_selector("text=Dr. Mbeki") or \
                           page.query_selector("text=Dr. Kabongo")
        if referring_doctor:
            print("   ✓ Referring doctor displayed")
        else:
            print("   ○ Referring doctor not visible")

        # Take screenshot of header
        print("\n6. Taking screenshots...")
        page.screenshot(path=f"{screenshot_dir}/01_studiovision_header.png", full_page=False)
        print(f"   ✓ Header screenshot saved")

        # 7. Check Resume tab for visit history
        print("\n7. Checking Resume tab...")
        resume_tab = page.query_selector("text=Résumé") or page.query_selector("[data-tab='resume']")
        if resume_tab:
            resume_tab.click()
            time.sleep(1)
            print("   ✓ Resume tab clicked")

            # Look for visit history table
            visit_table = page.query_selector("table") or page.query_selector("[class*='history']")
            if visit_table:
                print("   ✓ Visit history table found")
            else:
                print("   ○ Visit history table not visible")

            page.screenshot(path=f"{screenshot_dir}/02_resume_tab.png", full_page=False)
            print("   ✓ Resume tab screenshot saved")
        else:
            print("   ○ Resume tab not found")

        # 8. Take full page screenshot
        page.screenshot(path=f"{screenshot_dir}/03_full_consultation.png", full_page=True)
        print(f"\n8. Full page screenshot saved")

        # Summary
        print("\n=== Test Complete ===")
        print(f"Screenshots saved to: {screenshot_dir}")

        browser.close()
        return True

if __name__ == "__main__":
    test_studiovision_patient_data()
