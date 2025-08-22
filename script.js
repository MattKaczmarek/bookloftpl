$(document).ready(function() {
  // 1) Fade in tła (z ciemnym gradientem + obraz biblioteki)
  $('.background').fadeTo(1500, 1);

  // 2) Przygotowanie tekstu do animacji literka po literce dla .tagline
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

  // 3) Fade in kontenera (logo, podtytuł, tekst)
  $('.container').fadeTo(1500, 1, function() {
    // Logo pozostaje niezmienione (animacja CSS)

    // Jednoczesne wyświetlenie podtytułu i animacja tekstu (.tagline)
    $('.subtitle').fadeTo(1000, 1);

    // Animacja literka po literce dla .tagline, 30% szybciej niż wcześniej
    let letterIndex = 0;
    $('.word').each(function() {
      $(this).find('.letter').each(function() {
        // Opóźnienie: 20ms * 0.7 ≈ 14ms na literę, animacja: 150ms * 0.7 ≈ 105ms
        $(this).delay(14 * letterIndex).animate({
          opacity: 1,
          top: '0'
        }, 105);
        letterIndex++;
      });
    });

    // Obliczamy łączny czas animacji tagline:
    // ostatnia litera zacznie się animować po: 14*(letterIndex-1) ms,
    // a animacja trwa 105ms.
    var totalTaglineTime = 14 * (letterIndex - 1) + 105;

    // 4) Po zakończeniu animacji tagline pojawiają się przyciski z fadeInUp
    setTimeout(function() {
      // Najpierw Allegro i OLX (główne przyciski) - jeden po drugim
      $('#allegro-btn').addClass('buttons-fade-in');
      
      setTimeout(function() {
        $('#olx-btn').addClass('buttons-fade-in');
      }, 300);
      
      // Potem social media przyciski jednocześnie (po 800ms)
      setTimeout(function() {
        $('.social-button').addClass('buttons-fade-in');
      }, 800);
    }, totalTaglineTime * 0.7);
  });

  // 5) Obsługa kliknięć przycisków (otwarcie nowych kart)
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
  $('#scroll-to-about').click(function(e) {
    e.preventDefault();
    
    currentSection = 1; // Ustaw aktualną sekcję na "O nas"
    
    // Płynne scrollowanie z easing
    $('html, body').animate({
      scrollTop: $('#about').offset().top
    }, {
      duration: 1500,
      easing: 'easeInOutCubic',
      complete: function() {
        // Animacja pojawiania się zawartości sekcji
        $('.about-content').addClass('animate-in');
      }
    });
  });

  // Custom easing function
  $.easing.easeInOutCubic = function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t*t + b;
    return c/2*((t-=2)*t*t + 2) + b;
  };

  // Obsługa scroll wheel i touch - przeskakiwanie między sekcjami
  let isScrolling = false;
  let currentSection = 0; // 0 = home, 1 = about
  let touchStartY = 0;
  let touchEndY = 0;
  const sections = [
    { element: '.container', offset: 0 },
    { element: '#about', offset: 0 }
  ];

  // Funkcja do płynnego przejścia między sekcjami
  function smoothScrollToSection(direction) {
    if (isScrolling) return;
    
    isScrolling = true;
    
    if (direction > 0) { // Scroll w dół
      if (currentSection < sections.length - 1) {
        currentSection++;
      }
    } else { // Scroll w górę
      if (currentSection > 0) {
        currentSection--;
      }
    }
    
    scrollToSection(currentSection);
  }

  // Touch events dla mobile
  $(document).on('touchstart', function(e) {
    touchStartY = e.originalEvent.touches[0].clientY;
  });

  $(document).on('touchmove', function(e) {
    if (isScrolling) {
      e.preventDefault();
    }
  });

  $(document).on('touchend', function(e) {
    if (isScrolling) return;
    
    touchEndY = e.originalEvent.changedTouches[0].clientY;
    const deltaY = touchStartY - touchEndY;
    
    // Minimalna odległość swipe
    if (Math.abs(deltaY) > 50) {
      e.preventDefault();
      smoothScrollToSection(deltaY);
    }
  });

  $(window).on('wheel', function(e) {
    e.preventDefault();
    const delta = e.originalEvent.deltaY;
    smoothScrollToSection(delta);
  });

  // Obsługa klawiszy strzałek
  $(document).keydown(function(e) {
    if (isScrolling) return;
    
    if (e.keyCode === 40 || e.keyCode === 34) { // Strzałka w dół lub Page Down
      e.preventDefault();
      if (currentSection < sections.length - 1) {
        currentSection++;
        scrollToSection(currentSection);
      }
    } else if (e.keyCode === 38 || e.keyCode === 33) { // Strzałka w górę lub Page Up
      e.preventDefault();
      if (currentSection > 0) {
        currentSection--;
        scrollToSection(currentSection);
      }
    }
  });

  // Funkcja pomocnicza do scrollowania do sekcji
  function scrollToSection(sectionIndex) {
    isScrolling = true;
    const targetSection = sections[sectionIndex];
    let targetOffset;
    
    if (sectionIndex === 0) {
      targetOffset = 0;
    } else {
      targetOffset = $(targetSection.element).offset().top;
    }
    
    $('html, body').animate({
      scrollTop: targetOffset
    }, {
      duration: 1500,
      easing: 'easeInOutCubic',
      complete: function() {
        isScrolling = false;
        if (sectionIndex === 1) {
          $('.about-content').addClass('animate-in');
        }
      }
    });
  }

  // Generowanie dynamicznych cząsteczek
  function createParticle() {
    const particle = $('<div class="particle"></div>');
    const startX = Math.random() * 100;
    const duration = 12 + Math.random() * 18;
    const size = 2 + Math.random() * 3; // Różne rozmiary 2-5px
    const opacity = 0.3 + Math.random() * 0.5; // Różne przezroczystości
    
    particle.css({
      left: startX + '%',
      animationDuration: duration + 's',
      animationDelay: Math.random() * 3 + 's',
      width: size + 'px',
      height: size + 'px',
      opacity: opacity
    });
    
    $('.particles').append(particle);
    
    setTimeout(function() {
      particle.remove();
    }, duration * 1000);
  }
  
  // Tworzenie początkowych cząsteczek - dużo więcej
  for(let i = 0; i < 15; i++) {
    setTimeout(createParticle, i * 500);
  }
  
  // Tworzenie nowych cząsteczek co jakiś czas - bardzo często
  setInterval(createParticle, 1500);

  // Smooth scroll dla info-section
  $('.info-section').on('wheel', function(e) {
    e.preventDefault();
    const delta = e.originalEvent.deltaY;
    $(this).scrollTop($(this).scrollTop() + delta * 0.3);
  });
});
