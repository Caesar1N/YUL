import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from '@studio-freight/lenis'

gsap.registerPlugin(ScrollTrigger)

// Smooth Scroll Setup
// Smooth Scroll Setup
const lenis = new Lenis()

// Synchronize Lenis and ScrollTrigger
lenis.on('scroll', ScrollTrigger.update)

gsap.ticker.add((time) => {
    lenis.raf(time * 1000)
})

gsap.ticker.lagSmoothing(0)

// Animations

// 1. Hero Reveal
const heroTimeline = gsap.timeline({ defaults: { ease: "power4.out" } });

heroTimeline.to(".text-reveal", {
    y: 0,
    opacity: 1,
    duration: 2,
    delay: 0.5
})
    .to(".fade-in", {
        opacity: 1,
        y: 0,
        duration: 1.5,
        stagger: 0.3
    }, "-=1.5");

// 2. Parallax Effects
gsap.to(".hero-bg-media", {
    scrollTrigger: {
        trigger: ".hero-section",
        start: "top top",
        end: "bottom top",
        scrub: true
    },
    y: 150,
    scale: 1.05
});

gsap.to(".map-silhouette", {
    scrollTrigger: {
        trigger: ".origin-section",
        start: "top bottom",
        end: "bottom top",
        scrub: 1
    },
    y: -30
});

gsap.to(".location-badge", {
    scrollTrigger: {
        trigger: ".origin-section",
        start: "top 60%",
        toggleActions: "play none none reverse"
    },
    y: 0,
    x: 0,
    opacity: 1,
    duration: 1.2,
    ease: "power3.out"
});

// 3. Product Features Stagger
const features = document.querySelectorAll('.feature-box');

features.forEach((feature, i) => {
    const xVal = i % 2 === 0 ? -30 : 30;

    gsap.fromTo(feature,
        { autoAlpha: 0, x: xVal },
        {
            autoAlpha: 1,
            x: 0,
            duration: 1.5,
            ease: "power3.out",
            scrollTrigger: {
                trigger: feature,
                start: "top 90%", // Earlier trigger
                toggleActions: "play none none reverse"
            }
        }
    );
});

// Product Carton Rotation/Parallax
gsap.to(".product-carton", {
    scrollTrigger: {
        trigger: ".product-section",
        start: "top bottom",
        end: "bottom top",
        scrub: 1.5
    },
    rotation: 3,
    y: 50
});

// Sustainability Cards
// Using fromTo for stability
gsap.fromTo(".sust-card",
    { y: 50, opacity: 0 },
    {
        y: 0,
        opacity: 1,
        duration: 1.2,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
            trigger: ".sustainability-grid",
            start: "top 95%", // Trigger almost immediately when in view
            toggleActions: "play none none reverse"
        },
        onComplete: () => {
            document.querySelectorAll('.icon-svg').forEach(icon => icon.classList.add('animated'));
        }
    }
);


// Export Section Parallax Background
gsap.to(".export-video", {
    scrollTrigger: {
        trigger: ".export-section",
        start: "top bottom",
        end: "bottom top",
        scrub: true
    },
    y: 50
});


// --- Logic for Buttons & Form ---

// 1. "Become a Global Partner" Button Scroll
const globalPartnerBtn = document.querySelector('.hero-content .cta-button');
const footerSection = document.querySelector('.footer-section');

if (globalPartnerBtn && footerSection) {
    globalPartnerBtn.addEventListener('click', () => {
        lenis.scrollTo(footerSection, { offset: 0, duration: 2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    });
}

// 2. Form Submission
const footerForm = document.querySelector('.footer-form');

// Toast Notification Logic (Global)
window.showToast = function (message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3000);
};

if (footerForm) {
    footerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = footerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        // Gather data
        const formData = {
            name: footerForm.querySelector('input[placeholder="Name"]').value,
            company: footerForm.querySelector('input[placeholder="Company / Distributor Name"]').value,
            email: footerForm.querySelector('input[placeholder="Email Address"]').value,
            country: footerForm.querySelector('input[placeholder="Country of Import"]').value
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message);
                footerForm.reset();
            } else {
                showToast('Error: ' + (result.errors ? result.errors.map(e => e.msg).join(', ') : result.message), 'error');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showToast('Unable to connect to the server. Please try again later.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

