import dotenv from "dotenv";

dotenv.config({quiet: true });

export default {
  test: {
    globals: true,
    setupFiles: ["./setup.js"],
    testTimeout: process.env.TEST_TIMEOUT || 60000,
    hookTimeout: 60000,
  },
};
