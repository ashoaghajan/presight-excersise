/**
 * Avatar with an initials fallback.
 *
 * The seeded avatars are DiceBear URLs, so they do not render offline, behind a
 * strict CSP, or if the service is slow — and a broken-image icon in every card
 * would look like the app is broken. Falling back to initials keeps the card
 * complete either way.
 *
 * `loading="lazy"` and explicit dimensions matter here more than usual: the
 * virtualized list mounts and unmounts images constantly while scrolling, and
 * without a reserved box each swap would shift the card's layout.
 */

import { memo, useState } from 'react';

export interface UserAvatarProps {
  src: string;
  firstName: string;
  lastName: string;
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function UserAvatarComponent({ src, firstName, lastName }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  // The name is already rendered beside the avatar, so the image adds nothing
  // for a screen reader — an empty alt marks it decorative rather than
  // announcing the name twice.
  if (failed || src === '') {
    return (
      <div
        aria-hidden="true"
        className="bg-canvas text-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      >
        {initialsOf(firstName, lastName)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="bg-canvas h-12 w-12 shrink-0 rounded-full object-cover"
    />
  );
}

export const UserAvatar = memo(UserAvatarComponent);
