import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { query, results } = await req.json();

    if (!query || !results) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Check if this search already exists
    const existingSearch = await db.collection('searches').findOne({ 
      query: query.toLowerCase() 
    });

    if (existingSearch) {
      // Update existing search
      await db.collection('searches').updateOne(
        { query: query.toLowerCase() },
        { 
          $set: { 
            results,
            lastSearched: new Date(),
            searchCount: existingSearch.searchCount + 1
          } 
        }
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Search updated',
        cached: true 
      });
    } else {
      // Create new search record
      await db.collection('searches').insertOne({
        query: query.toLowerCase(),
        results,
        firstSearched: new Date(),
        lastSearched: new Date(),
        searchCount: 1,
      });
      return NextResponse.json({ 
        success: true, 
        message: 'Search saved',
        cached: false 
      });
    }
  } catch (error) {
    console.error('Save search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
