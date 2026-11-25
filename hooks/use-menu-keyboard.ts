'use client';

import { useEffect } from 'react';

interface UseMenuKeyboardOptions {
  enabled?: boolean;
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onSelect?: () => void;
  onClose?: () => void;
  allowTextInputNavigation?: boolean;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Unified keyboard navigation hook for menus & modals.
 * Supports WASD + Arrow keys for navigation, Space/Enter to select,
 * and E / Escape to close (ready for multi-player/co-op key mapping).
 */
export function useMenuKeyboard({
  enabled = true,
  onUp,
  onDown,
  onLeft,
  onRight,
  onSelect,
  onClose,
  allowTextInputNavigation = false,
}: UseMenuKeyboardOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput = isEditableElement(e.target);

      // Inside a text input (e.g. World Name), let user type freely.
      // Only Escape or Down/Enter (if opted in) escapes or submits.
      if (inInput) {
        if (e.key === 'Escape' && !e.repeat && onClose) {
          e.preventDefault();
          onClose();
        } else if (
          allowTextInputNavigation &&
          (e.code === 'ArrowDown' || e.code === 'ArrowUp')
        ) {
          e.preventDefault();
          if (e.code === 'ArrowDown') onDown?.();
          else onUp?.();
        }
        return;
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (onUp) {
          e.preventDefault();
          onUp();
        }
        return;
      }

      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (onDown) {
          e.preventDefault();
          onDown();
        }
        return;
      }

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (onLeft) {
          e.preventDefault();
          onLeft();
        }
        return;
      }

      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (onRight) {
          e.preventDefault();
          onRight();
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.repeat) return;
        if (onSelect) {
          e.preventDefault();
          onSelect();
        }
        return;
      }

      if (e.code === 'KeyE' || e.key === 'Escape') {
        if (e.repeat) return;
        if (onClose) {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onUp,
    onDown,
    onLeft,
    onRight,
    onSelect,
    onClose,
    allowTextInputNavigation,
  ]);
}
