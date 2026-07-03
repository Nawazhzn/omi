/** Builds a shareable URL that pre-fills the join code when opened. */
export function buildJoinLink(joinCode: string): string {
  const url = new URL(window.location.href);
  url.search = `?join=${joinCode}`;
  url.hash = "";
  return url.toString();
}

/** Reads a `?join=CODE` query param, if present, for pre-filling the join form. */
export function readJoinCodeFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get("join");
  return code ? code.toUpperCase() : null;
}
