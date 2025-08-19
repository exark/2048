// Game State
let grid = [];
let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
let gameOver = false;
let gridSize = 4;
let isAnimating = false;
let newTiles = new Set(); // track tiles added this turn for appear animation

// Debug overlay (enable with ?debug=1 or #debug)
const DEBUG = /[?#&]debug(=1)?\b/i.test(location.search + location.hash);
let debugEl = null;
function ensureDebugEl() {
    if (!DEBUG) return null;
    if (!debugEl) {
        debugEl = document.createElement('div');
        debugEl.id = 'debug-overlay';
        Object.assign(debugEl.style, {
            position: 'fixed',
            bottom: '8px',
            left: '8px',
            right: '8px',
            maxHeight: '40%',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            background: 'rgba(2,6,23,0.8)',
            color: '#22d3ee',
            border: '1px solid rgba(168,85,247,0.6)',
            borderRadius: '6px',
            padding: '6px 8px',
            zIndex: 9999
        });
        document.body.appendChild(debugEl);
    }
    return debugEl;
}
function debugLog(msg) {
    if (!DEBUG) return;
    const el = ensureDebugEl();
    if (!el) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.textContent = `[${time}] ${msg}`;
    el.appendChild(line);
    // Trim lines
    while (el.childNodes.length > 20) el.removeChild(el.firstChild);
}

// DOM Elements
const gridContainer = document.querySelector('.grid-container');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('best-score');
const newGameButton = document.getElementById('new-game');
const tryAgainButton = document.getElementById('try-again');
const gameOverElement = document.getElementById('game-over');

// Initialize the game
function initGame() {
    // Initialize the grid
    grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    score = 0;
    gameOver = false;
    updateScore();
    
    // Clear the grid container
    gridContainer.innerHTML = '';
    
    // Create the grid cells
    for (let i = 0; i < gridSize * gridSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        gridContainer.appendChild(cell);
    }
    
    // Add initial tiles
    addRandomTile();
    addRandomTile();
    renderTiles();
    
    // Hide game over screen
    gameOverElement.style.display = 'none';
    
    // Set up event listeners if not already set
    setupEventListeners();
}

// Add a random tile (2 or 4) to an empty cell
function addRandomTile() {
    const emptyCells = [];
    
    // Find all empty cells
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (grid[row][col] === 0) {
                emptyCells.push({ row, col });
            }
        }
    }
    
    debugLog(`addRandomTile: empty=${emptyCells.length}`);
    // If there are empty cells, add a new tile
    if (emptyCells.length > 0) {
        const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const val = Math.random() < 0.9 ? 2 : 4;
        grid[row][col] = val;
        newTiles.add(`${row}-${col}`);
        debugLog(`added tile ${val} at ${row},${col}`);
    }
}

// Create a tile element
function createTile(row, col, value, isNew = false, isMerged = false) {
    const tile = document.createElement('div');
    const position = getPositionFromRowCol(row, col);
    const tileSize = getTileSize();
    
    tile.className = `tile tile-${value}`;
    if (isNew) tile.classList.add('tile-new');
    if (isMerged) tile.classList.add('tile-merged');
    
    tile.textContent = value;
    tile.style.left = `${position.x}px`;
    tile.style.top = `${position.y}px`;
    tile.style.width = `${tileSize}px`;
    tile.style.height = `${tileSize}px`;
    
    // Ensure tiles are above overlay effects
    tile.style.zIndex = 100; // keep above .game-container::before/::after
    
    // Add data attributes for tracking position and value
    tile.dataset.row = row;
    tile.dataset.col = col;
    tile.dataset.value = value;
    
    gridContainer.appendChild(tile);
    return tile;
}

// Get pixel position from grid coordinates
function getPositionFromRowCol(row, col) {
    const gap = getGap();
    const size = getTileSize();
    return {
        x: col * (size + gap),
        y: row * (size + gap)
    };
}

// Get numeric gap (px) from CSS grid gap
function getGap() {
    const style = getComputedStyle(gridContainer);
    const gap = parseFloat(style.gap || style.gridGap || style.columnGap || '15');
    return isNaN(gap) ? 15 : gap;
}

