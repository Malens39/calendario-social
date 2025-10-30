'use client';
import * as React from 'react';
export function Input(props: any) {
  return <input {...props} className={`border rounded-xl px-3 py-2 text-sm w-full ${props.className||''}`}/>;
}
