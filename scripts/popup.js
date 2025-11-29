// Popup script for quick view and actions

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadProjects();
});

async function loadStats() {
  const data = await chrome.storage.local.get(['projects', 'stats']);
  const projects = data.projects || [];
  const stats = data.stats || { todayVotes: 0 };
  
  const activeProjects = projects.filter(p => p.enabled).length;
  document.getElementById('activeProjects').textContent = activeProjects;
  document.getElementById('todayVotes').textContent = stats.todayVotes || 0;
  
  // Calculate next vote time
  const nextVote = calculateNextVote(projects);
  document.getElementById('nextVote').textContent = nextVote;
}

async function loadProjects() {
  const data = await chrome.storage.local.get(['projects']);
  const projects = data.projects || [];
  const projectsList = document.getElementById('projectsList');
  
  if (projects.length === 0) {
    projectsList.innerHTML = `
      <div class="empty-state">
        No projects added yet.<br>Click "Manage Projects" to add one.
      </div>
    `;
    return;
  }
  
  projectsList.innerHTML = projects.map(project => `
    <div class="project-item">
      <span class="project-name">${escapeHtml(project.name)}</span>
      <div class="project-status ${project.enabled ? '' : 'inactive'}"></div>
    </div>
  `).join('');
}

function calculateNextVote(projects) {
  if (projects.length === 0) return '-';
  
  const now = Date.now();
  let nextVoteTime = Infinity;
  
  projects.forEach(project => {
    if (project.enabled && project.lastVote) {
      const nextTime = project.lastVote + (project.interval || 86400000);
      if (nextTime < nextVoteTime && nextTime > now) {
        nextVoteTime = nextTime;
      }
    }
  });
  
  if (nextVoteTime === Infinity) return 'Ready';
  
  const diff = nextVoteTime - now;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Button actions
document.getElementById('manageBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('voteNowBtn').addEventListener('click', async () => {
  const btn = document.getElementById('voteNowBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Voting...';
  btn.disabled = true;
  
  try {
    // Get all active projects that can vote
    const data = await chrome.storage.local.get(['projects']);
    const projects = data.projects || [];
    
    const activeProjects = projects.filter(p => {
      if (!p.enabled) return false;
      if (!p.lastVote) return true;
      const now = Date.now();
      const nextVoteTime = p.lastVote + p.interval;
      return now >= nextVoteTime;
    });
    
    console.log('Active projects ready to vote:', activeProjects.length);
    
    if (activeProjects.length === 0) {
      btn.textContent = 'No projects ready';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
      return;
    }
    
    // Open tabs for each project
    for (const project of activeProjects) {
      console.log('Opening tab for:', project.name, project.url);
      await chrome.tabs.create({
        url: project.url,
        active: false
      });
      
      // Wait 2 seconds between opening tabs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    btn.textContent = `Opened ${activeProjects.length} tabs!`;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      window.close(); // Close popup
    }, 2000);
    
  } catch (error) {
    console.error('Error in voteNowBtn:', error);
    btn.textContent = 'Error!';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }
});
