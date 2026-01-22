/* ============================================================
   LIQUID GLASS PHYSICS - Optional Enhancements
   GPU-optimized cursor tracking and light dynamics
   ============================================================ */

// Performance settings
const PHYSICS_CONFIG = {
    enabled: true,           // Master toggle
    cursorLight: false,      // Cursor-following light (GPU intensive, disabled by default)
    tiltEffect: false,       // 3D tilt on hover - DISABLED (confusing on cards)
    throttleMs: 50,          // Throttle cursor events (lower = smoother but more CPU)
    maxTiltDeg: 3            // Maximum tilt angle
};

// Throttle function to limit event frequency
function throttle(fn, wait) {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= wait) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
}

// Calculate tilt based on cursor position relative to element
function calculateTilt(element, clientX, clientY) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Get cursor offset from center, normalized to -1 to 1
    const offsetX = (clientX - centerX) / (rect.width / 2);
    const offsetY = (clientY - centerY) / (rect.height / 2);

    // Convert to tilt angles (invert Y for natural feel)
    const tiltX = -offsetY * PHYSICS_CONFIG.maxTiltDeg;
    const tiltY = offsetX * PHYSICS_CONFIG.maxTiltDeg;

    return { tiltX, tiltY };
}

// Apply tilt effect to elements with .lg-tilt class
function initTiltEffect() {
    if (!PHYSICS_CONFIG.enabled || !PHYSICS_CONFIG.tiltEffect) return;

    const tiltElements = document.querySelectorAll('.lg-tilt, .card');

    tiltElements.forEach(element => {
        // Skip if already initialized
        if (element.dataset.tiltInit) return;
        element.dataset.tiltInit = 'true';

        const handleMove = throttle((e) => {
            if (!PHYSICS_CONFIG.enabled) return;

            const { tiltX, tiltY } = calculateTilt(element, e.clientX, e.clientY);
            element.style.setProperty('--tilt-x', `${tiltX}deg`);
            element.style.setProperty('--tilt-y', `${tiltY}deg`);
            element.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        }, PHYSICS_CONFIG.throttleMs);

        const handleLeave = () => {
            element.style.setProperty('--tilt-x', '0deg');
            element.style.setProperty('--tilt-y', '0deg');
            element.style.transform = '';
        };

        element.addEventListener('mousemove', handleMove, { passive: true });
        element.addEventListener('mouseleave', handleLeave, { passive: true });
    });
}

// Optional: Cursor light effect (disabled by default for GPU conservation)
function initCursorLight() {
    if (!PHYSICS_CONFIG.enabled || !PHYSICS_CONFIG.cursorLight) return;

    // Create light overlay
    const light = document.createElement('div');
    light.id = 'lg-cursor-light';
    light.style.cssText = `
        position: fixed;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease;
        transform: translate(-50%, -50%);
        will-change: left, top;
    `;
    document.body.appendChild(light);

    // Track cursor
    const moveLight = throttle((e) => {
        light.style.left = e.clientX + 'px';
        light.style.top = e.clientY + 'px';
    }, PHYSICS_CONFIG.throttleMs);

    document.addEventListener('mousemove', moveLight, { passive: true });

    // Show/hide on glass elements
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('.glass, .card, .lg-glass')) {
            light.style.opacity = '1';
        }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget?.closest('.glass, .card, .lg-glass')) {
            light.style.opacity = '0';
        }
    }, { passive: true });
}

// Toggle physics on/off (call from console or UI)
window.togglePhysics = function (enabled) {
    PHYSICS_CONFIG.enabled = enabled !== undefined ? enabled : !PHYSICS_CONFIG.enabled;
    console.log(`[Liquid Glass] Physics ${PHYSICS_CONFIG.enabled ? 'enabled' : 'disabled'}`);

    // Reset transforms if disabled
    if (!PHYSICS_CONFIG.enabled) {
        document.querySelectorAll('[data-tilt-init]').forEach(el => {
            el.style.transform = '';
        });
    }

    return PHYSICS_CONFIG.enabled;
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init tilt by default (cursor light is disabled for GPU conservation)
    initTiltEffect();

    // Uncomment to enable cursor light (increases GPU usage)
    // initCursorLight();

    // Re-init when new elements appear (e.g., modals)
    const observer = new MutationObserver(throttle(() => {
        initTiltEffect();
    }, 500));

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    console.log('[Liquid Glass] Physics layer initialized (GPU-optimized)');
});
