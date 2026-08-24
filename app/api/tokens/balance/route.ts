import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('[Token Balance API] Request received');
    
    const session = await getServerSession(authOptions);
    console.log('[Token Balance API] Session user ID:', session?.user?.id);
    console.log('[Token Balance API] Session user email:', session?.user?.email);
    
    if (!session || !session.user?.id) {
      console.log('[Token Balance API] Unauthorized - no session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    console.log('[Token Balance API] Database connected');
    
    // Try to find user by ID
    let user;
    try {
      const objectId = ObjectId.createFromHexString(session.user.id);
      console.log('[Token Balance API] Looking for user with ObjectId:', objectId.toString());
      user = await db.collection('users').findOne({ _id: objectId });
    } catch (idError) {
      console.log('[Token Balance API] ObjectId conversion failed, trying string ID:', idError);
      // Try with string ID as fallback
      user = await db.collection('users').findOne({ _id: session.user.id as any });
    }

    console.log('[Token Balance API] User found:', !!user);
    if (user) {
      console.log('[Token Balance API] User email:', user.email);
      console.log('[Token Balance API] User tokens:', user.tokens);
      console.log('[Token Balance API] User _id type:', typeof user._id);
    }

    if (!user) {
      console.log('[Token Balance API] User not found in DB');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tokens = user.tokens || 0;
    console.log('[Token Balance API] Returning tokens:', tokens);

    return NextResponse.json({
      success: true,
      tokens: tokens,
    });
  } catch (error) {
    console.error('[Token Balance API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
