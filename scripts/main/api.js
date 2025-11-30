// Content script - Runs on voting pages

(async function() {
  'use strict';
  
  console.log('[Auto-Vote] Content script loaded on:', window.location.href);
  
  // Wait for page to fully load
  await waitForPageLoad();
  
  // Check if auto-vote is enabled
  const settings = await getSettings();
  if (!settings.autoVoteOnVisit) {
    console.log('[Auto-Vote] Auto-vote on visit is disabled');
    return;
  }
  
  // Get current project for this URL
  const currentProject = await getCurrentProject();
  if (!currentProject) {
    console.log('[Auto-Vote] No matching project found for this URL');
    return;
  }
  
  if (!currentProject.enabled) {
    console.log('[Auto-Vote] Project is disabled');
    return;
  }
  
  // Check if we can vote (cooldown)
  if (!canVote(currentProject)) {
    console.log('[Auto-Vote] Still in cooldown period');
    return;
  }
  
  // Add random delay before attempting vote (looks more human)
  const randomDelay = 2000 + Math.random() * 3000; // 2-5 seconds
  console.log('[Auto-Vote] Waiting', Math.round(randomDelay/1000), 'seconds before voting...');
  await delay(randomDelay);
  
  // Detect site and execute voting
  const hostname = window.location.hostname;
  console.log('[Auto-Vote] Attempting to vote on:', hostname);
  
  try {
    await executeSiteVote(hostname, currentProject);
  } catch (error) {
    console.error('[Auto-Vote] Error:', error);
  }
})();

function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (data) => {
      resolve(data.settings || {
        notificationsEnabled: true,
        autoVoteOnVisit: true,
        captchaWarnings: true
      });
    });
  });
}

async function getCurrentProject() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || [];
      const currentUrl = window.location.href;
      
      console.log('[Auto-Vote] Checking URL:', currentUrl);
      console.log('[Auto-Vote] Against projects:', projects.length);
      
      // Find project matching current URL
      const project = projects.find(p => {
        try {
          // More flexible URL matching
          const projectUrl = new URL(p.url);
          const currentUrlObj = new URL(currentUrl);
          
          // Check if hostnames match
          if (projectUrl.hostname !== currentUrlObj.hostname) {
            return false;
          }
          
          // Extract server ID from path
          const projectPath = projectUrl.pathname;
          const currentPath = currentUrlObj.pathname;
          
          // Check if current path contains the project path
          const match = currentPath.includes(projectPath) || 
                       projectPath.includes(currentPath.split('?')[0]);
          
          console.log('[Auto-Vote] Comparing:', projectPath, 'with', currentPath, '=', match);
          return match;
        } catch (e) {
          console.error('[Auto-Vote] URL comparison error:', e);
          return false;
        }
      });
      
      if (project) {
        console.log('[Auto-Vote] Matched project:', project.name);
      }
      
      resolve(project);
    });
  });
}

function canVote(project) {
  if (!project.lastVote) return true;
  const now = Date.now();
  const nextVoteTime = project.lastVote + project.interval;
  return now >= nextVoteTime;
}

async function executeSiteVote(hostname, project) {
  const settings = await getSettings();
  
  // Detect captcha
  if (detectCaptcha()) {
    if (settings.captchaWarnings) {
      showNotification('⚠️ Captcha detected! Please solve it manually.', 'warning');
    }
    console.log('[Auto-Vote] Captcha detected, stopping');
    return;
  }
  
  // Site-specific voting logic
  if (hostname.includes('minecraft-mp.com')) {
    await voteMinecraftMp(project);
  } else if (hostname.includes('minecraftservers.org')) {
    await voteMinecraftServersOrg(project);
  } else if (hostname.includes('minecraft-server-list.com')) {
    await voteMinecraftServerList(project);
  } else if (hostname.includes('minecraft-server.net')) {
    await voteMinecraftServerNet(project);
  } else {
    console.log('[Auto-Vote] Unknown site, trying generic vote');
    await voteGeneric(project);
  }
}

function detectCaptcha() {
  // Check for common captcha elements
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    '.h-captcha',
    '#captcha',
    '[class*="captcha"]',
    '[id*="captcha"]'
  ];
  
  const hasCaptcha = captchaSelectors.some(selector => document.querySelector(selector));
  if (hasCaptcha) {
    console.log('[Auto-Vote] Captcha detected on page');
  }
  return hasCaptcha;
}

