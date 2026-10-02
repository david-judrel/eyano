/**
 * Champs publics d'une piece jointe. Les octets (`data`, images Kepler) n'en
 * font jamais partie : ils ne sont servis que par `GET /files/:id/content`.
 */
export const ATTACHMENT_PUBLIC_SELECT = {
  id: true,
  messageId: true,
  fileName: true,
  mimeType: true,
  size: true,
  storageKey: true,
  createdAt: true,
} as const;
