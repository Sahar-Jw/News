import { Get2TradeFrame } from '@/components/site/get2trade/shell';

/** Get2Trade (flexible offices): one header + control bar (tabs and booking buttons) around the nested pages
 *  /get2trade (about), /get2trade/services, /get2trade/packages, /get2trade/spaces and /get2trade/news. */
export default function Get2TradeLayout({ children }: { children: React.ReactNode }) {
  return <Get2TradeFrame>{children}</Get2TradeFrame>;
}
