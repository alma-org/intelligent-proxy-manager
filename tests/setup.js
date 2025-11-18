import { beforeAll, afterAll } from "vitest";

// export const TEST_TIMEOUT = 40000;

process.env.TEST_DOMAIN = "test.localhost";
process.env.TEST_PORT = "8443";

beforeAll(() => {
  console.log("🔧 Global test setup…");
});

afterAll(() => {
  console.log("🏁 Global teardown…");
});
