'use client';
import * as React from 'react';
export function Checkbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v:boolean)=>void }) {
  return <input type="checkbox" checked={checked} onChange={e=>onCheckedChange(e.target.checked)} />;
}
