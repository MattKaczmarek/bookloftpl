document.addEventListener('DOMContentLoaded', function() {
  // Wymuszenie powrotu na górę strony po odświeżeniu
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  
  // Cache DOM elements for better performance
  const elements = {
    background: document.querySelector('.background'),
    logo: document.querySelector('.logo'),
    subtitle: document.querySelector('.subtitle'),
    container: document.querySelector('.container'),
    tagline: document.querySelector('.tagline'),
    allegroBtn: document.getElementById('allegro-btn'),
    olxBtn: document.getElementById('olx-btn'),
    socialButtons: document.querySelectorAll('.social-button'),
    infoSection: document.querySelector('.info-section'),
    infoCards: document.querySelectorAll('.info-card'),
    scrollBtn: document.querySelector('.scroll-down-btn'),
    instagramBtn: document.getElementById('instagram-btn'),
    facebookBtn: document.getElementById('facebook-btn'),
    tiktokBtn: document.getElementById('tiktok-btn'),
    scrollToAboutBtn: document.getElementById('scroll-to-about'),
    aboutSection: document.getElementById('about'),
    aboutContent: document.querySelector('.about-content'),
    aboutTitle: document.querySelector('.about-title'),
    aboutText: document.querySelector('.about-text'),
    statItems: document.querySelectorAll('.stat-item')
  };
  
  // Helper functions using cached elements
  function setElementOpacity(element, value) {
    if (element) element.style.opacity = value;
  }
  
  function setElementsOpacity(elements, value) {
    if (elements) elements.forEach(el => el.style.opacity = value);
  }
  
  // Animacja sekwencyjna z jednym requestAnimationFrame
  const animationSequence = [
    { time: 0, action: () => {
      setElementOpacity(elements.background, '1');
      setElementOpacity(elements.logo, '1');
      setElementOpacity(elements.subtitle, '1');
      setElementOpacity(elements.tagline, '1');
      setElementOpacity(elements.allegroBtn, '1');
      setElementOpacity(elements.olxBtn, '1');
    }},
    { time: 200, action: () => setElementOpacity(elements.container, '1') },
    { time: 900, action: () => setElementsOpacity(elements.socialButtons, '1') },
    { time: 1300, action: () => {
      setElementOpacity(elements.infoSection, '1');
      elements.infoCards.forEach(function(card, index) {
        setTimeout(function() {
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        }, index * 150);
      });
    }},
    { time: 1600, action: () => setElementOpacity(elements.scrollBtn, '1') }
  ];
  
  const startTime = performance.now();
  function runAnimationSequence() {
    const currentTime = performance.now() - startTime;
    
    animationSequence.forEach(step => {
      if (currentTime >= step.time && !step.executed) {
        step.action();
        step.executed = true;
      }
    });
    
    if (animationSequence.some(step => !step.executed)) {
      requestAnimationFrame(runAnimationSequence);
    }
  }
  
  requestAnimationFrame(runAnimationSequence);
  
  // Obsługa kliknięć przycisków (otwarcie nowych kart) - using cached elements
  if (elements.allegroBtn) {
    elements.allegroBtn.addEventListener('click', function() {
      window.open('https://allegro.pl/uzytkownik/BookLoft/sklep', '_blank');
    }, { passive: true });
  }
  
  if (elements.olxBtn) {
    elements.olxBtn.addEventListener('click', function() {
      window.open('https://www.olx.pl/oferty/uzytkownik/1kqSz0/', '_blank');
    }, { passive: true });
  }

  if (elements.instagramBtn) {
    elements.instagramBtn.addEventListener('click', function() {
      window.open('https://www.instagram.com/bookloft.pl?igsh=dmg0ZTRra3BoaGh0', '_blank');
    }, { passive: true });
  }

  if (elements.facebookBtn) {
    elements.facebookBtn.addEventListener('click', function() {
      window.open('https://www.facebook.com/profile.php?id=100081830936011', '_blank');
    }, { passive: true });
  }

  if (elements.tiktokBtn) {
    elements.tiktokBtn.addEventListener('click', function() {
      window.open('https://www.tiktok.com/@bookloft.pl', '_blank');
    }, { passive: true });
  }

  // Płynne scrollowanie do sekcji "O nas"
  if (elements.scrollToAboutBtn) {
    elements.scrollToAboutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      if (elements.aboutSection) {
        const targetTop = elements.aboutSection.offsetTop;
        
        // Używaj native smooth scroll jeśli dostępne
        if ('scrollBehavior' in document.documentElement.style) {
          window.scrollTo({
            top: targetTop,
            behavior: 'smooth'
          });
        } else {
          // Fallback dla starszych browsers - używamy requestAnimationFrame
          const startPosition = window.pageYOffset;
          const distance = targetTop - startPosition;
          const duration = 1000;
          let start = null;
          
          function animationStep(timestamp) {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            const easeProgress = Math.min(progress * progress, 1);
            window.scrollTo(0, startPosition + distance * easeProgress);
            if (progress < 1) {
              requestAnimationFrame(animationStep);
            }
          }
          
          requestAnimationFrame(animationStep);
        }
      }
    });
  }
  
  // Prosty Intersection Observer dla sekcji "O nas"
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Fade-in and scale-up about content
          if (elements.aboutContent) {
            elements.aboutContent.style.opacity = '1';
            elements.aboutContent.classList.add('scale-animate');
          }
          
          setTimeout(function() {
            setElementOpacity(elements.aboutTitle, '1');
          }, 200);
          
          setTimeout(function() {
            if (elements.aboutText) {
              elements.aboutText.classList.add('text-animate');
            }
          }, 600);
          
          // Animacja statystyk od lewej do prawej - wcześniej ale wolniej
          setTimeout(function() {
            elements.statItems.forEach(function(stat, index) {
              setTimeout(function() {
                stat.style.opacity = '1';
                stat.style.transform = 'translateX(0)';
              }, index * 300);
            });
          }, 800);
        } else {
          // Scale down when leaving viewport
          if (elements.aboutContent) {
            elements.aboutContent.classList.remove('scale-animate');
          }
        }
      });
    }, observerOptions);
    
    if (elements.aboutContent) {
      observer.observe(elements.aboutContent);
    }
  } else {
    // Fallback - pokazuj od razu jeśli brak Intersection Observer
    if (elements.aboutContent) {
      elements.aboutContent.style.opacity = '1';
      elements.aboutContent.classList.add('scale-animate');
    }
    
    setElementOpacity(elements.aboutTitle, '1');
    
    if (elements.aboutText) {
      elements.aboutText.classList.add('text-animate');
    }
    
    elements.statItems.forEach(function(stat) {
      stat.style.opacity = '1';
      stat.style.transform = 'translateX(0)';
    });
  }
  
});