"""Live browser product review for Fork B (Phase 2)."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

ROOT = Path(r"D:\projects\taskloom\tmp\fork-b-review")
ROOT.mkdir(parents=True, exist_ok=True)
WEB = "http://localhost:7341"
API = "http://localhost:8484"
EMAIL = "alpha@taskloom.local"
PASSWORD = "demo12345"

console_log: list[dict] = []
net_log: list[dict] = []
findings: dict = {
    "claim_1_streaming": "PENDING",
    "claim_2_click_to_edit": "PENDING",
    "claim_3_revert": "PENDING",
    "claim_4_persistence": "PENDING",
    "claim_5_phase1_regressions": "PENDING",
    "claim_6_naming": "PENDING",
    "claim_7_cloud_md": "PENDING",
    "claim_8_errors": "PENDING",
    "notes": [],
}

def shot(page, name: str) -> None:
    path = ROOT / f"{name}.png"
    try:
        page.screenshot(path=str(path), full_page=True)
        print(f"[shot] {path.name}")
    except Exception as e:
        print(f"[shot FAIL] {name}: {e}")

def log(msg: str) -> None:
    print(f"[log] {msg}")
    findings["notes"].append(msg)

def attach_listeners(page) -> None:
    def on_console(msg):
        try:
            entry = {"type": msg.type, "text": msg.text, "location": msg.location}
        except Exception:
            entry = {"type": msg.type, "text": str(msg)}
        console_log.append(entry)
        if msg.type in ("error", "warning"):
            print(f"[console.{msg.type}] {msg.text[:200]}")
    def on_response(resp):
        try:
            status = resp.status
            if status >= 400 and "/api" in resp.url:
                net_log.append({"url": resp.url, "status": status, "method": resp.request.method})
                print(f"[net {status}] {resp.request.method} {resp.url}")
        except Exception:
            pass
    page.on("console", on_console)
    page.on("response", on_response)
    page.on("pageerror", lambda e: console_log.append({"type": "pageerror", "text": str(e)}))

def sign_in(page) -> None:
    page.goto(f"{WEB}/", wait_until="networkidle")
    shot(page, "01-landing")
    # Look for sign-in link/page
    try:
        page.goto(f"{WEB}/sign-in", wait_until="networkidle", timeout=10000)
    except PlaywrightTimeout:
        pass
    shot(page, "02-sign-in")
    # Fill credentials
    email_input = page.locator('input[type="email"], input[name="email"], input[id*="email" i]').first
    pwd_input = page.locator('input[type="password"], input[name="password"]').first
    email_input.wait_for(timeout=8000)
    email_input.fill(EMAIL)
    pwd_input.fill(PASSWORD)
    # Find submit
    submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first
    submit.click()
    page.wait_for_load_state("networkidle", timeout=15000)
    shot(page, "03-after-signin")

def goto_builder(page) -> None:
    page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    shot(page, "04-builder-cold-start")

def check_back_chevron(page) -> str:
    # Look for back chevron in cold start header
    try:
        links_to_home = page.locator('a[href="/"]').all()
        if not links_to_home:
            return "missing"
        # Check if any contains an svg/chevron icon
        for a in links_to_home:
            html = a.inner_html()
            if "svg" in html.lower() or "chevron" in html.lower() or "arrow" in html.lower() or "&larr;" in html or "←" in (a.text_content() or ""):
                return "present"
        return f"present-no-icon ({len(links_to_home)} links to /)"
    except Exception as e:
        return f"err:{e}"

def find_composer(page):
    # Look for the prompt textarea
    selectors = [
        'textarea[placeholder*="Build" i]',
        'textarea[placeholder*="describe" i]',
        'textarea[placeholder*="What" i]',
        'textarea',
    ]
    for sel in selectors:
        loc = page.locator(sel).first
        try:
            loc.wait_for(timeout=2500, state="visible")
            return loc
        except PlaywrightTimeout:
            continue
    return None

def find_build_button(page):
    candidates = [
        'button:has-text("Build")',
        'button:has-text("Generate")',
        'button:has-text("Send")',
        'button[aria-label*="send" i]',
        'button[type="submit"]',
    ]
    for sel in candidates:
        loc = page.locator(sel).first
        try:
            if loc.is_visible(timeout=1500):
                return loc
        except Exception:
            continue
    return None

def submit_prompt(page, prompt: str) -> None:
    composer = find_composer(page)
    if composer is None:
        log(f"NO composer found for prompt: {prompt}")
        return
    composer.fill(prompt)
    page.wait_for_timeout(300)
    btn = find_build_button(page)
    if btn is None:
        composer.press("Control+Enter")
    else:
        btn.click()

def test_streaming(page) -> None:
    log("=== claim 1: streaming ===")
    composer = find_composer(page)
    if composer is None:
        findings["claim_1_streaming"] = "BROKEN: no composer"
        return
    composer.fill("Build a simple todo tracker")
    page.wait_for_timeout(300)
    shot(page, "05-prompt-typed")
    btn = find_build_button(page)
    samples: list[tuple[float, int]] = []
    t0 = time.time()
    if btn:
        btn.click()
    else:
        composer.press("Control+Enter")
    # Sample the chat thread length every 250ms for 12s
    chat_sel = '[class*="thread" i], [class*="messages" i], [class*="conversation" i], [data-testid*="message" i], main'
    for _ in range(48):
        try:
            text = page.evaluate("() => document.body.innerText")
            samples.append((time.time() - t0, len(text)))
        except Exception:
            pass
        page.wait_for_timeout(250)
        try:
            # Stop early if a draft tabset appears
            if page.locator('text=/draft|approve|plan steps|page map/i').first.is_visible(timeout=200):
                break
        except Exception:
            pass
    deltas = [samples[i][1] - samples[i-1][1] for i in range(1, len(samples))]
    growing = sum(1 for d in deltas if d > 0)
    big_jump = sum(1 for d in deltas if d > 400)
    log(f"streaming samples: growing={growing}/{len(deltas)} bigJumps={big_jump} totalText={samples[-1][1] if samples else 0}")
    findings["_streaming_samples"] = samples[:20]
    if growing >= 3 and big_jump < growing:
        findings["claim_1_streaming"] = "WORKS (text grew incrementally, but template fallback expected without ANTHROPIC_API_KEY)"
    elif growing >= 1:
        findings["claim_1_streaming"] = f"DEGRADED (text grew in {growing} ticks; likely template fallback teleport)"
    else:
        findings["claim_1_streaming"] = "BROKEN (no growth observed)"
    shot(page, "06-after-build-click")
    # Wait a bit more for draft
    page.wait_for_timeout(3000)
    shot(page, "07-draft-rendered")

def test_naming(page) -> None:
    log("=== claim 6: naming ===")
    try:
        # Look for app name in the visible draft
        body = page.evaluate("() => document.body.innerText")
        # find names containing 'Tracker' or 'Todo' or 'Task'
        m = re.search(r"([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\s*(?:\n|·| · | — )", body)
        candidates = re.findall(r"\b(?:Simple|Lightweight|Basic)?\s*(?:Todo|Task)\s*(?:Tracker|Manager|App|List)\b", body, flags=re.IGNORECASE)
        log(f"name candidates: {candidates[:6]}")
        if any("simple task tracker" in c.lower() for c in candidates):
            findings["claim_6_naming"] = "WORKS (Simple Task Tracker)"
        elif any("simple todo tracker" in c.lower() for c in candidates):
            findings["claim_6_naming"] = "WORKS (Simple Todo Tracker - bonus)"
        elif candidates:
            findings["claim_6_naming"] = f"DEGRADED (got: {candidates[0]})"
        else:
            findings["claim_6_naming"] = "UNCLEAR (no obvious task/todo name surfaced)"
    except Exception as e:
        findings["claim_6_naming"] = f"err:{e}"

def approve_draft(page) -> bool:
    # Find Approve button
    candidates = [
        'button:has-text("Approve")',
        'button:has-text("Apply")',
        'button:has-text("Save")',
        'button:has-text("Accept")',
    ]
    for sel in candidates:
        loc = page.locator(sel).first
        try:
            if loc.is_visible(timeout=2000):
                loc.click()
                page.wait_for_load_state("networkidle", timeout=20000)
                page.wait_for_timeout(1500)
                return True
        except Exception:
            continue
    return False

def test_phase1_regressions(page) -> None:
    log("=== claim 5: phase1 regressions ===")
    results = {}
    body = page.evaluate("() => document.body.innerText")
    # SAVED PREVIEW vs Saved preview
    if "SAVED PREVIEW" in body:
        results["saved_preview_case"] = "BROKEN (uppercase still present)"
    elif "Saved preview" in body:
        results["saved_preview_case"] = "WORKS"
    else:
        results["saved_preview_case"] = "N/A (string not on page)"
    # back chevron
    results["back_chevron"] = check_back_chevron(page)
    # Saves tab badge
    if re.search(r"Saves\d+", body):
        results["saves_badge"] = "BROKEN (Saves followed immediately by digit)"
    elif re.search(r"Saves\s*[·•]\s*\d", body):
        results["saves_badge"] = "WORKS (separator present)"
    else:
        results["saves_badge"] = f"UNCLEAR (Saves token: {bool(re.search('Saves', body))})"
    # Eyebrow
    results["eyebrow"] = "WORKS (no 'Generated Taskloom app')" if "Generated Taskloom app" not in body else "BROKEN (still present)"
    log(f"phase1: {results}")
    findings["claim_5_phase1_regressions"] = results

def test_click_to_edit(page) -> None:
    log("=== claim 2: click-to-edit overlay ===")
    # find the preview iframe
    frames = page.frames
    log(f"frames: {[f.url for f in frames]}")
    preview_frame = None
    for f in frames:
        if "/preview/" in f.url or "/api/app/generated-apps" in f.url:
            preview_frame = f
            break
    if preview_frame is None:
        # try to find an iframe element
        ifr = page.locator("iframe").first
        try:
            ifr.wait_for(timeout=3000)
            handle = ifr.element_handle()
            if handle:
                preview_frame = handle.content_frame()
        except Exception:
            pass
    if preview_frame is None:
        findings["claim_2_click_to_edit"] = "BROKEN (no preview iframe found)"
        return
    log(f"preview frame url: {preview_frame.url}")
    # Hover an element
    try:
        target = preview_frame.locator("button, h1, h2, input, [data-testid]").first
        target.wait_for(timeout=4000)
        target.hover()
        page.wait_for_timeout(400)
        shot(page, "08-hover-no-mod")
        # Check for an outline overlay - inspect computed styles on the target, or look for an element with outline
        has_outline = preview_frame.evaluate("""
            () => {
              const all = document.querySelectorAll('*');
              for (const el of all) {
                const cs = getComputedStyle(el);
                if ((cs.outlineStyle && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
                    (cs.boxShadow && cs.boxShadow.includes('inset'))) {
                  return true;
                }
              }
              return false;
            }
        """)
        # Now with Ctrl
        page.keyboard.down("Control")
        target.hover()
        page.wait_for_timeout(400)
        shot(page, "09-hover-with-ctrl")
        has_outline_mod = preview_frame.evaluate("""
            () => {
              const all = document.querySelectorAll('*');
              for (const el of all) {
                const cs = getComputedStyle(el);
                if ((cs.outlineStyle && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
                    (cs.boxShadow && cs.boxShadow.includes('inset'))) {
                  return true;
                }
              }
              return false;
            }
        """)
        page.keyboard.up("Control")
        # Click element while holding Ctrl
        page.keyboard.down("Control")
        target.click()
        page.keyboard.up("Control")
        page.wait_for_timeout(800)
        shot(page, "10-click-with-ctrl")
        # Look for "Editing:" badge near composer
        outer_body = page.evaluate("() => document.body.innerText")
        editing_badge = "Editing:" in outer_body or re.search(r"Editing\s*[:·]", outer_body)
        log(f"hover_outline={has_outline} hover_outline_mod={has_outline_mod} editing_badge={bool(editing_badge)}")
        verdict = []
        if has_outline_mod and not has_outline:
            verdict.append("modifier-gated outline WORKS")
        elif has_outline_mod and has_outline:
            verdict.append("outline always-on (DEGRADED, no modifier gating)")
        elif not has_outline_mod and not has_outline:
            verdict.append("NO outline observed (BROKEN)")
        verdict.append("editing badge present" if editing_badge else "editing badge MISSING")
        findings["claim_2_click_to_edit"] = "; ".join(verdict)
    except Exception as e:
        findings["claim_2_click_to_edit"] = f"err: {e}"

def test_revert(page) -> None:
    log("=== claim 3: per-message revert ===")
    # Submit a refinement so we have 2 turns
    composer = find_composer(page)
    if composer is None:
        findings["claim_3_revert"] = "BROKEN (no composer for refinement)"
        return
    try:
        composer.fill("Add a notes field to each task")
        page.wait_for_timeout(300)
        btn = find_build_button(page)
        if btn:
            btn.click()
        else:
            composer.press("Control+Enter")
        page.wait_for_timeout(5000)
        approve_draft(page)
        page.wait_for_timeout(1500)
        shot(page, "11-after-refinement")
    except Exception as e:
        log(f"refinement err: {e}")
    # Now hover assistant message and look for revert button
    try:
        # Find assistant message bubbles
        msgs = page.locator('[class*="assistant" i], [data-role="assistant"], [class*="message" i]').all()
        log(f"messages found: {len(msgs)}")
        revert_found = False
        for m in msgs[:6]:
            try:
                m.hover()
                page.wait_for_timeout(400)
                rb = page.locator('button:has-text("Revert"), button[aria-label*="revert" i], button:has-text("↶")').first
                if rb.is_visible(timeout=500):
                    revert_found = True
                    shot(page, "12-revert-button-visible")
                    break
            except Exception:
                continue
        if not revert_found:
            # Last try - look anywhere
            rb = page.locator('button:has-text("Revert"), button:has-text("↶")').first
            if rb.is_visible(timeout=1500):
                revert_found = True
                shot(page, "12-revert-button-visible")
        if revert_found:
            findings["claim_3_revert"] = "Revert button PRESENT on hover"
        else:
            findings["claim_3_revert"] = "BROKEN (no revert button on assistant message hover)"
    except Exception as e:
        findings["claim_3_revert"] = f"err: {e}"

def test_persistence(page) -> None:
    log("=== claim 4: generated-app persistence ===")
    # Find preview iframe again
    preview_frame = None
    for f in page.frames:
        if "/preview/" in f.url or "/generated-apps" in f.url:
            preview_frame = f
            break
    if preview_frame is None:
        ifr = page.locator("iframe").first
        try:
            handle = ifr.element_handle()
            if handle:
                preview_frame = handle.content_frame()
        except Exception:
            pass
    if preview_frame is None:
        findings["claim_4_persistence"] = "BROKEN (no preview iframe)"
        return
    try:
        # Find an input
        inp = preview_frame.locator('input[type="text"], input:not([type]), textarea').first
        inp.wait_for(timeout=4000)
        marker = f"persistence-marker-{int(time.time())}"
        inp.fill(marker)
        page.wait_for_timeout(300)
        # Find submit button
        sb = preview_frame.locator('button[type="submit"], button:has-text("Add"), button:has-text("Create"), button:has-text("Save")').first
        if sb.is_visible(timeout=2000):
            sb.click()
        else:
            inp.press("Enter")
        page.wait_for_timeout(800)
        shot(page, "13-record-created")
        # Reload the iframe
        preview_frame.evaluate("() => window.location.reload()")
        page.wait_for_timeout(2500)
        body = preview_frame.evaluate("() => document.body.innerText")
        shot(page, "14-after-reload")
        if marker in body:
            findings["claim_4_persistence"] = "WORKS (record survived reload)"
        else:
            findings["claim_4_persistence"] = "BROKEN (record gone after reload)"
            findings["_persistence_body_sample"] = body[:400]
    except Exception as e:
        findings["claim_4_persistence"] = f"err: {e}"

def test_cloud_md() -> None:
    log("=== claim 7: CLOUD.md ===")
    p = Path(r"D:\projects\taskloom\CLOUD.md")
    if not p.exists():
        findings["claim_7_cloud_md"] = "BROKEN (missing)"
        return
    text = p.read_text(encoding="utf-8", errors="replace")
    sections = re.findall(r"^##\s+(\d+)\.\s+(.+)$", text, flags=re.MULTILINE)
    findings["_cloud_sections"] = sections
    if len(sections) >= 7:
        findings["claim_7_cloud_md"] = f"WORKS ({len(sections)} numbered sections)"
    else:
        findings["claim_7_cloud_md"] = f"DEGRADED ({len(sections)} sections, expected 7)"

def test_errors() -> None:
    errs = [e for e in console_log if e.get("type") in ("error", "pageerror")]
    bad_net = net_log
    findings["_console_errors"] = errs[:20]
    findings["_bad_responses"] = bad_net[:30]
    if not errs and not bad_net:
        findings["claim_8_errors"] = "WORKS (clean)"
    else:
        findings["claim_8_errors"] = f"DEGRADED (console_errors={len(errs)}, bad_responses={len(bad_net)})"

def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        attach_listeners(page)
        try:
            sign_in(page)
        except Exception as e:
            log(f"sign-in failure: {e}")
            shot(page, "ERR-signin")
        try:
            goto_builder(page)
        except Exception as e:
            log(f"goto builder fail: {e}")
        try:
            test_streaming(page)
        except Exception as e:
            log(f"streaming test err: {e}")
        try:
            test_naming(page)
        except Exception as e:
            log(f"naming test err: {e}")
        # Approve to get a saved preview
        approved = False
        try:
            approved = approve_draft(page)
            log(f"approved={approved}")
            page.wait_for_timeout(3000)
            shot(page, "15-after-approve")
        except Exception as e:
            log(f"approve err: {e}")
        try:
            test_phase1_regressions(page)
        except Exception as e:
            log(f"phase1 err: {e}")
        try:
            test_click_to_edit(page)
        except Exception as e:
            log(f"click-edit err: {e}")
        try:
            test_revert(page)
        except Exception as e:
            log(f"revert err: {e}")
        try:
            test_persistence(page)
        except Exception as e:
            log(f"persistence err: {e}")
        test_cloud_md()
        test_errors()
        # Final dump
        (ROOT / "findings.json").write_text(json.dumps(findings, indent=2, default=str), encoding="utf-8")
        (ROOT / "console.json").write_text(json.dumps(console_log, indent=2, default=str), encoding="utf-8")
        (ROOT / "network.json").write_text(json.dumps(net_log, indent=2, default=str), encoding="utf-8")
        print("=== FINDINGS ===")
        print(json.dumps(findings, indent=2, default=str))
        browser.close()

if __name__ == "__main__":
    main()
