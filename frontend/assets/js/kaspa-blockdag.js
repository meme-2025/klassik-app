/**
 * KaspaHub - BlockDAG Canvas Visualization
 * Animated BlockDAG network for hero section
 */

class BlockDAGVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.warn(`Canvas element with id "${canvasId}" not found`);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.blocks = [];
    this.connections = [];
    this.animationFrameId = null;
    this.mousePosition = { x: 0, y: 0 };
    this.isHovering = false;

    // Configuration
    this.config = {
      blockCount: 15,
      blockSize: 12,
      minSpeed: 0.2,
      maxSpeed: 0.8,
      connectionDistance: 150,
      colors: {
        primary: '#00D9C5',
        secondary: '#49E3D7',
        tertiary: '#0099CC',
        accent: '#7B68EE',
      },
      glowIntensity: 15,
      parallaxFactor: 0.05,
    };

    this.init();
  }

  init() {
    this.setupCanvas();
    this.createBlocks();
    this.setupEventListeners();
    this.animate();
  }

  setupCanvas() {
    const updateSize = () => {
      const parent = this.canvas.parentElement;
      this.canvas.width = parent.offsetWidth;
      this.canvas.height = parent.offsetHeight;
    };

    updateSize();
    window.addEventListener('resize', () => {
      updateSize();
      this.createBlocks(); // Recreate blocks on resize
    });
  }

  createBlocks() {
    this.blocks = [];
    const { blockCount } = this.config;

    for (let i = 0; i < blockCount; i++) {
      this.blocks.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * (this.config.maxSpeed - this.config.minSpeed) + this.config.minSpeed,
        vy: (Math.random() - 0.5) * (this.config.maxSpeed - this.config.minSpeed) + this.config.minSpeed,
        size: this.config.blockSize + Math.random() * 8,
        color: this.getRandomColor(),
        opacity: 0.6 + Math.random() * 0.4,
        pulsePhase: Math.random() * Math.PI * 2,
        layer: Math.random(), // For parallax effect
      });
    }
  }

  getRandomColor() {
    const colors = Object.values(this.config.colors);
    return colors[Math.floor(Math.random() * colors.length)];
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePosition.x = e.clientX - rect.left;
      this.mousePosition.y = e.clientY - rect.top;
      this.isHovering = true;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isHovering = false;
    });

    // Parallax effect on scroll
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      this.scrollOffset = scrollY * this.config.parallaxFactor;
    });
  }

  updateBlocks() {
    this.blocks.forEach(block => {
      // Update position
      block.x += block.vx;
      block.y += block.vy;

      // Bounce off edges
      if (block.x < 0 || block.x > this.canvas.width) {
        block.vx *= -1;
        block.x = Math.max(0, Math.min(this.canvas.width, block.x));
      }
      if (block.y < 0 || block.y > this.canvas.height) {
        block.vy *= -1;
        block.y = Math.max(0, Math.min(this.canvas.height, block.y));
      }

      // Mouse interaction - attract blocks
      if (this.isHovering) {
        const dx = this.mousePosition.x - block.x;
        const dy = this.mousePosition.y - block.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100) {
          const force = (100 - distance) / 1000;
          block.vx += dx * force;
          block.vy += dy * force;
        }
      }

      // Limit velocity
      const maxVel = this.config.maxSpeed * 2;
      block.vx = Math.max(-maxVel, Math.min(maxVel, block.vx));
      block.vy = Math.max(-maxVel, Math.min(maxVel, block.vy));

      // Apply friction
      block.vx *= 0.99;
      block.vy *= 0.99;

      // Update pulse phase
      block.pulsePhase += 0.02;
    });
  }

  drawConnections() {
    const { connectionDistance } = this.config;

    this.blocks.forEach((blockA, i) => {
      this.blocks.slice(i + 1).forEach(blockB => {
        const dx = blockA.x - blockB.x;
        const dy = blockA.y - blockB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < connectionDistance) {
          const opacity = (1 - distance / connectionDistance) * 0.3;
          
          // Create gradient for connection line
          const gradient = this.ctx.createLinearGradient(
            blockA.x, blockA.y,
            blockB.x, blockB.y
          );
          gradient.addColorStop(0, this.hexToRgba(blockA.color, opacity));
          gradient.addColorStop(1, this.hexToRgba(blockB.color, opacity));

          this.ctx.beginPath();
          this.ctx.strokeStyle = gradient;
          this.ctx.lineWidth = 1;
          this.ctx.moveTo(blockA.x, blockA.y);
          this.ctx.lineTo(blockB.x, blockB.y);
          this.ctx.stroke();
        }
      });
    });
  }

  drawBlocks() {
    this.blocks.forEach(block => {
      // Pulsing effect
      const pulse = Math.sin(block.pulsePhase) * 0.2 + 1;
      const size = block.size * pulse;

      // Outer glow
      const glowGradient = this.ctx.createRadialGradient(
        block.x, block.y, 0,
        block.x, block.y, size * 2.5
      );
      glowGradient.addColorStop(0, this.hexToRgba(block.color, block.opacity * 0.6));
      glowGradient.addColorStop(0.5, this.hexToRgba(block.color, block.opacity * 0.2));
      glowGradient.addColorStop(1, this.hexToRgba(block.color, 0));

      this.ctx.beginPath();
      this.ctx.fillStyle = glowGradient;
      this.ctx.arc(block.x, block.y, size * 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Main block (square with rounded corners)
      this.ctx.beginPath();
      this.roundRect(
        block.x - size / 2,
        block.y - size / 2,
        size,
        size,
        size * 0.2
      );
      
      // Block gradient
      const blockGradient = this.ctx.createLinearGradient(
        block.x - size / 2, block.y - size / 2,
        block.x + size / 2, block.y + size / 2
      );
      blockGradient.addColorStop(0, this.hexToRgba(block.color, block.opacity));
      blockGradient.addColorStop(1, this.hexToRgba(this.config.colors.secondary, block.opacity * 0.8));
      
      this.ctx.fillStyle = blockGradient;
      this.ctx.fill();

      // Inner glow
      this.ctx.shadowBlur = this.config.glowIntensity;
      this.ctx.shadowColor = block.color;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Highlight
      const highlightGradient = this.ctx.createLinearGradient(
        block.x - size / 4, block.y - size / 4,
        block.x, block.y
      );
      highlightGradient.addColorStop(0, this.hexToRgba('#FFFFFF', 0.3));
      highlightGradient.addColorStop(1, this.hexToRgba('#FFFFFF', 0));

      this.ctx.beginPath();
      this.roundRect(
        block.x - size / 2,
        block.y - size / 2,
        size / 2,
        size / 2,
        size * 0.15
      );
      this.ctx.fillStyle = highlightGradient;
      this.ctx.fill();
    });
  }

  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  animate() {
    this.clear();
    this.updateBlocks();
    this.drawConnections();
    this.drawBlocks();

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

// Initialize BlockDAG visualization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('blockdag-canvas');
  if (canvas) {
    window.blockDAGVisualizer = new BlockDAGVisualizer('blockdag-canvas');
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.blockDAGVisualizer) {
    window.blockDAGVisualizer.destroy();
  }
});
