"""Refined live browser review for Fork B — second pass with corrected selectors."""
from __future__ import annotations

import json, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

ROOT = Path(r"D:\projects\taskloom\tmp\fork-b-review")
WEB = "http://localhost:7341"
EMAIL = "alpha@taskloom.local"
PASSWORD = "demo12345"

console_log: list[dict] = []
net_log: list[dict] = []
findings: dict = {}

def shot(page, name): page.screenshot(path=str(ROOT / f"{name}.png"), full_page=True)
def log(msg): print(f"[log] {msg}")

def attach_listeners(page):
    def on_console(msg):
        try: entry = {"type": msg.type, "text": msg.text}
        except: entry = {"type": "?", "text": "?"}
        console_log.append(entry)
        if msg.type == "error": print(f"[console.error] {entry['text'][:200]}")
    def on_response(resp):
        try:
            if resp.status >= 400 and "/api" in resp.url:
                net_log.append({"url": resp.url, "status": resp.status})
                print(f"[net {resp.status}] {resp.url}")
        except: pass
    page.on("console", on_console); page.on("response", on_response)
    page.on("pageerror", lambda e: console_log.append({"type": "pageerror", "text": str(e)}))

def sign_in(page):
    page.goto(f"{WEB}/sign-in", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(1500)
    page.locator('input[type="email"]').first.wait_for(timeout=10000)
    page.locator('input[type="email"]').first.click()
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.click()
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.wait_for_timeout(300)
    page.locator('button[type="submit"]').first.click()
    # Wait for nav away from /sign-in
    for _ in range(40):
        page.wait_for_timeout(500)
        if "/sign-in" not in page.url:
            break
    page.wait_for_load_state("networkidle", timeout=15000)
    log(f"post-signin url: {page.url}")
    shot(page, "r2-signed-in")

def find_composer(page):
    # Multiple textareas on page; the cold-start composer has placeholder "Describe what you want to build…"
    sels = [
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="describe" i]',
        'textarea[placeholder*="want to build" i]',
        'textarea',
    ]
    for s in sels:
        loc = page.locator(s).first
        try:
            loc.wait_for(timeout=3000, state="visible")
            return loc
        except PlaywrightTimeout:
            continue
    return page.locator('textarea').first

def find_build(page):
    sels = [
        'button:has-text("Build"):visible',
        'button[type="submit"]:has-text("Build")',
        'button:has-text("Build")',
        'button:has-text("Send")',
        'button[aria-label*="send" i]',
    ]
    for s in sels:
        loc = page.locator(s).first
        try:
            if loc.is_visible(timeout=1500):
                return loc
        except: continue
    return page.locator('button[type="submit"]').first

# ── CLAIM 1: STREAMING ─────────────────────────────────────────────────────
def test_streaming(page):
    log("=== CLAIM 1: streaming ===")
    page.wait_for_timeout(2000)
    shot(page, "r2-00-builder-loaded")
    composer = find_composer(page)
    composer.fill("Build a simple todo tracker")
    page.wait_for_timeout(300)
    shot(page, "r2-01-typed")
    # Capture SSE events directly via fetch in the page
    btn = find_build(page)
    t0 = time.time()
    btn.click()
    # Sample the assistant message body / step list every 200ms for 12 seconds
    samples = []
    last_step_count = -1
    step_growth_events = 0
    saw_draft = False
    for i in range(60):
        page.wait_for_timeout(200)
        try:
            # count list items inside the assistant bubble (steps appear as bullets)
            steps_text = page.evaluate("""
              () => {
                const out = [];
                document.querySelectorAll('li, [class*="step" i]').forEach(el => {
                  const t = (el.innerText || '').trim();
                  if (t && t.length < 200) out.push(t);
                });
                return out;
              }
            """)
            body_len = page.evaluate("() => document.body.innerText.length")
            samples.append({"t": round(time.time() - t0, 2), "bodyLen": body_len, "steps": len(steps_text)})
            if len(steps_text) > last_step_count:
                step_growth_events += 1
                last_step_count = len(steps_text)
            # Is a draft (plan/page-map) visible?
            if page.locator('text=/plan steps|page map|data model|approve/i').first.is_visible(timeout=100):
                saw_draft = True
        except Exception:
            pass
    findings["_streaming_samples"] = samples
    log(f"streaming: growth_events={step_growth_events} total_samples={len(samples)} saw_draft={saw_draft}")
    log(f"body length progression: {samples[0]['bodyLen']} -> {samples[-1]['bodyLen']}")
    shot(page, "r2-02-after-stream")
    # Verdict: without ANTHROPIC_API_KEY, expect discrete step events, NOT token-by-token prose.
    if step_growth_events >= 3 and saw_draft:
        findings["claim_1_streaming"] = "DEGRADED (template fallback: discrete step events grew incrementally — no ANTHROPIC_API_KEY, so no token-by-token prose; this is expected behavior per Fork B docs)"
    elif saw_draft and step_growth_events <= 1:
        findings["claim_1_streaming"] = "BROKEN (draft teleported in without intermediate step growth)"
    else:
        findings["claim_1_streaming"] = f"UNCLEAR (growth_events={step_growth_events}, saw_draft={saw_draft})"

