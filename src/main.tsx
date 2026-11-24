import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { watchKeyboard } from "./ui/keyboard";
import { restoreLook } from "./ui/look";

restoreLook();
watchKeyboard();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
