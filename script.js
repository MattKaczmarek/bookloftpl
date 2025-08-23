$(document).ready(function() {
  // Wymuszenie powrotu na górę strony po odświeżeniu
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  
  // Przygotowanie tekstu tagline do animacji
  const taglineText = $('.tagline').text().trim();
  $('.tagline').empty();
  const words = taglineText.split(' ');
  
  words.forEach((word) => {
    const $wordSpan = $('<span class="word"></span>');
    for (let i = 0; i < word.length; i++) {
      const $letterSpan = $('<span class="letter"></span>').text(word[i]);
      $wordSpan.append($letterSpan);
    }
    $('.tagline').append($wordSpan).append(' ');
  });
  
  // KROK 1: Fade-in dla tła + logo + podtytuł razem
  $('.background').css('opacity', '1');
  $('.logo').css('opacity', '1');
  $('.subtitle').css('opacity', '1');
  
  // KROK 2: Container po 500ms
  setTimeout(function() {
    $('.container').css('opacity', '1');
  }, 500);
  
  // KROK 3: Przyciski Allegro/OLX + animacja tagline razem po 1.3s
  setTimeout(function() {
    // Główne przyciski razem
    $('#allegro-btn').css('opacity', '1');
    $('#olx-btn').css('opacity', '1');
    
    // Animacja liter tagline (równocześnie)
    $('.tagline .letter').each(function(index) {
      var letter = $(this);
      setTimeout(function() {
        letter.css({
          'opacity': '1',
          'top': '0'
        });
      }, index * 20); // 20ms między literami - szybciej
    });
  }, 1300);
  
  // KROK 4: Info cards + social buttons + scroll button razem na końcu po 3s
  setTimeout(function() {
    $('.info-section').css('opacity', '1');
    $('.social-button').css('opacity', '1');
    $('.scroll-down-btn').css('opacity', '1');
  }, 3000);
  
  // Obsługa kliknięć przycisków (otwarcie nowych kart)
  $('#allegro-btn').click(function(){
    window.open('https://allegro.pl/uzytkownik/BookLoft/sklep', '_blank');
  });
  
  $('#olx-btn').click(function(){
    window.open('https://www.olx.pl/oferty/uzytkownik/1kqSz0/', '_blank');
  });

  $('#instagram-btn').click(function(){
    window.open('https://www.instagram.com/bookloft.pl?igsh=dmg0ZTRra3BoaGh0', '_blank');
  });

  $('#facebook-btn').click(function(){
    window.open('https://www.facebook.com/profile.php?id=100081830936011', '_blank');
  });

  // Płynne scrollowanie do sekcji "O nas"
  $('#scroll-to-about').on('click', function(e) {
    e.preventDefault();
    
    const aboutSection = $('#about');
    if (aboutSection.length) {
      const targetTop = aboutSection.offset().top;
      
      // Używaj native smooth scroll jeśli dostępne
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({
          top: targetTop,
          behavior: 'smooth'
        });
      } else {
        // Fallback dla starszych browsers
        $('html, body').animate({
          scrollTop: targetTop
        }, 1000);
      }
    }
  });
  
  // Prosty Intersection Observer dla sekcji "O nas"
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Fade-in about content
          $('.about-content').css('opacity', '1');
          
          setTimeout(function() {
            $('.about-title').css('opacity', '1');
          }, 200);
          
          setTimeout(function() {
            $('.about-text').addClass('text-animate');
          }, 600);
          
          setTimeout(function() {
            $('.stat-item').each(function(index) {
              var stat = $(this);
              setTimeout(function() {
                stat.addClass('stat-animate');
              }, index * 300);
            });
          }, 1400);
        }
      });
    }, observerOptions);
    
    const aboutContent = document.querySelector('.about-content');
    if (aboutContent) {
      observer.observe(aboutContent);
    }
  } else {
    // Fallback - pokazuj od razu jeśli brak Intersection Observer
    $('.about-content').css('opacity', '1');
    $('.about-title').css('opacity', '1');
    $('.about-text').addClass('text-animate');
    $('.stat-item').addClass('stat-animate');
  }
  
  // WebView-compatible particles generation
  function createWebViewParticle() {
    const particle = $('<div class="particle"></div>');
    const startX = Math.random() * 100;
    const duration = 8 + Math.random() * 4; // 8-12s faster
    const size = 3 + Math.random() * 3; // 3-6px
    const opacity = 0.5 + Math.random() * 0.3; // 0.5-0.8
    
    particle.css({
      left: startX + '%',
      bottom: '-20px',
      width: size + 'px',
      height: size + 'px',
      opacity: opacity,
      'animation-duration': duration + 's',
      'animation-delay': Math.random() * 2 + 's'
    });
    
    $('.particles-container').append(particle);
    
    // Remove particle after animation
    setTimeout(function() {
      particle.remove();
    }, (duration + 2) * 1000);
  }
  
  // Create floating particles from different positions
  function createFloatingParticle() {
    const particle = $('<div class="particle"></div>');
    const startX = Math.random() * 100;
    const startY = Math.random() * 100; // Random Y position
    const duration = 6 + Math.random() * 4; // 6-10s
    const size = 2 + Math.random() * 2; // 2-4px smaller for floating
    const opacity = 0.4 + Math.random() * 0.3; // 0.4-0.7
    
    particle.css({
      left: startX + '%',
      top: startY + '%',
      width: size + 'px',
      height: size + 'px',
      opacity: opacity,
      animation: 'none'
    });
    
    // Random floating movement
    const endX = Math.random() * 100;
    const endY = Math.random() * 100;
    
    particle.animate({
      left: endX + '%',
      top: endY + '%',
      opacity: 0
    }, duration * 1000, 'linear', function() {
      particle.remove();
    });
    
    $('.particles-container').append(particle);
  }
  
  // Mix of bottom-up and floating particles
  for(let i = 0; i < 12; i++) {
    setTimeout(function() {
      createWebViewParticle();
    }, i * 300);
  }
  
  for(let i = 0; i < 8; i++) {
    setTimeout(function() {
      createFloatingParticle();
    }, i * 500);
  }
  
  // Continue creating particles
  setInterval(createWebViewParticle, 1200);
  setInterval(createFloatingParticle, 2000);
});