import { describe, it, expect } from "vitest";
import {
  validatePassword,
  getStrengthColor,
  getStrengthLabel,
} from "../lib/passwordValidation";

describe("CNAM - Validation des mots de passe", () => {

  it("Test 1 : refuse un mot de passe trop court", () => {
    const result = validatePassword("Abc123!");

    expect(result.valid).toBe(false);
    expect(result.requirements.minLength).toBe(false);
    expect(result.error).toContain("12 caractères");
  });

  it("Test 2 : refuse un mot de passe sans complexité suffisante", () => {
    const result = validatePassword("abcdefghijklmnop");

    expect(result.valid).toBe(false);
    expect(result.requirements.hasLowerCase).toBe(true);
    expect(result.requirements.hasUpperCase).toBe(false);
    expect(result.requirements.hasNumbers).toBe(false);
  });

  it("Test 3 : accepte un mot de passe fort", () => {
    const result = validatePassword("CnamSecure2026!");

    expect(result.valid).toBe(true);
    expect(result.strength).toBe("strong");
    expect(result.error).toBeUndefined();
  });

  it("Test 4 : accepte un mot de passe avec 3 catégories", () => {
    const result = validatePassword("CnamDashboard2026");

    expect(result.valid).toBe(true);
    expect(result.strength).toBe("medium");
  });

  it("Test 5 : retourne les bons labels et couleurs", () => {
    expect(getStrengthLabel("strong")).toBe("Fort");
    expect(getStrengthLabel("medium")).toBe("Moyen");
    expect(getStrengthLabel("weak")).toBe("Faible");

    expect(getStrengthColor("strong")).toBe("bg-success");
    expect(getStrengthColor("medium")).toBe("bg-warning");
    expect(getStrengthColor("weak")).toBe("bg-destructive");
  });

});
