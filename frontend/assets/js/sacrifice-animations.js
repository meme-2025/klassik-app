/**
 * KASPAHUB SACRIFICE - ANIMATIONS ENGINE
 * Advanced animations, effects, and visual enhancements
 */

// ============================================
// PARTICLE SYSTEM
// ============================================

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.maxParticles = 100;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.init();
        this.animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    init() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }
    
    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            radius: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.2,
            color: this.getRandomColor()
        };
    }
    
    getRandomColor() {
        const colors = [
            'rgba(73, 217, 217, ',
            'rgba(123, 79, 255, ',
            'rgba(255, 73, 217, '
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach((particle, index) => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off edges
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color + particle.opacity + ')';
            this.ctx.fill();
            
            // Draw connections
            this.particles.slice(index + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = particle.color + (0.15 * (1 - distance / 120)) + ')';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(otherParticle.x, otherParticle.y);
                    this.ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// ============================================
// SCROLL REVEAL ANIMATIONS
// ============================================

class ScrollReveal {
    constructor() {
        this.elements = [];
        this.init();
    }
    
    init() {
        this.elements = document.querySelectorAll('.scroll-reveal, .fade-in-up');
        
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible', 'animated');
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        this.elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            this.observer.observe(el);
        });
    }
}

// ============================================
// NUMBER COUNTER ANIMATION
// ============================================

class CounterAnimation {
    static animate(element, targetValue, duration = 2000, suffix = '') {
        const startValue = 0;
        const startTime = performance.now();
        
        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut);
            
            element.textContent = currentValue.toLocaleString() + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = targetValue.toLocaleString() + suffix;
            }
        };
        
        requestAnimationFrame(updateCounter);
    }
}

// ============================================
// FLOATING ELEMENTS
// ============================================

class FloatingElements {
    constructor() {
        this.elements = document.querySelectorAll('.float-animation');
        this.init();
    }
    
    init() {
        this.elements.forEach((el, index) => {
            const duration = 3 + Math.random() * 2;
            const delay = index * 0.2;
            const distance = 10 + Math.random() * 10;
            
            el.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
            el.style.setProperty('--float-distance', `${distance}px`);
        });
    }
}

// ============================================
// GLOW PULSE EFFECTS
// ============================================

class GlowPulse {
    constructor() {
        this.elements = document.querySelectorAll('.pulse-glow');
        this.init();
    }
    
    init() {
        this.elements.forEach(el => {
            const duration = 2 + Math.random();
            el.style.animation = `pulse-glow-effect ${duration}s ease-in-out infinite`;
        });
    }
}

// ============================================
// BACKGROUND GRADIENT ANIMATION
// ============================================

class GradientAnimation {
    constructor(element) {
        this.element = element;
        this.hue = 0;
        this.animate();
    }
    
    animate() {
        this.hue = (this.hue + 0.5) % 360;
        
        this.element.style.background = `
            linear-gradient(
                135deg,
                hsl(${this.hue}, 70%, 60%) 0%,
                hsl(${(this.hue + 60) % 360}, 70%, 60%) 50%,
                hsl(${(this.hue + 120) % 360}, 70%, 60%) 100%
            )
        `;
        
        requestAnimationFrame(() => this.animate());
    }
}

// ============================================
// CONFETTI EFFECT
// ============================================

class ConfettiEffect {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
    }
    
    trigger() {
        document.body.appendChild(this.canvas);
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Create confetti particles
        for (let i = 0; i < 100; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: -20,
                vx: (Math.random() - 0.5) * 5,
                vy: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                color: this.getRandomColor(),
                size: Math.random() * 10 + 5
            });
        }
        
        this.animate();
    }
    
    getRandomColor() {
        const colors = [
            '#49D9D9',
            '#7B4FFF',
            '#FF49D9',
            '#FFD700',
            '#00FF88'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach((particle, index) => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // Gravity
            particle.rotation += particle.rotationSpeed;
            
            // Draw particle
            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation * Math.PI / 180);
            this.ctx.fillStyle = particle.color;
            this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            this.ctx.restore();
            
            // Remove off-screen particles
            if (particle.y > this.canvas.height) {
                this.particles.splice(index, 1);
            }
        });
        
        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        } else {
            document.body.removeChild(this.canvas);
        }
    }
}

