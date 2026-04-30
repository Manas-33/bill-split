/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Settlement } from '../types';

export async function saveSettlement(
  userId: string,
  data: Omit<Settlement, 'id' | 'timestamp'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'settlements'), {
    userId,
    ...data,
    timestamp: Date.now(),
  });
  return ref.id;
}

export async function removeSettlement(id: string): Promise<void> {
  await deleteDoc(doc(db, 'settlements', id));
}
