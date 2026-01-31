// Avatar Editor Logic (Discord Style)
let editorCanvas, editorCtx;
let currentImage = null;
let imageState = { x: 0, y: 0, scale: 1, minScale: 1 };
let isDragging = false;
let startX, startY;
let editorCallback = null; // Function to call with the cropped blob
let editorModal = null;

// Config
const CANVAS_SIZE = 300;
const MASK_RADIUS = 150; // Half of canvas size

function initAvatarEditor() {
    editorModal = document.getElementById('avatar-editor-modal');
    editorCanvas = document.getElementById('avatar-editor-canvas');
    if (!editorCanvas) return;

    editorCtx = editorCanvas.getContext('2d');

    // Zoom Slider
    const zoomSlider = document.getElementById('avatar-zoom-slider');
    zoomSlider.addEventListener('input', (e) => {
        const zoomLevel = parseFloat(e.target.value);
        // Base scale is calculated to fit image, slider multiplies it
        const effectiveScale = imageState.minScale * zoomLevel;
        updateEditorState({ scale: effectiveScale });
    });

    // Mouse/Touch Events for Panning
    editorCanvas.addEventListener('mousedown', startDrag);
    editorCanvas.addEventListener('mousemove', drag);
    editorCanvas.addEventListener('mouseup', stopDrag);
    editorCanvas.addEventListener('mouseleave', stopDrag);

    // Touch support
    editorCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        startDrag(e.touches[0]);
    }, { passive: false });
    editorCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        drag(e.touches[0]);
    }, { passive: false });
    editorCanvas.addEventListener('touchend', stopDrag);
}

// Open Editor with a File
function openAvatarEditor(file, callback) {
    if (!editorModal) initAvatarEditor();
    editorCallback = callback;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            resetEditorState();
            editorModal.style.display = 'flex';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function closeAvatarEditor() {
    if (editorModal) editorModal.style.display = 'none';
    currentImage = null;
}

function resetEditorState() {
    if (!currentImage) return;

    // Calculate min scale to cover the canvas
    const scaleX = CANVAS_SIZE / currentImage.width;
    const scaleY = CANVAS_SIZE / currentImage.height;
    imageState.minScale = Math.max(scaleX, scaleY); // Cover strategy

    // Initial state: centered and minimized zoom
    imageState.scale = imageState.minScale;
    imageState.x = (CANVAS_SIZE - currentImage.width * imageState.scale) / 2;
    imageState.y = (CANVAS_SIZE - currentImage.height * imageState.scale) / 2;

    // Reset Slider
    document.getElementById('avatar-zoom-slider').value = 1;

    drawEditor();
}

function updateEditorState(newState) {
    if (!currentImage) return;

    // Apply changes
    Object.assign(imageState, newState);

    // Boundary Checks (Keep image within canvas bounds)
    // The image must always cover the entire canvas (since it's a cover crop)
    // Actually, discord allows some empty space but usually enforces cover.
    // Let's enforce that the circle is always filled. 
    // Since masking is circular, ensuring the square canvas is filled is enough.

    const imgWidth = currentImage.width * imageState.scale;
    const imgHeight = currentImage.height * imageState.scale;

    // Clamp X/Y
    // Max X is 0 (left edge at left edge of canvas)
    // Min X is CANVAS_SIZE - imgWidth (right edge at right edge of canvas)

    if (imgWidth >= CANVAS_SIZE) {
        if (imageState.x > 0) imageState.x = 0;
        if (imageState.x + imgWidth < CANVAS_SIZE) imageState.x = CANVAS_SIZE - imgWidth;
    } else {
        // Center if smaller (shouldn't happen with minScale logic but for safety)
        imageState.x = (CANVAS_SIZE - imgWidth) / 2;
    }

    if (imgHeight >= CANVAS_SIZE) {
        if (imageState.y > 0) imageState.y = 0;
        if (imageState.y + imgHeight < CANVAS_SIZE) imageState.y = CANVAS_SIZE - imgHeight;
    } else {
        imageState.y = (CANVAS_SIZE - imgHeight) / 2;
    }

    drawEditor();
}

function drawEditor() {
    if (!editorCtx || !currentImage) return;

    // Clear
    editorCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw Image
    editorCtx.drawImage(
        currentImage,
        imageState.x,
        imageState.y,
        currentImage.width * imageState.scale,
        currentImage.height * imageState.scale
    );

    // Overlay is handled by HTML to allow clicking through? 
    // No, we need to mask it visually or handled by the DIV overlay in HTML.
    // The HTML overlay handles the visual blackout outside the circle.
}

// Drag Logic
function startDrag(e) {
    if (!currentImage) return;
    isDragging = true;

    // Get mouse pos relative to canvas
    const rect = editorCanvas.getBoundingClientRect();
    // Support both mouse and touch objects
    const clientX = e.clientX || e.pageX;
    const clientY = e.clientY || e.pageY;

    startX = clientX - imageState.x;
    startY = clientY - imageState.y;
}

function drag(e) {
    if (!isDragging || !currentImage) return;

    const clientX = e.clientX || e.pageX;
    const clientY = e.clientY || e.pageY;

    const newX = clientX - startX;
    const newY = clientY - startY;

    updateEditorState({ x: newX, y: newY });
}

function stopDrag() {
    isDragging = false;
}

// Apply Logic
function applyAvatarCrop() {
    if (!currentImage || !editorCallback) return;

    // Create a new temporary canvas to draw the final cropped result at high res?
    // Or just use the screen resolution crop. 
    // Discord usually saves a square image, but we want the circular content to be centered.
    // We will save the square result of the canvas. The backend/frontend CSS handles masking.

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = 300; // Output size
    resultCanvas.height = 300;
    const resultCtx = resultCanvas.getContext('2d');

    // Draw the image exactly as viewed
    resultCtx.drawImage(
        currentImage,
        imageState.x,
        imageState.y,
        currentImage.width * imageState.scale,
        currentImage.height * imageState.scale
    );

    resultCanvas.toBlob((blob) => {
        editorCallback(blob);
        closeAvatarEditor();
    }, 'image/png');
}

// Expose to window
window.openAvatarEditor = openAvatarEditor;
window.closeAvatarEditor = closeAvatarEditor;
window.applyAvatarCrop = applyAvatarCrop;
window.initAvatarEditor = initAvatarEditor;
