const NOTIFICATIONS_KEY = 'agent-office-notifications';

let notificationsEnabled = false;
let permissionGranted = false;

export function initNotifications(): void {
  // Load saved preference
  try {
    notificationsEnabled = localStorage.getItem(NOTIFICATIONS_KEY) === 'true';
  } catch {
    notificationsEnabled = false;
  }

  // Check current permission
  if ('Notification' in window) {
    permissionGranted = Notification.permission === 'granted';
  }
}

export function isNotificationsEnabled(): boolean {
  return notificationsEnabled && permissionGranted;
}

export function getNotificationsToggle(): boolean {
  return notificationsEnabled;
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  notificationsEnabled = enabled;
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  } catch { /* ignore */ }

  if (enabled && !permissionGranted && 'Notification' in window) {
    const result = await Notification.requestPermission();
    permissionGranted = result === 'granted';
  }
}

export function sendBrowserNotification(
  title: string,
  body: string,
  agentId?: number,
  onClick?: (agentId: number) => void,
): void {
  if (!notificationsEnabled || !permissionGranted) return;
  if (!('Notification' in window)) return;

  // Don't send if tab is focused
  if (document.hasFocus()) return;

  try {
    const notification = new Notification(title, {
      body,
      tag: agentId !== undefined ? `agent-${agentId}` : undefined,
    });

    notification.onclick = () => {
      window.focus();
      if (agentId !== undefined && onClick) {
        onClick(agentId);
      }
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } catch {
    // Notifications may not be available
  }
}

// Initialize on import
initNotifications();
