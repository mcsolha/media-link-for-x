// Contrato de mensagens entre content script e service worker.
import type { SyndicationInfo } from './core';
export type Req = { type: 'syndication'; id: string };
export type Res = { ok: true; info: SyndicationInfo } | { ok: false; error: string };
