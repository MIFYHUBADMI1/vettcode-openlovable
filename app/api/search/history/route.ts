import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const db = await getDatabase();
    
    // Get last 10 searches, sorted by most recent
    const searches = await db.collection('searches')
      .find({})
      .sort({ lastSearched: -1 })
      .limit(10)
      .project({ query: 1, lastSearched: 1, searchCount: 1, _id: 0 })
      .toArray();

    return NextResponse.json({ 
      success: true,
      history: searches 
    });
  } catch (error) {
    console.error('Get search history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    await db.collection('searches').deleteOne({ 
      query: query.toLowerCase() 
    });

    return NextResponse.json({ 
      success: true,
      message: 'Search deleted from history' 
    });
  } catch (error) {
    console.error('Delete search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
