import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// These tests exercise the booking application directly: there is no landing page.
test("trip and traveller selections update the package total without overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "BOOK A GETAWAY", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Akosombo & the Volta River", exact: true }).check();
  await page.getByRole("radio", { name: "2 PEOPLE", exact: true }).check();
  await expect(page.locator(".total-line")).toContainText("2,500");
  await expect(page.locator('input[name="departure"]:not(:disabled)').first()).toBeVisible();
  await page.locator('input[name="departure"]:not(:disabled)').first().check();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.locator('input[name="departure"]:not(:disabled)').first()).toBeVisible();
  await page.getByRole("button", { name: "Previous week" }).click();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator("body").evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await page.screenshot({ path: `test-results/${testInfo.project.name}-booking-app.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("complete a booking, download the record, and reopen it after reload", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "2 PEOPLE", exact: true }).check();
  await expect(page.locator('input[name="departure"]:not(:disabled)').first()).toBeVisible();
  await page.locator('input[name="departure"]:not(:disabled)').first().check();
  await page.getByRole("button", { name: "CONTINUE TO DETAILS", exact: true }).click();
  await page.getByLabel("FULL NAME", { exact: true }).fill("Test Traveller");
  await page.getByLabel("EMAIL ADDRESS", { exact: true }).fill("test@example.com");
  await page.getByLabel("PHONE NUMBER", { exact: true }).fill("+233240000000");
  await page.getByRole("button", { name: "CONTINUE TO CONFIRMATION", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CONFIRM BOOKING", exact: true })).toBeVisible();
  await expect(page.locator(".confirmation-review")).toContainText("Test Traveller");
  await page.getByRole("button", { name: "CONFIRM BOOKING", exact: true }).click();
  await expect(page.getByRole("heading", { name: "MOCK PAYMENT", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await page.getByRole("checkbox").check();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-payment.png`, fullPage: true });
  await page.getByRole("button", { name: "COMPLETE MOCK PAYMENT", exact: true }).click();
  await expect(page.getByRole("heading", { name: "YOUR REQUEST IS IN.", exact: true })).toBeVisible();
  await expect(page.locator(".confirmation")).toContainText("No payment has been taken");
  const reference = await page.locator(".booking-reference").innerText();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "DOWNLOAD BOOKING REQUEST", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(`${reference}.txt`);
  await page.getByRole("button", { name: "VIEW MY BOOKINGS", exact: true }).click();
  await expect(page.locator(".saved-booking")).toContainText(reference);
  await expect(page.locator(".saved-booking")).toContainText("Payment pending");
  await page.reload();
  await page.locator(".header-bookings").click();
  await expect(page.locator(".saved-booking")).toContainText(reference);
});

test("required fields block progression and back navigation preserves the draft", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "CONTINUE TO DETAILS", exact: true })).toBeDisabled();
  await expect(page.locator('input[name="departure"]:not(:disabled)').first()).toBeVisible();
  await page.locator('input[name="departure"]:not(:disabled)').first().check();
  await page.getByRole("button", { name: "CONTINUE TO DETAILS", exact: true }).click();
  await page.getByRole("button", { name: "CONTINUE TO CONFIRMATION", exact: true }).click();
  await expect(page.getByRole("heading", { name: "YOUR DETAILS", exact: true })).toBeVisible();
  await page.getByLabel("FULL NAME", { exact: true }).fill("Draft Traveller");
  await page.getByRole("button", { name: "Previous booking step", exact: true }).click();
  await page.getByRole("button", { name: "CONTINUE TO DETAILS", exact: true }).click();
  await expect(page.getByLabel("FULL NAME", { exact: true })).toHaveValue("Draft Traveller");
});

test("unavailable dates show an error and recover on retry", async ({ page }) => {
  let fail = true;
  await page.route("**/api/departures?*", async route => {
    if (fail) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Please try again shortly." }) });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".form-error")).toContainText("Please try again shortly.");
  fail = false;
  await page.getByRole("button", { name: "Refresh available dates", exact: true }).click();
  await expect(page.locator('input[name="departure"]:not(:disabled)').first()).toBeVisible();
});

test("cancelling an unconfirmed request releases its places", async ({ page, request }) => {
  const inventory = await (await request.get("/api/departures?trip=volta")).json();
  const departure = inventory.departures[0];
  const token = randomUUID() + randomUUID();
  const response = await request.post("/api/bookings", { data: {
    tripId: "volta", date: departure.date, guests: 2, name: "Cancellation Test", email: "cancel@example.com",
    phone: "+233240000000", notes: "", paymentMethod: "mobile-money", acceptedTerms: true,
    idempotencyKey: randomUUID(), accessToken: token,
  } });
  expect(response.status()).toBe(201);
  const { booking } = await response.json();
  await page.addInitScript(({ reference, token }) => localStorage.setItem("cruise-bookings", JSON.stringify([{ reference, token }])), { reference: booking.reference, token });
  await page.goto("/");
  await page.locator(".header-bookings").click();
  await page.getByRole("button", { name: "Cancel request", exact: true }).click();
  await page.getByRole("button", { name: "YES, CANCEL", exact: true }).click();
  await expect(page.locator(".saved-booking .status-line")).toContainText("Cancelled");
  const after = await (await request.get("/api/departures?trip=volta")).json();
  expect(after.departures[0].remaining).toBe(departure.remaining);
  const unauthorized = await request.get(`/api/bookings/${booking.reference}`);
  expect(unauthorized.status()).toBe(404);
});
