
function interpretUserInput(raw) {
  const s = String(raw ?? "").trim();

  if (s === "on" || s === "true") return true;
  if (s === "off" || s === "false") return false;

  if (!Number.isNaN(Number(s))) return Number(s);

  if (
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("[") && s.endsWith("]"))
  ) {
    try { return JSON.parse(s); } catch {}
  }

  return s;
}

module.exports = { interpretUserInput };
