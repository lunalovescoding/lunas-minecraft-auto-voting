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
      const nextTime = project.lastVote + (project.interval || 86400000); // Default 24 hours
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
  btn.textContent = 'Voting...';
  btn.disabled = true;
  
  try {
    await chrome.runtime.sendMessage({ action: 'voteAll' });
    btn.textContent = 'Done!';
    setTimeout(() => {
      btn.textContent = 'Vote Now';
      btn.disabled = false;
      loadStats();
    }, 1500);
  } catch (error) {
    btn.textContent = 'Error';
    setTimeout(() => {
      btn.textContent = 'Vote Now';
      btn.disabled = false;
    }, 1500);
  }
});
