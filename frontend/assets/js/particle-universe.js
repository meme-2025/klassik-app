/**
 * PARTICLE UNIVERSE - Interactive Consensus Visualization
 * Performance-optimized Canvas animation with morphing particles
 * Mobile-ready with touch support
 */

(function() {
    'use strict';

    const canvas = document.getElementById('consensusCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const message = document.getElementById('morphingMessage');
    
    // Configuration - adaptive based on device
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 200 : 800;
    const FORCE_RANGE = isMobile ? 80 : 150;
    const messages = ['CONSENSUS', 'BLOCKDAG', 'PARALLEL', 'DECENTRALIZED'];
    
    let particles = [];
    let mouse = { x: null, y: null, radius: FORCE_RANGE };
    let currentMessageIndex = 0;
    let animationFrameId = null;
    let canvasWidth, canvasHeight;

    // Particle class with physics
    class Particle {
        constructor() {
            this.reset();
            this.baseX = this.x;
            this.baseY = this.y;
        }

        reset() {
            this.x = Math.random() * canvasWidth;
            this.y = Math.random() * canvasHeight;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2 + 1;
            this.opacity = Math.random() * 0.5 + 0.3;
            this.hue = Math.random() * 60 + 160; // Cyan to purple range
        }

        update() {
            // Mouse interaction - repulsion/attraction
            if (mouse.x && mouse.y) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    const angle = Math.atan2(dy, dx);
                    this.vx += Math.cos(angle) * force * 0.5;
                    this.vy += Math.sin(angle) * force * 0.5;
                }
            }

            // Apply velocity with damping
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.95;
            this.vy *= 0.95;

            // Gentle return to base position
            const returnForce = 0.01;
            this.vx += (this.baseX - this.x) * returnForce;
            this.vy += (this.baseY - this.y) * returnForce;

            // Boundary bounce
            if (this.x < 0 || this.x > canvasWidth) this.vx *= -0.8;
            if (this.y < 0 || this.y > canvasHeight) this.vy *= -0.8;

            // Keep in bounds
            this.x = Math.max(0, Math.min(canvasWidth, this.x));
            this.y = Math.max(0, Math.min(canvasHeight, this.y));

            // Slow color shift
            this.hue += 0.1;
            if (this.hue > 220) this.hue = 160;
        }

        draw() {
            ctx.save();
            
            // Glow effect
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.size * 3
            );
            gradient.addColorStop(0, `hsla(${this.hue}, 100%, 60%, ${this.opacity})`);
            gradient.addColorStop(1, `hsla(${this.hue}, 100%, 60%, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
            ctx.fill();

            // Core particle
            ctx.fillStyle = `hsla(${this.hue}, 100%, 70%, ${this.opacity + 0.3})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }

    // Connection drawing between nearby particles
    function drawConnections() {
        const maxDistance = isMobile ? 80 : 120;
        
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.3;
                    ctx.strokeStyle = `rgba(0, 217, 197, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    // Initialize canvas and particles
    function init() {
        resizeCanvas();
        
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }
        
        animate();
    }

    // Resize handler
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvasWidth = rect.width;
        canvasHeight = rect.height;
        canvas.width = canvasWidth * window.devicePixelRatio;
        canvas.height = canvasHeight * window.devicePixelRatio;
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Update base positions on resize
        particles.forEach(p => {
            p.baseX = Math.random() * canvasWidth;
            p.baseY = Math.random() * canvasHeight;
        });
    }

    // Animation loop
    function animate() {
        // Trail effect instead of full clear
        ctx.fillStyle = 'rgba(0, 10, 20, 0.1)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Update and draw particles
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        // Draw connections (reduced frequency for performance)
        if (Math.random() > 0.7) {
            drawConnections();
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    // Mouse/Touch interaction
    function updateMousePosition(x, y) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = x - rect.left;
        mouse.y = y - rect.top;
    }

    canvas.addEventListener('mousemove', (e) => {
        updateMousePosition(e.clientX, e.clientY);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        updateMousePosition(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    canvas.addEventListener('touchend', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Click/Touch creates explosion
    function createExplosion(x, y) {
        particles.forEach(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 150) {
                const angle = Math.atan2(dy, dx);
                const force = (150 - distance) / 50;
                p.vx = Math.cos(angle) * force * 5;
                p.vy = Math.sin(angle) * force * 5;
            }
        });
    }

    canvas.addEventListener('click', (e) => {
        updateMousePosition(e.clientX, e.clientY);
        createExplosion(mouse.x, mouse.y);
    });

    canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        updateMousePosition(touch.clientX, touch.clientY);
        createExplosion(mouse.x, mouse.y);
    });

    // Rotate message text
    function rotateMessage() {
        currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        if (message) {
            message.style.opacity = '0';
            setTimeout(() => {
                message.textContent = messages[currentMessageIndex];
                message.style.transition = 'opacity 0.5s ease-in-out';
                message.style.opacity = '1';
            }, 500);
        }
    }

    // Message rotation timer
    setInterval(rotateMessage, 4000);

    // Window resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizeCanvas();
        }, 250);
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    });

    // Start the universe
    init();
    
    console.log('🌌 Particle Universe initialized with ' + PARTICLE_COUNT + ' particles');
})();
