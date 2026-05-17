"""Live browser walkthrough of /builder. Saves screenshots and a JSON report."""
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

OUT = Path(r"D:\projects\taskloom\tmp\builder-test")
OUT.mkdir(parents=True, exist_ok=True)

WEB = "http://localhost:7341"
EMAIL = "alpha@taskloom.local"
PASSWORD = "demo12345"

console_errors = []
network_failures = []
events = []

def log(msg):
    print(f"[walk] {msg}", flush=True)
    events.append({"t": time.time(), "msg": msg})

def shoot(page, name):
    p = OUT / f"{name}.png"
    try:
        page.screenshot(path=str(p), full_page=True)
        log(f"shot -> {p.name}")
    except Exception as e:
        log(f"SHOT FAIL {name}: {e}")

def has_signin_form(page):
    try:
        if page.locator("input[type='password']").count() > 0:
            return True
    except Exception:
        pass
    try:
        if page.get_by_text("Sign in", exact=False).first.is_visible(timeout=500):
            if page.locator("input[type='email']").count() > 0:
                return True
    except Exception:
        pass
    return False

def attempt_signin(page):
    log("attempting sign-in")
    shoot(page, "02_signin_visible")
    email = page.locator("input[type='email'], input[name='email']").first
    pwd = page.locator("input[type='password'], input[name='password']").first
    email.fill(EMAIL)
    pwd.fill(PASSWORD)
    shoot(page, "03_signin_filled")
    btn = page.locator("button[type='submit'], button:has-text('Sign in'), button:has-text('Log in')").first
    btn.click()
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PWTimeout:
        pass
    page.wait_for_timeout(800)
    log(f"after sign-in submit, url={page.url}")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        page.on("console", lambda m: (
            console_errors.append({"type": m.type, "text": m.text, "loc": str(m.location)})
            if m.type in ("error", "warning") else None
        ))
        page.on("requestfailed", lambda r: network_failures.append({
            "url": r.url, "method": r.method, "failure": str(r.failure)
        }))
        def on_response(resp):
            try:
                s = resp.status
                if s >= 400:
                    network_failures.append({"url": resp.url, "status": s, "method": resp.request.method})
            except Exception:
                pass
        page.on("response", on_response)

        # 1. Go to /builder
        log("GOTO /builder")
        try:
            page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=20000)
        except PWTimeout:
            page.goto(f"{WEB}/builder", wait_until="load", timeout=20000)
        page.wait_for_timeout(900)
        log(f"url={page.url}")
        shoot(page, "01_initial")

        if has_signin_form(page):
            attempt_signin(page)
            if "/builder" not in page.url:
                page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(800)
        else:
            log("no sign-in form on initial /builder")

        # ensure we are at /builder, post-auth
        if "/builder" not in page.url:
            page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(800)
        shoot(page, "04_builder_cold_start")
        (OUT / "04_builder_cold_start.html").write_text(page.content(), encoding="utf-8")

        # 2. Cold start probe
        cold = {"url": page.url}
        # sidebar
        sidebars = page.locator("aside, nav[aria-label*='sidebar' i], [data-sidebar], .sidebar, [class*='sidebar' i]")
        cold["sidebar_count"] = sidebars.count()
        vis = []
        for i in range(min(cold["sidebar_count"], 6)):
            try:
                el = sidebars.nth(i)
                if el.is_visible():
                    vis.append({"i": i, "box": el.bounding_box(), "tag": el.evaluate("e=>e.tagName"), "classes": el.evaluate("e=>e.className")})
            except Exception as e:
                vis.append({"i": i, "err": str(e)})
        cold["sidebars_visible"] = vis

        try:
            h = page.locator("header").first
            cold["header_text"] = h.inner_text(timeout=2000)
            cold["header_box"] = h.bounding_box()
        except Exception as e:
            cold["header_err"] = str(e)

        for needle in [
            "What do you want to build today",
            "Lightweight CRM",
            "Customer portal",
            "Standup digest agent",
            "Support triage agent",
            "New build",
        ]:
            try:
                cold[f"present::{needle}"] = page.get_by_text(needle, exact=False).first.is_visible(timeout=1200)
            except Exception:
                cold[f"present::{needle}"] = False

        for needle in ["Build an app", "Build an agent", "claude-", "gpt-4", "model preset"]:
            try:
                cold[f"FORBID::{needle}"] = page.get_by_text(needle, exact=False).first.is_visible(timeout=600)
            except Exception:
                cold[f"FORBID::{needle}"] = False

        try:
            ta = page.locator("textarea, [contenteditable='true']").first
            cold["composer_box"] = ta.bounding_box()
        except Exception as e:
            cold["composer_err"] = str(e)

        (OUT / "cold_probe.json").write_text(json.dumps(cold, indent=2, default=str), encoding="utf-8")
        log("cold probe saved")

        # 3. Click Lightweight CRM chip
        before_url = page.url
        try:
            chip = page.get_by_text("Lightweight CRM", exact=False).first
            chip.click(timeout=5000)
            page.wait_for_timeout(1500)
            after_url = page.url
            try:
                ta_val = page.locator("textarea").first.input_value(timeout=2000)
            except Exception:
                ta_val = "<no textarea>"
            log(f"chip click: url_changed={before_url != after_url}, textarea='{ta_val[:140]}'")
            (OUT / "chip_result.json").write_text(json.dumps({
                "before_url": before_url, "after_url": after_url,
                "textarea_value": ta_val,
                "looks_auto_submitted": before_url != after_url,
            }, indent=2), encoding="utf-8")
            shoot(page, "05_after_chip_click")
        except Exception as e:
            log(f"chip click failed: {e}")
            (OUT / "chip_result.json").write_text(json.dumps({"err": str(e)}, indent=2), encoding="utf-8")

        # 4. Custom prompt
        try:
            # if we drifted away from compose, go home
            if "/builder" not in page.url or page.url.rstrip("/").endswith("/builder") is False:
                # may still be in draft view; check for textarea
                pass
            ta = page.locator("textarea").first
            if ta.count() == 0 or not ta.is_visible():
                log("composer not visible; going back to /builder")
                page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(800)
                ta = page.locator("textarea").first
            ta.click()
            ta.fill("")
            ta.fill("Build a simple todo tracker")
            shoot(page, "06_prompt_typed")
            build_btn = None
            for sel in [
                "button:has-text('Build')",
                "button:has-text('Generate')",
                "button:has-text('Submit')",
                "button[type='submit']",
                "button[aria-label*='build' i]",
                "button[aria-label*='send' i]",
            ]:
                cand = page.locator(sel).first
                try:
                    if cand.count() > 0 and cand.is_visible():
                        build_btn = (sel, cand)
                        break
                except Exception:
                    continue
            if build_btn is None:
                log("no build button; trying Ctrl+Enter")
                ta.press("Control+Enter")
            else:
                log(f"clicking build btn '{build_btn[0]}'")
                build_btn[1].click()
            page.wait_for_timeout(2500)
            shoot(page, "07_drafting_state")

            # wait up to 120s for draft
            draft_ready = False
            saw_streaming = False
            start = time.time()
            while time.time() - start < 120:
                try:
                    approve = page.locator("button:has-text('Approve'), button:has-text('Apply')").first
                    if approve.count() > 0 and approve.is_visible():
                        draft_ready = True
                        log(f"draft ready after {time.time()-start:.1f}s")
                        break
                except Exception:
                    pass
                # heuristic for streaming text
                txt_now = page.locator("body").inner_text()
                if any(s in txt_now.lower() for s in ["streaming", "drafting", "generating", "thinking"]):
                    saw_streaming = True
                page.wait_for_timeout(2000)
            shoot(page, "08_after_wait")
            (OUT / "draft_state.json").write_text(json.dumps({
                "draft_ready": draft_ready,
                "saw_streaming_text": saw_streaming,
                "url": page.url,
            }, indent=2), encoding="utf-8")

            # 5. Approve
            if draft_ready:
                shoot(page, "09_draft_visible")
                approve = page.locator("button:has-text('Approve'), button:has-text('Apply')").first
                approve.click()
                log("clicked Approve")
                page.wait_for_timeout(1500)
                shoot(page, "10_applying")
                post_ok = False
                start = time.time()
                while time.time() - start < 90:
                    prev = page.locator("text=Preview").first
                    if prev.count() > 0 and prev.is_visible():
                        post_ok = True
                        break
                    page.wait_for_timeout(1500)
                shoot(page, "11_after_approve")
                log(f"post-approve ready: {post_ok}")
                (OUT / "approve_state.json").write_text(json.dumps({"post_ok": post_ok, "url": page.url}, indent=2), encoding="utf-8")

                # 6. Tabs
                tab_report = {}
                tabs = ["Preview", "Source", "Quality", "Activity", "Runs", "Saves", "Publish"]
                for t in tabs:
                    try:
                        loc = page.get_by_text(t, exact=False).first
                        visible = loc.is_visible(timeout=1500)
                        if visible:
                            txt = loc.inner_text(timeout=1500)
                            is_upper = txt == txt.upper() and any(c.isalpha() for c in txt)
                            try:
                                loc.click()
                            except Exception as ce:
                                tab_report.setdefault(t, {})["click_err"] = str(ce)
                            page.wait_for_timeout(1200)
                            shoot(page, f"12_tab_{t.lower()}")
                            entry = tab_report.setdefault(t, {})
                            entry["visible"] = True
                            entry["text"] = txt
                            entry["is_all_caps"] = is_upper
                            if t == "Preview":
                                entry["iframe_count"] = page.locator("iframe").count()
                                if entry["iframe_count"] > 0:
                                    try:
                                        entry["iframe_src"] = page.locator("iframe").first.get_attribute("src")
                                    except Exception as e:
                                        entry["iframe_err"] = str(e)
                        else:
                            tab_report[t] = {"visible": False}
                    except Exception as e:
                        tab_report[t] = {"err": str(e)}
                (OUT / "tab_report.json").write_text(json.dumps(tab_report, indent=2), encoding="utf-8")
        except Exception as e:
            log(f"custom prompt flow failed: {e}")
            shoot(page, "ZZ_error")
            (OUT / "flow_err.json").write_text(json.dumps({"err": str(e)}, indent=2), encoding="utf-8")

        (OUT / "console_errors.json").write_text(json.dumps(console_errors, indent=2), encoding="utf-8")
        (OUT / "network_failures.json").write_text(json.dumps(network_failures, indent=2, default=str), encoding="utf-8")
        (OUT / "events.json").write_text(json.dumps(events, indent=2), encoding="utf-8")
        log(f"DONE console_errors={len(console_errors)} network_failures={len(network_failures)}")
        browser.close()

if __name__ == "__main__":
    run()
