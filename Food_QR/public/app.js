// Global State
let currentUser = null;
let currentDay = 1;
let mealsData = {};
let datesData = [];
let html5QrcodeScanner = null;

// DOM Elements
const startScanBtn = document.getElementById('start-scan');
const stopScanBtn = document.getElementById('stop-scan');
const scanStatus = document.getElementById('scan-status');
const manualInput = document.getElementById('manual-user-id');
const manualSearchBtn = document.getElementById('manual-search');
const userSection = document.getElementById('user-section');
const closeUserBtn = document.getElementById('close-user');
const tabBtns = document.querySelectorAll('.tab-btn');
const currentDateEl = document.getElementById('current-date');
const breakfastToggle = document.getElementById('breakfast-toggle');
const lunchToggle = document.getElementById('lunch-toggle');
const dinnerToggle = document.getElementById('dinner-toggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchDates();
    setupEventListeners();
});

// Fetch dates from server
async function fetchDates() {
    try {
        const response = await fetch('/api/dates');
        datesData = await response.json();
    } catch (error) {
        console.error('Error fetching dates:', error);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    startScanBtn.addEventListener('click', startScanner);
    stopScanBtn.addEventListener('click', stopScanner);
    manualSearchBtn.addEventListener('click', handleManualSearch);
    manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleManualSearch();
    });
    closeUserBtn.addEventListener('click', closeUserPanel);

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchDay(parseInt(btn.dataset.day)));
    });

    // Meal toggles
    breakfastToggle.addEventListener('change', () => updateMeal('breakfast', breakfastToggle.checked));
    lunchToggle.addEventListener('change', () => updateMeal('lunch', lunchToggle.checked));
    dinnerToggle.addEventListener('change', () => updateMeal('dinner', dinnerToggle.checked));
}

// Start QR Scanner
function startScanner() {
    const qrReaderEl = document.getElementById('qr-reader');
    qrReaderEl.innerHTML = '';

    html5QrcodeScanner = new Html5Qrcode('qr-reader');

    html5QrcodeScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        onScanFailure
    ).then(() => {
        startScanBtn.disabled = true;
        stopScanBtn.disabled = false;
        scanStatus.textContent = 'Scanner active - Point at a QR code';
        scanStatus.className = 'scan-status';
    }).catch(err => {
        scanStatus.textContent = 'Camera error: ' + err;
        scanStatus.className = 'scan-status error';
    });
}

// Stop QR Scanner
function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
            startScanBtn.disabled = false;
            stopScanBtn.disabled = true;
            scanStatus.textContent = 'Scanner stopped';
            scanStatus.className = 'scan-status';
        }).catch(err => console.error('Error stopping scanner:', err));
    }
}

// On Successful Scan
async function onScanSuccess(decodedText, decodedResult) {
    // Stop scanner after successful scan
    stopScanner();

    scanStatus.textContent = `Found: ${decodedText}`;
    scanStatus.className = 'scan-status success';

    // Play success sound (optional visual feedback)
    showToast('QR Code scanned successfully!', 'success');

    await fetchUser(decodedText);
}

// On Scan Failure (not an error, just no QR found in frame)
function onScanFailure(error) {
    // Ignore - this happens continuously when no QR is in view
}

// Handle Manual Search
async function handleManualSearch() {
    const userId = manualInput.value.trim().toUpperCase();
    if (userId) {
        await fetchUser(userId);
    }
}

// Fetch User from API
async function fetchUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);

        if (!response.ok) {
            throw new Error('User not found');
        }

        const user = await response.json();
        currentUser = user;

        // Fetch meals
        await fetchMeals(userId);

        // Display user
        displayUser(user);

    } catch (error) {
        showToast('User not found: ' + userId, 'error');
        scanStatus.textContent = 'User not found';
        scanStatus.className = 'scan-status error';
    }
}

// Fetch Meals for User
async function fetchMeals(userId) {
    try {
        const response = await fetch(`/api/meals/${userId}`);
        mealsData = await response.json();
        updateMealToggles();
    } catch (error) {
        console.error('Error fetching meals:', error);
    }
}

// Display User Information
function displayUser(user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-id-display').textContent = `ID: ${user.id}`;
    document.getElementById('user-email').textContent = user.email || '-';
    document.getElementById('user-phone').textContent = user.phone || '-';
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    userSection.style.display = 'block';

    // Reset to Day 1
    switchDay(1);
}

// Switch Day Tab
function switchDay(day) {
    currentDay = day;

    // Update tab buttons
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.day) === day);
    });

    // Update current date display
    if (datesData.length >= day) {
        const date = new Date(datesData[day - 1]);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = date.toLocaleDateString('en-US', options);
    }

    // Update meal toggles
    updateMealToggles();
}

// Update Meal Toggles based on current day
function updateMealToggles() {
    const dayKey = `day${currentDay}`;
    const dayMeals = mealsData[dayKey] || { breakfast: false, lunch: false, dinner: false };

    breakfastToggle.checked = dayMeals.breakfast;
    lunchToggle.checked = dayMeals.lunch;
    dinnerToggle.checked = dayMeals.dinner;
}

// Update Meal Status
async function updateMeal(mealType, status) {
    if (!currentUser) return;

    const dayKey = `day${currentDay}`;
    const date = mealsData[dayKey]?.date || datesData[currentDay - 1];

    try {
        const response = await fetch('/api/meals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                date: date,
                mealType: mealType,
                status: status
            })
        });

        if (response.ok) {
            // Update local state
            if (!mealsData[dayKey]) {
                mealsData[dayKey] = { date, breakfast: false, lunch: false, dinner: false };
            }
            mealsData[dayKey][mealType] = status;

            const statusText = status ? '✓ Marked' : '✗ Unmarked';
            const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
            showToast(`${mealName} ${statusText}`, 'success');
        } else {
            throw new Error('Failed to update');
        }
    } catch (error) {
        console.error('Error updating meal:', error);
        showToast('Failed to update meal status', 'error');
        // Revert toggle
        document.getElementById(`${mealType}-toggle`).checked = !status;
    }
}

// Close User Panel
function closeUserPanel() {
    userSection.style.display = 'none';
    currentUser = null;
    mealsData = {};
    manualInput.value = '';
    scanStatus.textContent = '';
    scanStatus.className = 'scan-status';
}

// Show Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
