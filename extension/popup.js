// Popup script for ImpulseGuard — with backend sync + dashboard link

console.log("🛡️ ImpulseGuard: Popup loaded");

const API_BASE = 'http://localhost:3000';

// ─── Get or generate a persistent userId ────────────────────────────
async function getUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userId'], (result) => {
      if (result.userId) {
        resolve(result.userId);
      } else {
        // Generate a new unique ID
        const newId = 'ig_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        chrome.storage.local.set({ userId: newId }, () => {
          console.log(`🛡️ Generated new userId: ${newId}`);
          resolve(newId);
        });
      }
    });
  });
}

// ─── Sync data to backend ───────────────────────────────────────────
async function syncToBackend() {
  const syncStatus = document.getElementById('syncStatus');
  
  try {
    const userId = await getUserId();

    const result = await new Promise((resolve) => {
      chrome.storage.local.get([
        'hourlyWage',
        'totalMoneySpent',
        'totalHoursSpent',
        'totalMoneySavedByCancelling',
        'totalHoursSavedByCancelling',
        'decisionHistory',
        'lastUpdated'
      ], resolve);
    });

    const payload = {
      userId,
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
        'X-User-Id': userId
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('🛡️ Data synced to backend successfully');
      if (syncStatus) {
        syncStatus.textContent = '✅ Synced to dashboard';
        syncStatus.className = 'sync-status synced';
      }
      return true;
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    console.warn('🛡️ Backend sync failed (server may be offline):', error.message);
    if (syncStatus) {
      syncStatus.textContent = '⚠️ Server offline — data saved locally';
      syncStatus.className = 'sync-status error';
    }
    return false;
  }
}

// ─── Load and display stats ─────────────────────────────────────────
async function loadAllStats() {
  console.log("🛡️ Loading stats...");
  
  const result = await chrome.storage.local.get([
    'hourlyWage',
    'totalMoneySpent',
    'totalHoursSpent',
    'totalMoneySavedByCancelling',
    'totalHoursSavedByCancelling'
  ]);
  
  console.log("🛡️ Stats loaded:", result);
  
  const wageInput = document.getElementById('hourlyWage');
  if (wageInput) {
    wageInput.value = result.hourlyWage || 500;
  }
  
  const moneySaved = result.totalMoneySavedByCancelling || 0;
  const hoursSaved = result.totalHoursSavedByCancelling || 0;
  const moneySpent = result.totalMoneySpent || 0;
  const hoursSpent = result.totalHoursSpent || 0;
  const totalSavings = moneySaved;
  
  const moneySavedElement = document.getElementById('moneySavedByCancelling');
  const hoursSavedElement = document.getElementById('hoursSavedByCancelling');
  const moneySpentElement = document.getElementById('moneySpent');
  const hoursSpentElement = document.getElementById('hoursSpent');
  const totalSavingsElement = document.getElementById('totalSavings');
  
  if (moneySavedElement) moneySavedElement.textContent = `₹${moneySaved.toLocaleString('en-IN')}`;
  if (hoursSavedElement) hoursSavedElement.textContent = hoursSaved.toFixed(1);
  if (moneySpentElement) moneySpentElement.textContent = `₹${moneySpent.toLocaleString('en-IN')}`;
  if (hoursSpentElement) hoursSpentElement.textContent = hoursSpent.toFixed(1);
  if (totalSavingsElement) totalSavingsElement.textContent = `₹${totalSavings.toLocaleString('en-IN')}`;
  
  console.log(`🛡️ Display: Saved ₹${moneySaved}, Spent ₹${moneySpent}`);
}

// ─── Save confirmation message ──────────────────────────────────────
function showSaveMessage(message, isError = false) {
  const messageDiv = document.getElementById('saveMessage');
  if (!messageDiv) return;
  
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';
  messageDiv.style.background = isError ? '#EF4444' : '#10B981';
  messageDiv.style.color = 'white';
  messageDiv.style.padding = '8px';
  messageDiv.style.borderRadius = '8px';
  messageDiv.style.marginTop = '10px';
  messageDiv.style.textAlign = 'center';
  messageDiv.style.fontSize = '12px';
  
  setTimeout(() => {
    messageDiv.style.opacity = '0';
    setTimeout(() => {
      messageDiv.style.display = 'none';
      messageDiv.style.opacity = '1';
    }, 2000);
  }, 2000);
}

// ─── Save hourly wage ───────────────────────────────────────────────
async function saveHourlyWage() {
  const wageInput = document.getElementById('hourlyWage');
  if (!wageInput) return;
  
  let wage = parseFloat(wageInput.value);
  
  if (isNaN(wage) || wage <= 0) {
    showSaveMessage('❌ Please enter a valid hourly wage', true);
    return;
  }
  
  wage = Math.round(wage * 100) / 100;
  
  try {
    await chrome.storage.local.set({ hourlyWage: wage });
    console.log(`🛡️ Hourly wage saved: ₹${wage}`);
    showSaveMessage(`✅ Hourly wage saved: ₹${wage}/hour`);
    
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✅ Saved!';
    saveBtn.style.transform = 'scale(0.98)';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.transform = '';
    }, 1500);
    
    // Sync to backend after saving
    syncToBackend();
    
  } catch (error) {
    console.error("Error saving wage:", error);
    showSaveMessage('❌ Error saving wage', true);
  }
}

