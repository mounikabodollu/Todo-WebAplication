const STORAGE_KEY = 'todo-app.tasks';
const PREFERENCES_KEY = 'todo-app.preferences';
const THEME_KEY = 'todo-app.theme';

const state = {
  tasks: loadTasks(),
  currentFilter: 'all',
  searchTerm: '',
  priority: 'all',
  sort: 'newest',
  editingId: null,
  view: 'dashboard',
  preferences: loadPreferences(),
};

const taskInput = document.getElementById('taskInput');
const taskDescription = document.getElementById('taskDescription');
const taskDate = document.getElementById('taskDate');
const taskTime = document.getElementById('taskTime');
const taskPriority = document.getElementById('taskPriority');
const taskError = document.getElementById('taskError');
const taskModal = document.getElementById('taskModal');
const modalTitle = document.getElementById('modalTitle');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const themeToggle = document.getElementById('themeToggle');
const mobileThemeToggle = document.getElementById('mobileThemeToggle');
const mainNav = document.getElementById('mainNav');
const menuToggle = document.getElementById('menuToggle');
const navBackdrop = document.getElementById('navBackdrop');
const toastRegion = document.getElementById('toastRegion');
let toastTimer;

initializeApp();

function initializeApp() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  document.getElementById('showCompletedToggle').checked = state.preferences.showCompleted;
  document.getElementById('notificationsToggle').checked = state.preferences.notifications;
  document.getElementById('userNameInput').value = state.preferences.userName;
  setDateAndGreeting();
  bindEvents();
  render();
}

function bindEvents() {
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
  document.getElementById('cancelTaskBtn').addEventListener('click', closeTaskModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeTaskModal);
  taskModal.addEventListener('click', (event) => {
    if (event.target === taskModal) closeTaskModal();
  });
  taskInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveTask();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTaskModal();
      closeMobileMenu();
    }
  });

  document.querySelectorAll('[data-view-link]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      showView(button.dataset.viewLink);
      closeMobileMenu();
    });
  });

  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentFilter = button.dataset.filter;
      render();
    });
  });
  bindSharedControl('input', '.search-box input', (element) => {
    state.searchTerm = element.value.trim().toLowerCase();
    render();
  });
  bindSharedControl('change', '.select-wrap select', (element) => {
    if (element.matches('#priorityFilter, .shared-priority')) state.priority = element.value;
    if (element.matches('#sortSelect, .shared-sort')) state.sort = element.value;
    render();
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('.add-task-trigger')) openTaskModal();
    if (target.matches('.edit-btn')) openTaskModal(Number(target.dataset.id));
    if (target.matches('.delete-btn')) deleteTask(Number(target.dataset.id));
    if (target.matches('.clear-completed-trigger') || target.id === 'clearCompletedBtn') clearCompleted();
    if (target.matches('[data-set-theme]')) applyTheme(target.dataset.setTheme);
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('.task-check')) toggleTask(Number(event.target.dataset.id));
  });

  themeToggle.addEventListener('click', toggleTheme);
  mobileThemeToggle.addEventListener('click', toggleTheme);
  menuToggle.addEventListener('click', () => setMobileMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  navBackdrop.addEventListener('click', closeMobileMenu);

  document.getElementById('showCompletedToggle').addEventListener('change', (event) => {
    state.preferences.showCompleted = event.target.checked;
    savePreferences();
    render();
  });
  document.getElementById('notificationsToggle').addEventListener('change', (event) => {
    state.preferences.notifications = event.target.checked;
    savePreferences();
    notify(`Notifications ${event.target.checked ? 'enabled' : 'disabled'}`);
  });
  document.getElementById('userNameInput').addEventListener('input', (event) => {
    state.preferences.userName = event.target.value.trim();
    setGreeting();
  });
  document.getElementById('userNameInput').addEventListener('change', () => {
    if (savePreferences()) notify('Name saved');
  });
}

function bindSharedControl(eventName, selector, callback) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener(eventName, () => {
      callback(element);
      document.querySelectorAll(selector).forEach((peer) => {
        if (peer !== element) peer.value = element.value;
      });
    });
  });
}

