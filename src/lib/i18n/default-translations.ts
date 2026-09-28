// Tajik and English versions of the default website texts (design/Mavzunai Jovid Website Main.dc.html).
// Drafts for the salon to review: edited in /admin with the ТҶ / EN switch.
import type { Translations } from "./content";

export const DEFAULT_TRANSLATIONS: Translations = {
  tg: {
    hero: {
      kicker: "Душанбе · Gallery of Beauty MJ",
      title: "Зебоӣ,\nки илҳом мебахшад",
      subtitle: "Нигоҳубини боҳашамат. Зебоии беинтиҳои шумо.",
      badges: ["★ 5.0 Tripadvisor", "№1 дар байни спа ва салонҳои Душанбе"],
    },
    philosophy: {
      title: "Фалсафаи мо",
      body: "Зебоӣ на танҳо намуди зоҳирӣ, балки эътимод ва хислат аст. Мавзуна ва дастаи ӯ барои ҳар як меҳмон таҷрибаи шахсӣ меофаранд: аз нохунороии субҳ то ороиши пурраи арӯсӣ — дар оромӣ, ғамхорӣ ва бе шитоб.",
    },
    services: {
      title: "Хизматрасониҳои мо",
      cards: [
        { name: "Мӯй", desc: "Мӯйсаргирӣ, рангкунӣ, балаяж ва ороиши мӯй — ранг мувофиқи ранги пӯсти шумо." },
        { name: "Нохун", desc: "Маникюр ва педикюр, гел-лак, тарҳҳои нарм ва ҷасур." },
        { name: "Ороиш ва абрӯ", desc: "Ороиши рӯзона, шомгоҳӣ ва арӯсӣ. Меъмории абрӯ ва мижгонҳо." },
        { name: "Ороиши арӯсӣ", desc: "Ороиши пурра ва кироя додани либосҳои арӯсӣ ва шомгоҳӣ." },
      ],
    },
    marquee: ["Мӯй", "Нохун", "Ороиш", "Абрӯ ва мижгон", "Ороиши арӯсӣ", "Кироияи либос"],
    bridal: {
      kicker: "Толори тӯй",
      title: "Рӯзи зеботарини\nшумо",
      body: "Ороиши мӯй, рӯй ва маникюр дар як субҳ — бе шитоб. Кироияи либосҳои арӯсӣ ва шомгоҳӣ бо пӯшида дидан ва мувофиқ кардан ба қомат, ороиши озмоишӣ пеш аз тӯй ва ороиш барои модар ва дугонаҳои арӯс.",
      cta: "Муҳокимаи ороиш",
    },
    reviews: {
      title: "Меҳмонон моро дӯст медоранд",
      items: [
        {
          id: "zukhra",
          text: "«Фазои хеле гуворо, тозагии комил. Соҳиби салон Мавзуна худаш маслиҳат дод, ки ба ман чӣ мувофиқ аст — натиҷа олӣ. Ба ҳамаи дугонаҳоям тавсия медиҳам!»",
        },
        { id: "di", text: "«Аз назди салон мегузаштам, даромадам — ва ба ваҷд омадам. Хеле бароҳат, кормандони меҳрубон, хизматрасонӣ дар сатҳи баланд. Рушд ёбед!»" },
        { id: "farzona", text: "«Ороиши арӯсӣ — орзу. Либос, мӯй, ороиши рӯй — ҳама дар як ҷо ва ҳама олӣ.»" },
      ],
    },
    about: {
      title: "Дар бораи салон",
      body: "Ду ошёна дар маркази Душанбе: салони зебоӣ ва толори тӯй зери як бом. Тозагии комил, устоҳои диққатманд ва соҳиби салон Мавзуна, ки худаш маслиҳат медиҳад, ки маҳз ба шумо чӣ мувофиқ аст. Ба пиёлае чой биёед — салонро нишон медиҳем ва усторо интихоб мекунем.",
      facts: [
        { value: "5.0", label: "Tripadvisor" },
        { value: "№1", label: "дар Душанбе" },
        { value: "119K", label: "обуначӣ" },
      ],
    },
    booking: { title: "Сабти онлайн", intro: "Хизматрасонӣ, усто ва вақти холиро интихоб кунед — сабт фавран ба тақвими мо ворид мешавад." },
    contacts: { address: "кӯчаи Бухоро, 23/25, ошёнаҳои 1–2", district: "Шоҳмансур, Душанбе", hours: "Сш–Яш: 09:00–18:00", dayOff: "Душанбе — рӯзи истироҳат" },
    seo: {
      title: "Mavzunai Jovid — салони зебоӣ ва толори тӯй дар Душанбе",
      description: "Gallery of Beauty MJ: мӯй, нохун, ороиш, ороиши арӯсӣ ва кироияи либос. кӯчаи Бухоро 23/25. Сабт дар WhatsApp +992 98 103 11 11.",
    },
    team: {
      title: "Устоҳои мо",
      intro: "Дастаи Мавзуна: ҳар як усто ихтисос ва услуби худро дорад. Усторо интихоб кунед ва онлайн сабт шавед.",
      portfolioTitle: "Портфолио",
      portfolioIntro: "Корҳои устоҳои мо — ороиши мӯй, рангкунӣ, маникюр, абрӯ ва ороиши арӯсӣ.",
    },
  },
  en: {
    hero: {
      kicker: "Dushanbe · Gallery of Beauty MJ",
      title: "Beauty\nthat inspires",
      subtitle: "Luxurious care. Your timeless beauty.",
      badges: ["★ 5.0 Tripadvisor", "#1 among spas and salons in Dushanbe"],
    },
    philosophy: {
      title: "Our philosophy",
      body: "Beauty is more than a look — it's confidence and character. Mavzuna and her team create a personal experience for every guest: from a morning manicure to a complete bridal look — in calm, with care and never in a hurry.",
    },
    services: {
      title: "Our services",
      cards: [
        { name: "Hair", desc: "Cuts, colour, balayage and styling — a shade that suits your skin tone." },
        { name: "Nails", desc: "Manicure and pedicure, gel polish, nude and bold designs." },
        { name: "Makeup & brows", desc: "Day, evening and bridal makeup. Brow design and lashes." },
        { name: "Bridal looks", desc: "The complete bridal look, plus wedding and evening dress rental." },
      ],
    },
    marquee: ["Hair", "Nails", "Makeup", "Brows & lashes", "Bridal looks", "Dress rental"],
    bridal: {
      kicker: "Wedding hall",
      title: "Your most\nbeautiful day",
      body: "Hair, makeup and nails in one morning — without rushing. Wedding and evening dress rental with fittings and tailoring, a trial look before the celebration, and looks for the bride's mother and bridesmaids.",
      cta: "Discuss your look",
    },
    reviews: {
      title: "Loved by our guests",
      items: [
        {
          id: "zukhra",
          text: "“A very pleasant atmosphere and spotless. The owner, Mavzuna, suggested what would suit me herself — the result was perfect. I recommend it to all my friends!”",
        },
        { id: "di", text: "“I was passing by, stepped in — and was delighted. Very cosy, friendly staff, excellent service. Wishing you every success!”" },
        { id: "farzona", text: "“My bridal look was a dream. Dress, hair, makeup — all in one place, and all perfect.”" },
      ],
    },
    about: {
      title: "About the salon",
      body: "Two floors in the centre of Dushanbe: a beauty salon and a wedding hall under one roof. Spotless, attentive masters and the owner, Mavzuna, who will tell you herself what suits you. Drop in for a cup of tea — we'll show you around and find your master.",
      facts: [
        { value: "5.0", label: "Tripadvisor" },
        { value: "#1", label: "in Dushanbe" },
        { value: "119K", label: "followers" },
      ],
    },
    booking: { title: "Book online", intro: "Choose a service, a master and a free time — your booking goes straight into our calendar." },
    contacts: { address: "23/25 Bukhoro St, 1st–2nd floor", district: "Shohmansur, Dushanbe", hours: "Tue–Sun: 09:00–18:00", dayOff: "Closed on Mondays" },
    seo: {
      title: "Mavzunai Jovid — beauty salon & wedding hall in Dushanbe",
      description: "Gallery of Beauty MJ: hair, nails, makeup, bridal looks and dress rental. 23/25 Bukhoro St. Book on WhatsApp +992 98 103 11 11.",
    },
    team: {
      title: "Our masters",
      intro: "Mavzuna's team: every master has their own speciality and signature style. Choose a master and book online.",
      portfolioTitle: "Portfolio",
      portfolioIntro: "Work by our masters — styling, colour, manicure, brows and bridal looks.",
    },
  },
};
