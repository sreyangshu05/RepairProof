"""Browser smoke coverage for public and access-controlled RepairProof screens.

Run: python -m pytest apps/web/tests/e2e -q
Requires the Vite app at REPAIRPROOF_WEB_URL (default http://127.0.0.1:5173)
and an installed Playwright Chromium browser. Authenticated screen tests mock API responses.
"""
import os
import re

import pytest
from playwright.sync_api import Browser, Page, expect, sync_playwright

BASE_URL = os.getenv("REPAIRPROOF_WEB_URL", "http://127.0.0.1:5173")


def authenticate(page: Page, role: str = "TECHNICIAN", workspace_cases: list[dict] | None = None):
    page.route("**/api/auth/login", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=(
            '{"success":true,"data":{"token":"e2e-session-token","user":'
            '{"id":"test-user","email":"test@example.invalid",'
            f'"displayName":"Test User","role":"{role}",'
            '"shop":{"id":"test-shop","name":"Test Repair Shop"}}}}'
        ),
    ))
    page.route("**/api/auth/me", lambda route: route.fulfill(status=200, content_type="application/json", body=(
        '{"success":true,"data":{"userId":"test-user","email":"test@example.invalid",'
        f'"displayName":"Test User","role":"{role}","shopId":"test-shop",'
        '"shop":{"id":"test-shop","name":"Test Repair Shop"}}}'
    )))
    page.route("**/api/cases/workspace", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        json={
            "success": True,
            "data": {
                "technician": {
                    "id": "test-user",
                    "displayName": "Test User",
                    "organizationName": "Test Repair Shop",
                },
                "cases": workspace_cases or [],
            },
        },
    ))
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.get_by_label("Email address").fill("test@example.invalid")
    page.get_by_label("Password").fill("test-password")
    page.get_by_role("button", name="Sign in").click()
    destination = {
        "TECHNICIAN": "/technician/dashboard",
        "SHOP_OWNER": "/shop/dashboard",
        "PLATFORM_ADMIN": "/admin/overview",
    }[role]
    expect(page).to_have_url(f"{BASE_URL}{destination}")


@pytest.fixture(scope="session")
def browser_context_args():
    return {"viewport": {"width": 1440, "height": 1000}, "reduced_motion": "reduce"}


@pytest.fixture(scope="session")
def browser() -> Browser:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser: Browser, browser_context_args: dict) -> Page:
    context = browser.new_context(**browser_context_args)
    page = context.new_page()
    yield page
    context.close()


@pytest.mark.parametrize("width", [320, 360, 390, 768, 1024, 1440, 1920])
def test_public_page_fits_supported_viewports(page: Page, width: int):
    page.set_viewport_size({"width": width, "height": 900})
    response = page.goto(BASE_URL, wait_until="networkidle")
    assert response and response.status == 200
    expect(page.get_by_role("heading", level=1)).to_have_count(1)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert page.get_by_role("link", name="Create a workspace").first.is_visible()


def test_public_navigation_and_keyboard_focus(page: Page):
    page.goto(BASE_URL, wait_until="networkidle")
    links = page.get_by_role("link").all()
    assert links, "the landing page should expose useful navigation links"
    for link in links:
        assert (link.get_attribute("href") or "").strip(), "every visible link needs a destination"
    page.keyboard.press("Tab")
    expect(page.locator(":focus")).to_be_visible()
    assert page.evaluate("document.activeElement.tagName") in {"A", "BUTTON"}


def test_public_page_language_and_preview_tabs_support_keyboard_navigation(page: Page):
    page.goto(BASE_URL, wait_until="networkidle")
    assert page.locator("html").get_attribute("lang") == "en-IN"
    passport_tab = page.get_by_role("tab", name="Passport")
    evidence_tab = page.get_by_role("tab", name="Evidence & checks")
    passport_tab.focus()
    page.keyboard.press("ArrowRight")
    expect(evidence_tab).to_have_attribute("aria-selected", "true")
    panel_id = evidence_tab.get_attribute("aria-controls")
    assert panel_id
    panel = page.locator(f'[id="{panel_id}"]')
    expect(panel).to_be_visible()
    expect(panel).to_contain_text("Intake condition")


