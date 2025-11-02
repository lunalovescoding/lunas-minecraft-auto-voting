// Content script - Runs on voting pages

(async function() {
  'use strict';
  
  console.log('[Auto-Vote] Content script loaded');
  
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
  
  // Detect site and execute voting
  const hostname = window.location.hostname;
  console.log('[Auto-Vote] Attempting to vote on:', hostname);
  
  try {
    await executeSiteVote(hostname, currentProject);
  } catch (error) {
    console.error('[Auto-Vote] Error:', error);
  }
})();

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
      
      // Find project matching current URL
      const project = projects.find(p => {
        try {
          const projectUrl = new URL(p.url);
          const currentUrlObj = new URL(currentUrl);
          return projectUrl.hostname === currentUrlObj.hostname &&
                 currentUrlObj.pathname.includes(projectUrl.pathname.split('/')[2]); // Match server ID
        } catch {
          return false;
        }
      });
      
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
    '#captcha'
  ];
  
  return captchaSelectors.some(selector => document.querySelector(selector));
}

// Site-specific voting functions

async function voteMinecraftMp(project) {
  console.log('[Auto-Vote] Executing minecraft-mp.com vote');
  
  // Wait for page to load
  await waitForElement('.vote-button, button[type="submit"], input[type="submit"]', 5000);
  
  const voteButton = document.querySelector('.vote-button') ||
                     document.querySelector('button[type="submit"]') ||
                     document.querySelector('input[type="submit"]');
  
  if (voteButton) {
    console.log('[Auto-Vote] Found vote button, clicking...');
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted successfully!', 'success');
  } else {
    console.log('[Auto-Vote] Vote button not found');
  }
}

async function voteMinecraftServersOrg(project) {
  console.log('[Auto-Vote] Executing minecraftservers.org vote');
  
  await waitForElement('button.vote-button, input[type="submit"]', 5000);
  
  const voteButton = document.querySelector('button.vote-button') ||
                     document.querySelector('input[type="submit"]');
  
  if (voteButton) {
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted!', 'success');
  }
}

async function voteMinecraftServerList(project) {
  console.log('[Auto-Vote] Executing minecraft-server-list.com vote');
  
  await waitForElement('button.vote-btn, button[type="submit"], input[type="submit"]', 5000);
  
  const voteButton = document.querySelector('button.vote-btn') ||
                     document.querySelector('button[type="submit"]') ||
                     document.querySelector('input[type="submit"]');
  
  if (voteButton) {
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted!', 'success');
  }
}

async function voteMinecraftServerNet(project) {
  console.log('[Auto-Vote] Executing minecraft-server.net vote');
  
  await waitForElement('button.btn-vote, button[type="submit"], input[type="submit"]', 5000);
  
  const voteButton = document.querySelector('button.btn-vote') ||
                     document.querySelector('button[type="submit"]') ||
                     document.querySelector('input[type="submit"]');
  
  if (voteButton) {
    await delay(1000);
    voteButton.click();
    await updateProjectVote(project);
    showNotification('✓ Vote submitted!', 'success');
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
    'a.vote-button'
  ];
  
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) { // Check if visible
      console.log('[Auto-Vote] Found vote button:', selector);
      await delay(1000);
      button.click();
      await updateProjectVote(project);
      showNotification('✓ Vote attempted!', 'success');
      return;
    }
  }
  
  console.log('[Auto-Vote] No vote button found');
}

// Helper functions

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
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
