'use client';

import { useState } from 'react';

export interface ReminderOption {
  value: number;
  label: string;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

interface ReminderPickerProps {
  value?: number;
  onChange: (minutes: number | undefined) => void;
  disabled?: boolean;
}

export default function ReminderPicker({
  value,
  onChange,
  disabled = false,
}: ReminderPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = REMINDER_OPTIONS.find((opt) => opt.value === value);

  const handleSelect = (minutes: number | undefined) => {
    onChange(minutes);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2
          text-sm border rounded-lg bg-white
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}
        `}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption ? selectedOption.label : 'Add reminder'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute z-20 w-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* No reminder option */}
            <button
              type="button"
              onClick={() => handleSelect(undefined)}
              className={`
                w-full px-3 py-2 text-left text-sm hover:bg-gray-50
                ${!selectedOption ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}
              `}
            >
              No reminder
            </button>

            <div className="border-t border-gray-100 my-1" />

            {/* Reminder options */}
            {REMINDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full px-3 py-2 text-left text-sm hover:bg-gray-50
                  ${value === option.value ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
