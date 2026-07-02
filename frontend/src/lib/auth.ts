import { NextResponse } from 'next/server';
import { Keypair, TransactionBuilder, Memo } from '@stellar/stellar-sdk';

export interface AuthenticatedRequest extends Request {
  auth?: {
    signerAddress: string;
  };
}

interface Session {
  signerAddress: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(signerAddress: string): Promise<string> {
  const token = generateToken();
  sessions.set(token, {
    signerAddress,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function verifySession(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.signerAddress;
}

export async function verifySignature(signerAddress: string, signedXdr: string, nonce: string, networkPassphrase: string): Promise<boolean> {
  try {
    const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    if (tx.source !== signerAddress) return false;
    const memo = tx.memo;
    if (!memo || memo.type !== 'text' || memo.value.toString() !== nonce) return false;
    const hash = tx.hash();
    return Keypair.fromPublicKey(signerAddress).verify(hash, tx.signatures[0]?.signature() ?? Buffer.alloc(0));
  } catch {
    return false;
  }
}

export async function verifyFreighterAuth(req: AuthenticatedRequest): Promise<{ signerAddress: string } | null> {
  const sessionToken = req.headers.get('x-session-token');
  if (sessionToken) {
    const address = verifySession(sessionToken);
    if (address) return { signerAddress: address };
  }

  const signerAddress = req.headers.get('x-signer-address');
  const signedXdr = req.headers.get('x-signature');
  const nonce = req.headers.get('x-nonce');

  if (!signerAddress || !signedXdr || !nonce) {
    return null;
  }

  const isContractId = /^C[A-Z0-9]{55}$/.test(signerAddress);
  const isPublicKey = /^G[A-Z0-9]{55}$/.test(signerAddress);
  if (!isContractId && !isPublicKey) return null;

  const networkPassphrase = process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

  if (await verifySignature(signerAddress, signedXdr, nonce, networkPassphrase)) {
    return { signerAddress };
  }

  return null;
}

export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): (req: AuthenticatedRequest) => Promise<NextResponse> {
  return async (req: AuthenticatedRequest) => {
    const authResult = await verifyFreighterAuth(req);

    if (!authResult) {
      return NextResponse.json(
        {
          error: 'Authentication required. Please connect with Freighter wallet.',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    req.auth = {
      signerAddress: authResult.signerAddress,
    };

    return handler(req);
  };
}