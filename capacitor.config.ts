import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.robsonlisboa.financeia",
  appName: "Finance IA",
  webDir: "dist",
  backgroundColor: "#0b1020",
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
