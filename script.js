document.addEventListener('DOMContentLoaded', function() {
  // Track page load time
  const pageLoadTime = performance.now();
  
  // Wymuszenie powrotu na górę strony po odświeżeniu
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  
  // Track engagement milestones
  const engagementTimes = [10000, 30000, 60000]; // 10s, 30s, 1min
  let trackedTimes = [];
  
  engagementTimes.forEach(time => {
    setTimeout(() => {
      if (!trackedTimes.includes(time)) {
        trackEvent('time_on_page', 'engagement', `${time/1000}s`);
        trackedTimes.push(time);
      }
    }, time);
  });
  
  // Cache DOM elements for better performance
  const elements = {
    background: document.querySelector('.background'),
    logo: document.querySelector('.logo'),
    subtitle: document.querySelector('.subtitle'),
    container: document.querySelector('.container'),
    tagline: document.querySelector('.tagline'),
    allegroBtn: document.getElementById('allegro-btn'),
    olxBtn: document.getElementById('olx-btn'),
    searchLabel: document.querySelector('.search-label'),
    searchInput: document.querySelector('.search-input'),
    searchBtn: document.getElementById('search-btn'),
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
  
  // Google Analytics tracking helper
  function trackEvent(action, category, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }
  }

  // Helper function to add button event listeners (click + middle click) with tracking
  function addButtonListeners(element, url, trackingLabel, eventName) {
    if (!element) return;
    
    const openUrl = () => {
      // Track the button click with platform name as event
      trackEvent(eventName, 'button', trackingLabel);
      window.open(url, '_blank');
    };
    
    element.addEventListener('click', openUrl, { passive: true });
    element.addEventListener('mousedown', function(e) {
      if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        trackEvent(eventName, 'button', trackingLabel);
        window.open(url, '_blank');
      }
    }, { passive: false });
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
    { time: 600, action: () => {
      setElementOpacity(elements.searchLabel, '1');
      setElementOpacity(elements.searchInput, '1');
      setElementOpacity(elements.searchBtn, '1');
    }},
    { time: 900, action: () => {
      setElementOpacity(elements.tiktokBtn, '1');
      setElementOpacity(elements.facebookBtn, '1');
      setElementOpacity(elements.instagramBtn, '1');
      if (elements.instagramBtn) {
        elements.instagramBtn.style.animation = 'pulse 2s ease-in-out infinite';
      }
    }},
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
  
  // Obsługa kliknięć przycisków (otwarcie nowych kart) - with tracking
  addButtonListeners(elements.allegroBtn, 'https://allegro.pl/uzytkownik/BookLoft/sklep', 'allegro_button', 'allegro');
  addButtonListeners(elements.olxBtn, 'https://www.olx.pl/oferty/uzytkownik/1kqSz0/', 'olx_button', 'olx');
  addButtonListeners(elements.instagramBtn, 'https://www.instagram.com/bookloft.pl?igsh=dmg0ZTRra3BoaGh0', 'instagram_button', 'instagram');
  addButtonListeners(elements.facebookBtn, 'https://www.facebook.com/profile.php?id=100081830936011', 'facebook_button', 'facebook');
  addButtonListeners(elements.tiktokBtn, 'https://www.tiktok.com/@bookloft.pl', 'tiktok_button', 'tiktok');

  // Funkcja wyszukiwania - przekierowanie do Allegro z trackowaniem
  function performSearch() {
    const searchQuery = elements.searchInput ? elements.searchInput.value.trim() : '';
    
    if (searchQuery) {
      // Track search event with query - only when actually searching
      trackEvent('wyszukiwanie', 'search', searchQuery);
      
      // Enkodowanie zapytania dla URL
      const encodedQuery = encodeURIComponent(searchQuery);
      const allegroSearchUrl = `https://allegro.pl/uzytkownik/BookLoft?string=${encodedQuery}`;
      
      // Otwórz w nowej karcie
      window.open(allegroSearchUrl, '_blank');
    }
    // Removed empty search tracking - don't track when nothing is searched
  }

  // Obsługa przycisku "Szukaj"
  if (elements.searchBtn) {
    elements.searchBtn.addEventListener('click', function(e) {
      e.preventDefault();
      performSearch();
    }, { passive: false });
    
    elements.searchBtn.addEventListener('mousedown', function(e) {
      if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        performSearch();
      }
    }, { passive: false });
  }

  // Obsługa klawisza Enter w polu wyszukiwania
  if (elements.searchInput) {
    elements.searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    }, { passive: false });
  }

  // Płynne scrollowanie do sekcji "O nas" z trackowaniem
  if (elements.scrollToAboutBtn) {
    elements.scrollToAboutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Track scroll to about section
      trackEvent('scroll_to_section', 'navigation', 'about_section');
      
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
          // Track when about section becomes visible
          trackEvent('section_view', 'engagement', 'about_section');
          
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