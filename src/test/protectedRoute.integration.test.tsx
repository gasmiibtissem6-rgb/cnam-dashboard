import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  logSecurityEvent: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/securityEvents", () => ({
  logSecurityEvent: mocks.logSecurityEvent,
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={["admin"]}>
              <h1>Tableau de bord CNAM</h1>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<h1>Page de connexion</h1>} />
        <Route path="/403" element={<h1>Accès interdit</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CNAM - Intégration des routes protégées", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("Test 1 : redirige un visiteur non connecté vers login", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
      roles: [],
      isLoading: false,
    });

    renderProtectedRoute();

    expect(screen.getByText("Page de connexion")).toBeTruthy();
    expect(screen.queryByText("Tableau de bord CNAM")).toBeNull();
  });

  it("Test 2 : refuse un utilisateur sans validation 2FA", () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "user-1" },
      roles: ["admin"],
      isLoading: false,
    });

    renderProtectedRoute();

    expect(screen.getByText("Page de connexion")).toBeTruthy();
    expect(screen.queryByText("Tableau de bord CNAM")).toBeNull();
  });

  it("Test 3 : autorise un admin avec 2FA validée", () => {
    sessionStorage.setItem("mfa_verified", "true");

    mocks.useAuth.mockReturnValue({
      user: { id: "admin-1" },
      roles: ["admin"],
      isLoading: false,
    });

    renderProtectedRoute();

    expect(screen.getByText("Tableau de bord CNAM")).toBeTruthy();
    expect(screen.queryByText("Accès interdit")).toBeNull();
  });

  it("Test 4 : refuse l'accès admin à un agent", () => {
  sessionStorage.setItem("mfa_verified", "true");

  mocks.useAuth.mockReturnValue({
    user: { id: "agent-1" },
    roles: ["agent"],
    isLoading: false,
  });

  renderProtectedRoute();

  expect(screen.getByText("Accès interdit")).toBeTruthy();
  expect(screen.queryByText("Tableau de bord CNAM")).toBeNull();
});
});
