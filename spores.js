/**
 * ForRealScan Spore Effect System
 * Canvas-based particle system with Veritas (green) and Robo (blue) themed particles
 *
 * Usage:
 *   SporeEffect.init({ intensity: 1.0 });  // Full effect (Hub)
 *   SporeEffect.init({ intensity: 0.5 });  // Subtle effect (Memory)
 *   SporeEffect.destroy();                  // Cleanup
 */
(function(window) {
    'use strict';

    // ===== CONFIGURATION =====
    const DEFAULT_CONFIG = {
        sporeCount: 30,
        minSize: 4,
        maxSize: 12,
        mouseInfluenceRadius: 150,
        mouseRepelStrength: 2,
        edgeWidth: 0.25,           // Spores appear in outer 25% of screen
        boundaryWidth: 0.30,       // Spores stay within outer 30%
        baseDamping: 0.96,         // Velocity damping per frame
        attractionStrength: 0.015,
        attractionThreshold: 50,   // Distance to trigger new target
        intensity: 1.0,            // Global intensity multiplier
        colors: {
            veritas: { hue: 142, saturation: 75, lightness: 60 },  // Green
            robo: { hue: 210, saturation: 85, lightness: 65 }      // Blue
        }
    };

    // ===== STATE =====
    let canvas = null;
    let ctx = null;
    let spores = [];
    let mouse = null;
    let animationFrameId = null;
    let config = { ...DEFAULT_CONFIG };
    let isRunning = false;

    // ===== SPORE CLASS =====
    class Spore {
        constructor(canvasWidth, canvasHeight, index) {
            this.side = index % 2 === 0 ? 'left' : 'right';
            this.reset(canvasWidth, canvasHeight, true);
        }

        reset(canvasWidth, canvasHeight, initial = false) {
            const edgeWidth = canvasWidth * config.edgeWidth;

            // Position: Edge-biased (outer 25%)
            if (this.side === 'left') {
                this.x = Math.random() * edgeWidth;
            } else {
                this.x = canvasWidth - Math.random() * edgeWidth;
            }
            this.y = initial ? Math.random() * canvasHeight : -config.maxSize;

            // Size and appearance
            this.size = config.minSize + Math.random() * (config.maxSize - config.minSize);
            this.opacity = 0.4 + Math.random() * 0.3;  // 0.4 - 0.7
            this.hue = Math.random() * 20;             // 0-20° variation

            // Velocity: slight upward drift
            this.speedX = (Math.random() - 0.5) * 0.6;
            this.speedY = -0.15 + (Math.random() - 0.5) * 0.3;

            // Pulse animation
            this.pulsePhase = Math.random() * Math.PI * 2;
            this.pulseSpeed = 0.015 + Math.random() * 0.015;

            // Attraction target (for organic movement)
            this.setNewTarget(canvasWidth, canvasHeight);
        }

        setNewTarget(canvasWidth, canvasHeight) {
            const edgeWidth = canvasWidth * config.boundaryWidth;
            if (this.side === 'left') {
                this.attractX = Math.random() * edgeWidth;
            } else {
                this.attractX = canvasWidth - Math.random() * edgeWidth;
            }
            this.attractY = Math.random() * canvasHeight;
        }

        update(canvasWidth, canvasHeight) {
            // 1. Mouse repulsion
            if (mouse) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < config.mouseInfluenceRadius && distance > 0) {
                    const force = (config.mouseInfluenceRadius - distance) / config.mouseInfluenceRadius;
                    const angle = Math.atan2(dy, dx);
                    this.speedX += Math.cos(angle) * force * config.mouseRepelStrength * 0.03;
                    this.speedY += Math.sin(angle) * force * config.mouseRepelStrength * 0.03;
                }
            }

            // 2. Organic attraction to target
            const dxAttract = this.attractX - this.x;
            const dyAttract = this.attractY - this.y;
            const distanceAttract = Math.sqrt(dxAttract * dxAttract + dyAttract * dyAttract);

            if (distanceAttract > 0) {
                this.speedX += (dxAttract / distanceAttract) * config.attractionStrength;
                this.speedY += (dyAttract / distanceAttract) * config.attractionStrength;
            }

            // Set new target when close
            if (distanceAttract < config.attractionThreshold) {
                this.setNewTarget(canvasWidth, canvasHeight);
            }

            // 3. Apply damping
            this.speedX *= config.baseDamping;
            this.speedY *= config.baseDamping;

            // 4. Update position
            this.x += this.speedX;
            this.y += this.speedY;

            // 5. Pulse animation
            this.pulsePhase += this.pulseSpeed;

            // 6. Boundary wrapping (stay on assigned side)
            const boundaryWidth = canvasWidth * config.boundaryWidth;

            if (this.side === 'left') {
                if (this.x < -this.size) this.x = boundaryWidth;
                if (this.x > boundaryWidth) this.x = -this.size;
            } else {
                const rightStart = canvasWidth - boundaryWidth;
                if (this.x < rightStart) this.x = canvasWidth + this.size;
                if (this.x > canvasWidth + this.size) this.x = rightStart;
            }

            // Vertical wrapping
            if (this.y < -this.size) this.y = canvasHeight + this.size;
            if (this.y > canvasHeight + this.size) this.y = -this.size;
        }

        draw(ctx) {
            const pulseFactor = 0.8 + Math.sin(this.pulsePhase) * 0.2;
            const currentSize = this.size * pulseFactor * config.intensity;
            const opacity = this.opacity * pulseFactor * config.intensity;

            // Get color based on side
            const colorConfig = this.side === 'left' ? config.colors.veritas : config.colors.robo;
            const hue = colorConfig.hue + this.hue;
            const sat = colorConfig.saturation;
            const light = colorConfig.lightness;

            // Outer glow (3x size)
            const glowGradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, currentSize * 3
            );
            glowGradient.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, ${opacity * 0.6})`);
            glowGradient.addColorStop(0.5, `hsla(${hue}, ${sat}%, ${light}%, ${opacity * 0.3})`);
            glowGradient.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);

            ctx.beginPath();
            ctx.arc(this.x, this.y, currentSize * 3, 0, Math.PI * 2);
            ctx.fillStyle = glowGradient;
            ctx.fill();

            // Core (1x size)
            const coreGradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, currentSize
            );
            coreGradient.addColorStop(0, `hsla(${hue}, ${sat}%, ${light + 20}%, ${opacity * 0.9})`);
            coreGradient.addColorStop(0.5, `hsla(${hue}, ${sat}%, ${light}%, ${opacity * 0.7})`);
            coreGradient.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);

            ctx.beginPath();
            ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
            ctx.fillStyle = coreGradient;
            ctx.fill();
        }
    }

    // ===== CORE FUNCTIONS =====

    function createCanvas() {
        canvas = document.createElement('canvas');
        canvas.id = 'sporeCanvas';
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
        `;
        document.body.insertBefore(canvas, document.body.firstChild);
        ctx = canvas.getContext('2d');
        resizeCanvas();
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function initSpores() {
        spores = [];
        const count = Math.floor(config.sporeCount * config.intensity);
        for (let i = 0; i < count; i++) {
            spores.push(new Spore(canvas.width, canvas.height, i));
        }
    }

    function animate() {
        if (!isRunning || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const spore of spores) {
            spore.update(canvas.width, canvas.height);
            spore.draw(ctx);
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    // ===== EVENT HANDLERS =====

    function handleMouseMove(e) {
        mouse = { x: e.clientX, y: e.clientY };
    }

    function handleMouseLeave() {
        mouse = null;
    }

    function handleResize() {
        resizeCanvas();
        // Reinitialize spores on significant resize
        if (spores.length > 0) {
            initSpores();
        }
    }

    // ===== PUBLIC API =====

    const SporeEffect = {
        /**
         * Initialize the spore effect
         * @param {Object} options - Configuration options
         * @param {number} options.intensity - Effect intensity (0.3 = subtle, 1.0 = normal, 1.5 = intense)
         * @param {number} options.sporeCount - Number of spores (default: 30)
         */
        init: function(options = {}) {
            if (isRunning) {
                this.destroy();
            }

            // Merge options with defaults
            config = { ...DEFAULT_CONFIG, ...options };

            // Create canvas
            createCanvas();
            initSpores();

            // Event listeners
            window.addEventListener('resize', handleResize);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseleave', handleMouseLeave);

            // Start animation
            isRunning = true;
            animate();

            console.log(`[SporeEffect] Initialized with ${spores.length} spores (intensity: ${config.intensity})`);
        },

        /**
         * Destroy the spore effect and clean up
         */
        destroy: function() {
            isRunning = false;

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);

            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }

            canvas = null;
            ctx = null;
            spores = [];
            mouse = null;

            console.log('[SporeEffect] Destroyed');
        },

        /**
         * Pause the animation
         */
        pause: function() {
            isRunning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        },

        /**
         * Resume the animation
         */
        resume: function() {
            if (!isRunning && canvas) {
                isRunning = true;
                animate();
            }
        },

        /**
         * Update configuration dynamically
         * @param {Object} options - New configuration options
         */
        setConfig: function(options) {
            config = { ...config, ...options };
            if (isRunning) {
                initSpores();
            }
        },

        /**
         * Check if effect is running
         * @returns {boolean}
         */
        isActive: function() {
            return isRunning;
        }
    };

    // Export to global scope
    window.SporeEffect = SporeEffect;

})(window);
