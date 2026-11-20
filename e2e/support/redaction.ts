// Redaction for retained evidence, shared by the harness and the fixture
// inspection on the server: it has no Node or Playwright dependency.

export function sanitizeLog(value: string, secrets: string[] = []) {
  let safe = value;
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    safe = safe.split(secret).join('[redacted]');
  return safe
    .replace(/(?:sk|pk)_(?:test|live)_[A-Za-z0-9+/=_-]+/g, '[redacted-key]')
    .replace(
      /(?:preview|prod|dev|project):[^\s"']+\|[^\s"']+/g,
      '[redacted-key]',
    )
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[redacted-jwt]',
    )
    .replace(
      /((?:authorization|cookie|set-cookie|__session|ticket|token|password)\s*[=:]\s*)[^\r\n]+/gi,
      '$1[redacted]',
    );
}

// Field names that hold credentials, in JSON or as object keys.
const credentialName =
  '[\\w-]*(?:token|secret|password|authorization|cookie|session|ticket|credential|signature|key)[\\w-]*';
export const credentialKey = new RegExp(`^${credentialName}$`, 'i');

// A quoted credential key, or an unquoted one before `=` or `:`, found in
// the normalized text.
const quotedCredentialKey = new RegExp(`["'](${credentialName})["']`, 'i');
const unquotedCredentialKey = new RegExp(
  `\\b(${credentialName})\\s*[=:]`,
  'gi',
);

/**
 * The text as a key matcher should see it: `\uXXXX` and `\xXX` escapes
 * decoded and other backslash runs dropped, at any escaping level, with each
 * character's position in the text (a run's first backslash).
 */
function normalize(text: string) {
  const characters: string[] = [];
  const origin: number[] = [];
  for (let index = 0; index < text.length; ) {
    let next = index;
    while (text[next] === '\\') next += 1;
    if (next === index) {
      characters.push(text[index] ?? '');
      origin.push(index);
      index += 1;
      continue;
    }
    const escape = /^(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2}))/.exec(
      text.slice(next, next + 5),
    );
    const code = escape?.[1] ?? escape?.[2];
    if (!escape || !code) {
      // The backslashes go; the next character keeps the run's position.
      if (next < text.length) {
        characters.push(text[next] ?? '');
        origin.push(index);
      }
      index = next + 1;
      continue;
    }
    characters.push(String.fromCharCode(parseInt(code, 16)));
    origin.push(index);
    index = next + escape[0].length;
  }
  return { normalized: characters.join(''), origin };
}

/**
 * Where a credential key starts in the text, or -1. A quoted key counts in
 * any form; an unquoted one before `=` or `:` only when written with escapes,
 * since `sanitizeLog` redacts the plain form to the end of its line.
 */
function findCredentialKey(text: string) {
  const { normalized, origin } = normalize(text);
  const starts: number[] = [];
  const quoted = quotedCredentialKey.exec(normalized);
  if (quoted) starts.push(origin[quoted.index] ?? 0);
  for (const match of normalized.matchAll(unquotedCredentialKey)) {
    const start = origin[match.index] ?? 0;
    const end = origin[match.index + match[0].length - 1] ?? text.length;
    if (text.slice(start, end).includes('\\')) {
      starts.push(start);
      break;
    }
  }
  return starts.length ? Math.min(...starts) : -1;
}

/**
 * Everything from the first credential key to the end of the text replaced.
 * This fails closed by design: no value is parsed, so no escaping, cut value
 * or malformed string can leave part of a credential behind. Credential
 * fields are rare in failure text, so what follows is given up.
 */
function redactCredentialValues(text: string) {
  const start = findCredentialKey(text);
  return start === -1 ? text : `${text.slice(0, start)}[redacted]`;
}

// Characters of opaque values: tokens, keys, base64 and IDs.
const opaque = '[A-Za-z0-9._~+/=-]';

/**
 * Values written after a credential keyword and a space, as in `token
 * 9f8a7b6c`. Prose words stay and opaque values go: a value is redacted when
 * it has 16 or more characters, or 8 or more with a digit or symbol, so
 * "session token expired" is kept. Any standalone opaque run of 32 or more
 * characters is redacted whatever precedes it.
 */
const keywordValue = new RegExp(
  `(?<=\\b${credentialName}\\s+)${opaque}+`,
  'gi',
);
const longOpaqueRun = new RegExp(
  `(?<!${opaque})${opaque}{32,}(?!${opaque})`,
  'g',
);
function isOpaque(value: string) {
  return value.length >= 16 || (value.length >= 8 && /[^A-Za-z]/.test(value));
}

/**
 * Page or service text with tokens, keys, credential fields and values,
 * emails and URLs removed.
 */
export function sanitizeEvidence(text: string) {
  return sanitizeLog(
    redactCredentialValues(text)
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, '[redacted-url]')
      .replace(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
        '[redacted-email]',
      )
      // Whole or cut: a bound can leave only a JWT's first part.
      .replace(/eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*){0,2}/g, '[redacted-jwt]')
      .replace(keywordValue, (value) =>
        isOpaque(value) ? '[redacted]' : value,
      )
      .replace(longOpaqueRun, '[redacted]'),
  );
}

/**
 * The text sanitized, then cut to at most `maxBytes` of UTF-8: a cut after
 * sanitizing can't expose part of a credential.
 */
export function sanitizeAndCap(text: string, maxBytes: number) {
  const safe = sanitizeEvidence(text);
  const bytes = new TextEncoder().encode(safe);
  if (bytes.length <= maxBytes) return safe;
  // A multi-byte character cut in two decodes as a replacement character.
  return new TextDecoder()
    .decode(bytes.slice(0, maxBytes))
    .replace(/\uFFFD$/, '');
}
