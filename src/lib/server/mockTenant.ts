import type {
  Professional,
  ProfessionalAvailability,
  Service,
  Tenant,
} from "@/types";

/**
 * Dados mock para demonstração/visualização sem backend configurado.
 *
 * Quando o Firebase Admin SDK não está configurado (getAdminFirestore() === null),
 * as rotas públicas servem este conteúdo para que o site da empresa possa ser
 * visualizado com serviços, profissionais, horários, depoimentos e FAQ reais.
 * Nada aqui é persistido; o agendamento mock devolve um id fictício.
 */

const HOST = "America/Sao_Paulo";

const MOCK_LOGO = "https://picsum.photos/seed/barbearia-logo/120/120";
const MOCK_BANNER = "https://picsum.photos/seed/barbearia-banner/1600/640";
const MOCK_GALLERY = [
  "https://picsum.photos/seed/barbearia-g1/800/600",
  "https://picsum.photos/seed/barbearia-g2/800/600",
  "https://picsum.photos/seed/barbearia-g3/800/600",
  "https://picsum.photos/seed/barbearia-g4/800/600",
];

function mockTimestamp(date = new Date()) {
  return date;
}

function buildTenant(slug: string): Tenant {
  const now = new Date();
  return {
    id: "tenant-mock-barbearia",
    slug,
    name: "Barbearia Vintage LTDA",
    tradeName: "Barbearia Vintage",
    cnpjCpf: "00.000.000/0001-00",
    phone: "(11) 4002-8922",
    whatsapp: "(11) 98888-7777",
    email: "contato@barbeariavintage.com",
    address: {
      street: "Rua Augusta",
      number: "1234",
      complement: "Loja 2",
      neighborhood: "Consolação",
      city: "São Paulo",
      state: "SP",
      zip: "01304-001",
    },
    instagram: "barbeariavintage.sp",
    description:
      "Barbearia tradicional no coração de São Paulo. Corte, barba e muito estilo desde 2012. Ambiente descontraído, cerveja gelada e atendimento de primeira.",
    logoUrl: MOCK_LOGO,
    bannerUrl: MOCK_BANNER,
    segmentId: "barber",
    planId: "PRO",
    status: "active",
    subscriptionStatus: "ACTIVE",
    subscriptionEndsAt: null,
    createdAt: mockTimestamp(now),
    updatedAt: mockTimestamp(now),
    ownerUserId: "mock-owner",
    settings: {
      timezone: HOST,
      currency: "BRL",
      slotIntervalMinutes: 30,
      bookingLeadTimeMinutes: 60,
      bookingCancelWindowMinutes: 120,
      confirmationRequired: false,
      allowOnlinePayments: false,
    },
    branding: {
      primaryColor: "#1f2937",
      secondaryColor: "#b45309",
      theme: "light",
      bannerUrl: MOCK_BANNER,
      galleryUrls: MOCK_GALLERY,
      testimonials: [
        {
          id: "t1",
          author: "Carlos Eduardo",
          text: "Melhor corte da região. Ambiente excelente e o Rafael capricha demais no acabamento. Já virei cliente fiel!",
          rating: 5,
        },
        {
          id: "t2",
          author: "Bruno Ferreira",
          text: "Atendimento nota 10, consegui agendar pelo site em menos de um minuto. A barba ficou impecável.",
          rating: 5,
        },
        {
          id: "t3",
          author: "André Souza",
          text: "Preço justo e muito profissionalismo. O combo corte + barba vale cada centavo.",
          rating: 4,
        },
      ],
      faq: [
        {
          id: "f1",
          question: "Preciso chegar com antecedência?",
          answer:
            "Recomendamos chegar 5 minutos antes para não atrasar o próximo horário. Se atrasar mais de 10 minutos, o horário poderá ser remarcado.",
        },
        {
          id: "f2",
          question: "Posso remarcar ou cancelar meu agendamento?",
          answer:
            "Sim! Você pode remarcar pelo link do agendamento até 2 horas antes do horário marcado. Em caso de dúvida, chame no WhatsApp.",
        },
        {
          id: "f3",
          question: "Aceitam cartão?",
          answer:
            "Aceitamos dinheiro, Pix e cartões de débito e crédito. Consulte as condições na loja.",
        },
      ],
      socialLinks: {
        instagram: "barbeariavintage.sp",
        tiktok: "barbeariavintage",
        whatsapp: "5511988887777",
      },
      showContact: true,
      showLocation: true,
      sectionOrder: [
        "services",
        "professionals",
        "schedule",
        "gallery",
        "testimonials",
        "faq",
        "contact",
      ],
    },
    featureFlags: {
      payments: false,
      whatsapp: true,
      customDomain: false,
      reports: true,
      loyalty: false,
      inventory: false,
      multiBranch: false,
      api: false,
    },
    limits: {
      maxProfessionals: 10,
      maxCustomers: 1000,
      maxAppointmentsPerMonth: 2000,
      maxStorageGb: 10,
      maxBranches: 1,
    },
  };
}

