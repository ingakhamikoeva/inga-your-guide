// Never use redirect_to, Host or Origin supplied by the requester.
export function passwordResetUrl(rawToken) {
  const configured = String(process.env.APP_URL || "").trim();
  if (!configured) throw new Error("APP_URL is not set");
  const base = new URL(configured);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && local))) {
    throw new Error("APP_URL must be a trusted HTTPS application URL");
  }
  const link = new URL("/reset-password", base.origin);
  link.searchParams.set("token", rawToken);
  link.searchParams.set("type", "recovery");
  return link.toString();
}
