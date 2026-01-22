
// ==================== GLASS BLUR CUSTOMIZATION ====================

// Tick marks for snapping
const BLUR_TICKS = [0, 15, 30, 50];
const SNAP_THRESHOLD = 3; // Snap when within 3 units of a tick

// Update blur preview in real-time without notification
function updateBlurPreview(value) {
    let numValue = parseInt(value);
    
    // Snap to nearest tick mark if within threshold
    for (const tick of BLUR_TICKS) {
        if (Math.abs(numValue - tick) <= SNAP_THRESHOLD) {
            numValue = tick;
            break;
        }
    }
    
    // Update slider to snapped value
    const slider = document.getElementById('blur-slider');
    if (slider && parseInt(slider.value) !== numValue) {
        slider.value = numValue;
    }
    
    const blurValue = document.getElementById('blur-value');
    if (blurValue) blurValue.textContent = numValue + 'px';

    // Update CSS variable instantly
    document.documentElement.style.setProperty('--glass-blur', numValue + 'px');
}

// Save blur value and show notification (only when slider is released)
function updateBlur(value) {
    // Update display and CSS
    updateBlurPreview(value);
    
    // Save to localStorage
    localStorage.setItem('glassBlur', value);

    // Show feedback
    Toastify({
        text: `Desenfoque ajustado: ${value}px`,
        duration: 1500,
        style: { background: 'var(--p)' }
    }).showToast();
}


// Load saved blur on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedBlur = localStorage.getItem('glassBlur');
    if (savedBlur) {
        document.documentElement.style.setProperty('--glass-blur', savedBlur + 'px');
        const slider = document.getElementById('blur-slider');
        const blurValue = document.getElementById('blur-value');
        if (slider) slider.value = savedBlur;
        if (blurValue) blurValue.textContent = savedBlur + 'px';
    }
});
