/* ============================================================
   APPLE HIG COMPONENTS - JavaScript Helpers
   Interactive functions for HIG component library
   ============================================================ */

// ==================== DISCLOSURE CONTROLS ====================
function toggleDisclosure(element) {
    const disclosure = element.closest('.lg-disclosure');
    if (disclosure) {
        disclosure.classList.toggle('open');
    }
}

// ==================== CONTEXT MENUS ====================
let activeContextMenu = null;

function showContextMenu(event, menuItems) {
    event.preventDefault();
    hideContextMenu();

    const menu = document.createElement('div');
    menu.className = 'lg-context-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';

    menuItems.forEach(item => {
        if (item.divider) {
            const divider = document.createElement('div');
            divider.className = 'lg-context-divider';
            menu.appendChild(divider);
        } else {
            const menuItem = document.createElement('div');
            menuItem.className = 'lg-context-item' + (item.danger ? ' danger' : '');
            menuItem.innerHTML = `
                ${item.icon ? `<i class="${item.icon}"></i>` : ''}
                <span>${item.label}</span>
            `;
            menuItem.onclick = () => {
                hideContextMenu();
                if (item.action) item.action();
            };
            menu.appendChild(menuItem);
        }
    });

    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (event.clientX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (event.clientY - rect.height) + 'px';
    }

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 10);
}

function hideContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }
}

// ==================== ACTION SHEETS ====================
let activeActionSheet = null;

function showActionSheet(options) {
    const {
        title = null,
        items = [],
        cancelText = 'Cancel',
        onCancel = null
    } = options;

    hideActionSheet();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'lg-action-sheet-overlay';
    overlay.onclick = () => hideActionSheet();

    // Create sheet
    const sheet = document.createElement('div');
    sheet.className = 'lg-action-sheet';

    // Title
    if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'lg-action-sheet-title';
        titleEl.textContent = title;
        sheet.appendChild(titleEl);
    }

    // Items
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'lg-action-sheet-item' + (item.danger ? ' danger' : '');
        itemEl.innerHTML = `
            ${item.icon ? `<i class="${item.icon}"></i>` : ''}
            <span>${item.label}</span>
        `;
        itemEl.onclick = () => {
            hideActionSheet();
            if (item.action) item.action();
        };
        sheet.appendChild(itemEl);
    });

    // Cancel button
    const cancelEl = document.createElement('div');
    cancelEl.className = 'lg-action-sheet-item lg-action-sheet-cancel';
    cancelEl.textContent = cancelText;
    cancelEl.onclick = () => {
        hideActionSheet();
        if (onCancel) onCancel();
    };
    sheet.appendChild(cancelEl);

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
    activeActionSheet = { overlay, sheet };
}

function hideActionSheet() {
    if (activeActionSheet) {
        activeActionSheet.overlay.remove();
        activeActionSheet.sheet.remove();
        activeActionSheet = null;
    }
}

// ==================== POPOVERS ====================
let activePopover = null;

function showPopover(targetElement, options) {
    const {
        title = null,
        content = '',
        position = 'bottom' // 'top', 'bottom', 'left', 'right'
    } = options;

    hidePopover();

    const popover = document.createElement('div');
    popover.className = 'lg-popover';

    let html = '';
    if (title) {
        html += `<div class="lg-popover-title">${title}</div>`;
    }
    html += `<div class="lg-popover-text">${content}</div>`;
    popover.innerHTML = html;

    document.body.appendChild(popover);

    // Position the popover
    const targetRect = targetElement.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    let top, left;
    switch (position) {
        case 'top':
            top = targetRect.top - popoverRect.height - 10;
            left = targetRect.left + (targetRect.width - popoverRect.width) / 2;
            break;
        case 'bottom':
        default:
            top = targetRect.bottom + 10;
            left = targetRect.left + (targetRect.width - popoverRect.width) / 2;
    }

    popover.style.top = top + 'px';
    popover.style.left = Math.max(10, left) + 'px';

    activePopover = popover;

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', (e) => {
            if (!popover.contains(e.target) && e.target !== targetElement) {
                hidePopover();
            }
        }, { once: true });
    }, 10);

    return popover;
}

function hidePopover() {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
    }
}

