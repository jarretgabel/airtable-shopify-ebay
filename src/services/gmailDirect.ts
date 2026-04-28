function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function sendPlainTextEmailDirect(to: string, subject: string, body: string): Promise<boolean> {
  const token = (import.meta.env.VITE_GOOGLE_GMAIL_ACCESS_TOKEN as string | undefined)?.trim();
  if (!token) {
    return false;
  }

  const fromEmail = (import.meta.env.VITE_GOOGLE_GMAIL_FROM_EMAIL as string | undefined)?.trim();
  const mime = [
    ...(fromEmail ? [`From: ${fromEmail}`] : []),
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send Gmail message (${response.status}): ${detail}`);
  }

  return true;
}