// Site-specific voting functions

async function voteMinecraftMp(project) {
  console.log('[Auto-Vote] Executing minecraft-mp.com vote');
  
  // Wait for vote button with longer timeout
  const voteButton = await waitForElement(
    'button[type="submit"], input[type="submit"], .vote-button, button.btn-primary, a[href*="vote"]',
    10000
  );
  
  if (voteButton) {
    console.log('[Auto-Vote] Found vote button:', voteButton.tagName, voteButton.className);
    await delay(1000);
    
    // Scroll into view first
    voteButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(500);
    
    // Try clicking
    voteButton.click();
    console.log('[Auto-Vote] Clicked vote button');
    
    await updateProjectVote(project);
    showNotification('✓ Vote submitted successfully!', 'success');
  } else {
    console.log('[Auto-Vote] Vote button not found');
    showNotification('⚠️ Could not find vote button', 'warning');
  }
}

async function voteMinecraftServersOrg(project) {
  console.log('[Auto-Vote] Executing minecraftservers.org vote');
  
  const voteButton = await waitForElement(
    'button[type="submit"], input[type="submit"], .vote-button, button.btn, a.btn',
    10000
  );
  
  if (voteButton) {
    console.log('[Auto-Vote] Found vote button');
    voteButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted!', 'success');
  } else {
    console.log('[Auto-Vote] Vote button not found');
    showNotification('⚠️ Could not find vote button', 'warning');
  }
}

async function voteMinecraftServerList(project) {
  console.log('[Auto-Vote] Executing minecraft-server-list.com vote');
  
  const voteButton = await waitForElement(
    'button[type="submit"], input[type="submit"], .vote-btn, button.btn, a.vote',
    10000
  );
  
  if (voteButton) {
    console.log('[Auto-Vote] Found vote button');
    voteButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted!', 'success');
  } else {
    console.log('[Auto-Vote] Vote button not found');
    showNotification('⚠️ Could not find vote button', 'warning');
  }
}

async function voteMinecraftServerNet(project) {
  console.log('[Auto-Vote] Executing minecraft-server.net vote');
  
  const voteButton = await waitForElement(
    'button[type="submit"], input[type="submit"], .btn-vote, button.btn, a[href*="vote"]',
    10000
  );
  
  if (voteButton) {
    console.log('[Auto-Vote] Found vote button');
    voteButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted!', 'success');
  } else {
    console.log('[Auto-Vote] Vote button not found');
    showNotification('⚠️ Could not find vote button', 'warning');
  }
}

async function voteGeneric(project) {
  console.log('[Auto-Vote] Executing generic vote');
  
  // Look for common button patterns
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button.vote',
    'button.btn-vote',
    'a.vote-button',
    'button.btn-primary',
    'a[href*="vote"]'
  ];
  
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) {
      console.log('[Auto-Vote] Found vote button:', selector);
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(1000);
      button.click();
      await updateProjectVote(project);
      showNotification('✓ Vote attempted!', 'success');
      return;
    }
  }
  
  console.log('[Auto-Vote] No vote button found');
  showNotification('⚠️ Could not find vote button', 'warning');
}

// Helper functions

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      console.log('[Auto-Vote] Element found immediately:', selector);
      resolve(element);
      return;
    }
    
    console.log('[Auto-Vote] Waiting for element:', selector);
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        console.log('[Auto-Vote] Element found after mutation:', selector);
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      console.log('[Auto-Vote] Timeout waiting for:', selector);
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateProjectVote(project) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['projects', 'stats'], async (data) => {
      const projects = data.projects || [];
      const stats = data.stats || { totalVotes: 0, todayVotes: 0, weekVotes: 0 };
      
      // Update project
      const projectIndex = projects.findIndex(p => p.id === project.id);
      if (projectIndex !== -1) {
        projects[projectIndex].lastVote = Date.now();
        projects[projectIndex].voteCount = (projects[projectIndex].voteCount || 0) + 1;
      }
      
      // Update stats
      stats.totalVotes = (stats.totalVotes || 0) + 1;
      stats.todayVotes = (stats.todayVotes || 0) + 1;
      stats.weekVotes = (stats.weekVotes || 0) + 1;
      
      await chrome.storage.local.set({ projects, stats });
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'voteCompleted',
        project: project.name
      });
      
      resolve();
    });
  });
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#667eea'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
