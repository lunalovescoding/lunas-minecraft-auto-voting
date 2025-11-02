// Background service worker

console.log('[Auto-Vote] Background script initialized');

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Auto-Vote] Extension installed');
  
  // Set default settings
  const data = await chrome.storage.local.get(['settings', 'stats']);
  
  if (!data.settings) {
    await chrome.storage.local.set({
      settings: {
        notificationsEnabled: true,
        autoVoteOnVisit: true,
        captchaWarnings: true
      }
    });
  }
  
  if (!data.stats) {
    await chrome.storage.local.set({
      stats: {
        totalVotes: 0,
        todayVotes: 0,
        weekVotes: 0,
        lastResetDate: new Date().toDateString()
      }
    });
  }
  
  // Set up daily reset alarm
  chrome.alarms.create('dailyReset', { periodInMinutes: 1440 }); // 24 hours
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    await resetDailyStats();
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'voteCompleted') {
    handleVoteCompleted(request.project);
    sendResponse({ success: true });
  } else if (request.action === 'voteAll') {
    voteAllProjects().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  return false;
});

// Reset daily stats
async function resetDailyStats() {
  const data = await chrome.storage.local.get(['stats']);
  const stats = data.stats || {};
  
  const today = new Date().toDateString();
  if (stats.lastResetDate !== today) {
    stats.todayVotes = 0;
    stats.lastResetDate = today;
    await chrome.storage.local.set({ stats });
    console.log('[Auto-Vote] Daily stats reset');
  }
}

// Handle vote completion
async function handleVoteCompleted(projectName) {
  const data = await chrome.storage.local.get(['settings']);
  const settings = data.settings || {};
  
  if (settings.notificationsEnabled) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icons/icon128.png',
      title: 'Vote Submitted!',
      message: `Successfully voted for ${projectName}`,
      priority: 1
    });
  }
  
  console.log('[Auto-Vote] Vote completed for:', projectName);
}

// Vote for all active projects
async function voteAllProjects() {
  const data = await chrome.storage.local.get(['projects']);
  const projects = data.projects || [];
  
  const activeProjects = projects.filter(p => {
    if (!p.enabled) return false;
    if (!p.lastVote) return true;
    const now = Date.now();
    const nextVoteTime = p.lastVote + p.interval;
    return now >= nextVoteTime;
  });
  
  console.log('[Auto-Vote] Voting for', activeProjects.length, 'projects');
  
  for (const project of activeProjects) {
    try {
      // Open voting page in new tab
      const tab = await chrome.tabs.create({
        url: project.url,
        active: false
      });
      
      // Close tab after 10 seconds
      setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
      }, 10000);
      
      // Delay between opening tabs
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('[Auto-Vote] Error voting for project:', project.name, error);
    }
  }
}

// Context menu for quick voting
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'vote-now',
    title: 'Vote Now',
    contexts: ['action']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'vote-now') {
    voteAllProjects();
  }
});
