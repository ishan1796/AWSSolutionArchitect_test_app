// Main Quiz Application Engine
class QuizEngine {
    constructor() {
        this.questions = [];
        this.currentIndex = 0;
        this.userAnswers = {};
        this.partId = null;
        this.timer = 0;
        this.timerInterval = null;
        this.selectedOptions = [];
        
        // Random and Review modes
        this.isRandomMode = false;
        this.isReviewMode = false;
        this.reviewIndexMap = []; // Map review indices back to main indices
    }

    init(partId) {
        this.partId = partId;
        this.loadSoundSettings();
        this.loadTheme();
        this.fetchQuizData();
        this.setupEventListeners();
        this.startTimer();
    }

    loadSoundSettings() {
        const soundBtn = document.getElementById('sound-toggle');
        if (soundBtn) {
            const label = SoundEffects.enabled ? '🔊 SOUND' : '🔇 MUTE';
            soundBtn.textContent = label;
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = savedTheme === 'dark' ? '⚡ CYBERPUNK' : '💡 LIGHT';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = newTheme === 'dark' ? '⚡ CYBERPUNK' : '💡 LIGHT';
        }
        SoundEffects.playClick();
    }

    toggleSound() {
        const enabled = SoundEffects.toggle();
        const soundBtn = document.getElementById('sound-toggle');
        if (soundBtn) {
            soundBtn.textContent = enabled ? '🔊 SOUND' : '🔇 MUTE';
        }
        SoundEffects.playClick();
    }

    fetchQuizData() {
        fetch(`/api/questions/${this.partId}`)
            .then(res => res.json())
            .then(data => {
                this.questions = data.questions;
                this.userAnswers = data.user_answers || {};
                
                if (this.questions.length === 0) {
                    this.showEmptyState();
                    return;
                }

                // Restore index from progress
                const savedQId = data.progress ? data.progress.current_question_id : -1;
                if (savedQId !== -1) {
                    const savedIdx = this.questions.findIndex(q => q.id === savedQId);
                    if (savedIdx !== -1) {
                        this.currentIndex = savedIdx;
                    }
                }

                this.renderSidebarMap();
                this.renderQuestion();
                this.updateStats(data.progress);
            })
            .catch(err => {
                console.error("Error fetching quiz data:", err);
            });
    }

    showEmptyState() {
        const mainCard = document.getElementById('quiz-card-content');
        if (mainCard) {
            mainCard.innerHTML = `
                <div class="empty-state" style="text-align:center; padding: 50px 20px;">
                    <div style="font-size: 4rem; margin-bottom: 20px; color: var(--neon-pink);">📂</div>
                    <h2>No Questions Found in Part ${this.partId}</h2>
                    <p style="color: var(--text-secondary); margin: 15px 0 25px 0;">Use the Bulk Import feature to upload your SAA-C03 questions.</p>
                    <a href="/" class="btn-primary">Back to Dashboard</a>
                </div>
            `;
        }
    }

    renderSidebarMap() {
        const mapGrid = document.getElementById('map-grid');
        if (!mapGrid) return;
        mapGrid.innerHTML = '';

        const activeList = this.isReviewMode ? this.reviewIndexMap.map(idx => this.questions[idx]) : this.questions;

        activeList.forEach((q, idx) => {
            const node = document.createElement('div');
            node.className = 'map-node';
            
            // Map actual index based on mode
            const actualIndex = this.isReviewMode ? this.reviewIndexMap[idx] : idx;
            
            node.textContent = q.id;
            node.setAttribute('data-id', q.id);
            node.setAttribute('data-idx', actualIndex);

            // Add status styling
            const ans = this.userAnswers[q.id];
            if (ans) {
                if (ans.selected_options) {
                    node.classList.add(ans.is_correct ? 'correct' : 'wrong');
                }
                if (ans.is_bookmarked) {
                    node.classList.add('bookmarked');
                }
            }

            if (actualIndex === this.currentIndex) {
                node.classList.add('active');
            }

            node.addEventListener('click', () => {
                SoundEffects.playClick();
                this.currentIndex = actualIndex;
                this.renderQuestion();
            });

            mapGrid.appendChild(node);
        });
    }

