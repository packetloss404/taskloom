import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ActivationPage from "./Activation";
import DashboardPage from "./Dashboard";

const pageSource = (fileName: string) => readFileSync(fileURLToPath(new URL(fileName, import.meta.url)), "utf8");
const appSource = () => readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");

test("Dashboard surface server-renders its initial loading shell", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );

  assert.match(html, /page-frame/);
  assert.match(html, /animate-pulse/);
});

test("Activation surface server-renders its initial loading shell", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/activation"]}>
      <ActivationPage />
    </MemoryRouter>,
  );

  assert.match(html, /Loading activation detail/);
});

test("Auth routes are wired to public sign-in and sign-up surfaces", () => {
  const source = appSource();

  assert.match(source, /path="\/sign-in"/);
  assert.match(source, /path="\/login"/);
  assert.match(source, /path="\/sign-up"/);
  assert.match(source, /<PublicOnly>/);
  assert.match(source, /<AuthPage mode="sign-in" \/>/);
  assert.match(source, /<AuthPage mode="sign-up" \/>/);
});

test("Auth page exposes the expected credential and workspace forms", () => {
  const source = pageSource("AuthPage.tsx");

  assert.match(source, /mode: "sign-in" \| "sign-up"/);
  assert.match(source, /await signIn\(\{ email: email\.trim\(\), password \}\)/);
  assert.match(source, /await signUp\(\{ displayName: displayName\.trim\(\), email: email\.trim\(\), password \}\)/);
  assert.match(source, /next && next\.startsWith\("\/"\)/);
  assert.match(source, /DISPLAY NAME/);
  assert.match(source, /EMAIL/);
  assert.match(source, /PASSWORD/);
  assert.match(source, /Create account/);
  assert.match(source, /Sign in/);
});

test("Onboarding route and page keep setup behind session-aware completion", () => {
  const routeSource = appSource();
  const page = pageSource("Onboarding.tsx");

  assert.match(routeSource, /path="\/onboarding"/);
  assert.match(routeSource, /<RequireOnboarding>/);
  assert.match(routeSource, /<OnboardingPage \/>/);
  assert.match(page, /api\.getBootstrap\(\)/);
  assert.match(page, /api\.completeOnboardingStep\(stepKey\)/);
  assert.match(page, /await refreshSession\(\)/);
  assert.match(page, /nextBootstrap\.onboarding\.status === "completed"/);
  assert.match(page, /Complete the remaining Taskloom setup steps/);
  assert.match(page, /Current step/);
});
