// Firebase initialization
const database = firebase.database();

// DOM Elements
const modeToggle = document.getElementById('modeToggle');
const modeText = document.getElementById('modeText');
const currentTimeElement = document.getElementById('currentTime');
const connectionStatus = document.getElementById('connectionStatus');
const scheduleModal = new bootstrap.Modal(document.getElementById('scheduleModal'));

// State management
let isAutoMode = false;
let currentRelay = 1;
let systemData = {
    relay1_manual: 0,
    relay2_manual: 0,
    relay1: 0,
    relay2: 0,
    schedules: {
        relay1: [],
        relay2: []
    },
    status: {
        relay1: 0,
        relay2: 0,
        relay1_mode: "auto",
        relay2_mode: "auto",
        time: "00:00:00"
    }
};

// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');
const html = document.documentElement;

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    themeIcon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Initialize connection monitoring
function initializeConnectionMonitoring() {
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> Đã kết nối';
            connectionStatus.className = 'status-badge';
        } else {
            connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i> Mất kết nối';
            connectionStatus.className = 'status-badge bg-danger';
        }
    });
}

// Update current time
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    currentTimeElement.textContent = timeString;
    
    // Update time in Firebase status
    database.ref('/status/time').set(timeString);
}

// Toggle mode - Global mode toggle affects both relays
modeToggle.addEventListener('change', (e) => {
    const isManual = e.target.checked;
    modeText.textContent = isManual ? 'Chế độ thủ công' : 'Chế độ tự động';
    
    // Update both relay manual modes and reset relays
    const updates = {
        '/relay1_manual': isManual ? 1 : 0,
        '/relay2_manual': isManual ? 1 : 0,
        '/relay1': 0,
        '/relay2': 0,
        '/status/relay1_mode': isManual ? 'manual' : 'auto',
        '/status/relay2_mode': isManual ? 'manual' : 'auto',
        '/status/relay1': 0,
        '/status/relay2': 0
    };
    
    database.ref().update(updates);
});

// Handle relay toggle
function handleRelayToggle(relayNumber) {
    const button = document.getElementById(`relay${relayNumber}Toggle`);
    const statusElement = document.getElementById(`relay${relayNumber}Status`);
    
    button.addEventListener('click', () => {
        // Check if specific relay is in manual mode
        database.ref(`/relay${relayNumber}_manual`).once('value', (snapshot) => {
            const isManual = snapshot.val() === 1;
            if (isManual) {
                const currentState = button.getAttribute('data-state') === 'ON';
                const newState = !currentState;
                
                // Update Firebase with new structure
                const updates = {
                    [`/relay${relayNumber}`]: newState ? 1 : 0,
                    [`/status/relay${relayNumber}`]: newState ? 1 : 0
                };
                
                database.ref().update(updates);
                
                // Update UI immediately for responsiveness
                updateRelayUI(relayNumber, newState);
            } else {
                alert('Vui lòng chuyển sang chế độ thủ công để điều khiển relay!');
            }
        });
    });
}

// Update relay UI
function updateRelayUI(relayNumber, state) {
    const button = document.getElementById(`relay${relayNumber}Toggle`);
    const statusElement = document.getElementById(`relay${relayNumber}Status`);
    
    button.setAttribute('data-state', state ? 'ON' : 'OFF');
    button.innerHTML = `<div class="toggle-content"><i class="fas fa-power-off"></i><span>${state ? 'BẬT' : 'TẮT'}</span></div>`;
    statusElement.textContent = state ? 'Đang bật' : 'Đang tắt';
    
    // Add animation
    button.classList.add('status-change');
    setTimeout(() => button.classList.remove('status-change'), 300);
}

// Open schedule modal
function openScheduleModal(relayNumber) {
    currentRelay = relayNumber;
    document.getElementById('scheduleRelay').value = relayNumber;
    scheduleModal.show();
}

// Save schedule
document.getElementById('saveSchedule').addEventListener('click', () => {
    const onHour = parseInt(document.getElementById('onHour').value);
    const onMinute = parseInt(document.getElementById('onMinute').value);
    const offHour = parseInt(document.getElementById('offHour').value);
    const offMinute = parseInt(document.getElementById('offMinute').value);

    if (isNaN(onHour) || isNaN(onMinute) || isNaN(offHour) || isNaN(offMinute)) {
        alert('Vui lòng nhập đầy đủ thời gian');
        return;
    }

    const newSchedule = {
        enabled: 1,
        on_h: onHour,
        on_m: onMinute,
        off_h: offHour,
        off_m: offMinute
    };

    // Save to Firebase using new path structure
    database.ref(`/schedules/relay${currentRelay}`).once('value', (snapshot) => {
        const schedules = snapshot.val() || [];
        if (!Array.isArray(schedules)) {
            database.ref(`/schedules/relay${currentRelay}`).set([newSchedule]);
        } else {
            schedules.push(newSchedule);
            database.ref(`/schedules/relay${currentRelay}`).set(schedules);
        }
        
        // Clear form and close modal
        document.getElementById('scheduleForm').reset();
        scheduleModal.hide();
    });
});

