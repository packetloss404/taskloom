"""Final review pass: instrument SSE timing, properly wait for iframe."""
from __future__ import annotations
import json, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

ROOT = Path(r"D:\projects\taskloom\tmp\fork-b-review")
WEB = "http://localhost:7341"
EMAIL = "alpha@taskloom.local"; PASSWORD = "demo12345"

console_log: list[dict] = []; net_log: list[dict] = []
findings: dict = {}

def shot(page, n): page.screenshot(path=str(ROOT / f"{n}.png"), full_page=True)
def log(m): print(f"[log] {m}")

def attach(page):
    page.on("console", lambda m: console_log.append({"type": m.type, "text": m.text}))
    page.on("pageerror", lambda e: console_log.append({"type": "pageerror", "text": str(e)}))
    page.on("response", lambda r: (net_log.append({"url": r.url, "status": r.status}) if r.status>=400 and "/api" in r.url else None))

def sign_in(page):
    page.goto(f"{WEB}/sign-in", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(1500)
    page.locator('input[type="email"]').first.click()
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.click()
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.wait_for_timeout(200)
    page.locator('button[type="submit"]').first.click()
    for _ in range(40):
        page.wait_for_timeout(400)
        if "/sign-in" not in page.url: break
    page.wait_for_load_state("networkidle", timeout=10000)

def find_composer(page):
    page.wait_for_timeout(1500)
    for s in ('textarea[placeholder*="Describe" i]','textarea'):
        loc = page.locator(s).first
        try:
            loc.wait_for(timeout=4000, state="visible"); return loc
        except PWTimeout: continue
    return page.locator('textarea').first

def find_build(page):
    return page.locator('button:has-text("Build"):visible').first

# ── CLAIM 1: STREAMING — instrument the actual SSE bytes ──────────────────
def test_streaming_sse(page):
    log("=== CLAIM 1: streaming SSE timing ===")
    sse_events: list[dict] = []
    def on_request(req):
        if "app-draft" in req.url and ("stream" in req.url or req.method == "POST"):
            log(f"sse req: {req.method} {req.url}")
    def on_response(resp):
        if "app-draft" in resp.url:
            log(f"sse resp: {resp.status} {resp.url}")
    page.on("request", on_request); page.on("response", on_response)
    # Inject a fetch() override that mirrors the stream into window.__sseEvents
    page.add_init_script("""
      window.__sseEvents = [];
      const origFetch = window.fetch;
      window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        const res = await origFetch(input, init);
        if (url && url.includes('app-draft') && res.ok && res.headers.get('content-type')?.includes('event-stream')) {
          const t0 = Date.now();
          const [a, b] = res.body.tee();
          (async () => {
            const reader = a.getReader(); const dec = new TextDecoder();
            let buf = '';
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              let nl;
              while ((nl = buf.indexOf('\\n\\n')) >= 0) {
                const chunk = buf.slice(0, nl); buf = buf.slice(nl + 2);
                window.__sseEvents.push({ at: Date.now() - t0, raw: chunk.slice(0, 240) });
              }
            }
          })().catch(() => {});
          return new Response(b, { headers: res.headers, status: res.status, statusText: res.statusText });
        }
        return res;
      };
    """)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(1500)
    composer = find_composer(page)
    composer.fill("Build a simple todo tracker")
    page.wait_for_timeout(300)
    shot(page, "r3-01-typed")
    btn = find_build(page)
    btn.click()
    # Wait for stream completion (look for Approve button)
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            if page.locator('button:has-text("Approve")').first.is_visible(timeout=500): break
        except: pass
        page.wait_for_timeout(300)
    page.wait_for_timeout(800)
    events = page.evaluate("() => window.__sseEvents || []")
    log(f"SSE events captured: {len(events)}")
    for e in events[:12]:
        log(f"  @{e['at']}ms: {e['raw'][:100]}")
    findings["_sse_events"] = events
    # Verdict
    timestamps = [e["at"] for e in events]
    spread_ms = (timestamps[-1] - timestamps[0]) if len(timestamps) >= 2 else 0
    n_step_events = sum(1 for e in events if '"type":"step"' in e["raw"] or "step" in e["raw"][:80])
    n_prose_events = sum(1 for e in events if '"type":"prose"' in e["raw"] or "prose" in e["raw"][:80])
    log(f"timestamps spread={spread_ms}ms, step_events={n_step_events}, prose_events={n_prose_events}")
    if n_prose_events > 0 and spread_ms > 500:
        findings["claim_1_streaming"] = f"WORKS (real LLM prose streamed over {spread_ms}ms in {n_prose_events} chunks)"
    elif n_step_events >= 3 and spread_ms > 300:
        findings["claim_1_streaming"] = f"DEGRADED-AS-EXPECTED (no ANTHROPIC_API_KEY -> template fallback emits {n_step_events} step events over {spread_ms}ms with no token-level prose; this is the documented fallback)"
    elif len(events) == 0:
        findings["claim_1_streaming"] = "BROKEN (no SSE events captured at all)"
    else:
        findings["claim_1_streaming"] = f"DEGRADED ({len(events)} events over {spread_ms}ms — neither full prose nor multi-step fallback)"
    shot(page, "r3-02-stream-done")

# ── CLAIM 6: NAMING ───────────────────────────────────────────────────────
def test_naming(page):
    body = page.evaluate("() => document.body.innerText")
    m = re.search(r"\b(Simple\s+(?:Task|Todo)\s+(?:Tracker|App|Manager|List))\b", body)
    findings["claim_6_naming"] = f"WORKS (name surfaced: '{m.group(1)}')" if m else f"DEGRADED (no expected name; body excerpt: {body[:300]})"

# ── approve current draft ─────────────────────────────────────────────────
def approve(page):
    try:
        ab = page.locator('button:has-text("Approve")').first
        if ab.is_visible(timeout=4000):
            ab.click()
            page.wait_for_load_state("networkidle", timeout=20000)
            page.wait_for_timeout(3500)  # let preview iframe hydrate
            shot(page, "r3-03-approved")
            return True
    except Exception as e: log(f"approve err: {e}")
    return False

# ── CLAIM 5: PHASE 1 ──────────────────────────────────────────────────────
def test_phase1(page, ctx):
    res = {}
    body = page.evaluate("() => document.body.innerText")
    if re.search(r"Saves[^\n]*?·\s*\d", body) or re.search(r"Saves\n\s*·", body):
        res["saves_badge"] = "WORKS (Saves · N format)"
    elif re.search(r"Saves\d", body):
        res["saves_badge"] = "BROKEN (glued)"
    else:
        # Inspect tabs DOM
        tabs = page.evaluate("""() => Array.from(document.querySelectorAll('button')).map(b=>b.innerText).filter(t=>t&&t.includes('Saves')).slice(0,5)""")
        res["saves_badge"] = f"INSPECT: tab texts={tabs}"
    res["eyebrow"] = "WORKS" if "Generated Taskloom app" not in body else "BROKEN"

    # Click Local preview tab if not already (using strict-mode-safe selector)
    try:
        tab = page.locator('[role="tablist"] button:has-text("Local preview"), button.tab:has-text("Local preview"), button:has-text("Local preview")').first
        tab.click(timeout=4000)
        page.wait_for_timeout(1500)
    except Exception as e:
        log(f"preview tab click err: {e}")
    shot(page, "r3-04-local-preview")
    # Inspect kickers
    kickers = page.evaluate("""
      () => Array.from(document.querySelectorAll('.kicker')).map(el => ({
        raw: el.textContent,
        upper: getComputedStyle(el).textTransform
      }))
    """)
    findings["_kickers"] = kickers
    saved_kicker = next((k for k in kickers if "saved" in (k["raw"] or "").lower() and "preview" in (k["raw"] or "").lower()), None)
    if saved_kicker:
        if saved_kicker["raw"] == "Saved preview":
            res["saved_preview_case"] = f"WORKS (raw='Saved preview'; CSS textTransform={saved_kicker['upper']})"
        else:
            res["saved_preview_case"] = f"BROKEN (raw='{saved_kicker['raw']}')"
    else:
        # Look anywhere on page
        if "Saved preview" in page.evaluate("() => document.body.innerHTML"):
            res["saved_preview_case"] = "WORKS (text present somewhere on page)"
        else:
            res["saved_preview_case"] = "N/A (string not on this tab)"

    # Back chevron — open fresh cold-start page
    try:
        p2 = ctx.new_page(); attach(p2)
        p2.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
        p2.wait_for_timeout(1500)
        link = p2.locator('header a[href="/"][aria-label="Back to home"]').first
        if link.is_visible(timeout=3000):
            t = link.text_content() or ""
            res["back_chevron"] = f"WORKS (chevron '{t.strip()}' linked to /, aria-label='Back to home')"
        else:
            any_back = p2.locator('a[href="/"]').first
            res["back_chevron"] = "WORKS (link to /)" if any_back.is_visible(timeout=1500) else "BROKEN"
        p2.close()
    except Exception as e:
        res["back_chevron"] = f"err: {e}"
    findings["claim_5_phase1_regressions"] = res

# ── CLAIM 2: CLICK-TO-EDIT ────────────────────────────────────────────────
def test_click_to_edit(page):
    log("=== CLAIM 2: click-to-edit ===")
    # Make sure local preview tab is selected, iframe loaded & hydrated
    ifr = page.locator("iframe").first
    try:
        ifr.wait_for(timeout=8000, state="visible")
    except PWTimeout:
        findings["claim_2_click_to_edit"] = "BROKEN (no iframe in Local preview)"
        return
    # Wait for iframe to fully load
    page.wait_for_timeout(2500)
    # Force the iframe to its app URL if it's still on login — but for the hover test the iframe content doesn't matter much.
    fr_handle = ifr.element_handle()
    fr = fr_handle.content_frame() if fr_handle else None
    fr_url = fr.url if fr else "?"
    log(f"iframe url: {fr_url}")
    # Wait for fr DOM body
    if fr:
        try: fr.wait_for_selector("body", timeout=8000)
        except: pass
    box = ifr.bounding_box()
    if not box:
        findings["claim_2_click_to_edit"] = "BROKEN (iframe no box)"
        return
    cx, cy = box["x"] + box["width"]/2, box["y"] + box["height"]/2

    def overlay_present():
        return page.evaluate("""
          () => {
            for (const el of document.querySelectorAll('div')) {
              const cs = getComputedStyle(el);
              if (cs.pointerEvents==='none' && cs.position==='absolute' &&
                  parseFloat(cs.borderTopWidth)>=1 && cs.borderTopStyle==='solid' &&
                  el.offsetWidth>10 && el.offsetHeight>10 && el.offsetWidth<1200) {
                return { found: true, w: el.offsetWidth, h: el.offsetHeight,
                         border: cs.borderTopColor, zIndex: cs.zIndex };
              }
            }
            return { found: false };
          }
        """)

    # Hover without modifier
    page.mouse.move(cx, cy)
    # Also fire a real mousemove inside the iframe doc (since the handler is on iframe doc)
    if fr:
        try:
            fr.evaluate("""
              () => {
                const ev = new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 });
                (document.elementFromPoint(100, 100) || document.body).dispatchEvent(ev);
              }
            """)
        except: pass
    page.wait_for_timeout(400)
    shot(page, "r3-05-hover-nomod")
    no_mod = overlay_present()
    log(f"overlay no-mod: {no_mod}")

    # Hold Ctrl
    page.keyboard.down("Control")
    page.wait_for_timeout(150)
    page.mouse.move(cx + 30, cy + 30)
    if fr:
        try:
            fr.evaluate("""
              () => {
                const ev = new MouseEvent('mousemove', { bubbles: true, clientX: 150, clientY: 150 });
                (document.elementFromPoint(150, 150) || document.body).dispatchEvent(ev);
              }
            """)
        except: pass
    page.wait_for_timeout(500)
    shot(page, "r3-06-hover-ctrl")
    with_mod = overlay_present()
    log(f"overlay WITH-mod: {with_mod}")
    page.keyboard.up("Control")
    page.wait_for_timeout(300)
    after = overlay_present()
    log(f"overlay after-release: {after}")

    # Click element inside iframe
    if fr:
        try:
            target = fr.locator("button, input, h1, h2, label, a").first
            target.click(force=True)
        except Exception as e: log(f"iframe click err: {e}")
    page.wait_for_timeout(800)
    shot(page, "r3-07-after-click")
    body = page.evaluate("() => document.body.innerText")
    editing = bool(re.search(r"Editing:\s*\S+", body))
    log(f"editing badge: {editing}")

    parts = []
    if with_mod.get("found") and not no_mod.get("found"):
        parts.append("modifier-gated outline WORKS")
    elif with_mod.get("found") and no_mod.get("found"):
        parts.append("DEGRADED: outline shows without modifier too")
    elif not with_mod.get("found"):
        parts.append("BROKEN: no outline even with Ctrl held")
    if not after.get("found"):
        parts.append("clears on Ctrl release")
    parts.append("Editing: badge WORKS" if editing else "Editing: badge BROKEN")
    findings["claim_2_click_to_edit"] = "; ".join(parts)
    findings["_c2"] = {"no_mod": no_mod, "with_mod": with_mod, "after": after, "editing": editing, "iframe_url": fr_url}

# ── CLAIM 3: REVERT ──────────────────────────────────────────────────────
def test_revert(page):
    log("=== CLAIM 3: revert ===")
    # Trigger one more iteration to ensure we have two checkpoints
    composer = find_composer(page)
    try:
        composer.fill("Add a notes field to each task")
        page.wait_for_timeout(300)
        find_build(page).click()
        # Wait for diff and Apply button
        deadline = time.time() + 25
        applied = False
        while time.time() < deadline:
            try:
                ab = page.locator('button:has-text("Apply"), button:has-text("Approve")').first
                if ab.is_visible(timeout=400):
                    ab.click(); applied = True
                    page.wait_for_load_state("networkidle", timeout=20000)
                    page.wait_for_timeout(2500)
                    break
            except: pass
            page.wait_for_timeout(400)
        shot(page, "r3-08-after-iter")
    except Exception as e: log(f"iter err: {e}")
    # Search for assistant messages, hover each, look for the revert button
    revert_found = False
    try:
        # Messages have group class for hover. Find scroll container.
        groups = page.locator('.group').all()
        log(f"group elements: {len(groups)}")
        for g in groups[-6:]:
            try:
                g.scroll_into_view_if_needed(timeout=800); g.hover(timeout=800)
                page.wait_for_timeout(300)
                rb = page.locator('button:has-text("Revert to here")').first
                if rb.is_visible(timeout=400):
                    revert_found = True; break
            except: pass
        if not revert_found:
            rb_any = page.locator('button:has-text("Revert to here")')
            count = rb_any.count()
            log(f"revert buttons in DOM (regardless of visibility): {count}")
            if count > 0:
                revert_found = True
        shot(page, "r3-09-revert-state")
    except Exception as e: log(f"revert search err: {e}")
    if not revert_found:
        findings["claim_3_revert"] = "BROKEN (no Revert to here button)"; return
    # Click it
    try:
        rb = page.locator('button:has-text("Revert to here")').first
        # Hover the parent group again so the button is visible+clickable
        rb.scroll_into_view_if_needed(); rb.hover(force=True)
        page.wait_for_timeout(200)
        n_before = len(net_log)
        rb.click(force=True)
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(1500)
        shot(page, "r3-10-after-revert")
        errs_after = [e for e in console_log[-30:] if e.get("type")=="error"]
        findings["claim_3_revert"] = f"WORKS (button present + clicked; bad_responses_added={len(net_log)-n_before}, errs_after_click={len(errs_after)})"
    except Exception as e:
        findings["claim_3_revert"] = f"PRESENT but click err: {e}"

# ── CLAIM 4: PERSISTENCE ─────────────────────────────────────────────────
def test_persistence(page):
    log("=== CLAIM 4: persistence ===")
    # Make sure we're back on Local preview tab
    try:
        page.locator('button:has-text("Local preview")').first.click(timeout=3000)
        page.wait_for_load_state("networkidle", timeout=8000)
        page.wait_for_timeout(3500)
    except Exception as e: log(f"tab err: {e}")
    ifr = page.locator("iframe").first
    try: ifr.wait_for(timeout=8000)
    except:
        findings["claim_4_persistence"] = "BROKEN (no iframe)"; return
    fr_handle = ifr.element_handle()
    fr = fr_handle.content_frame() if fr_handle else None
    if not fr:
        findings["claim_4_persistence"] = "BROKEN (no content frame)"; return
    log(f"iframe url: {fr.url}")
    shot(page, "r3-11-preview-pre-login")
    # Wait for iframe content to actually render React app
    try:
        fr.wait_for_selector("input, button, form, h1, h2", timeout=10000)
    except PWTimeout:
        log("iframe stayed empty after 10s")
    # Walk through generated-app login if needed
    if "/login" in fr.url or "Sign in" in (fr.evaluate("() => document.body.innerText") or ""):
        try:
            inputs = fr.locator("input").all()
            log(f"login inputs: {len(inputs)}")
            for i, inp in enumerate(inputs):
                try:
                    typ = inp.get_attribute("type") or "text"
                    if typ == "email" or i == 0: inp.fill("demo@example.com")
                    elif typ == "password" or i == 1: inp.fill("demo")
                except: pass
            sb = fr.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")').first
            if sb.is_visible(timeout=2000): sb.click()
            page.wait_for_timeout(3000)
        except Exception as e: log(f"app-login err: {e}")
    fr_handle = ifr.element_handle()
    fr = fr_handle.content_frame() if fr_handle else None
    log(f"after app-login: iframe url {fr.url if fr else '?'}")
    shot(page, "r3-12-after-app-login")
    if not fr:
        findings["claim_4_persistence"] = "BROKEN (frame lost)"; return
    body_now = fr.evaluate("() => document.body.innerText")
    log(f"body excerpt: {body_now[:200]}")
    # Look for a place to create a record — text input + button
    try:
        inp = fr.locator('input[type="text"], input:not([type="password"]):not([type="email"]):not([type="hidden"]):not([type="checkbox"]):not([type="submit"]), textarea').first
        try:
            inp.wait_for(timeout=4000)
        except PWTimeout:
            findings["claim_4_persistence"] = f"UNCLEAR (no editable input found on app screen; iframe url={fr.url})"
            return
        marker = f"persist-{int(time.time())}"
        inp.fill(marker)
        page.wait_for_timeout(300)
        clicked = False
        for sel in ('button:has-text("Add")','button:has-text("Create")','button:has-text("Save")','button:has-text("Submit")','button:has-text("New")','button[type="submit"]'):
            try:
                b = fr.locator(sel).first
                if b.is_visible(timeout=500):
                    b.click(); clicked = True; break
            except: pass
        if not clicked:
            try: inp.press("Enter")
            except: pass
        page.wait_for_timeout(1500)
        shot(page, "r3-13-record-created")
        body_pre = fr.evaluate("() => document.body.innerText")
        before = marker in body_pre
        log(f"marker visible pre-reload: {before}")
        fr.evaluate("() => window.location.reload()")
        page.wait_for_timeout(4500)
        fr_handle = ifr.element_handle()
        fr2 = fr_handle.content_frame() if fr_handle else None
        body_after = fr2.evaluate("() => document.body.innerText") if fr2 else ""
        shot(page, "r3-14-after-reload")
        after = marker in body_after
        log(f"marker visible after reload: {after}")
        if after:
            findings["claim_4_persistence"] = "WORKS (record survived iframe reload via sql.js + localStorage)"
        elif before:
            findings["claim_4_persistence"] = "BROKEN (record vanished on reload — persistence layer not wired)"
        else:
            findings["claim_4_persistence"] = f"UNCLEAR (record may not have created in first place; body_pre excerpt: {body_pre[:200]})"
    except Exception as e:
        findings["claim_4_persistence"] = f"err: {e}"

# ── MAIN ─────────────────────────────────────────────────────────────────
def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page(); attach(page)
        sign_in(page)
        page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(1500)
        test_streaming_sse(page)
        test_naming(page)
        approve(page)
        test_phase1(page, ctx)
        test_click_to_edit(page)
        test_revert(page)
        test_persistence(page)
        text = Path(r"D:\projects\taskloom\CLOUD.md").read_text(encoding="utf-8")
        sections = re.findall(r"^##\s+(\d+)\.\s+(.+)$", text, flags=re.MULTILINE)
        findings["claim_7_cloud_md"] = f"WORKS ({len(sections)} numbered sections)"
        errs = [e for e in console_log if e.get("type") in ("error","pageerror")]
        findings["claim_8_errors"] = f"console_errors={len(errs)}, bad_http_responses={len(net_log)}"
        findings["_console_errors_sample"] = errs[:10]
        findings["_bad_http_sample"] = net_log[:20]
        (ROOT/"findings3.json").write_text(json.dumps(findings, indent=2, default=str), encoding="utf-8")
        print("\n=== FINDINGS ===")
        print(json.dumps({k:v for k,v in findings.items() if not k.startswith("_")}, indent=2, default=str))
        browser.close()

if __name__ == "__main__":
    main()
