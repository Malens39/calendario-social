'use client';
import * as React from 'react';
type Item = { value: string; label: React.ReactNode };
const Ctx = React.createContext<any>(null);
export function Select({ value, onValueChange, children }: any){
  const [items,setItems] = React.useState<Item[]>([{value:'',label:'Seleziona...'}]);
  return <Ctx.Provider value={{value,onValueChange,items,setItems}}>{children}</Ctx.Provider>;
}
export function SelectTrigger({ className='' }: any){
  const ctx = React.useContext(Ctx);
  return <select className={`border rounded-xl px-3 py-2 text-sm ${className}`} value={ctx.value} onChange={(e)=>ctx.onValueChange(e.target.value)}>
    {ctx.items.map((it:Item) => <option key={it.value} value={it.value}>{it.label}</option>)}
  </select>;
}
export function SelectValue({ placeholder }: any){ return null; }
export function SelectContent({ children }: any){ return <>{children}</>; }
export function SelectItem({ value, children }: any){
  const ctx = React.useContext(Ctx);
  React.useEffect(()=>{ ctx.setItems((prev:Item[])=> prev.find((p:Item)=>p.value===value)? prev : [...prev, {value, label: children}] ); }, [value, children]);
  return null;
}
