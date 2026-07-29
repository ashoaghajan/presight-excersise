/**
 * Tests for the search-input ↔ URL binding.
 *
 * The first test is the regression guard for a bug found in a real browser:
 * with the input bound straight to URL state, typing "kha" produced "a",
 * because each keystroke triggered a navigation and React re-rendered the
 * controlled input with a stale value.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS } from '../model/list-config';
import { useSearchInput } from './useSearchInput';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('typing', () => {
  it('never drops a keystroke, however fast the typing', () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useSearchInput('', commit));

    act(() => result.current.setValue('k'));
    act(() => result.current.setValue('kh'));
    act(() => result.current.setValue('kha'));

    // The input shows every character immediately.
    expect(result.current.value).toBe('kha');
  });

  it('commits once after typing settles, not once per keystroke', () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useSearchInput('', commit));

    act(() => result.current.setValue('k'));
    act(() => result.current.setValue('kh'));
    act(() => result.current.setValue('kha'));

    expect(commit).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('kha');
  });

  it('reports pending while the typed value has not reached the URL', () => {
    const { result } = renderHook(() => useSearchInput('', vi.fn()));

    expect(result.current.isPending).toBe(false);

    act(() => result.current.setValue('kha'));
    expect(result.current.isPending).toBe(true);
  });
});

describe('external URL changes', () => {
  it('adopts a new URL value — Back, Forward and Reset', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(({ url }) => useSearchInput(url, commit), {
      initialProps: { url: 'kha' },
    });

    expect(result.current.value).toBe('kha');

    // Simulates Back landing on a URL with no search term.
    rerender({ url: '' });
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(result.current.value).toBe('');
    // Adopting an external value must not echo it back as a new navigation.
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not clobber characters typed during the debounce window', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(({ url }) => useSearchInput(url, commit), {
      initialProps: { url: '' },
    });

    act(() => result.current.setValue('kha'));
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(commit).toHaveBeenCalledWith('kha');

    // The URL now catches up with what we pushed; the box must keep its text.
    rerender({ url: 'kha' });
    expect(result.current.value).toBe('kha');
  });

  it('initialises from a deep-linked URL', () => {
    const { result } = renderHook(() => useSearchInput('deeplinked', vi.fn()));

    expect(result.current.value).toBe('deeplinked');
    expect(result.current.isPending).toBe(false);
  });
});
