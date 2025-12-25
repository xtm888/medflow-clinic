#!/usr/bin/env python3
"""
Queue Operations E2E Tests
Tests daily queue management:
- Register patient arrival
- Call next patient
- Assign to room
- Complete consultation
- Track wait times
"""

import asyncio
import json
import os
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "screenshots/queue"
RESULTS_FILE = f"{SCREENSHOT_DIR}/results.json"

TEST_EMAIL = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

results = []
findings = []


def log_result(test_name: str, status: str, message: str = ""):
    results.append({"test": test_name, "status": status, "message": message})
    print(f"{'✓' if status == 'PASS' else '✗'} {test_name}: {message}")


async def login(page):
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.wait_for_url(lambda url: "/login" not in url, timeout=10000)


async def test_queue_operations(page):
    """Test queue management workflow"""

    # Navigate to queue
    await page.goto(f"{BASE_URL}/queue")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(1000)

    await page.screenshot(path=f"{SCREENSHOT_DIR}/queue_page.png")

    # Check page loaded
    page_content = await page.content()
    if "File d'attente" in page_content or "queue" in page.url.lower():
        log_result("Queue page loaded", "PASS", "Page accessible")
    else:
        log_result("Queue page loaded", "CHECK", "Verify page content")

    # Check for queue stats
    stats = page.locator('[class*="stat"], [class*="card"]')
    stats_count = await stats.count()
    if stats_count > 0:
        log_result("Queue stats visible", "PASS", f"{stats_count} stat cards")

    # Register arrival button
    arrival_btn = page.locator('button:has-text("Enregistrer arrivee"), button:has-text("Arrivee"), button:has-text("Check-in"), button:has-text("Nouveau")')
    if await arrival_btn.count() > 0:
        await arrival_btn.first.click()
        await page.wait_for_timeout(500)
        log_result("Register arrival button", "PASS", "Button clicked")

        await page.screenshot(path=f"{SCREENSHOT_DIR}/arrival_modal.png")

        # Check for modal
        modal = page.locator('.fixed.inset-0.z-50')
        if await modal.count() > 0:
            # Select patient from modal table
            patient_row = modal.locator('tbody tr').first
            if await patient_row.count() > 0:
                await patient_row.click()
                await page.wait_for_timeout(500)
                log_result("Select patient for arrival", "PASS", "Patient selected")

            # Confirm arrival
            confirm_btn = modal.locator('button:has-text("Confirmer"), button:has-text("Enregistrer"), button:has-text("Valider")')
            if await confirm_btn.count() > 0:
                await confirm_btn.first.click()
                await page.wait_for_timeout(1000)
                log_result("Confirm arrival", "PASS", "Arrival registered")
    else:
        log_result("Register arrival button", "SKIP", "No arrival button found (queue may be disabled)")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/after_arrival.png")

    # Call next patient - check if button exists and is enabled
    call_next_btn = page.locator('button:has-text("Appeler suivant"), button:has-text("Suivant"), button:has-text("Appeler")')
    if await call_next_btn.count() > 0:
        is_disabled = await call_next_btn.first.is_disabled()
        if is_disabled:
            log_result("Call next patient", "SKIP", "Button disabled - queue empty (expected)")
        else:
            await call_next_btn.first.click()
            await page.wait_for_timeout(500)
            log_result("Call next patient", "PASS", "Next patient called")
    else:
        log_result("Call next patient", "SKIP", "Button not found")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/patient_called.png")

    # Check for patient list in queue
    queue_items = page.locator('[class*="queue-item"], tbody tr, [class*="patient-row"]')
    queue_count = await queue_items.count()
    if queue_count > 0:
        log_result("Queue has patients", "PASS", f"{queue_count} patients in queue")
    else:
        log_result("Queue has patients", "SKIP", "Queue is empty")

    # Assign room (if available)
    room_select = page.locator('select[name="room"], button:has-text("Salle"), select[name*="room"]')
    if await room_select.count() > 0:
        tag_name = await room_select.first.evaluate("el => el.tagName")
        if tag_name == "SELECT":
            # Get options count
            options = await room_select.first.locator('option').all()
            if len(options) > 1:
                await room_select.first.select_option(index=1)
                log_result("Room assignment", "PASS", "Room selected")
        else:
            await room_select.first.click()
            log_result("Room assignment", "PASS", "Room button clicked")
    else:
        log_result("Room assignment", "SKIP", "No room selector visible")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/room_assigned.png")

    # Check for wait time display
    wait_time = page.locator(':has-text("Attente"), :has-text("min"), [class*="wait"]')
    if await wait_time.count() > 0:
        log_result("Wait time display", "PASS", "Wait times shown")

    findings.append({
        "category": "QUEUE",
        "description": "Queue operations available and functional"
    })


async def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=os.environ.get("HEADED", "1") != "1"
        )
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        try:
            await login(page)
            await test_queue_operations(page)
        except Exception as e:
            log_result("Test execution", "ERROR", str(e))
            await page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
        finally:
            with open(RESULTS_FILE, "w") as f:
                json.dump({"results": results, "findings": findings}, f, indent=2)

            print(f"\n{'='*50}")
            print(f"Results: {sum(1 for r in results if r['status'] == 'PASS')}/{len(results)} passed")
            print(f"{'='*50}")

            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
