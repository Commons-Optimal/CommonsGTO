import { NextRequest, NextResponse } from 'next/server';
import { COMMON_STRATEGY_HANDLE, forClient, getCachedCommonStrategyState, getPotentialVouch } from '@/lib/common-strategy';

// Viewers poll this every 4s. A short shared cache plus in-flight dedupe keeps
// the upstream Commons API to roughly one round-trip per window no matter how
// many people have the page open; s-maxage lets the edge absorb the rest.
const LIVE_HEADERS = { 'cache-control': 'public, s-maxage=3, stale-while-revalidate=10' };
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request:NextRequest){
  try{
    const quote=request.nextUrl.searchParams.get('quote')?.replace(/^@/,'').trim();
    if(quote){
      const result=await getPotentialVouch(quote);
      if(!result) return NextResponse.json({error:`@${quote} was not found on Commons.`},{status:404,headers:NO_STORE});
      return NextResponse.json({treasuryHandle:COMMON_STRATEGY_HANDLE,quote:result},{headers:NO_STORE});
    }
    const state=await getCachedCommonStrategyState();
    return NextResponse.json(forClient(state),{headers:LIVE_HEADERS});
  }catch(error){
    const message=error instanceof Error?error.message:'Common Strategy data could not be loaded.';
    return NextResponse.json({error:message},{status:503,headers:NO_STORE});
  }
}
