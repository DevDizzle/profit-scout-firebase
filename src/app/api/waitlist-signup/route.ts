
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { z } from 'zod';
import type { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
// Ensure your service account key is set in the environment variables for deployed environments
// e.g., GOOGLE_APPLICATION_CREDENTIALS pointing to your service account JSON file,
// or ensure the Cloud Run service account has necessary IAM permissions.
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    admin.initializeApp({
      projectId: projectId,
      // If using GOOGLE_APPLICATION_CREDENTIALS env var, no credential needed here
      // otherwise, for explicit credential:
      // credential: admin.credential.applicationDefault(), // or specific cert
    });
    console.log(`[API /api/waitlist-signup] Firebase Admin SDK Initialized for project: ${projectId}.`);
  } else {
    // Fallback if projectId is not in env, though it should be
    admin.initializeApp();
    console.warn('[API /api/waitlist-signup] Firebase Admin SDK Initialized without explicit projectId. Relying on ADC default.');
  }
}

const firestoreAdmin = admin.firestore();

const WaitlistSignupSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = WaitlistSignupSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid email address.", details: validationResult.error.format() }, { status: 400 });
    }

    const { email } = validationResult.data;

    // Optional: Check if email already exists (can be intensive on reads for large lists)
    const waitlistCollection = firestoreAdmin.collection('waitlist_emails');
    const existingEntry = await waitlistCollection.where('email', '==', email).limit(1).get();

    if (!existingEntry.empty) {
      return NextResponse.json({ error: 'This email is already on the waitlist.' }, { status: 409 });
    }

    const docRef = await waitlistCollection.add({
      email: email,
      submitted_at: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    });

    console.log(`[API /api/waitlist-signup] Email added to waitlist: ${email}, Doc ID: ${docRef.id}`);
    return NextResponse.json({ message: 'Successfully added to waitlist!', id: docRef.id }, { status: 201 });

  } catch (error) {
    const typedError = error as Error;
    console.error('[API /api/waitlist-signup] Error processing waitlist signup:', typedError.message, typedError.stack);
    return NextResponse.json({ error: 'Internal Server Error processing waitlist signup.', details: typedError.message }, { status: 500 });
  }
}
