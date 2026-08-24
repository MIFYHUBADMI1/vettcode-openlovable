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
    
    // PRIMARY METHOD: Search by email (most reliable)
    let user = null;
    if (session.user.email) {
      console.log('[Token Balance API] Searching by email:', session.user.email);
      user = await db.collection('users').findOne({ email: session.user.email });
      console.log('[Token Balance API] Email search result:', !!user);
    }

    if (user) {
      console.log('[Token Balance API] ✅ User found!');
      console.log('[Token Balance API] User _id:', user._id);
      console.log('[Token Balance API] User tokens:', user.tokens);
      
      const tokens = user.tokens || 0;
      
      return NextResponse.json({
        success: true,
        tokens: tokens,
      });
    }

    // FALLBACK: If email search failed, try _id
    console.log('[Token Balance API] Email search failed, trying _id...');
    const userId = session.user.id;
    
    try {
      if (ObjectId.isValid(userId)) {
        user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        console.log('[Token Balance API] ObjectId search result:', !!user);
      }
    } catch (error) {
      console.log('[Token Balance API] ObjectId search error:', error);
    }

    if (!user) {
      console.log('[Token Balance API] ❌ User not found after all methods');
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
