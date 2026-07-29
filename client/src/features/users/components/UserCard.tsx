/**
 * One user card.
 *
 * Layout:
 *
 *   +--------------------------------------+
 *   | Avatar    John Smith                 |
 *   |           UAE            Age: 34     |
 *   |                                      |
 *   |           Reading Swimming +2        |
 *   +--------------------------------------+
 *
 * **Memoised**, and that matters here more than anywhere else in the app: the
 * virtualizer re-renders its parent on every scroll frame, so without
 * `React.memo` every visible card would re-render ~60 times a second while
 * scrolling. The `user` objects come from the React Query cache and keep stable
 * identities between renders, so the default shallow comparison is enough.
 */

import { memo } from 'react';
import type { UserDto } from '@presight/shared';

import { MAX_VISIBLE_HOBBIES } from '../model/list-config';
import { UserAvatar } from './UserAvatar';

export interface UserCardProps {
  user: UserDto;
}

function UserCardComponent({ user }: UserCardProps) {
  // Show at most two hobbies; the rest collapse into a `+N` badge.
  const visibleHobbies = user.hobbies.slice(0, MAX_VISIBLE_HOBBIES);
  const overflowCount = user.hobbies.length - visibleHobbies.length;

  return (
    <article className="border-subtle bg-surface hover:border-primary/30 rounded-xl border p-4 transition-[border-color,box-shadow] duration-150 hover:shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex gap-4">
        <UserAvatar src={user.avatar} firstName={user.first_name} lastName={user.last_name} />

        <div className="min-w-0 flex-1">
          {/* Name on its own line, then nationality (left) paired with age
              (right), then the hobby row. */}
          <h3 className="text-ink truncate text-[15px] leading-tight font-semibold">
            {user.first_name} {user.last_name}
          </h3>

          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-muted min-w-0 truncate text-sm">{user.nationality}</p>
            <p className="text-muted shrink-0 text-sm tabular-nums">
              {/* "Age: 34" is visual shorthand; spelled out for screen readers. */}
              <span aria-hidden="true">Age: {user.age}</span>
              <span className="sr-only">{user.age} years old</span>
            </p>
          </div>

          {user.hobbies.length > 0 && (
            // The gap above is deliberately large: it separates identity from
            // attributes rather than running them together.
            <ul className="mt-3.5 flex flex-wrap items-center gap-2">
              {visibleHobbies.map((hobby) => (
                <li
                  key={hobby}
                  className="border-subtle bg-canvas text-muted rounded-md border px-2 py-0.5 text-xs font-medium"
                >
                  {hobby}
                </li>
              ))}

              {overflowCount > 0 && (
                <li className="text-muted text-xs font-medium">
                  <span aria-hidden="true">+{overflowCount}</span>
                  {/* "+3" alone is meaningless read aloud, and the hidden names
                      keep the full list reachable without showing every chip. */}
                  <span className="sr-only">
                    and {overflowCount} more: {user.hobbies.slice(MAX_VISIBLE_HOBBIES).join(', ')}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

export const UserCard = memo(UserCardComponent);
