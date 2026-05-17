"""Probe the generated app preview URL directly."""
from playwright.sync_api import sync_playwright
import sys

URL = "http://localhost:7341/builder/preview/alpha/gapp_70d160cc48c8/login"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda m: print(f"[{m.type}] {m.text[:200]}"))
    page.on("pageerror", lambda e: print(f"[pageerror] {str(e)[:300]}"))
    page.on("response", lambda r: print(f"[net {r.status}] {r.url[:140]}") if r.status >= 400 else None)
    page.goto(URL, wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(4000)
    print("--- body text ---")
    print(page.evaluate("() => document.body.innerText[:500]")[:500])
    print("--- inputs ---")
    inputs = page.locator("input").all()
    print(f"input count: {len(inputs)}")
    for i, inp in enumerate(inputs[:6]):
        try:
            print(f"  input[{i}]: type={inp.get_attribute('type')} placeholder={inp.get_attribute('placeholder')} name={inp.get_attribute('name')}")
        except: pass
    print("--- buttons ---")
    buttons = page.locator("button").all()
    print(f"button count: {len(buttons)}")
    for i, b in enumerate(buttons[:8]):
        try: print(f"  button[{i}]: {b.text_content()[:60]}")
        except: pass
    page.screenshot(path=r"D:\projects\taskloom\tmp\fork-b-review\probe-direct.png", full_page=True)
    # Now visit /builder/preview/alpha/gapp_70d160cc48c8/tasks (after login)
    page.goto(URL.replace("/login","/tasks"), wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(4000)
    print("--- after /tasks ---")
    print(page.evaluate("() => document.body.innerText")[:500])
    page.screenshot(path=r"D:\projects\taskloom\tmp\fork-b-review\probe-tasks.png", full_page=True)
    browser.close()
