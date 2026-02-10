// DOM Elements
const shortcutList = document.getElementById('shortcutList');
const emptyState = document.getElementById('emptyState');
const modalOverlay = document.getElementById('modalOverlay');
const shortcutForm = document.getElementById('shortcutForm');
const triggerInput = document.getElementById('trigger');
const expansionInput = document.getElementById('expansion');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');

// Chat Elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');

// Stats elements (shortcuts section)
const totalShortcutsEl = document.getElementById('totalShortcuts');
const totalExpansionsEl = document.getElementById('totalExpansions');
const charsSavedEl = document.getElementById('charsSaved');

// Stats elements (statistics section)
const statTotalShortcutsEl = document.getElementById('statTotalShortcuts');
const statTotalExpansionsEl = document.getElementById('statTotalExpansions');
const statCharsSavedEl = document.getElementById('statCharsSaved');
const statTimeSavedEl = document.getElementById('statTimeSaved');

// Sections
const sections = {
    shortcuts: document.getElementById('shortcutsSection'),
    stats: document.getElementById('statsSection'),
    defaults: document.getElementById('defaultsSection'),
    communication: document.getElementById('communicationSection'),
    appShortcuts: document.getElementById('appShortcutsSection'),
    aiAssistant: document.getElementById('aiAssistantSection'),
    settings: document.getElementById('settingsSection'),
    about: document.getElementById('aboutSection')
};

// State
let shortcuts = [];
let editingTrigger = null;
let stats = {
    expansions: 0,
    charsSaved: 0
};
let settings = {
    startWithWindows: false,
    startMinimized: false,
    playSound: true,
    caseSensitive: false
};

// Initialize
async function init() {
    shortcuts = await window.ghostAPI.getShortcuts();
    stats = await window.ghostAPI.getStats();
    settings = await window.ghostAPI.getSettings();
    renderShortcuts(shortcuts);
    updateStats();
    applySettingsToUI();
    setupNavigation();
    setupSettings();
    setupAiAssistant();
    setupContactButtons();
}

function setupContactButtons() {
    const githubBtn = document.getElementById('githubBtn');
    const whatsappBtn = document.getElementById('whatsappBtn');

    if (githubBtn) {
        githubBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.ghostAPI.openExternal('https://github.com/hazasite');
        });
    }

    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.ghostAPI.openExternal(whatsappBtn.href);
        });
    }
}

// Setup navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            
            // Update active nav
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show correct section
            Object.keys(sections).forEach(key => {
                sections[key].classList.remove('active');
            });
            sections[section].classList.add('active');
            
            // Update stats when switching to stats section
            if (section === 'stats') {
                updateStats();
            }
        });
    });
}

// Setup settings
function setupSettings() {
    // Export
    document.getElementById('exportBtn').addEventListener('click', async () => {
        const data = JSON.stringify(shortcuts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ghost-typer-shortcuts.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Shortcuts exported!');
    });

    // Import
    document.getElementById('importBtn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                try {
                    const imported = JSON.parse(text);
                    if (Array.isArray(imported)) {
                        for (const s of imported) {
                            if (s.trigger && s.expansion) {
                                if (!shortcuts.find(existing => existing.trigger === s.trigger)) {
                                    await window.ghostAPI.addShortcut(s);
                                }
                            }
                        }
                        showToast(`Imported ${imported.length} shortcuts!`);
                    }
                } catch (err) {
                    alert('Invalid JSON file');
                }
            }
        };
        input.click();
    });

    // Reset
    document.getElementById('resetBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete ALL shortcuts? This cannot be undone!')) {
            for (const s of [...shortcuts]) {
                await window.ghostAPI.deleteShortcut(s.trigger);
            }
            showToast('All data reset');
        }
    });

    // Toggle Listeners
    const toggles = {
        'startWithWindows': 'startWithWindows',
        'startMinimized': 'startMinimized',
        'playSound': 'playSound',
        'caseSensitive': 'caseSensitive'
    };
    Object.keys(toggles).forEach(key => {
        const el = document.getElementById(toggles[key]);
        if (el) {
            el.addEventListener('change', async (e) => {
                settings[key] = e.target.checked;
                await window.ghostAPI.updateSettings(settings);
                showToast('Settings saved');
            });
        }
    });
}



