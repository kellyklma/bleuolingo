import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ActivityLog, formatDateKey } from './activityStorage';
import { Flashcard } from '../types';

export async function fetchUserCardsFirestore(uid: string): Promise<Flashcard[] | null> {
  try {
    const cardDocRef = doc(db, 'users', uid, 'data', 'cards');
    const snap = await getDoc(cardDocRef);
    if (snap.exists() && Array.isArray(snap.data().list)) {
      return snap.data().list as Flashcard[];
    }
    return null;
  } catch (err) {
    console.error('Failed to load cards from Firestore:', err);
    return null;
  }
}

export async function saveUserCardsFirestore(uid: string, cards: Flashcard[]): Promise<void> {
  try {
    const cardDocRef = doc(db, 'users', uid, 'data', 'cards');
    await setDoc(cardDocRef, { list: cards, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.error('Failed to save cards to Firestore:', err);
  }
}

export async function fetchUserActivityFirestore(uid: string): Promise<ActivityLog> {
  try {
    const activityDocRef = doc(db, 'users', uid, 'data', 'activity');
    const snap = await getDoc(activityDocRef);
    if (snap.exists()) {
      return snap.data().log || {};
    }
    return {};
  } catch (err) {
    console.error('Failed to load activity from Firestore:', err);
    return {};
  }
}

export async function recordReviewActivityFirestore(
  uid: string,
  currentLog: ActivityLog,
  count: number = 1
): Promise<ActivityLog> {
  const todayKey = formatDateKey(new Date());
  const updatedLog: ActivityLog = {
    ...currentLog,
    [todayKey]: (currentLog[todayKey] || 0) + count,
  };

  try {
    const activityDocRef = doc(db, 'users', uid, 'data', 'activity');
    await setDoc(activityDocRef, { log: updatedLog, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.error('Failed to save activity to Firestore:', err);
  }

  return updatedLog;
}