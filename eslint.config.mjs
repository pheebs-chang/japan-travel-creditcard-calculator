import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
];

export default config;