function applySettingsToUI() {
    const toggles = {
        'startWithWindows': 'startWithWindows',
        'startMinimized': 'startMinimized',
        'playSound': 'playSound',
        'caseSensitive': 'caseSensitive'
    };
    Object.keys(toggles).forEach(key => {
        const el = document.getElementById(toggles[key]);
        if (el) {
            el.checked = settings[key];
        }
    });
}

// Render shortcuts
function renderShortcuts(list) {
    if (list.length === 0) {
        shortcutList.style.display = 'none';
        emptyState.classList.add('show');
        return;
    }

    shortcutList.style.display = 'grid';
    emptyState.classList.remove('show');

    shortcutList.innerHTML = list.map(s => `
        <div class="shortcut-card" data-trigger="${escapeHtml(s.trigger)}">
            <div class="shortcut-header">
                <span class="shortcut-trigger">${escapeHtml(s.trigger)}</span>
                <div class="shortcut-actions">
                    <button class="btn-icon edit" title="Edit shortcut">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete" title="Delete shortcut">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="shortcut-expansion">${escapeHtml(s.expansion)}</div>
        </div>
    `).join('');

    // Attach event listeners
    document.querySelectorAll('.shortcut-card .edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.shortcut-card');
            const trigger = card.dataset.trigger;
            openEditModal(trigger);
        });
    });

    document.querySelectorAll('.shortcut-card .delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.target.closest('.shortcut-card');
            const trigger = card.dataset.trigger;
            if (confirm(`Delete shortcut "${trigger}"?`)) {
                await window.ghostAPI.deleteShortcut(trigger);
                showToast('Shortcut deleted');
            }
        });
    });
}

// Update stats
function updateStats() {
    // Use actual tracked stats from main process
    const charsSaved = stats.charsSaved || 0;
    
    // Mini stats
    totalShortcutsEl.textContent = shortcuts.length;
    totalExpansionsEl.textContent = stats.expansions;
    charsSavedEl.textContent = charsSaved;
    
    // Big stats
    statTotalShortcutsEl.textContent = shortcuts.length;
    statTotalExpansionsEl.textContent = stats.expansions;
    statCharsSavedEl.textContent = charsSaved;
    
    // Calculate time saved (0.2 seconds per character)
    const timeSaved = charsSaved * 0.2;
    if (timeSaved < 60) {
        statTimeSavedEl.textContent = `${Math.round(timeSaved)}s`;
    } else if (timeSaved < 3600) {
        statTimeSavedEl.textContent = `${Math.round(timeSaved / 60)}m`;
    } else {
        statTimeSavedEl.textContent = `${(timeSaved / 3600).toFixed(1)}h`;
    }
}

// Open modal for adding
function openAddModal() {
    editingTrigger = null;
    modalTitle.textContent = 'Add New Shortcut';
    submitBtn.textContent = 'Add Shortcut';
    triggerInput.value = '';
    expansionInput.value = '';
    triggerInput.disabled = false;
    modalOverlay.classList.add('active');
    triggerInput.focus();
}

// Open modal for editing
function openEditModal(trigger) {
    const shortcut = shortcuts.find(s => s.trigger === trigger);
    if (!shortcut) return;

    editingTrigger = trigger;
    modalTitle.textContent = 'Edit Shortcut';
    submitBtn.textContent = 'Save Changes';
    // Remove the ; prefix for display since it's shown separately
    triggerInput.value = shortcut.trigger.replace(/^;/, '');
    expansionInput.value = shortcut.expansion;
    triggerInput.disabled = true; // Can't change trigger when editing
    modalOverlay.classList.add('active');
    expansionInput.focus();
}

