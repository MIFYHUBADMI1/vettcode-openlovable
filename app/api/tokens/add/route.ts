import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { amount, paymentId } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
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

    const currentTokens = user.tokens || 0;

    // Add tokens
    const result = await db.collection('users').updateOne(
      { _id: ObjectId.createFromHexString(session.user.id) },
      { 
        $set: { tokens: currentTokens + amount },
        $push: {
          tokenHistory: {
            type: 'purchase',
            amount: amount,
            timestamp: new Date(),
            paymentId: paymentId || 'manual',
            reason: 'Token purchase'
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to add tokens' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      totalTokens: currentTokens + amount,
    });
  } catch (error) {
    console.error('Token addition error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
