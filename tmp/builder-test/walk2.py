"""Focused re-run: captures network requests during build/approve, larger viewport."""
import json, time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

OUT = Path(r"D:\projects\taskloom\tmp\builder-test\v2")
OUT.mkdir(parents=True, exist_ok=True)

WEB = "http://localhost:7341"
EMAIL = "alpha@taskloom.local"
PASSWORD = "demo12345"

def log(m): print(f"[w2] {m}", flush=True)

def shoot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)

def run():
    requests_log = []
    responses_log = []
    console_msgs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1920, "height": 1200})
        page = ctx.new_page()
        page.on("console", lambda m: console_msgs.append({"type": m.type, "text": m.text}))
        def on_req(r):
            if "/api/" in r.url or "/builder/" in r.url:
                requests_log.append({"t": time.time(), "method": r.method, "url": r.url})
        def on_resp(r):
            if "/api/" in r.url:
                try:
                    responses_log.append({"t": time.time(), "status": r.status, "url": r.url, "method": r.request.method})
                except Exception:
                    pass
        page.on("request", on_req)
        page.on("response", on_resp)

        page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=20000)
        page.wait_for_timeout(600)
        # sign-in
        if page.locator("input[type='password']").count() > 0:
            page.locator("input[type='email']").first.fill(EMAIL)
            page.locator("input[type='password']").first.fill(PASSWORD)
            page.locator("button[type='submit']").first.click()
            try:
                page.wait_for_load_state("networkidle", timeout=15000)
            except PWTimeout:
                pass
            page.wait_for_timeout(800)
        if "/builder" not in page.url:
            page.goto(f"{WEB}/builder", wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(700)

        shoot(page, "01_cold")

        # snapshot before build click
        ta = page.locator("textarea").first
        ta.click(); ta.fill("Build a simple todo tracker")
        shoot(page, "02_typed")
        t0 = time.time()
        page.locator("button:has-text('Build')").first.click()
        log("clicked Build at t0")
        # capture rapid snapshots
        for i, dt in enumerate([0.4, 1.0, 2.0, 4.0, 8.0, 15.0, 25.0, 45.0]):
            while time.time() - t0 < dt:
                page.wait_for_timeout(120)
            shoot(page, f"03_build_t+{dt:04.1f}s")
            try:
                html_chunk = page.locator("body").inner_text()[:2000]
            except Exception:
                html_chunk = ""
            (OUT / f"03_build_t+{dt:04.1f}s.txt").write_text(html_chunk, encoding="utf-8")
            # detect approve
            try:
                if page.locator("button:has-text('Approve')").first.is_visible(timeout=200):
                    log(f"Approve visible at t+{time.time()-t0:.2f}")
                    break
            except Exception:
                pass

        # now approve
        try:
            approve = page.locator("button:has-text('Approve')").first
            if approve.is_visible(timeout=2000):
                t1 = time.time()
                approve.click()
                log("clicked Approve")
                shoot(page, "04_approve_clicked")
                for dt in [0.4, 1.2, 3.0, 6.0, 12.0, 20.0]:
                    while time.time() - t1 < dt:
                        page.wait_for_timeout(120)
                    shoot(page, f"05_approve_t+{dt:04.1f}s")
            else:
                log("no Approve button found")
        except Exception as e:
            log(f"approve flow err: {e}")

        # explore the post-approve view - find ALL tablist text
        try:
            tabs = page.locator("[role='tab']")
            tab_data = []
            n = tabs.count()
            log(f"role=tab count: {n}")
            for i in range(n):
                t = tabs.nth(i)
                try:
                    txt = t.inner_text(timeout=1000)
                    tab_data.append({"i": i, "text": txt, "visible": t.is_visible()})
                except Exception as e:
                    tab_data.append({"i": i, "err": str(e)})
            (OUT / "tabs_role.json").write_text(json.dumps(tab_data, indent=2), encoding="utf-8")
        except Exception as e:
            log(f"tabs scan err: {e}")

        # Try to find any element with text content containing each tab name and report casing
        labels_to_check = ["Preview", "Source", "Quality", "Activity", "Runs", "Saves", "Publish",
                           "SAVED PREVIEW", "saved preview", "Saved preview"]
        casing = {}
        for lab in labels_to_check:
            try:
                loc = page.get_by_text(lab, exact=True)
                casing[lab] = loc.count()
            except Exception as e:
                casing[lab] = f"err:{e}"
        (OUT / "casing.json").write_text(json.dumps(casing, indent=2), encoding="utf-8")

        # click each tab and snapshot
        tab_names = ["Preview", "Source", "Quality", "Activity", "Runs", "Saves", "Publish"]
        for t in tab_names:
            try:
                loc = page.locator(f"[role='tab']:has-text('{t}')").first
                if loc.count() == 0:
                    loc = page.get_by_text(t, exact=False).first
                loc.click(timeout=2500)
                page.wait_for_timeout(1500)
                shoot(page, f"06_tab_{t.lower()}")
                # get content snippet
                try:
                    snippet = page.locator("main").first.inner_text(timeout=1500)[:1500]
                except Exception:
                    snippet = page.locator("body").inner_text()[:1500]
                (OUT / f"06_tab_{t.lower()}.txt").write_text(snippet, encoding="utf-8")
            except Exception as e:
                log(f"tab {t} err: {e}")

        # check preview iframe
        try:
            ifr = page.locator("iframe").first
            if ifr.count() > 0:
                src = ifr.get_attribute("src")
                log(f"iframe src: {src}")
                # try requesting it to see if it 200s
        except Exception as e:
            log(f"iframe err: {e}")

        (OUT / "requests.json").write_text(json.dumps(requests_log, indent=2), encoding="utf-8")
        (OUT / "responses.json").write_text(json.dumps(responses_log, indent=2), encoding="utf-8")
        (OUT / "console.json").write_text(json.dumps(console_msgs, indent=2), encoding="utf-8")
        browser.close()

if __name__ == "__main__":
    run()
