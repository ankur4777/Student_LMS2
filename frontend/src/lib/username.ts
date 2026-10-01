export function buildUsernameSuggestion(
  firstName: string,
  lastName: string
) {
  const clean = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const first = clean(firstName);
  const last = clean(lastName);
  const base = first
    ? `${first}${last.slice(0, 1)}`
    : `user${last.slice(0, 1)}`;

  return `${base || "user"}01`;
}
