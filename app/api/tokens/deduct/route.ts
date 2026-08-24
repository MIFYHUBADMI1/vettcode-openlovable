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

    const { amount, metadata } = await req.json();

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

    if (currentTokens < amount) {
      return NextResponse.json(
        { 
          error: 'Insufficient tokens',
          currentTokens,
          required: amount
        },
        { status: 400 }
      );
    }

    // Deduct tokens
    const result = await db.collection('users').updateOne(
      { _id: ObjectId.createFromHexString(session.user.id) },
      { 
        $set: { tokens: currentTokens - amount },
        $push: {
          tokenHistory: {
            type: 'deduction',
            amount: -amount,
            timestamp: new Date(),
            reason: 'AI generation usage',
            metadata: metadata || {}
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to deduct tokens' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      remainingTokens: currentTokens - amount,
    });
  } catch (error) {
    console.error('Token deduction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