def test_semantic_theme_color_pairs_meet_text_contrast(page: Page):
    page.goto(BASE_URL, wait_until="networkidle")
    for theme_class in ("", "dark"):
        page.locator("html").evaluate(
            "(el, name) => name ? el.classList.add(name) : el.classList.remove('dark')",
            theme_class,
        )
        tokens = page.evaluate("""() => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(['--background','--foreground','--muted-foreground',
            '--primary','--primary-foreground','--destructive','--destructive-foreground']
            .map(key => [key, style.getPropertyValue(key).trim()]));
        }""")
        parsed = {key: tuple(float(x) for x in re.findall(r"[\d.]+", value)) for key, value in tokens.items()}

        def luminance(hsl):
            import colorsys
            hue, saturation, lightness = hsl
            rgb = colorsys.hls_to_rgb(hue / 360, lightness / 100, saturation / 100)
            linear = [channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4 for channel in rgb]
            return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]

        def contrast(first, second):
            bright, dim = sorted((luminance(first), luminance(second)), reverse=True)
            return (bright + .05) / (dim + .05)

        for foreground, background in (
            ("--foreground", "--background"),
            ("--muted-foreground", "--background"),
            ("--primary-foreground", "--primary"),
            ("--destructive-foreground", "--destructive"),
        ):
            assert contrast(parsed[foreground], parsed[background]) >= 4.5, (
                f"{theme_class or 'light'} theme: {foreground} on {background} "
                f"must meet 4.5:1 for normal text"
            )


@pytest.mark.parametrize("path", ["/", "/login", "/technician/dashboard"])
@pytest.mark.parametrize("theme", ["light", "dark"])
def test_rendered_text_contrast_on_primary_screens(page: Page, path: str, theme: str):
    if path == "/technician/dashboard":
        authenticate(page)
    if theme == "dark":
        page.add_init_script("document.documentElement.classList.add('dark')")
    page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    violations = page.evaluate(r"""() => {
      const parse = value => {
        const parts = value.match(/[\d.]+/g)?.map(Number) || [];
        return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
      };
      const composite = (front, back) => front.rgb.map((channel, i) => channel * front.alpha + back[i] * (1 - front.alpha));
      const luminance = rgb => {
        const c = rgb.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
      };
      const ratio = (a, b) => {
        const high = Math.max(luminance(a), luminance(b));
        const low = Math.min(luminance(a), luminance(b));
        return (high + .05) / (low + .05);
      };
      const visible = el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
      };
      const violations = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el) || ['SCRIPT','STYLE','SVG','PATH'].includes(el.tagName)) continue;
        const text = [...el.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').trim();
        if (!text) continue;
        const style = getComputedStyle(el);
        const size = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
        const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        let bg = [255,255,255];
        const chain = [];
        for (let node = el; node && node.nodeType === 1; node = node.parentElement) chain.push(node);
        for (const node of chain.reverse()) {
          const color = parse(getComputedStyle(node).backgroundColor);
          if (color.alpha > 0) bg = composite(color, bg);
        }
        const fg = parse(style.color);
        const ratioValue = ratio(composite(fg, bg), bg);
        if (ratioValue + .01 < required) violations.push({text: text.slice(0,80), ratio: Number(ratioValue.toFixed(2)), required, color: style.color, background: bg.map(Math.round)});
      }
      return violations.slice(0, 30);
    }""")
    assert not violations, f"rendered normal/large text must meet contrast: {violations}"


def test_workspace_skip_link_and_route_change_move_keyboard_context(page: Page):
    authenticate(page)
    skip_link = page.get_by_role("link", name="Skip to main content")
    skip_link.focus()
    expect(skip_link).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.get_by_role("main")).to_be_focused()
    page.get_by_role("link", name="Repair inbox").click()
    expect(page.get_by_role("heading", name="Repair inbox", level=1)).to_be_focused()


