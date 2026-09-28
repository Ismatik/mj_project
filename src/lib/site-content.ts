// Everything the site admin edits. Stored as JSON in SiteDocument ("draft" / "published").
// Defaults are the texts of design/Mavzunai Jovid Website Main.dc.html.
import { normalizeMasters, type MasterProfile } from "./masters";

export type SitePhoto = { url: string; credit?: string; creditUrl?: string };
export type SiteReview = { id: string; author: string; text: string; source: string; visible: boolean; photo?: SitePhoto };
export type SiteCategoryCard = { icon: "scissors" | "hand" | "brush" | "crown" | "eye" | "sparkles" | "droplet"; name: string; desc: string };

export type SiteContent = {
  hero: { kicker: string; title: string; subtitle: string; badges: string[] };
  philosophy: { title: string; body: string };
  services: { title: string; cards: SiteCategoryCard[] };
  marquee: string[];
  bridal: { kicker: string; title: string; body: string; cta: string };
  reviews: { title: string; items: SiteReview[] };
  about: { title: string; body: string; facts: { value: string; label: string }[] };
  booking: { title: string; intro: string; services: string[] };
  photos: { hero: SitePhoto; bridal: SitePhoto; interior: SitePhoto };
  contacts: {
    phone: string;
    whatsapp: string;
    instagram: string;
    instagramGallery: string;
    address: string;
    district: string;
    hours: string;
    dayOff: string;
  };
  seo: { title: string; description: string };
  /** Masters pages: title and intro of /mastera and /portfolio */
  team: { title: string; intro: string; portfolioTitle: string; portfolioIntro: string };
  /** Master profiles and portfolio, keyed by Staff id */
  masters: Record<string, MasterProfile>;
  /** Pending "на сайте" changes from the admin, applied to Service.showOnSite on publish. */
  serviceOverrides: Record<string, boolean>;
};

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    kicker: "Душанбе · Gallery of Beauty MJ",
    title: "Красота,\nкоторая вдохновляет",
    subtitle: "Роскошь ухода. Ваша вневременная красота.",
    badges: ["★ 5.0 Tripadvisor", "№1 среди спа и салонов Душанбе"],
  },
  philosophy: {
    title: "Наша философия",
    body: "Красота — это не только образ, это уверенность и характер. Мавзуна и её команда создают персональный опыт для каждой гостьи: от утреннего маникюра до свадебного образа под ключ — в тишине, заботе и без спешки.",
  },
  services: {
    title: "Наши услуги",
    cards: [
      { icon: "scissors", name: "Волосы", desc: "Стрижки, окрашивание, балаяж и укладки — оттенок под ваш тон кожи." },
      { icon: "hand", name: "Ногти", desc: "Маникюр и педикюр, гель-лак, нюдовые и смелые дизайны." },
      { icon: "brush", name: "Макияж и брови", desc: "Дневной, вечерний и свадебный макияж. Архитектура бровей и ресницы." },
      { icon: "crown", name: "Свадебные образы", desc: "Образ под ключ и прокат свадебных и вечерних платьев." },
    ],
  },
  marquee: ["Волосы", "Ногти", "Макияж", "Брови и ресницы", "Свадебные образы", "Прокат платьев"],
  bridal: {
    kicker: "Свадебный зал",
    title: "Ваш самый\nкрасивый день",
    body: "Причёска, макияж и маникюр в одно утро — без спешки. Прокат свадебных и вечерних платьев с примеркой и подгонкой по фигуре, пробный образ до торжества и образы для мамы и подружек невесты.",
    cta: "Обсудить образ",
  },
  reviews: {
    title: "Нас любят гости",
    items: [
      {
        id: "zukhra",
        author: "Zukhra K.",
        text: "«Очень приятная атмосфера, идеальная чистота. Владелица Мавзуна сама подсказала, что мне пойдёт — результат идеальный. Советую всем подругам!»",
        source: "Tripadvisor · сен 2022",
        visible: true,
        photo: {
          url: "https://images.unsplash.com/photo-1650292266612-a634d749626f?q=75&w=400&auto=format&fit=crop&sat=-100",
          credit: "Photo by Alexander Krivitskiy on Unsplash",
          creditUrl: "https://unsplash.com/@krivitskiy",
        },
      },
      {
        id: "di",
        author: "D I, Душанбе",
        text: "«Проходил мимо, зашёл — и был в восторге от салона. Очень уютно, доброжелательный персонал, услуги на высоте. Процветания вам!»",
        source: "Tripadvisor · июл 2023",
        visible: true,
        photo: {
          url: "https://images.unsplash.com/photo-1731907547491-dd745791d8b5?q=75&w=400&auto=format&fit=crop&sat=-100",
          credit: "Photo by Anshul on Unsplash",
          creditUrl: "https://unsplash.com/@tomatopictures1",
        },
      },
      {
        id: "farzona",
        author: "Фарзона И.",
        text: "«Свадебный образ — мечта. Платье, причёска, макияж — всё в одном месте, и всё идеально.»",
        source: "Instagram · черновик",
        visible: false,
      },
    ],
  },
  about: {
    title: "О салоне",
    body: "Два этажа в центре Душанбе: салон красоты и свадебный зал под одной крышей. Идеальная чистота, внимательные мастера и владелица Мавзуна, которая сама подскажет, что пойдёт именно вам. Загляните на чашку чая — покажем салон и подберём мастера.",
    facts: [
      { value: "5.0", label: "Tripadvisor" },
      { value: "№1", label: "в Душанбе" },
      { value: "119K", label: "подписчиков" },
    ],
  },
  booking: {
    title: "Онлайн-запись",
    intro: "Выберите услугу, мастера и свободное время — запись сразу попадёт в наш календарь.",
    services: ["Волосы", "Ногти", "Макияж и брови", "Свадебный образ", "Консультация"],
  },
  photos: {
    hero: {
      url: "https://images.unsplash.com/photo-1688395199230-ab7c7170a4b6?q=75&w=1400&auto=format&fit=crop&sat=-100",
      credit: "Photo by engin akyurt on Unsplash",
      creditUrl: "https://unsplash.com/@enginakyurt",
    },
    bridal: {
      url: "https://images.unsplash.com/photo-1708134128589-0dfd38b2203a?q=75&w=1200&auto=format&fit=crop&sat=-100",
      credit: "Photo by 550Park Luxury Wedding Films on Unsplash",
      creditUrl: "https://unsplash.com/@550park",
    },
    interior: {
      url: "https://api.mino.tj/storage/53935/conversions/16BBF696-509D-4AB2-8205-82B0860153C6-panel.jpg",
      credit: "Фото: Beauty Studio Mavzunai Jovid (mino.tj)",
      creditUrl: "https://mino.tj/biz/beauty-studio-mavzunai-jovid-dushanbe",
    },
  },
  contacts: {
    phone: "+992 98 103 11 11",
    whatsapp: "992981031111",
    instagram: "mavzunai.jovid.official",
    instagramGallery: "mavzunai_jovid_gallery_beauty",
    address: "ул. Бухоро, 23/25, 1–2 этаж",
    district: "Шохмансур, Душанбе",
    hours: "Вт–Вс: 09:00–18:00",
    dayOff: "Понедельник — выходной",
  },
  seo: {
    title: "Mavzunai Jovid — салон красоты и свадебный зал в Душанбе",
    description:
      "Gallery of Beauty MJ: волосы, ногти, макияж, свадебные образы и прокат платьев. ул. Бухоро 23/25. Запись в WhatsApp +992 98 103 11 11.",
  },
  team: {
    title: "Наши мастера",
    intro: "Команда Мавзуны: у каждого мастера своя специализация и свой почерк. Выберите мастера и запишитесь к нему онлайн.",
    portfolioTitle: "Портфолио",
    portfolioIntro: "Работы наших мастеров — причёски, окрашивание, маникюр, брови и свадебные образы.",
  },
  masters: {},
  serviceOverrides: {},
};

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);

