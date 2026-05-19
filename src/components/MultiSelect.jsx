import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Ban } from 'lucide-react';
import './MultiSelect.css';

export function MultiSelect({ options, selected, onChange, placeholder, className, mode = 'include', onModeChange }) {
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

  const isExcludeMode = mode === 'exclude';

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length === 1 
      ? `${isExcludeMode ? '≠ ' : ''}${selected[0]}` 
      : `${isExcludeMode ? '≠ ' : ''}${selected.length} selected`;

  return (
    <div className={`multi-select-container ${className || ''}`} ref={dropdownRef}>
      <button 
        className={`multi-select-trigger ${selected.length > 0 ? (isExcludeMode ? 'active exclude' : 'active') : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="multi-select-dropdown">
          {/* Mode toggle header */}
          {onModeChange && (
            <div className="multi-select-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${!isExcludeMode ? 'active' : ''}`}
                onClick={() => onModeChange('include')}
                title="Include: show only selected"
              >
                <Check size={12} />
                <span>Is</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${isExcludeMode ? 'active' : ''}`}
                onClick={() => onModeChange('exclude')}
                title="Exclude: hide selected"
              >
                <Ban size={12} />
                <span>Is not</span>
              </button>
            </div>
          )}

          {options.length === 0 ? (
            <div className="multi-select-empty">No options</div>
          ) : (
            options.map(option => {
              const isSelected = selected.includes(option);
              return (
                <div 
                  key={option} 
                  className={`multi-select-item ${isSelected ? (isExcludeMode ? 'selected exclude' : 'selected') : ''}`}
                  onClick={() => toggleOption(option)}
                >
                  <div className={`checkbox ${isSelected ? (isExcludeMode ? 'checked exclude' : 'checked') : ''}`}>
                    {isSelected && (isExcludeMode ? <Ban size={10} /> : <Check size={12} />)}
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