// Compute tile size so tiles align with the placeholders
function getTileSize() {
    const gap = getGap();
    // Prefer precise layout width
    let width = gridContainer.getBoundingClientRect().width || gridContainer.clientWidth;
    
    // Fallback to parent container if needed
    if (!width || width <= 0) {
        const parent = document.querySelector('.game-container');
        if (parent) {
            const rect = parent.getBoundingClientRect();
            const cs = getComputedStyle(parent);
            const pl = parseFloat(cs.paddingLeft) || 0;
            const pr = parseFloat(cs.paddingRight) || 0;
            width = rect.width - pl - pr;
        }
    }
    if (!width || width <= 0) width = 300; // last-resort fallback
    
    const totalGaps = gap * (gridSize - 1);
    const size = Math.max(10, Math.floor((width - totalGaps) / gridSize));
    debugLog(`sizes: container=${Math.round(width)} gap=${gap} tileSize=${size}`);
    return size;
}

// Update the score display
function updateScore() {
    scoreElement.textContent = score;
    
    // Update best score if current score is higher
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
    }
    
    bestScoreElement.textContent = bestScore;
}

// Handle keyboard input
function handleKeyDown(e) {
    if (gameOver) return;
    
    let moved = false;
    
    switch (e.key) {
        case 'ArrowUp':
            moved = moveTiles('up');
            break;
        case 'ArrowDown':
            moved = moveTiles('down');
            break;
        case 'ArrowLeft':
            moved = moveTiles('left');
            break;
        case 'ArrowRight':
            moved = moveTiles('right');
            break;
        default:
            return; // Ignore other keys
    }
    
    // If tiles moved, add a new tile and check for game over
    if (moved) {
        addRandomTile();
        renderTiles();
        if (!hasValidMoves()) {
            endGame();
        }
    }
}

// Move tiles in the specified direction
function moveTiles(direction) {
    debugLog(`moveTiles dir=${direction}`);
    let moved = false;
    const newGrid = JSON.parse(JSON.stringify(grid));
    
    // Process the grid based on direction
    for (let i = 0; i < gridSize; i++) {
        let row = [];
        
        // Extract the row or column to process
        for (let j = 0; j < gridSize; j++) {
            if (direction === 'left') row.push(grid[i][j]);
            else if (direction === 'right') row.push(grid[i][gridSize - 1 - j]);
            else if (direction === 'up') row.push(grid[j][i]);
            else if (direction === 'down') row.push(grid[gridSize - 1 - j][i]);
        }
        
        // Merge tiles
        const { mergedRow, scoreIncrease } = mergeTiles(row);
        score += scoreIncrease;
        
        // Update the grid based on direction
        for (let j = 0; j < gridSize; j++) {
            let value = mergedRow[j] || 0;
            
            if (direction === 'left') {
                if (grid[i][j] !== value) moved = true;
                newGrid[i][j] = value;
            } else if (direction === 'right') {
                if (grid[i][gridSize - 1 - j] !== value) moved = true;
                newGrid[i][gridSize - 1 - j] = value;
            } else if (direction === 'up') {
                if (grid[j][i] !== value) moved = true;
                newGrid[j][i] = value;
            } else if (direction === 'down') {
                if (grid[gridSize - 1 - j][i] !== value) moved = true;
                newGrid[gridSize - 1 - j][i] = value;
            }
        }
    }
    
    // Update the grid and animate the move if tiles moved
    if (moved) {
        grid = newGrid;
        updateScore();
        renderTiles();
    }
    const count = newGrid.flat().filter(v => v !== 0).length;
    debugLog(`moveTiles result moved=${moved} nonzeros=${count}`);
    return moved;
}

// Merge tiles in a row/column
function mergeTiles(row) {
    // Remove zeros
    let nonZeros = row.filter(cell => cell !== 0);
    let merged = [];
    let scoreIncrease = 0;
    
    // Merge adjacent equal numbers
    for (let i = 0; i < nonZeros.length; i++) {
        if (i < nonZeros.length - 1 && nonZeros[i] === nonZeros[i + 1]) {
            const mergedValue = nonZeros[i] * 2;
            merged.push(mergedValue);
            scoreIncrease += mergedValue;
            i++; // Skip the next tile as it's merged
        } else {
            merged.push(nonZeros[i]);
        }
    }
    
    // Pad with zeros
    while (merged.length < gridSize) {
        merged.push(0);
    }
    
    return { mergedRow: merged, scoreIncrease };
}

// Render all tiles from the grid state
function renderTiles() {
    // Remove existing tiles
    document.querySelectorAll('.tile').forEach(t => t.remove());
    
    // Create tiles for current grid
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const value = grid[row][col];
            if (value !== 0) {
                const isNew = newTiles.has(`${row}-${col}`);
                createTile(row, col, value, isNew);
            }
        }
    }
    // Clear new tiles tracker after rendering
    newTiles.clear();
    const nonZero = grid.flat().filter(v => v !== 0).length;
    debugLog(`rendered tiles: ${nonZero}`);
}

