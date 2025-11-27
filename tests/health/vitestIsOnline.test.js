import { describe, it, expect } from "vitest";

describe.sequential("Vitest is online", () => {
  it("should run", () => {
    expect(true).toBe(true);
  });
});