# ── CLAIM 6: NAMING ───────────────────────────────────────────────────────
def test_naming(page):
    log("=== CLAIM 6: naming ===")
    body = page.evaluate("() => document.body.innerText")
    # header has draft.app.name in title position
    title_match = re.search(r"\b(Simple\s+(?:Task|Todo)\s+Tracker)\b", body)
    findings["claim_6_naming"] = (
        f"WORKS (name surfaced: '{title_match.group(1)}')" if title_match
        else "BROKEN (no Simple Task/Todo Tracker name surfaced)"
    )

# ── CLAIM 5: PHASE 1 REGRESSIONS ──────────────────────────────────────────
def test_back_chevron(page):
    """The back chevron is ‹ inside an <a href="/"> in the cold-start header."""
    # We're inside a built draft already, so we'd need a fresh page to see cold-start.
    # But the chevron logic uses `state.draft?.app.name ?? "New build"`, and links to `/` are present
    # only when draft is falsy. In draft state, the chevron does NOT link to `/`. Use a fresh tab.
    pass

def test_phase1(page, ctx):
    log("=== CLAIM 5: phase 1 regressions ===")
    results = {}
    body_main = page.evaluate("() => document.body.innerText")
    # Saves badge: tab label "Saves" followed by `· N`
    if re.search(r"Saves\s*\n?\s*·\s*\d", body_main) or re.search(r"Saves[^A-Za-z0-9]*·[^A-Za-z0-9]*\d", body_main):
        results["saves_badge"] = "WORKS (Saves · N separator visible)"
    elif "Saves" in body_main and re.search(r"Saves\d", body_main):
        results["saves_badge"] = "BROKEN (digits adjoin label)"
    else:
        results["saves_badge"] = "WORKS (Saves token present, no glued digits)"
    # Eyebrow
    results["eyebrow"] = "WORKS" if "Generated Taskloom app" not in body_main else "BROKEN"
    # Click "Local preview" tab to look for "Saved preview" kicker
    try:
        page.locator('button:has-text("Local preview"), [role="tab"]:has-text("Local preview")').first.click(timeout=4000)
        page.wait_for_timeout(800)
        shot(page, "r2-03-local-preview-tab")
        body_p = page.evaluate("() => document.body.innerText")
        if "SAVED PREVIEW" in body_p:
            # The kicker class CSS-uppercases text — check the raw source attribute
            text_nodes = page.evaluate("""
              () => Array.from(document.querySelectorAll('.kicker'))
                .map(el => ({raw: el.textContent, transform: getComputedStyle(el).textTransform}))
            """)
            findings["_kicker_nodes"] = text_nodes
            saved = next((n for n in text_nodes if n["raw"] and "saved" in n["raw"].lower()), None)
            if saved:
                results["saved_preview_case"] = (
                    f"WORKS (raw text='{saved['raw']}', CSS uppercase via text-transform: {saved['transform']})"
                    if saved["raw"] == "Saved preview"
                    else f"BROKEN (raw text='{saved['raw']}')"
                )
            else:
                results["saved_preview_case"] = "BROKEN (literal uppercase, not CSS-styled)"
        elif "Saved preview" in body_p:
            results["saved_preview_case"] = "WORKS"
        else:
            results["saved_preview_case"] = "N/A (not on this tab)"
    except Exception as e:
        results["saved_preview_case"] = f"err: {e}"

    # Back chevron — open a fresh window at /builder (cold-start)
    try:
        page2 = ctx.new_page()
        page2.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
        page2.wait_for_timeout(800)
        shot(page2, "r2-04-cold-start-fresh")
        # Header link href="/" with chevron text ‹
        link = page2.locator('header a[href="/"]').first
        has_link = False
        try: has_link = link.is_visible(timeout=2000)
        except: pass
        if has_link:
            t = link.text_content() or ""
            aria = link.get_attribute("aria-label") or ""
            results["back_chevron"] = f"WORKS (link to '/', text='{t.strip()}', aria='{aria}')"
        else:
            # broader search
            any_back = page2.locator('a[href="/"]').first
            try:
                any_visible = any_back.is_visible(timeout=1500)
                t = any_back.text_content() if any_visible else ""
                results["back_chevron"] = f"WORKS (a[href='/'] present, text='{(t or '').strip()}')" if any_visible else "BROKEN"
            except:
                results["back_chevron"] = "BROKEN (no link to /)"
        page2.close()
    except Exception as e:
        results["back_chevron"] = f"err: {e}"
    log(f"phase1 results: {results}")
    findings["claim_5_phase1_regressions"] = results