// Check if there are any valid moves left
function hasValidMoves() {
    // Check for any empty cells
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (grid[row][col] === 0) {
                return true;
            }
        }
    }
    
    // Check for possible merges
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const value = grid[row][col];
            
            // Check right neighbor
            if (col < gridSize - 1 && grid[row][col + 1] === value) {
                return true;
            }
            
            // Check bottom neighbor
            if (row < gridSize - 1 && grid[row + 1][col] === value) {
                return true;
            }
        }
    }
    
    return false;
}

// End the game
function endGame() {
    gameOver = true;
    gameOverElement.style.display = 'flex';
}

// Set up event listeners
function setupEventListeners() {
    // Keyboard controls
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
    
    // Touch controls
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    const gameContainer = document.querySelector('.game-container');
    const minSwipeDistance = 30; // Minimum distance to consider it a swipe
    let inputLocked = false; // prevent double-processing

    // Central swipe processor used by both Touch and Pointer events
    function processSwipe(dx, dy) {
        if (inputLocked) return;
        let moved = false;
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe
            if (Math.abs(dx) > minSwipeDistance) {
                const dir = dx > 0 ? 'right' : 'left';
                moved = moveTiles(dir);
                debugLog(`swipe ${dir} dx=${Math.round(dx)} moved=${moved}`);
            }
        } else {
            // Vertical swipe
            if (Math.abs(dy) > minSwipeDistance) {
                const dir = dy > 0 ? 'down' : 'up';
                moved = moveTiles(dir);
                debugLog(`swipe ${dir} dy=${Math.round(dy)} moved=${moved}`);
            }
        }
        if (moved) {
            inputLocked = true;
            addRandomTile();
            renderTiles();
            if (!hasValidMoves()) {
                endGame();
            }
            // small delay to avoid handling multi-events for one gesture
            setTimeout(() => { inputLocked = false; }, 120);
        }
    }
    
    if (window.PointerEvent) {
        // Prefer Pointer Events on modern mobile browsers
        let pStartX = 0, pStartY = 0;
        gameContainer.addEventListener('pointerdown', e => {
            if (gameOver) return;
            if (e.pointerType !== 'touch') return; // only handle touch pointers
            pStartX = e.clientX;
            pStartY = e.clientY;
            try { gameContainer.setPointerCapture(e.pointerId); } catch {}
            debugLog(`pointerdown x=${Math.round(pStartX)} y=${Math.round(pStartY)}`);
        }, { passive: true });
        gameContainer.addEventListener('pointerup', e => {
            if (gameOver) return;
            if (e.pointerType !== 'touch') return;
            const dx = e.clientX - pStartX;
            const dy = e.clientY - pStartY;
            try { gameContainer.releasePointerCapture(e.pointerId); } catch {}
            processSwipe(dx, dy);
        }, { passive: true });
        gameContainer.addEventListener('pointercancel', e => {
            if (e.pointerType !== 'touch') return;
            try { gameContainer.releasePointerCapture(e.pointerId); } catch {}
            // allow next gesture
            inputLocked = false;
            debugLog('pointercancel');
        });
        gameContainer.addEventListener('lostpointercapture', e => {
            if (e.pointerType !== 'touch') return;
            debugLog('lostpointercapture');
        });
    } else {
        // Fallback to Touch Events
        gameContainer.addEventListener('touchstart', e => {
            if (gameOver) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            debugLog(`touchstart x=${Math.round(touchStartX)} y=${Math.round(touchStartY)}`);
        }, { passive: true });
        
        gameContainer.addEventListener('touchend', e => {
            if (gameOver) return;
            touchEndX = e.changedTouches[0].clientX;
            touchEndY = e.changedTouches[0].clientY;
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            processSwipe(dx, dy);
        }, { passive: true });
        
        // Prevent page scrolling during swipe gestures while playing
        gameContainer.addEventListener('touchmove', e => {
            if (!gameOver) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // New game buttons
    newGameButton.addEventListener('click', initGame);
    tryAgainButton.addEventListener('click', initGame);
    // Prevent long-press context menu from interfering
    gameContainer.addEventListener('contextmenu', e => e.preventDefault());
}

// Start the game when the page loads
window.addEventListener('load', () => {
    // Set the best score from localStorage
    bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
    bestScoreElement.textContent = bestScore;
    
    // Initialize the game
    initGame();

    // Re-render on resize/orientation changes so tiles stay aligned
    let resizeRaf;
    window.addEventListener('resize', () => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            renderTiles();
        });
    });
});