function buildServices(): Service[] {
  const createdAt = mockTimestamp();
  const base = {
    tenantId: "tenant-mock-barbearia",
    requiresProfessional: true,
    createdAt,
    updatedAt: createdAt,
  };
  return [
    {
      id: "svc-corte",
      name: "Corte de cabelo",
      description: "Corte na tesoura ou máquina, lavagem e finalização com produtos premium.",
      price: 60,
      durationMinutes: 45,
      categoryId: "cat-cabelo",
      status: "active",
      professionals: ["pro-rafael", "pro-diego", "pro-marcos"],
      ...base,
    },
    {
      id: "svc-barba",
      name: "Barba",
      description: "Modelagem completa com toalha quente, navalha e produtos pós-barba.",
      price: 45,
      durationMinutes: 30,
      categoryId: "cat-barba",
      status: "active",
      professionals: ["pro-rafael", "pro-diego"],
      ...base,
    },
    {
      id: "svc-combo",
      name: "Corte + Barba",
      description: "O combo clássico da casa com desconto especial.",
      price: 95,
      durationMinutes: 75,
      categoryId: "cat-combo",
      status: "active",
      professionals: ["pro-rafael", "pro-diego", "pro-marcos"],
      ...base,
    },
    {
      id: "svc-sobrancelha",
      name: "Sobrancelha",
      description: "Design de sobrancelha masculina com cera ou pinça.",
      price: 25,
      durationMinutes: 15,
      categoryId: "cat-barba",
      status: "active",
      professionals: ["pro-marcos"],
      ...base,
    },
    {
      id: "svc-pigmentacao",
      name: "Pigmentação de barba",
      description: "Preenchimento de falhas com tonalizante próprio para a pele.",
      price: 80,
      durationMinutes: 60,
      categoryId: "cat-barba",
      status: "active",
      professionals: ["pro-rafael"],
      ...base,
    },
  ];
}

function buildProfessionals(): Professional[] {
  const createdAt = mockTimestamp();
  const base = {
    tenantId: "tenant-mock-barbearia",
    active: true,
    serviceIds: [],
    createdAt,
    updatedAt: createdAt,
  };
  return [
    {
      id: "pro-rafael",
      name: "Rafael",
      photoUrl: undefined,
      description: "Fundador e barbeiro sênior. Especialista em cortes clássicos.",
      color: "#1f2937",
      ...base,
    },
    {
      id: "pro-diego",
      name: "Diego",
      photoUrl: undefined,
      description: "Referência em barboterapia e navalhado.",
      color: "#b45309",
      ...base,
    },
    {
      id: "pro-marcos",
      name: "Marcos",
      photoUrl: undefined,
      description: "Cortes modernos, degradê e pigmentação.",
      color: "#0369a1",
      ...base,
    },
  ];
}

function buildAvailability(): ProfessionalAvailability[] {
  const workDays = [1, 2, 3, 4, 5, 6].map((d) => ({
    dayOfWeek: d as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    enabled: true,
    startTime: "09:00",
    endTime: "19:00",
    breaks: [],
  }));
  const base = {
    tenantId: "tenant-mock-barbearia",
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
    updatedAt: mockTimestamp(),
  };
  return [
    { id: "av-rafael", professionalId: "pro-rafael", workDays, ...base },
    { id: "av-diego", professionalId: "pro-diego", workDays, ...base },
    { id: "av-marcos", professionalId: "pro-marcos", workDays, ...base },
  ];
}

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface MockScheduleEntry {
  dayOfWeek: number;
  label: string;
  open: string;
  close: string;
}

export function getMockSiteData(slug: string): {
  tenant: Tenant;
  services: Service[];
  professionals: Professional[];
  schedule: MockScheduleEntry[];
} {
  const schedule: MockScheduleEntry[] = [1, 2, 3, 4, 5, 6].map((d) => ({
    dayOfWeek: d,
    label: DAY_LABELS[d],
    open: "09:00",
    close: "19:00",
  }));
  return {
    tenant: buildTenant(slug),
    services: buildServices(),
    professionals: buildProfessionals(),
    schedule,
  };
}

export function getMockTenant(slug: string): Tenant {
  return buildTenant(slug);
}

export function getMockSlots(input: {
  serviceId: string;
  professionalId: string;
  date: string;
}): { slots: string[]; timezone: string } {
  const { professionalId, date } = input;
  const availability = buildAvailability().find((a) => a.professionalId === professionalId);
  if (!availability) return { slots: [], timezone: HOST };

  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const workDay = availability.workDays.find((wd) => wd.dayOfWeek === day);
  if (!workDay || !workDay.enabled) return { slots: [], timezone: HOST };

  const [sh, sm] = workDay.startTime.split(":").map(Number);
  const [eh, em] = workDay.endTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const interval = 30;

  const slots: string[] = [];
  for (let m = startMin; m + interval <= endMin; m += interval) {
    slots.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    );
  }

  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  if (date === todayLocal) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return { slots: slots.filter((t) => tToMin(t) > nowMin + 30), timezone: HOST };
  }

  return { slots, timezone: HOST };
}

function tToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function createMockAppointment(input: {
  tenantSlug: string;
  serviceId: string;
  professionalId: string;
  date: string;
  time: string;
  customer: { name: string; phone?: string; email?: string };
  couponCode?: string;
}): { appointmentId: string; customerId: string; price: number; couponApplied: boolean } {
  const service = buildServices().find((s) => s.id === input.serviceId);
  const couponApplied = Boolean(input.couponCode?.toUpperCase() === "VINTAGE10");
  const price = service
    ? couponApplied
      ? Math.round(service.price * 0.9)
      : service.price
    : 0;
  return {
    appointmentId: `mock-${Date.now()}`,
    customerId: "mock-customer",
    price,
    couponApplied,
  };
}
