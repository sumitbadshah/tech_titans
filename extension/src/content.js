// ImpulseGuard - Triggers on checkout with savings tracking
console.log("🛡️ ImpulseGuard: Content script loaded - Tracking mindful savings");

let isShowingBanner = false;
let activeBanner = null;
let countdownInterval = null;

// Function to get product price
function getProductPrice() {
  // Amazon price selectors
  let priceElement = document.querySelector('.a-price-whole');
  if (priceElement) {
    return parseFloat(priceElement.innerText.replace(/[^0-9.]/g, ''));
  }
  
  // Flipkart price
  priceElement = document.querySelector('._30jeq3');
  if (priceElement) {
    return parseFloat(priceElement.innerText.replace(/[^0-9.]/g, ''));
  }
  
  // Myntra price
  priceElement = document.querySelector('.pdp-price');
  if (priceElement) {
    return parseFloat(priceElement.innerText.replace(/[^0-9.]/g, ''));
  }
  
  // Generic price selectors
  const genericSelectors = [
    '[class*="price"]',
    '[class*="Price"]',
    '[itemprop="price"]',
    '.price',
    '#price'
  ];
  
  for (const selector of genericSelectors) {
    priceElement = document.querySelector(selector);
    if (priceElement) {
      const priceText = priceElement.innerText;
      const match = priceText.match(/[\d,]+(?:\.\d{2})?/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
      }
    }
  }
  
  return null;
}

// Function to get product title
function getProductTitle() {
  let titleElement = document.querySelector('#productTitle');
  if (titleElement) return titleElement.innerText.trim();
  
  titleElement = document.querySelector('.B_NuCI');
  if (titleElement) return titleElement.innerText.trim();
  
  titleElement = document.querySelector('.pdp-title');
  if (titleElement) return titleElement.innerText.trim();
  
  titleElement = document.querySelector('h1');
  if (titleElement) return titleElement.innerText.trim();
  
  return "this item";
}

// Function to notify popup that stats have been updated
function notifyPopupStatsUpdated() {
  chrome.runtime.sendMessage({ type: 'statsUpdated' }).catch(() => {
    // Popup might not be open, that's fine
    console.log("🛡️ Stats updated (popup may not be open)");
  });
}