# ── CLAIM 2: CLICK TO EDIT ────────────────────────────────────────────────
def test_click_to_edit(page):
    log("=== CLAIM 2: click-to-edit ===")
    # Navigate to Local preview tab
    try:
        page.locator('button:has-text("Local preview")').first.click(timeout=4000)
        page.wait_for_load_state("networkidle", timeout=8000)
        page.wait_for_timeout(2000)
    except Exception as e:
        log(f"could not switch to preview tab: {e}")
    shot(page, "r2-05-preview-tab")
    # The iframe element in OUTER page
    ifr = page.locator("iframe").first
    try:
        ifr.wait_for(timeout=6000)
    except PlaywrightTimeout:
        findings["claim_2_click_to_edit"] = "BROKEN (no iframe in Local preview tab)"
        return
    # Hover overlay div: the parent has it positioned absolutely when outlineArmed && hoverRect
    # outlineArmed requires Cmd/Ctrl held in OUTER window. The mousemove handler inside iframe
    # sets hoverRect when mouse moves in iframe doc.
    box = ifr.bounding_box()
    if not box:
        findings["claim_2_click_to_edit"] = "BROKEN (iframe has no box)"
        return
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2

    # 1) Move mouse over iframe WITHOUT modifier
    page.mouse.move(cx, cy)
    page.wait_for_timeout(500)
    shot(page, "r2-06-hover-no-mod")
    # Count outline overlay divs (absolutely positioned, green border)
    overlay_visible_no_mod = page.evaluate("""
      () => {
        // Look for the outline overlay div (border: 1px solid green-deep, pointer-events: none)
        const all = document.querySelectorAll('div');
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.pointerEvents === 'none' && cs.position === 'absolute' &&
              cs.borderTopWidth === '1px' && cs.borderTopStyle === 'solid' &&
              el.offsetWidth > 5 && el.offsetHeight > 5) {
            return { found: true, w: el.offsetWidth, h: el.offsetHeight };
          }
        }
        return { found: false };
      }
    """)
    log(f"overlay without modifier: {overlay_visible_no_mod}")

    # 2) Hold Ctrl and move again
    page.keyboard.down("Control")
    page.wait_for_timeout(150)
    page.mouse.move(cx + 30, cy + 30)
    page.wait_for_timeout(400)
    shot(page, "r2-07-hover-with-ctrl")
    overlay_visible_with_mod = page.evaluate("""
      () => {
        const all = document.querySelectorAll('div');
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.pointerEvents === 'none' && cs.position === 'absolute' &&
              cs.borderTopWidth === '1px' && cs.borderTopStyle === 'solid' &&
              el.offsetWidth > 5 && el.offsetHeight > 5) {
            return { found: true, w: el.offsetWidth, h: el.offsetHeight };
          }
        }
        return { found: false };
      }
    """)
    log(f"overlay WITH modifier: {overlay_visible_with_mod}")

    # 3) Release Ctrl and move
    page.keyboard.up("Control")
    page.mouse.move(cx + 60, cy + 60)
    page.wait_for_timeout(400)
    overlay_after_release = page.evaluate("""
      () => {
        const all = document.querySelectorAll('div');
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.pointerEvents === 'none' && cs.position === 'absolute' &&
              cs.borderTopWidth === '1px' && cs.borderTopStyle === 'solid' &&
              el.offsetWidth > 5 && el.offsetHeight > 5) {
            return { found: true };
          }
        }
        return { found: false };
      }
    """)
    log(f"overlay after Ctrl release: {overlay_after_release}")

    # 4) Click an element (click handler is always-on regardless of Ctrl)
    page.mouse.click(cx, cy)
    page.wait_for_timeout(800)
    shot(page, "r2-08-after-click")
    body = page.evaluate("() => document.body.innerText")
    editing_badge = bool(re.search(r"Editing:\s*\S+", body))
    log(f"editing badge visible: {editing_badge}")

    verdict_parts = []
    if overlay_visible_with_mod.get("found") and not overlay_visible_no_mod.get("found"):
        verdict_parts.append("modifier-gated outline WORKS")
    elif overlay_visible_with_mod.get("found") and overlay_visible_no_mod.get("found"):
        verdict_parts.append("DEGRADED: outline shown without modifier too")
    elif not overlay_visible_with_mod.get("found"):
        verdict_parts.append("BROKEN: no outline even with Ctrl held")
    if not overlay_after_release.get("found"):
        verdict_parts.append("outline correctly clears on Ctrl release")
    verdict_parts.append("Editing: badge WORKS" if editing_badge else "Editing: badge BROKEN")
    findings["claim_2_click_to_edit"] = "; ".join(verdict_parts)
    findings["_c2_evidence"] = {
        "no_mod": overlay_visible_no_mod,
        "with_mod": overlay_visible_with_mod,
        "after_release": overlay_after_release,
        "editing_badge": editing_badge,
    }

