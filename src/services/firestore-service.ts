
import { db } from '@/config/firebase'; // Assumes db is initialized and exported from firebase.ts
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  CollectionReference,
  DocumentData,
} from 'firebase/firestore';
import type {
  SessionData,
  QueryEntry,
  SpecialistOutputEntry,
  SynthesizerResponseEntry,
  SummaryEntry,
  SessionMetadataEntry,
  DataFileEntry,
} from '@/types/firestore';

// Helper to assert db is initialized
function getDbInstance() {
  if (!db) {
    throw new Error("Firestore database is not initialized. Check Firebase configuration.");
  }
  return db;
}

// --- Session Management ---
export async function createSession(
  userId: string,
  initialCompanyTicker: string | null = null
): Promise<string> {
  const firestoreDb = getDbInstance();
  const sessionsCol = collection(firestoreDb, 'sessions') as CollectionReference<Omit<SessionData, 'id'>>;
  const now = serverTimestamp();
  const newSessionRef = await addDoc(sessionsCol, {
    user_id: userId,
    created_at: now as Timestamp, // Cast serverTimestamp for type compatibility
    last_active: now as Timestamp,
    company_ticker: initialCompanyTicker,
  });
  return newSessionRef.id;
}

export async function updateSessionLastActive(sessionId: string): Promise<void> {
  const firestoreDb = getDbInstance();
  const sessionRef = doc(firestoreDb, 'sessions', sessionId);
  await updateDoc(sessionRef, {
    last_active: serverTimestamp(),
  });
}

export async function updateSessionCompanyTicker(sessionId: string, companyTicker: string | null): Promise<void> {
  const firestoreDb = getDbInstance();
  const sessionRef = doc(firestoreDb, 'sessions', sessionId);
  await updateDoc(sessionRef, {
    company_ticker: companyTicker,
    last_active: serverTimestamp(),
  });
}

// --- Subcollection Operations ---

// Generic helper for adding to a session's subcollection
async function addToSessionSubcollection<T extends Omit<DocumentData, 'id' | 'timestamp'>>(
  sessionId: string,
  subcollectionName: string,
  data: T
): Promise<string> {
  const firestoreDb = getDbInstance();
  const subColRef = collection(firestoreDb, 'sessions', sessionId, subcollectionName) as CollectionReference<T & { timestamp: Timestamp }>;
  const docRef = await addDoc(subColRef, {
    ...data,
    timestamp: serverTimestamp() as Timestamp,
  });
  return docRef.id;
}

export async function addQueryToSession(
  sessionId: string,
  text: string
): Promise<string> {
  return addToSessionSubcollection<Omit<QueryEntry, 'id' | 'timestamp'>>(sessionId, 'queries', { text });
}

export async function addSpecialistOutputToSession(
  sessionId: string,
  data: Pick<SpecialistOutputEntry, 'specialist_type' | 'output_text' | 'file_links'>
): Promise<string> {
  return addToSessionSubcollection<Omit<SpecialistOutputEntry, 'id' | 'timestamp'>>(sessionId, 'specialist_outputs', data);
}

export async function addSynthesizerResponseToSession(
  sessionId: string,
  data: Pick<SynthesizerResponseEntry, 'response_text' | 'query_id'>
): Promise<string> {
  return addToSessionSubcollection<Omit<SynthesizerResponseEntry, 'id' | 'timestamp'>>(sessionId, 'synthesizer_responses', data);
}

export async function addSummaryToSession(
  sessionId: string,
  data: Pick<SummaryEntry, 'summary_text' | 'query_id'>
): Promise<string> {
  return addToSessionSubcollection<Omit<SummaryEntry, 'id' | 'timestamp'>>(sessionId, 'summaries', data);
}

export async function addSessionMetadata(
  sessionId: string,
  key: string,
  value: string
): Promise<string> {
  return addToSessionSubcollection<Omit<SessionMetadataEntry, 'id' | 'timestamp'>>(sessionId, 'metadata', { key, value });
}

// --- Data Files Metadata Management ---
export async function addDataFile(
  data: Omit<DataFileEntry, 'id' | 'created_at'>
): Promise<string> {
  const firestoreDb = getDbInstance();
  const dataFilesCol = collection(firestoreDb, 'data_files') as CollectionReference<Omit<DataFileEntry, 'id'>>;
  const docRef = await addDoc(dataFilesCol, {
    ...data,
    created_at: serverTimestamp() as Timestamp,
  });
  return docRef.id;
}

// Example: How you might query these (not part of this initial setup task, but for context)
// import { query, where, getDocs, orderBy, limit } from 'firebase/firestore';
//
// export async function getSessionQueries(sessionId: string, count: number = 10) {
//   const firestoreDb = getDbInstance();
//   const queriesRef = collection(firestoreDb, 'sessions', sessionId, 'queries');
//   const q = query(queriesRef, orderBy('timestamp', 'desc'), limit(count));
//   const snapshot = await getDocs(q);
//   return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueryEntry));
// }
