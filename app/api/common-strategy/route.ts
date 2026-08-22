import { NextRequest, NextResponse } from 'next/server';
import { COMMON_STRATEGY_HANDLE, getCommonStrategyState, getPotentialVouch } from '@/lib/common-strategy';

export async function GET(request:NextRequest){
  try{
    const quote=request.nextUrl.searchParams.get('quote')?.replace(/^@/,'').trim();
    if(quote){
      const result=await getPotentialVouch(quote);
      if(!result) return NextResponse.json({error:`@${quote} was not found on Commons.`},{status:404,headers:{'cache-control':'no-store'}});
      return NextResponse.json({treasuryHandle:COMMON_STRATEGY_HANDLE,quote:result},{headers:{'cache-control':'no-store'}});
    }
    const state=await getCommonStrategyState();
    return NextResponse.json(state,{headers:{'cache-control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Common Strategy data could not be loaded.';
    return NextResponse.json({error:message},{status:503,headers:{'cache-control':'no-store'}});
  }
}
