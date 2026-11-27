"""Repeatable, local-only lab measurements for public and access pages.

Run against a local production preview. This does not submit measurements or
credentials to RepairProof or any external service. The scripted login is
intercepted and returns a synthetic 401 response in the browser context.
"""

import argparse
import asyncio
import json
import math
from collections import defaultdict

from playwright.async_api import async_playwright

OBSERVER_SCRIPT = """
window.__repairProofVitals = { lcp: 0, cls: 0, events: [] };
try {
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    window.__repairProofVitals.lcp = Math.max(window.__repairProofVitals.lcp, entry.startTime);
  })).observe({ type: 'largest-contentful-paint', buffered: true });
} catch {}
try {
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    if (!entry.hadRecentInput) window.__repairProofVitals.cls += entry.value;
  })).observe({ type: 'layout-shift', buffered: true });
} catch {}
try {
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    window.__repairProofVitals.events.push({ id: entry.interactionId || 0, duration: entry.duration });
  })).observe({ type: 'event', buffered: true, durationThreshold: 16 });
} catch {}
"""


async def measure_one(browser, base_url, device, route, sample_number):
    width, height = (390, 844) if device == "mobile" else (1440, 900)
    context = await browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        is_mobile=device == "mobile",
        has_touch=device == "mobile",
        reduced_motion="reduce",
    )
    page = await context.new_page()
    await page.add_init_script(OBSERVER_SCRIPT)

    if route == "login":
        await page.route(
            "**/api/auth/login",
            lambda request: request.fulfill(
                status=401,
                content_type="application/json",
                body='{"message":"Email or password is incorrect"}',
            ),
        )

    path = "/" if route == "landing" else "/login"
    await page.goto(f"{base_url.rstrip('/')}{path}", wait_until="networkidle")
    await page.get_by_role("heading", level=1).wait_for()
    # Let the largest-contentful-paint observer receive its final candidate.
    await page.wait_for_timeout(700)
    load_metrics = await page.evaluate(
        """() => ({
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          lcp: window.__repairProofVitals.lcp || null,
          cls: window.__repairProofVitals.cls,
        })"""
    )

    if route == "landing":
        await page.get_by_role("button", name="Take a look inside").click()
    else:
        await page.get_by_label("Email address").fill("perf@example.invalid")
        await page.get_by_label("Password").fill("local-test-password")
        await page.get_by_role("button", name="Sign in").click()
        await page.get_by_role("alert").wait_for()

    await page.wait_for_timeout(150)
    interaction = await page.evaluate(
        """() => {
          const grouped = new Map();
          for (const entry of window.__repairProofVitals.events) {
            if (!entry.id) continue;
            grouped.set(entry.id, Math.max(grouped.get(entry.id) || 0, entry.duration));
          }
          return { groups: [...grouped.values()], cls: window.__repairProofVitals.cls };
        }"""
    )
    await context.close()
    return {
        "device": device,
        "route": route,
        "sample": sample_number,
        "fcpMs": load_metrics["fcp"],
        "lcpMs": load_metrics["lcp"],
        "cls": round(interaction["cls"], 5),
        "maxInteractionDurationMs": max(interaction["groups"], default=None),
        "interactionCount": len(interaction["groups"]),
    }


def nearest_rank_p75(values):
    ordered = sorted(value for value in values if value is not None)
    if not ordered:
        return None
    return round(ordered[max(0, math.ceil(0.75 * len(ordered)) - 1)], 1)


async def run(base_url, sample_count):
    results = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        for device in ("desktop", "mobile"):
            for route in ("landing", "login"):
                for number in range(1, sample_count + 1):
                    results.append(await measure_one(browser, base_url, device, route, number))
        await browser.close()

    summary = {}
    for device in ("desktop", "mobile"):
        for route in ("landing", "login"):
            rows = [row for row in results if row["device"] == device and row["route"] == route]
            key = f"{device}_{route}"
            summary[key] = {
                "runs": len(rows),
                "validFcpSamples": sum(row["fcpMs"] is not None for row in rows),
                "validLcpSamples": sum(row["lcpMs"] is not None for row in rows),
                "fcpP75Ms": nearest_rank_p75([row["fcpMs"] for row in rows]),
                "lcpP75Ms": nearest_rank_p75([row["lcpMs"] for row in rows]),
                "interactionDurationP75Ms": nearest_rank_p75([row["maxInteractionDurationMs"] for row in rows]),
                "maxCls": max((row["cls"] for row in rows), default=0),
            }

    return {
        "environment": "Chromium headless, local Vite production preview, unthrottled localhost; lab only, not field data",
        "viewport": {"desktop": "1440x900", "mobile": "390x844"},
        "samplesPerRouteAndDevice": sample_count,
        "interactionMetric": "maximum Event Timing duration grouped by interactionId; a lab proxy, not a field INP percentile",
        "summary": summary,
        "samples": results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:4173")
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()
    if args.samples < 1 or args.samples > 25:
        parser.error("--samples must be between 1 and 25")
    print(json.dumps(asyncio.run(run(args.base_url, args.samples)), indent=2))


if __name__ == "__main__":
    main()
