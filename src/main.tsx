import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// No Android, mantém a barra de status fora da área WebView para não cobrir o app.
if (Capacitor.getPlatform() === "android") {
  void StatusBar.setOverlaysWebView({ overlay: false });
  void StatusBar.setBackgroundColor({ color: "#0b1020" });
  void StatusBar.setStyle({ style: Style.Light });
}

document.documentElement.classList.toggle("native-app", Capacitor.isNativePlatform());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
