import { describe, expect, it } from "vitest";
import { canOpen, canUseCms, canUseSiteAdmin, homeFor, navFor, safeNext } from "./access";

describe("access", () => {
  it("gives the owner every CMS page and the site admin", () => {
    expect(navFor("OWNER").flatMap((g) => g.items)).toHaveLength(15);
    expect(canUseSiteAdmin("OWNER")).toBe(true);
  });

  it("keeps money pages away from reception", () => {
    expect(canOpen("RECEPTION", "pos")).toBe(true);
    expect(canOpen("RECEPTION", "certificates")).toBe(true);
    expect(canOpen("MASTER", "certificates")).toBe(false);
    expect(canOpen("RECEPTION", "analytics")).toBe(false);
    expect(canOpen("RECEPTION", "settings")).toBe(false);
    expect(canUseSiteAdmin("RECEPTION")).toBe(false);
  });

  it("gives masters only schedule, menu and their own pay", () => {
    const pages = navFor("MASTER").flatMap((g) => g.items.map((i) => i.id));
    expect(pages).toEqual(["calendar", "services", "staff", "payroll"]);
    expect(homeFor("MASTER")).toBe("/cms/calendar");
  });

  it("sends the content manager to the site admin only", () => {
    expect(canUseCms("CONTENT")).toBe(false);
    expect(homeFor("CONTENT")).toBe("/admin");
  });

  it("keeps sidebar group order from the design", () => {
    expect(navFor("OWNER").map((g) => g.label)).toEqual(["Мой салон", "Гостьи", "Услуги", "Команда", "Развитие"]);
  });

  it("only follows safe post-login targets", () => {
    expect(safeNext("https://evil.example", "OWNER")).toBe("/cms");
    expect(safeNext("//evil.example", "OWNER")).toBe("/cms");
    expect(safeNext("/cms/analytics", "RECEPTION")).toBe("/cms");
    expect(safeNext("/cms/pos", "RECEPTION")).toBe("/cms/pos");
    expect(safeNext("/cms", "MASTER")).toBe("/cms/calendar");
    expect(safeNext("/admin", "CONTENT")).toBe("/admin");
  });
});
