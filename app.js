/**
 * app.js
 * Main orchestrator for the Resilient Noether Chess Game & AI Trainer.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. STATE & CONSTANTS
    // -------------------------------------------------------------
    let game = new Chess();
    let stockfish = null;
    let currentMode = 'play'; // 'play', 'opening', 'puzzle', 'analysis'
    let activeTrainer = null; // Holds OpeningTrainer or PuzzleTrainer instance
    
    let isFlipped = false; // false = White at bottom, true = Black at bottom
    let userColor = 'w'; // 'w' or 'b'
    let selectedSquare = null;
    let legalMovesForSelected = [];
    
    // Board Themes configuration
    let currentBoardTheme = 'emerald';
    let soundEnabled = true;
    let hintSquares = [];
    
    // Evaluation records for game review
    let positionEvals = { 'startpos': 0.0 }; // Maps FEN to eval score
    let moveRatings = []; // Maps move indices to ratings (Brilliant, Blunder, etc.)
    
    // Drag and Drop state
    let isDragging = false;
    let dragElement = null;
    let dragStartSquare = null;
    
    // Sound synthesis context
    let audioCtx = null;

    // Standard Chessboard.js hosted piece images (stable and resolves globally)
    const PIECE_IMAGES = {};
    ['w', 'b'].forEach(color => {
        ['p', 'r', 'n', 'b', 'q', 'k'].forEach(type => {
            const code = color + type;
            PIECE_IMAGES[code] = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}${type.toUpperCase()}.png`;
        });
    });

    // -------------------------------------------------------------
    // 2. DOM ELEMENTS
    // -------------------------------------------------------------
    const chessboardEl = document.getElementById('chessboard');
    const evalBarFillEl = document.getElementById('eval-bar-fill');
    const evalBarTextEl = document.getElementById('eval-bar-text');
    const gameAlertsEl = document.getElementById('game-alerts');
    
    const opponentNameEl = document.getElementById('opponent-name-display');
    const opponentTurnDot = document.getElementById('opponent-turn-indicator');
    const userTurnDot = document.getElementById('user-turn-indicator');
    
    // Tab links & panes
    const tabs = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Buttons
    const flipBtn = document.getElementById('flip-board-btn');
    const takebackBtn = document.getElementById('takeback-btn');
    const hintBtn = document.getElementById('hint-btn');
    const resignBtn = document.getElementById('resign-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    
    // CPU Game controls
    const sfLevelSelect = document.getElementById('stockfish-level');
    const playColorBtns = document.querySelectorAll('.radio-btn[data-color]');
    const moveHistoryEl = document.getElementById('move-history-list');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const moveFeedbackPanel = document.getElementById('move-feedback-panel');
    const feedbackBadgeEl = document.getElementById('feedback-badge-type');
    const feedbackDescEl = document.getElementById('feedback-badge-desc');
    
    // Opening Trainer controls
    const openingSelector = document.getElementById('opening-selector');
    const openingGuidePanel = document.getElementById('opening-guide-panel');
    const openingTitleEl = document.getElementById('opening-title');
    const openingEcoEl = document.getElementById('opening-eco');
    const openingDescEl = document.getElementById('opening-desc');
    const openingMovesList = document.getElementById('opening-moves-list');
    const openingInstructionBox = document.getElementById('opening-instruction-box');
    const resetOpeningBtn = document.getElementById('reset-opening-btn');
    
    // Puzzles controls
    const puzzleStreakEl = document.getElementById('puzzle-streak');
    const puzzleListContainer = document.getElementById('puzzle-list-container');
    const puzzleActivePanel = document.getElementById('puzzle-active-panel');
    const puzzleThemeEl = document.getElementById('puzzle-theme');
    const puzzleDifficultyEl = document.getElementById('puzzle-difficulty');
    const puzzlePromptText = document.getElementById('puzzle-prompt-text');
    const puzzleStatusMessage = document.getElementById('puzzle-status-message');
    const restartPuzzleBtn = document.getElementById('restart-puzzle-btn');
    const showPuzzleSolutionBtn = document.getElementById('show-puzzle-solution-btn');
    
    // Analysis controls
    const engineStatusText = document.getElementById('engine-status-text');
    const engineDepthText = document.getElementById('engine-depth-text');
    const suggestedLinesEl = document.getElementById('suggested-lines');
    
    // Settings Drawer elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsDrawer = document.getElementById('settings-drawer');
    const settingsOverlay = document.getElementById('settings-overlay');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const themeOptions = document.querySelectorAll('.theme-option');
    const soundToggle = document.getElementById('sound-toggle');
    const sfMaxDepthSlider = document.getElementById('sf-max-depth');
    const sfDepthValText = document.getElementById('sf-depth-val');
    const sfMaxTimeSlider = document.getElementById('sf-max-time');
    const sfTimeValText = document.getElementById('sf-time-val');
    
    // General Theme Switcher
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const moonIcon = document.querySelector('.moon-icon');
    const sunIcon = document.querySelector('.sun-icon');
    
    // Puzzle solving streaks
    let puzzleStreak = 0;

    // -------------------------------------------------------------
    // 3. SOUND SYNTHESIZER
    // -------------------------------------------------------------
    function playSound(type) {
        if (!soundEnabled) return;
        
        try {
            // Lazy load AudioContext due to browser auto-play policies
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            
            const dest = audioCtx.destination;
            
            if (type === 'move') {
                // Short, low wood-like thud
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.08);
                
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
                
                osc.connect(gain);
                gain.connect(dest);
                
                osc.start();
                osc.stop(audioCtx.currentTime + 0.08);
                
            } else if (type === 'capture') {
                // Slightly higher, sharper snap
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.1);
                
                // Add a bandpass filter to give noise texture
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1000;
                
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(dest);
                
                osc.start();
                osc.stop(audioCtx.currentTime + 0.1);
                
            } else if (type === 'check') {
                // High double-tone chime
                const osc1 = audioCtx.createOscillator();
                const osc2 = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc1.type = 'sine';
                osc2.type = 'sine';
                
                osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.06); // A5
                
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(dest);
                
                osc1.start();
                osc1.stop(audioCtx.currentTime + 0.3);
                osc2.start(audioCtx.currentTime + 0.06);
                osc2.stop(audioCtx.currentTime + 0.3);
                
            } else if (type === 'game-over') {
                // Beautiful synthesized major chord resolution
                const now = audioCtx.currentTime;
                const freqs = [261.63, 329.63, 392.00, 523.25]; // C major
                
                freqs.forEach((f, i) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + i * 0.05);
                    
                    gain.gain.setValueAtTime(0.08, now + i * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                    
                    osc.connect(gain);
                    gain.connect(dest);
                    
                    osc.start(now + i * 0.05);
                    osc.stop(now + 1.2);
                });
            }
        } catch (e) {
            console.warn("AudioContext playback failed: ", e);
        }
    }

    // -------------------------------------------------------------
    // 4. STOCKFISH CLIENT CONFIG & HANDLERS
    // -------------------------------------------------------------
    const stockfishCallbacks = {
        onReady: () => {
            console.log("Stockfish Engine Ready.");
            opponentNameEl.textContent = `Stockfish (Level ${sfLevelSelect.value})`;
            engineStatusText.textContent = "Ready";
            engineStatusText.className = "stat-value text-success";
            
            // Trigger evaluation on start position
            triggerBackgroundAnalysis();
        },
        onBestMove: (moveUCI) => {
            // Move received from Stockfish in CPU mode
            if (currentMode === 'play' && game.turn() !== userColor) {
                // Parse UCI coordinates e.g., 'e2e4' to chess.js move format
                const from = moveUCI.slice(0, 2);
                const to = moveUCI.slice(2, 4);
                const promotion = moveUCI.length > 4 ? moveUCI[4] : undefined;
                
                const moveResult = game.move({ from, to, promotion });
                if (moveResult) {
                    highlightPrevMove(from, to);
                    playSound(game.in_check() ? 'check' : (moveResult.captured ? 'capture' : 'move'));
                    
                    // Evaluate new position in background
                    triggerBackgroundAnalysis();
                    
                    // Render board
                    renderBoard();
                    updateStatusIndicators();
                    updateMoveHistoryLog();
                }
            }
        },
        onEvaluation: (score, type, depth) => {
            // Update evaluation bar fill & text
            let displayVal = "0.0";
            let fillPct = 50;
            
            if (type === 'cp') {
                // Normalize display score
                const prefix = score >= 0 ? '+' : '';
                displayVal = prefix + score.toFixed(1);
                
                // Map score (-6 to +6 pawns) to bar height percentiles (10% to 90%)
                const clamped = Math.max(-6, Math.min(6, score));
                fillPct = 50 + (clamped / 6) * 40;
            } else if (type === 'mate') {
                // Mate in N moves
                displayVal = 'M' + Math.abs(score);
                fillPct = score > 0 ? 95 : 5;
            }
            
            evalBarFillEl.style.height = `${fillPct}%`;
            evalBarTextEl.textContent = displayVal;
            
            // Record evaluation for current FEN
            positionEvals[game.fen()] = score;
            
            // If checking review ratings, compile them
            reviewLastMoveEvaluation(score);
        },
        onInfo: (info) => {
            // Parse info updates for analysis dashboard
            engineDepthText.textContent = `${info.depth} / ${sfMaxDepthSlider.value}`;
            
            if (info.pv && info.pv.length > 0) {
                engineStatusText.textContent = "Analyzing";
                engineStatusText.className = "stat-value text-accent";
                
                // Format lines into SAN
                const tempGame = new Chess(game.fen());
                const formattedMoves = [];
                
                for (let i = 0; i < Math.min(6, info.pv.length); i++) {
                    const uci = info.pv[i];
                    const from = uci.slice(0, 2);
                    const to = uci.slice(2, 4);
                    const promo = uci.length > 4 ? uci[4] : undefined;
                    
                    // Try playing simulated moves
                    const testMove = tempGame.move({ from, to, promotion: promo });
                    if (testMove) {
                        const moveStr = (tempGame.turn() === 'w' ? `${tempGame.history().length / 2 + 0.5}. ` : '') + testMove.san;
                        // Format nicely with move count numbers
                        if (tempGame.turn() === 'w') {
                            // After black's move, we incremented turn
                            const num = Math.floor(tempGame.history().length / 2);
                            formattedMoves.push(`${num}... ${testMove.san}`);
                        } else {
                            const num = Math.floor(tempGame.history().length / 2) + 1;
                            formattedMoves.push(`${num}. ${testMove.san}`);
                        }
                    } else {
                        break;
                    }
                }
                
                // Render inside Analysis Panel
                if (formattedMoves.length > 0) {
                    const scorePrefix = info.score >= 0 ? '+' : '';
                    const evalText = info.type === 'mate' ? `M${Math.abs(info.score)}` : `${scorePrefix}${info.score?.toFixed(2)}`;
                    
                    suggestedLinesEl.innerHTML = `
                        <div class="suggested-line">
                            <div class="line-header">
                                <span class="line-depth">Depth ${info.depth}</span>
                                <span class="line-eval">${evalText}</span>
                            </div>
                            <div class="line-moves">${formattedMoves.join(' ')}</div>
                        </div>
                    `;
                }
            }
        }
    };

    // -------------------------------------------------------------
    // 5. ENGINE TRIGGERS
    // -------------------------------------------------------------
    function triggerBackgroundAnalysis() {
        if (!stockfish) return;
        
        engineStatusText.textContent = "Thinking...";
        
        // Evaluate position
        const currentFen = game.fen();
        const maxDepth = parseInt(sfMaxDepthSlider.value, 10);
        stockfish.startEvaluation(currentFen, maxDepth);
    }

    function makeCPUMove() {
        if (!stockfish || game.game_over()) return;
        
        opponentTurnDot.className = "turn-dot active";
        userTurnDot.className = "turn-dot";
        opponentNameEl.textContent = "Stockfish is thinking...";
        
        setTimeout(() => {
            const level = parseInt(sfLevelSelect.value, 10);
            stockfish.calculateBestMove(game.fen(), level);
        }, 300);
    }

    // -------------------------------------------------------------
    // 6. CHESS BOARD RENDERER
    // -------------------------------------------------------------
    function renderBoard() {
        chessboardEl.innerHTML = '';
        
        // Coordinates arrays matching board orientations
        const ranks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
        const files = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        
        // Update coordinate markers
        updateCoordinates(ranks, files);
        
        // Parse current board array
        const board = game.board();
        
        for (let r = 0; r < 8; r++) {
            const rankNum = ranks[r];
            
            for (let f = 0; f < 8; f++) {
                const fileLetter = files[f];
                const squareName = fileLetter + rankNum;
                
                // Get corresponding piece object from chess.js
                // chess.js board index logic: standard coords from top-left (a8 is rank 0, file 0)
                const rankIdx = 8 - rankNum;
                const fileIdx = fileLetter.charCodeAt(0) - 'a'.charCodeAt(0);
                const piece = board[rankIdx][fileIdx];
                
                const squareEl = document.createElement('div');
                squareEl.className = `square ${(r + f) % 2 === 0 ? 'light' : 'dark'}`;
                squareEl.dataset.square = squareName;
                
                // Add click listener for click-to-move
                squareEl.addEventListener('click', onSquareClick);
                
                // Overlay Highlights
                if (squareName === selectedSquare) {
                    squareEl.classList.add('selected');
                }
                
                if (hintSquares.includes(squareName)) {
                    squareEl.classList.add('hint');
                }
                
                // Highlight last played move squares
                if (lastMoveHighlight.from === squareName || lastMoveHighlight.to === squareName) {
                    squareEl.classList.add('highlight-prev');
                }
                
                // Highlight Checked King
                if (piece && piece.type === 'k' && piece.color === game.turn() && game.in_check()) {
                    squareEl.classList.add('check');
                }
                
                // Render Dots for Legal Moves
                if (legalMovesForSelected.includes(squareName)) {
                    squareEl.classList.add('legal-move');
                    if (piece) {
                        squareEl.classList.add('has-piece');
                    }
                }
                
                // Render Piece element
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece`;
                    
                    const code = piece.color + piece.type; // e.g. 'wp', 'bp'
                    pieceEl.style.backgroundImage = `url('${PIECE_IMAGES[code]}')`;
                    pieceEl.dataset.piece = code;
                    pieceEl.dataset.square = squareName;
                    
                    // Setup pointer drag event listeners
                    pieceEl.addEventListener('pointerdown', onPointerDown);
                    
                    squareEl.appendChild(pieceEl);
                }
                
                chessboardEl.appendChild(squareEl);
            }
        }
    }

    function updateCoordinates(ranks, files) {
        const topRow = document.querySelector('.top-coords');
        const bottomRow = document.querySelector('.bottom-coords');
        const leftCol = document.querySelector('.left-coords');
        const rightCol = document.querySelector('.right-coords');
        
        topRow.innerHTML = files.map(f => `<span>${f}</span>`).join('');
        bottomRow.innerHTML = files.map(f => `<span>${f}</span>`).join('');
        leftCol.innerHTML = ranks.map(r => `<span>${r}</span>`).join('');
        rightCol.innerHTML = ranks.map(r => `<span>${r}</span>`).join('');
    }

    let lastMoveHighlight = { from: '', to: '' };
    function highlightPrevMove(from, to) {
        lastMoveHighlight = { from, to };
    }

    // -------------------------------------------------------------
    // 7. DRAG-AND-DROP ENGINE (POINTER EVENTS)
    // -------------------------------------------------------------
    let dragStartPos = { x: 0, y: 0 };
    let dragOffset = { x: 0, y: 0 };
    
    function onSquareClick(e) {
        // Prevent click events if a drag operation was in progress
        if (isDragging) return;
        
        const squareName = e.currentTarget.dataset.square;
        
        if (currentMode === 'opening' && activeTrainer && activeTrainer.state !== 'white-to-move') return;
        if (currentMode === 'play' && game.turn() !== userColor) return;
        if (game.game_over() && currentMode === 'play') return;
        
        // If clicking a highlighted legal move square, execute click-to-move!
        if (selectedSquare && legalMovesForSelected.includes(squareName)) {
            let promotion = undefined;
            const startPiece = game.get(selectedSquare);
            if (startPiece && startPiece.type === 'p') {
                const targetRank = squareName[1];
                if ((startPiece.color === 'w' && targetRank === '8') || (startPiece.color === 'b' && targetRank === '1')) {
                    promotion = 'q';
                }
            }
            
            executeGameMove(selectedSquare, squareName, promotion);
            
            selectedSquare = null;
            legalMovesForSelected = [];
            hintSquares = [];
            renderBoard();
            return;
        }
        
        const piece = game.get(squareName);
        const activeColor = currentMode === 'play' ? userColor : game.turn();
        
        // If clicking our own piece, let onPointerDown handle selection/deselection
        if (piece && piece.color === activeColor) {
            return;
        }
        
        // Clicked an empty square or opponent's piece that is not a legal move -> clear selection
        selectedSquare = null;
        legalMovesForSelected = [];
        hintSquares = [];
        renderBoard();
    }
    
    function onPointerDown(e) {
        // Prevent default actions e.g., browser image dragging
        e.preventDefault();
        
        if (currentMode === 'opening' && activeTrainer && activeTrainer.state !== 'white-to-move') return;
        if (currentMode === 'play' && game.turn() !== userColor) return;
        if (game.game_over() && currentMode === 'play') return;
        
        const pieceEl = e.currentTarget;
        const square = pieceEl.dataset.square;
        const pieceCode = pieceEl.dataset.piece;
        
        // Ensure user only moves their own pieces
        const expectedColor = currentMode === 'play' ? userColor : game.turn();
        if (pieceCode[0] !== expectedColor) return;
        
        // Track whether this piece was already selected before the pointer went down
        const wasSelected = (selectedSquare === square);
        pieceEl.dataset.wasSelected = wasSelected ? "true" : "false";
        
        isDragging = true;
        dragElement = pieceEl;
        dragStartSquare = square;
        selectedSquare = square;
        
        // Get legal moves list
        const moves = game.moves({ square: square, verbose: true });
        legalMovesForSelected = moves.map(m => m.to);
        
        // Add styling for dragging
        dragElement.style.zIndex = '1000';
        dragElement.style.position = 'absolute';
        dragElement.style.pointerEvents = 'none';
        
        const rect = dragElement.getBoundingClientRect();
        const parentRect = chessboardEl.getBoundingClientRect();
        
        // Calculate offsets relative to chessboard area
        dragStartPos = {
            x: rect.left - parentRect.left,
            y: rect.top - parentRect.top
        };
        
        dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Place piece absolutely inside container
        dragElement.style.left = `${e.clientX - parentRect.left - dragOffset.x}px`;
        dragElement.style.top = `${e.clientY - parentRect.top - dragOffset.y}px`;
        dragElement.style.width = `${rect.width}px`;
        dragElement.style.height = `${rect.height}px`;
        
        // Render legal moves dots
        renderBoard();
        
        // Global listeners for dragging movement
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging || !dragElement) return;
        
        const parentRect = chessboardEl.getBoundingClientRect();
        let x = e.clientX - parentRect.left - dragOffset.x;
        let y = e.clientY - parentRect.top - dragOffset.y;
        
        dragElement.style.left = `${x}px`;
        dragElement.style.top = `${y}px`;
    }

    function onPointerUp(e) {
        if (!isDragging || !dragElement) return;
        
        isDragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        
        // Find square under release position
        const parentRect = chessboardEl.getBoundingClientRect();
        const x = e.clientX - parentRect.left;
        const y = e.clientY - parentRect.top;
        
        // Check grid coordinates mathematically
        const boardWidth = parentRect.width;
        const boardHeight = parentRect.height;
        
        const col = Math.floor((x / boardWidth) * 8);
        const row = Math.floor((y / boardHeight) * 8);
        
        let targetSquare = null;
        
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
            const ranks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
            const files = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            
            targetSquare = files[col] + ranks[row];
        }
        
        let validMoveExecuted = false;
        
        if (targetSquare && legalMovesForSelected.includes(targetSquare)) {
            // Check for Pawn Promotion
            let promotion = undefined;
            const pieceCode = dragElement.dataset.piece;
            
            if (pieceCode[1] === 'p') {
                const targetRank = targetSquare[1];
                if ((pieceCode[0] === 'w' && targetRank === '8') || (pieceCode[0] === 'b' && targetRank === '1')) {
                    // Force auto-queen promotion for simplicity in trainer interface
                    promotion = 'q';
                }
            }
            
            // Execute move via Rules Engine
            executeGameMove(dragStartSquare, targetSquare, promotion);
            validMoveExecuted = true;
        }
        
        // Reset selections & drag states
        selectedSquare = null;
        legalMovesForSelected = [];
        hintSquares = [];
        
        if (!validMoveExecuted) {
            // Reset piece layout styles
            dragElement.style.position = '';
            dragElement.style.zIndex = '';
            dragElement.style.left = '';
            dragElement.style.top = '';
            dragElement.style.width = '';
            dragElement.style.height = '';
            dragElement.style.pointerEvents = '';
            
            // If released on the same square (no drag), toggle selection
            if (targetSquare === dragStartSquare || !targetSquare) {
                if (dragElement.dataset.wasSelected === "true") {
                    selectedSquare = null;
                    legalMovesForSelected = [];
                } else {
                    selectedSquare = dragStartSquare;
                    const moves = game.moves({ square: dragStartSquare, verbose: true });
                    legalMovesForSelected = moves.map(m => m.to);
                }
            } else {
                // Dragged to an invalid square
                selectedSquare = null;
                legalMovesForSelected = [];
            }
            
            renderBoard();
        }
        
        dragElement = null;
    }

    // -------------------------------------------------------------
    // 8. GAME ACTIONS EXECUTION
    // -------------------------------------------------------------
    function executeGameMove(from, to, promotion) {
        // Record previous FEN eval to calculate move review differential
        const prevFen = game.fen();
        const prevEval = positionEvals[prevFen] || 0.0;
        
        // Attempt executing move
        const moveResult = game.move({ from, to, promotion });
        if (!moveResult) return;
        
        highlightPrevMove(from, to);
        playSound(game.in_check() ? 'check' : (moveResult.captured ? 'capture' : 'move'));
        
        const nextFen = game.fen();
        
        // Handle Trainer quiz states
        if (currentMode === 'opening' && activeTrainer) {
            // Verify move
            const san = moveResult.san;
            const wasCorrect = activeTrainer.verifyMove(san);
            if (!wasCorrect) {
                // Undo incorrect moves in opening trainer
                game.undo();
                renderBoard();
                return;
            }
        } else if (currentMode === 'puzzle' && activeTrainer) {
            // Verify move
            const san = moveResult.san;
            const wasCorrect = activeTrainer.verifyMove(san);
            if (!wasCorrect) {
                // Undo incorrect puzzle move
                game.undo();
                renderBoard();
                return;
            }
        } else {
            // Default play / analysis mode
            updateMoveHistoryLog();
            updateStatusIndicators();
            
            // Queue Background Analysis
            triggerBackgroundAnalysis();
            
            // If CPU's turn, trigger CPU move
            if (currentMode === 'play' && game.turn() !== userColor) {
                makeCPUMove();
            }
        }
        
        renderBoard();
    }

    // Move classification system
    function reviewLastMoveEvaluation(newEval) {
        // Only classify moves in play or analysis modes
        if (currentMode !== 'play' && currentMode !== 'analysis') return;
        
        const history = game.history({ verbose: true });
        if (history.length === 0) return;
        
        const lastMove = history[history.length - 1];
        const moveIndex = history.length - 1;
        
        // Prevent double classifying
        if (moveRatings[moveIndex]) return;
        
        // Obtain previous position evaluation
        const historyList = game.history();
        let prevFen = 'startpos';
        if (history.length > 1) {
            // Clone game to get FEN at N-1
            const temp = new Chess();
            for (let i = 0; i < historyList.length - 1; i++) {
                temp.move(historyList[i]);
            }
            prevFen = temp.fen();
        }
        
        const initialEval = positionEvals[prevFen] || 0.0;
        
        // Delta from user's perspective
        // If it was white's move, we want higher scores.
        // If it was black's move, we want lower scores (so we multiply delta by -1).
        const colorMoved = lastMove.color;
        const delta = colorMoved === 'w' ? (newEval - initialEval) : (initialEval - newEval);
        
        let classification = 'good';
        let descText = '';
        
        if (delta >= 0.0) {
            if (delta > 1.0) {
                classification = 'brilliant';
                descText = `Outstanding! The move ${lastMove.san} turned the game evaluations in your favor by +${delta.toFixed(1)} pawns.`;
            } else {
                classification = 'best';
                descText = `Great move! ${lastMove.san} is the top engine recommendation.`;
            }
        } else {
            // Negative delta (errors)
            const absD = Math.abs(delta);
            if (absD < 0.25) {
                classification = 'excellent';
                descText = `Solid play. ${lastMove.san} maintains a strong position.`;
            } else if (absD >= 0.25 && absD < 0.6) {
                classification = 'good';
                descText = `${lastMove.san} is a fine, playable move.`;
            } else if (absD >= 0.6 && absD < 1.2) {
                classification = 'inaccuracy';
                descText = `Inaccuracy. ${lastMove.san} decreases your pressure. Better was to focus on developments.`;
            } else if (absD >= 1.2 && absD < 2.2) {
                classification = 'mistake';
                descText = `Mistake! ${lastMove.san} drops control. Evaluation fell by ${absD.toFixed(1)} pawns.`;
            } else {
                classification = 'blunder';
                descText = `Blunder! ${lastMove.san} compromises the position. Black/White has major tactics now.`;
            }
        }
        
        // Save move classification
        moveRatings[moveIndex] = {
            san: lastMove.san,
            class: classification,
            desc: descText
        };
        
        // Render rating badge under Move Analysis card
        if (colorMoved === userColor) {
            moveFeedbackPanel.classList.remove('hidden');
            feedbackBadgeEl.textContent = classification;
            feedbackBadgeEl.className = `feedback-badge ${classification}`;
            feedbackDescEl.textContent = descText;
        }
        
        // Refresh Move History Log to show icons/badges alongside moves
        updateMoveHistoryLog();
    }

    // -------------------------------------------------------------
    // 9. STATUS & INTERFACE DECORATIONS
    // -------------------------------------------------------------
    function updateStatusIndicators() {
        if (game.game_over()) {
            opponentTurnDot.className = "turn-dot";
            userTurnDot.className = "turn-dot";
            
            let status = "Game Over.";
            if (game.in_checkmate()) {
                const winner = game.turn() === 'w' ? 'Black' : 'White';
                status = `Checkmate! ${winner} wins.`;
            } else if (game.in_draw()) {
                status = "Game drawn (Stalemate / 50-move / Repetition).";
            }
            
            gameAlertsEl.textContent = status;
            playSound('game-over');
            return;
        }
        
        // Regular turns
        const turn = game.turn();
        if (turn === 'w') {
            userTurnDot.className = userColor === 'w' ? "turn-dot active" : "turn-dot";
            opponentTurnDot.className = userColor === 'b' ? "turn-dot active" : "turn-dot";
            gameAlertsEl.textContent = "White to move.";
        } else {
            userTurnDot.className = userColor === 'b' ? "turn-dot active" : "turn-dot";
            opponentTurnDot.className = userColor === 'w' ? "turn-dot active" : "turn-dot";
            gameAlertsEl.textContent = "Black to move.";
        }
        
        if (game.in_check()) {
            gameAlertsEl.textContent += " [Check!]";
        }
        
        opponentNameEl.textContent = `Stockfish (Level ${sfLevelSelect.value})`;
    }

    function updateMoveHistoryLog() {
        moveHistoryEl.innerHTML = '';
        const history = game.history();
        
        if (history.length === 0) {
            moveHistoryEl.innerHTML = '<div class="empty-state">No moves played yet. Start the game!</div>';
            return;
        }
        
        // Generate list of moves: 1. e4 e5 ...
        let rowHtml = '';
        for (let i = 0; i < history.length; i += 2) {
            const turnNum = Math.floor(i / 2) + 1;
            const whiteMove = history[i];
            const blackMove = history[i + 1] || '';
            
            // Look up classifications
            const wRating = moveRatings[i];
            const bRating = moveRatings[i + 1];
            
            const wBadge = wRating ? getMiniBadgeMarkup(wRating.class) : '';
            const bBadge = bRating ? getMiniBadgeMarkup(bRating.class) : '';
            
            moveHistoryEl.innerHTML += `
                <div class="history-turn">
                    <span class="turn-num">${turnNum}.</span>
                    <span class="move-link" data-index="${i}">${whiteMove} ${wBadge}</span>
                </div>
                <div class="history-turn">
                    ${blackMove ? `<span class="move-link" data-index="${i+1}">${blackMove} ${bBadge}</span>` : ''}
                </div>
            `;
        }
        
        // Scroll list to bottom
        moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
        
        // Attach click listeners to historical moves
        document.querySelectorAll('.move-link').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index, 10);
                showHistoricalBoardState(idx);
            });
        });
    }

    function getMiniBadgeMarkup(ratingClass) {
        const icons = {
            'brilliant': '👑',
            'best': '⭐',
            'excellent': '✅',
            'good': '✔️',
            'inaccuracy': '⚠️',
            'mistake': '❓',
            'blunder': '❌'
        };
        return `<span class="mini-badge ${ratingClass}" title="${ratingClass}">${icons[ratingClass] || ''}</span>`;
    }

    function showHistoricalBoardState(moveIndex) {
        // Rewind game state to historical index
        const temp = new Chess();
        const history = game.history();
        
        for (let i = 0; i <= moveIndex; i++) {
            temp.move(history[i]);
        }
        
        // Update chessboard display with historical positions without modifying current game progress
        // Render custom board using temp rules state
        const board = temp.board();
        chessboardEl.innerHTML = '';
        const ranks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
        const files = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const squareName = files[f] + ranks[r];
                const rankIdx = 8 - ranks[r];
                const fileIdx = files[f].charCodeAt(0) - 'a'.charCodeAt(0);
                const piece = board[rankIdx][fileIdx];
                
                const squareEl = document.createElement('div');
                squareEl.className = `square ${(r + f) % 2 === 0 ? 'light' : 'dark'}`;
                squareEl.dataset.square = squareName;
                
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece`;
                    pieceEl.style.backgroundImage = `url('${PIECE_IMAGES[piece.color + piece.type]}')`;
                    squareEl.appendChild(pieceEl);
                }
                
                chessboardEl.appendChild(squareEl);
            }
        }
        
        // Highlight active historical move
        document.querySelectorAll('.move-link').forEach(el => el.classList.remove('active-move'));
        const activeLink = document.querySelector(`.move-link[data-index="${moveIndex}"]`);
        if (activeLink) activeLink.classList.add('active-move');
        
        gameAlertsEl.textContent = `Viewing move ${moveIndex + 1}. Click 'Undo' or play a move to return to live game.`;
    }

    // -------------------------------------------------------------
    // 10. TABS NAVIGATION & MODE SWITCHES
    // -------------------------------------------------------------
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetId = e.target.dataset.tab;
            
            // Switch tabs styling
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            // Mode changes
            if (targetId === 'pane-cpu') {
                currentMode = 'play';
                resetGameToMode('play');
            } else if (targetId === 'pane-openings') {
                currentMode = 'opening';
                initOpeningTrainerMode();
            } else if (targetId === 'pane-puzzles') {
                currentMode = 'puzzle';
                initPuzzleTrainerMode();
            } else if (targetId === 'pane-analysis') {
                currentMode = 'analysis';
                resetGameToMode('analysis');
            }
        });
    });

    function resetGameToMode(mode) {
        game = new Chess();
        selectedSquare = null;
        legalMovesForSelected = [];
        hintSquares = [];
        lastMoveHighlight = { from: '', to: '' };
        moveRatings = [];
        moveFeedbackPanel.classList.add('hidden');
        
        if (mode === 'play') {
            // Determine colors
            const chosen = document.querySelector('.radio-btn.active[data-color]').dataset.color;
            if (chosen === 'random') {
                userColor = Math.random() < 0.5 ? 'w' : 'b';
            } else {
                userColor = chosen === 'white' ? 'w' : 'b';
            }
            
            isFlipped = userColor === 'b'; // Auto-orient
            
            updateStatusIndicators();
            updateMoveHistoryLog();
            
            if (userColor === 'b') {
                // Stockfish plays first
                makeCPUMove();
            }
        } else {
            // Analysis mode
            userColor = 'w';
            isFlipped = false;
            updateStatusIndicators();
            updateMoveHistoryLog();
            triggerBackgroundAnalysis();
        }
        
        renderBoard();
    }

    // -------------------------------------------------------------
    // 11. OPENINGS MODULE CONTROLLER
    // -------------------------------------------------------------
    function initOpeningTrainerMode() {
        // Load openings dropdown
        openingSelector.innerHTML = '<option value="" disabled selected>-- Choose an opening --</option>';
        OPENINGS_DATABASE.forEach(op => {
            openingSelector.innerHTML += `<option value="${op.id}">${op.name} (${op.eco})</option>`;
        });
        
        openingGuidePanel.classList.add('hidden');
        gameAlertsEl.textContent = "Select an opening from the list to begin.";
        
        game = new Chess();
        isFlipped = false; // Stay white
        selectedSquare = null;
        legalMovesForSelected = [];
        renderBoard();
    }

    openingSelector.addEventListener('change', () => {
        const id = openingSelector.value;
        startOpeningQuiz(id);
    });

    function startOpeningQuiz(id) {
        game = new Chess();
        isFlipped = false;
        selectedSquare = null;
        legalMovesForSelected = [];
        hintSquares = [];
        lastMoveHighlight = { from: '', to: '' };
        
        activeTrainer = new OpeningTrainer(
            id,
            // onMove callback
            (moveData) => {
                if (moveData.color === 'b') {
                    // Opponent move needs to be played by the engine
                    const res = game.move(moveData.san);
                    if (res) {
                        highlightPrevMove(res.from, res.to);
                        playSound(res.captured ? 'capture' : 'move');
                        renderOpeningChecklist();
                        openingInstructionBox.innerHTML = activeTrainer.getCurrentStepText();
                        renderBoard();
                    }
                } else {
                    // White move is already played by user drag, just update checklists & UI
                    renderOpeningChecklist();
                    if (activeTrainer.state === 'completed') {
                        openingInstructionBox.innerHTML = `<strong>Success!</strong> Quiz completed. You've learned the ${activeTrainer.opening.name}!`;
                        playSound('game-over');
                    } else {
                        openingInstructionBox.innerHTML = activeTrainer.getCurrentStepText();
                    }
                    renderBoard();
                }
            },
            // onComplete
            () => {
                gameAlertsEl.textContent = "Opening tutorial completed successfully!";
            },
            // onError
            (tipText) => {
                openingInstructionBox.innerHTML = `<span class="text-danger">❌ Incorrect.</span> ${tipText}`;
                playSound('capture'); // sharp buzzer sound substitute
            }
        );
        
        // Show guide panel details
        openingGuidePanel.classList.remove('hidden');
        openingTitleEl.textContent = activeTrainer.opening.name;
        openingEcoEl.textContent = activeTrainer.opening.eco;
        openingDescEl.textContent = activeTrainer.opening.description;
        
        renderOpeningChecklist();
        openingInstructionBox.innerHTML = activeTrainer.getCurrentStepText();
        
        renderBoard();
    }

    function renderOpeningChecklist() {
        openingMovesList.innerHTML = '';
        
        activeTrainer.opening.moves.forEach((turnObj, idx) => {
            const turnNum = idx + 1;
            const wDone = activeTrainer.currentTurn > turnNum || (activeTrainer.currentTurn === turnNum && activeTrainer.state !== 'white-to-move');
            const bDone = activeTrainer.currentTurn > turnNum;
            
            openingMovesList.innerHTML += `
                <li class="checklist-item ${wDone ? 'done' : ''}">
                    <input type="checkbox" ${wDone ? 'checked' : ''} disabled>
                    <span>${turnNum}. ${turnObj.white}</span>
                </li>
                ${turnObj.black ? `
                <li class="checklist-item ${bDone ? 'done' : ''}">
                    <input type="checkbox" ${bDone ? 'checked' : ''} disabled>
                    <span>${turnNum}... ${turnObj.black}</span>
                </li>
                ` : ''}
            `;
        });
    }

    resetOpeningBtn.addEventListener('click', () => {
        if (openingSelector.value) {
            startOpeningQuiz(openingSelector.value);
        }
    });

    // -------------------------------------------------------------
    // 12. PUZZLES MODULE CONTROLLER
    // -------------------------------------------------------------
    function initPuzzleTrainerMode() {
        puzzleActivePanel.classList.add('hidden');
        gameAlertsEl.textContent = "Choose a tactics puzzle from the list to test your skills.";
        
        // Populate puzzle selector cards
        puzzleListContainer.innerHTML = '';
        PUZZLES_DATABASE.forEach((puz, idx) => {
            const card = document.createElement('div');
            card.className = `puzzle-card`;
            card.dataset.id = puz.id;
            card.innerHTML = `Puzzle ${idx + 1}<br><span style="font-size:9px;color:var(--text-muted); font-weight:normal">${puz.difficulty}</span>`;
            
            card.addEventListener('click', () => {
                document.querySelectorAll('.puzzle-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                startPuzzleQuiz(puz.id);
            });
            
            puzzleListContainer.appendChild(card);
        });
        
        // Clean board
        game = new Chess();
        renderBoard();
    }

    function startPuzzleQuiz(id) {
        const puzzleObj = PUZZLES_DATABASE.find(p => p.id === id);
        game = new Chess(puzzleObj.fen);
        
        // Orient board according to active color in setup
        const activeColor = puzzleObj.fen.split(' ')[1]; // 'w' or 'b'
        isFlipped = activeColor === 'b';
        
        selectedSquare = null;
        legalMovesForSelected = [];
        hintSquares = [];
        lastMoveHighlight = { from: '', to: '' };
        
        activeTrainer = new PuzzleTrainer(
            id,
            // onCorrect
            (correctMove, step, source) => {
                if (source === 'computer') {
                    const res = game.move(correctMove);
                    if (res) {
                        highlightPrevMove(res.from, res.to);
                        playSound(res.captured ? 'capture' : 'move');
                        puzzleStatusMessage.textContent = "Correct! Keep going...";
                        puzzleStatusMessage.className = "puzzle-status-message correct";
                        renderBoard();
                    }
                } else {
                    // User's move is already played, just play check/move sounds
                    playSound(game.in_check() ? 'check' : 'move');
                    puzzleStatusMessage.textContent = "Correct! Keep going...";
                    puzzleStatusMessage.className = "puzzle-status-message correct";
                    
                    // Reset selected highlights
                    selectedSquare = null;
                    legalMovesForSelected = [];
                    hintSquares = [];
                    renderBoard();
                }
            },
            // onWrong
            (hintText) => {
                puzzleStatusMessage.textContent = "Incorrect move. Try again!";
                puzzleStatusMessage.className = "puzzle-status-message incorrect";
                playSound('capture');
            },
            // onComplete
            () => {
                puzzleStatusMessage.textContent = "🎉 Solved! Excellent work.";
                puzzleStatusMessage.className = "puzzle-status-message correct";
                playSound('game-over');
                
                // Increment streak
                puzzleStreak++;
                puzzleStreakEl.textContent = puzzleStreak;
                
                // Color card solved
                const card = document.querySelector(`.puzzle-card[data-id="${id}"]`);
                if (card) card.classList.add('solved');
            }
        );
        
        puzzleActivePanel.classList.remove('hidden');
        puzzleThemeEl.textContent = puzzleObj.theme;
        puzzleDifficultyEl.textContent = puzzleObj.difficulty;
        puzzlePromptText.textContent = puzzleObj.instructions;
        puzzleStatusMessage.textContent = "Make your move...";
        puzzleStatusMessage.className = "puzzle-status-message";
        
        renderBoard();
        updateStatusIndicators();
    }

    restartPuzzleBtn.addEventListener('click', () => {
        if (activeTrainer && currentMode === 'puzzle') {
            startPuzzleQuiz(activeTrainer.puzzle.id);
        }
    });

    showPuzzleSolutionBtn.addEventListener('click', () => {
        if (activeTrainer && currentMode === 'puzzle') {
            const sol = activeTrainer.puzzle.moves[activeTrainer.step];
            if (sol) {
                // Highlight solution square hints
                const temp = new Chess(game.fen());
                const res = temp.move(sol);
                if (res) {
                    hintSquares = [res.from, res.to];
                    renderBoard();
                    puzzleStatusMessage.textContent = `Hint: Play from ${res.from} to ${res.to}`;
                }
            }
        }
    });

    // -------------------------------------------------------------
    // 13. SETTINGS & DRAWER INTERACTIONS
    // -------------------------------------------------------------
    settingsBtn.addEventListener('click', () => {
        settingsDrawer.classList.add('open');
    });

    closeSettingsBtn.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', closeSettings);
    
    function closeSettings() {
        settingsDrawer.classList.remove('open');
    }

    // Switch board color themes
    themeOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            themeOptions.forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            
            const theme = btn.dataset.boardTheme;
            chessboardEl.className = `chessboard ${theme}-theme`;
            currentBoardTheme = theme;
        });
    });

    soundToggle.addEventListener('change', () => {
        soundEnabled = soundToggle.checked;
    });

    sfMaxDepthSlider.addEventListener('input', () => {
        sfDepthValText.textContent = sfMaxDepthSlider.value;
    });

    sfMaxTimeSlider.addEventListener('input', () => {
        sfTimeValText.textContent = `${(sfMaxTimeSlider.value / 1000).toFixed(1)}s`;
    });

    // Dark/Light layout mode toggles
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        
        if (isLight) {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    });

    // -------------------------------------------------------------
    // 14. BOTTOM BOARD ACTIONS HANDLERS
    // -------------------------------------------------------------
    flipBtn.addEventListener('click', () => {
        isFlipped = !isFlipped;
        renderBoard();
    });

    takebackBtn.addEventListener('click', () => {
        if (currentMode === 'play') {
            // Undo user move AND Stockfish's move
            if (game.history().length >= 2) {
                game.undo();
                game.undo();
            } else if (game.history().length === 1 && userColor === 'w') {
                game.undo();
            }
            
            // Clear current classifications
            moveRatings.pop();
            moveRatings.pop();
            moveFeedbackPanel.classList.add('hidden');
            
            updateStatusIndicators();
            updateMoveHistoryLog();
            triggerBackgroundAnalysis();
            renderBoard();
        } else if (currentMode === 'analysis') {
            game.undo();
            moveRatings.pop();
            updateStatusIndicators();
            updateMoveHistoryLog();
            triggerBackgroundAnalysis();
            renderBoard();
        }
    });

    hintBtn.addEventListener('click', () => {
        if (!stockfish || game.game_over()) return;
        
        engineStatusText.textContent = "Calculating hint...";
        
        // Temporarily ask Stockfish for best move at current FEN
        const tempClient = new StockfishClient({
            onReady: () => {},
            onBestMove: (moveUCI) => {
                const from = moveUCI.slice(0, 2);
                const to = moveUCI.slice(2, 4);
                
                // Highlight squares
                hintSquares = [from, to];
                renderBoard();
                
                tempClient.terminate();
            }
        });
        
        tempClient.calculateBestMove(game.fen(), 8); // Max GM strength calculation
    });

    resignBtn.addEventListener('click', () => {
        if (currentMode === 'play' && !game.game_over()) {
            gameAlertsEl.textContent = "You resigned. Stockfish wins!";
            playSound('game-over');
            
            opponentTurnDot.className = "turn-dot";
            userTurnDot.className = "turn-dot";
            
            // Set game-over flag in rules
            // chess.js 0.10.3 doesn't have an explicit set_game_over, but we can load a dummy fen or simply mark it.
            // We can load a checkmated FEN to force game_over state if we want, or just manage it in UI variables.
            // Let's load a mate FEN to force game_over rules so clicks are blocked:
            game.load('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'); // Fool's Mate
            updateStatusIndicators();
        }
    });

    newGameBtn.addEventListener('click', () => {
        if (currentMode === 'play') {
            resetGameToMode('play');
        } else if (currentMode === 'analysis') {
            resetGameToMode('analysis');
        } else if (currentMode === 'opening' && openingSelector.value) {
            startOpeningQuiz(openingSelector.value);
        } else if (currentMode === 'puzzle' && activeTrainer) {
            startPuzzleQuiz(activeTrainer.puzzle.id);
        }
    });

    clearLogBtn.addEventListener('click', () => {
        resetGameToMode(currentMode === 'analysis' ? 'analysis' : 'play');
    });

    playColorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            playColorBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            resetGameToMode('play');
        });
    });

    sfLevelSelect.addEventListener('change', () => {
        opponentNameEl.textContent = `Stockfish (Level ${sfLevelSelect.value})`;
        resetGameToMode('play');
    });

    // -------------------------------------------------------------
    // 15. SYSTEM STARTUP
    // -------------------------------------------------------------
    // Spawns persistent Stockfish Client for evaluations
    stockfish = new StockfishClient(stockfishCallbacks);
    
    // Initial board paint
    resetGameToMode('play');
});
