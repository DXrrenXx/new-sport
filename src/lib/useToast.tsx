// 简单的全局提示 hook。
import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({ msg: '', type: 'success' });

  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast({ msg: '', type }), type === 'error' ? 5000 : 2500);
  }, []);

  return { toast, showSuccess: (m: string) => show(m, 'success'), showError: (m: string) => show(m, 'error') };
}