// Close modal
function closeModal() {
    modalOverlay.classList.remove('active');
    shortcutForm.reset();
    triggerInput.disabled = false; // Ensure enabled for next time
    editingTrigger = null;
}

// Show toast notification
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Play premium expansion sound
function playExpansionSound() {
    if (!settings.playSound) return;
    
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create multiple oscillators for a richer, more "premium" sound
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // High-pitched chime component
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.1);

        // Softer body component
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.15);

        // Volume (increased as requested)
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.2);
        osc2.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
        console.error('Error playing sound:', e);
    }
}

// Search functionality
function filterShortcuts(query) {
    if (!query) {
        renderShortcuts(shortcuts);
        return;
    }
    
    const filtered = shortcuts.filter(s => 
        s.trigger.toLowerCase().includes(query.toLowerCase()) ||
        s.expansion.toLowerCase().includes(query.toLowerCase())
    );
    renderShortcuts(filtered);
}

// Event Listeners
document.getElementById('openAddModal').addEventListener('click', openAddModal);
document.getElementById('emptyAddBtn').addEventListener('click', openAddModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

shortcutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let trigger = triggerInput.value.trim();
    
    // Always add ; prefix if not present
    if (!trigger.startsWith(';')) {
        trigger = ';' + trigger;
    }
    
    const expansion = expansionInput.value;

    if (editingTrigger) {
        // Update existing
        await window.ghostAPI.updateShortcut(editingTrigger, { trigger: editingTrigger, expansion });
        showToast('Shortcut updated');
    } else {
        // Check for duplicates
        if (shortcuts.find(s => s.trigger === trigger)) {
            alert('This trigger already exists!');
            return;
        }
        await window.ghostAPI.addShortcut({ trigger, expansion });
        showToast('Shortcut added');
    }
    
    closeModal();
});

searchInput.addEventListener('input', (e) => {
    filterShortcuts(e.target.value);
});

// Listen for updates from main process
window.ghostAPI.onShortcutsUpdated((updatedShortcuts) => {
    shortcuts = updatedShortcuts;
    renderShortcuts(shortcuts);
    updateStats();
});

window.ghostAPI.onStatsUpdated((updatedStats) => {
    stats = updatedStats;
    updateStats();
});

window.ghostAPI.onPlaySound(() => {
    playExpansionSound();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
    }
    // Ctrl+N to add new
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
});

// AI Assistant Logic
function setupAiAssistant() {
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', () => sendAiMessage());
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAiMessage();
        });
    }
}

