import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s: string) => createHash('sha256').update(s).digest();

// Hashing first gives equal-length buffers, so the comparison takes the same
// time whatever the inputs and never leaks the secret's length.
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}
