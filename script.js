$(document).ready(function() {
  // Wszystko widoczne od razu - bez animacji
  $('.background').css('opacity', '1');
  $('.container').css('opacity', '1');
  $('.subtitle').css('opacity', '1');
  
  // Tekst tagline bez animacji
  $('.tagline .letter').css({
    'opacity': '1',
    'top': '0'
  });
  
  // Wszystkie przyciski widoczne od razu
  $('.button').css('opacity', '1');
  $('.info-card').css('opacity', '1');
  $('.scroll-down-btn').css('opacity', '1');
  
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
  
  // Sekcja "O nas" widoczna od razu bez animacji
  $('.about-content').css('opacity', '1');
  $('.about-title').css('opacity', '1');
  $('.about-text p').css('opacity', '1');
  $('.stat-item').css('opacity', '1');
});