    renderQuestion() {
        if (this.questions.length === 0) return;
        
        const q = this.questions[this.currentIndex];
        this.selectedOptions = [];
        
        // Highlight active sidebar node
        document.querySelectorAll('.map-node').forEach(node => {
            node.classList.remove('active');
            if (parseInt(node.getAttribute('data-idx')) === this.currentIndex) {
                node.classList.add('active');
            }
        });

        // Set meta tags
        const tagsContainer = document.getElementById('meta-tags');
        if (tagsContainer) {
            tagsContainer.innerHTML = '';
            
            // Add Difficulty Tag
            const diffTag = document.createElement('span');
            diffTag.className = 'meta-tag difficulty';
            diffTag.textContent = q.difficulty || 'Medium';
            tagsContainer.appendChild(diffTag);

            // Add AWS Service Tags
            if (q.tags) {
                q.tags.split(',').forEach(tag => {
                    if (tag.strip) tag = tag.strip();
                    else tag = tag.trim();
                    if (tag) {
                        const t = document.createElement('span');
                        t.className = 'meta-tag';
                        t.textContent = tag;
                        tagsContainer.appendChild(t);
                    }
                });
            }
        }

        // Set question text and counter
        document.getElementById('question-number-title').textContent = `Question ${q.id}`;
        document.getElementById('question-body-text').textContent = q.question_text;

        // Render multiple choice options
        const optionsList = document.getElementById('options-list');
        optionsList.innerHTML = '';

        const ans = this.userAnswers[q.id];
        const isLocked = ans && ans.selected_options !== null;

        // Check if multiple choice (e.g. correct answer has commas: "A,B")
        const isMultiple = q.correct_answer.includes(',');

        q.options.forEach((opt, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            const item = document.createElement('div');
            item.className = 'option-item';
            item.setAttribute('data-letter', letter);

            item.innerHTML = `
                <div class="option-prefix">${letter}</div>
                <div class="option-text">${opt}</div>
            `;

            // Style previously saved answers
            if (isLocked) {
                const selectedList = JSON.parse(ans.selected_options || '[]');
                const correctList = q.correct_answer.split(',');
                
                if (selectedList.includes(letter)) {
                    item.classList.add('selected');
                }
                
                if (correctList.includes(letter)) {
                    item.classList.add('correct');
                } else if (selectedList.includes(letter)) {
                    item.classList.add('wrong');
                }
            } else {
                // Interactive listener if not answered/locked yet
                item.addEventListener('click', () => {
                    this.selectOption(letter, isMultiple, item);
                });
            }

            optionsList.appendChild(item);
        });

        // Set bookmark button state
        const bookmarkBtn = document.getElementById('bookmark-btn');
        if (bookmarkBtn) {
            const isBookmarked = ans && ans.is_bookmarked === 1;
            bookmarkBtn.innerHTML = isBookmarked ? '★ BOOKMARKED' : '☆ BOOKMARK';
            bookmarkBtn.style.color = isBookmarked ? 'var(--neon-yellow)' : 'var(--text-primary)';
            bookmarkBtn.style.borderColor = isBookmarked ? 'var(--neon-yellow)' : 'var(--border-color)';
        }

        // Action panel adjustment
        const checkBtn = document.getElementById('check-btn');
        const nextBtn = document.getElementById('next-btn');
        const explanationPanel = document.getElementById('explanation-panel');

        if (isLocked) {
            checkBtn.style.display = 'none';
            nextBtn.style.display = 'block';
            explanationPanel.style.display = 'block';
            document.getElementById('explanation-text').innerHTML = q.explanation || 'No explanation available.';
        } else {
            checkBtn.style.display = 'block';
            nextBtn.style.display = 'none';
            explanationPanel.style.display = 'none';
        }

        // Update progress on backend (save current index position)
        this.saveCurrentIndex();
    }

    selectOption(letter, isMultiple, element) {
        SoundEffects.playClick();
        if (isMultiple) {
            if (this.selectedOptions.includes(letter)) {
                this.selectedOptions = this.selectedOptions.filter(x => x !== letter);
                element.classList.remove('selected');
            } else {
                this.selectedOptions.push(letter);
                element.classList.add('selected');
            }
        } else {
            // Single choice
            this.selectedOptions = [letter];
            document.querySelectorAll('.option-item').forEach(el => {
                el.classList.remove('selected');
            });
            element.classList.add('selected');
        }
    }