function openTaskModal(taskId = null) {
  const task = taskId === null ? null : state.tasks.find((item) => item.id === taskId);
  if (taskId !== null && !task) return;
  state.editingId = task ? task.id : null;
  modalTitle.textContent = task ? 'Edit task' : 'Add a new task';
  saveTaskBtn.textContent = task ? 'Save changes' : 'Add task';
  taskInput.value = task ? task.title : '';
  taskDescription.value = task ? task.description || '' : '';
  taskDate.value = task ? task.date || '' : '';
  taskTime.value = task ? task.time || '' : '';
  taskPriority.value = task ? task.priority || 'medium' : 'medium';
  taskError.textContent = '';
  taskModal.classList.remove('hidden');
  taskModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  taskInput.focus();
}

function closeTaskModal() {
  if (taskModal.classList.contains('hidden')) return;
  taskModal.classList.add('hidden');
  taskModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  state.editingId = null;
}

function saveTask() {
  const title = taskInput.value.trim();
  if (!title) {
    taskError.textContent = 'Please enter a task title.';
    taskInput.focus();
    return;
  }

  if (state.editingId !== null) {
    const task = state.tasks.find((item) => item.id === state.editingId);
    if (!task) {
      closeTaskModal();
      return;
    }
    Object.assign(task, getFormTaskData());
    closeTaskModal();
    const saved = saveTasks();
    render();
    if (saved) notify('Task updated');
    return;
  }

  state.tasks.unshift({
    id: createTaskId(),
    ...getFormTaskData(),
    completed: false,
    createdAt: Date.now(),
  });
  closeTaskModal();
  const saved = saveTasks();
  render();
  if (saved) notify('Task added successfully');
}

function getFormTaskData() {
  return {
    title: taskInput.value.trim(),
    description: taskDescription.value.trim(),
    date: taskDate.value,
    time: taskTime.value,
    priority: taskPriority.value,
  };
}

function createTaskId() {
  let id = Date.now();
  while (state.tasks.some((task) => task.id === id)) id += 1;
  return id;
}

function render() {
  updateStats();
  updateFilters();
  updateProgress();
  const dashboardTasks = getVisibleTasks({ dashboard: true });
  const allTasks = getVisibleTasks();
  const completedTasks = sortedTasks(state.tasks.filter((task) => task.completed));
  renderTaskList(document.getElementById('taskList'), dashboardTasks, 'dashboard');
  renderTaskList(document.getElementById('allTaskList'), allTasks, 'all');
  renderTaskList(document.getElementById('completedTaskList'), completedTasks, 'completed');
  document.getElementById('visibleCount').textContent = String(dashboardTasks.length);
  document.getElementById('allVisibleCount').textContent = String(allTasks.length);
}

function getVisibleTasks(options = {}) {
  let tasks = state.tasks.filter((task) => {
    if (state.currentFilter === 'active' && task.completed) return false;
    if (state.currentFilter === 'completed' && !task.completed) return false;
    if (state.currentFilter === 'overdue' && !isOverdue(task)) return false;
    if (state.priority !== 'all' && (task.priority || 'medium') !== state.priority) return false;
    if (!state.preferences.showCompleted && task.completed && state.view !== 'completed') return false;
    if (state.searchTerm) {
      const searchable = `${task.title} ${task.description || ''}`.toLowerCase();
      if (!searchable.includes(state.searchTerm)) return false;
    }
    return true;
  });
  if (options.dashboard && state.currentFilter === 'all') {
    const today = localDateString(new Date());
    const todayTasks = tasks.filter((task) => !task.completed && task.date === today);
    const rest = tasks.filter((task) => !todayTasks.includes(task));
    tasks = [...todayTasks, ...rest];
  }
  return sortedTasks(tasks);
}

function sortedTasks(tasks) {
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  return [...tasks].sort((a, b) => {
    if (state.sort === 'oldest') return (a.createdAt || a.id) - (b.createdAt || b.id);
    if (state.sort === 'due') return dueValue(a) - dueValue(b);
    if (state.sort === 'priority') return (priorityWeight[b.priority || 'medium'] || 2) - (priorityWeight[a.priority || 'medium'] || 2);
    if (state.sort === 'completed') return Number(b.completed) - Number(a.completed) || (b.createdAt || b.id) - (a.createdAt || a.id);
    return (b.createdAt || b.id) - (a.createdAt || a.id);
  });
}

