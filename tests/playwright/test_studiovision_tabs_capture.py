"""
StudioVision Tabs Capture - Direct Navigation
==============================================

Captures all StudioVision tabs for comparison with original StudioVision XP
"""

import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

# Configuration
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "tests/playwright/screenshots/studiovision_comparison"

# Known patient ID from database
PATIENT_ID = "69441d7af3feff49134d2b49"  # JEAN KULALUKA

# Test credentials
TEST_USER = {
    "email": "admin@medflow.com",
    "password": "MedFlow$ecure1"
}


async def main():
    """Capture StudioVision tabs screenshots"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    results = {"screenshots": [], "timestamp": datetime.now().isoformat()}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        try:
            print("\n=== StudioVision Tabs Capture ===\n")

            # Step 1: Login
            print("1. Logging in...")
            await page.goto(f"{BASE_URL}/login")
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)

            await page.fill('input[type="email"]', TEST_USER["email"])
            await page.fill('input[type="password"]', TEST_USER["password"])
            await page.click('button[type="submit"]')

            # Wait for redirect
            await asyncio.sleep(3)
            await page.wait_for_load_state("networkidle")
            print(f"   Current URL: {page.url}")

            # Step 2: Navigate directly to StudioVision
            print(f"2. Navigating to StudioVision for patient {PATIENT_ID}...")
            await page.goto(f"{BASE_URL}/ophthalmology/studio/{PATIENT_ID}")
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)
            print(f"   Current URL: {page.url}")

            # Check if there's a consultation type selector modal
            modal_visible = await page.locator('.modal, [role="dialog"], [class*="Modal"]').count() > 0
            if modal_visible:
                print("   Found modal, taking screenshot...")
                await page.screenshot(path=f"{SCREENSHOT_DIR}/sv_00_consultation_modal.png", full_page=True)

                # Try to click "Vue Consolidée" or similar
                consolidee = page.locator('text="Vue Consolidée"')
                if await consolidee.count() > 0:
                    await consolidee.click()
                    await asyncio.sleep(0.5)

                # Click the confirm button
                confirm = page.locator('button:has-text("Vérifier"), button:has-text("Commencer"), button:has-text("OK")')
                if await confirm.count() > 0:
                    await confirm.first.click()
                    await asyncio.sleep(2)

            # Take initial screenshot
            await page.screenshot(path=f"{SCREENSHOT_DIR}/sv_01_initial.png", full_page=True)
            results["screenshots"].append({"name": "sv_01_initial", "status": "captured"})

            # Step 3: Capture each tab
            print("3. Capturing tabs...")

            tabs = [
                ("resume", "Résumé"),
                ("refraction", "Réfraction"),
                ("lentilles", "Lentilles"),
                ("pathologies", "Pathologies"),
                ("orthoptie", "Orthoptie"),
                ("examen", "Examen"),
                ("traitement", "Traitement"),
                ("reglement", "Règlement")
            ]

            for tab_id, tab_name in tabs:
                print(f"   Clicking {tab_name}...")

                # Try multiple selectors for tabs
                tab_selectors = [
                    f'button[role="tab"]:has-text("{tab_name}")',
                    f'[role="tab"]:has-text("{tab_name}")',
                    f'button:has-text("{tab_name}")',
                    f'nav button:has-text("{tab_name}")',
                    f'a:has-text("{tab_name}")'
                ]

                clicked = False
                for selector in tab_selectors:
                    tab_btn = page.locator(selector)
                    if await tab_btn.count() > 0:
                        await tab_btn.first.click()
                        await asyncio.sleep(1.5)
                        clicked = True
                        break

                if clicked:
                    filename = f"{SCREENSHOT_DIR}/sv_tab_{tab_id}.png"
                    await page.screenshot(path=filename, full_page=True)
                    results["screenshots"].append({
                        "name": f"sv_tab_{tab_id}",
                        "status": "captured",
                        "tab": tab_name
                    })
                    print(f"      Captured: {filename}")
                else:
                    print(f"      Tab not found: {tab_name}")
                    results["screenshots"].append({
                        "name": f"sv_tab_{tab_id}",
                        "status": "not_found"
                    })

            # Step 4: Also capture through keyboard navigation (1-8 keys)
            print("4. Testing keyboard navigation...")
            await page.keyboard.press("1")  # Resume
            await asyncio.sleep(0.5)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/sv_key1_resume.png", full_page=True)

            await page.keyboard.press("2")  # Refraction
            await asyncio.sleep(0.5)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/sv_key2_refraction.png", full_page=True)

            # Save results
            results["patient_id"] = PATIENT_ID
            results["total_captured"] = len([s for s in results["screenshots"] if s.get("status") == "captured"])

            with open(f"{SCREENSHOT_DIR}/capture_results.json", "w") as f:
                json.dump(results, f, indent=2)

            print(f"\n=== Complete ===")
            print(f"Total captured: {results['total_captured']}")
            print(f"Saved to: {SCREENSHOT_DIR}/")

        except Exception as e:
            print(f"\nError: {str(e)}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{SCREENSHOT_DIR}/error.png", full_page=True)

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