    checkAnswer() {
        if (this.selectedOptions.length === 0) {
            alert('Please select at least one option.');
            return;
        }

        const q = this.questions[this.currentIndex];
        
        // Correct answer check logic
        const correctAnswers = q.correct_answer.split(',').map(x => x.trim()).sort();
        const selectedSorted = [...this.selectedOptions].sort();
        const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(selectedSorted);

        // Lock UI
        document.querySelectorAll('.option-item').forEach(item => {
            const letter = item.getAttribute('data-letter');
            
            // Remove click events
            const clone = item.cloneNode(true);
            item.parentNode.replaceChild(clone, item);
            
            if (correctAnswers.includes(letter)) {
                clone.classList.add('correct');
            } else if (selectedSorted.includes(letter)) {
                clone.classList.add('wrong');
            }
        });

        // Play feedback
        if (isCorrect) {
            SoundEffects.playCorrect();
            this.triggerConfetti();
        } else {
            SoundEffects.playWrong();
        }

        // Update Local Answers map
        this.userAnswers[q.id] = {
            question_id: q.id,
            part: this.partId,
            selected_options: JSON.stringify(selectedSorted),
            is_correct: isCorrect ? 1 : 0,
            is_bookmarked: (this.userAnswers[q.id] && this.userAnswers[q.id].is_bookmarked) || 0
        };

        // Render explanations
        const explanationPanel = document.getElementById('explanation-panel');
        explanationPanel.style.display = 'block';
        document.getElementById('explanation-text').innerHTML = q.explanation || 'No explanation available.';

        // Swap check / next buttons
        document.getElementById('check-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'block';

        // Submit state to backend API
        fetch('/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: q.id,
                part: this.partId,
                selected_options: selectedSorted,
                is_correct: isCorrect ? 1 : 0
            })
        })
        .then(res => res.json())
        .then(data => {
            this.updateStats(data.stats);
            this.renderSidebarMap();
            if (data.streak) {
                const streakLabel = document.querySelector('.streak-counter span');
                if (streakLabel) streakLabel.textContent = `${data.streak} DAYS`;
            }
            if (data.new_badges && data.new_badges.length > 0) {
                this.showBadgeNotification(data.new_badges);
            }
        });
    }

    bookmarkQuestion() {
        if (this.questions.length === 0) return;
        SoundEffects.playClick();
        
        const q = this.questions[this.currentIndex];
        const isCurrentBookmarked = this.userAnswers[q.id] && this.userAnswers[q.id].is_bookmarked === 1;
        const newBookmarkState = isCurrentBookmarked ? 0 : 1;

        if (!this.userAnswers[q.id]) {
            this.userAnswers[q.id] = {
                question_id: q.id,
                part: this.partId,
                selected_options: null,
                is_correct: 0,
                is_bookmarked: newBookmarkState
            };
        } else {
            this.userAnswers[q.id].is_bookmarked = newBookmarkState;
        }

        // Toggle bookmark UI button
        const bookmarkBtn = document.getElementById('bookmark-btn');
        bookmarkBtn.innerHTML = newBookmarkState ? '★ BOOKMARKED' : '☆ BOOKMARK';
        bookmarkBtn.style.color = newBookmarkState ? 'var(--neon-yellow)' : 'var(--text-primary)';
        bookmarkBtn.style.borderColor = newBookmarkState ? 'var(--neon-yellow)' : 'var(--border-color)';

        // Update sidebar
        this.renderSidebarMap();

        // Save on API
        fetch('/api/bookmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: q.id,
                is_bookmarked: newBookmarkState
            })
        });
    }

    saveCurrentIndex() {
        if (this.questions.length === 0) return;
        const q = this.questions[this.currentIndex];
        fetch(`/api/update_progress/${this.partId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_question_id: q.id
            })
        });
    }

    prevQuestion() {
        if (this.currentIndex > 0) {
            SoundEffects.playClick();
            if (this.isReviewMode) {
                // Find previous index in mapped review list
                this.currentIndex--;
            } else {
                this.currentIndex--;
            }
            this.renderQuestion();
        }
    }

    nextQuestion() {
        const activeList = this.isReviewMode ? this.reviewIndexMap : this.questions;
        if (this.currentIndex < activeList.length - 1) {
            SoundEffects.playClick();
            this.currentIndex++;
            this.renderQuestion();
        } else {
            SoundEffects.playSuccess();
            this.triggerConfetti();
            alert('Congratulations! You have reached the end of this quiz part.');
        }
    }

    jumpTo() {
        const input = document.getElementById('jump-input');
        const qId = parseInt(input.value);
        if (isNaN(qId)) return;

        const idx = this.questions.findIndex(q => q.id === qId);
        if (idx !== -1) {
            SoundEffects.playClick();
            this.currentIndex = idx;
            this.renderQuestion();
            input.value = '';
        } else {
            alert(`Question ${qId} does not exist in Part ${this.partId}.`);
        }
    }

    updateStats(stats) {
        if (!stats) return;
        const scoreEl = document.getElementById('score-val');
        const accuracyEl = document.getElementById('accuracy-val');
        const attemptedEl = document.getElementById('attempted-val');
        const wrongEl = document.getElementById('wrong-val');

        if (scoreEl) this.animateValue(scoreEl, parseInt(scoreEl.textContent) || 0, stats.score || 0);
        if (attemptedEl) this.animateValue(attemptedEl, parseInt(attemptedEl.textContent) || 0, stats.attempted || 0);
        if (wrongEl) this.animateValue(wrongEl, parseInt(wrongEl.textContent) || 0, stats.wrong_answers || 0);
        
        if (accuracyEl) {
            const acc = stats.accuracy !== undefined ? Math.round(stats.accuracy) : 0;
            this.animateValue(accuracyEl, parseInt(accuracyEl.textContent) || 0, acc, '%');
        }
    }

    animateValue(obj, start, end, suffix = '') {
        if (start === end) {
            obj.textContent = end + suffix;
            return;
        }
        let current = start;
        const range = end - start;
        const increment = range > 0 ? 1 : -1;
        const stepTime = Math.abs(Math.floor(400 / range)) || 10;
        
        const timer = setInterval(() => {
            current += increment;
            obj.textContent = current + suffix;
            if (current === end) {
                clearInterval(timer);
            }
        }, stepTime);
    }

    startTimer() {
        const timerVal = document.getElementById('timer-val');
        if (!timerVal) return;
        
        this.timerInterval = setInterval(() => {
            this.timer++;
            const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
            const secs = String(this.timer % 60).padStart(2, '0');
            timerVal.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    triggerReset() {
        SoundEffects.playClick();
        const modal = document.getElementById('reset-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    cancelReset() {
        SoundEffects.playClick();
        const modal = document.getElementById('reset-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    confirmReset() {
        SoundEffects.playWrong();
        fetch(`/api/reset/${this.partId}`, {
            method: 'POST'
        })
        .then(res => res.json())
        .then(data => {
            window.location.reload();
        });
    }

    toggleRandomMode() {
        SoundEffects.playClick();
        this.isRandomMode = !this.isRandomMode;
        
        const randomBtn = document.getElementById('random-toggle');
        if (this.isRandomMode) {
            randomBtn.classList.add('active');
            randomBtn.style.color = 'var(--neon-green)';
            randomBtn.style.borderColor = 'var(--neon-green)';
            randomBtn.style.boxShadow = 'var(--glow-green)';
            
            // Shuffle questions list
            this.questions = [...this.questions].sort(() => Math.random() - 0.5);
        } else {
            randomBtn.classList.remove('active');
            randomBtn.style.color = 'var(--text-primary)';
            randomBtn.style.borderColor = 'var(--border-color)';
            randomBtn.style.boxShadow = 'none';
            
            // Fetch clean data to restore standard sorting
            this.fetchQuizData();
            return;
        }
        
        this.currentIndex = 0;
        this.renderSidebarMap();
        this.renderQuestion();
    }

    toggleReviewMode() {
        SoundEffects.playClick();
        const reviewBtn = document.getElementById('review-toggle');
        
        if (!this.isReviewMode) {
            // Filter down questions that are answered wrong
            const wrongIndices = [];
            this.questions.forEach((q, idx) => {
                const ans = this.userAnswers[q.id];
                if (ans && ans.selected_options && !ans.is_correct) {
                    wrongIndices.push(idx);
                }
            });

            if (wrongIndices.length === 0) {
                alert("No wrong answers to review! Awesome work!");
                return;
            }

            this.isReviewMode = true;
            this.reviewIndexMap = wrongIndices;
            
            reviewBtn.classList.add('active');
            reviewBtn.style.color = 'var(--neon-pink)';
            reviewBtn.style.borderColor = 'var(--neon-pink)';
            reviewBtn.style.boxShadow = 'var(--glow-pink)';
            reviewBtn.textContent = '📚 ALL QUESTIONS';

            this.currentIndex = wrongIndices[0];
        } else {
            this.isReviewMode = false;
            this.reviewIndexMap = [];
            
            reviewBtn.classList.remove('active');
            reviewBtn.style.color = 'var(--text-primary)';
            reviewBtn.style.borderColor = 'var(--border-color)';
            reviewBtn.style.boxShadow = 'none';
            reviewBtn.textContent = '❌ REVIEW WRONG';

            this.currentIndex = 0;
        }

        this.renderSidebarMap();
        this.renderQuestion();
    }

    setupEventListeners() {
        // Nav Buttons
        document.getElementById('prev-btn').addEventListener('click', () => this.prevQuestion());
        document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('check-btn').addEventListener('click', () => this.checkAnswer());
        document.getElementById('bookmark-btn').addEventListener('click', () => this.bookmarkQuestion());
        
        // Jump Box
        document.getElementById('jump-btn').addEventListener('click', () => this.jumpTo());
        document.getElementById('jump-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.jumpTo();
        });

        // Config buttons
        const resetTrigger = document.getElementById('reset-btn');
        if (resetTrigger) resetTrigger.addEventListener('click', () => this.triggerReset());
        
        const resetCancel = document.getElementById('btn-reset-cancel');
        if (resetCancel) resetCancel.addEventListener('click', () => this.cancelReset());
        
        const resetConfirm = document.getElementById('btn-reset-confirm');
        if (resetConfirm) resetConfirm.addEventListener('click', () => this.confirmReset());

        const randomBtn = document.getElementById('random-toggle');
        if (randomBtn) randomBtn.addEventListener('click', () => this.toggleRandomMode());

        const reviewBtn = document.getElementById('review-toggle');
        if (reviewBtn) reviewBtn.addEventListener('click', () => this.toggleReviewMode());

        // Keyboard Shortcuts Handler
        document.addEventListener('keydown', (e) => {
            const activeElem = document.activeElement;
            if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
                return; // Do not trigger shortcuts when typing in inputs
            }

            const code = e.key.toUpperCase();
            if (['A', 'B', 'C', 'D', 'E', 'F'].includes(code)) {
                // Select Option (A, B, C, D...)
                const index = code.charCodeAt(0) - 65;
                const optionEl = document.querySelector(`.option-item[data-letter="${code}"]`);
                if (optionEl) {
                    const q = this.questions[this.currentIndex];
                    const isMultiple = q.correct_answer.includes(',');
                    this.selectOption(code, isMultiple, optionEl);
                }
            } else if (e.key === 'Enter') {
                const checkBtn = document.getElementById('check-btn');
                const nextBtn = document.getElementById('next-btn');
                if (checkBtn && checkBtn.style.display !== 'none') {
                    this.checkAnswer();
                } else if (nextBtn && nextBtn.style.display !== 'none') {
                    this.nextQuestion();
                }
            } else if (code === 'K') {
                // Bookmark toggle shortcut K or B
                this.bookmarkQuestion();
            } else if (e.key === 'ArrowLeft') {
                this.prevQuestion();
            } else if (e.key === 'ArrowRight') {
                this.nextQuestion();
            }
        });
    }

    triggerConfetti() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#00f0ff', '#ff007f', '#39ff14', '#ffea00', '#9d4edd'];
        const particles = [];

        for (let i = 0; i < 100; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * canvas.height,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0
            });
        }

        let animationFrame;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;

            particles.forEach((p) => {
                p.tiltAngle += p.tiltAngleIncremental;
                p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
                p.x += Math.sin(p.tiltAngle);
                p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;

                if (p.y < canvas.height) {
                    active = true;
                }

                ctx.beginPath();
                ctx.lineWidth = p.r;
                ctx.strokeStyle = p.color;
                ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                ctx.stroke();
            });

            if (active) {
                animationFrame = requestAnimationFrame(draw);
            } else {
                canvas.remove();
            }
        };

        draw();
        setTimeout(() => {
            cancelAnimationFrame(animationFrame);
            canvas.remove();
        }, 3000);
    }

    showBadgeNotification(badgeIds) {
        badgeIds.forEach(id => {
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.background = 'var(--bg-surface-opaque)';
            container.style.border = '2px solid var(--neon-pink)';
            container.style.boxShadow = 'var(--glow-pink)';
            container.style.borderRadius = '12px';
            container.style.padding = '15px 20px';
            container.style.zIndex = '10000';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.gap = '15px';
            container.style.animation = 'floating 3s ease-in-out infinite';
            
            container.innerHTML = `
                <div style="font-size: 2.2rem; color: var(--neon-pink); text-shadow: var(--glow-pink);">🏆</div>
                <div>
                    <h4 style="font-family: var(--font-heading); color: var(--neon-pink); margin-bottom: 2px;">BADGE UNLOCKED!</h4>
                    <p style="font-size: 0.9rem; font-weight: 600; color: #fff;">New Badge: ${id.replace('_', ' ').toUpperCase()}</p>
                </div>
            `;
            document.body.appendChild(container);
            
            setTimeout(() => {
                container.style.transition = 'opacity 0.5s ease';
                container.style.opacity = '0';
                setTimeout(() => container.remove(), 500);
            }, 5000);
        });
    }
}

// Global Exports
const Quiz = new QuizEngine();