/** Deep-merges stored JSON over the defaults so older documents never miss a field. */
export function normalizeContent(raw: Json, base: Json = DEFAULT_CONTENT): SiteContent {
  const merge = (def: Json, val: Json): Json => {
    if (Array.isArray(def)) return Array.isArray(val) ? val : def;
    // Free-form maps (serviceOverrides): keep boolean entries as stored
    if (isObj(def) && Object.keys(def).length === 0) {
      return isObj(val) ? Object.fromEntries(Object.entries(val).filter(([, v]) => typeof v === "boolean")) : {};
    }
    if (isObj(def)) {
      const out: Record<string, Json> = {};
      for (const k of Object.keys(def)) out[k] = merge(def[k], isObj(val) ? val[k] : undefined);
      return out;
    }
    return typeof val === typeof def ? val : def;
  };
  const out = merge(base, raw) as SiteContent;
  out.masters = normalizeMasters(isObj(raw) ? raw.masters : undefined);
  return out;
}

export const whatsappLink = (c: SiteContent["contacts"], text?: string) =>
  `https://wa.me/${c.whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const telLink = (c: SiteContent["contacts"]) => `tel:+${c.phone.replace(/\D/g, "")}`;
export const instagramLink = (handle: string) => `https://instagram.com/${handle.replace(/^@/, "")}`;
