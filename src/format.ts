function summarizeInput(input: unknown): string {
  const raw = safeJson(input);
  const singleLine = raw.replaceAll(/\s+/g, ' ').trim();
  if (singleLine.length <= 120) {
    return singleLine;
  }
  return `${singleLine.slice(0, 117)}...`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default summarizeInput;
