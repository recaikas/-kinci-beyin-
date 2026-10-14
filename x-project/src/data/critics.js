// Eleştirmen yorumları (P, içerik). bands: [eşik, 5 yorum] — puan ≥ eşik olan son kademe seçilir.
import { GENRE_CRITICS } from './genres.js';

// 1–5 arası tam sayı, 5'ten sonra 0,2'lik adımlar. genre: her tür için kötüden iyiye 5 yorum.
export const CRITICS = {
  _tag: 'P',
  outlets: ['Piksel Dergisi', 'Joystick Haftalık', 'Oyun Kritik', 'Kartuş Gazetesi'],
  bands: [
    [1, ['Kutuyu açtım, kapattım, gömdüm.', 'Disket bile utandı.', 'Bunu oynamak bir insan hakları ihlali.', 'Ekran kendini kapattı. Haklıydı.', 'Puan veremiyoruz çünkü sıfır yok.']],
    [2, ['Başlık ekranı oyunun en iyi yeri.', 'Bir çocuk ağladı. Ben de.', 'Hataların arasında bir oyun bulmaya çalıştık.', 'Kopyalamaya bile değmez, korsanlar bile almadı.', 'Joystick’imi elimden almak istedi.']],
    [3, ['Fikir var, oyun yok.', 'Kırk dakikada üç kez çöktü, dördüncüde biz çöktük.', 'Kontroller sanki eldivenle yazılmış.', 'Hikâye bir peçeteye sığar, peçete daha iyi.', 'İndirimde bile pahalı.']],
    [4, ['Bir yerlerde iyi bir oyun saklanıyor ama bulamadık.', 'Ses efektleri komşuyu şikâyet ettirir.', 'İkinci bölümde sıkıldık, birincide de.', 'Grafikler 5 yıl geriden geliyor.', 'Sadece çok sabırlı ebeveynlere.']],
    [5, ['Vasat. Ama dürüstçe vasat.', 'Ne ısıtır ne yakar.', 'Bir hafta sonu oynanır, pazartesi unutulur.', 'Potansiyel var, cila yok.', 'Ortalama bir oyunun ortalama bir taklidi.']],
    [5.2, ['Bir tık vasatın üstünde, iki tık sıkıcı.', 'Kötü değil ama iyi olduğunu da kimse söylemedi.', 'Kahve molası için ideal, kahve daha uzun sürüyor.', 'Kendi türünün sıradan bir neferi.', 'Tavsiye etmiyoruz, vazgeçirmiyoruz da.']],
    [5.4, ['Kenar köşe parlıyor, ortası ham.', 'Ekip uğraşmış, belli ki zaman yetmemiş.', 'Hatalar tatlı, oyun ılık.', 'Fiyatı düşerse bakılır.', 'İyi bir taslak, eksik bir oyun.']],
    [5.6, ['Arada güzel anlar yakalıyor.', 'Müziği oyunundan iyi.', 'Bir sonraki oyunu merak ettirdi; bu değil.', 'Hayranları sever, gerisi geçer.', 'Fena değil ama aklımızda da kalmadı.']],
    [5.8, ['Sıcak su gibi: zararsız.', 'Sağlam ama sığ.', 'Kontroller oturmuş, içerik oturmamış.', 'İlk saat keyifli, sonrası tekrar.', 'Bütçesine göre makul bir iş.']],
    [6, ['Tam ortada. Ne aşk ne nefret.', 'Bir akşam için iyi bir arkadaş.', 'Temiz, düzgün, heyecansız.', 'Kimseye zarar vermeyen bir oyun.', 'Türünü seviyorsan şans ver.']],
    [6.2, ['Ufak dokunuşlarla iyi olabilirmiş.', 'Kendi çapında eğlenceli.', 'Bir iki fikri gerçekten parlak.', 'Kusurlarını tatlılığıyla örtüyor.', 'Hafif ama hoş.']],
    [6.4, ['İyi niyetli ve çoğunlukla başarılı.', 'Eksikleri var, ruhu da var.', 'Hızlı başlıyor, yavaş bitiyor.', 'Hayran kitlesini memnun edecek kadar iyi.', 'Arkadaşına ödünç verilecek cinsten.']],
    [6.6, ['Fena değil, hatta biraz iyi.', 'Sürprizler az ama keyfi bol.', 'Grafikleri göz dolduruyor, oynanış biraz geride.', 'Dengeli, sakin, sevimli.', 'Bir devam oyunu hak ediyor.']],
    [6.8, ['İyi olmaya çok yakın.', 'Sağlam bir temel üstüne kurulmuş.', 'Birkaç hata dışında akıcı.', 'Saatlerin nasıl geçtiğini fark etmedik.', 'Stüdyonun yükselişte olduğu belli.']],
    [7, ['İyi bir oyun. Nokta.', 'Parasını hak ediyor.', 'Türüne yakışan bir iş.', 'Göz dolduran, keyif veren.', 'Rafta görürsen al.']],
    [7.2, ['İyi, hatta akılda kalıcı.', 'Ekibin tutkusu ekrana yansımış.', 'Ufak pürüzler dışında pırıl pırıl.', 'Hafta sonumuzu yedi.', 'Bir sonraki oyun için beklentimiz yükseldi.']],
    [7.4, ['Bağımlılık yapma riski taşır.', 'Kendi türünün iyi örneklerinden.', 'Detaylara gösterilen özen etkileyici.', 'Yapımcıları gözümüze girdi.', 'Gece yarısı bir el daha dedirtiyor.']],
    [7.6, ['Gerçekten iyi. Gerçekten.', 'Oynanış oturmuş, dünya canlı.', 'Ufak tefek kusurlar affedilir.', 'Ofiste herkes konuşuyor.', 'Cilalı, akıllı, eğlenceli.']],
    [7.8, ['İyiden çok iyiye geçişin eşiğinde.', 'Saatlerce bırakamadık.', 'Müzikleri kafamızdan çıkmıyor.', 'Bir klasik olmaya aday.', 'Rakiplerini terletecek.']],
    [8, ['Çok iyi. Kaçırma.', 'Yılın akılda kalanlarından.', 'Türünü ileri taşıyor.', 'Tasarım zekâsı her köşede.', 'Bu stüdyoyu takibe alıyoruz.']],
    [8.2, ['Neredeyse kusursuz bir akış.', 'Bitirince baştan başladık.', 'Karakterleri unutamayacağız.', 'Parlak fikirler, sağlam uygulama.', 'Dergi ofisinde kavga çıkardı; herkes oynamak istedi.']],
    [8.4, ['Bir başarı hikâyesi.', 'Her detayı sevgiyle işlenmiş.', 'Rakipler not alsın.', 'Bu fiyata bu kalite ayıp, güzel bir ayıp.', 'Oyun tarihine not düşülecek.']],
    [8.6, ['Muhteşem bir deneyim.', 'Ekranda sihir var.', 'Türün yeni ölçütü bu.', 'Başına oturan kalkmıyor.', 'Tek kelimeyle: vay.']],
    [8.8, ['Yılın oyunu adaylarından.', 'Neredeyse hiçbir şey yanlış değil.', 'Okurlarımıza emrediyoruz: alın.', 'Bu kadar cila nasıl mümkün?', 'Gözlerimiz yaşardı, sonra yine oynadık.']],
    [9, ['Bir başyapıta çok yakın.', 'Yıllarca konuşulacak.', 'Kalbimizi çaldı, iade etmiyor.', 'Bu ekip neyi tutsa altın.', 'Oyun dünyası bir adım öne geçti.']],
    [9.2, ['Başyapıt kapısında.', 'Her saniyesi ayrı bir keyif.', 'Rakipler şimdi panikte.', 'Bu oyun bir kuşağı büyütecek.', 'Puanı yazarken ellerimiz titredi.']],
    [9.4, ['Başyapıt.', 'Zamanın ötesinde bir tasarım.', 'Bunu oynamayan pişman olur.', 'Kusur aradık, bulamadık; utandık.', 'Bir efsane doğuyor.']],
    [9.6, ['Oyun sanattır, işte kanıtı.', 'Tarihî bir an.', 'Bu oyunla büyüyen çocuklar şanslı.', 'Yeni bir altın standart.', 'Kelimeler yetmiyor; oynayın.']],
    [9.8, ['Neredeyse kusursuz. Neredeyse!', 'Oyun tarihinin zirvelerinden.', 'Editör kurulu oy birliğiyle ayakta alkışladı.', 'Rüyamıza girdi, gündüz de oynadık.', 'Bu oyun bir anıt.']],
    [10, ['Kusursuz. Bunu bir daha yazmayabiliriz.', 'Mükemmel. Nokta. Virgül bile koymuyoruz.', 'Oyun bitti, biz bittik, ruhumuz tamamlandı.', 'Bu bir oyun değil, bir olay.', 'Tarihe geçti. Biz de onunla.']],
  ],
  genre: {
    aksiyon: ['Aksiyon sahneleri slayt gösterisi gibi akıyor.', 'Çatışmalar var ama heyecan nerede?', 'Tempo yerinde, nişan alma biraz kaba.', 'Patlamalar tatmin edici, kontroller tıkır tıkır.', 'Adrenalin damarlardan taşıyor!'],
    macera: ['Bulmacalar mantık değil fal ister.', 'Hikâye gezinti gibi, macera gibi değil.', 'Keşfetmek keyifli, yazı biraz uzun.', 'Her köşede yeni bir sır bekliyor.', 'Unutulmaz bir yolculuk, unutulmaz karakterler.'],
    rpg: ['Seviye atlamak işkence, hikâye kayıp.', 'Envanter yönetimi oyundan zevkli.', 'Dünyası geniş, görevleri sığ.', 'Karakter gelişimi tatlı bir bağımlılık.', 'Yüzlerce saat gömülecek bir efsane.'],
    simulasyon: ['Simülasyon değil, simülasyon taklidi.', 'Rakamlar dönüyor ama hayat yok.', 'Sistemler oturmuş, öğrenmesi zor.', 'Saatin nasıl geçtiğini anlamıyorsun.', 'Kendi dünyanı kurmanın en tatlı yolu.'],
    strateji: ['Yapay zekâ kendi askerini vuruyor.', 'Strateji var, derinlik yok.', 'Akıllı kararlar ödüllendiriliyor, arayüz yorucu.', 'Her hamle düşündürüyor, her zafer tatlı.', 'Satranç kadar derin, savaş kadar gürültülü.'],
    casual: ['Beş dakikada sıkıldık, telefonu bıraktık.', 'Basit, belki fazla basit.', 'Otobüs yolculukları için tatlı bir eşlikçi.', 'Bir el daha derken gece oldu.', 'Herkesin seveceği saf neşe.'],
    ...GENRE_CRITICS, // Konu D: yeni ana türler
  },
};