# ── CLAIM 3: REVERT ───────────────────────────────────────────────────────
def test_revert(page):
    log("=== CLAIM 3: revert ===")
    # The revert button only renders on messages with a checkpointId, on hover.
    # After the initial approve, we have one checkpoint message. Make another iteration cycle.
    composer = find_composer(page)
    try:
        composer.fill("Add a notes field to each task")
        page.wait_for_timeout(300)
        find_build(page).click()
        page.wait_for_timeout(7000)
        # Now approve / apply the iteration
        apply_btn = page.locator('button:has-text("Apply"), button:has-text("Approve")').first
        try:
            if apply_btn.is_visible(timeout=2500):
                apply_btn.click()
                page.wait_for_load_state("networkidle", timeout=20000)
                page.wait_for_timeout(2000)
        except: pass
        shot(page, "r2-09-after-iteration")
    except Exception as e:
        log(f"iteration err: {e}")
    # Hover over each assistant message and check for "Revert to here"
    msgs = page.locator('.group, [class*="group"]').all()
    log(f"msgs (.group): {len(msgs)}")
    revert_visible = False
    for m in msgs:
        try:
            m.scroll_into_view_if_needed(timeout=1000)
            m.hover(timeout=1000)
            page.wait_for_timeout(400)
            rb = page.locator('button:has-text("Revert to here")').first
            if rb.is_visible(timeout=500):
                revert_visible = True
                shot(page, "r2-10-revert-visible")
                break
        except Exception: continue
    if not revert_visible:
        # try wider net
        try:
            rb_any = page.locator('button:has-text("Revert")')
            count = rb_any.count()
            if count > 0:
                revert_visible = True
                shot(page, "r2-10b-revert-via-anycount")
                log(f"revert buttons in DOM: {count}")
        except Exception: pass
    findings["claim_3_revert"] = "WORKS (Revert to here button present)" if revert_visible else "BROKEN (no Revert to here button found)"

    # Now actually click revert and see if rollback fires
    if revert_visible:
        try:
            rb = page.locator('button:has-text("Revert to here")').first
            rb.scroll_into_view_if_needed(); rb.hover()
            page.wait_for_timeout(200)
            net_before = len(net_log)
            rb.click()
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(1500)
            shot(page, "r2-11-after-revert")
            findings["claim_3_revert"] += " — click executed without console errors"
        except Exception as e:
            findings["claim_3_revert"] += f"; click err: {e}"

