// ImpulseGuard Background Service Worker — with backend sync
console.log("🛡️ ImpulseGuard: Background loaded - Tracking savings + syncing to dashboard");

const API_BASE = 'http://localhost:3000';

// ─── Sync data to backend ───────────────────────────────────────────
async function syncToBackend() {
  try {
    const result = await chrome.storage.local.get([
      'userId',
      'hourlyWage',
      'totalMoneySpent',
      'totalHoursSpent',
      'totalMoneySavedByCancelling',
      'totalHoursSavedByCancelling',
      'decisionHistory',
      'lastUpdated'
    ]);

    if (!result.userId) {
      console.log('🛡️ No userId yet — skipping sync');
      return;
    }

    const payload = {
      userId: result.userId,
      hourlyWage: result.hourlyWage || 500,
      totalMoneySpent: result.totalMoneySpent || 0,
      totalHoursSpent: result.totalHoursSpent || 0,
      totalMoneySavedByCancelling: result.totalMoneySavedByCancelling || 0,
      totalHoursSavedByCancelling: result.totalHoursSavedByCancelling || 0,
      decisionHistory: result.decisionHistory || [],
      lastUpdated: result.lastUpdated || Date.now()
    };

    const response = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': result.userId
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('🛡️ Background sync successful');
    } else {
      console.warn('🛡️ Background sync failed:', response.status);
    }
  } catch (error) {
    // Server might be offline — that's okay, data is still in chrome.storage
    console.log('🛡️ Background sync skipped (server offline)');
  }
}

// ─── On Install ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log("🛡️ ImpulseGuard: Extension installed - Track what you save by canceling!");
  
  chrome.storage.local.get([
    'userId',
    'hourlyWage', 
    'totalMoneySpent', 
    'totalHoursSpent',
    'totalMoneySavedByCancelling',
    'totalHoursSavedByCancelling',
    'decisionHistory'
  ], (result) => {
    
    // Generate userId if not exists
    if (!result.userId) {
      const newId = 'ig_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      chrome.storage.local.set({ userId: newId });
      console.log(`🛡️ Generated userId: ${newId}`);
    }
    
    if (!result.hourlyWage) {
      chrome.storage.local.set({ hourlyWage: 500 });
    }
    if (result.totalMoneySpent === undefined) {
      chrome.storage.local.set({ totalMoneySpent: 0 });
    }
    if (result.totalHoursSpent === undefined) {
      chrome.storage.local.set({ totalHoursSpent: 0 });
    }
    if (result.totalMoneySavedByCancelling === undefined) {
      chrome.storage.local.set({ totalMoneySavedByCancelling: 0 });
    }
    if (result.totalHoursSavedByCancelling === undefined) {
      chrome.storage.local.set({ totalHoursSavedByCancelling: 0 });
    }
    if (!result.decisionHistory) {
      chrome.storage.local.set({ decisionHistory: [] });
    }
    
    console.log("🛡️ ImpulseGuard: Storage initialized");
  });
});

// ─── Auto-sync on storage changes ───────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    // Debounce: wait 2 seconds after last change before syncing
    if (globalThis._syncTimeout) clearTimeout(globalThis._syncTimeout);
    globalThis._syncTimeout = setTimeout(() => {
      syncToBackend();
    }, 2000);
  }
});

// ─── Listen for messages from popup / content script ────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getStats') {
    chrome.storage.local.get([
      'totalMoneySpent', 
      'totalHoursSpent',
      'totalMoneySavedByCancelling',
      'totalHoursSavedByCancelling'
    ], sendResponse);
    return true;
  }
  
  if (request.type === 'resetStats') {
    chrome.storage.local.set({
      totalMoneySpent: 0,
      totalHoursSpent: 0,
      totalMoneySavedByCancelling: 0,
      totalHoursSavedByCancelling: 0,
      decisionHistory: [],
      lastUpdated: Date.now()
    }, () => {
      sendResponse({ success: true });
      syncToBackend();
    });
    return true;
  }

  if (request.type === 'syncNow') {
    syncToBackend().then(() => {
      sendResponse({ success: true });
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true;
  }
});

// ─── Periodic sync every 5 minutes ─────────────────────────────────
// Use alarms for periodic sync (service workers can't use setInterval)
chrome.alarms.create('periodicSync', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodicSync') {
    syncToBackend();
  }
});