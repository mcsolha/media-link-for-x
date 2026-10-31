// Formato das mensagens entre content script e service worker.
import { isValidId, type SyndicationInfo } from './core';

export interface Req {
  type: 'syndication';
  id: string;
}
export type Res = { ok: true; info: SyndicationInfo } | { ok: false; error: string };

export function isReq(msg: unknown): msg is Req {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Req).type === 'syndication' &&
    isValidId((msg as Req).id)
  );
}

/** Valida a resposta (o content script não confia cegamente no que chega). */
export function isRes(v: unknown): v is Res {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (r.ok === false) return typeof r.error === 'string';
  if (r.ok !== true || typeof r.info !== 'object' || r.info === null) return false;
  const info = r.info as Record<string, unknown>;
  return isValidId(info.id) && Array.isArray(info.media);
}