// ==================== POP-UP BUTTONS ====================
function initPopupButtons() {
    document.querySelectorAll('.lg-popup-btn').forEach(btn => {
        const wrapper = btn.parentElement;
        const menu = wrapper.querySelector('.lg-popup-menu');
        if (!menu) return;

        btn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = btn.classList.contains('open');

            // Close all other popups
            document.querySelectorAll('.lg-popup-btn.open').forEach(b => {
                b.classList.remove('open');
                const m = b.parentElement.querySelector('.lg-popup-menu');
                if (m) m.style.display = 'none';
            });

            if (!isOpen) {
                btn.classList.add('open');
                menu.style.display = 'block';
            }
        };

        menu.querySelectorAll('.lg-popup-option').forEach(option => {
            option.onclick = () => {
                // Update selected state
                menu.querySelectorAll('.lg-popup-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');

                // Update button text
                const textSpan = btn.querySelector('span');
                if (textSpan) {
                    textSpan.textContent = option.textContent;
                }

                // Close menu
                btn.classList.remove('open');
                menu.style.display = 'none';
            };
        });
    });

    // Close on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.lg-popup-btn.open').forEach(btn => {
            btn.classList.remove('open');
            const menu = btn.parentElement.querySelector('.lg-popup-menu');
            if (menu) menu.style.display = 'none';
        });
    });
}

// ==================== TOKEN FIELDS ====================
function initTokenFields() {
    document.querySelectorAll('.lg-token-field').forEach(field => {
        const input = field.querySelector('.lg-token-input');
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                addToken(field, input.value.trim());
                input.value = '';
                e.preventDefault();
            }
            if (e.key === 'Backspace' && !input.value) {
                const tokens = field.querySelectorAll('.lg-token');
                if (tokens.length > 0) {
                    tokens[tokens.length - 1].remove();
                }
            }
        });
    });
}

function addToken(field, text) {
    const token = document.createElement('div');
    token.className = 'lg-token';
    token.innerHTML = `
        <span>${text}</span>
        <span class="lg-token-remove" onclick="this.parentElement.remove()">×</span>
    `;
    const input = field.querySelector('.lg-token-input');
    field.insertBefore(token, input);
}

// ==================== STEPPERS ====================
function initSteppers() {
    document.querySelectorAll('.lg-stepper').forEach(stepper => {
        const minusBtn = stepper.querySelector('[data-stepper-minus]');
        const plusBtn = stepper.querySelector('[data-stepper-plus]');
        const valueEl = stepper.querySelector('.lg-stepper-value');

        if (!minusBtn || !plusBtn || !valueEl) return;

        const min = parseInt(stepper.dataset.min) || 0;
        const max = parseInt(stepper.dataset.max) || 100;
        const step = parseInt(stepper.dataset.step) || 1;

        minusBtn.onclick = () => {
            let val = parseInt(valueEl.textContent) - step;
            if (val < min) val = min;
            valueEl.textContent = val;
            updateStepperButtons(stepper, val, min, max);
        };

        plusBtn.onclick = () => {
            let val = parseInt(valueEl.textContent) + step;
            if (val > max) val = max;
            valueEl.textContent = val;
            updateStepperButtons(stepper, val, min, max);
        };
    });
}

function updateStepperButtons(stepper, val, min, max) {
    const minusBtn = stepper.querySelector('[data-stepper-minus]');
    const plusBtn = stepper.querySelector('[data-stepper-plus]');
    minusBtn.disabled = val <= min;
    plusBtn.disabled = val >= max;
}

// ==================== LIQUID GLASS CUSTOM SELECT ====================
// Converts native <select> elements into styled dropdowns
function initLiquidGlassSelects() {
    document.querySelectorAll('select.lg-select, select.cfg-in').forEach(select => {
        // Skip if already converted
        if (select.dataset.lgConverted) return;
        select.dataset.lgConverted = 'true';

        // Hide original select
        select.style.display = 'none';

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'lg-select-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';

        // Create trigger button
        const trigger = document.createElement('div');
        trigger.className = 'lg-select-trigger';

        // Copy initial value
        const selectedOption = select.options[select.selectedIndex];
        trigger.innerHTML = `
            <span class="lg-select-value">${selectedOption?.text || 'Select...'}</span>
            <span class="lg-select-chevron">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </span>
        `;

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'lg-select-dropdown';
        dropdown.style.display = 'none';

        // Populate options
        Array.from(select.options).forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'lg-select-option' + (index === select.selectedIndex ? ' selected' : '');
            item.dataset.value = option.value;
            item.textContent = option.text;

            item.onclick = () => {
                // Update native select
                select.value = option.value;
                select.dispatchEvent(new Event('change'));

                // Update trigger text
                trigger.querySelector('.lg-select-value').textContent = option.text;

                // Update selected state
                dropdown.querySelectorAll('.lg-select-option').forEach(o => o.classList.remove('selected'));
                item.classList.add('selected');

                // Close dropdown
                closeDropdown();
            };

            dropdown.appendChild(item);
        });

        // Toggle dropdown
        trigger.onclick = (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');

            // Close all other dropdowns
            document.querySelectorAll('.lg-select-wrapper.open').forEach(w => {
                w.classList.remove('open');
                w.querySelector('.lg-select-dropdown').style.display = 'none';
            });

            if (!isOpen) {
                wrapper.classList.add('open');
                dropdown.style.display = 'block';
            }
        };

        function closeDropdown() {
            wrapper.classList.remove('open');
            dropdown.style.display = 'none';
        }

        // Insert elements
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(trigger);
        wrapper.appendChild(dropdown);
        wrapper.appendChild(select);
    });

    // Close on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.lg-select-wrapper.open').forEach(w => {
            w.classList.remove('open');
            w.querySelector('.lg-select-dropdown').style.display = 'none';
        });
    });
}

