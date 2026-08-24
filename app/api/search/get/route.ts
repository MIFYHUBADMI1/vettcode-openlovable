import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Find cached search
    const cachedSearch = await db.collection('searches').findOne({ 
      query: query.toLowerCase() 
    });

    if (!cachedSearch) {
      return NextResponse.json({ 
        cached: false,
        message: 'No cached results found' 
      });
    }

    // Check if cache is older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isExpired = new Date(cachedSearch.lastSearched) < twentyFourHoursAgo;

    if (isExpired) {
      return NextResponse.json({ 
        cached: false,
        expired: true,
        message: 'Cache expired (older than 24 hours)' 
      });
    }

    return NextResponse.json({ 
      cached: true,
      results: cachedSearch.results,
      lastSearched: cachedSearch.lastSearched,
      searchCount: cachedSearch.searchCount
    });
  } catch (error) {
    console.error('Get search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