def test_landing_scripted_scroll_respects_reduced_motion(page: Page):
    page.add_init_script("""Element.prototype.scrollIntoView = function(options) {
      window.__lastScrollOptions = options;
    };""")
    page.emulate_media(reduced_motion="reduce")
    page.goto(BASE_URL, wait_until="networkidle")
    page.get_by_role("button", name="Take a look inside").click()
    assert page.evaluate("window.__lastScrollOptions.behavior") == "auto"


@pytest.mark.parametrize("path", ["/", "/login", "/signup", "/verify", "/consumer/login"])
def test_public_and_login_pages_have_landmarks_names_and_valid_aria_references(page: Page, path: str):
    page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    assert page.get_by_role("main").count() == 1
    assert page.get_by_role("heading", level=1).count() == 1
    audit = page.evaluate("""() => {
      const visible = el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const controls = [...document.querySelectorAll('a,button,input,select,textarea,[role="tab"]')].filter(visible);
      const unnamed = controls.filter(el => {
        const text = el.innerText || el.value || '';
        const label = el.labels?.[0]?.innerText || '';
        return !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || label || text || el.getAttribute('alt'));
      }).map(el => el.outerHTML.slice(0, 180));
      const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
      const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
      const brokenRefs = [...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')]
        .flatMap(el => ['aria-labelledby','aria-describedby','aria-controls']
          .flatMap(attr => (el.getAttribute(attr) || '').split(/\\s+/).filter(Boolean)
            .filter(id => !document.getElementById(id)).map(id => `${attr}=${id}`)));
      return { unnamed, duplicates, brokenRefs };
    }""")
    assert not audit["unnamed"], f"visible controls need accessible names: {audit['unnamed']}"
    assert not audit["duplicates"], f"IDs must be unique: {audit['duplicates']}"
    assert not audit["brokenRefs"], f"ARIA references must resolve: {audit['brokenRefs']}"


def test_private_workspace_redirects_to_login_without_a_session(page: Page):
    page.goto(f"{BASE_URL}/technician/dashboard", wait_until="networkidle")
    expect(page).to_have_url(f"{BASE_URL}/login")
    expect(page.get_by_role("heading", name="Welcome back", level=1)).to_be_visible()


def test_invalid_credentials_do_not_create_a_local_session(page: Page):
    page.route("**/api/auth/login", lambda route: route.fulfill(status=401, content_type="application/json", body='{"message":"Email or password is incorrect"}'))
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.get_by_label("Email address").fill("wrong@example.invalid")
    page.get_by_label("Password").fill("wrong-password")
    page.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("alert")).to_contain_text("Email or password is incorrect")
    expect(page).to_have_url(f"{BASE_URL}/login")
    assert page.evaluate("localStorage.getItem('rp_auth_token')") is None


