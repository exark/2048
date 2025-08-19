// Game State
let grid = [];
let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
let gameOver = false;
let gridSize = 4;
let isAnimating = false;
let newTiles = new Set(); // track tiles added this turn for appear animation

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
    
    // If there are empty cells, add a new tile
    if (emptyCells.length > 0) {
        const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        grid[row][col] = Math.random() < 0.9 ? 2 : 4;
        newTiles.add(`${row}-${col}`);
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
    const containerWidth = gridContainer.clientWidth;
    // There are (gridSize - 1) gaps inside the grid
    const totalGaps = gap * (gridSize - 1);
    return Math.floor((containerWidth - totalGaps) / gridSize);
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
    
    gameContainer.addEventListener('touchstart', e => {
        if (gameOver) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    gameContainer.addEventListener('touchend', e => {
        if (gameOver) return;
        
        touchEndX = e.changedTouches[0].clientX;
        touchEndY = e.changedTouches[0].clientY;
        
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        const minSwipeDistance = 30; // Minimum distance to consider it a swipe
        
        // Determine the direction of the swipe
        let moved = false;
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe
            if (Math.abs(dx) > minSwipeDistance) {
                moved = dx > 0 ? moveTiles('right') : moveTiles('left');
            }
        } else {
            // Vertical swipe
            if (Math.abs(dy) > minSwipeDistance) {
                moved = dy > 0 ? moveTiles('down') : moveTiles('up');
            }
        }

        // If a move happened, follow-up like keyboard: add tile, render, check game over
        if (moved) {
            addRandomTile();
            renderTiles();
            if (!hasValidMoves()) {
                endGame();
            }
        }
    }, { passive: true });
    
    // Prevent scrolling when swiping on the game
    gameContainer.addEventListener('touchmove', e => {
        if (gameOver) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // New game buttons
    newGameButton.addEventListener('click', initGame);
    tryAgainButton.addEventListener('click', initGame);
}

// Start the game when the page loads
window.addEventListener('load', () => {
    // Set the best score from localStorage
    bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
    bestScoreElement.textContent = bestScore;
    
    // Initialize the game
    initGame();
});
