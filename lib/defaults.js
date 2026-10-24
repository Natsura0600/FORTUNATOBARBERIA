// Datos iniciales de Fortunato Barbería (tomados de su perfil público de reservas).
// Se cargan solos la primera vez; después todo se edita desde /admin.

const CDN = "https://dcx13p9dsx90t.cloudfront.net/uploads";

export const DEFAULT_CONFIG = {
  business: {
    name: "Fortunato",
    wordmark: "FOЯTUNATO",
    tagline: "Tu estilo, nuestra dedicación.",
    address: "Colón 1156",
    addressNote: "Local céntrico, a metros de la plaza Colón",
    city: "Luján, Buenos Aires",
    whatsapp: "542323529387",
    instagram: "",
    mapsQuery: "Colón 1156, Luján, Buenos Aires, Argentina",
    coords: "34°34′S · 59°06′O",
    cancelHours: 3,
    leadMinutes: 30,
    bookingDaysAhead: 21,
    slotStep: 15,
  },
  images: {
    hero: `${CDN}/attachment_images/216778/attachment_db38a0b85c9809c4.png`,
    logo: `${CDN}/logos/page_logo_1d18665bd92b1701.png`,
    gallery: [
      `${CDN}/attachment_images/216778/attachment_db38a0b85c9809c4.png`,
    ],
  },
  // 0 = domingo ... 6 = sábado. null = cerrado.
  hours: {
    0: null,
    1: null,
    2: { open: "09:00", close: "20:00" },
    3: { open: "09:00", close: "20:00" },
    4: { open: "09:00", close: "20:00" },
    5: { open: "09:00", close: "20:45" },
    6: { open: "09:00", close: "20:45" },
  },
  closedDates: [],
  barbers: [
    {
      id: "lautaro",
      name: "Lautaro Reynoso",
      role: "Barbero",
      bio: "Cortes modernos y clásicos, fade a máquina y trabajo fino con navaja.",
      photo: "",
      commission: 50,
      offWeekdays: [],
      active: true,
    },
    {
      id: "tina",
      name: "Tina Mastrolia",
      role: "Barbera",
      bio: "Tijera, texturas y diseño de barba pensado para cada rostro.",
      photo: "",
      commission: 50,
      offWeekdays: [],
      active: true,
    },
  ],
  services: [
    { id: "corte", name: "Corte de cabello", description: "Diseñamos un corte que se adapte a tu perfil.", duration: 30, prices: { lautaro: 20000, tina: 20000 }, active: true },
    { id: "corte-cejas", name: "Corte + cejas", description: "Corte de cabello y perfilado de cejas.", duration: 30, prices: { lautaro: 25000, tina: 25000 }, active: true },
    { id: "corte-barba", name: "Corte + barba", description: "Tu corte complementado con una barba adaptada a tus rasgos.", duration: 60, prices: { lautaro: 30000, tina: 30000 }, active: true },
    { id: "completo", name: "Servicio completo", description: "Corte, perfilado de cejas con navaja y diseño y recorte de barba.", duration: 60, prices: { lautaro: 35000, tina: 35000 }, active: true },
    { id: "barba", name: "Arreglo de barba", description: "Recorte, contorno y terminación.", duration: 30, prices: { lautaro: 13500, tina: 13500 }, active: true },
    { id: "cejas", name: "Cejas", description: "Perfilado de cejas.", duration: 15, prices: { lautaro: 6000, tina: 6000 }, active: true },
  ],
  notices: [
    { id: "n1", title: "Cancelaciones", text: "Podés cancelar o reprogramar tu turno hasta 3 horas antes.", active: true, highlight: false, until: "" },
    { id: "n2", title: "Lunes y domingos", text: "Lunes y domingos el local permanece cerrado.", active: true, highlight: false, until: "" },
    { id: "n3", title: "Turnos online", text: "Ya podés reservar tu turno desde la web, eligiendo barbero y horario.", active: true, highlight: true, until: "" },
  ],
  reviews: [
    { name: "Federico", service: "Corte de cabello", text: "El lugar re limpio y la atención excelente, se nota apenas entrás." },
    { name: "Roberto", service: "Corte de cabello", text: "Muy buen corte, ambiente cálido y muy buena relación precio y servicio." },
    { name: "María", service: "Corte con Lautaro", text: "Excelente atención." },
  ],
  about: [
    "Somos una barbería de Luján donde el estilo, la calidad y la buena atención se encuentran en un mismo lugar.",
    "Cada trabajo se hace de forma personalizada, cuidando el detalle para que no solo te guste el resultado: que disfrutes la experiencia.",
    "Un espacio moderno, cómodo y con identidad propia, donde cada persona que entra se siente bien recibida y quiere volver.",
  ],
};

export const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "mercadopago", label: "Mercado Pago" },
  { id: "debito", label: "Débito" },
];