// ─── Reset stats ────────────────────────────────────────────────────
async function resetStats() {
  const confirmed = confirm(
    '⚠️ WARNING: This will reset ALL your statistics!\n\n' +
    'This includes:\n' +
    '• Money saved by canceling purchases\n' +
    '• Hours saved\n' +
    '• Money spent on purchases\n' +
    '• Hours spent\n' +
    '• All decision history\n\n' +
    'This action cannot be undone. Are you sure?'
  );
  
  if (!confirmed) return;
  
  try {
    await chrome.storage.local.set({
      totalMoneySpent: 0,
      totalHoursSpent: 0,
      totalMoneySavedByCancelling: 0,
      totalHoursSavedByCancelling: 0,
      decisionHistory: [],
      lastUpdated: Date.now()
    });
    
    console.log("🛡️ All stats reset");
    await loadAllStats();
    showSaveMessage('🗑️ All statistics have been reset');
    
    // Sync the reset to backend
    syncToBackend();
    
  } catch (error) {
    console.error("Error resetting stats:", error);
    showSaveMessage('❌ Error resetting stats', true);
  }
}

// ─── Refresh stats ──────────────────────────────────────────────────
async function refreshStats() {
  await loadAllStats();
  showSaveMessage('🔄 Statistics refreshed');
  
  const refreshBtn = document.getElementById('refreshStatsBtn');
  const originalText = refreshBtn.textContent;
  refreshBtn.textContent = '✓ Refreshed!';
  setTimeout(() => {
    refreshBtn.textContent = originalText;
  }, 1000);
}

// ─── Listen for storage changes ─────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    console.log("🛡️ Storage changed:", changes);
    loadAllStats();
    // Auto-sync to backend when data changes
    syncToBackend();
  }
});

// ─── Initialize ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🛡️ Initializing popup...");
  
  await loadAllStats();
  
  // Set up event listeners
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetStatsBtn');
  const refreshBtn = document.getElementById('refreshStatsBtn');
  const wageInput = document.getElementById('hourlyWage');
  const dashboardBtn = document.getElementById('openDashboardBtn');
  
  // ── Dashboard Button — opens web dashboard with userId ──
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', async () => {
      const userId = await getUserId();
      // First sync latest data to backend
      await syncToBackend();
      // Then open dashboard in new tab
      const dashboardURL = `${API_BASE}?userId=${encodeURIComponent(userId)}`;
      chrome.tabs.create({ url: dashboardURL });
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', saveHourlyWage);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetStats);
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshStats);
  }
  
  if (wageInput) {
    wageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveHourlyWage();
      }
    });
  }
  
  // Initial sync to backend
  syncToBackend();
  
  console.log("🛡️ Popup ready!");
});

// ─── Listen for messages from content script ────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'statsUpdated') {
    console.log("🛡️ Stats updated message received");
    loadAllStats();
    syncToBackend();
  }
});