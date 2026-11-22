import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import AvisoActualizacion from "./AvisoActualizacion.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <AvisoActualizacion />
    </ErrorBoundary>
  </React.StrictMode>
);
