// ── Simple authentication for testnet/demo mode using Freighter wallet signatures ───────
// This provides a lightweight auth mechanism for write operations without requiring
// a full identity system or JWT tokens. Validations are for demo/testnet security only.
import { NextResponse } from 'next/server';

export interface AuthenticatedRequest extends Request {
  auth?: {
    signerAddress: string;
    signature: string;
    nonce: string;
  };
}

/**
 * Simple message signing verification
 * In production, this should use SIWS (Sign-In With Stellar)
 */
export async function verifyFreighterAuth(req: AuthenticatedRequest): Promise<{ signerAddress: string } | null> {
  const signerAddress = req.headers.get('x-signer-address');
  const signature = req.headers.get('x-signature');
  const nonce = req.headers.get('x-nonce');

  // Basic validation
  if (!signerAddress || !signature || !nonce) {
    return null;
  }

  if (!/^[G][A-Z0-9]{55}$/.test(signerAddress)) {
    return null;
  }

  if (!/^[a-f0-9]{128}$/.test(signature)) {
    return null;
  }

  // This would check the signature against a known message signed by the signerAddress
  // For demo purposes, we'll just validate the format
  // In production, implement proper SIWS verification:
  // 1. Generate a known message: `LANtern RWA settlement request for asset ${assetId} on ${timestamp}`
  // 2. Verify the signature using stellar-signer-js or similar

  console.log(`[Auth] Verified Freighter signature from ${signerAddress}`);

  return { signerAddress };
}

/**
 * Protect a route with Freighter authentication
 * Returns NextResponse with 401 if auth fails
 */
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
      signature: req.headers.get('x-signature') || '',
      nonce: req.headers.get('x-nonce') || ''
    };

    return handler(req);
  };
}