// Load and display schedules
function loadSchedules(relayNumber) {
    const schedulesContainer = document.getElementById(`relay${relayNumber}Schedules`);
    
    database.ref(`/schedules/relay${relayNumber}`).on('value', (snapshot) => {
        const schedules = snapshot.val() || [];
        schedulesContainer.innerHTML = '';
        
        if (Array.isArray(schedules)) {
            schedules.forEach((schedule, index) => {
                if (schedule) {
                    const scheduleElement = document.createElement('div');
                    scheduleElement.className = 'schedule-item';
                    scheduleElement.innerHTML = `
                        <div class="schedule-time">
                            <i class="fas fa-sun"></i>
                            <span>${String(schedule.on_h).padStart(2, '0')}:${String(schedule.on_m).padStart(2, '0')}</span>
                            <i class="fas fa-arrow-right mx-2"></i>
                            <i class="fas fa-moon"></i>
                            <span>${String(schedule.off_h).padStart(2, '0')}:${String(schedule.off_m).padStart(2, '0')}</span>
                        </div>
                        <div class="schedule-actions">
                            <button class="btn-action" onclick="toggleSchedule(${relayNumber}, ${index}, ${!schedule.enabled})">
                                <i class="fas fa-${schedule.enabled ? 'check-circle' : 'circle'}"></i>
                            </button>
                            <button class="btn-action btn-delete" onclick="deleteSchedule(${relayNumber}, ${index})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                    schedulesContainer.appendChild(scheduleElement);
                }
            });
        }
    });
}

// Toggle schedule
function toggleSchedule(relayNumber, index, enabled) {
    database.ref(`/schedules/relay${relayNumber}/${index}/enabled`).set(enabled ? 1 : 0);
}

// Delete schedule
function deleteSchedule(relayNumber, index) {
    if (confirm('Bạn có chắc muốn xóa lịch trình này?')) {
        database.ref(`/schedules/relay${relayNumber}/${index}`).remove();
    }
}

// Listen for relay state changes
function listenToRelayChanges() {
    // Listen for individual relay manual modes and update global toggle based on both
    database.ref('/relay1_manual').on('value', () => updateGlobalModeToggle());
    database.ref('/relay2_manual').on('value', () => updateGlobalModeToggle());

    // Listen for relay states
    [1, 2].forEach(relayNumber => {
        database.ref(`/relay${relayNumber}`).on('value', (snapshot) => {
            const state = snapshot.val() === 1;
            updateRelayUI(relayNumber, state);
        });
    });

    // Listen for status updates
    database.ref('/status').on('value', (snapshot) => {
        const status = snapshot.val() || {};
        if (status.relay1 !== undefined) {
            updateRelayUI(1, status.relay1 === 1);
        }
        if (status.relay2 !== undefined) {
            updateRelayUI(2, status.relay2 === 1);
        }
        if (status.time) {
            currentTimeElement.textContent = status.time;
        }
    });
}

// Update global mode toggle based on individual relay modes
function updateGlobalModeToggle() {
    Promise.all([
        database.ref('/relay1_manual').once('value'),
        database.ref('/relay2_manual').once('value')
    ]).then(([relay1Snap, relay2Snap]) => {
        const relay1Manual = relay1Snap.val() === 1;
        const relay2Manual = relay2Snap.val() === 1;
        
        // Global toggle is ON if both relays are in manual mode
        const globalManual = relay1Manual && relay2Manual;
        modeToggle.checked = globalManual;
        modeText.textContent = globalManual ? 'Chế độ thủ công' : 'Chế độ tự động';
    });
}

// Initialize system data structure - only basic structure, no preset schedules
function initializeSystemData() {
    // Check if data exists first
    database.ref().once('value', (snapshot) => {
        if (!snapshot.exists()) {
            // Only create basic structure if nothing exists
            const basicData = {
                relay1_manual: 0,
                relay2_manual: 0,
                relay1: 0,
                relay2: 0,
                schedules: {
                    relay1: [],
                    relay2: []
                },
                status: {
                    relay1: 0,
                    relay2: 0,
                    relay1_mode: "auto",
                    relay2_mode: "auto",
                    time: "00:00:00"
                }
            };
            
            database.ref().set(basicData);
        }
    });
}

// Initialize application
function initialize() {
    // Initialize system data structure
    initializeSystemData();
    
    // Set up event listeners for relay toggles
    handleRelayToggle(1);
    handleRelayToggle(2);
    
    // Load schedules for both relays
    loadSchedules(1);
    loadSchedules(2);
    
    // Initialize connection monitoring
    initializeConnectionMonitoring();
    
    // Start time updates
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Listen for relay changes
    listenToRelayChanges();
}

// Toggle individual relay mode
function toggleRelayMode(relayNumber) {
    database.ref(`/relay${relayNumber}_manual`).once('value', (snapshot) => {
        const currentMode = snapshot.val() === 1;
        const newMode = !currentMode;
        
        const updates = {};
        updates[`/relay${relayNumber}_manual`] = newMode ? 1 : 0;
        updates[`/status/relay${relayNumber}_mode`] = newMode ? 'manual' : 'auto';
        
        // Reset relay state when changing mode
        updates[`/relay${relayNumber}`] = 0;
        updates[`/status/relay${relayNumber}`] = 0;
        
        database.ref().update(updates);
    });
}

// Update relay mode display
function updateRelayModeDisplay(relayNumber, isManual) {
    const modeElement = document.getElementById(`relay${relayNumber}Mode`);
    const modeButton = document.getElementById(`relay${relayNumber}ModeToggle`);
    
    modeElement.textContent = `Chế độ: ${isManual ? 'Thủ công' : 'Tự động'}`;
    modeButton.className = `btn btn-mode ${isManual ? 'manual' : 'auto'}`;
}

// Update listeners to include mode display updates
function listenToRelayModeChanges() {
    [1, 2].forEach(relayNumber => {
        database.ref(`/relay${relayNumber}_manual`).on('value', (snapshot) => {
            const isManual = snapshot.val() === 1;
            updateRelayModeDisplay(relayNumber, isManual);
        });
    });
}

// Start the application
initialize();

// Listen to relay mode changes
listenToRelayModeChanges(); 