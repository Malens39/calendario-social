'use client';
import * as React from 'react';
const Ctx = React.createContext<any>(null);
export function Dialog({ children }: any){
  const [open,setOpen] = React.useState(false);
  return <Ctx.Provider value={{open,setOpen}}>{children}</Ctx.Provider>;
}
export function DialogTrigger({ asChild=false, children }: any){
  const ctx = React.useContext(Ctx);
  const child = React.cloneElement(children, { onClick: ()=>ctx.setOpen(true) });
  return asChild? child : <button onClick={()=>ctx.setOpen(true)}>{children}</button>;
}
export function DialogContent({ className='', children }: any){
  const ctx = React.useContext(Ctx);
  if(!ctx.open) return null;
  return <div className={`fixed inset-0 bg-black/30 grid place-items-center z-50`}>
    <div className={`bg-white rounded-2xl shadow-xl w-[90%] max-w-xl ${className}`}>{children}</div>
  </div>;
}
export function DialogHeader({ children }: any){ return <div className="p-4 border-b">{children}</div>; }
export function DialogTitle({ children }: any){ return <div className="text-lg font-semibold">{children}</div>; }
export function DialogDescription({ children }: any){ return <div className="text-sm text-gray-500">{children}</div>; }
