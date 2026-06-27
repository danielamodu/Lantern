import { NextResponse } from 'next/server';
import { generateAuditorKeyPair } from '../../../utils/cryptoDisclosure';

export async function GET() {
  try {
    const keys = generateAuditorKeyPair();
    return NextResponse.json(keys);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