// ============================================
// RIPPLE EFFECT
// ============================================

class RippleEffect {
    static create(element, event) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple');
        
        element.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    }
}

// ============================================
// TYPING ANIMATION
// ============================================

class TypingAnimation {
    constructor(element, texts, speed = 50) {
        this.element = element;
        this.texts = texts;
        this.speed = speed;
        this.textIndex = 0;
        this.charIndex = 0;
        this.isDeleting = false;
        
        this.type();
    }
    
    type() {
        const currentText = this.texts[this.textIndex];
        
        if (this.isDeleting) {
            this.element.textContent = currentText.substring(0, this.charIndex - 1);
            this.charIndex--;
        } else {
            this.element.textContent = currentText.substring(0, this.charIndex + 1);
            this.charIndex++;
        }
        
        let timeout = this.speed;
        
        if (this.isDeleting) {
            timeout /= 2;
        }
        
        if (!this.isDeleting && this.charIndex === currentText.length) {
            timeout = 2000;
            this.isDeleting = true;
        } else if (this.isDeleting && this.charIndex === 0) {
            this.isDeleting = false;
            this.textIndex = (this.textIndex + 1) % this.texts.length;
            timeout = 500;
        }
        
        setTimeout(() => this.type(), timeout);
    }
}

// ============================================
// SHIMMER EFFECT
// ============================================

class ShimmerEffect {
    static apply(element) {
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        
        const shimmer = document.createElement('div');
        shimmer.className = 'shimmer-overlay';
        shimmer.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            animation: shimmer 2s infinite;
        `;
        
        element.appendChild(shimmer);
    }
}

// ============================================
// PARALLAX SCROLL
// ============================================

class ParallaxScroll {
    constructor() {
        this.elements = document.querySelectorAll('[data-parallax]');
        this.init();
    }
    
    init() {
        window.addEventListener('scroll', () => this.update());
        this.update();
    }
    
    update() {
        const scrollY = window.scrollY;
        
        this.elements.forEach(el => {
            const speed = parseFloat(el.dataset.parallax) || 0.5;
            const yPos = -(scrollY * speed);
            el.style.transform = `translateY(${yPos}px)`;
        });
    }
}

// ============================================
// 3D TILT EFFECT
// ============================================

class TiltEffect {
    constructor(elements) {
        this.elements = elements || document.querySelectorAll('.tilt-card');
        this.init();
    }
    
    init() {
        this.elements.forEach(el => {
            el.addEventListener('mousemove', (e) => this.handleMove(e, el));
            el.addEventListener('mouseleave', () => this.handleLeave(el));
        });
    }
    
    handleMove(e, el) {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    }
    
    handleLeave(el) {
        el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    }
}

// ============================================
// INITIALIZE ALL ANIMATIONS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ Initializing animations...');
    
    // Particle background (if particles.js not loaded)
    if (!window.particlesJS) {
        new ParticleSystem('particles-sacrifice');
    }
    
    // Scroll reveal
    new ScrollReveal();
    
    // Floating elements
    new FloatingElements();
    
    // Glow pulse
    new GlowPulse();
    
    // Parallax scroll
    new ParallaxScroll();
    
    // Tilt effect for cards
    new TiltEffect();
    
    // Add ripple effect to buttons
    document.querySelectorAll('.btn-hero-mega, .btn-sacrifice-mega, .tier-card').forEach(btn => {
        btn.addEventListener('click', (e) => RippleEffect.create(btn, e));
    });
    
    // Counter animations for stats
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const target = parseInt(counter.dataset.target) || 0;
        CounterAnimation.animate(counter, target);
    });
    
    console.log('✨ Animations initialized');
});

// ============================================
// EXPORT
// ============================================

window.AnimationEngine = {
    ParticleSystem,
    ScrollReveal,
    CounterAnimation,
    FloatingElements,
    GlowPulse,
    GradientAnimation,
    ConfettiEffect,
    RippleEffect,
    TypingAnimation,
    ShimmerEffect,
    ParallaxScroll,
    TiltEffect
};

// Trigger confetti on successful sacrifice
window.addEventListener('sacrificeSuccess', () => {
    const confetti = new ConfettiEffect();
    confetti.trigger();
});

console.log('✨ Animation engine loaded');
