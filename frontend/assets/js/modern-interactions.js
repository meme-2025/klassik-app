/*
 * MODERN SCROLL REVEAL & INTERACTIONS
 * Professionelle Scroll-Animationen und UI-Interaktionen
 */

// ========== INTERSECTION OBSERVER FÜR SCROLL REVEALS ==========
const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -100px 0px'
};

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            // Optional: Observer nach Animation entfernen
            // scrollObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// Alle scroll-reveal Elemente beobachten
document.addEventListener('DOMContentLoaded', () => {
    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach(el => scrollObserver.observe(el));
});

// ========== NAVBAR SCROLL BEHAVIOR ==========
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    // Scrolled class für backdrop
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    // Hide on scroll down, show on scroll up
    if (currentScroll > lastScroll && currentScroll > 100) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
    }
    
    lastScroll = currentScroll;
}, { passive: true });

// ========== SMOOTH SCROLL FÜR NAV LINKS ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Skip if href is just "#"
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            const offsetTop = target.offsetTop - 80; // navbar height
            
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
        }
    });
});

// ========== ACTIVE NAV LINK ON SCROLL ==========
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 150;
        const sectionHeight = section.clientHeight;
        
        if (window.pageYOffset >= sectionTop && 
            window.pageYOffset < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}, { passive: true });

// ========== MOBILE MENU TOGGLE ==========
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
        
        // Icon animation
        const icon = mobileMenuBtn.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
    
    // Close menu on link click
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            mobileMenuBtn.classList.remove('active');
            const icon = mobileMenuBtn.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        });
    });
}

// ========== MODAL HELPERS ==========
window.AnimationHelpers = window.AnimationHelpers || {};

window.AnimationHelpers.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Force reflow
        modal.offsetHeight;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.AnimationHelpers.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 400); // Match animation duration
    }
};

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        AnimationHelpers.closeModal(e.target.id);
    }
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            AnimationHelpers.closeModal(activeModal.id);
        }
    }
});

// ========== HERO STATS COUNTER ANIMATION ==========
function animateCounter(element, target, duration = 2000, suffix = '') {
    if (!element) return;
    
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString() + suffix;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString() + suffix;
        }
    }, 16);
}

// Trigger counter animation when stats section is visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Animate all stat values
            const statValues = entry.target.querySelectorAll('.stat-value');
            statValues.forEach(stat => {
                const value = stat.dataset.value || stat.textContent;
                const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
                const suffix = value.replace(/[0-9.,]/g, '');
                
                if (!isNaN(numericValue)) {
                    animateCounter(stat, numericValue, 2000, suffix);
                }
            });
            
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    statsObserver.observe(heroStats);
}

// ========== PARALLAX SCROLL EFFECT ==========
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    
    // Parallax für Hero Content
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
        heroContent.style.opacity = 1 - (scrolled / 800);
    }
    
    // Parallax für Background Orbs
    const heroSection = document.querySelector('.hero-kaspa');
    if (heroSection) {
        heroSection.style.backgroundPosition = `center ${scrolled * 0.3}px`;
    }
}, { passive: true });

// ========== CURSOR GLOW EFFECT (OPTIONAL) ==========
let cursorGlow = null;

function initCursorGlow() {
    // Nur auf Desktop
    if (window.innerWidth > 768) {
        cursorGlow = document.createElement('div');
        cursorGlow.className = 'cursor-glow';
        cursorGlow.style.cssText = `
            position: fixed;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(0, 217, 197, 0.15), transparent 70%);
            pointer-events: none;
            z-index: 9999;
            transform: translate(-50%, -50%);
            transition: opacity 0.3s ease;
            opacity: 0;
            filter: blur(40px);
        `;
        document.body.appendChild(cursorGlow);
        
        document.addEventListener('mousemove', (e) => {
            if (cursorGlow) {
                cursorGlow.style.left = e.clientX + 'px';
                cursorGlow.style.top = e.clientY + 'px';
                cursorGlow.style.opacity = '1';
            }
        });
        
        document.addEventListener('mouseleave', () => {
            if (cursorGlow) {
                cursorGlow.style.opacity = '0';
            }
        });
    }
}

// Optional: Cursor Glow aktivieren
// initCursorGlow();

// ========== PERFORMANCE OPTIMIZATIONS ==========
// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle window resize
window.addEventListener('resize', debounce(() => {
    // Reinitialize cursor glow on resize
    if (window.innerWidth <= 768 && cursorGlow) {
        cursorGlow.remove();
        cursorGlow = null;
    } else if (window.innerWidth > 768 && !cursorGlow) {
        // Optional: initCursorGlow();
    }
}, 250));

// ========== PRELOAD IMAGES ==========
function preloadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Initialize on load
window.addEventListener('load', () => {
    preloadImages();
    
    // Fade in body
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// ========== FAQ ACCORDION ==========
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const faqItem = question.parentElement;
        const isActive = faqItem.classList.contains('active');
        
        // Close all FAQ items
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Open clicked item if it wasn't active
        if (!isActive) {
            faqItem.classList.add('active');
        }
    });
});

// ========== NEWSLETTER SUBSCRIPTION ==========
const subscribeBtn = document.getElementById('subscribeBtn');
if (subscribeBtn) {
    subscribeBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('newsletterEmail');
        const email = emailInput.value.trim();
        
        if (!email) {
            alert('Please enter your email address');
            return;
        }
        
        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }
        
        // Disable button during submission
        const originalHTML = subscribeBtn.innerHTML;
        subscribeBtn.disabled = true;
        subscribeBtn.innerHTML = '<span>Subscribing...</span>';
        
        try {
            // TODO: Send to backend API
            // For now, just simulate success
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            subscribeBtn.innerHTML = '<i class="fas fa-check"></i><span>Subscribed!</span>';
            subscribeBtn.style.background = 'linear-gradient(135deg, #00ff88, #00cc66)';
            emailInput.value = '';
            
            setTimeout(() => {
                subscribeBtn.innerHTML = originalHTML;
                subscribeBtn.style.background = '';
                subscribeBtn.disabled = false;
            }, 3000);
            
        } catch (error) {
            console.error('Newsletter subscription error:', error);
            alert('Subscription failed. Please try again.');
            subscribeBtn.innerHTML = originalHTML;
            subscribeBtn.disabled = false;
        }
    });
    
    // Enter key support
    document.getElementById('newsletterEmail')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            subscribeBtn.click();
        }
    });
}

// ========== CONSOLE BRANDING ==========
console.log('%c🚀 Klassik on Kaspa', 'font-size: 24px; font-weight: bold; color: #00D9C5;');
console.log('%cBeyond The Block', 'font-size: 14px; color: #0099CC;');
console.log('%c', 'padding: 20px; background: linear-gradient(135deg, #00D9C5, #0099CC);');
