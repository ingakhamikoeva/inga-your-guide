import { readFileSync } from "node:fs";

// Keep this snapshot when publishing a new revision: historical consent evidence
// refers to these exact document bytes, not just the mutable public URLs.
const snapshot = JSON.parse(readFileSync(new URL("./registration-legal-documents.json", import.meta.url), "utf8"));
export const REGISTRATION_CONSENT_VERSION = snapshot.revision;

export function registrationConsentProof(marketingConsent) {
  const documents = Object.fromEntries(Object.entries(snapshot.documents).map(
    ([key, { url, version, sha256 }]) => [key, { url, version, sha256 }]
  ));
  return {
    revision: REGISTRATION_CONSENT_VERSION,
    source: "registration",
    termsAccepted: true,
    personalDataAccepted: true,
    marketingAccepted: marketingConsent === true,
    documents,
  };
}
