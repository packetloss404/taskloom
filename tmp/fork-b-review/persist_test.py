"""Properly test sql.js + localStorage persistence in the generated app."""
from __future__ import annotations
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
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
    page.on("console", lambda m: print(f"[{m.type}] {m.text[:200]}") if m.type in ("error","warning") else None)
    page.on("pageerror", lambda e: print(f"[pageerror] {str(e)[:300]}"))
    # sign in (workbench session needed to access /api/app/generated-apps/...)
    page.goto(f"{WEB}/sign-in", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(1500)
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.locator('button[type="submit"]').first.click()
    for _ in range(30):
        page.wait_for_timeout(400)
        if "/sign-in" not in page.url: break

    # Go directly to generated-app preview
    url = "http://localhost:7341/api/app/generated-apps/gapp_70d160cc48c8/preview/"
    page.goto(url, wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(4000)
    shot(page, "pt-01-loaded")
    body = page.evaluate("() => document.body.innerText")
    print(f"--- body excerpt ---\n{body[:400]}")
    # Inspect localStorage now
    ls_initial = page.evaluate("""() => {
      const out = [];
      for (let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        out.push({k, vLen: (localStorage.getItem(k)||'').length});
      }
      return out;
    }""")
    print(f"localStorage initial: {ls_initial}")

    # If /login screen, log in first
    if "sign in" in body.lower() or "login" in page.url.lower():
        # Try filling all visible inputs with demo creds
        for inp in page.locator("input").all():
            try:
                typ = (inp.get_attribute("type") or "").lower()
                if typ == "password": inp.fill("demo")
                else: inp.fill("demo@example.com")
            except: pass
        try:
            page.locator('button[type="submit"]').first.click()
            page.wait_for_timeout(3000)
        except: pass
        shot(page, "pt-02-after-login")
        print(f"after login url: {page.url}")
        body = page.evaluate("() => document.body.innerText")
        print(f"after-login body: {body[:400]}")

    # Identify form inputs and fill ALL required ones
    fields = page.evaluate("""
      () => Array.from(document.querySelectorAll('input,textarea,select'))
        .filter(i => i.offsetParent !== null)
        .map((i, idx) => ({idx, type: i.type, name: i.name, placeholder: i.placeholder, required: i.required, tag: i.tagName}))
    """)
    print(f"form fields: {fields}")
    marker_name = f"MyProject-{int(time.time())}"
    # Fill each input intelligently
    for f in fields:
        try:
            inp = page.locator("input, textarea, select").nth(f["idx"])
            if f["name"] == "name" or f["placeholder"].lower() in ("name","title"):
                inp.fill(marker_name)
            elif f["name"] == "status":
                inp.fill("active")
            elif f["name"] == "ownerId" or "owner" in f["name"].lower():
                inp.fill("owner_xyz")
            elif f["name"] == "createdAt" or "date" in f["name"].lower():
                inp.fill("2026-05-17")
            elif f["name"] == "priority":
                inp.fill("medium")
            elif f["name"] == "projectId" or "project" in f["name"].lower():
                inp.fill("project_001")
            else:
                inp.fill("test-value")
        except Exception as e: print(f"fill err on {f}: {e}")
    page.wait_for_timeout(400)
    shot(page, "pt-03-filled")
    # Click Create record button
    try:
        page.locator('button:has-text("Create record"), button[type="submit"]').first.click()
        page.wait_for_timeout(2500)
    except Exception as e: print(f"submit err: {e}")
    shot(page, "pt-04-after-submit")
    body_pre = page.evaluate("() => document.body.innerText")
    print(f"body after submit: {body_pre[:600]}")
    print(f"marker '{marker_name}' visible pre-reload: {marker_name in body_pre}")
    ls_after_create = page.evaluate("""() => {
      const out = [];
      for (let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        out.push({k, vLen: (localStorage.getItem(k)||'').length});
      }
      return out;
    }""")
    print(f"localStorage after create: {ls_after_create}")
    # Reload
    page.reload()
    page.wait_for_timeout(4500)
    shot(page, "pt-05-after-reload")
    body_post = page.evaluate("() => document.body.innerText")
    print(f"body after reload: {body_post[:600]}")
    print(f"marker '{marker_name}' visible POST-reload: {marker_name in body_post}")
    ls_post = page.evaluate("""() => {
      const out = [];
      for (let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        out.push({k, vLen: (localStorage.getItem(k)||'').length});
      }
      return out;
    }""")
    print(f"localStorage after reload: {ls_post}")
    browser.close()
