import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
}

interface NotificationState {
  notifications: Notification[];

  addNotification: (type: NotificationType, message: string) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 5;
const AUTO_DISMISS_MS = 5000;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (type: NotificationType, message: string) => {
    const id = nanoid(8);
    const notification: Notification = {
      id,
      type,
      message,
      timestamp: Date.now(),
    };

    set((s) => ({
      notifications: [...s.notifications, notification].slice(-MAX_NOTIFICATIONS),
    }));

    // Auto-dismiss after timeout
    setTimeout(() => {
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      }));
    }, AUTO_DISMISS_MS);

    return id;
  },

  removeNotification: (id: string) => {
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => set({ notifications: [] }),
}));

// Convenience functions for use outside React components
export const notify = {
  info: (message: string) =>
    useNotificationStore.getState().addNotification('info', message),
  success: (message: string) =>
    useNotificationStore.getState().addNotification('success', message),
  error: (message: string) =>
    useNotificationStore.getState().addNotification('error', message),
  warning: (message: string) =>
    useNotificationStore.getState().addNotification('warning', message),
};
