// Options page script

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadProjects();
  loadSettings();
  loadStats();
  initEventListeners();
});

// Tab Management
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// Load Projects
async function loadProjects() {
  const data = await chrome.storage.local.get(['projects']);
  const projects = data.projects || [];
  const container = document.getElementById('projectsContainer');
  
  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No projects added yet. Click "Add Project" to get started!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = projects.map((project, index) => `
    <div class="project-card" data-index="${index}">
      <div class="project-header">
        <h3>${escapeHtml(project.name)}</h3>
        <div class="project-actions">
          <button class="btn-icon toggle-btn" data-index="${index}" title="${project.enabled ? 'Disable' : 'Enable'}">
            ${project.enabled ? '✓' : '✗'}
          </button>
          <button class="btn-icon delete-btn" data-index="${index}" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="project-details">
        <div class="detail-row">
          <span class="label">Username:</span>
          <span>${escapeHtml(project.username)}</span>
        </div>
        <div class="detail-row">
          <span class="label">URL:</span>
          <span class="url-text">${escapeHtml(project.url)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Interval:</span>
          <span>${project.interval / 3600000}h</span>
        </div>
        <div class="detail-row">
          <span class="label">Last Vote:</span>
          <span>${project.lastVote ? formatDate(project.lastVote) : 'Never'}</span>
        </div>
        <div class="detail-row">
          <span class="label">Status:</span>
          <span class="status-badge ${project.enabled ? 'active' : 'inactive'}">
            ${project.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => toggleProject(parseInt(e.target.dataset.index)));
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteProject(parseInt(e.target.dataset.index)));
  });
}

// Add Project
document.getElementById('addProjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('projectName').value.trim();
  const username = document.getElementById('username').value.trim();
  const url = document.getElementById('voteUrl').value.trim();
  const interval = parseInt(document.getElementById('voteInterval').value) * 3600000; // Convert to ms
  const enabled = document.getElementById('autoVote').checked;
  
  if (!name || !username || !url) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  const newProject = {
    id: Date.now().toString(),
    name,
    username,
    url,
    interval,
    enabled,
    lastVote: null,
    voteCount: 0
  };
  
  const data = await chrome.storage.local.get(['projects']);
  const projects = data.projects || [];
  projects.push(newProject);
  
  await chrome.storage.local.set({ projects });
  
  showNotification('Project added successfully!', 'success');
  document.getElementById('addProjectForm').reset();
  loadProjects();
  
  // Switch to projects tab
  document.querySelector('[data-tab="projects"]').click();
});

// Toggle Project
async function toggleProject(index) {
  const data = await chrome.storage.local.get(['projects']);
  const projects = data.projects || [];
  
  if (projects[index]) {
    projects[index].enabled = !projects[index].enabled;
    await chrome.storage.local.set({ projects });
    showNotification(`Project ${projects[index].enabled ? 'enabled' : 'disabled'}`, 'success');
    loadProjects();
  }
}

// Delete Project
async function deleteProject(index) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  
  const data = await chrome.storage.local.get(['projects']);
  const projects = data.projects || [];
  
  projects.splice(index, 1);
  await chrome.storage.local.set({ projects });
  
  showNotification('Project deleted', 'success');
  loadProjects();
}

// Load Settings
async function loadSettings() {
  const data = await chrome.storage.local.get(['settings']);
  const settings = data.settings || {
    notificationsEnabled: true,
    autoVoteOnVisit: true,
    captchaWarnings: true
  };
  
  document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
  document.getElementById('autoVoteOnVisit').checked = settings.autoVoteOnVisit;
  document.getElementById('captchaWarnings').checked = settings.captchaWarnings;
}

// Save Settings
async function saveSettings() {
  const settings = {
    notificationsEnabled: document.getElementById('notificationsEnabled').checked,
    autoVoteOnVisit: document.getElementById('autoVoteOnVisit').checked,
    captchaWarnings: document.getElementById('captchaWarnings').checked
  };
  
  await chrome.storage.local.set({ settings });
  showNotification('Settings saved', 'success');
}

// Load Stats
async function loadStats() {
  const data = await chrome.storage.local.get(['stats']);
  const stats = data.stats || {
    totalVotes: 0,
    todayVotes: 0,
    weekVotes: 0
  };
  
  document.getElementById('totalVotes').textContent = stats.totalVotes || 0;
  document.getElementById('todayVotes').textContent = stats.todayVotes || 0;
  document.getElementById('weekVotes').textContent = stats.weekVotes || 0;
}

// Event Listeners
function initEventListeners() {
  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('addProjectForm').reset();
  });
  
  document.querySelectorAll('#settings-tab input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', saveSettings);
  });
  
  document.getElementById('resetStatsBtn').addEventListener('click', async () => {
    if (!confirm('Reset all statistics?')) return;
    await chrome.storage.local.set({ stats: { totalVotes: 0, todayVotes: 0, weekVotes: 0 } });
    loadStats();
    showNotification('Statistics reset', 'success');
  });
  
  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (!confirm('This will delete ALL projects and data. Are you sure?')) return;
    await chrome.storage.local.clear();
    loadProjects();
    loadStats();
    showNotification('All data cleared', 'success');
  });
}

// Helper Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString();
}

function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}
