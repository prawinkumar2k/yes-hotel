import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installSessionFetch } from "./lib/sessionFetch";

// Every API call renews an expired sign-in automatically (see lib/sessionFetch.ts).
installSessionFetch();
import "./global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