async function sendAiMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add user message
    addChatMessage(text, 'user');
    chatInput.value = '';
    
    // Show temporary loading message
    addChatMessage('Thinking...', 'ai', true);

    // Construct the context-aware prompt
    const appInfo = `
You are the Ghost Typer Assistant, the official AI companion for the Ghost Typer app.
Developed by: HAZA
Founder: Janma Hasarel

Ghost Typer is a premium, high-performance text expansion tool designed to boost productivity.

Key Features & Functionality:
- Text Expansion: Type a short "trigger" (e.g., ;mail) and it instantly expands into your predefined text.
- Dynamic Placeholders: Shortcuts support {date} (YYYY-MM-DD) and {time} (HH:MM:SS) for automated snippets.
- Spotlight Search: Press Ctrl + Space to open a sleek, transparent search bar to find and paste any shortcut instantly.
- Statistics: The app tracks your productivity, showing total expansions and the exact number of characters you've saved.
- System Tray: Ghost Typer runs quietly in the background. Minimize it to the system tray to keep your workspace clean.
- Custom AI: Users can use their own OpenAI-compatible API keys (like Google Gemini) via the Settings section for the AI Assistant.

Settings & Customization:
- Start with Windows: Automatically launch the app when you log in.
- Start Minimized: Launch the app directly into the system tray.
- Play Sound: Hear a subtle confirmation sound every time a shortcut expands.
- Case Sensitivity: Choose whether triggers should distinguish between uppercase and lowercase letters.

ACTION CAPABILITY:
You can change settings, create, edit, AND delete shortcuts for the user!
1. Change setting: [CMD:SETTING:{"key_name": value}]
2. Create shortcut: [CMD:SHORTCUT:{"trigger": ";yourtrigger", "expansion": "text"}]
3. Edit shortcut: [CMD:EDIT:{"trigger": ";existing", "expansion": "new text"}]
4. Delete shortcut: [CMD:DELETE:{"trigger": ";existing"}]

IMPORTANT INSTRUCTIONS:
- Do NOT wrap these [CMD:...] tags in backticks or code blocks.
- ONLY use the [CMD:...] tags if the user EXPLICITLY asks you to create, edit, delete or change something. 
- If the user asks "HOW to" do something, just give them instructions without executing any commands.
- If you create/edit/delete something, confirm it clearly like: "I have updated the shortcut for you!" or "Shortcut created successfully!"
- Keep it short and professional.

Context for response:
- If asked "how to create/add a shortcut", explain that they can use the "Create Shortcut" button, the Ctrl + N hotkey, OR they can simply tell YOU (the AI) to "Create a shortcut with trigger ;t and expansion e". 
- Do NOT include a live [CMD:...] tag in your response when giving instructions. Only use it when you are actually performing the task.
- If asked about "Active & Listening" status, explain that the app is currently monitoring your keystrokes to detect and expand your shortcuts.
- Always be helpful, professional, and proud of being a HAZA product.

User Question: ${text}`;

    try {
        let data = '';
        if (settings.useCustomAI && settings.apiEndpoint && settings.apiKey) {
            // Use OpenAI compatible custom API
            const response = await fetch(settings.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    model: settings.apiModel || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: appInfo }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API Error: ${response.status}`);
            }

            const result = await response.json();
            data = result.choices[0].message.content;
        } else {
            // Use Pollinations.ai with Gemini model for higher quality detailed responses
            const url = `https://text.pollinations.ai/${encodeURIComponent(appInfo)}?model=gemini&seed=${Math.floor(Math.random()*1000)}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (!response.ok) {
                const fallbackResponse = await fetch(`https://text.pollinations.ai/${encodeURIComponent(appInfo)}`);
                if (!fallbackResponse.ok) throw new Error(`Pollinations API Error: ${fallbackResponse.status}`);
                data = await fallbackResponse.text();
            } else {
                data = await response.text();
            }
        }
        
        // Remove loading message
        const loadingMsg = document.getElementById('temp-loading-msg');
        if (loadingMsg) loadingMsg.remove();
        
        let finalData = data;

        // Check for settings commands in the message
        const cmdRegex = /\[CMD:SETTING:\s*({[\s\S]*?})\s*\]/i;
        const match = data.match(cmdRegex);
        if (match) {
            try {
                const jsonStr = match[1].replace(/\\'/g, "'");
                const settingChange = JSON.parse(jsonStr);
                const key = Object.keys(settingChange)[0];
                const value = settingChange[key];
                
                if (key in settings) {
                    settings[key] = value;
                    await window.ghostAPI.updateSettings(settings);
                    applySettingsToUI();
                    showToast(`Setting updated`);
                }
            } catch (e) {
                console.error('Failed to parse AI command:', e);
            }
            // Always remove the command from the displayed message, even if parsing/update failed
            finalData = finalData.replace(cmdRegex, '').trim();
        }

        // Check for shortcut creation command
        const shortcutRegex = /\[CMD:SHORTCUT:\s*({[\s\S]*?})\s*\]/i;
        const shortcutMatch = data.match(shortcutRegex);
        if (shortcutMatch) {
            try {
                const jsonStr = shortcutMatch[1].replace(/\\'/g, "'");
                const shortcutData = JSON.parse(jsonStr);
                if (shortcutData.trigger && shortcutData.expansion) {
                    if (shortcuts.find(s => s.trigger === shortcutData.trigger)) {
                        showToast('Trigger already exists');
                    } else {
                        await window.ghostAPI.addShortcut(shortcutData);
                        showToast(`Shortcut created`);
                    }
                }
            } catch (e) {
                console.error('Failed to parse AI shortcut command:', e);
            }
            finalData = finalData.replace(shortcutRegex, '').trim();
        }

        // Check for Edit command
        const editRegex = /\[CMD:EDIT:\s*({[\s\S]*?})\s*\]/i;
        const editMatch = data.match(editRegex);
        if (editMatch) {
            try {
                const jsonStr = editMatch[1].replace(/\\'/g, "'");
                const editData = JSON.parse(jsonStr);
                const existing = shortcuts.find(s => s.trigger === editData.trigger);
                if (existing) {
                    await window.ghostAPI.updateShortcut(editData.trigger, { trigger: editData.trigger, expansion: editData.expansion });
                    showToast(`Shortcut updated`);
                } else {
                    showToast('Shortcut not found');
                }
            } catch (e) {
                console.error('Failed to parse AI edit command:', e);
            }
            finalData = finalData.replace(editRegex, '').trim();
        }

        // Check for Delete command
        const deleteRegex = /\[CMD:DELETE:\s*({[\s\S]*?})\s*\]/i;
        const deleteMatch = data.match(deleteRegex);
        if (deleteMatch) {
            try {
                const jsonStr = deleteMatch[1].replace(/\\'/g, "'");
                const deleteData = JSON.parse(jsonStr);
                const existing = shortcuts.find(s => s.trigger === deleteData.trigger);
                if (existing) {
                    await window.ghostAPI.deleteShortcut(deleteData.trigger);
                    showToast(`Shortcut deleted`);
                } else {
                    showToast('Shortcut not found');
                }
            } catch (e) {
                console.error('Failed to parse AI delete command:', e);
            }
        }
        
        // Final cleanup of the message
        // 1. Remove any command tags that might remain
        finalData = finalData
            .replace(/\[CMD:SETTING:[\s\S]*?\]/gi, '')
            .replace(/\[CMD:SHORTCUT:[\s\S]*?\]/gi, '')
            .replace(/\[CMD:EDIT:[\s\S]*?\]/gi, '')
            .replace(/\[CMD:DELETE:[\s\S]*?\]/gi, '');

        // 2. Remove leftover code blocks or backticks that the AI often adds around commands
        finalData = finalData
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/`/g, '')             // Remove single backticks
            .replace(/[\r\n]{2,}/g, '\n')   // Collapse multiple newlines
            .trim();
        
        // 3. Fallback/Friendly confirmation if the message is too technical or empty
        if (!finalData || finalData.length < 5) {
            finalData = "Meka hari machan! I've updated your shortcuts successfully. ✅";
        }
        
        addChatMessage(finalData, 'ai');
    } catch (error) {
        console.error('AI Error:', error);
        const loadingMsg = document.getElementById('temp-loading-msg');
        if (loadingMsg) loadingMsg.remove();
        addChatMessage('Sorry, I could not connect to the AI service. Please check your internet connection or Refresh.', 'ai');
    }
}

function addChatMessage(text, sender, isTemp = false) {
    const div = document.createElement('div');
    div.className = `chat-message ${sender}`;
    if (isTemp) div.id = 'temp-loading-msg';
    
    // Basic formatting
    // We already have escapeHtml function available
    let content = escapeHtml(text);
    
    // Simple Markdown-like formatting for AI responses
    if (sender === 'ai') {
        content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
        
    div.innerHTML = `
        ${sender === 'ai' ? `
        <div class="message-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
        </div>` : ''}
        <div class="message-content">
            ${content}
        </div>
    `;
    
    chatMessages.appendChild(div);
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize app
init();
