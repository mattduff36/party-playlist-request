/**
 * Event Title Editor Component
 * 
 * Displays the event title in the top bar and allows inline editing
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';

export default function EventTitleEditor() {
  const { eventSettings, updateEventSettings } = useAdminData();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentTitle = eventSettings?.event_title || 'Party Event';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditValue(currentTitle);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleSave = async () => {
    if (!editValue.trim() || editValue === currentTitle) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    try {
      await updateEventSettings({ event_title: editValue.trim() });
      setIsEditing(false);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update event title:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1.5">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-white font-semibold text-base outline-none min-w-[200px] max-w-[400px]"
          disabled={isSaving}
          maxLength={100}
        />
        <button
          onClick={handleSave}
          disabled={isSaving || !editValue.trim()}
          className="p-1 hover:bg-green-600 rounded transition-colors text-green-400 hover:text-white disabled:opacity-50"
          title="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 hover:bg-red-600 rounded transition-colors text-red-400 hover:text-white disabled:opacity-50"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 rounded-lg transition-colors group"
      title="Click to edit event title"
    >
      <span className="text-white font-semibold text-base">{currentTitle}</span>
      <Pencil className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transition-colors" />
    </button>
  );
}

