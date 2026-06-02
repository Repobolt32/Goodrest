const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  showBellWindow: (orderData) => ipcRenderer.send('show-bell-window', orderData),
  hideBellWindow: () => ipcRenderer.send('hide-bell-window'),
  updateTrayBadge: (count) => ipcRenderer.send('update-tray-badge', count),
  playNotificationSound: () => ipcRenderer.send('play-notification-sound'),
  acceptOrder: (orderData) => ipcRenderer.send('accept-order', orderData),
  onNewOrder: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('new-order', handler);
    return () => ipcRenderer.removeListener('new-order', handler);
  },
  onAcceptOrderFromBell: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('accept-order-from-bell', handler);
    return () => ipcRenderer.removeListener('accept-order-from-bell', handler);
  },
  onStopRinging: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('stop-ringing-bell', handler);
    return () => ipcRenderer.removeListener('stop-ringing-bell', handler);
  },
});


