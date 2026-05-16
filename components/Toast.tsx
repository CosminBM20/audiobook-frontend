// Thin wrapper around sonner that preserves the existing toast(msg, type) API
// so no call sites need to change.
import { toast as sonnerToast } from 'sonner';

export function toast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  if (type === 'error') return sonnerToast.error(message);
  if (type === 'info')  return sonnerToast.info(message);
  return sonnerToast.success(message);
}
