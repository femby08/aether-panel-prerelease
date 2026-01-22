/* ============================================================
   LIQUID GLASS ALERT SYSTEM
   Apple-style modal alerts for Aether Panel
   ============================================================ */

/**
 * Show an Apple-style Liquid Glass alert dialog
 * @param {Object} options - Configuration object
 * @param {string} options.icon - FontAwesome icon class (e.g., 'fa-solid fa-arrow-up')
 * @param {string} options.title - Alert title
 * @param {string} options.description - Alert message
 * @param {string} options.primaryText - Primary button text (default: 'OK')
 * @param {Function} options.onPrimary - Primary button callback
 * @param {string} options.secondaryText - Secondary button text (optional)
 * @param {Function} options.onSecondary - Secondary button callback
 * @param {boolean} options.danger - If true, primary button is red (destructive)
 */
function showLiquidAlert(options) {
    const {
        icon = 'fa-solid fa-circle-info',
        title = 'Alert',
        description = '',
        primaryText = 'OK',
        onPrimary = null,
        secondaryText = null,
        onSecondary = null,
        danger = false
    } = options;

    // Remove existing alert if any
    const existing = document.querySelector('.lg-alert-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'lg-alert-overlay';
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (onSecondary) onSecondary();
        }
    };

    // Create alert box
    const alert = document.createElement('div');
    alert.className = 'lg-alert';
    alert.onclick = (e) => e.stopPropagation();

    // Build HTML
    alert.innerHTML = `
        <div class="lg-alert-icon">
            <i class="${icon}"></i>
        </div>
        <div class="lg-alert-title">${title}</div>
        <div class="lg-alert-description">${description}</div>
        <div class="lg-alert-actions">
            ${secondaryText ? `<button class="lg-alert-btn secondary">${secondaryText}</button>` : ''}
            <button class="lg-alert-btn ${danger ? 'danger' : 'primary'}">${primaryText}</button>
        </div>
    `;

    overlay.appendChild(alert);
    document.body.appendChild(overlay);

    // Bind button events
    const primaryBtn = alert.querySelector('.lg-alert-btn.primary, .lg-alert-btn.danger');
    const secondaryBtn = alert.querySelector('.lg-alert-btn.secondary');

    if (primaryBtn) {
        primaryBtn.onclick = () => {
            overlay.remove();
            if (onPrimary) onPrimary();
        };
    }

    if (secondaryBtn) {
        secondaryBtn.onclick = () => {
            overlay.remove();
            if (onSecondary) onSecondary();
        };
    }

    // Return close function
    return () => overlay.remove();
}

/**
 * Helper for update prompts
 */
function showUpdateAlert(type, version, onUpdate) {
    const isUI = type === 'ui';
    showLiquidAlert({
        icon: isUI ? 'fa-solid fa-paintbrush' : 'fa-solid fa-server',
        title: 'Update Available', // Simplified title
        description: `There's a new version available (${version})`, // Specific text per user
        primaryText: 'Update',
        secondaryText: 'Later',
        danger: false, // We'll handle colors via explicit classes/CSS
        onPrimary: onUpdate,
        onSecondary: () => { }
    });

    // Hack to add specific classes after creation (since the helper doesn't support custom classes yet)
    // Ideally we'd update showLiquidAlert to accept buttonClasses, but this is quicker for now without breaking other alerts
    setTimeout(() => {
        const overlay = document.querySelector('.lg-alert-overlay:last-child');
        if (overlay) {
            const primary = overlay.querySelector('.lg-alert-btn.primary');
            const secondary = overlay.querySelector('.lg-alert-btn.secondary');
            if (primary) primary.classList.add('lg-btn-green');
            if (secondary) secondary.classList.add('lg-btn-red');
        }
    }, 10);
}


/**
 * Helper for confirmation dialogs
 */
function showConfirmAlert(title, description, onConfirm, danger = false) {
    showLiquidAlert({
        icon: danger ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-question',
        title: title,
        description: description,
        primaryText: danger ? 'Delete' : 'Confirm',
        secondaryText: 'Cancel',
        danger: danger,
        onPrimary: onConfirm,
        onSecondary: () => { }
    });
}