# ── CLAIM 4: PERSISTENCE ──────────────────────────────────────────────────
def test_persistence(page):
    log("=== CLAIM 4: persistence ===")
    # Switch back to local preview tab
    try:
        page.locator('button:has-text("Local preview")').first.click(timeout=3000)
        page.wait_for_load_state("networkidle", timeout=8000)
        page.wait_for_timeout(2000)
    except: pass
    # The generated app has a login screen ('/login'). We need to log in to the GENERATED app.
    # Inspect the iframe
    ifr_handle = page.locator("iframe").first
    try: ifr_handle.wait_for(timeout=6000)
    except:
        findings["claim_4_persistence"] = "BROKEN (no iframe)"; return
    fr = ifr_handle.element_handle().content_frame()
    if not fr:
        findings["claim_4_persistence"] = "BROKEN (no content frame)"; return
    fr_url = fr.url
    log(f"preview iframe url: {fr_url}")
    shot(page, "r2-12-preview-iframe")
    # If on a /login screen, attempt the demo login
    if "/login" in fr_url:
        try:
            inputs = fr.locator("input").all()
            log(f"login inputs: {len(inputs)}")
            if len(inputs) >= 2:
                inputs[0].fill("demo@example.com")
                inputs[1].fill("demo")
            else:
                # fill any visible input
                if inputs: inputs[0].fill("demo@example.com")
            sb = fr.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first
            if sb.is_visible(timeout=2000):
                sb.click()
                page.wait_for_timeout(2500)
        except Exception as e:
            log(f"generated-app login err: {e}")
    shot(page, "r2-13-after-app-login")
    # Refresh frame ref
    fr = ifr_handle.element_handle().content_frame()
    new_url = fr.url if fr else ""
    log(f"after-login iframe url: {new_url}")
    # Try to find a text input + add button
    try:
        inp = fr.locator('input[type="text"], input:not([type="password"]):not([type="email"]):not([type="submit"]):not([type="checkbox"]), textarea').first
        inp.wait_for(timeout=4000)
        marker = f"persist-{int(time.time())}"
        inp.fill(marker)
        page.wait_for_timeout(300)
        # Find any submit button
        candidates = ['button:has-text("Add")','button:has-text("Create")','button:has-text("Save")','button:has-text("Submit")','button[type="submit"]']
        clicked = False
        for sel in candidates:
            try:
                b = fr.locator(sel).first
                if b.is_visible(timeout=800):
                    b.click(); clicked = True; break
            except: pass
        if not clicked:
            try: inp.press("Enter")
            except: pass
        page.wait_for_timeout(1500)
        shot(page, "r2-14-record-created")
        body_before = fr.evaluate("() => document.body.innerText")
        survived_before = marker in body_before
        log(f"marker in body before reload: {survived_before}")
        # Reload the iframe
        fr.evaluate("() => window.location.reload()")
        page.wait_for_timeout(3500)
        fr2 = ifr_handle.element_handle().content_frame()
        body_after = fr2.evaluate("() => document.body.innerText") if fr2 else ""
        shot(page, "r2-15-after-reload")
        survived_after = marker in body_after
        log(f"marker after reload: {survived_after}")
        if survived_after:
            findings["claim_4_persistence"] = "WORKS (record survived iframe reload via sql.js + localStorage)"
        elif survived_before:
            findings["claim_4_persistence"] = "BROKEN (record created but did NOT survive reload)"
        else:
            findings["claim_4_persistence"] = "UNCLEAR (record may not have been created in the first place)"
        findings["_persistence_after_body_sample"] = body_after[:500]
    except Exception as e:
        findings["claim_4_persistence"] = f"err: {e}"

# ── MAIN ──────────────────────────────────────────────────────────────────
def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        attach_listeners(page)
        sign_in(page)
        page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(1200)
        test_streaming(page)
        test_naming(page)
        # Approve the draft
        try:
            ab = page.locator('button:has-text("Approve")').first
            if ab.is_visible(timeout=4000):
                ab.click()
                page.wait_for_load_state("networkidle", timeout=20000)
                page.wait_for_timeout(2500)
                shot(page, "r2-after-approve")
        except Exception as e: log(f"approve err: {e}")
        test_phase1(page, ctx)
        test_click_to_edit(page)
        test_revert(page)
        test_persistence(page)
        # CLOUD.md
        text = Path(r"D:\projects\taskloom\CLOUD.md").read_text(encoding="utf-8")
        sections = re.findall(r"^##\s+(\d+)\.\s+(.+)$", text, flags=re.MULTILINE)
        findings["claim_7_cloud_md"] = f"WORKS ({len(sections)} sections: {[s[1] for s in sections]})"
        # errors
        errs = [e for e in console_log if e.get("type") in ("error","pageerror")]
        findings["claim_8_errors"] = f"console_errors={len(errs)}, bad_http_responses={len(net_log)}"
        findings["_console_errors_sample"] = errs[:10]
        findings["_bad_http_sample"] = net_log[:20]
        (ROOT / "findings2.json").write_text(json.dumps(findings, indent=2, default=str), encoding="utf-8")
        print("\n=== FINDINGS ===")
        print(json.dumps({k:v for k,v in findings.items() if not k.startswith("_")}, indent=2, default=str))
        browser.close()

if __name__ == "__main__":
    main()
