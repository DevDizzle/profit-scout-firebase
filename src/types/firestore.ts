
import type { Timestamp } from 'firebase/firestore';

// Base document structure with common ID and timestamp fields
export interface BaseDocument { // Added export here
  id: string; // Firestore auto-generated ID
  timestamp: Timestamp;
}

// sessions collection
export interface SessionData {
  id: string; // Firestore auto-generated ID, serves as session_id
  user_id: string; // Firebase Auth UID
  created_at: Timestamp;
  last_active: Timestamp;
  company_ticker: string | null;
}

// sessions/{session_id}/queries subcollection
export interface QueryEntry extends BaseDocument {
  text: string;
}

// sessions/{session_id}/specialist_outputs subcollection
export interface SpecialistOutputEntry extends BaseDocument {
  specialist_type: string; // e.g., "fundamentals", "technicals", "earnings_call"
  output_text: string;
  file_links: string[]; // GCS paths, e.g., gs://profit-scout/fundamentals/MSFT_2025-03-31.json
}

// sessions/{session_id}/synthesizer_responses subcollection
export interface SynthesizerResponseEntry extends BaseDocument {
  response_text: string;
  query_id: string; // Links to the corresponding QueryEntry.id
}

// sessions/{session_id}/summaries subcollection
export interface SummaryEntry extends BaseDocument {
  summary_text: string;
  query_id: string; // Links to the query triggering the summary
}

// sessions/{session_id}/metadata subcollection
export interface SessionMetadataEntry extends BaseDocument {
  key: string; // e.g., "session_status"
  value: string; // e.g., "active", "expired"
}


// data_files collection
export interface DataFileEntry {
  id: string; // Firestore auto-generated ID, serves as file_id
  ticker: string;
  file_link: string; // GCS path, e.g., gs://profit-scout/fundamentals/MSFT_2025-03-31.json
  description: string;
  quarter_end_date: Timestamp;
  earnings_call_date: Timestamp | null;
  industry: string;
  sector: string;
  created_at: Timestamp; // When this metadata entry was created
}

