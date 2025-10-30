'use client';
import * as React from 'react';
export function Button({ children, className='', variant='default', size='md', ...props }: any) {
  const base = 'inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm border';
  const variants: any = {
    default: 'bg-gray-900 text-white border-gray-900 hover:opacity-90',
    secondary: 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50',
    outline: 'bg-white text-gray-900 border-gray-400',
    ghost: 'bg-transparent text-gray-700 border-transparent hover:bg-gray-100',
  };
  const sizes: any = { sm: 'text-xs px-2 py-1 rounded-xl', md: '', lg: 'text-base px-4 py-2' };
  return <button className={[base, variants[variant], sizes[size], className].join(' ')} {...props}>{children}</button>
}
