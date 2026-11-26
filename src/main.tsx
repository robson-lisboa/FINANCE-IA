import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { Capacitor } from "@capacitor/core";

// Identifica o app nativo para aplicar o espaço da barra de status do Android.
document.documentElement.classList.toggle("native-app", Capacitor.isNativePlatform());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
