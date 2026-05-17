"""Final targeted probe — check what is actually inside the iframe content frame,
and check if the workbench has any way to reach the actual /api/app/generated-apps/<id>/preview/ SPA.
"""
from __future__ import annotations
import json, re, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
if sys.platform == "win32":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except: pass

ROOT = Path(r"D:\projects\taskloom\tmp\fork-b-review")
WEB = "http://localhost:7341"
EMAIL = "alpha@taskloom.local"; PASSWORD = "demo12345"

def shot(p, n): p.screenshot(path=str(ROOT/f"{n}.png"), full_page=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    # sign in
    page.goto(f"{WEB}/sign-in", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(1500)
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.locator('button[type="submit"]').first.click()
    for _ in range(30):
        page.wait_for_timeout(400)
        if "/sign-in" not in page.url: break

    # Navigate to an EXISTING app (the simple-task-tracker we already created in run 3/4)
    # Builder discovers apps via API; let's just go and rebuild.
    page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    ta = page.locator('textarea').first
    ta.fill("Build a simple todo tracker")
    page.wait_for_timeout(300)
    page.locator('button:has-text("Build"):visible').first.click()
    # wait for Approve
    for _ in range(40):
        try:
            if page.locator('button:has-text("Approve")').first.is_visible(timeout=400): break
        except: pass
        page.wait_for_timeout(400)
    page.locator('button:has-text("Approve")').first.click()
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(4000)
    # Local preview tab (use JS click to bypass strict-mode)
    page.evaluate("""
      () => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(b => (b.innerText||'').trim() === 'Local preview');
        if (b) b.click();
      }
    """)
    page.wait_for_timeout(3500)
    shot(page, "fp-01-local-preview")
    # Inspect iframe
    ifr = page.locator("iframe").first
    try: ifr.wait_for(timeout=5000)
    except PWTimeout: print("NO IFRAME"); browser.close(); sys.exit(0)
    fr = ifr.element_handle().content_frame()
    print(f"iframe url: {fr.url}")
    # Wait for the iframe to render readiness page
    page.wait_for_timeout(2500)
    fr = ifr.element_handle().content_frame()
    body = fr.evaluate("() => document.body.innerText")
    print(f"iframe body excerpt: {body[:600]}")
    # Look for "Saved preview" kicker in iframe
    kickers = fr.evaluate("""
      () => Array.from(document.querySelectorAll('.kicker, .uppercase, [class*="kicker"]')).map(el => ({
        raw: el.textContent || '',
        transform: getComputedStyle(el).textTransform
      }))
    """)
    print(f"iframe kickers: {kickers}")
    saved_kicker = next((k for k in kickers if "saved preview" in (k["raw"]).lower()), None)
    if saved_kicker:
        print(f"FOUND saved preview kicker: raw='{saved_kicker['raw']}' transform={saved_kicker['transform']}")

    # Now try the REAL generated-app preview URL — does it serve?
    api_preview_url = f"http://localhost:8484/api/app/generated-apps/gapp_70d160cc48c8/preview/"
    page.goto(api_preview_url, wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(4000)
    shot(page, "fp-02-api-preview-direct")
    print(f"Direct API preview URL: {page.url}")
    print(f"Direct preview body: {page.evaluate('() => document.body.innerText')[:600]}")
    direct_inputs = len(page.locator("input").all())
    direct_buttons = len(page.locator("button").all())
    print(f"Direct preview inputs={direct_inputs} buttons={direct_buttons}")

    # And try the web-proxied version
    web_preview_url = f"http://localhost:7341/api/app/generated-apps/gapp_70d160cc48c8/preview/"
    page.goto(web_preview_url, wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(4000)
    shot(page, "fp-03-web-proxy-preview")
    print(f"Web-proxy preview URL: {page.url}")
    print(f"Web-proxy preview body: {page.evaluate('() => document.body.innerText')[:600]}")
    web_inputs = len(page.locator("input").all())
    web_buttons = len(page.locator("button").all())
    print(f"Web-proxy inputs={web_inputs} buttons={web_buttons}")
    # If we have inputs, try to create a record and verify persistence
    if web_inputs > 0:
        # If it's /login screen, try logging in
        body = page.evaluate("() => document.body.innerText")
        if "sign in" in body.lower() or page.url.endswith("/login"):
            inputs = page.locator("input").all()
            for i, inp in enumerate(inputs):
                try:
                    typ = (inp.get_attribute("type") or "").lower()
                    if typ == "password": inp.fill("demo")
                    else: inp.fill("demo@example.com")
                except: pass
            try:
                page.locator('button[type="submit"], button:has-text("Sign in")').first.click()
                page.wait_for_timeout(3000)
            except Exception as e: print(f"login click err: {e}")
        shot(page, "fp-04-after-login")
        print(f"after login url: {page.url}")
        print(f"after login body: {page.evaluate('() => document.body.innerText')[:600]}")
        # Find an editable input and add a record
        text_inps = page.evaluate("""
          () => Array.from(document.querySelectorAll('input,textarea'))
            .filter(i => i.offsetParent !== null && !['password','email','hidden','checkbox','submit','button'].includes((i.type||'').toLowerCase()))
            .map((i, idx) => ({idx, type: i.type, placeholder: i.placeholder, name: i.name}))
        """)
        print(f"editable inputs: {text_inps}")
        if text_inps:
            marker = f"persist-{int(time.time())}"
            inp = page.locator("input,textarea").nth(text_inps[0]["idx"])
            inp.fill(marker)
            page.wait_for_timeout(300)
            for sel in ('button[type="submit"]','button:has-text("Add")','button:has-text("Create")','button:has-text("New")','button:has-text("Save")'):
                try:
                    b = page.locator(sel).first
                    if b.is_visible(timeout=600): b.click(); print(f"clicked {sel}"); break
                except: pass
            page.wait_for_timeout(2000)
            shot(page, "fp-05-record-created")
            body_pre = page.evaluate("() => document.body.innerText")
            print(f"marker visible pre-reload: {marker in body_pre}")
            ls = page.evaluate("""() => {
              const out = [];
              for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); out.push({k, vLen: (localStorage.getItem(k)||'').length}); }
              return out;
            }""")
            print(f"localStorage entries: {ls}")
            page.reload()
            page.wait_for_timeout(4000)
            body_post = page.evaluate("() => document.body.innerText")
            shot(page, "fp-06-after-reload")
            print(f"marker visible POST-reload: {marker in body_post}")
            print(f"post body excerpt: {body_post[:500]}")

    browser.close()
