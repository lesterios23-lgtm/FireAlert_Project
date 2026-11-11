import React, { useEffect, useMemo, useRef, useState } from 'react';
import { matchMansalayBarangay, suggestMansalayBarangays } from './mansalayBarangays';

/**
 * Shared Mansalay-only barangay picker with auto-suggest.
 * Accepts only the 17 official barangays of Mansalay.
 */
export default function BarangaySuggestInput({
  id = 'barangay',
  label = 'Barangay',
  value,
  onChange,
  required = false,
  placeholder = 'Type to search 17 Mansalay barangays…',
  hint = 'Only the 17 barangays of Mansalay are accepted.',
}) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const boxRef = useRef(null);

  const matched = matchMansalayBarangay(value);
  const suggestions = useMemo(() => suggestMansalayBarangays(value), [value]);
  const showError = touched && String(value || '').trim() !== '' && !matched;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open ]);

  const choose = (name) => {
    onChange?.(name);
    setTouched(true);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && open && suggestions.length > 0) {
      event.preventDefault();
      choose(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className='resident-address-field resident-address-autosuggest' ref={boxRef}>
      <label htmlFor={id}>
        {label} {required && <span aria-hidden='true' className='resident-address-required'>*</span>}
        <small className='resident-address-scope'>Mansalay only</small>
      </label>
      <input
        id={id}
        type='text'
        role='combobox'
        aria-expanded={open}
        aria-autocomplete='list'
        aria-controls={`${id}-suggestions`}
        aria-activedescendant={open && suggestions.length > 0 ? `${id}-opt-${activeIndex}` : undefined}
        value={value}
        onChange={(e) => {
          onChange?.(e.target.value);
          setTouched(true);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        required={required}
        autoComplete='off'
        className={showError ? 'is-invalid' : matched ? 'is-valid' : ''}
      />
      {open && suggestions.length > 0 && (
        <ul id={`${id}-suggestions`} role='listbox' aria-label='Mansalay barangays' className='resident-barangay-suggestions'>
          {suggestions.map((name, index) => (
            <li key={name} role='option' id={`${id}-opt-${index}`} aria-selected={index === activeIndex}>
              <button
                type='button'
                className={index === activeIndex ? 'active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(name)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span aria-hidden='true'>📍</span> Brgy. {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {matched ? (
        <p className='resident-address-valid' role='status'>✓ Brgy. {matched}, Mansalay</p>
      ) : (
        <p className='resident-address-hint'>{hint}</p>
      )}
    </div>
  );
}
