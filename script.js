$(document).ready(function() {
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
      }, index * 30); // 30ms między literami
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
            $('.about-text p').each(function(index) {
              var paragraph = $(this);
              setTimeout(function() {
                paragraph.css('opacity', '1');
              }, index * 150);
            });
          }, 400);
          
          setTimeout(function() {
            $('.stat-item').each(function(index) {
              var stat = $(this);
              setTimeout(function() {
                stat.css('opacity', '1');
              }, index * 200);
            });
          }, 800);
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
    $('.about-text p').css('opacity', '1');
    $('.stat-item').css('opacity', '1');
  }
});