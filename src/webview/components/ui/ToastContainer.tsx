import { useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useNotificationStore,
  type NotificationType,
} from '../../stores/notification-store';

const iconMap: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const styleMap: Record<NotificationType, string> = {
  info: 'border-primary/40 bg-primary/10 text-primary',
  success: 'border-green-500/40 bg-green-500/10 text-green-400',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
};

/**
 * Toast notification container. Renders in the bottom-right corner.
 * Should be placed once at the app root level.
 */
export function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const removeNotification = useNotificationStore((s) => s.removeNotification);

  const handleDismiss = useCallback(
    (id: string) => {
      removeNotification(id);
    },
    [removeNotification]
  );

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => {
        const Icon = iconMap[notification.type];
        return (
          <div
            key={notification.id}
            className={cn(
              'flex items-start gap-2 px-3 py-2.5 rounded-md border shadow-lg backdrop-blur-sm',
              'animate-in slide-in-from-right-5 fade-in duration-200',
              styleMap[notification.type]
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="flex-1 text-xs leading-relaxed">{notification.message}</p>
            <button
              className="p-0.5 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={() => handleDismiss(notification.id)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
