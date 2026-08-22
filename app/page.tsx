import { CommonStrategy, type StrategyState } from '@/components/CommonStrategy';
import { forClient, getCachedCommonStrategyState } from '@/lib/common-strategy';

export default async function Home(){
  let initial:StrategyState|undefined;
  let error='';
  try{initial=forClient(await getCachedCommonStrategyState())}catch(e){error=e instanceof Error?e.message:'Common Strategy data could not be loaded.'}
  return <CommonStrategy initial={initial} error={error}/>;
}