// Show success popup with savings amount
function showSavingsPopup(productName, price, hoursWork) {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    background: white;
    border-radius: 32px;
    padding: 0;
    z-index: 1000002;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    width: 340px;
    text-align: center;
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  
  popup.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #10B981, #059669);
      padding: 32px 20px;
      color: white;
    ">
      <div style="font-size: 64px; margin-bottom: 8px;">🎉</div>
      <div style="font-size: 24px; font-weight: 800;">You Saved!</div>
    </div>
    
    <div style="padding: 24px;">
      <div style="font-size: 14px; color: #6B7280; margin-bottom: 8px;">By canceling</div>
      <div style="font-size: 16px; font-weight: 600; color: #1F2937; margin-bottom: 16px;">${productName.substring(0, 50)}</div>
      
      <div style="
        background: #FEF3C7;
        border-radius: 20px;
        padding: 20px;
        margin: 20px 0;
      ">
        <div style="font-size: 12px; color: #92400E; margin-bottom: 8px;">💰 You prevented spending</div>
        <div style="font-size: 36px; font-weight: 800; color: #10B981;">₹${price.toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #92400E; margin-top: 8px;">and saved</div>
        <div style="font-size: 24px; font-weight: 700; color: #059669;">${hoursWork} hours</div>
        <div style="font-size: 11px; color: #92400E;">of your work time</div>
      </div>
      
      <div style="
        background: #ECFDF5;
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 20px;
      ">
        <div style="font-size: 13px; color: #065F46; font-weight: 600;">✨ Mindful Decision ✨</div>
        <div style="font-size: 12px; color: #047857; margin-top: 8px;">
          You just made a conscious choice to spend wisely
        </div>
      </div>
      
      <button id="closeSavingsPopup" style="
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #10B981, #059669);
        color: white;
        border: none;
        border-radius: 16px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      ">
        Great Decision! 🎯
      </button>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  setTimeout(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
  
  const closeBtn = popup.querySelector('#closeSavingsPopup');
  closeBtn.addEventListener('click', () => {
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => popup.remove(), 300);
  });
  
  setTimeout(() => {
    if (popup.parentNode) {
      popup.style.opacity = '0';
      popup.style.transform = 'translate(-50%, -50%) scale(0.9)';
      setTimeout(() => popup.remove(), 300);
    }
  }, 5000);
}

// Show small toast notification for savings
function showSavingsToast(price, hoursWork) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10B981, #059669);
    color: white;
    padding: 14px 20px;
    border-radius: 16px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000001;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    animation: slideInRight 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  `;
  
  toast.innerHTML = `
    <span style="font-size: 24px;">💰</span>
    <div>
      <div style="font-weight: 700;">You Saved ₹${price.toLocaleString('en-IN')}!</div>
      <div style="font-size: 11px; opacity: 0.9;">That's ${hoursWork} hours of work</div>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  toast.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
    showSavingsPopup(getProductTitle(), price, hoursWork);
  });
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Show spent popup
function showSpentPopup(productName, price, hoursWork) {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    background: white;
    border-radius: 32px;
    padding: 0;
    z-index: 1000004;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    width: 340px;
    text-align: center;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  
  popup.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #F59E0B, #D97706);
      padding: 32px 20px;
      color: white;
    ">
      <div style="font-size: 64px; margin-bottom: 8px;">🛍️</div>
      <div style="font-size: 24px; font-weight: 800;">Purchase Recorded</div>
    </div>
    
    <div style="padding: 24px;">
      <div style="font-size: 14px; color: #6B7280; margin-bottom: 8px;">You invested in</div>
      <div style="font-size: 16px; font-weight: 600; color: #1F2937; margin-bottom: 16px;">${productName.substring(0, 50)}</div>
      
      <div style="
        background: #FEF3C7;
        border-radius: 20px;
        padding: 20px;
        margin: 20px 0;
      ">
        <div style="font-size: 12px; color: #92400E; margin-bottom: 8px;">💰 You spent</div>
        <div style="font-size: 36px; font-weight: 800; color: #D97706;">₹${price.toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #92400E; margin-top: 8px;">costing you</div>
        <div style="font-size: 24px; font-weight: 700; color: #B45309;">${hoursWork} hours</div>
        <div style="font-size: 11px; color: #92400E;">of your work time</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  setTimeout(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
  
  setTimeout(() => {
    if (popup.parentNode) {
      popup.style.opacity = '0';
      popup.style.transform = 'translate(-50%, -50%) scale(0.9)';
      setTimeout(() => popup.remove(), 300);
    }
  }, 3500);
}

// Show small toast notification for spending
function showSpentToast(price, hoursWork) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #F59E0B, #D97706);
    color: white;
    padding: 14px 20px;
    border-radius: 16px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000003;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    animation: slideInRight 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  toast.innerHTML = `
    <span style="font-size: 24px;">🛍️</span>
    <div>
      <div style="font-weight: 700;">Proceeding: ₹${price.toLocaleString('en-IN')}</div>
      <div style="font-size: 11px; opacity: 0.9;">(${hoursWork} hours of work)</div>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 3500);
}

// Monitor all buttons on the page
function setupButtonMonitoring() {
  console.log("🛡️ ImpulseGuard: Setting up checkout button monitoring...");
  
  function checkAndMonitorButtons() {
    const allButtons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
    
    allButtons.forEach(button => {
      const buttonText = button.innerText || button.value || '';
      const buttonClass = button.className || '';
      const buttonId = button.id || '';
      const combinedText = (buttonText + buttonClass + buttonId).toLowerCase();
      
      // DO NOT intercept our own banner buttons!
      if (button.closest && button.closest('#impulseguard-overlay')) {
        return;
      }

      const isCheckoutButton = 
        combinedText.includes('buy') ||
        combinedText.includes('checkout') ||
        combinedText.includes('cart') ||
        combinedText.includes('add to') ||
        combinedText.includes('place order') ||
        combinedText.includes('proceed') ||
        button.id === 'buy-now-button' ||
        button.id === 'add-to-cart-button' ||
        button.className.includes('buy-now') ||
        button.className.includes('add-to-cart');
      
      if (isCheckoutButton && !button.hasAttribute('data-impulseguard-listener')) {
        button.setAttribute('data-impulseguard-listener', 'true');
        
        const originalOnClick = button.onclick;
        
        button.addEventListener('click', (e) => {
          if (button.getAttribute('data-impulseguard-bypass') === 'true') {
            // Let the click pass through natively
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation(); // Crucial on SPAs to stop all other handlers
          
          console.log("🛡️ ImpulseGuard: Checkout button clicked!");
          
          const price = getProductPrice();
          const productName = getProductTitle();
          
          if (price && !isShowingBanner) {
            showMindfulBanner(price, productName, button, originalOnClick);
          }
          
          return false;
        }, true);
      }
    });
  }
  
  checkAndMonitorButtons();
  
  const observer = new MutationObserver(() => {
    checkAndMonitorButtons();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function showMindfulBanner(price, productName, checkoutButton, originalOnClick) {
  isShowingBanner = true;
  
  chrome.storage.local.get(['hourlyWage'], (result) => {
    const hourlyWage = result.hourlyWage || 500;
    const hoursWork = (price / hourlyWage).toFixed(1);
    const daysWork = (hoursWork / 8).toFixed(1);
    
    const overlay = document.createElement('div');
    overlay.id = 'impulseguard-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: fadeIn 0.3s ease;
    `;
    
    const banner = document.createElement('div');
    banner.style.cssText = `
      max-width: 500px;
      width: 90%;
      background: white;
      border-radius: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    
    banner.innerHTML = `
      <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 24px 20px; color: white; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 8px;">🛡️</div>
        <div style="font-weight: 800; font-size: 20px;">Mindful Spending Check</div>
        <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Take a moment to reflect</div>
      </div>
      
      <div style="padding: 24px;">
        <div style="background: #FEF3C7; border-radius: 20px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #92400E; margin-bottom: 8px;">⏰ True Cost</div>
          <div style="font-size: 13px; color: #78350F; margin-bottom: 12px;">${productName.substring(0, 50)}</div>
          <div style="font-size: 48px; font-weight: 800; color: #10B981; margin: 12px 0;">${hoursWork} hours</div>
          <div style="font-size: 12px; color: #92400E;">= ${daysWork} days of work (8 hours/day)</div>
        </div>
        
        <div style="background: #F9FAFB; border-radius: 16px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6B7280;">💰 Product Price</span>
            <span style="font-weight: 700; color: #1F2937;">₹${price.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">⏱️ Your Hourly Wage</span>
            <span style="font-weight: 700; color: #1F2937;">₹${hourlyWage}/hour</span>
          </div>
        </div>
        
        <div id="timerSection" style="background: #ECFDF5; border-radius: 20px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 14px; color: #065F46; margin-bottom: 8px;">🧠 Cooling-off Period</div>
          <div style="font-size: 64px; font-weight: 800; color: #10B981;" id="timerDisplay">30</div>
          <div style="font-size: 12px; color: #065F46;">seconds to reflect</div>
          <div style="font-size: 13px; margin-top: 16px; color: #047857; min-height: 50px;" id="reflectionMsg">💭 Ask yourself: "Do I really need this?"</div>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="cancelBtn" style="flex: 1; background: #F3F4F6; color: #374151; border: none; padding: 14px; border-radius: 14px; font-weight: 600; cursor: pointer; font-size: 14px;">✨ Cancel Purchase</button>
          <button id="proceedBtn" style="flex: 1; background: #D1D5DB; color: #9CA3AF; border: none; padding: 14px; border-radius: 14px; font-weight: 600; cursor: not-allowed; font-size: 14px;" disabled>Proceed to Pay</button>
        </div>
      </div>
    `;
    
    overlay.appendChild(banner);
    document.body.appendChild(overlay);
    activeBanner = overlay;
    
    let timeLeft = 30;
    const timerDisplay = banner.querySelector('#timerDisplay');
    const proceedBtn = banner.querySelector('#proceedBtn');
    const cancelBtn = banner.querySelector('#cancelBtn');
    const reflectionMsg = banner.querySelector('#reflectionMsg');
    
    const reflectionMessages = [
      '💭 Ask yourself: "Do I really need this?"',
      '🤔 Could this money be better spent elsewhere?',
      '⏳ Will this purchase bring lasting happiness?',
      `📊 This costs you ${hoursWork} hours of work`,
      '🎯 Is this aligned with your financial goals?',
      '💚 Practice mindful spending - wait 24 hours',
      `💰 Would you work ${hoursWork} hours for this?`,
      '🌱 Future you will thank present you'
    ];
    
    let msgIndex = 0;
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      timerDisplay.textContent = timeLeft;
      
      if (timeLeft % 3 === 0 && timeLeft > 0) {
        msgIndex = (msgIndex + 1) % reflectionMessages.length;
        let msg = reflectionMessages[msgIndex];
        reflectionMsg.style.opacity = '0';
        setTimeout(() => {
          reflectionMsg.textContent = msg;
          reflectionMsg.style.opacity = '1';
        }, 150);
      }
      
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        timerDisplay.textContent = '0';
        proceedBtn.disabled = false;
        proceedBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        proceedBtn.style.color = 'white';
        proceedBtn.style.cursor = 'pointer';
        reflectionMsg.innerHTML = '✅ You can now proceed with your purchase';
        reflectionMsg.style.color = '#10B981';
      }
    }, 1000);
    
    const closeBanner = () => {
      clearInterval(countdownInterval);
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
        activeBanner = null;
        isShowingBanner = false;
      }, 300);
    };
    
    // Cancel button - RECORD SAVINGS
    cancelBtn.addEventListener('click', () => {
      closeBanner();
      
      chrome.storage.local.get(['totalMoneySavedByCancelling', 'totalHoursSavedByCancelling', 'decisionHistory'], (result) => {
        const newMoneySaved = (result.totalMoneySavedByCancelling || 0) + price;
        const newHoursSaved = (result.totalHoursSavedByCancelling || 0) + parseFloat(hoursWork);
        const history = result.decisionHistory || [];
        history.unshift({
          type: 'saved',
          price: price,
          hours: parseFloat(hoursWork),
          name: productName.substring(0, 60),
          date: Date.now()
        });
        
        chrome.storage.local.set({ 
          totalMoneySavedByCancelling: newMoneySaved,
          totalHoursSavedByCancelling: newHoursSaved,
          decisionHistory: history.slice(0, 100),
          lastUpdated: Date.now()
        }, () => {
          console.log(`🛡️ Saved ₹${price} (${hoursWork} hours) by canceling`);
          notifyPopupStatsUpdated();
          showSavingsPopup(productName, price, hoursWork);
          showSavingsToast(price, hoursWork);
        });
      });
    });
    
    // Proceed button - RECORD PURCHASE
    proceedBtn.addEventListener('click', () => {
      if (proceedBtn.disabled) return;
      
      chrome.storage.local.get(['totalMoneySpent', 'totalHoursSpent', 'decisionHistory'], (result) => {
        const newMoneySpent = (result.totalMoneySpent || 0) + price;
        const newHoursSpent = (result.totalHoursSpent || 0) + parseFloat(hoursWork);
        const history = result.decisionHistory || [];
        history.unshift({
          type: 'spent',
          price: price,
          hours: parseFloat(hoursWork),
          name: productName.substring(0, 60),
          date: Date.now()
        });
        chrome.storage.local.set({ 
          totalMoneySpent: newMoneySpent,
          totalHoursSpent: newHoursSpent,
          decisionHistory: history.slice(0, 100),
          lastUpdated: Date.now()
        }, () => {
          console.log(`🛡️ Spent ₹${price} (${hoursWork} hours) on purchase`);
          notifyPopupStatsUpdated();
          
          // Show spent popup BEFORE navigating away
          showSpentToast(price, hoursWork);
          const popupOverlay = document.createElement('div');
          popupOverlay.style.cssText = `
            position: fixed; inset: 0; z-index: 1000005; pointer-events: none;
          `;
          document.body.appendChild(popupOverlay);
          showSpentPopup(productName, price, hoursWork);
          
          closeBanner();

          // Wait just a brief moment so they see the popup before navigation happens natively
          setTimeout(() => {
            checkoutButton.setAttribute('data-impulseguard-bypass', 'true');
            checkoutButton.click();
            setTimeout(() => {
              checkoutButton.removeAttribute('data-impulseguard-bypass');
            }, 1000);
          }, 300);
        });
      });
    });
  });
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(50px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(50px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(style);

// Initialize
setupButtonMonitoring();