// ==================== APPLE HIG PHYSICS TOGGLES ====================
// Converts <input type="checkbox"> into physics-based toggles
function initAppleToggles() {
    // Target ALL checkboxes that are not already converted and not explicitly excluded
    document.querySelectorAll('input[type="checkbox"]:not(.no-physics)').forEach(input => {
        if (input.dataset.lgInit || input.style.display === 'none') return;
        input.dataset.lgInit = 'true';

        // Add class if missing
        input.classList.add('toggle-input');

        let wrapper = input.parentElement;

        // If parent is a label, repurpose it as the wrapper
        if (wrapper.tagName === 'LABEL') {
            wrapper.classList.add('toggle-wrapper');
        } else {
            // Otherwise create a new wrapper
            const newWrapper = document.createElement('label');
            newWrapper.className = 'toggle-wrapper';
            input.parentNode.insertBefore(newWrapper, input);
            newWrapper.appendChild(input);
            wrapper = newWrapper;
        }

        // Create track and knob
        const track = document.createElement('div');
        track.className = 'toggle-track';
        track.innerHTML = '<div class="toggle-knob"></div>';

        // Append after input (inside the wrapper)
        input.insertAdjacentElement('afterend', track);
    });
}

// Converts Text Inputs with "true"/"false" values into Toggles
function initBooleanInputs() {
    const processInput = (input) => {
        if (input.dataset.lgBooleanInit || input.type === 'checkbox' || input.type === 'hidden') return;

        // Check value
        const val = input.value ? input.value.trim().toLowerCase() : '';
        if (val !== 'true' && val !== 'false') return;

        input.dataset.lgBooleanInit = 'true';
        input.style.display = 'none'; // Hide original text input

        // Create visual toggle
        const wrapper = document.createElement('label');
        wrapper.className = 'toggle-wrapper';
        wrapper.style.marginBottom = '0'; // Reset margin if any

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'toggle-input';
        checkbox.dataset.lgInit = 'true'; // IMPORTANT: Prevent double-init by initAppleToggles
        checkbox.checked = (val === 'true');

        // Sync logic: Toggle -> Input
        checkbox.addEventListener('change', () => {
            input.value = checkbox.checked ? 'true' : 'false';
            // Trigger events on original input so app logic picks it up
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const track = document.createElement('div');
        track.className = 'toggle-track';
        track.innerHTML = '<div class="toggle-knob"></div>';

        wrapper.appendChild(checkbox);
        wrapper.appendChild(track);

        input.parentNode.insertBefore(wrapper, input);
    };

    // Initial Scan
    document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"])').forEach(processInput);

    // Observe for new inputs (Dynamic Settings)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'INPUT') processInput(node);
                    else {
                        node.querySelectorAll('input').forEach(processInput);
                        if (node.querySelector('input[type="checkbox"]')) initAppleToggles();
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ==================== INITIALIZE ALL ====================
document.addEventListener('DOMContentLoaded', () => {
    initPopupButtons();
    initTokenFields();
    initSteppers();
    initLiquidGlassSelects();
    initAppleToggles(); // Conversion inicial
    initBooleanInputs(); // Start watching for boolean text inputs

    // Fallback: Re-scan periodically just in case
    setInterval(() => {
        initAppleToggles();
        initBooleanInputs();
    }, 1500);
});
