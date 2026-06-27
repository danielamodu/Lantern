import { NextResponse } from 'next/server';
import { encryptSettlement } from '../../../utils/cryptoDisclosure';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, auditorPublicKey } = body;

    if (!amount || !auditorPublicKey) {
      return NextResponse.json({ error: 'Missing amount or public key' }, { status: 400 });
    }

    const payload = encryptSettlement(amount, auditorPublicKey);
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
