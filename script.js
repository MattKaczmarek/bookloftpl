document.addEventListener('DOMContentLoaded', function() {
  // Wymuszenie powrotu na górę strony po odświeżeniu
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  
  // Helper functions for native JS
  function setOpacity(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.style.opacity = value;
  }
  
  function setOpacityAll(selector, value) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.style.opacity = value);
  }
  
  function addClass(selector, className) {
    const element = document.querySelector(selector);
    if (element) element.classList.add(className);
  }
  
  // Animacja sekwencyjna z jednym requestAnimationFrame
  const animationSequence = [
    { time: 0, action: () => {
      setOpacity('.background', '1');
      setOpacity('.logo', '1');
      setOpacity('.subtitle', '1');
    }},
    { time: 200, action: () => setOpacity('.container', '1') },
    { time: 1000, action: () => setOpacity('.tagline', '1') },
    { time: 1400, action: () => {
      setOpacity('#allegro-btn', '1');
      setOpacity('#olx-btn', '1');
    }},
    { time: 1800, action: () => setOpacityAll('.social-button', '1') },
    { time: 2200, action: () => {
      setOpacity('.info-section', '1');
      const infoCards = document.querySelectorAll('.info-card');
      infoCards.forEach(function(card, index) {
        setTimeout(function() {
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        }, index * 150);
      });
    }},
    { time: 2500, action: () => setOpacity('.scroll-down-btn', '1') }
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
  
  // Obsługa kliknięć przycisków (otwarcie nowych kart)
  const allegroBtn = document.getElementById('allegro-btn');
  if (allegroBtn) {
    allegroBtn.addEventListener('click', function() {
      window.open('https://allegro.pl/uzytkownik/BookLoft/sklep', '_blank');
    });
  }
  
  const olxBtn = document.getElementById('olx-btn');
  if (olxBtn) {
    olxBtn.addEventListener('click', function() {
      window.open('https://www.olx.pl/oferty/uzytkownik/1kqSz0/', '_blank');
    });
  }

  const instagramBtn = document.getElementById('instagram-btn');
  if (instagramBtn) {
    instagramBtn.addEventListener('click', function() {
      window.open('https://www.instagram.com/bookloft.pl?igsh=dmg0ZTRra3BoaGh0', '_blank');
    });
  }

  const facebookBtn = document.getElementById('facebook-btn');
  if (facebookBtn) {
    facebookBtn.addEventListener('click', function() {
      window.open('https://www.facebook.com/profile.php?id=100081830936011', '_blank');
    });
  }

  const tiktokBtn = document.getElementById('tiktok-btn');
  if (tiktokBtn) {
    tiktokBtn.addEventListener('click', function() {
      window.open('https://www.tiktok.com/@bookloft.pl', '_blank');
    });
  }

  // Płynne scrollowanie do sekcji "O nas"
  const scrollToAboutBtn = document.getElementById('scroll-to-about');
  if (scrollToAboutBtn) {
    scrollToAboutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        const targetTop = aboutSection.offsetTop;
        
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
          const aboutContent = document.querySelector('.about-content');
          if (aboutContent) {
            aboutContent.style.opacity = '1';
            aboutContent.classList.add('scale-animate');
          }
          
          setTimeout(function() {
            setOpacity('.about-title', '1');
          }, 200);
          
          setTimeout(function() {
            const aboutText = document.querySelector('.about-text');
            if (aboutText) {
              aboutText.classList.add('text-animate');
            }
          }, 600);
          
          // Animacja statystyk od lewej do prawej - wcześniej ale wolniej
          setTimeout(function() {
            const statItems = document.querySelectorAll('.stat-item');
            statItems.forEach(function(stat, index) {
              setTimeout(function() {
                stat.style.opacity = '1';
                stat.style.transform = 'translateX(0)';
              }, index * 300);
            });
          }, 800);
        } else {
          // Scale down when leaving viewport
          const aboutContent = document.querySelector('.about-content');
          if (aboutContent) {
            aboutContent.classList.remove('scale-animate');
          }
        }
      });
    }, observerOptions);
    
    const aboutContent = document.querySelector('.about-content');
    if (aboutContent) {
      observer.observe(aboutContent);
    }
  } else {
    // Fallback - pokazuj od razu jeśli brak Intersection Observer
    const aboutContent = document.querySelector('.about-content');
    if (aboutContent) {
      aboutContent.style.opacity = '1';
      aboutContent.classList.add('scale-animate');
    }
    
    setOpacity('.about-title', '1');
    
    const aboutText = document.querySelector('.about-text');
    if (aboutText) {
      aboutText.classList.add('text-animate');
    }
    
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach(function(stat) {
      stat.style.opacity = '1';
      stat.style.transform = 'translateX(0)';
    });
  }
  
});