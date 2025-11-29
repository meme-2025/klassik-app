// tsParticles KI-optimiertes Farbspiel & Animation

document.addEventListener('DOMContentLoaded', function () {
  tsParticles.load('particles-js', {
    fullScreen: { enable: false },
    background: { color: { value: '#22223B' } },
    particles: {
      number: { value: 60, density: { enable: true, area: 800 } },
      color: {
        value: [
          '#00D9C5', '#49E3D7', '#0099CC', '#7B68EE',
          '#FFFFFF', '#F7F7F7', '#FFB400', '#FF4C60'
        ]
      },
      shape: {
        type: [ 'circle', 'star', 'polygon' ],
        options: {
          polygon: { sides: 5 },
          star: { sides: 5 }
        }
      },
      opacity: {
        value: 0.7,
        random: { enable: true, minimumValue: 0.3 },
        animation: { enable: true, speed: 0.8, minimumValue: 0.3, sync: false }
      },
      size: {
        value: { min: 2, max: 6 },
        random: { enable: true, minimumValue: 2 },
        animation: { enable: true, speed: 2, minimumValue: 2, sync: false }
      },
      links: {
        enable: true,
        distance: 120,
        color: '#00D9C5',
        opacity: 0.25,
        width: 1.2,
        triangles: { enable: true, color: '#FFB400', opacity: 0.12 }
      },
      move: {
        enable: true,
        speed: 1.2,
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'out' },
        attract: { enable: true, rotateX: 600, rotateY: 1200 }
      }
    },
    interactivity: {
      detectsOn: 'parent',
      events: {
        onHover: { enable: true, mode: 'repulse' },
        onClick: { enable: true, mode: 'push' },
        resize: true
      },
      modes: {
        repulse: { distance: 120, duration: 0.4 },
        push: { quantity: 6 },
        grab: {
          distance: 200,
          links: { opacity: 0.6 }
        }
      }
    },
    detectRetina: true
  });
});
