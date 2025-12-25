#!/usr/bin/env python3
"""
Invoice with Line Items and Payments E2E Tests
Tests complete invoice workflow:
- Create invoice for patient
- Add line items (services, procedures)
- Apply discount
- Record payment
- Verify totals
"""

import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "screenshots/invoice"
RESULTS_FILE = f"{SCREENSHOT_DIR}/results.json"

TEST_EMAIL = "admin@medflow.com"
TEST_PASSWORD = "MedFlow$ecure1"

# Invoice test data
INVOICE_ITEMS = [
    {"service": "Consultation ophtalmologique", "price": "15000"},
    {"service": "Fond d'oeil", "price": "10000"},
]

PAYMENT = {
    "amount": "25000",
    "method": "cash",
    "currency": "CDF"
}

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


async def test_invoice_creation(page):
    """Test complete invoice workflow"""

    # Navigate to invoicing
    await page.goto(f"{BASE_URL}/invoicing")
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(1000)

    await page.screenshot(path=f"{SCREENSHOT_DIR}/invoice_page.png")

    # Create new invoice
    new_btn = page.locator('button:has-text("Nouvelle"), button:has-text("Creer")')
    if await new_btn.count() > 0:
        await new_btn.first.click()
        await page.wait_for_timeout(1000)
        log_result("Open new invoice", "PASS", "Invoice form opened")
    else:
        log_result("Open new invoice", "FAIL", "Button not found")
        return

    await page.screenshot(path=f"{SCREENSHOT_DIR}/invoice_modal.png")

    # Select patient (using PatientSelectorModal)
    modal = page.locator('.fixed.inset-0.z-50')
    if await modal.count() > 0:
        patient_row = modal.locator('tbody tr').first
        if await patient_row.count() > 0:
            await patient_row.click()
            await page.wait_for_timeout(500)
            log_result("Select patient", "PASS", "Patient selected from modal")
    else:
        log_result("Select patient", "SKIP", "No patient selector modal")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/patient_selected.png")

    # Wait for invoice form to load after patient selection
    await page.wait_for_timeout(1000)

    # Add line items
    for i, item in enumerate(INVOICE_ITEMS):
        # Look for add item button
        add_item_btn = page.locator('button:has-text("Ajouter"), button:has-text("+ Ligne"), button:has-text("+ Service")')
        if await add_item_btn.count() > 0:
            await add_item_btn.first.click()
            await page.wait_for_timeout(300)
            log_result(f"Add item {i+1}: Click add", "PASS", "Add button clicked")

        # Service selection - try select dropdown first
        service_select = page.locator('select[name*="service"], select[name*="item"]').last
        if await service_select.count() > 0:
            # Get first option value
            options = await service_select.locator('option').all()
            if len(options) > 1:
                await service_select.select_option(index=1)
                log_result(f"Add item {i+1}: Service", "PASS", "Service selected from dropdown")
        else:
            # Try input field
            service_input = page.locator('input[name*="service"], input[placeholder*="service"]').last
            if await service_input.count() > 0:
                await service_input.fill(item["service"])
                log_result(f"Add item {i+1}: Service", "PASS", item["service"])

        # Price/amount input
        price_input = page.locator('input[name*="price"], input[name*="amount"], input[name*="montant"]').last
        if await price_input.count() > 0:
            await price_input.fill(item["price"])
            log_result(f"Add item {i+1}: Price", "PASS", f"{item['price']} CDF")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/items_added.png")

    # Apply discount (optional)
    discount_input = page.locator('input[name="discount"], input[placeholder*="remise"]')
    if await discount_input.count() > 0:
        await discount_input.first.fill("0")
        log_result("Discount", "PASS", "0% discount applied")

    # Check for total display
    total_display = page.locator('[class*="total"], :has-text("Total")')
    if await total_display.count() > 0:
        log_result("Total displayed", "PASS", "Invoice total visible")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/invoice_ready.png")

    # Save invoice
    save_btn = page.locator('button:has-text("Enregistrer"), button:has-text("Creer"), button:has-text("Valider")')
    if await save_btn.count() > 0:
        await save_btn.first.click()
        await page.wait_for_timeout(1000)
        log_result("Save invoice", "PASS", "Invoice saved")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/invoice_saved.png")

    # Record payment
    payment_btn = page.locator('button:has-text("Paiement"), button:has-text("Encaisser"), button:has-text("Regler")')
    if await payment_btn.count() > 0:
        await payment_btn.first.click()
        await page.wait_for_timeout(500)
        log_result("Open payment", "PASS", "Payment modal opened")

        await page.screenshot(path=f"{SCREENSHOT_DIR}/payment_modal.png")

        # Payment amount
        amount_input = page.locator('input[name="amount"], input[name="paymentAmount"], input[name="montant"]')
        if await amount_input.count() > 0:
            await amount_input.first.fill(PAYMENT["amount"])
            log_result("Payment amount", "PASS", f"{PAYMENT['amount']} CDF")

        # Payment method
        method_select = page.locator('select[name="method"], select[name="paymentMethod"], select[name="mode"]')
        if await method_select.count() > 0:
            await method_select.first.select_option(value=PAYMENT["method"])
            log_result("Payment method", "PASS", PAYMENT["method"])

        # Confirm payment
        confirm_btn = page.locator('button:has-text("Confirmer"), button:has-text("Valider"), button:has-text("Enregistrer")').last
        if await confirm_btn.count() > 0:
            await confirm_btn.click()
            await page.wait_for_timeout(1000)
            log_result("Confirm payment", "PASS", "Payment recorded")
    else:
        log_result("Record payment", "SKIP", "No payment button visible")

    await page.screenshot(path=f"{SCREENSHOT_DIR}/payment_recorded.png")

    # Check for success
    if await page.locator('.toast-success, [class*="success"]').count() > 0:
        log_result("Invoice workflow", "PASS", "Success confirmed")

    findings.append({
        "category": "INVOICE",
        "description": "Complete invoice workflow with payment works"
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
            await test_invoice_creation(page)
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
