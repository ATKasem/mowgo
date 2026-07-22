import { useState, useCallback, useRef } from 'react';

/**
 * Shared toggle with animation cleanup — used by Schedule + Route.
 * Returns [animatingId, toggle(id, currentStatus, setter)].
 */
export function useAnimatedToggle() {
  const [animating, setAnimating] = useState(null);
  const timerRef = useRef(null);

  const toggle = useCallback((id, currentStatus, setter) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAnimating(id);
    timerRef.current = setTimeout(() => {
      setter(prev => prev.map(item =>
        item.id === id ? { ...item, status: currentStatus === 'done' ? 'scheduled' : 'done' } : item
      ));
      setAnimating(null);
    }, 150);
  }, []);

  return [animating, toggle];
}

/**
 * Shared form visibility + state management.
 */
export function useFormState(initial) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(initial);

  function openNew() { setEditId(null); setForm(initial); setShowForm(true); }
  function openEdit(item) { setEditId(item.id); setForm(item); setShowForm(true); }
  function close() { setShowForm(false); setEditId(null); }

  return { showForm, editId, form, setForm, openNew, openEdit, close };
}
