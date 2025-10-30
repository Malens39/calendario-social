'use client';
import * as React from 'react';
const Ctx = React.createContext<any>(null);
export function Tabs({ value, onValueChange, children }: any){ return <Ctx.Provider value={{value, onValueChange}}>{children}</Ctx.Provider>; }
export function TabsList({ children, className='' }: any){ return <div className={`flex gap-2 ${className}`}>{children}</div>; }
export function TabsTrigger({ value, children }: any){
  const ctx = React.useContext(Ctx);
  const active = ctx?.value === value;
  return <button className={`px-2 py-1 rounded-xl text-xs border ${active?'bg-gray-900 text-white':'bg-white'}`} onClick={()=>ctx.onValueChange(value)}>{children}</button>;
}
export function TabsContent({ value, children }: any){
  const ctx = React.useContext(Ctx);
  if (ctx?.value !== value) return null;
  return <div>{children}</div>;
}
