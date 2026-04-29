/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Person } from '../types';

export const DEFAULT_MY_DISPLAY_NAME = 'You';

const PRIMARY_PARTICIPANT_ID = '1';

export function userProfileRef(uid: string) {
  return doc(db, 'users', uid);
}

function normalizeParticipantsFromServer(raw: unknown): Person[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) return null;
  const out: Person[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    const id = rec.id;
    const name = rec.name;
    const color = rec.color;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof color !== 'string') return null;
    const idT = id.trim();
    const nameT = name.trim();
    const colorT = color.trim();
    if (!idT || !nameT || !colorT) return null;
    out.push({ id: idT, name: nameT, color: colorT });
  }
  if (!out.some((p) => p.id === PRIMARY_PARTICIPANT_ID)) return null;
  return out;
}

export interface LoadedUserProfile {
  displayName?: string;
  participants?: Person[];
}

export async function fetchUserProfile(uid: string): Promise<LoadedUserProfile | null> {
  const snap = await getDoc(userProfileRef(uid));
  if (!snap.exists()) return null;
  const d = snap.data() ?? {};
  const displayName = typeof d.displayName === 'string' ? d.displayName.trim() : '';
  const participants = normalizeParticipantsFromServer(d.participants);
  const out: LoadedUserProfile = {};
  if (displayName.length > 0) out.displayName = displayName;
  if (participants) out.participants = participants;
  return Object.keys(out).length ? out : null;
}

export async function saveUserProfile(
  uid: string,
  payload: { displayName: string; participants: Person[]; updatedAt: number }
): Promise<void> {
  await setDoc(
    userProfileRef(uid),
    {
      displayName: payload.displayName,
      participants: payload.participants.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      })),
      updatedAt: payload.updatedAt,
    },
    { merge: true }
  );
}
