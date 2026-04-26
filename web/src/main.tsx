import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CommandPaletteProvider } from "./context/CommandPaletteContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CommandPaletteProvider>
          <App />
        </CommandPaletteProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
