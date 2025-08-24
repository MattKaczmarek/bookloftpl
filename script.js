$(document).ready(function() {
  // Wymuszenie powrotu na górę strony po odświeżeniu
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  
  // KROK 1: Fade-in dla tła + logo + subtitle razem
  $('.background').css('opacity', '1');
  $('.logo').css('opacity', '1');
  $('.subtitle').css('opacity', '1');
  
  // KROK 2: Container po 200ms
  setTimeout(function() {
    $('.container').css('opacity', '1');
  }, 200);
  
  // KROK 3: Tagline "Sprzedajemy używane..." po 1s
  setTimeout(function() {
    $('.tagline').css('opacity', '1');
  }, 1000);
  
  // KROK 4: Przyciski Allegro/OLX po 1.4s
  setTimeout(function() {
    $('#allegro-btn, #olx-btn').css('opacity', '1');
  }, 1400);
  
  // KROK 5: Social buttons po 1.8s
  setTimeout(function() {
    $('.social-button').css('opacity', '1');
  }, 1800);
  
  // KROK 6: Info cards z animacją od lewej do prawej po 2.2s
  setTimeout(function() {
    $('.info-section').css('opacity', '1');
    $('.info-card').each(function(index) {
      var card = $(this);
      setTimeout(function() {
        card.css({
          'opacity': '1',
          'transform': 'translateX(0)'
        });
      }, index * 150);
    });
  }, 2200);
  
  // KROK 7: Scroll button "Dowiedz się więcej" po 2.5s
  setTimeout(function() {
    $('.scroll-down-btn').css('opacity', '1');
  }, 2500);
  
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

  $('#tiktok-btn').click(function(){
    window.open('https://www.tiktok.com/@bookloft.pl', '_blank');
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
  
  // Prosty Intersection Observer dla sekcji "O nas"
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Fade-in and scale-up about content
          $('.about-content').css('opacity', '1').addClass('scale-animate');
          
          setTimeout(function() {
            $('.about-title').css('opacity', '1');
          }, 200);
          
          setTimeout(function() {
            $('.about-text').addClass('text-animate');
          }, 600);
          
          // Animacja statystyk od lewej do prawej - wcześniej ale wolniej
          setTimeout(function() {
            $('.stat-item').each(function(index) {
              var stat = $(this);
              setTimeout(function() {
                stat.css({
                  'opacity': '1',
                  'transform': 'translateX(0)'
                });
              }, index * 300);
            });
          }, 800);
        } else {
          // Scale down when leaving viewport
          $('.about-content').removeClass('scale-animate');
        }
      });
    }, observerOptions);
    
    const aboutContent = document.querySelector('.about-content');
    if (aboutContent) {
      observer.observe(aboutContent);
    }
  } else {
    // Fallback - pokazuj od razu jeśli brak Intersection Observer
    $('.about-content').css('opacity', '1').addClass('scale-animate');
    $('.about-title').css('opacity', '1');
    $('.about-text').addClass('text-animate');
    $('.stat-item').css({
      'opacity': '1',
      'transform': 'translateX(0)'
    });
  }
  
});