@pytest.mark.parametrize(
    ("path", "heading", "nav_name"),
    [
        ("/consumer/login", "Access your repair record", ""),
        ("/technician/dashboard", "Workbench", "Repair inbox"),
        ("/shop/dashboard", "Business overview", "Staff"),
        ("/admin/overview", "Platform overview", "Organizations"),
    ],
)
def test_role_workspaces_have_separate_navigation(page: Page, path: str, heading: str, nav_name: str):
    if path == "/consumer/login":
        page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
        expect(page.get_by_role("heading", name=heading, level=1)).to_be_visible()
        return
    role = "PLATFORM_ADMIN" if path.startswith("/admin") else "SHOP_OWNER" if path.startswith("/shop") else "TECHNICIAN"
    authenticate(page, role)
    expect(page.get_by_role("heading", name=heading, level=1)).to_be_visible()
    expect(page.get_by_role("link", name=nav_name)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def test_technician_can_navigate_between_queue_and_diagnostic_workspace(page: Page):
    authenticate(page)
    page.get_by_role("link", name="Repair inbox").click()
    expect(page).to_have_url(f"{BASE_URL}/technician/inbox")
    expect(page.get_by_role("heading", name="Repair inbox", level=1)).to_be_visible()
    page.get_by_role("link", name="Diagnostics").click()
    expect(page).to_have_url(f"{BASE_URL}/technician/diagnostics")
    expect(page.get_by_role("heading", name="Diagnostic workspace", level=1)).to_be_visible()


def test_mobile_navigation_traps_focus_and_escape_restores_the_trigger(page: Page):
    page.set_viewport_size({"width": 390, "height": 844})
    authenticate(page)
    trigger = page.get_by_role("button", name="Open navigation")
    trigger.click()
    dialog = page.get_by_role("dialog", name="Technician workspace navigation")
    expect(dialog).to_be_visible()
    first = dialog.get_by_role("link", name="Workbench")
    expect(first).to_be_focused()
    page.keyboard.press("Shift+Tab")
    expect(dialog.get_by_role("link", name="Evidence capture")).to_be_focused()
    page.keyboard.press("Escape")
    expect(dialog).to_have_count(0)
    expect(page.get_by_role("button", name="Open navigation")).to_be_focused()


def test_repair_confirmation_dialog_has_name_traps_focus_and_restores_focus(page: Page):
    authenticate(page, workspace_cases=[{
        "id": "case-dialog-test", "reference": "RP-TEST-1", "status": "in_repair",
        "priority": "standard", "customerName": "Example Customer", "customerContact": "customer@example.invalid",
        "device": {"manufacturer": "Example", "model": "Device"}, "issueSummary": "Repair in progress.",
        "createdAt": "2026-11-01T00:00:00Z", "updatedAt": "2026-11-01T00:00:00Z",
        "assignedTechnician": "Test User", "diagnostics": None, "evidence": [], "quotation": None,
        "tests": [], "warranty": None,
    }])
    page.get_by_role("link", name="Repair tracker").click()
    page.get_by_label("Action performed").fill("Replaced damaged connector")
    trigger = page.get_by_role("button", name="Review repair log entry")
    trigger.click()
    dialog = page.get_by_role("dialog", name="Add this action to the repair record?")
    expect(dialog).to_be_visible()
    expect(dialog).to_have_attribute("aria-modal", "true")
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement.closest('[role=dialog]') !== null")
    page.keyboard.press("Escape")
    expect(dialog).to_have_count(0)
    expect(trigger).to_be_focused()


def test_legacy_repair_bookmark_redirects_to_current_repair_inbox(page: Page):
    authenticate(page)
    page.evaluate("""() => {
      history.pushState({}, '', '/legacy/cases');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }""")
    expect(page).to_have_url(f"{BASE_URL}/technician/inbox")
    expect(page.get_by_role("heading", name="Repair inbox", level=1)).to_be_visible()


@pytest.mark.parametrize("width", [320, 390, 768])
def test_visible_mobile_controls_meet_touch_size_and_have_names(page: Page, width: int):
    page.set_viewport_size({"width": width, "height": 844})
    authenticate(page)
    invalid = page.locator("a:visible,button:visible,input:visible,select:visible,textarea:visible").evaluate_all(
        "els => els.filter(el => { const target = el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.labels?.[0] || el) : el; const r=target.getBoundingClientRect(); const name=el.getAttribute('aria-label') || el.innerText || el.labels?.[0]?.innerText || el.getAttribute('title'); return r.height < 44 || !String(name || '').trim(); }).map(el => ({tag:el.tagName, name:el.getAttribute('aria-label') || el.innerText || el.labels?.[0]?.innerText, height:(el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.labels?.[0] || el) : el).getBoundingClientRect().height}))"
    )
    assert not invalid, f"visible controls need accessible names and 44px targets: {invalid}"
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

