import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({ 
      _id: ObjectId.createFromHexString(session.user.id) 
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get token balance and history
    const tokenBalance = user.tokens || 0;
    const tokenHistory = user.tokenHistory || [];
    const paymentScreenshots = user.paymentScreenshots || [];

    // Get all payment verifications for this user
    const verifications = await db.collection('paymentVerifications')
      .find({ userId: session.user.id })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      tokenBalance,
      tokenHistory,
      paymentScreenshots,
      verifications,
    });
  } catch (error) {
    console.error('Payment history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
