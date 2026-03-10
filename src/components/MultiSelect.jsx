import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './MultiSelect.css';

export function MultiSelect({ options, selected, onChange, placeholder, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option) => {
    const updated = selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option];
    onChange(updated);
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length === 1 
      ? selected[0] 
      : `${selected.length} selected`;

  return (
    <div className={`multi-select-container ${className || ''}`} ref={dropdownRef}>
      <button 
        className={`multi-select-trigger ${selected.length > 0 ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="multi-select-dropdown">
          {options.length === 0 ? (
            <div className="multi-select-empty">No options</div>
          ) : (
            options.map(option => {
              const isSelected = selected.includes(option);
              return (
                <div 
                  key={option} 
                  className={`multi-select-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleOption(option)}
                >
                  <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <Check size={12} />}
                  </div>
                  <span className="truncate" title={option}>{option}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
