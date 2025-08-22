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
    window.open('https://www.instagram.com/bookloft_pl/', '_blank');
  });

  $('#facebook-btn').click(function(){
    window.open('https://www.facebook.com/bookloft.pl', '_blank');
  });

  // Generowanie dynamicznych cząsteczek
  function createParticle() {
    const particle = $('<div class="particle"></div>');
    const startX = Math.random() * 100;
    const duration = 15 + Math.random() * 20;
    
    particle.css({
      left: startX + '%',
      animationDuration: duration + 's',
      animationDelay: Math.random() * 5 + 's'
    });
    
    $('.particles').append(particle);
    
    setTimeout(function() {
      particle.remove();
    }, duration * 1000);
  }
  
  // Tworzenie początkowych cząsteczek - więcej cząsteczek
  for(let i = 0; i < 10; i++) {
    setTimeout(createParticle, i * 1000);
  }
  
  // Tworzenie nowych cząsteczek co jakiś czas - częściej
  setInterval(createParticle, 2500);

  // Smooth scroll dla info-section
  $('.info-section').on('wheel', function(e) {
    e.preventDefault();
    const delta = e.originalEvent.deltaY;
    $(this).scrollTop($(this).scrollTop() + delta * 0.3);
  });
});
