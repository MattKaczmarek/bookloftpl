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

    // 4) Po zakończeniu animacji tagline pojawiają się przyciski
    setTimeout(function() {
      $('.button').each(function(index) {
        $(this).delay(500 * index).fadeTo(1000, 1);
      });
    }, totalTaglineTime);
  });

  // 5) Obsługa kliknięć przycisków (otwarcie nowych kart)
  $('#allegro-btn').click(function(){
    window.open('https://allegro.pl/uzytkownik/BookLoft/sklep', '_blank');
  });
  
  $('#olx-btn').click(function(){
    window.open('https://www.olx.pl/oferty/uzytkownik/1kqSz0/', '_blank');
  });
});