function dueValue(task) {
  if (!task.date) return Number.MAX_SAFE_INTEGER;
  const due = new Date(`${task.date}T${task.time || '23:59'}:00`).getTime();
  return Number.isNaN(due) ? Number.MAX_SAFE_INTEGER : due;
}

function renderTaskList(container, tasks, mode) {
  if (!tasks.length) {
    const hasTasks = state.tasks.length > 0;
    const message = hasTasks ? 'No matching tasks' : 'No tasks yet';
    const subtext = hasTasks
      ? 'Try adjusting your search or filters.'
      : 'Your task list is ready when you are. Add your first task and start making progress.';
    container.innerHTML = `<div class="empty-state"><span class="empty-illustration" aria-hidden="true">${hasTasks ? '⌕' : '✎'}</span><h3>${message}</h3><p>${subtext}</p>${!hasTasks && mode !== 'completed' ? '<button class="primary-btn add-task-trigger" type="button">＋ Add New Task</button>' : ''}</div>`;
    return;
  }
  if (mode === 'dashboard') {
    const today = localDateString(new Date());
    const groups = [
      { title: "Today's tasks", list: tasks.filter((task) => !task.completed && task.date === today) },
      { title: 'Upcoming & no date', list: tasks.filter((task) => !task.completed && task.date !== today) },
      { title: 'Completed', list: tasks.filter((task) => task.completed) },
    ].filter((group) => group.list.length);
    container.innerHTML = groups.map((group) => `<div class="task-group"><h3 class="group-title">${group.title}<span>${group.list.length}</span></h3>${group.list.map(createTaskElement).join('')}</div>`).join('');
    return;
  }
  container.innerHTML = tasks.map(createTaskElement).join('');
}

function createTaskElement(task) {
  const overdue = isOverdue(task);
  const priority = task.priority || 'medium';
  const details = [
    task.date ? `<span class="meta-item">▦ ${escapeHtml(formatDate(task.date))}</span>` : '',
    task.time ? `<span class="meta-item">◷ ${escapeHtml(formatTime(task.time))}</span>` : '',
  ].filter(Boolean).join('');
  return `
    <article class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}">
      <div class="task-card-main">
        <input class="task-check" type="checkbox" data-id="${Number(task.id)}" ${task.completed ? 'checked' : ''} aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${escapeHtml(task.title)}" />
        <div class="task-content">
          <h3 class="task-title">${escapeHtml(task.title)}</h3>
          ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta-details">${details}${overdue ? '<span class="overdue-label">⚠ Overdue</span>' : ''}<span class="priority-badge priority-${priority}">${priority} priority</span></div>
        </div>
        <div class="task-actions"><button class="task-action edit-btn" data-id="${Number(task.id)}" type="button" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task">✎</button><button class="task-action delete delete-btn" data-id="${Number(task.id)}" type="button" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">×</button></div>
      </div>
    </article>`;
}

function toggleTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  const saved = saveTasks();
  render();
  if (saved) notify(task.completed ? 'Task completed!' : 'Task moved back to active');
}

function deleteTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  if (!window.confirm(`Are you sure you want to delete this task?\n\n"${task.title}"`)) return;
  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  const saved = saveTasks();
  render();
  if (saved) notify('Task deleted');
}

function clearCompleted() {
  const completed = state.tasks.filter((task) => task.completed).length;
  if (!completed) {
    notify('There are no completed tasks to clear');
    return;
  }
  if (!window.confirm(`Clear ${completed} completed ${completed === 1 ? 'task' : 'tasks'}?`)) return;
  state.tasks = state.tasks.filter((task) => !task.completed);
  const saved = saveTasks();
  render();
  if (saved) notify('Completed tasks cleared');
}

function updateStats() {
  const completed = state.tasks.filter((task) => task.completed).length;
  document.getElementById('totalCount').textContent = String(state.tasks.length);
  document.getElementById('activeCount').textContent = String(state.tasks.length - completed);
  document.getElementById('completedCount').textContent = String(completed);
  document.getElementById('overdueCount').textContent = String(state.tasks.filter(isOverdue).length);
}

