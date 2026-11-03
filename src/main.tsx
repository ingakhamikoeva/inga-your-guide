import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { captureUtmFromUrl } from "./lib/utm";
import { installNetworkDiagnostics, diagnosticsEnabled } from "./lib/network-diagnostics";
import { fetchText } from "./lib/api-transport";

// Explicit diagnostics link only; no auth credentials are used by the reachability probe.
installNetworkDiagnostics();
if (diagnosticsEnabled()) {
  void fetchText('https://api.legche.online/healthz', {
    method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
  }, 10000).catch(() => {});
}
captureUtmFromUrl();

createRoot(document.getElementById("root")!).render(<App />);
