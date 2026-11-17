import { afterEach, describe, expect, it } from "vitest";
import { publicEnv, razorpayConfigured } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("env", () => {
  it("rejects missing public vars", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(() => publicEnv()).toThrow();
  });
  it("razorpay is optional", () => {
    delete process.env.RAZORPAY_KEY_ID;
    expect(razorpayConfigured()).toBe(false);
  });
});