function updateProgress() {
  const today = localDateString(new Date());
  const todayTasks = state.tasks.filter((task) => task.date === today);
  const completed = todayTasks.filter((task) => task.completed).length;
  const percentage = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0;
  document.getElementById('progressPercent').textContent = `${percentage}%`;
  document.getElementById('progressBar').style.width = `${percentage}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(percentage));
  document.getElementById('progressSummary').textContent = todayTasks.length
    ? `${completed} of ${todayTasks.length} tasks due today completed`
    : 'No tasks due today. Add a task to start tracking your progress.';
}

function updateFilters() {
  document.querySelectorAll('.filter-btn').forEach((button) => {
    const active = button.dataset.filter === state.currentFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.search-box input').forEach((input) => {
    if (input.value.trim().toLowerCase() !== state.searchTerm) input.value = state.searchTerm;
  });
  document.querySelectorAll('#priorityFilter, .shared-priority').forEach((select) => { select.value = state.priority; });
  document.querySelectorAll('#sortSelect, .shared-sort').forEach((select) => { select.value = state.sort; });
}

function showView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((section) => {
    const active = section.id === `${view}View`;
    section.classList.toggle('active-view', active);
    section.hidden = !active;
  });
  document.querySelectorAll('[data-view-link]').forEach((link) => {
    link.classList.toggle('active', link.dataset.viewLink === view);
  });
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMobileMenu(open) {
  mainNav.classList.toggle('open', open);
  navBackdrop.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  menuToggle.textContent = open ? '×' : '☰';
}

function closeMobileMenu() {
  setMobileMenu(false);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  try {
    localStorage.setItem(THEME_KEY, selectedTheme);
  } catch (error) {
    console.error('Unable to save theme preference to localStorage:', error);
  }
  const dark = selectedTheme === 'dark';
  themeToggle.innerHTML = `<span aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-label">${dark ? 'Light mode' : 'Dark mode'}</span>`;
  themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  mobileThemeToggle.textContent = dark ? '☀' : '☾';
  mobileThemeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  document.querySelectorAll('[data-set-theme]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.setTheme === selectedTheme);
    button.setAttribute('aria-pressed', String(button.dataset.setTheme === selectedTheme));
  });
}

function setDateAndGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const emoji = hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';
  document.getElementById('greetingTime').textContent = greeting;
  document.getElementById('greetingEmoji').textContent = emoji;
  setGreeting();
  document.getElementById('todayDate').textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date());
}

function setGreeting() {
  const name = state.preferences.userName;
  document.getElementById('greetingName').textContent = name ? `, ${name}!` : '!';
}

function notify(message, force = false) {
  if (!force && !state.preferences.notifications) return;
  toastRegion.innerHTML = `<div class="toast"><span aria-hidden="true">✓</span> ${escapeHtml(message)}</div>`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastRegion.innerHTML = ''; }, 3200);
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    return true;
  } catch (error) {
    console.error('Unable to save tasks to localStorage:', error);
    notify('Unable to save changes in this browser', true);
    return false;
  }
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((task) => task && typeof task === 'object' && typeof task.title === 'string').map((task, index) => ({
      ...task,
      id: task.id ?? Date.now() + index,
      completed: Boolean(task.completed),
      priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
      description: typeof task.description === 'string' ? task.description : '',
    })) : [];
  } catch (error) {
    console.error('Unable to load tasks from localStorage:', error);
    return [];
  }
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
    return {
      showCompleted: saved.showCompleted !== false,
      notifications: saved.notifications !== false,
      userName: typeof saved.userName === 'string' ? saved.userName.trim().slice(0, 40) : '',
    };
  } catch (error) {
    console.error('Unable to load preferences from localStorage:', error);
    return { showCompleted: true, notifications: true, userName: '' };
  }
}

function savePreferences() {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.preferences));
    return true;
  } catch (error) {
    console.error('Unable to save preferences to localStorage:', error);
    notify('Unable to save preferences in this browser', true);
    return false;
  }
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isOverdue(task) {
  if (!task.date || task.completed) return false;
  const deadline = new Date(`${task.date}T${task.time || '23:59'}:00`);
  return !Number.isNaN(deadline.getTime()) && deadline < new Date();
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
